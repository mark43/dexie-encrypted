"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installHooks = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
const encryptionMethods_1 = require("./encryptionMethods");
function installHooks(db, encryptionOptions, keyPromise, nonceOverride) {
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
                        return encryptionMethods_1.encryptEntity(table, data, encryptionSetting, encryptionKey, nonceOverride);
                    }
                    function decrypt(data) {
                        return encryptionMethods_1.decryptEntity(data, encryptionSetting, encryptionKey);
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