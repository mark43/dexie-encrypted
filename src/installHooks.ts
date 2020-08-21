import Dexie from 'dexie';
import { CryptoSettings, TablesOf } from './types';
import { encryptEntity, decryptEntity } from './encryptionMethods';

export function installHooks<T extends Dexie>(
    db: T,
    encryptionOptions: CryptoSettings<T>,
    keyPromise: Promise<Uint8Array>,
    nonceOverride: Uint8Array | undefined
) {
    // this promise has to be resolved in order for the database to be open
    // but we also need to add the hooks before the db is open, so it's
    // guaranteed to happen before the key is actually needed.
    let encryptionKey = new Uint8Array(32);
    keyPromise.then(realKey => {
        encryptionKey = realKey;
    });

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
                        return encryptEntity(
                            table,
                            data,
                            encryptionSetting,
                            encryptionKey,
                            nonceOverride
                        );
                    }

                    function decrypt(data: any) {
                        return decryptEntity(data, encryptionSetting, encryptionKey);
                    }

                    return {
                        ...table,
                        openCursor(req) {
                            return table.openCursor(req).then(cursor => {
                                if (!cursor) {
                                    return cursor;
                                }
                                return Object.create(cursor, {
                                    continue: {
                                        get() {
                                            return cursor.continue;
                                        },
                                    },
                                    continuePrimaryKey: {
                                        get() {
                                            return cursor.continuePrimaryKey;
                                        },
                                    },
                                    key: {
                                        get() {
                                            return cursor.key;
                                        },
                                    },
                                    value: {
                                        get() {
                                            return decrypt(cursor.value);
                                        },
                                    },
                                });
                            });
                        },
                        get(req) {
                            return table.get(req).then(decrypt);
                        },
                        getMany(req) {
                            return table.getMany(req).then(items => {
                                return items.map(decrypt);
                            });
                        },
                        query(req) {
                            return table.query(req).then(res => {
                                return Dexie.Promise.all(res.result.map(decrypt)).then(result => ({
                                    ...res,
                                    result,
                                }));
                            });
                        },
                        mutate(req) {
                            if (req.type === 'add' || req.type === 'put') {
                                return Dexie.Promise.all(req.values.map(encrypt)).then(values =>
                                    table.mutate({
                                        ...req,
                                        values,
                                    })
                                );
                            }
                            return table.mutate(req);
                        },
                    };
                },
            };
        },
    });
}
