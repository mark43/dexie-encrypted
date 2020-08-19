import Dexie from 'dexie';
import { TableOf, CryptoSettings, cryptoOptions } from './types';
import { encryptEntity, decryptEntity } from './encryptionMethods';

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
    cryptoSettings: CryptoSettings<T>,
    encryptionKey: Uint8Array,
    oldSettings: CryptoSettings<T> | undefined,
    nonceOverride: Uint8Array | undefined
) {
    return Promise.all(
        db.tables.map(function(tbl) {
            const table = (tbl as unknown) as TableOf<T>;
            const oldSetting = oldSettings
                ? oldSettings[(table.name as unknown) as keyof CryptoSettings<T>]
                : undefined;
            const newSetting = cryptoSettings[(table.name as unknown) as keyof CryptoSettings<T>];

            if (oldSetting === newSetting) {
                // no upgrade needed.
                return;
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

            return table.toCollection().modify(function(entity: TableOf<T>, ref) {
                const decrypted = decryptEntity(entity, oldSetting, encryptionKey);
                ref.value = encryptEntity(
                    table,
                    decrypted,
                    newSetting,
                    encryptionKey,
                    nonceOverride
                );
                return true;
            });
        })
    );
}
