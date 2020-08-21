/// <reference types="node" />
import Dexie, { DBCoreTable } from 'dexie';
import { TableType, EncryptionOption } from './types';
export declare function performEncryption(key: Uint8Array, object: any, nonce: Uint8Array | undefined): Uint8Array;
export declare function encryptEntity<T extends Dexie.Table>(table: DBCoreTable | T, entity: TableType<T>, rule: EncryptionOption<T> | undefined, encryptionKey: Uint8Array, nonceOverride?: Uint8Array): Partial<TableType<T>>;
export declare function performDecryption(encryptionKey: Uint8Array, data: Buffer): Buffer;
export declare function decryptEntity<T extends Dexie.Table>(entity: TableType<T> | undefined, rule: EncryptionOption<T> | undefined, encryptionKey: Uint8Array): TableType<T> | undefined;
