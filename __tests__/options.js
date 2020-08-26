require('fake-indexeddb/auto');

const Dexie = require('dexie');
require('dexie-export-import');

const nacl = require('tweetnacl');

const {
    applyEncryptionMiddleware,
    clearAllTables,
    clearEncryptedTables,
    cryptoOptions,
} = require('../src/index');

const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32));

describe('Options', () => {
    it('should not encrypt unencrypted list', async () => {
        const db = new Dexie('unencrypted list');
        applyEncryptionMiddleware(
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
        applyEncryptionMiddleware(
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
              "__encryptedData": Uint8Array [
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
                81,
                251,
                18,
                148,
                104,
                242,
                247,
                39,
                168,
                202,
                130,
                130,
                106,
                10,
                38,
                121,
                3,
                98,
                232,
                108,
                86,
                28,
                124,
                138,
                41,
                35,
                168,
                14,
                115,
                181,
                113,
                218,
                89,
                0,
                246,
                163,
                255,
                13,
                5,
                207,
                245,
                228,
                145,
                15,
                38,
                191,
                193,
                209,
                164,
                225,
                25,
                230,
                35,
                135,
                227,
                62,
                244,
                4,
                48,
                184,
                207,
                146,
                77,
                171,
                59,
                31,
                252,
                61,
                20,
                77,
                176,
                130,
                1,
                174,
                108,
                253,
                174,
                84,
                205,
                120,
                46,
                152,
                113,
                211,
                170,
                78,
                229,
                178,
                200,
                58,
                90,
                184,
                190,
                190,
                41,
                105,
              ],
              "age": 25,
              "id": 1,
              "picture": "camilla.png",
            }
        `);
    });

    it('should encrypt encrypt list', async () => {
        const db = new Dexie('encrypt-list');
        applyEncryptionMiddleware(
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
        applyEncryptionMiddleware(
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
              "__encryptedData": Uint8Array [
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
                81,
                251,
                18,
                148,
                104,
                242,
                247,
                39,
                168,
                202,
                130,
                130,
                106,
                10,
                38,
                121,
                3,
                98,
                232,
                108,
                86,
                28,
                124,
                138,
                41,
                35,
                168,
                14,
                115,
                181,
                113,
                218,
                89,
                0,
                246,
                163,
                255,
                13,
                5,
                207,
                245,
                228,
                145,
                15,
                38,
                191,
                193,
                209,
                164,
                225,
                25,
                230,
                35,
                135,
                227,
                62,
                244,
                4,
                48,
                184,
                207,
                146,
                77,
                171,
                59,
                31,
                252,
                61,
                20,
                77,
                176,
                130,
                1,
                174,
                108,
                253,
                174,
                84,
                205,
                120,
                46,
                152,
                113,
                211,
                170,
                78,
                229,
                178,
                200,
                58,
                90,
                184,
                190,
                190,
                41,
                105,
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
        applyEncryptionMiddleware(
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
        applyEncryptionMiddleware(
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
              "__encryptedData": Uint8Array [
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
                162,
                26,
                104,
                243,
                116,
                100,
                222,
                194,
                68,
                123,
                52,
                70,
                113,
                135,
                111,
                42,
                3,
                98,
                232,
                108,
                86,
                28,
                124,
                138,
                41,
                35,
                168,
                14,
                115,
                181,
                113,
                218,
                89,
                0,
                246,
                163,
                255,
                13,
                5,
                207,
                245,
                228,
                145,
                15,
                60,
                175,
                145,
                142,
                240,
                185,
                25,
                175,
                117,
                176,
                231,
                40,
                244,
                6,
                59,
                169,
                176,
                135,
                86,
                255,
                72,
                90,
                189,
                98,
                5,
                81,
                178,
                253,
                87,
                172,
                96,
                251,
                174,
                3,
                147,
                63,
                124,
                203,
                48,
                196,
                190,
                81,
                233,
                252,
                158,
                121,
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
                1,
                26,
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
        applyEncryptionMiddleware(
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
        applyEncryptionMiddleware(
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

        applyEncryptionMiddleware(
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

        applyEncryptionMiddleware(
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
