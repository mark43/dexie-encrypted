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

describe('Upgrades', () => {
    it('should upgrade', async () => {
        const db = new Dexie('upgrade-db');
        encryptDatabase(
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
        encryptDatabase(
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

        const unencryptedDb = new Dexie('upgrade-db');
        unencryptedDb.version(1).stores({
            friends: '++id, name, age',
        });

        await unencryptedDb.open();
        const unencrypted = await unencryptedDb.friends.get(1);
        expect(unencrypted).toMatchInlineSnapshot(`
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
                214,
                116,
                214,
                241,
                41,
                81,
                14,
                93,
                54,
                72,
                78,
                240,
                28,
                236,
                145,
                231,
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
                240,
                77,
                98,
                255,
                128,
                148,
                64,
                139,
                100,
                107,
                142,
                88,
                18,
                88,
                255,
                199,
                79,
                178,
                100,
                176,
                170,
                79,
                216,
                29,
                14,
                209,
                39,
                194,
                174,
                70,
                248,
                222,
                182,
                91,
                116,
                200,
                149,
                184,
                120,
                96,
                135,
                244,
                197,
                68,
                9,
                75,
                71,
                245,
                195,
                112,
                224,
                206,
                208,
                56,
                222,
              ],
              "age": 25,
              "id": 1,
              "name": "Camilla",
            }
        `);
    });
});
