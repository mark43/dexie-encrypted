import Dexie from 'dexie';
import { CryptoSettings, EncryptionMethod, DecryptionMethod } from './types';
export declare function upgradeTables<T extends Dexie>(db: T, tableSettings: CryptoSettings<T>, encryptionKey: Uint8Array, oldSettings: CryptoSettings<T> | undefined, encrypt: EncryptionMethod, decrypt: DecryptionMethod, nonceOverride: Uint8Array | undefined): Promise<void[]>;
