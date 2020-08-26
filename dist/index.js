"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyEncryptionMiddleware = exports.UNENCRYPTED_LIST = exports.ENCRYPT_LIST = exports.NON_INDEXED_FIELDS = void 0;
const applyMiddleware_1 = require("./applyMiddleware");
const encryptionMethods_1 = require("./encryptionMethods");
const types_1 = require("./types");
var types_2 = require("./types");
Object.defineProperty(exports, "cryptoOptions", { enumerable: true, get: function () { return types_2.cryptoOptions; } });
exports.NON_INDEXED_FIELDS = types_1.cryptoOptions.NON_INDEXED_FIELDS;
exports.ENCRYPT_LIST = types_1.cryptoOptions.ENCRYPT_LIST;
exports.UNENCRYPTED_LIST = types_1.cryptoOptions.UNENCRYPTED_LIST;
var applyMiddleware_2 = require("./applyMiddleware");
Object.defineProperty(exports, "clearAllTables", { enumerable: true, get: function () { return applyMiddleware_2.clearAllTables; } });
Object.defineProperty(exports, "clearEncryptedTables", { enumerable: true, get: function () { return applyMiddleware_2.clearEncryptedTables; } });
function applyEncryptionMiddleware(db, encryptionKey, tableSettings, onKeyChange, _nonceOverrideForTesting) {
    applyMiddleware_1.applyMiddlewareWithCustomEncryption({
        db,
        encryptionKey,
        tableSettings,
        encrypt: encryptionMethods_1.encryptWithNacl,
        decrypt: encryptionMethods_1.decryptWithNacl,
        onKeyChange,
        _nonceOverrideForTesting,
    });
}
exports.applyEncryptionMiddleware = applyEncryptionMiddleware;
//# sourceMappingURL=index.js.map