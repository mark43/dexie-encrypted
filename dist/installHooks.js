"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installHooks = exports.decryptEntity = exports.encryptEntity = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
const types_1 = require("./types");
function encryptEntity(table, entity, rule, encryptionKey, performEncryption, nonceOverride) {
    if (rule === undefined) {
        return entity;
    }
    const indexObjects = table.schema.indexes;
    const indices = indexObjects.map(index => index.keyPath);
    const toEncrypt = {};
    const dataToStore = {};
    const primaryKey = 'primKey' in table.schema ? table.schema.primKey.keyPath : table.schema.primaryKey.keyPath;
    if (rule === types_1.cryptoOptions.NON_INDEXED_FIELDS) {
        for (const key in entity) {
            if (key === primaryKey || indices.includes(key)) {
                dataToStore[key] = entity[key];
            }
            else {
                toEncrypt[key] = entity[key];
            }
        }
    }
    else if (rule.type === types_1.cryptoOptions.ENCRYPT_LIST) {
        for (const key in entity) {
            if (key !== primaryKey && rule.fields.includes(key)) {
                toEncrypt[key] = entity[key];
            }
            else {
                dataToStore[key] = entity[key];
            }
        }
    }
    else {
        const whitelist = rule.type === types_1.cryptoOptions.UNENCRYPTED_LIST ? rule.fields : [];
        for (const key in entity) {
            if (key !== primaryKey &&
                // @ts-ignore
                entity.hasOwnProperty(key) &&
                indices.includes(key) === false &&
                whitelist.includes(key) === false) {
                toEncrypt[key] = entity[key];
            }
            else {
                dataToStore[key] = entity[key];
            }
        }
    }
    // @ts-ignore
    dataToStore.__encryptedData = performEncryption(encryptionKey, entity, nonceOverride);
    return dataToStore;
}
exports.encryptEntity = encryptEntity;
function decryptEntity(entity, rule, encryptionKey, performDecryption) {
    if (rule === undefined || entity === undefined || !entity.__encryptedData) {
        return entity;
    }
    const { __encryptedData } = entity, unencryptedFields = tslib_1.__rest(entity, ["__encryptedData"]);
    let decrypted = performDecryption(encryptionKey, __encryptedData);
    // There is a bug that causes double encryption. I am not sure what causes it,
    // it is very rare and I have no repro steps. I believe the hook is running twice
    // in very rare circumstances, but I have no evidence of it.
    // This decrypts until all decryption is done. The only circumstance where it will
    // create an undesireable result is if your data has an __encryptedData key, and
    // that data can be decrypted by the performDecryption function.
    while (decrypted.__encryptedData) {
        const decryptionAttempt = performDecryption(encryptionKey, decrypted.__encryptedData);
        if (decryptionAttempt) {
            decrypted = decryptionAttempt;
        }
    }
    return Object.assign(Object.assign({}, unencryptedFields), decrypted);
}
exports.decryptEntity = decryptEntity;
function installHooks(db, encryptionOptions, keyPromise, performEncryption, performDecryption, nonceOverride) {
    // this promise has to be resolved in order for the database to be open
    // but we also need to add the hooks before the db is open, so it's
    // guaranteed to happen before the key is actually needed.
    let encryptionKey = new Uint8Array(32);
    keyPromise.then(realKey => {
        encryptionKey = realKey;
    });
    return db.use({
        stack: 'dbcore',
        name: 'encryption',
        level: 0,
        create(downlevelDatabase) {
            return Object.assign(Object.assign({}, downlevelDatabase), { table(tn) {
                    const tableName = tn;
                    const table = downlevelDatabase.table(tableName);
                    if (tableName in encryptionOptions === false) {
                        return table;
                    }
                    const encryptionSetting = encryptionOptions[tableName];
                    function encrypt(data) {
                        return encryptEntity(table, data, encryptionSetting, encryptionKey, performEncryption, nonceOverride);
                    }
                    function decrypt(data) {
                        return decryptEntity(data, encryptionSetting, encryptionKey, performDecryption);
                    }
                    return Object.assign(Object.assign({}, table), { openCursor(req) {
                            return table.openCursor(req).then(cursor => {
                                if (!cursor) {
                                    return cursor;
                                }
                                return Object.create(cursor, {
                                    continue: {
                                        get() {
                                            return cursor.continue;
                                        },
                                    },
                                    continuePrimaryKey: {
                                        get() {
                                            return cursor.continuePrimaryKey;
                                        },
                                    },
                                    key: {
                                        get() {
                                            return cursor.key;
                                        },
                                    },
                                    value: {
                                        get() {
                                            return decrypt(cursor.value);
                                        },
                                    },
                                });
                            });
                        },
                        get(req) {
                            return table.get(req).then(decrypt);
                        },
                        getMany(req) {
                            return table.getMany(req).then(items => {
                                return items.map(decrypt);
                            });
                        }, query(req) {
                            return table.query(req).then(res => {
                                return dexie_1.default.Promise.all(res.result.map(decrypt)).then(result => (Object.assign(Object.assign({}, res), { result })));
                            });
                        },
                        mutate(req) {
                            if (req.type === 'add' || req.type === 'put') {
                                return dexie_1.default.Promise.all(req.values.map(encrypt)).then(values => table.mutate(Object.assign(Object.assign({}, req), { values })));
                            }
                            return table.mutate(req);
                        } });
                } });
        },
    });
}
exports.installHooks = installHooks;
//# sourceMappingURL=installHooks.js.map