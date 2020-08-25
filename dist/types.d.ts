import Dexie from 'dexie';
export declare const tableEncryptionOptions: {
    readonly NON_INDEXED_FIELDS: "NON_INDEXED_FIELDS";
    readonly UNENCRYPTED_LIST: "UNENCRYPTED_LIST";
    readonly ENCRYPT_LIST: "ENCRYPT_LIST";
};
export declare type TableType<T> = T extends Dexie.Table<infer U> ? U : never;
export declare type EncryptionOption<T extends Dexie.Table> = 'NON_INDEXED_FIELDS' | {
    type: 'UNENCRYPTED_LIST' | 'ENCRYPT_LIST';
    fields: (keyof TableType<T>)[];
};
export declare const cryptoOptions: {
    readonly NON_INDEXED_FIELDS: "NON_INDEXED_FIELDS";
    readonly UNENCRYPTED_LIST: "UNENCRYPTED_LIST";
    readonly ENCRYPT_LIST: "ENCRYPT_LIST";
};
export declare type CryptoSettings<T extends Dexie> = Partial<{
    [U in keyof T]: T[U] extends Dexie.Table ? EncryptionOption<T[U]> : never;
}>;
export declare type TablesOf<T extends Dexie> = {
    [U in keyof T]: T[U] extends Dexie.Table ? T[U] : never;
};
export declare type TableOf<T extends Dexie> = TablesOf<T>[keyof TablesOf<T>];
export declare type CryptoSettingsTableType<T extends Dexie> = {
    settings: CryptoSettings<T>;
    keyChangeDetection: Uint8Array;
};
export declare type CryptoSettingsTable<T extends Dexie> = Dexie.Table<CryptoSettingsTableType<T>, number>;
export declare type EncryptionMethod = (encryptionKey: Uint8Array, input: any, nonceOverride?: Uint8Array) => Uint8Array;
export declare type DecryptionMethod = (encryptionKey: Uint8Array, input: Uint8Array) => any;
export interface EncryptDatabaseParams<T extends Dexie> {
    db: T;
    encryptionKey: Uint8Array | Promise<Uint8Array>;
    tableSettings: CryptoSettings<T>;
    onKeyChange: (db: T) => Promise<any>;
    encrypt: EncryptionMethod;
    decrypt: DecryptionMethod;
    _nonceOverrideForTesting?: Uint8Array;
}
