/// <reference path="../pb_data/types.d.ts" />

// Captures the recipient's signature (drawn on a canvas at release time) as
// a small PNG data URL, so the printed/downloaded certificate can carry
// visual proof of receipt alongside the printed "Received by" name. Stored
// directly on the record rather than uploaded to Cloudinary — signatures
// need to work even in deployments that never configure Cloudinary (it's
// optional, see docker-compose.yml), and a modest canvas PNG comfortably
// fits in a text field.

migrate((app) => {
  const docsColl = app.findCollectionByNameOrId("document_requests");

  const hasField = docsColl.fields.some((f) => f.name === "signature_data");
  if (!hasField) {
    const signatureField = new TextField();
    signatureField.name = "signature_data";
    signatureField.required = false;
    signatureField.max = 200000;
    docsColl.fields.push(signatureField);
    app.save(docsColl);
    console.log("document_requests: signature_data field added");
  } else {
    console.log("document_requests: signature_data field already exists, skipping");
  }
});
