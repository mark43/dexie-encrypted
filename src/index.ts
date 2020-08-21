import Dexie from 'dexie';
import {
    CryptoSettings,
    CryptoSettingsTable,
    cryptoOptions,
    CryptoSettingsTableType,
} from './types';
import {

    performEncryption,
} from './encryptionMethods';
import { upgradeTables } from './upgradeTables';
import { checkForKeyChange } from './checkForKeyChange';
import { installHooks } from './installHooks';

// Import some usable helper functions
const override = Dexie.override;

function overrideParseStoresSpec(origFunc: any) {
    return function(stores: any, dbSchema: any) {
        stores._encryptionSettings = '++id';
        // @ts-ignore
        return origFunc.call(this, stores, dbSchema);
    };
}

export { cryptoOptions } from './types';

export const NON_INDEXED_FIELDS = cryptoOptions.NON_INDEXED_FIELDS
export const ENCRYPT_LIST = cryptoOptions.ENCRYPT_LIST
export const UNENCRYPTED_LIST = cryptoOptions.UNENCRYPTED_LIST

export function encryptDatabase<T extends Dexie>(
    db: T,
    keyOrPromise: Uint8Array | Promise<Uint8Array>,
    cryptoSettings: CryptoSettings<T>,
    onKeyChange: (db: T) => Promise<any>,
    nonceOverride?: Uint8Array
) {
    let keyPromise: Promise<Uint8Array>;
    if (keyOrPromise instanceof Uint8Array) {
        if (keyOrPromise.length !== 32) {
            throw new Error(
                'Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.'
            );
        }
        keyPromise = Promise.resolve(keyOrPromise);
        // @ts-ignore I want a runtime check below in case you're not using TS
    } else if ('then' in keyOrPromise) {
        keyPromise = Dexie.Promise.resolve(keyOrPromise);
    } else {
        throw new Error(
            'Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.'
        );
    }

    // @ts-ignore
    db.Version.prototype._parseStoresSpec = override(
        // @ts-ignore
        db.Version.prototype._parseStoresSpec,
        overrideParseStoresSpec
    );

    if (db.verno > 0) {
        // Make sure new tables are added if calling encrypt after defining versions.
        try {
            db.version(db.verno).stores({});
        } catch (error) {
            throw new Error(
                'Dexie-encrypt: The call to encrypt() cannot be done on an open database'
            );
        }
    }
    installHooks(db, cryptoSettings, keyPromise, nonceOverride);

    db.on('ready', async () => {
        try {
            let encryptionSettings = db.table('_encryptionSettings') as CryptoSettingsTable<T>;
            let oldSettings: CryptoSettingsTableType<T> | undefined;
            try {
                oldSettings = await encryptionSettings.toCollection().last();
            } catch (e) {
                throw new Error(
                    "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
                );
            }

            const encryptionKey = await keyPromise;
            if (encryptionKey instanceof Uint8Array === false || encryptionKey.length !== 32) {
                throw new Error(
                    'Dexie-encrypted requires a Uint8Array of length 32 for a encryption key.'
                );
            }

            await checkForKeyChange(db, oldSettings, encryptionKey, onKeyChange);

            await upgradeTables(db, cryptoSettings, encryptionKey, oldSettings?.settings, nonceOverride);
            await encryptionSettings.clear();
            await encryptionSettings.put({
                settings: cryptoSettings,
                keyChangeDetection: performEncryption(
                    encryptionKey,
                    [1, 2, 3, 4, 5],
                    new Uint8Array(24)
                ),
            });
            return undefined;
        } catch (e) {
            return Dexie.Promise.reject(e);
        }
    });
}

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
