"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeTables = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
const types_1 = require("./types");
const installHooks_1 = require("./installHooks");
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
function upgradeTables(db, tableSettings, encryptionKey, oldSettings, encrypt, decrypt, nonceOverride) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const unencryptedDb = new dexie_1.default(db.name);
        // @ts-ignore
        const version = db._versions.find(v => v._cfg.version === db.verno);
        unencryptedDb.version(db.verno).stores(version._cfg.storesSource);
        yield unencryptedDb.open();
        return dexie_1.default.Promise.all(unencryptedDb.tables.map(function (tbl) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                const table = tbl;
                const oldSetting = oldSettings
                    ? oldSettings[table.name]
                    : undefined;
                const newSetting = tableSettings[table.name];
                if (oldSetting === newSetting) {
                    // no upgrade needed.
                    return dexie_1.default.Promise.resolve();
                }
                if (oldSetting === undefined ||
                    newSetting === undefined ||
                    oldSetting === types_1.cryptoOptions.NON_INDEXED_FIELDS ||
                    newSetting === types_1.cryptoOptions.NON_INDEXED_FIELDS) {
                    // no more to compare, the db needs to be encrypted/decrypted
                }
                else {
                    // both non-strings. Figure out if they're the same.
                    // @ts-ignore will figure out later
                    if (newSetting.type === oldSetting.type) {
                        if (
                        // @ts-ignore will figure out later
                        compareArrays(newSetting.fields, oldSetting.fields)) {
                            // no upgrade needed.
                            return;
                        }
                    }
                }
                yield table.toCollection().modify(function (entity, ref) {
                    const decrypted = installHooks_1.decryptEntity(entity, oldSetting, encryptionKey, decrypt);
                    ref.value = installHooks_1.encryptEntity(table, decrypted, newSetting, encryptionKey, encrypt, nonceOverride);
                });
                return;
            });
        }));
    });
}
exports.upgradeTables = upgradeTables;
//# sourceMappingURL=upgradeTables.js.map