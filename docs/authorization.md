# Authorization and authentication

GalaChain uses two layers of authorization and authentication to ensure that only authorized users can access the system.
The first level, exposed to the client, is based on secp256k1 signatures and private/public key authorization for the Ethereum signing scheme, and eddsa signatures for the TON signing scheme.
The second level uses native Hyperledger Fabric CA users and organizations MSPs.

## How it works

1. Client application signs the transaction with the **end user** private key.
2. GalaChain REST API uses custom **CA user** credentials to call the chaincode.
3. Chaincode checks the MSP of the **CA user** (**Organization based authorization**).
4. Chaincode recovers the **end user** public key from the dto and signature, and verifies if the **end user** is registered (**Signature based authorization**).
5. The transaction is executed if both checks pass.

Note the difference between the **end user** and the **CA user**.
The **end user** is the person who is using the client application, while the **CA user** is the system-level application user that is used to call the chaincode.

In this document, if we refer to the **user**, we mean the **end user**.


```mermaid
sequenceDiagram
    activate Client app
    Client app->>Client app: Sign DTO<br>(user private key)
    Client app->>GalaChain REST API: Execute transaction<br>(signed DTO)
    activate GalaChain REST API 
    GalaChain REST API->>Fabric CA: Enroll (CA user creds)
    activate Fabric CA
    Fabric CA-->>GalaChain REST API: CA user cert
    deactivate Fabric CA
    GalaChain REST API ->>Chaincode: Execute transaction<br>(CA user cert, signed DTO)
    activate Chaincode
      note over Chaincode: Organization based authorization
      Chaincode->>Chaincode: Verify CA cert MSP
      note over Chaincode: Signature based authorization
      Chaincode->>Chaincode: Recover public key<br>(signed DTO)
      Chaincode->>Chaincode: Get user profile<br>(user public key)
      Chaincode->>Chaincode: Verify user roles<br>(user profile)
    note over Chaincode: Actual transaction
    Chaincode->>Chaincode: Execute transaction (DTO)
    Chaincode-->>GalaChain REST API: Transaction response
    deactivate Chaincode
    GalaChain REST API-->>Client app: Transaction response
    deactivate GalaChain REST API
    deactivate Client app
```

## Signature based authorization

Signature-based authorization uses secp256k1 signatures to verify the identity of the end user.
By default, it uses the same algorithm as Ethereum (keccak256 + secp256k1), but the TON (The Open Network) signing scheme is also supported.
All payloads that should be authorized by the TON signing scheme must have the `signing` field set to `TON`.

### Required fields in dto object

The following fields are required in the transaction payload object:
* For Ethereum signing scheme with regular signature format (r + s + v): `signature` field only.
* For Ethereum signing scheme with DER signature formar: `signature` and `signerPublicKey` fields. 
  The `signerPublicKey` field is required to recover the public key from the signature, since DER signature does not contain the recovery parameter `v`.
* For TON signing scheme: `signature`, `signerPublicKey`, and `signing` fields. The `signing` field must be set to `TON`.

Both for Eth DER signature and TON signing scheme, instead of `signerPublicKey` field, you can use `signerAddress` field, which contains the user's checksumed Ethereum address or bounceable TON address respectively.
The address will be used to get public key of a registered user and use it for signature verification.

### DTO Expiration

DTOs can include an optional `dtoExpiresAt` field to prevent replay attacks and ensure time-sensitive operations:

```typescript
const dto = await createValidDTO(MyDtoClass, {
  myField: "myValue",
  dtoExpiresAt: Date.now() + 300000 // Expires in 5 minutes
}).signed(userPrivateKey);
```

### Signing the transaction payload

Client side it is recommended to use `@gala-chain/api`, or `@gala-chain/cli`, or `@gala-chain/connect` library to sign the transactions.
These libraries will automatically sign the transaction in a way it is compatible with GalaChain.

#### Using `@gala-chain/api`:

```typescript
import { createValidDto } from '@gala-chain/api';
import { ChainCallDTO } from "./dtos";
import { signatures } from "./index";

class MyDtoClass extends ChainCallDTO { ... }

// recommended way to sign the transaction
const dto1 = await createValidDto(MyDtoClass, {myField: "myValue"}).signed(userPrivateKey);

// alternate way, imperative style
const dto2 = new MyDtoClass({myField: "myValue"});
dto2.sign(userPrivateKey);

// when you don't have the dto class, but just a plain object
const dto3 = {myField: "myValue"};
dto3.signature = signatures.getSignature(dto3, Buffer.from(userPrivateKey));
```

If you want to use `TON` signing scheme, just provide `TON` as the signing scheme in your DTO object:

```typescript
// recommended way to sign the transaction
const dto1 = await createValidDto(MyDtoClass, {myField: "myValue", signing: "TON"}).signed(userPrivateKey);

// alternate way, imperative style
const dto2 = new MyDtoClass({myField: "myValue", signing: "TON"});
dto2.sign(userPrivateKey);

// when you don't have the dto class, but just a plain object
const dto3 = {myField: "myValue", signing: "TON"};
dto3.signature = signatures.getSignature(dto3, Buffer.from(userPrivateKey));
```

#### Using `@gala-chain/cli`:

```bash
galachain dto:sign -o=./output/path.json ./priv-key-file '{ "myField": "myValue" }'
```

#### Using `@gala-chain/connect`:

For the `@gala-chain/connect` library, signing is done automatically when you call the `sendTransaction` method, and it is handled by MetaMask wallet provider.

```typescript
import { GalachainConnectClient } from "@gala-chain/connect";

const client = new GalaChainConnectClient(contractUrl);
await client.connectToMetaMask();

const dto = ...;
const response = await client.send({ method: "TransferToken", payload: dto });
```

#### "Manual" process (ETH):

If you are not using any of the libraries, you can sign the transaction with the following steps:

1. You need to have secp256k1 private key of the end user.
2. Given the transaction payload as JSON object, you need to serialize it to a string in a way that it contains no additional spaces or newlines, fields are sorted alphabetically, and all `BigNumber` values are converted to strings with fixed notation. Also, you need to exclude top-level `signature` and `trace` fields from the payload.
3. You need to hash the serialized payload with keccak256 algorithm (note this is [NOT the same](https://crypto.stackexchange.com/questions/15727/what-are-the-key-differences-between-the-draft-sha-3-standard-and-the-keccak-sub) algorithm as SHA-3).
4. You need to get the signature of the hash using the private key, and add it to the payload as a `signature` field. The signature should be in the format of `rsv` array, where `r` and `s` are 32-byte integers, and `v` is a single byte.

It is important to follow these steps exactly, because chain side the same way of serialization and hashing is used to verify the signature.
If the payload is not serialized and hashed in the same way, the signature will not be verified.

### "Manual" process (TON):

In this case you need to have ed25519 private key and seed for the signing and signature verification, and we recommend using `safeSign` method from `@ton/core` library:

```typescript
import { beginCell, safeSign } from "@ton/core";

const data = "..."; // properly serialized payload string
const cell = beginCell().storeBuffer(Buffer.from(data)).endCell();
const signature = safeSign(cell, privateKey, seed);
```

The serialized payload string must be prepared in the same way as for Ethereum signing:
- no additional spaces or newlines,
- fields sorted alphabetically,
- all `BigNumber` values are converted to strings with fixed notation,
- top-level `signature` and `trace` fields excluded from the payload.

`safeSign` method generates the signature in the following way:

```
signature = Ed25519Sign(privkey, sha256(0xffff ++ utf8_encode(seed) ++ sha256(message)))
```

### Authenticating in the chaincode

In the chaincode, before the transaction is executed, GalaChain SDK will recover the public key from the signature and check if the user is registered.
If the user is not registered, the transaction will be rejected with an error.

By default `@Submit` and `@Evaluate` decorators for contract methods enforce signature based authorization.
The `@GalaTransaction` decorator is more flexible and can be used to disable signature based authorization for a specific method.
Disabling signature based authorization is useful when you want to allow anonymous access to a method, but it is not recommended for most use cases.

Chain side `ctx.callingUser` property will be populated with the user's alias, which is either `client|<custom-name>` or `eth|<eth-addr>` (if there is no custom name defined).
Also, `ctx.callingUserEthAddress` will contain the user's Ethereum address, if the user is registered with the Ethereum address.
If the TON signing scheme is used, `ctx.callingUserTonAddress` will contain the user's TON address.
The `ctx.callingUserRoles` property will contain the user's assigned roles.

This way it is possible to get the current user's properties in the chaincode and use them in the business logic.

### User registration

By default, GalaChain does not allow anonymous users to access the chaincode.
In order to access the chaincode, the user must be registered with the chaincode.
This behaviour may be changed as described in the [Allowing non-registered users](#allowing-non-registered-users) section.

There are three methods to register a user:

1. `RegisterUser` method in the `PublicKeyContract`.
2. `RegisterEthUser` method in the `PublicKeyContract`.
3. `RegisterTonUser` method in the `PublicKeyContract`.

All methods require the user to provide their public key (secp256k1 for Ethereum, ed25519 for TON).
The only difference between these methods is that only `RegisterUser` allows to specify the `alias` parameter.
For `RegisterEthUser` and `RegisterTonUser` methods, the alias is set to `eth|<eth-addr>` or `ton|<ton-addr>` respectively.

Access to registration methods is now controlled as follows:
- **Role-based authorization (RBAC)**: Requires the `REGISTRAR` role
- **Organization-based authorization**: Requires membership in one of the registrar organizations (see [Registrar Organizations and REGISTRAR Role](#registrar-organizations-and-registrar-role))

The authentication mode is controlled by the `USE_RBAC` environment variable:
- `USE_RBAC=true`: Uses role-based authentication
- `USE_RBAC=false` or unset: Uses organization-based authentication

#### Registrar Organizations and REGISTRAR Role

- The set of allowed registrar organizations is controlled by the `REGISTRAR_ORG_MSPS` environment variable (comma-separated list of org MSPs). If not set, it defaults to the value of `CURATOR_ORG_MSP` (default: `CuratorOrg`).
- In RBAC mode, the `REGISTRAR` role is required to register users. This is distinct from the `CURATOR` role, which may be used for other privileged operations.
- In organization-based mode, any CA user from an org listed in `REGISTRAR_ORG_MSPS` can register users.

**Example:**

- To allow both `Org1MSP` and `Org2MSP` to register users, set:
  ```
  REGISTRAR_ORG_MSPS=Org1MSP,Org2MSP
  ```
- If `REGISTRAR_ORG_MSPS` is not set, only the org specified by `CURATOR_ORG_MSP` (default: `CuratorOrg`) can register users.

See the [Registrar Organizations and REGISTRAR Role](#registrar-organizations-and-registrar-role) section for more details.

#### Allowing non-registered users

You may allow anonymous users to access the chaincode in one of the following ways:
* setting the `ALLOW_NON_REGISTERED_USERS` environment variable to `true` for the chaincode container,
* setting the `allowNonRegisteredUsers` property in the contract's `config` property to `true`, as shown in the example below:

```typescript
class MyContract extends GalaContract {
  constructor() {
    super("MyContract", version, {
      allowNonRegisteredUsers: true
    });
  }
}
```

It is useful especially when you expect a large number of users to access the chaincode, and you don't want to register all of them.

If the non-registered users are allowed, the DTO needs to be signed with the user's private key, and the public key can be recovered from the signature.
In this case, the user's alias will be `eth|<eth-addr>` or `ton|<ton-addr>`, and the user's roles will have default `EVALUATE` and `SUBMIT` roles.

Registration is required only if you want to use the custom alias for the user in the chaincode, or if you want to provide custom roles for the user.

### Default admin user

When the chaincode is deployed, it contains a default admin end user.
It is provided by two environment variables:
* `DEV_ADMIN_PUBLIC_KEY` - it contains the admin user public key (sample: `88698cb1145865953be1a6dafd9646c3dd4c0ec3955b35d89676242129636a0b`).
* `DEV_ADMIN_USER_ID` - it contains the admin user alias (sample: `client|admin`; this variable is optional),

If the user profile is not found in the chain data, and the public key recovered from the signature is the same as the admin user public key (`DEV_ADMIN_PUBLIC_KEY`), the admin user is set as the calling user.
Additionally, if the admin user alias is specified (`DEV_ADMIN_USER_ID`), it is used as the calling user alias.
Otherwise, the default admin user alias is  `eth|<eth-addr-from-public-key>`.

The admin user is required to register other users.

For GalaChain TestNet the admin user public key is specified by the `adminPublicKey` registration parameter.

Note the admin uses is an end user, not a CA user, and it cannot bypass the organization based authorization.
If you want to use the admin user to register other users, you need to use the CA user that is registered with the curator organization.

## Organization based authorization

Organization based authorization uses Hyperledger Fabric CA users and organizations MSPs to verify the identity of the caller.
It is used to restrict access to the chaincode method to a specific organization.

You can restrict access to the contract method to a specific organizations by setting the `allowedOrgs` property in the `@GalaTransaction`.

```typescript
@GalaTransaction({
    allowedOrgs: ["SomeRandomOrg"]
})
```

For the `PublicKeyContract` registration methods, the set of allowed organizations is controlled by the `REGISTRAR_ORG_MSPS` environment variable (see [Registrar Organizations and REGISTRAR Role](#registrar-organizations-and-registrar-role)).
If not set, it defaults to `CURATOR_ORG_MSP` (default: `CuratorOrg`).

**Note**: The `allowedOrgs` property is deprecated and will be eventually removed from the chaincode definition.
Instead, you should use the `allowedRoles` property to specify which **roles** can access the method.

## Role Based Access Control (RBAC)

GalaChain SDK v2 introduced a Role Based Access Control (RBAC) system that provides fine-grained control over who can access what resources.

The `allowedOrgs` property is deprecated and will be eventually removed from the chaincode definition.
Instead, you should use the `allowedRoles` property to specify which **roles** can access the method.

The `allowedRoles` property is an array of strings that represent the roles that are allowed to access the method.
The roles are assigned to the `UserProfile` object in the chain data.
By default, the `EVALUATE` and `SUBMIT` roles are assigned to the user when they are registered.
You can assign additional roles to the user using the `PublicKeyContract:UpdateUserRoles` method. This method requires that the calling user either has the `CURATOR` role or is a CA user from a curator organization.

There are some predefined roles (`EVALUATE`, `SUBMIT`, `CURATOR`, `REGISTRAR`). You can also define custom roles for more granular access control.

### Default Role Assignment

When users are registered, they are automatically assigned the following default roles:
- `EVALUATE`: Allows querying the blockchain state
- `SUBMIT`: Allows submitting transactions that modify state

For admin users (when `DEV_ADMIN_PUBLIC_KEY` is set), the following admin roles are assigned:
- `CURATOR`: Allows curator-level operations
- `EVALUATE`: Allows querying the blockchain state  
- `SUBMIT`: Allows submitting transactions that modify state

For registration methods, the `REGISTRAR` role is required if RBAC is enabled.

### Using Roles in Contract Methods

You can restrict access to contract methods using the `allowedRoles` property:

```typescript
@Submit({
  allowedRoles: ["CURATOR", "REGISTRAR"]
})
async privilegedOperation(ctx: GalaChainContext, dto: OperationDto) {
  // Only users with CURATOR, or REGISTRAR role can execute this
}
```

If no `allowedRoles` is specified, the system defaults to:
- `SUBMIT` role for submit transactions
- `EVALUATE` role for evaluate transactions

## Authenticating a chaincode

GalaChain also supports authorization by a chaincode which is used in cross-chaincode calls.
For instance you can configure your method to allow access where the orgin (entrypoint) chaincode called by the client is `trusted-chaincode`:

```typescript
@GalaTransaction({
  allowedOriginChaincodes: ["trusted-chaincode"]
})
```

In this case, when the origin chaincode is detected as a `trusted-chaincode` no signature-based authorization is performed, and the `ctx.callingUser` property becomes `service|trusted-chaincode`.

Note `allowedOriginChaincodes` property contains **origin** chaincodes not a direct chaincode which calls the current chaincode.
It means the config above supports both calls:

```
trusted-chaincode -> current-chaincode
trusted-chaincode -> other-chaincode -> current-chaincode
```

**Warning**: Do not provide the current chaincode ID in `allowedOriginChaincodes` property.
It effectively means providing open access with no authorization for everyone who provides `service|<current-chaincode>` in `dto.signerAddress`.

### Calling the external chaincode

If you want to call external chaincode and authorize your call as a chaincode:
1. Provide `service|${chaincodeName}` as a `signerAddress` field in the DTO, where the `chaincodeName` is the entrypoint chaincode id, called by the user.
2. Do not sign the DTO.

Remember to allow the chaincode in `allowedOriginChaincodes` transaction property in the target chaincode.

## Authentication and Authorization Flow

The authentication and authorization process follows this sequence:

1. **DTO Parsing and Validation**: The incoming DTO is parsed and validated
2. **DTO Expiration Check**: If `dtoExpiresAt` is set, the system checks if the DTO has expired
3. **User Authentication**: 
   - If `verifySignature` is enabled or a signature is present, the user is authenticated
   - If no signature verification is required, default roles are assigned based on the authorization type
4. **User Authorization**: The system checks if the authenticated user has the required roles, or organization membership, or is an allowed chaincode
5. **Unique Key Enforcement**: For submit transactions, the system ensures the transaction has a unique key to prevent replay attacks
6. **Transaction Execution**: The actual contract method is executed

### Context Properties

After successful authentication, the following context properties are available:

- `ctx.callingUser`: The user's alias (e.g., `eth|0x123...def`, `client|admin`)
- `ctx.callingUserEthAddress`: The user's Ethereum address (if available)
- `ctx.callingUserTonAddress`: The user's TON address (if available)
- `ctx.callingUserRoles`: Array of roles assigned to the user
- `ctx.callingUserProfile`: Complete user profile object
