import Dexie from 'dexie';
import {
    CryptoSettingsTable,
	CryptoSettingsTableType,
	EncryptDatabaseParams,
} from './types';

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


export function applyMiddlewareWithCustomEncryption<T extends Dexie>({
    db,
    encryptionKey,
    tableSettings,
    onKeyChange,
    encrypt,
    decrypt,
    _nonceOverrideForTesting,
}: EncryptDatabaseParams<T>) {
    let keyPromise: Promise<Uint8Array>;
    if (encryptionKey instanceof Uint8Array) {
        if (encryptionKey.length !== 32) {
            throw new Error(
                'Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.'
            );
        }
        keyPromise = Promise.resolve(encryptionKey);
        // @ts-ignore I want a runtime check below in case you're not using TS
    } else if ('then' in encryptionKey) {
        keyPromise = Dexie.Promise.resolve(encryptionKey);
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
    installHooks(db, tableSettings, keyPromise, encrypt, decrypt, _nonceOverrideForTesting);

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

            await checkForKeyChange(db, oldSettings, encryptionKey, encrypt, decrypt, onKeyChange);

            await upgradeTables(db, tableSettings, encryptionKey, oldSettings?.settings, encrypt, decrypt, _nonceOverrideForTesting);
            await encryptionSettings.clear();
            await encryptionSettings.put({
                settings: tableSettings,
                keyChangeDetection: encrypt(
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