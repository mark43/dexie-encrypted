import nacl from 'tweetnacl';
import { encode, decode } from '@stablelib/utf8';

// @ts-ignore
import Typeson from 'typeson';
// @ts-ignore
import builtinTypes from 'typeson-registry/dist/presets/builtin';

const tson = new Typeson().register([builtinTypes]);

export function encryptWithNacl(key: Uint8Array, object: any, nonce?: Uint8Array) {
    if (nonce === undefined) {
        nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    }
    const stringified = tson.stringify(object);
    const encrypted = nacl.secretbox(encode(stringified), nonce, key);
    const data = new Uint8Array(nonce.length + encrypted.length);
    data.set(nonce);
    data.set(encrypted, nonce.length);
    return data;
}

export function decryptWithNacl(encryptionKey: Uint8Array, encryptedArray: Uint8Array) {
    const nonce = encryptedArray.slice(0, nacl.secretbox.nonceLength);
    const message = encryptedArray.slice(nacl.secretbox.nonceLength, encryptedArray.length);
    const rawDecrypted = nacl.secretbox.open(message, nonce, encryptionKey);
    if (rawDecrypted === null) {
        throw new Error('Dexie-encrypted was unable to decrypt an entity.');
    }
    return tson.parse(decode(rawDecrypted));
}
