import Dexie from 'dexie';
import nacl from 'tweetnacl';

// @ts-ignore
import Typeson from 'typeson';
// @ts-ignore
import builtinTypes from 'typeson-registry/presets/builtin';

// Import some usable helper functions
const override = Dexie.override;
const Promise = Dexie.Promise;

interface CryptoOption {
    type: string,
    fields: string[]
}

export interface CryptoOptions {
    [identifier: string]: string | CryptoOption
}

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

function overrideParseStoresSpec(origFunc: Function) {
    return function(stores: any, dbSchema: any) {
        stores._encryptionSettings = '++id';
        origFunc.call(this, stores, dbSchema);
    };
}

function compareArrays(a: any[], b: any[]) {
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

function encryptObject(key: Uint8Array, object: any, nonce: Uint8Array) {
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
function hideValue(input: any) {
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

export default function encrypt(db: Dexie, key: Uint8Array, cryptoSettings: CryptoOptions, nonceOverride : Uint8Array | undefined) {

    if ((key instanceof Uint8Array) === false || key.length !== 32) {
        throw new Error('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.');
    }

    db.Version.prototype._parseStoresSpec = override(
        db.Version.prototype._parseStoresSpec,
        overrideParseStoresSpec
    );

    function encryptWithRule(table: Dexie.Table<any, any>, entity: any, rule: CryptoOption | string) {
        if (rule === undefined) {
            return entity;
        }

        const toEncrypt: any = {};

        if (typeof rule !== 'string' && rule.type === cryptoOptions.BLACKLIST) {
            for (let i = 0; i < rule.fields.length; i++) {
                toEncrypt[rule.fields[i]] = entity[rule.fields[i]];
                entity[rule.fields[i]] = hideValue(entity[rule.fields[i]]);
            }
        } else {
            Object.assign(toEncrypt, entity);
            const indices = table.schema.indexes.map(index => index.name);
            const whitelist = typeof rule !== 'string' && rule.type === cryptoOptions.WHITELIST ? rule.fields : [];
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

    function decryptWithRule(entity: any, rule: CryptoOption | string) {
        if (rule === undefined) {
            return entity;
        }
        if (entity.__encryptedData) {
            const nonce = entity.__encryptedData.slice(0, nacl.secretbox.nonceLength);
            const message = entity.__encryptedData.slice(
                nacl.secretbox.nonceLength,
                entity.__encryptedData.length
            );
            const rawDecrypted = nacl.secretbox.open(message, nonce, key);
            const stringified = decoder.decode(rawDecrypted);
            const decrypted = tson.parse(stringified);
            const toReturn: any = {};
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

    db.on('ready', function() {
        return db.table('_encryptionSettings')
            .toCollection()
            .last()
            .then(oldSettings => {
                return Promise.all(
                    db.tables.map(function(table) {
                        const oldSetting = oldSettings ? oldSettings[table.name] : undefined;
                        const newSetting = cryptoSettings[table.name];

                        function setupHooks() {
                            if (newSetting === undefined) {
                                return;
                            }
                            table.hook('creating', function(primKey, obj) {
                                const preservedValue = {...obj}
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
                            table.hook('updating', function(modifications, primKey, obj) {
                                return encryptWithRule(table, { ...obj }, newSetting);
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
                                if (compareArrays(newSetting.fields, oldSetting.fields)) {
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
                                ref.value = encryptWithRule(table, decrypted, newSetting);
                                return true;
                            })
                            .then(setupHooks);
                    })
                );
            })
            .then(function() {
                return db.table('_encryptionSettings').put(cryptoSettings);
            }).catch(error => {
                if (error.name === 'NotFoundError') {
                    console.error("Dexie-encrypted can't find its encryption table. You may need to bump your database version.");
                }
                throw error;
            });;
    });
}

Object.assign(encrypt, cryptoOptions);