import Dexie from 'dexie';
import { CryptoSettingsTable, TableType } from './types';
export declare function checkForKeyChange<T extends Dexie>(db: T, oldSettings: TableType<CryptoSettingsTable<T>> | undefined, encryptionKey: Uint8Array, onKeyChange: (db: T) => any): import("dexie").PromiseExtended<any>;
