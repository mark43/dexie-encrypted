import Dexie from 'dexie';
import { CryptoSettings } from './types';
export declare function upgradeTables<T extends Dexie>(db: T, cryptoSettings: CryptoSettings<T>, encryptionKey: Uint8Array, oldSettings: CryptoSettings<T> | undefined, nonceOverride: Uint8Array | undefined): Promise<void[]>;
