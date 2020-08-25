import Dexie from 'dexie';
import { EncryptDatabaseParams } from './types';
export declare function encryptDatabaseWithCustomEncryption<T extends Dexie>({ db, encryptionKey, tableSettings, onKeyChange, encrypt, decrypt, _nonceOverrideForTesting, }: EncryptDatabaseParams<T>): void;
export declare function clearAllTables(db: Dexie): Promise<void[]>;
export declare function clearEncryptedTables<T extends Dexie>(db: T): Promise<void[]>;
