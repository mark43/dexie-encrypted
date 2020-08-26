# Dexie-encrypted

This lets you transparently encrypt an IndexedDB database using [Dexie.js](https://dexie.org/). By default it uses [tweetnacl.js](https://tweetnacl.js.org), but you may use any encryption method you desire. Note that Dexie-encrypted cannot encrypt indices as doing this would make the database unsearchable.

## Basic Usage

Create a Dexie database and call `applyEncryptionMiddleware` on it with your encryption key and encryption config.

_Note: dexie-encrypted creates a database table to hold its configuration so you must also bump your database version._

```javascript
import Dexie from 'dexie';
import { applyEncryptionMiddleware } from 'dexie-encrypted';

const db = new Dexie('MyDatabase');

// set the key and provide a configuration of how to encrypt at a table level.
applyEncryptionMiddleware(db, symmetricKey, {
    friends: encrypt.NON_INDEXED_FIELDS,
});

// If this is the first time you've encrypted bump the version number.
db.version(2).stores({
    friends: '++id, name, age',
});

await db.open();

const friend = {
    name: 'Camilla',
    age: 25,
    street: 'East 13th Street',
    picture: 'camilla.png',
};

// street and picture will be encrypted because they are not indices.
// id, name, and age will not be encrypted because they are indices.
await db.friends.add(friend);
```

## Arguments

```javascript
applyEncryptionMiddleware(db, key, config, onKeyChange);
```

-   `db` - a Dexie database that has not had .version called.
-   `key` - a Uint8Array of length 32, or a promise that will resolve with one. This will be used for both encryption and decryption.
-   `config` - a table level configuration that determines how dexie-encrypted will encrypt.
-   `onKeyChange(db): Promise` - Use this to clear your database or perform other actions when the database cannot be decrypted. We have provided encrypt.clearAllTables and encrypt.clearEncryptedTables to make this simpler. Setup will resume when the returned promise resolves.

## Key Error Utility Functions

-   `clearAllTables(db): Promise` - clears all data from the database.
-   `clearEncryptedTables(db): Promise` - clears data from all the encrypted tables, leaving unencrypted tables untouched.

## Configuration

### Table Level Config

Dexie-encrypted will only encrypt tables you choose. It can be configured to encrypt all the data of a table, or you may select fields to encrypt or leave unencrypted. Fields can be any data type that can be added to IndexedDB, but must be top level fields.

-   `encrypt.NON_INDEXED_FIELDS` - all data other than indices will be encrypted.
-   `encrypt.UNENCRYPTED_LIST` - all data other than indices and listed fields will be encrypted.
-   `encrypt.ENCRYPT_LIST` - listed fields will be encrypted.

```javascript
encrypt(db, symmetricKey, {
    users: encrypt.NON_INDEXED_FIELDS,
    friends: {
        type: encrypt.UNENCRYPTED_LIST,
        fields: ['street', 'picture'], // these two fields and indices will be plain text
    },
    enemies: {
        type: encrypt.ENCRYPT_LIST,
        fields: ['picture', 'isMortalEnemy'], // note: these cannot be indices
    },
});
```

### Using custom encryption methods

The default will encrypt with tweetnacl, which at the time of publishing was the fastest method available, even faster than native WebCrypto. However, you may choose to use your own encryption methods. [The main file](./src/index.ts) of the repo contains a good example of this.

```javascript
import { applyMiddlewareWithCustomEncryption } from 'dexie-encrypted/dist/applyMiddleware';
import { myCustomEncryptionMethod, myCustomDecryptionMethod } from './myEncryption';

applyMiddlewareWithCustomEncryption({
    db,
    encryptionKey,
    tableSettings,
    encrypt: myCustomEncryptionMethod, // <--- right here
    decrypt: myCustomDecryptionMethod, // <--- and here
    onKeyChange,
});
```

Note that this method takes a config object rather than several arguments.

#### Custom Encryption Methods

_see [the defaults](./src/encryptionMethods.ts) for an example_

-   `customEncryptionMethod(key: Uint8Array, object: any)` - This method receives an object containing only the fields that must be encrypted. It's up to you to serialize it, encrypt it, and return the encrypted data. It expects a Uint8Array to be returned from encryption.
-   `customDecryptionMethod(key: Uint8Array, encryptedData: Uint8Array)` Thismethod receives the data as it was returned from the encryption method. It must decrypt and deserialize it into an object. The returned value will be spread on to a new object with the unencrypted data.

## Keys - Do not store your key locally without encryption.

Creating and persisting the key is not a part of this library. The best way to handle this is to have the back end generate a key for you, keeping it unique per user or per session. You may use some other user-provided data, such as a password, to generate the encryption key, but do not store it in LocalStorage or a cookie, as this would allow anyone with access to the computer to derive the key and decrypt the database.

### Strategies for storing keys

#### Password based

If you don't have a back end, or can't add this API to your back end, you may use the user's password or other information that is not stored locally. The simplest way to do this is to use the password or a hash of it. This has the disadvantage that you must reencrypt the full database if the user changes their password. An alternative is to generate a random key, then store it encrypted with the user's password. With this method when the user changes their password you only need to reencrypt their key, rather than the entire database.

#### Back End

Using a back end lets you ensure that only a logged in user can have access to the data in your database, but it does mean that the user won't be able to access this data offline.

## Upgrades

Dexie-encrypted saves your configuration to a database table, if you change your encryption configuration it will run the `onKeyChanged` callback. In this callback you can clear the existing tables and provide new data, or do whatever you choose.

## Notes

-   You cannot encrypt indices. In the future it may be possible, but doing so would require overriding Dexie's `where` function and more. A PR adding this functionality would be accepted.
-   The shape of objects does not change; if `name` is a string that must be encrypted it will be an empty string in the database. Numbers are saved as 0, and booleans as false. This is an optimization that prevents the browser from needing to create hidden classes.
-   Tables missing from your configuration will not be encrypted.
-   The WebCrypto standard was not used because it doesn't offer a synchronous API, and that does not play well with IndexedDB transactions. Surprisingly, it's also much slower than tweetnacl.js. The browser's built in crypto can still be used for entropy.
