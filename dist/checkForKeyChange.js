"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForKeyChange = void 0;
const tslib_1 = require("tslib");
const dexie_1 = tslib_1.__importDefault(require("dexie"));
const encryptionMethods_1 = require("./encryptionMethods");
function checkForKeyChange(db, oldSettings, encryptionKey, onKeyChange) {
    try {
        const changeDetectionObj = oldSettings ? oldSettings.keyChangeDetection : null;
        if (changeDetectionObj) {
            encryptionMethods_1.performDecryption(encryptionKey, new Buffer(changeDetectionObj));
        }
    }
    catch (e) {
        return dexie_1.default.Promise.resolve(onKeyChange(db));
    }
    return dexie_1.default.Promise.resolve();
}
exports.checkForKeyChange = checkForKeyChange;
//# sourceMappingURL=checkForKeyChange.js.map