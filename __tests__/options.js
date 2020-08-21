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

describe('Options', () => {
    it('should not encrypt unencrypted list', async () => {
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
            friends: '++id, age',
        });

        await db.open();

        const original = {
            name: 'Camilla',
            age: 25,
            street: 'East 13:th Street',
            picture: 'camilla.png',
        };

        await db.friends.add(original);

        const decryptingDb = new Dexie('unencrypted list');
        encryptDatabase(
            decryptingDb,
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
        decryptingDb.version(1).stores({
            friends: '++id, age',
        });

        await decryptingDb.open();
        const decrypted = await decryptingDb.friends.get(1);

        expect(decrypted).toMatchInlineSnapshot(`
            Object {
              "age": 25,
              "id": 1,
              "name": "Camilla",
              "picture": "camilla.png",
              "street": "East 13:th Street",
            }
        `);

        const readingDb = new Dexie('unencrypted list');
        readingDb.version(1).stores({
            friends: '++id, age',
        });

        await readingDb.open();
        const out = await readingDb.friends.get(1);
        expect(out).toMatchInlineSnapshot(`
            Object {
              "__encryptedBson": Uint8Array [
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                170,
                216,
                213,
                15,
                220,
                214,
                173,
                130,
                115,
                171,
                87,
                248,
                213,
                164,
                123,
                34,
                47,
                64,
                134,
                13,
                57,
                23,
                63,
                221,
                110,
                96,
                193,
                99,
                26,
                217,
                94,
                218,
                22,
                69,
                184,
                174,
                249,
                104,
                55,
                148,
                160,
                180,
                189,
                52,
                85,
                203,
                179,
                182,
                178,
                225,
                73,
                185,
                100,
                182,
                130,
                95,
                128,
                36,
                1,
                206,
                148,
                149,
                81,
                171,
                89,
                88,
                180,
                44,
                25,
                25,
                193,
                218,
                81,
                187,
                96,
                234,
                218,
                35,
                207,
                116,
                111,
                214,
                38,
                194,
                174,
                35,
                128,
                222,
                164,
                91,
                23,
                169,
                189,
                176,
                103,
                120,
                198,
                235,
                134,
                16,
                26,
                35,
                103,
              ],
              "age": 25,
              "id": 1,
              "picture": "camilla.png",
            }
        `);
    });

    it('should encrypt encrypt list', async () => {
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

        const decryptingDb = new Dexie('encrypt-list');
        encryptDatabase(
            decryptingDb,
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
        decryptingDb.version(1).stores({
            friends: '++id, name, age',
        });

        await decryptingDb.open();
        const decrypted = await decryptingDb.friends.get(1);
        expect(decrypted).toMatchInlineSnapshot(`
            Object {
              "age": 25,
              "id": 1,
              "name": "Camilla",
              "picture": "camilla.png",
              "street": "East 13:th Street",
            }
        `);

        const readingDb = new Dexie('encrypt-list');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });

        await readingDb.open();
        const out = await readingDb.friends.get(1);
        expect(out).toMatchInlineSnapshot(`
            Object {
              "__encryptedBson": Uint8Array [
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                170,
                216,
                213,
                15,
                220,
                214,
                173,
                130,
                115,
                171,
                87,
                248,
                213,
                164,
                123,
                34,
                47,
                64,
                134,
                13,
                57,
                23,
                63,
                221,
                110,
                96,
                193,
                99,
                26,
                217,
                94,
                218,
                22,
                69,
                184,
                174,
                249,
                104,
                55,
                148,
                160,
                180,
                189,
                52,
                85,
                203,
                179,
                182,
                178,
                225,
                73,
                185,
                100,
                182,
                130,
                95,
                128,
                36,
                1,
                206,
                148,
                149,
                81,
                171,
                89,
                88,
                180,
                44,
                25,
                25,
                193,
                218,
                81,
                187,
                96,
                234,
                218,
                35,
                207,
                116,
                111,
                214,
                38,
                194,
                174,
                35,
                128,
                222,
                164,
                91,
                23,
                169,
                189,
                176,
                103,
                120,
                198,
                235,
                134,
                16,
                26,
                35,
                103,
              ],
              "age": 25,
              "id": 1,
              "name": "Camilla",
              "picture": "camilla.png",
            }
        `);
    });

    it('should encrypt non-indexed fields', async done => {
        const db = new Dexie('non-indexed-fields');
        encryptDatabase(
            db,
            keyPair.publicKey,
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

        const decryptingDb = new Dexie('non-indexed-fields');
        encryptDatabase(
            decryptingDb,
            keyPair.publicKey,
            {
                friends: {
                    type: cryptoOptions.NON_INDEXED_FIELDS,
                    fields: ['street'],
                },
            },
            clearAllTables,
            new Uint8Array(24)
        );
        decryptingDb.version(1).stores({
            friends: '++id, name, age',
        });

        await decryptingDb.open();
        const decrypted = await decryptingDb.friends.get(1);
        expect(decrypted).toMatchInlineSnapshot(`
            Object {
              "age": 25,
              "id": 1,
              "name": "Camilla",
              "picture": "camilla.png",
              "street": "East 13:th Street",
            }
        `);

        const readingDb = new Dexie('non-indexed-fields');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });

        await readingDb.open();
        const out = await readingDb.friends.get(1);
        expect(out).toMatchInlineSnapshot(`
            Object {
              "__encryptedBson": Uint8Array [
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                41,
                99,
                28,
                205,
                178,
                15,
                149,
                114,
                204,
                119,
                206,
                135,
                107,
                176,
                210,
                2,
                39,
                64,
                134,
                13,
                57,
                23,
                63,
                221,
                110,
                96,
                193,
                99,
                26,
                217,
                94,
                218,
                22,
                69,
                184,
                174,
                249,
                104,
                55,
                148,
                160,
                180,
                189,
                52,
                85,
                203,
                179,
                164,
                168,
                241,
                59,
                221,
                1,
                194,
                130,
                79,
                243,
                80,
                115,
                238,
                144,
                146,
                37,
                153,
                104,
                107,
                142,
                29,
                16,
                74,
                230,
                142,
                18,
                237,
                63,
                234,
                178,
                1,
                236,
                105,
                126,
                199,
                54,
                196,
                203,
                33,
                252,
                183,
                199,
                47,
                1,
                186,
                181,
                217,
                7,
                20,
                167,
                197,
                149,
                31,
                16,
                74,
                11,
                202,
                214,
                44,
                245,
                197,
                195,
                56,
                222,
              ],
              "age": 25,
              "id": 1,
              "name": "Camilla",
            }
        `);

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
