"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForKeyChange = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
function checkForKeyChange(db, oldSettings, encryptionKey, encrypt, decrypt, onKeyChange) {
    try {
        const changeDetectionObj = oldSettings ? oldSettings.keyChangeDetection : null;
        if (changeDetectionObj) {
            decrypt(encryptionKey, changeDetectionObj);
        }
    }
    catch (e) {
        return dexie_1.default.Promise.resolve(onKeyChange(db));
    }
    return dexie_1.default.Promise.resolve();
}
exports.checkForKeyChange = checkForKeyChange;
//# sourceMappingURL=checkForKeyChange.js.map