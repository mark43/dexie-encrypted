# Dexie-encrypted

This lets you transparently encrypt an IndexedDB database using [Dexie.js](https://dexie.org/) and [tweetnacl.js](https://tweetnacl.js.org).

## Basic Usage

Create a Dexie database and call `encrypt` on it with your encryption key in a Uint8Array.

_Note: dexie-encrypted creates a database table to hold its configuration so you must also bump your database version._

```javascript
import Dexie from 'dexie';
import encrypt from 'dexie-encrypted';

const db = new Dexie('MyDatabase');

// set the key and provide a configuration of how to encrypt at a table level.
encrypt(db, symmetricKey, {
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
encrypt(db, key, config);
```

-   `db` - a Dexie database that has not had .version called.
-   `key` - a Uint8Array of length 32 that will be used for both encryption and decryption.
-   `config` - a table level configuration that determines how dexie-encrypted will encrypt.

## Configuration

Dexie-encrypted can be configured to encrypt all the data of a table, to whitelist fields that are non-sensitive, or to blacklist sensitive fields.

-   `encrypt.NON_INDEXED_FIELDS` - all data other than indices will be encrypted.
-   `encrypt.WHITELIST` - all data other than indices and whitelisted fields will be encrypted.
-   `encrypt.BLACKLIST` - listed fields will be encrypted.

```javascript
encrypt(db, symmetricKey, {
    users: encrypt.NON_INDEXED_FIELDS,
    friends: {
        type: encrypt.WHITELIST,
        fields: ['street', 'picture'], // these two fields and indices will be plain text
    },
    enemies: {
        type: encrypt.BLACKLIST,
        fields: ['picture', 'isMortalEnemy'], // note: these cannot be indices
    },
});
```

## Keys - Do not store your key locally without encryption.

Creating and persisting the key is not a part of this library. To generate a key, tweetnacl provides a method to generate a random array, you can do what it's doing under the hood and [use webcrypto directly](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), but most likely you should have a back end generate a key and send it to you. Take a look at the documentation for [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) and [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)/[TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) to figure out the best method for you.

### Strategies for storing keys

#### Password based

If you don't have a back end, or can't add this API to your back end, you may use the user's password or other information that is not stored locally. The simplest way to do this is to use the password or a hash of it. This has the disadvantage that you must reencrypt the full database if the user changes their password. An alternative is to generate a random key, then store it encrypted with the user's password. With this method when the user changes their password you only need to reencrypt their key, rather than the entire database.

#### Back End

Using a back end lets you ensure that only a logged in user can have access to the data in your database, but it does mean that the user won't be able to access this data offline.

## Upgrades

Dexie-encrypted saves your configuration to a database table, if you change your encryption configuration it will automatically reencrypt the database the next time it's open.

## Notes

-   You cannot encrypt indices. In the future it may be possible, but doing so would require overriding Dexie's `where` function and more. A PR adding this functionality would be accepted.
-   The shape of objects does not change; if `name` is a string that must be encrypted it will be an empty string in the database. Numbers are saved as 0, and booleans as false. This is an optimization that prevents the browser from needing to create hidden classes.
-   Tables missing from your configuration will not be encrypted.
-   The WebCrypto standard was not used because it doesn't offer a synchronous API, and that does not play well with IndexedDB transactions. Surprisingly, it's also much slower than tweetnacl.js. The browser's built in crypto can still be used for entropy.
