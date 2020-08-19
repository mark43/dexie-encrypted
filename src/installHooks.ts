import Dexie from 'dexie';
import { CryptoSettings, TablesOf } from './types';
import { encryptEntity, decryptEntity } from './encryptionMethods';

export function installHooks<T extends Dexie>(
    db: T,
    encryptionOptions: CryptoSettings<T>,
    encryptionKey: Uint8Array,
    nonceOverride: Uint8Array | undefined
) {
    return db.use({
        stack: 'dbcore',
        name: 'dexie-encrypted',
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
                        console.log('hooooo');
                        console.log(data);
                        return encryptEntity(
                            table,
                            data,
                            encryptionSetting,
                            encryptionKey,
                            nonceOverride
                        );
                    }

                    function decrypt(data: any) {
                        console.log('heeee');
                        return decryptEntity(data, encryptionSetting, encryptionKey);
                    }

                    return {
                        ...table,
                        openCursor(req) {
                            return table.openCursor(req).then(cursor =>
                                Object.create(cursor, {
                                    value: {
                                        get() {
                                            return decrypt(this.value);
                                        },
                                    },
                                })
                            );
                        },
                        get(req) {
                            return table.get(req).then(item => {
                                return decrypt(item);
                            });
                        },
                        getMany(req) {
                            return table.getMany(req).then(items => {
                                return items.map(item => decrypt(item));
                            });
                        },
                        query(req) {
                            return table.query(req).then(res => {
                                return {
                                    ...res,
                                    result: res.result.map(item => decrypt(item)),
                                };
                            });
                        },
                        mutate(req) {
                            if (req.type === 'add' || req.type === 'put') {
                                const mutated = {
                                    ...req,
                                    values: [...req.values.map(item => encrypt(item))],
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
