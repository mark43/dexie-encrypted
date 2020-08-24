"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptWithNacl = exports.encryptWithNacl = void 0;
const tslib_1 = require("tslib");
const tweetnacl_1 = tslib_1.__importDefault(require("tweetnacl"));
const utf8_1 = require("@stablelib/utf8");
// @ts-ignore
const typeson_1 = tslib_1.__importDefault(require("typeson"));
// @ts-ignore
const builtin_1 = tslib_1.__importDefault(require("typeson-registry/dist/presets/builtin"));
const tson = new typeson_1.default().register([builtin_1.default]);
function encryptWithNacl(key, object, nonce) {
    if (nonce === undefined) {
        nonce = tweetnacl_1.default.randomBytes(tweetnacl_1.default.secretbox.nonceLength);
    }
    const stringified = tson.stringify(object);
    const encrypted = tweetnacl_1.default.secretbox(utf8_1.encode(stringified), nonce, key);
    const data = new Uint8Array(nonce.length + encrypted.length);
    data.set(nonce);
    data.set(encrypted, nonce.length);
    return data;
}
exports.encryptWithNacl = encryptWithNacl;
function decryptWithNacl(encryptionKey, encryptedArray) {
    const nonce = encryptedArray.slice(0, tweetnacl_1.default.secretbox.nonceLength);
    const message = encryptedArray.slice(tweetnacl_1.default.secretbox.nonceLength, encryptedArray.length);
    const rawDecrypted = tweetnacl_1.default.secretbox.open(message, nonce, encryptionKey);
    if (rawDecrypted === null) {
        throw new Error('Dexie-encrypted was unable to decrypt an entity.');
    }
    return tson.parse(utf8_1.decode(rawDecrypted));
}
exports.decryptWithNacl = decryptWithNacl;
//# sourceMappingURL=encryptionMethods.js.map