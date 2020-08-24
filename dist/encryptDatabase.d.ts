import Dexie from 'dexie';
import { EncryptDatabaseParams } from './types';
export declare function encryptDatabaseWithCustomEncryption<T extends Dexie>({ db, encryptionKey, tableSettings, onKeyChange, encrypt, decrypt, nonceOverrideForTesting, }: EncryptDatabaseParams<T>): void;
