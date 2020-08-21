import Dexie, { DBCoreTable, DBCoreIndex, IndexSpec } from 'dexie';
import nacl from 'tweetnacl';
import { serialize, deserialize } from 'bson';

import { TableType, EncryptionOption, cryptoOptions } from './types';

export function performEncryption(key: Uint8Array, object: any, nonce: Uint8Array | undefined) {
    nonce = nonce || nacl.randomBytes(nacl.secretbox.nonceLength);
    const buffer = serialize(object);
    const encrypted = nacl.secretbox(Uint8Array.from(buffer), nonce, key);
    const data = new Uint8Array(nonce.length + encrypted.length);
    data.set(nonce);
    data.set(encrypted, nonce.length);
    return data;
}

export function encryptEntity<T extends Dexie.Table>(
    table: DBCoreTable | T,
    entity: TableType<T>,
    rule: EncryptionOption<T>,
    encryptionKey: Uint8Array,
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
    dataToStore.__encryptedBson = performEncryption(encryptionKey, entity, nonceOverride);
    return dataToStore;
}

export function performDecryption(encryptionKey: Uint8Array, data: Buffer) {
    const encryptedArray = Uint8Array.from(data);

    const nonce = encryptedArray.slice(0, nacl.secretbox.nonceLength);
    const message = encryptedArray.slice(nacl.secretbox.nonceLength, encryptedArray.length);
    const rawDecrypted = nacl.secretbox.open(message, nonce, encryptionKey);
    if (rawDecrypted === null) {
        throw new Error('Dexie-encrypted was unable to decrypt an entity.');
    }
    return Buffer.from(rawDecrypted);
}

export function decryptEntity<T extends Dexie.Table>(
    entity: TableType<T> | undefined,
    rule: EncryptionOption<T> | undefined,
    encryptionKey: Uint8Array
) {
    if (rule === undefined || entity === undefined || !entity.__encryptedBson) {
        return entity;
    }

    const { __encryptedBson, ...unencryptedFields } = entity;

    const decrypted = deserialize(performDecryption(encryptionKey, __encryptedBson));
    return {
        ...unencryptedFields,
        ...decrypted,
    } as TableType<T>;
}
