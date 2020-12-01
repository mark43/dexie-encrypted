import Dexie, { DBCoreTable, DBCoreIndex, IndexSpec } from 'dexie';
import {
    CryptoSettings,
    TablesOf,
    TableType,
    EncryptionOption,
    cryptoOptions,
    EncryptionMethod,
    DecryptionMethod,
} from './types';

export function encryptEntity<T extends Dexie.Table>(
    table: DBCoreTable | T,
    entity: TableType<T>,
    rule: EncryptionOption<T> | undefined,
    encryptionKey: Uint8Array,
    performEncryption: EncryptionMethod,
    nonceOverride?: Uint8Array
) {
    if (rule === undefined) {
        return entity;
    }

    const indexObjects = table.schema.indexes as (IndexSpec | DBCoreIndex)[];
    const indices = indexObjects.map(index => index.keyPath);
    const toEncrypt: Partial<TableType<T>> = {};
    const dataToStore: Partial<TableType<T>> = {};

    const primaryKey =
        'primKey' in table.schema ? table.schema.primKey.keyPath : table.schema.primaryKey.keyPath;

    if (rule === cryptoOptions.NON_INDEXED_FIELDS) {
        for (const key in entity) {
            if (key === primaryKey || indices.includes(key)) {
                dataToStore[key] = entity[key];
            } else {
                toEncrypt[key] = entity[key];
            }
        }
    } else if (rule.type === cryptoOptions.ENCRYPT_LIST) {
        for (const key in entity) {
            if (key !== primaryKey && rule.fields.includes(key)) {
                toEncrypt[key] = entity[key];
            } else {
                dataToStore[key] = entity[key];
            }
        }
    } else {
        const whitelist = rule.type === cryptoOptions.UNENCRYPTED_LIST ? rule.fields : [];
        for (const key in entity) {
            if (
                key !== primaryKey &&
                // @ts-ignore
                entity.hasOwnProperty(key) &&
                indices.includes(key) === false &&
                whitelist.includes(key) === false
            ) {
                toEncrypt[key] = entity[key];
            } else {
                dataToStore[key] = entity[key];
            }
        }
    }

    // @ts-ignore
    dataToStore.__encryptedData = performEncryption(encryptionKey, entity, nonceOverride);
    return dataToStore;
}

export function decryptEntity<T extends Dexie.Table>(
    entity: TableType<T> | undefined,
    rule: EncryptionOption<T> | undefined,
    encryptionKey: Uint8Array,
    performDecryption: DecryptionMethod
) {
    if (rule === undefined || entity === undefined || !entity.__encryptedData) {
        return entity;
    }

    const { __encryptedData, ...unencryptedFields } = entity;

    let decrypted = performDecryption(encryptionKey, __encryptedData);

    // There is a bug that causes double encryption. I am not sure what causes it,
    // it is very rare and I have no repro steps. I believe the hook is running twice
    // in very rare circumstances, but I have no evidence of it.
    // This decrypts until all decryption is done. The only circumstance where it will
    // create an undesireable result is if your data has an __encryptedData key, and
    // that data can be decrypted by the performDecryption function.
    while (decrypted.__encryptedData) {
        const decryptionAttempt = performDecryption(encryptionKey, decrypted.__encryptedData);
        if (decryptionAttempt) {
            decrypted = decryptionAttempt;
        }
    }

    return {
        ...unencryptedFields,
        ...decrypted,
    } as TableType<T>;
}

export function installHooks<T extends Dexie>(
    db: T,
    encryptionOptions: CryptoSettings<T>,
    keyPromise: Promise<Uint8Array>,
    performEncryption: EncryptionMethod,
    performDecryption: DecryptionMethod,
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
                            performEncryption,
                            nonceOverride
                        );
                    }

                    function decrypt(data: any) {
                        return decryptEntity(
                            data,
                            encryptionSetting,
                            encryptionKey,
                            performDecryption
                        );
                    }

                    return {
                        ...table,
                        openCursor(req) {
                            return table.openCursor(req).then(cursor => {
                                if (!cursor || !req.values) {
                                    return cursor;
                                }
                                return Object.create(cursor, {
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
                                return req.values // db.friends.primaryKeys() will provide {values: false}
                                ? Dexie.Promise.all(res.result.map(decrypt)).then(result => ({
                                    ...res,
                                    result,
                                }))
                                : res;
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
