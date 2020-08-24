import Dexie from 'dexie';
import { CryptoSettingsTable, TableType, EncryptionMethod, DecryptionMethod } from './types';
export declare function checkForKeyChange<T extends Dexie>(db: T, oldSettings: TableType<CryptoSettingsTable<T>> | undefined, encryptionKey: Uint8Array, encrypt: EncryptionMethod, decrypt: DecryptionMethod, onKeyChange: (db: T) => any): import("dexie").PromiseExtended<any>;
