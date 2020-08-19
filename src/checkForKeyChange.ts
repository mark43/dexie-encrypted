import Dexie from 'dexie';
import { CryptoSettings, CryptoSettingsTable, TableType, CryptoSettingsTableType } from './types';
import { performDecryption } from './encryptionMethods';

export function modernizeKeyChangeDetection<T extends Dexie>(
    possiblyOldSettings: CryptoSettingsTableType<T> | undefined
) {
    // @ts-ignore old format
    if (possiblyOldSettings && possiblyOldSettings.__key_change_detection) {
        const {
            __key_change_detection,
            ...rest
        } = (possiblyOldSettings as unknown) as CryptoSettings<T> & {
            __key_change_detection: Buffer;
        };
        return {
            settings: (rest as unknown) as CryptoSettings<T>,
            keyChangeDetection: __key_change_detection,
        };
    }
    return possiblyOldSettings;
}

export async function checkForKeyChange<T extends Dexie>(
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
        await onKeyChange(db);
    }
}
