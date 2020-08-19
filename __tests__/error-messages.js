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

describe('Error messaging', () => {
    it('should have helpful error messages if you need to bump your version', async done => {
        const db = new Dexie('no-crypt-check');
        db.version(1).stores({
            friends: '++id, name, age',
        });

        await db.open();
        await db.close();

        const db2 = new Dexie('no-crypt-check');
        encryptDatabase(
            db2,
            keyPair.publicKey,
            {
                friends: cryptoOptions.NON_INDEX_VALUES,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        db2.version(1).stores({
            friends: '++id, name, age',
        });

        expect(db2.open()).rejects.toThrow(
            "Dexie-encrypted can't find its encryption table. You may need to bump your database version."
        );

        // this will cause a log because it throws off thread.
        // Jest will complain if the test finishes first
        setTimeout(done, 20);
    });

    it.only('should have helpful error messages if your key is a regular array', async done => {
        const db = new Dexie('key-check');
        expect(() => {
            encryptDatabase(
                db,
                [1, 2, 3],
                {
                    friends: cryptoOptions.NON_INDEXED_FIELDS,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        }).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for an encryption key.');
    });

    it('should have helpful error messages if your key is a Uint8Array of the wrong length', async done => {
        const db = new Dexie('key-check');
        expect(() => {
            encryptDatabase(
                db,
                new Uint8Array(31),
                {
                    friends: cryptoOptions.NON_INDEXED_FIELDS,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        }).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for an encryption key.');
    });

    it('should have helpful error messages if your key is a promise that resolves with incorrect data', async done => {
        const db = new Dexie('key-check');
        expect(() => {
            encryptDatabase(
                db,
                new Promise(new Uint8Array(31)),
                {
                    friends: cryptoOptions.NON_INDEXED_FIELDS,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        }).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for an encryption key.');
    });

    it('should have helpful error messages if your key is a Uint16Array', async done => {
        const db = new Dexie('key-check');
        try {
            await encryptDatabase(
                db,
                new Uint16Array(32),
                {
                    friends: cryptoOptions.NON_INDEXED_FIELDS,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        } catch (e) {
            expect(e.message).toBe(
                'Dexie-encrypted requires a UInt8Array of length 32 for an encryption key.'
            );
        }
        done();
    });
});
