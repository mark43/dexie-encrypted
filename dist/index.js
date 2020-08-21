"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearEncryptedTables = exports.clearAllTables = exports.encryptDatabase = exports.UNENCRYPTED_LIST = exports.ENCRYPT_LIST = exports.NON_INDEXED_FIELDS = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
const types_1 = require("./types");
const encryptionMethods_1 = require("./encryptionMethods");
const upgradeTables_1 = require("./upgradeTables");
const checkForKeyChange_1 = require("./checkForKeyChange");
const installHooks_1 = require("./installHooks");
// Import some usable helper functions
const override = dexie_1.default.override;
function overrideParseStoresSpec(origFunc) {
    return function (stores, dbSchema) {
        stores._encryptionSettings = '++id';
        // @ts-ignore
        return origFunc.call(this, stores, dbSchema);
    };
}
var types_2 = require("./types");
Object.defineProperty(exports, "cryptoOptions", { enumerable: true, get: function () { return types_2.cryptoOptions; } });
exports.NON_INDEXED_FIELDS = types_1.cryptoOptions.NON_INDEXED_FIELDS;
exports.ENCRYPT_LIST = types_1.cryptoOptions.ENCRYPT_LIST;
exports.UNENCRYPTED_LIST = types_1.cryptoOptions.UNENCRYPTED_LIST;
function encryptDatabase(db, keyOrPromise, cryptoSettings, onKeyChange, nonceOverride) {
    let keyPromise;
    if (keyOrPromise instanceof Uint8Array) {
        if (keyOrPromise.length !== 32) {
            throw new Error('Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.');
        }
        keyPromise = Promise.resolve(keyOrPromise);
        // @ts-ignore I want a runtime check below in case you're not using TS
    }
    else if ('then' in keyOrPromise) {
        keyPromise = dexie_1.default.Promise.resolve(keyOrPromise);
    }
    else {
        throw new Error('Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.');
    }
    // @ts-ignore
    db.Version.prototype._parseStoresSpec = override(
    // @ts-ignore
    db.Version.prototype._parseStoresSpec, overrideParseStoresSpec);
    if (db.verno > 0) {
        // Make sure new tables are added if calling encrypt after defining versions.
        try {
            db.version(db.verno).stores({});
        }
        catch (error) {
            throw new Error('Dexie-encrypt: The call to encrypt() cannot be done on an open database');
        }
    }
    installHooks_1.installHooks(db, cryptoSettings, keyPromise, nonceOverride);
    db.on('ready', () => tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            let encryptionSettings = db.table('_encryptionSettings');
            let oldSettings;
            try {
                oldSettings = yield encryptionSettings.toCollection().last();
            }
            catch (e) {
                throw new Error("Dexie-encrypted can't find its encryption table. You may need to bump your database version.");
            }
            const encryptionKey = yield keyPromise;
            if (encryptionKey instanceof Uint8Array === false || encryptionKey.length !== 32) {
                throw new Error('Dexie-encrypted requires a Uint8Array of length 32 for a encryption key.');
            }
            yield checkForKeyChange_1.checkForKeyChange(db, oldSettings, encryptionKey, onKeyChange);
            yield upgradeTables_1.upgradeTables(db, cryptoSettings, encryptionKey, oldSettings === null || oldSettings === void 0 ? void 0 : oldSettings.settings, nonceOverride);
            yield encryptionSettings.clear();
            yield encryptionSettings.put({
                settings: cryptoSettings,
                keyChangeDetection: encryptionMethods_1.performEncryption(encryptionKey, [1, 2, 3, 4, 5], new Uint8Array(24)),
            });
            return undefined;
        }
        catch (e) {
            return dexie_1.default.Promise.reject(e);
        }
    }));
}
exports.encryptDatabase = encryptDatabase;
function clearAllTables(db) {
    return Promise.all(db.tables.map(function (table) {
        console.log(table.name);
        return table.clear();
    }));
}
exports.clearAllTables = clearAllTables;
function clearEncryptedTables(db) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let encryptionSettings = (yield db
            .table('_encryptionSettings')
            .toCollection()
            .last()
            .catch(() => {
            throw new Error("Dexie-encrypted can't find its encryption table. You may need to bump your database version.");
        }));
        const promises = Object.keys(encryptionSettings.settings).map(function (key) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield db.table(key).clear();
            });
        });
        return Promise.all(promises);
    });
}
exports.clearEncryptedTables = clearEncryptedTables;
//# sourceMappingURL=index.js.map