import Dexie from 'dexie';

import { applyMiddlewareWithCustomEncryption } from './applyMiddleware';
import { encryptWithNacl, decryptWithNacl } from './encryptionMethods';

import { cryptoOptions, CryptoSettings } from './types';

export { cryptoOptions } from './types';
export const NON_INDEXED_FIELDS = cryptoOptions.NON_INDEXED_FIELDS;
export const ENCRYPT_LIST = cryptoOptions.ENCRYPT_LIST;
export const UNENCRYPTED_LIST = cryptoOptions.UNENCRYPTED_LIST;

export { clearAllTables, clearEncryptedTables } from './applyMiddleware';

export function applyEncryptionMiddleware<T extends Dexie>(
    db: T,
    encryptionKey: Uint8Array | Promise<Uint8Array>,
    tableSettings: CryptoSettings<T>,
    onKeyChange: (db: T) => Promise<any>,
    _nonceOverrideForTesting?: Uint8Array
) {
    applyMiddlewareWithCustomEncryption({
        db,
        encryptionKey,
        tableSettings,
        encrypt: encryptWithNacl,
        decrypt: decryptWithNacl,
        onKeyChange,
        _nonceOverrideForTesting,
    });
}
