/// <reference path="../pb_data/types.d.ts" />

// Email notifications for document status changes ("ready for release" /
// "released") and blotter hearing scheduling.
//
// Why a custom route instead of a record hook: PocketBase 0.39.5's classic
// model hooks (onRecordAfterUpdateSuccess, etc.) are unreliable for this —
// this codebase already hit the same wall building the finance audit trail
// (see docs/ARCHITECTURE.md's "Finance Audit Trail" section) and settled on
// triggering side effects from the frontend after a successful mutation
// instead. This route is that same pattern applied to email: the frontend
// calls it explicitly right after updateDocument()/updateBlotter() succeeds
// (see frontend/src/api/notifications.ts), rather than hoping a passive
// hook fires.
//
// IMPORTANT — every routerAdd handler below is fully self-contained (no
// top-level helper functions/constants referenced from inside a handler).
// Verified empirically against a real PocketBase 0.39.5 instance: a
// routerAdd callback only sees bindings declared inside itself — a
// top-level `function esc() {...}` or `const DOCUMENT_TITLES = {...}`
// throws "ReferenceError: ... is not defined" the moment the route is
// actually dispatched, even though the file loads without error at
// startup. Don't "DRY this up" into shared helpers without re-testing a
// live request against a real binary first.
//
// Templates are built server-side (not passed in as raw HTML by the
// caller) so this can't be used as a generic authenticated mail relay, and
// so the wording stays centrally controlled. Requires a real signed-in
// session — see docs/DEPLOYMENT.md "Email notifications" for the SMTP
// setup this depends on (PocketBase Settings -> Mail, same config already
// used for MFA OTP emails).

routerAdd("POST", "/api/notify/document-status", (e) => {
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }
  function documentTitle(type) {
    switch (type) {
      case "barangay_clearance": return "Barangay Clearance";
      case "business_permit": return "Barangay Business Permit Clearance";
      case "certificate_of_indigency": return "Certificate of Indigency";
      case "certificate_of_residency": return "Certificate of Residency";
      case "certificate_of_good_moral": return "Certificate of Good Moral Character";
      case "cedula": return "Community Tax Certificate (Cedula)";
      default: return "document";
    }
  }

  const data = new DynamicModel({
    to: "",
    resident_name: "",
    document_type: "",
    queue_number: "",
    status: "",
    barangay_name: "",
  });
  e.bindBody(data);

  if (!data.to || !data.queue_number) {
    throw new BadRequestError("Missing required fields.");
  }

  const docLabel = documentTitle(data.document_type);
  const barangayLabel = data.barangay_name ? `Barangay ${data.barangay_name}` : "the barangay office";

  let subject;
  let bodyLine;
  if (data.status === "for_release") {
    subject = `Your ${docLabel} is ready for release — #${data.queue_number}`;
    bodyLine = `Your <strong>${esc(docLabel)}</strong> request (queue #${esc(data.queue_number)}) is now ready for release. Please visit ${esc(barangayLabel)} to claim it.`;
  } else if (data.status === "released") {
    subject = `${docLabel} released — #${data.queue_number}`;
    bodyLine = `Your <strong>${esc(docLabel)}</strong> request (queue #${esc(data.queue_number)}) has been released. Thank you.`;
  } else {
    subject = `Update on your ${docLabel} request — #${data.queue_number}`;
    bodyLine = `There's an update on your <strong>${esc(docLabel)}</strong> request (queue #${esc(data.queue_number)}).`;
  }

  const html = `
    <p>Hello ${esc(data.resident_name) || "there"},</p>
    <p>${bodyLine}</p>
    <p style="color:#6b8078;font-size:12px;">This is an automated message from ${esc(barangayLabel)}'s CLUSTR system.</p>
  `;

  const settings = $app.settings();
  const message = new MailerMessage({
    from: {
      address: settings.meta.senderAddress,
      name: settings.meta.senderName || "CLUSTR",
    },
    to: [{ address: data.to }],
    subject: subject,
    html: html,
  });
  $app.newMailClient().send(message);

  return e.json(200, { success: true });
}, $apis.requireAuth());

routerAdd("POST", "/api/notify/hearing-scheduled", (e) => {
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  const data = new DynamicModel({
    to: "",
    party_name: "",
    case_number: "",
    hearing_date: "",
    barangay_name: "",
  });
  e.bindBody(data);

  if (!data.to || !data.case_number) {
    throw new BadRequestError("Missing required fields.");
  }

  const barangayLabel = data.barangay_name ? `Barangay ${data.barangay_name}` : "the barangay office";
  const subject = `Hearing scheduled for blotter case #${data.case_number}`;
  const html = `
    <p>Hello ${esc(data.party_name) || "there"},</p>
    <p>A hearing has been scheduled for blotter case <strong>#${esc(data.case_number)}</strong>${data.hearing_date ? ` on <strong>${esc(data.hearing_date)}</strong>` : ""}. Please coordinate with ${esc(barangayLabel)} for details.</p>
    <p style="color:#6b8078;font-size:12px;">This is an automated message from ${esc(barangayLabel)}'s CLUSTR system.</p>
  `;

  const settings = $app.settings();
  const message = new MailerMessage({
    from: {
      address: settings.meta.senderAddress,
      name: settings.meta.senderName || "CLUSTR",
    },
    to: [{ address: data.to }],
    subject: subject,
    html: html,
  });
  $app.newMailClient().send(message);

  return e.json(200, { success: true });
}, $apis.requireAuth());
