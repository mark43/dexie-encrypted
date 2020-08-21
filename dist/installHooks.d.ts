import Dexie from 'dexie';
import { CryptoSettings } from './types';
export declare function installHooks<T extends Dexie>(db: T, encryptionOptions: CryptoSettings<T>, keyPromise: Promise<Uint8Array>, nonceOverride: Uint8Array | undefined): T;
