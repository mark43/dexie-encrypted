import Dexie from 'dexie';
import { CryptoSettings, TablesOf } from './types';
import { encryptEntity, decryptEntity } from './encryptionMethods';

export function installHooks<T extends Dexie>(
    db: T,
    encryptionOptions: CryptoSettings<T>,
    keyPromise: Promise<Uint8Array>,
    nonceOverride: Uint8Array | undefined
) {
    return db.use({
        stack: 'dbcore',
        name: 'encryption',
        level: 0,
        create(downlevelDatabase) {
            return {
                ...downlevelDatabase,
                table(tn) {
                    const tableName = tn as keyof TablesOf<T>;
                    const table = downlevelDatabase.table(tableName as string);
                    if (tableName in encryptionOptions === false) {
                        return table;
                    }

                    const encryptionSetting = encryptionOptions[tableName];

                    function encrypt(data: any) {
                        return keyPromise.then(encyrptionKey => {
                            return encryptEntity(
                                table,
                                data,
                                encryptionSetting,
                                encyrptionKey,
                                nonceOverride
                            );
                        });
                    }

                    function decrypt(data: any) {
                        return keyPromise.then(encyrptionKey => {
                            return decryptEntity(data, encryptionSetting, encyrptionKey);
                        });
                    }

                    return {
                        ...table,
                        openCursor(req) {
                            return table.openCursor(req).then(cursor => {
                                if (cursor === null) {
                                    return null;
                                }
                                return Object.create(cursor, {
                                    value: {
                                        get() {
                                            return decrypt(this.value);
                                        },
                                    },
                                });
                            });
                        },
                        get(req) {
                            return table.get(req).then(item => {
                                return decrypt(item);
                            });
                        },
                        // getMany(req) {
                        //     return table.getMany(req).then(items => {
                        //         console.log(items);
                        //         return items.map(item => item.then(decrypt));
                        //     });
                        // },
                        query(req) {
                            return table.query(req).then(async res => {
                                const result = await Promise.all(
                                    res.result.map(item => decrypt(item))
                                );
                                return {
                                    ...res,
                                    result,
                                };
                            });
                        },
                        async mutate(req) {
                            if (req.type === 'add' || req.type === 'put') {
                                const values = await Promise.all(
                                    req.values.map(item => encrypt(item))
                                );
                                const mutated = {
                                    ...req,
                                    values,
                                };
                                return table.mutate(mutated);
                            }
                            return table.mutate(req);
                        },
                    };
                },
            };
        },
    });
}
