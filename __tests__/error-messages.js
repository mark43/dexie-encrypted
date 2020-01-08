import 'fake-indexeddb/auto';
import '../test-utils/encoder';

import Dexie from 'dexie';
import 'dexie-export-import';

import nacl from 'tweetnacl';

import encrypt, { clearAllTables, clearEncryptedTables } from '../index';

const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32));

describe.skip('Error messaging', () => {

    it('should have helpful error messages if you need to bump your version', async done => {
        const db = new Dexie('no-crypt-check');
        db.version(1).stores({
            friends: '++id, name, age',
        });

        await db.open();
        await db.close();

        const db2 = new Dexie('no-crypt-check');
        encrypt(
            db2,
            keyPair.publicKey,
            {
                friends: encrypt.DATA,
            },
            clearAllTables,
            new Uint8Array(24)
        );

        db2.version(1).stores({
            friends: '++id, name, age',
        });

		expect(db2.open()).rejects.toThrow();
		
		// this will cause a log because it throws off thread.
		// Jest will complain if the test finishes first
        setTimeout(done, 4);
    });

    it('should have helpful error messages if your key is not a Uint8Array', async done => {
        const db = new Dexie('key-check');
        expect(() => {
            encrypt(
                db,
                [1, 2, 3],
                {
                    friends: encrypt.DATA,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        }).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.');

        expect(() => {
            encrypt(
                db,
                new Uint8Array(31),
                {
                    friends: encrypt.DATA,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        }).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.');

        expect(() => {
            encrypt(
                db,
                new Uint16Array(32),
                {
                    friends: encrypt.DATA,
                },
                clearAllTables,
                new Uint8Array(24)
            );
        }).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.');

        done();
    });
})