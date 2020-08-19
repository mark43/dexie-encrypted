import Dexie from 'dexie';
import { CryptoSettings, CryptoSettingsTable, TableOf, cryptoOptions, CryptoSettingsTableType } from './types';
import {
    encryptEntity,
    decryptEntity,
    performEncryption,
    performDecryption,
} from './encryptionMethods';
import { upgradeTables } from './upgradeTables';
import { checkForKeyChange, modernizeKeyChangeDetection } from './checkForKeyChange';
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

export { cryptoOptions  } from './types';

export function encryptDatabase<T extends Dexie>(
    db: T,
    keyOrPromise: Uint8Array | Promise<Uint8Array>,
    cryptoSettings: CryptoSettings<T>,
    onKeyChange: (db: T) => Promise<any>,
    nonceOverride?: Uint8Array
) {
    let keyPromise: Promise<Uint8Array>;
    console.log(1);
    if (keyOrPromise instanceof Uint8Array) {
        console.log('is right type', keyOrPromise);
        if (keyOrPromise.length !== 32) {
            throw new Error(
                'Dexie-encrypted requires a Uint8Array of length 32 for an encryption key.'
            );
        }
        keyPromise = Promise.resolve(keyOrPromise);
        // @ts-ignore I want a runtime check below in case you're not using TS
    } else if ('then' in keyOrPromise) {
        console.log('is promise');
        keyPromise = keyOrPromise;
    } else {
        throw new Error('Dexie-encrypted requires a UInt8Array of length 32 for an encryption key.');
    }
    console.log(2);

    // @ts-ignore
    db.Version.prototype._parseStoresSpec = override(
        // @ts-ignore
        db.Version.prototype._parseStoresSpec,
        overrideParseStoresSpec
    );
    console.log(3);

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
    console.log(4);

    db.on('ready', async function() {
        let encryptionSettings = db.table('_encryptionSettings') as CryptoSettingsTable<T>;
        let oldSettingsBeforeCheck: CryptoSettingsTableType<T> | undefined;
        try {
            oldSettingsBeforeCheck = await encryptionSettings.toCollection().last();
        } catch (e) {
            throw new Error(
                "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
            );
        }

        const encryptionKey = await keyPromise;
        if (encryptionKey instanceof Uint8Array === false || encryptionKey.length !== 32) {
            throw new Error(
                'Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.'
            );
        }

        const oldSettings = modernizeKeyChangeDetection(oldSettingsBeforeCheck);
        await checkForKeyChange(db, oldSettings, encryptionKey, onKeyChange);

        await upgradeTables(db, cryptoSettings, encryptionKey, oldSettings?.settings, nonceOverride);

        installHooks(db, cryptoSettings, encryptionKey, nonceOverride);

        await encryptionSettings.clear();
        await encryptionSettings.put({
            settings: cryptoSettings,
            keyChangeDetection: performEncryption(
                encryptionKey,
                [1, 2, 3, 4, 5],
                new Uint8Array(24)
            ),
        });
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
        })) as CryptoSettings<T>;

    const promises = Object.keys(encryptionSettings).map(async function(key) {
        await db.table(key).clear();
    });

    return Promise.all(promises);
}