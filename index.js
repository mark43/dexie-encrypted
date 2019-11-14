import Dexie from 'dexie';
import nacl from 'tweetnacl';

import Typeson from 'typeson';
import builtinTypes from 'typeson-registry/presets/builtin';

// Import some usable helper functions
const override = Dexie.override;
const Promise = Dexie.Promise;

export const tableEncryptionOptions = {
    DATA: 'NON_INDEXED_FIELDS',
    NON_INDEXED_FIELDS: 'NON_INDEXED_FIELDS',
    // DATA_AND_INDICES: 'DATA_AND_INDICES', // not implemented.
    WHITELIST: 'WHITELIST',
    BLACKLIST: 'BLACKLIST',
};
export const cryptoOptions = tableEncryptionOptions;

/* options example: 
{
	table1: cryptoOptions.NON_INDEXED_FIELDS,
	table2: {
		type: cryptoOptions.WHITELIST,
		fields: ['harmlessData1', 'harmlessId']
	},
	table3: {
		type: cryptoOptions.BLACKLIST,
		fields: ['sensitiveField1', 'sensitiveField2']
	}
}
*/

const tson = new Typeson().register([builtinTypes]);

function overrideParseStoresSpec(origFunc) {
    return function(stores, dbSchema) {
        stores._encryptionSettings = '++id';
        origFunc.call(this, stores, dbSchema);
    };
}

function compareArrays(a, b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encryptObject(key, object, nonce) {
    nonce = nonce || nacl.randomBytes(nacl.secretbox.nonceLength);
    const stringToEncrypt = tson.stringify(object);
    const encoded = encoder.encode(stringToEncrypt);
    const encrypted = nacl.secretbox(encoded, nonce, key);
    const data = new Uint8Array(nonce.length + encrypted.length);
    data.set(nonce);
    data.set(encrypted, nonce.length);
    return data;
}

// this prevents changing the shape of the object so
// the underlying engine can optimize the hidden class
function hideValue(input) {
    switch (typeof input) {
        case 'number':
            return 0;
        case 'string':
            return '';
        case 'boolean':
            return false;
        case 'undefined':
            return undefined;
        case 'symbol':
            return undefined;
    }
    return {};
}

export default function encrypt(db, keyOrPromise, cryptoSettings, onKeyChange, nonceOverride) {
    let keyPromise;
    if (keyOrPromise.then) {
        keyPromise = keyOrPromise;
    } else if (keyOrPromise instanceof Uint8Array && keyOrPromise.length === 32) {
        keyPromise = Dexie.Promise.resolve(keyOrPromise);
    } else {
        throw new Error('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.');
    }

    db.Version.prototype._parseStoresSpec = override(
        db.Version.prototype._parseStoresSpec,
        overrideParseStoresSpec
    );
    if (db.verno > 0) {
        // Make sure new tables are added if calling encrypt after defining versions.
        try {
            db.version(db.verno).stores({});
        } catch (error) {
            throw new Error(
                'Dexie-encrypt: The call to encrypt() cannot be done on an open database'
            );
        }
    }

    function encryptWithRule(table, entity, rule) {
        if (rule === undefined) {
            return entity;
        }

        const toEncrypt = {};

        if (rule.type === cryptoOptions.BLACKLIST) {
            for (let i = 0; i < rule.fields.length; i++) {
                toEncrypt[rule.fields[i]] = entity[rule.fields[i]];
                entity[rule.fields[i]] = hideValue(entity[rule.fields[i]]);
            }
        } else {
            Object.assign(toEncrypt, entity);
            const indices = table.schema.indexes.map(index => index.name);
            const whitelist = rule.type === cryptoOptions.WHITELIST ? rule.fields : [];
            for (const key in entity) {
                if (
                    key !== table.schema.primKey.name &&
                    entity.hasOwnProperty(key) &&
                    indices.includes(key) === false &&
                    whitelist.includes(key) === false
                ) {
                    toEncrypt[key] = entity[key];
                    entity[key] = hideValue(entity[key]);
                }
            }
        }

        entity.__encryptedData = encryptObject(key, toEncrypt, nonceOverride);
        return entity;
    }

    function decryptWithRule(entity, rule) {
        if (rule === undefined) {
            return entity;
        }
        if (entity && entity.__encryptedData) {
            const nonce = entity.__encryptedData.slice(0, nacl.secretbox.nonceLength);
            const message = entity.__encryptedData.slice(
                nacl.secretbox.nonceLength,
                entity.__encryptedData.length
            );
            const rawDecrypted = nacl.secretbox.open(message, nonce, key);
            const stringified = decoder.decode(rawDecrypted);
            const decrypted = tson.parse(stringified);
            const toReturn = {};
            for (const k in entity) {
                if (decrypted.hasOwnProperty(k)) {
                    toReturn[k] = decrypted[k];
                } else if (entity.hasOwnProperty(k) && k !== '__encryptedData') {
                    toReturn[k] = entity[k];
                }
            }
            return toReturn;
        }
        return entity;
    }

    let key;

    db.on('ready', function() {
        let encryptionSettings;

        try {
            encryptionSettings = db.table('_encryptionSettings');
        } catch (error) {
            throw new Error(
                "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
            );
        }

        return keyPromise
            .then(receivedKey => {
                if (receivedKey instanceof Uint8Array && receivedKey.length === 32) {
                    key = receivedKey;
                } else {
                    throw new Error(
                        'Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.'
                    );
                }
            })
            .then(() =>
                encryptionSettings
                    .toCollection()
                    .last()
                    .then(oldSettings => {
                        const changeDetectionObj = oldSettings
                            ? oldSettings['__key_change_detection']
                            : null;

                        let onKeyChangeResult;
                        let keyChangePromise = Promise.resolve();

                        if (changeDetectionObj) {
                            const nonce = changeDetectionObj.slice(0, nacl.secretbox.nonceLength);
                            const message = changeDetectionObj.slice(
                                nacl.secretbox.nonceLength,
                                changeDetectionObj.length
                            );
                            const rawDecrypted = nacl.secretbox.open(message, nonce, key);

                            if (!rawDecrypted) {
                                // The key has changed. Let's call the handler
                                onKeyChangeResult = onKeyChange(db);

                                keyChangePromise = onKeyChangeResult.then
                                    ? onKeyChangeResult
                                    : new Promise(resolve => {
                                          resolve(onKeyChangeResult);
                                      });
                            }
                        }

                        return keyChangePromise.then(() => {
                            return Promise.all(
                                db.tables.map(function(table) {
                                    const oldSetting = oldSettings
                                        ? oldSettings[table.name]
                                        : undefined;
                                    const newSetting = cryptoSettings[table.name];

                                    function setupHooks() {
                                        if (newSetting === undefined) {
                                            return;
                                        }
                                        table.hook('creating', function(primKey, obj) {
                                            const preservedValue = { ...obj };
                                            encryptWithRule(table, obj, newSetting);
                                            this.onsuccess = () => {
                                                delete obj.__encryptedData;
                                                Object.assign(obj, preservedValue);
                                            };
                                            this.onerror = () => {
                                                delete obj.__encryptedData;
                                                Object.assign(obj, preservedValue);
                                            };
                                        });
                                        table.hook('updating', function(
                                            modifications,
                                            primKey,
                                            obj
                                        ) {
                                            const decrypted = decryptWithRule(
                                                { ...obj },
                                                newSetting
                                            );
                                            const updates = {
                                                ...decrypted,
                                                ...modifications,
                                            };
                                            const encrypted = encryptWithRule(
                                                table,
                                                updates,
                                                newSetting
                                            );
                                            return encrypted;
                                        });
                                        table.hook('reading', function(obj) {
                                            return decryptWithRule(obj, newSetting);
                                        });
                                    }

                                    if (oldSetting === newSetting) {
                                        // no upgrade needed.
                                        setupHooks();
                                        return;
                                    }
                                    if (oldSetting === undefined || newSetting === undefined) {
                                        // no more to compare, the db needs to be encrypted/decrypted
                                    } else if (
                                        typeof oldSetting !== 'string' &&
                                        typeof newSetting !== 'string'
                                    ) {
                                        // both non-strings. Figure out if they're the same.
                                        if (newSetting.type === oldSetting.type) {
                                            if (
                                                compareArrays(newSetting.fields, oldSetting.fields)
                                            ) {
                                                // no upgrade needed.
                                                setupHooks();
                                                return;
                                            }
                                        }
                                    }
                                    return table
                                        .toCollection()
                                        .modify(function(entity, ref) {
                                            const decrypted = decryptWithRule(entity, oldSetting);
                                            ref.value = encryptWithRule(
                                                table,
                                                decrypted,
                                                newSetting
                                            );
                                            return true;
                                        })
                                        .then(setupHooks);
                                })
                            );
                        });
                    })
                    .then(function() {
                        return encryptionSettings.clear();
                    })
                    .then(function() {
                        return encryptionSettings.put({
                            __key_change_detection: encryptObject(
                                key,
                                [1, 2, 3, 4, 5],
                                new Uint8Array(24)
                            ),
                            ...cryptoSettings,
                        });
                    })
                    .catch(error => {
                        if (error.name === 'NotFoundError') {
                            throw new Error(
                                "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
                            );
                        } else {
                            return Promise.reject(error);
                        }
                    })
            );
    });
}

export function clearAllTables(db) {
    return Promise.all(
        db.tables.map(function(table) {
            return table.clear();
        })
    );
}

export async function clearEncryptedTables(db) {
    let encryptionSettings;

    try {
        encryptionSettings = await db
            .table('_encryptionSettings')
            .toCollection()
            .last();
    } catch (error) {
        throw new Error(
            "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
        );
    }

    const promises = Object.keys(encryptionSettings).map(async function(key) {
        const encryptionSettingValue = encryptionSettings[key];

        if (tableEncryptionOptions[encryptionSettingValue]) {
            await db.table(key).clear();
        }
    });

    return Promise.all(promises);
}

Object.assign(encrypt, cryptoOptions, clearAllTables, clearEncryptedTables);
