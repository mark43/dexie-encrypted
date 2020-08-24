import Dexie from 'dexie';

import { encryptDatabaseWithCustomEncryption } from './encryptDatabase';
import { encryptWithNacl, decryptWithNacl } from './encryptionMethods';

import { cryptoOptions, CryptoSettingsTableType, CryptoSettings } from './types';

export { cryptoOptions } from './types';
export const NON_INDEXED_FIELDS = cryptoOptions.NON_INDEXED_FIELDS;
export const ENCRYPT_LIST = cryptoOptions.ENCRYPT_LIST;
export const UNENCRYPTED_LIST = cryptoOptions.UNENCRYPTED_LIST;

export function clearAllTables(db: Dexie) {
    return Promise.all(
        db.tables.map(function(table) {
            return table.clear();
        })
    );
}

export async function clearEncryptedTables<T extends Dexie>(db: T) {
    let encryptionSettings = (await db
        .table('_encryptionSettings')
        .toCollection()
        .last()
        .catch(() => {
            throw new Error(
                "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
            );
        })) as CryptoSettingsTableType<T>;

    const promises = Object.keys(encryptionSettings.settings).map(async function(key) {
        await db.table(key).clear();
    });

    return Promise.all(promises);
}

export interface EncryptDatabaseConvenientParams<T extends Dexie> {
    db: T;
    encryptionKey: Uint8Array | Promise<Uint8Array>;
    tableSettings: CryptoSettings<T>;
    onKeyChange: (db: T) => Promise<any>;
    nonceOverrideForTesting?: Uint8Array;
}

export function encryptDatabase<T extends Dexie>(
    db: T,
    encryptionKey: Uint8Array | Promise<Uint8Array>,
    tableSettings: CryptoSettings<T>,
    onKeyChange: (db: T) => Promise<any>,
    nonceOverrideForTesting?: Uint8Array
) {
    encryptDatabaseWithCustomEncryption({
        db,
        encryptionKey,
        tableSettings,
        encrypt: encryptWithNacl,
        decrypt: decryptWithNacl,
        onKeyChange,
        nonceOverrideForTesting,
    });
}
