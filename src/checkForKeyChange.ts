import Dexie from 'dexie';
import { CryptoSettings, CryptoSettingsTable, TableType, CryptoSettingsTableType } from './types';
import { performDecryption } from './encryptionMethods';

export function checkForKeyChange<T extends Dexie>(
    db: T,
    oldSettings: TableType<CryptoSettingsTable<T>> | undefined,
    encryptionKey: Uint8Array,
    onKeyChange: (db: T) => any
) {
    try {
        const changeDetectionObj = oldSettings ? oldSettings.keyChangeDetection : null;
        if (changeDetectionObj) {
            performDecryption(encryptionKey, new Buffer(changeDetectionObj));
        }
    } catch (e) {
        return Dexie.Promise.resolve(onKeyChange(db));
    }
    return Dexie.Promise.resolve();
}
