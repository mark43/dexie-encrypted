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

describe('Upgrades', () => {
    it('should upgrade', async () => {
        const db = new Dexie('upgrade-db');
        applyEncryptionMiddleware(
            db,
            keyPair.publicKey,
            {
                friends: {
                    type: cryptoOptions.UNENCRYPTED_LIST,
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

        await db.close();

        const upgraded = new Dexie('upgrade-db');
        applyEncryptionMiddleware(
            upgraded,
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

        upgraded.version(1).stores({
            friends: '++id, name, age',
        });

        await upgraded.open();

        const readingDb = new Dexie('upgrade-db');
        readingDb.version(1).stores({
            friends: '++id, name, age',
        });
        applyEncryptionMiddleware(
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

        const unencryptedDb = new Dexie('upgrade-db');
        unencryptedDb.version(1).stores({
            friends: '++id, name, age',
        });

        await unencryptedDb.open();
        const unencrypted = await unencryptedDb.friends.get(1);
        expect(unencrypted).toMatchInlineSnapshot(`
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
                174,
                208,
                32,
                66,
                167,
                220,
                65,
                11,
                204,
                195,
                183,
                109,
                113,
                147,
                122,
                117,
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
                172,
                104,
                161,
                246,
                56,
                242,
                65,
                35,
                177,
                215,
                133,
                68,
                230,
                1,
                7,
                226,
                57,
                95,
                73,
                252,
                201,
                1,
                242,
                39,
                237,
                174,
                83,
                218,
                120,
                120,
                128,
                105,
                146,
                142,
                66,
                255,
                170,
                132,
                106,
                71,
                242,
                164,
                177,
                43,
                71,
                211,
                183,
                147,
                27,
                9,
                1,
                26,
              ],
              "age": 25,
              "id": 1,
              "name": "Camilla",
            }
        `);
    });
});
