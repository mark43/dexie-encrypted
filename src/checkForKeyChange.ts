import Dexie from 'dexie';
import {
    CryptoSettings,
    CryptoSettingsTable,
    TableType,
    CryptoSettingsTableType,
    EncryptionMethod,
    DecryptionMethod,
} from './types';

export function checkForKeyChange<T extends Dexie>(
    db: T,
    oldSettings: TableType<CryptoSettingsTable<T>> | undefined,
    encryptionKey: Uint8Array,
    encrypt: EncryptionMethod,
    decrypt: DecryptionMethod,
    onKeyChange: (db: T) => any
) {
    try {
        const changeDetectionObj = oldSettings ? oldSettings.keyChangeDetection : null;
        if (changeDetectionObj) {
            decrypt(encryptionKey, changeDetectionObj);
        }
    } catch (e) {
        return Dexie.Promise.resolve(onKeyChange(db));
    }
    return Dexie.Promise.resolve();
}
