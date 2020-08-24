import Dexie, { DBCoreTable } from 'dexie';
import { CryptoSettings, TableType, EncryptionOption, EncryptionMethod, DecryptionMethod } from './types';
export declare function encryptEntity<T extends Dexie.Table>(table: DBCoreTable | T, entity: TableType<T>, rule: EncryptionOption<T> | undefined, encryptionKey: Uint8Array, performEncryption: EncryptionMethod, nonceOverride?: Uint8Array): Partial<TableType<T>>;
export declare function decryptEntity<T extends Dexie.Table>(entity: TableType<T> | undefined, rule: EncryptionOption<T> | undefined, encryptionKey: Uint8Array, performDecryption: DecryptionMethod): TableType<T> | undefined;
export declare function installHooks<T extends Dexie>(db: T, encryptionOptions: CryptoSettings<T>, keyPromise: Promise<Uint8Array>, performEncryption: EncryptionMethod, performDecryption: DecryptionMethod, nonceOverride: Uint8Array | undefined): T;
