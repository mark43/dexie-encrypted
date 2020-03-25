import 'fake-indexeddb/auto';
import '../test-utils/encoder';

import Dexie from 'dexie';
import 'dexie-export-import';

import nacl from 'tweetnacl';

import encrypt, { clearAllTables, clearEncryptedTables } from '../index';

const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32));

const dbToJson = db => {
    return new Promise(async resolve => {
        const blob = await db.export();
        const reader = new FileReader();
        reader.addEventListener('loadend', () => {
            const data = JSON.parse(reader.result);
            resolve(data);
        });
        reader.readAsText(blob);
    });
};

describe('API', () => {
    it('should be a function', () => {
        expect(typeof encrypt).toBe('function');
    });
    it('should have cleanup functions that are functions', () => {
        expect(typeof encrypt.clearAllTables).toBe('function');
        expect(typeof encrypt.clearEncryptedTables).toBe('function');
    });

    it('should have configs that are strings', () => {
        expect(typeof encrypt.DATA).toBe('string');
        expect(typeof encrypt.NON_INDEXED_FIELDS).toBe('string');
        expect(typeof encrypt.WHITELIST).toBe('string');
        expect(typeof encrypt.BLACKLIST).toBe('string');
    });
})

describe('Encrypting', () => {
    it('should encrypt data', async () => {
        const db = new Dexie('MyDatabase');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
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

        const readingDb = new Dexie('MyDatabase');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });
        encrypt(
            readingDb,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );
        await readingDb.open();
        const out = await readingDb.friends.get(1);

        expect(out).toEqual({...original, id: 1})
    });

    it('should decrypt', async done => {
        const db = new Dexie('decrypt-test');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
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

        await db.friends.add({ ...original });

        const out = await db.friends.get(1);
        delete out.id;
        expect(original).toEqual(out);
        done();
    });

    it('should decrypt when the database is closed and reopened', async done => {
        const db = new Dexie('decrypt-test-2');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
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

        await db.friends.add({ ...original });

        const db2 = new Dexie('decrypt-test-2');
        encrypt(
            db2,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db2.version(1).stores({
            friends: '++id, name, age',
        });

        await db2.open();
        const out = await db2.friends.get(1);
        delete out.id;
        expect(original).toEqual(out);
        done();
    });


    it('should not modify your object', async done => {
        const db = new Dexie('MyDatabase');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
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

        const earlyClone = { ...original };

        await db.friends.add(original);
        delete original.id;
        expect(original).toEqual(earlyClone);
        done();
    });


    it('should not explode if you get something undefined', async done => {
        const db = new Dexie('explode-undefined');

        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        db.version(1).stores({
            friends: '++id, name, age',
        });

        const val = await db.friends.get(1);
        expect(val).toBe(undefined);
        done();
    });

    it('should still work when you update an existing entity', async () => {
        const db = new Dexie('in-and-out-test');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            street: 'East 13:th Street',
            picture: 'camilla.png',
            isFriendly: true
        };

        await db.friends.add({ ...original });

        const updated = {
            id: 1,
            name: 'Someone other than Camilla',
            age: 25,
            street: 'East 13,000:th Street',
            picture: 'camilla.png',
            isFriendly: false
        };

        await db.friends.put(updated);

        const out = await db.friends.get(1);

        const readingDb = new Dexie('in-and-out-test');
        await readingDb.open();
        const data = await dbToJson(readingDb);

        expect(out).toEqual(updated);
    });

    it('should still work when you update a child object', async () => {
        const db = new Dexie('in-and-out-test');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            attrs: {
                picture: 'camilla.png',
                street: 'East 13:th Street',
            }
        };

        await db.friends.add({ ...original });

        const updated = {
            id: 1,
            name: 'Someone other than Camilla',
            age: 25,
            attrs: {
                picture: 'camilla.png',
                street: 'East 13,000:th Street',
            }
        };

        await db.friends.put(updated);

        const out = await db.friends.get(1);

        const readingDb = new Dexie('in-and-out-test');
        await readingDb.open();
        // const data = await dbToJson(readingDb);

        expect(out).toEqual(updated);
    });

    it.skip('should still work when you have a key with dots in it', async () => {
        const db = new Dexie('dots-test');
        encrypt(
            db,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        // Declare tables, IDs and indexes
        db.version(1).stores({
            friends: '++id, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            'upside.down': false,
            attrs: {
                picture: 'camilla.png',
             street: 'East 13:th Street',
            }
        };

        await db.friends.add({ ...original });

        const updated = {
            id: 1,
            name: 'Someone other than Camilla',
            age: 25,
            'upside.down': true,
            attrs: {
                picture: 'camilla.png',
             street: 'East 13,000:th Street',
            }
        };

        await db.friends.put(updated);

        const out = await db.friends.get(1);
        // const data = await dbToJson(db);
        // console.log(JSON.stringify(data, null, 4));

        expect(out).toEqual(updated);
    });



});
