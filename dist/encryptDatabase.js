"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearEncryptedTables = exports.clearAllTables = exports.encryptDatabaseWithCustomEncryption = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
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
function encryptDatabaseWithCustomEncryption({ db, encryptionKey, tableSettings, onKeyChange, encrypt, decrypt, _nonceOverrideForTesting, }) {
    let keyPromise;
    if (encryptionKey instanceof Uint8Array) {
        if (encryptionKey.length !== 32) {
            throw new Error('Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.');
        }
        keyPromise = Promise.resolve(encryptionKey);
        // @ts-ignore I want a runtime check below in case you're not using TS
    }
    else if ('then' in encryptionKey) {
        keyPromise = dexie_1.default.Promise.resolve(encryptionKey);
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
    installHooks_1.installHooks(db, tableSettings, keyPromise, encrypt, decrypt, _nonceOverrideForTesting);
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
            yield checkForKeyChange_1.checkForKeyChange(db, oldSettings, encryptionKey, encrypt, decrypt, onKeyChange);
            yield upgradeTables_1.upgradeTables(db, tableSettings, encryptionKey, oldSettings === null || oldSettings === void 0 ? void 0 : oldSettings.settings, encrypt, decrypt, _nonceOverrideForTesting);
            yield encryptionSettings.clear();
            yield encryptionSettings.put({
                settings: tableSettings,
                keyChangeDetection: encrypt(encryptionKey, [1, 2, 3, 4, 5], new Uint8Array(24)),
            });
            return undefined;
        }
        catch (e) {
            return dexie_1.default.Promise.reject(e);
        }
    }));
}
exports.encryptDatabaseWithCustomEncryption = encryptDatabaseWithCustomEncryption;
function clearAllTables(db) {
    return Promise.all(db.tables.map(function (table) {
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
//# sourceMappingURL=encryptDatabase.js.map