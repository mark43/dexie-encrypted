import 'fake-indexeddb/auto';
import '../test-utils/encoder';

import Dexie from 'dexie';
import 'dexie-export-import';

import nacl from 'tweetnacl';

import encrypt from '../index';

const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32));

const dbToJson = (db) => {
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

describe('Encrypting', () => {
	it('should encrypt data', async (done) => {
		const db = new Dexie('MyDatabase');
		encrypt(db, keyPair.publicKey, {
			friends: encrypt.DATA
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		await db.friends.add(original);


		const readingDb = new Dexie('MyDatabase');
		readingDb.version(1).stores({
			friends: '++id, name, age'
		});
		await readingDb.open();

		const data = await dbToJson(readingDb);
		expect(data).toMatchSnapshot();
		done();

	});

	it('should encrypt whitelist', async (done) => {
		const db = new Dexie('whitelist');
		encrypt(db, keyPair.publicKey, {
			friends: {
				type: encrypt.WHITELIST,
				fields: ['picture']
			}
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		await db.friends.add(original);


		const readingDb = new Dexie('whitelist');
		readingDb.version(1).stores({
			friends: '++id, name, age'
		});
		await readingDb.open();

		const data = await dbToJson(readingDb);
		expect(data).toMatchSnapshot();
		done();

	});
	it('should encrypt blacklist', async (done) => {
		const db = new Dexie('blacklist');
		encrypt(db, keyPair.publicKey, {
			friends: {
				type: encrypt.BLACKLIST,
				fields: ['street']
			}
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		await db.friends.add(original);


		const readingDb = new Dexie('blacklist');
		readingDb.version(1).stores({
			friends: '++id, name, age'
		});
		await readingDb.open();

		const data = await dbToJson(readingDb);
		expect(data).toMatchSnapshot();
		done();

	});
	it('should decrypt', async (done) => {
		const db = new Dexie('decrypt-test');
		encrypt(db, keyPair.publicKey, {
			friends: encrypt.DATA
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		await db.friends.add({...original});

		const out = await db.friends.get(1);
		delete out.id;
		expect(original).toEqual(out);
		done();

	});

	it('should decrypt when the database is closed and reopened', async (done) => {
		const db = new Dexie('decrypt-test-2');
		encrypt(db, keyPair.publicKey, {
			friends: encrypt.DATA
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		await db.friends.add({...original});

		const db2 = new Dexie('decrypt-test-2');
		encrypt(db2, keyPair.publicKey, {
			friends: encrypt.DATA
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db2.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db2.open();
		const out = await db2.friends.get(1);
		delete out.id;
		expect(original).toEqual(out);
		done();

	});

	it('should upgrade', async (done) => {
		const db = new Dexie('upgrade-db');
		encrypt(db, keyPair.publicKey, {
			friends: {
				type: encrypt.WHITELIST,
				fields: ['street']
			}
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		await db.friends.add(original);
		await db.close();


		const upgraded = new Dexie('upgrade-db');
		encrypt(upgraded, keyPair.publicKey, {
			friends: {
				type: encrypt.WHITELIST,
				fields: ['picture']
			}
		}, new Uint8Array(24))

		upgraded.version(1).stores({
			friends: '++id, name, age'
		});

		await upgraded.open();
		
		const readingDb = new Dexie('upgrade-db');
		readingDb.version(1).stores({
			friends: '++id, name, age'
		});
		await readingDb.open();

		const data = await dbToJson(readingDb);
		expect(data).toMatchSnapshot();
		done();
	});

	it('should not modify your object', async (done) => {
		const db = new Dexie('MyDatabase');
		encrypt(db, keyPair.publicKey, {
			friends: encrypt.DATA
		}, new Uint8Array(24))

		// Declare tables, IDs and indexes
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();

		const original = {
			name: 'Camilla',
			age: 25,
			street: 'East 13:th Street',
			picture: 'camilla.png'
		};

		const earlyClone = {...original};

		await db.friends.add(original);
		delete original.id;
		expect(original).toEqual(earlyClone);
		done();
	});

	it('should have helpful error messages if you need to bump your version', async (done) => {
		const db = new Dexie('no-crypt-check');
		db.version(1).stores({
			friends: '++id, name, age'
		});
		
		await db.open();
		await db.close();

		const db2 = new Dexie('no-crypt-check');
		encrypt(db2, keyPair.publicKey, {
			friends: encrypt.DATA
		}, new Uint8Array(24))

		db2.version(1).stores({
			friends: '++id, name, age'
		});

		expect(db2.open()).rejects.toThrow();
		done();

	});

	it('should have helpful error messages if your key is not a Uint8Array', async (done) => {
		const db = new Dexie('key-check');
		expect(() => {
			encrypt(db, [1,2,3], {
				friends: encrypt.DATA
			}, new Uint8Array(24))
		}).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.')

		expect(() => {
			encrypt(db, new Uint8Array(31), {
				friends: encrypt.DATA
			}, new Uint8Array(24))
		}).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.')

		expect(() => {
			encrypt(db, new Uint16Array(32), {
				friends: encrypt.DATA
			}, new Uint8Array(24))
		}).toThrow('Dexie-encrypted requires a UInt8Array of length 32 for a encryption key.')

		done();

	});
})