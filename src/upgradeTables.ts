import Dexie from 'dexie';
import {
    TableOf,
    CryptoSettings,
    cryptoOptions,
    EncryptionMethod,
    DecryptionMethod,
} from './types';
import { encryptEntity, decryptEntity } from './installHooks';

function compareArrays(a: any[], b: any[]) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

export async function upgradeTables<T extends Dexie>(
    db: T,
    tableSettings: CryptoSettings<T>,
    encryptionKey: Uint8Array,
    oldSettings: CryptoSettings<T> | undefined,
    encrypt: EncryptionMethod,
    decrypt: DecryptionMethod,
    nonceOverride: Uint8Array | undefined
) {
    const unencryptedDb = new Dexie(db.name);
    // @ts-ignore
    const version = db._versions.find(v => v._cfg.version === db.verno);
    unencryptedDb.version(db.verno).stores(version._cfg.storesSource);
    await unencryptedDb.open();

    return Dexie.Promise.all(
        unencryptedDb.tables.map(async function(tbl) {
            const table = (tbl as unknown) as TableOf<T>;
            const oldSetting = oldSettings
                ? oldSettings[(table.name as unknown) as keyof CryptoSettings<T>]
                : undefined;
            const newSetting = tableSettings[(table.name as unknown) as keyof CryptoSettings<T>];

            if (oldSetting === newSetting) {
                // no upgrade needed.
                return Dexie.Promise.resolve();
            }
            if (
                oldSetting === undefined ||
                newSetting === undefined ||
                oldSetting === cryptoOptions.NON_INDEXED_FIELDS ||
                newSetting === cryptoOptions.NON_INDEXED_FIELDS
            ) {
                // no more to compare, the db needs to be encrypted/decrypted
            } else {
                // both non-strings. Figure out if they're the same.
                // @ts-ignore will figure out later
                if (newSetting.type === oldSetting.type) {
                    if (
                        // @ts-ignore will figure out later
                        compareArrays(newSetting.fields, oldSetting.fields)
                    ) {
                        // no upgrade needed.
                        return;
                    }
                }
            }

            await table.toCollection().modify(function(entity: TableOf<T>, ref) {
                const decrypted = decryptEntity(entity, oldSetting, encryptionKey, decrypt);
                ref.value = encryptEntity(
                    table,
                    decrypted,
                    newSetting,
                    encryptionKey,
                    encrypt,
                    nonceOverride
                );
            });
            return;
        })
    );
}
