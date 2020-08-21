"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptEntity = exports.performDecryption = exports.encryptEntity = exports.performEncryption = void 0;
const tslib_1 = require("tslib");
const tweetnacl_1 = tslib_1.__importDefault(require("tweetnacl"));
const bson_1 = require("bson");
const types_1 = require("./types");
function performEncryption(key, object, nonce) {
    nonce = nonce || tweetnacl_1.default.randomBytes(tweetnacl_1.default.secretbox.nonceLength);
    const buffer = bson_1.serialize(object);
    const encrypted = tweetnacl_1.default.secretbox(Uint8Array.from(buffer), nonce, key);
    const data = new Uint8Array(nonce.length + encrypted.length);
    data.set(nonce);
    data.set(encrypted, nonce.length);
    return data;
}
exports.performEncryption = performEncryption;
function encryptEntity(table, entity, rule, encryptionKey, nonceOverride) {
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
    dataToStore.__encryptedBson = performEncryption(encryptionKey, entity, nonceOverride);
    return dataToStore;
}
exports.encryptEntity = encryptEntity;
function performDecryption(encryptionKey, data) {
    const encryptedArray = Uint8Array.from(data);
    const nonce = encryptedArray.slice(0, tweetnacl_1.default.secretbox.nonceLength);
    const message = encryptedArray.slice(tweetnacl_1.default.secretbox.nonceLength, encryptedArray.length);
    const rawDecrypted = tweetnacl_1.default.secretbox.open(message, nonce, encryptionKey);
    if (rawDecrypted === null) {
        throw new Error('Dexie-encrypted was unable to decrypt an entity.');
    }
    return Buffer.from(rawDecrypted);
}
exports.performDecryption = performDecryption;
function decryptEntity(entity, rule, encryptionKey) {
    if (rule === undefined || entity === undefined || !entity.__encryptedBson) {
        return entity;
    }
    const { __encryptedBson } = entity, unencryptedFields = tslib_1.__rest(entity, ["__encryptedBson"]);
    const decrypted = bson_1.deserialize(performDecryption(encryptionKey, __encryptedBson));
    return Object.assign(Object.assign({}, unencryptedFields), decrypted);
}
exports.decryptEntity = decryptEntity;
//# sourceMappingURL=encryptionMethods.js.map