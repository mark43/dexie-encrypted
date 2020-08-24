"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptDatabase = exports.clearEncryptedTables = exports.clearAllTables = exports.UNENCRYPTED_LIST = exports.ENCRYPT_LIST = exports.NON_INDEXED_FIELDS = void 0;
const tslib_1 = require("tslib");
const encryptDatabase_1 = require("./encryptDatabase");
const encryptionMethods_1 = require("./encryptionMethods");
const types_1 = require("./types");
var types_2 = require("./types");
Object.defineProperty(exports, "cryptoOptions", { enumerable: true, get: function () { return types_2.cryptoOptions; } });
exports.NON_INDEXED_FIELDS = types_1.cryptoOptions.NON_INDEXED_FIELDS;
exports.ENCRYPT_LIST = types_1.cryptoOptions.ENCRYPT_LIST;
exports.UNENCRYPTED_LIST = types_1.cryptoOptions.UNENCRYPTED_LIST;
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
function encryptDatabase(db, encryptionKey, tableSettings, onKeyChange, nonceOverrideForTesting) {
    encryptDatabase_1.encryptDatabaseWithCustomEncryption({
        db,
        encryptionKey,
        tableSettings,
        encrypt: encryptionMethods_1.encryptWithNacl,
        decrypt: encryptionMethods_1.decryptWithNacl,
        onKeyChange,
        nonceOverrideForTesting,
    });
}
exports.encryptDatabase = encryptDatabase;
//# sourceMappingURL=index.js.map