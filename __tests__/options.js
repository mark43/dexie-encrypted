require('fake-indexeddb/auto');

const Dexie = require('dexie');
require('dexie-export-import');

const nacl = require('tweetnacl');

const {
    encryptDatabase,
    clearAllTables,
    clearEncryptedTables,
    cryptoOptions,
} = require('../src/index');

const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32));

describe.skip('Options', () => {
    it('should not encrypt unencrypted list', async done => {
        const db = new Dexie('unencrypted list');
        encryptDatabase(
            db,
            keyPair.publicKey,
            {
                friends: {
                    type: cryptoOptions.UNENCRYPTED_LIST,
                    fields: ['picture'],
                },
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, name, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            street: 'East 13:th Street',
            picture: 'camilla.png',
        };

        await db.friends.add(original);

        const readingDb = new Dexie('whitelist');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });
        encryptDatabase(
            readingDb,
            keyPair.publicKey,
            {
                friends: cryptoOptions.NON_INDEXED_FIELDS,
            },
            clearAllTables,
            new Uint8Array(24)
        );
        await readingDb.open();
        const out = await readingDb.friends.get(1);

        expect(out).toEqual({ ...original, id: 1 });
        done();
    });
    it('should encrypt encrypt list', async done => {
        const db = new Dexie('encrypt-list');
        encryptDatabase(
            db,
            keyPair.publicKey,
            {
                friends: {
                    type: cryptoOptions.ENCRYPT_LIST,
                    fields: ['street'],
                },
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, name, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            street: 'East 13:th Street',
            picture: 'camilla.png',
        };

        await db.friends.add(original);

        const readingDb = new Dexie('blacklist');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });
        encryptDatabase(
            readingDb,
            keyPair.publicKey,
            {
                friends: cryptoOptions.NON_INDEXED_FIELDS,
            },
            clearAllTables,
            new Uint8Array(24)
        );
        await readingDb.open();
        const out = await readingDb.friends.get(1);

        expect(out).toEqual({ ...original, id: 1 });
        done();
    });

    it('should wait for a promise to resolve with a key if given a promise', async () => {
        const db = new Dexie('async-key');

        const keyPromise = Promise.resolve(keyPair.publicKey);
        encryptDatabase(
            db,
            keyPromise,
            {
                friends: cryptoOptions.NON_INDEXED_FIELDS,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, name, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            street: 'East 13:th Street',
            picture: 'camilla.png',
        };

        await db.friends.add(original);

        const readingDb = new Dexie('async-key');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });
        encryptDatabase(
            readingDb,
            keyPromise,
            {
                friends: cryptoOptions.NON_INDEXED_FIELDS,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        await readingDb.open();

        const out = await readingDb.friends.get(1);
        expect(out).toEqual({ ...original, id: 1 });
    });

    it('should execute callback when key changes', async done => {
        const db = new Dexie('key-change-test');
        const key = new Uint8Array(32);
        const key2 = new Uint8Array(32);

        key.set([1, 2, 3], 0);
        key2.set([1, 2, 3], 1);

        encryptDatabase(
            db,
            key,
            {
                friends: cryptoOptions.NON_INDEXED_FIELDS,
            },
            clearEncryptedTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, name, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            street: 'East 13:th Street',
            picture: 'camilla.png',
        };

        await db.friends.add({ ...original });

        const db2 = new Dexie('key-change-test');

        expect(await db.friends.get(1)).not.toEqual(undefined);

        encryptDatabase(
            db2,
            key2,
            {
                friends: cryptoOptions.NON_INDEXED_FIELDS,
            },
            clearEncryptedTables,
            new Uint8Array(24)
        );

        db2.version(1).stores({
            friends: '++id, name, age',
        });

        await db2.open();

        const friends = await db2.friends.get(1);
        expect(friends).toEqual(undefined);
        done();
    });
});
