/// <reference path="../pb_data/types.d.ts" />

// Passkey (WebAuthn) sign-in: stores one row per registered authenticator
// (security key, platform authenticator like Touch ID/Windows Hello, etc.)
// so a user can sign in without a password.
//
// PocketBase has no native WebAuthn auth method, so the actual attestation/
// assertion cryptography (CBOR + COSE key parsing, ECDSA/RSA signature
// verification) is handled by a small sidecar service
// (backend/webauthn-service/) using the audited @simplewebauthn/server
// library, NOT reimplemented here in JS-hook code. This collection is only
// the credential store that sidecar reads/writes using a superuser token —
// see backend/webauthn-service/README.md.
//
// create/update are locked to superuser-only (null rule) because a row must
// never be written without first verifying a real attestation/assertion
// signature; delete is left open to the owning user so they can self-service
// revoke a lost device from Settings.

migrate((app) => {
  const existingNames = {};
  for (const c of app.findAllCollections()) existingNames[c.name] = true;

  if (existingNames["webauthn_credentials"]) {
    console.log("webauthn_credentials: already exists, skipping");
    return;
  }

  const usersColl = app.findCollectionByNameOrId("users");

  const coll = new Collection();
  coll.name = "webauthn_credentials";
  coll.type = "base";

  coll.listRule = coll.viewRule = "user = @request.auth.id";
  coll.createRule = null;
  coll.updateRule = null;
  coll.deleteRule = "user = @request.auth.id";

  const userField = new RelationField();
  userField.name = "user";
  userField.collectionId = usersColl.id;
  userField.required = true;
  userField.maxSelect = 1;
  userField.cascadeDelete = true;
  coll.fields.push(userField);

  const credentialIdField = new TextField();
  credentialIdField.name = "credential_id";
  credentialIdField.required = true;
  credentialIdField.max = 512;
  coll.fields.push(credentialIdField);

  const publicKeyField = new TextField();
  publicKeyField.name = "public_key";
  publicKeyField.required = true;
  publicKeyField.max = 2048;
  coll.fields.push(publicKeyField);

  // NOT required: PocketBase's NumberField "required" validator treats 0 as
  // blank, and a freshly-registered credential's counter legitimately starts
  // at 0 (confirmed against a real PocketBase 0.39.5 instance).
  const counterField = new NumberField();
  counterField.name = "counter";
  counterField.required = false;
  coll.fields.push(counterField);

  const deviceNameField = new TextField();
  deviceNameField.name = "device_name";
  deviceNameField.required = false;
  deviceNameField.max = 100;
  coll.fields.push(deviceNameField);

  const transportsField = new JSONField();
  transportsField.name = "transports";
  transportsField.required = false;
  coll.fields.push(transportsField);

  coll.indexes = [
    "CREATE UNIQUE INDEX idx_webauthn_credential_id ON webauthn_credentials (credential_id)",
  ];

  app.save(coll);
  console.log("webauthn_credentials: collection created");
});
