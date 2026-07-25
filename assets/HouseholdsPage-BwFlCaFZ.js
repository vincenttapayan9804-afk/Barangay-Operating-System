import{o as e}from"./rolldown-runtime-DAXXjFlN.js";import{a as t,c as n,i as r,n as i,r as a,s as ee,u as o}from"./errorHandler-O5zxleTS.js";import{t as s}from"./data-table-DIpPZVyR.js";import{t as te}from"./empty-state-rdliziYd.js";import{t as c}from"./map-pin-zrzOGBmc.js";import{t as ne}from"./plus-CJNbOIuJ.js";import{n as l}from"./client-Ch7YIoPr.js";import{r as re}from"./session-CYgcF4IY.js";import{Ct as ie,It as ae,Mt as u,St as oe,Tt as d,Xt as se,_t as ce,bt as le,cn as ue,in as de,jt as fe,on as pe,vt as me,yt as he}from"./index-Cj4rOa_J.js";import{t as ge}from"./useBodyScrollLock-Btb_f8b8.js";import{t as f}from"./input-DkeSstMy.js";import{t as p}from"./label-D7vt6YK3.js";import{t as m}from"./select-2wjpptMv.js";import{n as h,r as g,t as _e}from"./DetailPanel-C47e3Bqy.js";import{t as _}from"./useLookups-BrYKw1zQ.js";import{i as ve,n as ye,o as v,r as be,s as xe,t as Se}from"./bims-csv-export-CNOYdkyM.js";var Ce=n(`arrow-up-down`,[[`path`,{d:`m21 16-4 4-4-4`,key:`f6ql7i`}],[`path`,{d:`M17 20V4`,key:`1ejh1v`}],[`path`,{d:`m3 8 4-4 4 4`,key:`11wl7u`}],[`path`,{d:`M7 4v16`,key:`1glfcx`}]]),y=e(o(),1);async function b(e){try{let t=l().filter(`household_id = {:id}`,{id:e});return await l().collection(`household_members`).getFullList({filter:t,sort:`sort_order`})}catch(e){throw i(e)}}async function we(e){try{if(e.relationship_to_head===`1`&&(await b(e.household_id)).some(e=>e.relationship_to_head===`1`))throw Error(`This household already has a Household Head (relationship code 1). Remove the existing head first.`);let t=await l().collection(`household_members`).create({...e,data_set:`BIPS`}),n=await b(e.household_id);return await d(e.household_id,{no_of_household_members:n.length}),t}catch(e){throw i(e)}}async function Te(e){try{let t=await l().collection(`household_members`).getOne(e),n=t.household_id,r=t.resident_id;if(await l().collection(`household_members`).delete(e),r)try{await l().collection(`residents`).update(r,{household_id:``})}catch{}return n&&await d(n,{no_of_household_members:(await b(n)).length}),!0}catch(e){throw i(e)}}async function x(e){try{let t=l().filter(`household_id = {:id}`,{id:e});return await l().collection(`migrant_info`).getFullList({filter:t})}catch(e){throw i(e)}}async function Ee(e){try{let t=S(e),n=await l().collection(`migrant_info`).create({...t,data_set:`BIPS`}),r=await x(e.household_id);return await d(e.household_id,{no_of_migrants:r.length}),n}catch(e){throw i(e)}}async function De(e){try{let t=(await l().collection(`migrant_info`).getOne(e)).household_id;return await l().collection(`migrant_info`).delete(e),t&&await d(t,{no_of_migrants:(await x(t)).length}),!0}catch(e){throw i(e)}}function S(e){let t={...e};return t.reason_for_leaving!==`16`&&delete t.reason_for_leaving_other,t.reason_for_transferring!==`5`&&delete t.reason_for_transferring_other,t}function Oe(e){let{household:t,members:n,migrants:r,relationshipLabels:i,incomeLabels:a}=e,ee=e=>i?.get(e)??e,o=e=>(e&&a?.get(e))??e??`—`,s=new Date().toLocaleDateString(`en-PH`,{year:`numeric`,month:`long`,day:`numeric`}),te=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BIMS Form A1 — Household Profile</title>
<style>
  @page { size: legal portrait; margin: 12mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; line-height: 1.35; padding: 0; }

  /* ── Header ── */
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6pt; margin-bottom: 8pt; }
  .header .rep { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; }
  .header .office { font-size: 9pt; font-weight: bold; margin-top: 2pt; }
  .header .form-ref { font-size: 8pt; font-weight: bold; color: #222; margin-top: 1pt; }
  .header .mc-ref { font-size: 7.5pt; color: #444; margin-top: 1pt; }

  /* ── Form Title ── */
  .form-title { text-align: center; font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 10pt 0 6pt; padding: 3pt 0; border-bottom: 1px solid #000; }

  /* ── Section Headers ── */
  .section-title { font-size: 10pt; font-weight: bold; margin: 8pt 0 4pt; padding: 2pt 5pt; background: #e8e8e8; border: 1px solid #999; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
  th, td { border: 1px solid #000; padding: 2pt 4pt; text-align: left; font-size: 9pt; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; }
  .field-label { font-weight: bold; width: 32%; background: #f8f8f8; }
  .field-value { width: 68%; }

  /* ── Compact / wide variant ── */
  .field-label-wide { font-weight: bold; width: 28%; background: #f8f8f8; }
  .field-value-wide { width: 22%; }

  /* ── PSGC Codes Row ── */
  .psgc-table td { font-size: 8pt; text-align: center; }

  /* ── Meta Row ── */
  .meta-row { background: #f0f0f0; font-size: 8pt; text-align: center; }

  /* ── Signatures ── */
  .sig-section { margin-top: 16pt; border-top: 1px solid #000; padding-top: 4pt; }
  .sig-grid { display: flex; justify-content: space-between; gap: 12pt; margin-top: 8pt; }
  .sig-box { text-align: center; flex: 1; }
  .sig-box .label { font-size: 8pt; font-weight: bold; }
  .sig-box .line { border-top: 1px solid #000; margin-top: 32pt; padding-top: 2pt; font-size: 8pt; }
  .sig-box .sub { font-size: 7.5pt; color: #555; font-style: italic; }
  .sig-box .date-line { margin-top: 8pt; font-size: 7.5pt; border-top: 1px solid #000; padding-top: 2pt; }

  /* ── Footer ── */
  .footer { text-align: center; font-size: 7pt; color: #666; margin-top: 12pt; border-top: 1px solid #ccc; padding-top: 4pt; }

  /* ── Buttons (screen only) ── */
  @media screen {
    .no-print { text-align: right; margin-bottom: 8pt; }
    .no-print button { padding: 5pt 14pt; font-size: 10pt; cursor: pointer; margin-left: 4pt; border: 1px solid #999; background: #fff; border-radius: 3pt; }
    .no-print button:hover { background: #eee; }
  }
  @media print {
    .no-print { display: none; }
    body { padding: 0; }
    .sig-box .line { margin-top: 36pt; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()">✕ Close</button>
</div>

<!-- ─── HEADER ─────────────────────────────────────────────────── -->
<div class="header">
  <div class="rep">Republic of the Philippines</div>
  <div class="office">Barangay Information Management System (BIMS)</div>
  <div class="form-ref">BIMS FORM A1 — HOUSEHOLD PROFILE</div>
  <div class="mc-ref">DILG MC No. 2025-104 | LGUSS-BIMS Standard Household Profiling</div>
</div>

<!-- ─── FORM META: Date / Data Set / Enumerator ──────────────── -->
<table style="margin-bottom:8pt;">
  <tr>
    <td style="width:25%;font-weight:bold;font-size:8pt;border:none;">Date Accomplished:</td>
    <td style="width:25%;font-size:8pt;border:none;"><strong>${C(s)}</strong></td>
    <td style="width:25%;font-weight:bold;font-size:8pt;border:none;">Data Set / Source:</td>
    <td style="width:25%;font-size:8pt;border:none;"><strong>${C(t.data_set||`BIPS`)}</strong></td>
  </tr>
  <tr>
    <td style="font-weight:bold;font-size:8pt;border:none;">Enumerator:</td>
    <td style="font-size:8pt;border:none;"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></td>
    <td style="font-weight:bold;font-size:8pt;border:none;">Date Encoded:</td>
    <td style="font-size:8pt;border:none;">${C(s)}</td>
  </tr>
</table>

<!-- ─── PSGC CODES ────────────────────────────────────────────── -->
<div class="section-title">PSGC Codes &amp; Geographic Classification</div>
<table class="psgc-table">
  <tr>
    <th style="width:20%;">Level</th>
    <th style="width:40%;">Name</th>
    <th style="width:40%;">PSGC Code</th>
  </tr>
  <tr>
    <td><strong>Region</strong></td>
    <td>${C(t.region||`—`)}</td>
    <td><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></td>
  </tr>
  <tr>
    <td><strong>Province</strong></td>
    <td>${C(t.province||`—`)}</td>
    <td><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></td>
  </tr>
  <tr>
    <td><strong>City / Municipality</strong></td>
    <td>${C(t.city_municipality||`—`)}</td>
    <td><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></td>
  </tr>
  <tr>
    <td><strong>Barangay</strong></td>
    <td>${C(t.barangay||`—`)}</td>
    <td><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></td>
  </tr>
</table>

<!-- ─── PART 1: HOUSEHOLD GEOGRAPHIC & GENERAL INFO ──────────── -->
<div class="form-title">Part 1 — Household Geographic &amp; General Information</div>

<table>
  <tr><td class="field-label">Household Number (HHN)</td><td class="field-value"><strong>${C(t.household_number)}</strong></td></tr>
  <tr><td class="field-label">Sitio / Purok</td><td class="field-value">${C(t.sitio_purok||`—`)}</td></tr>
  <tr><td class="field-label">Complete Address</td><td class="field-value">${C(t.household_complete_address||`—`)}</td></tr>
  <tr><td class="field-label">Household Name (Head of Household)</td><td class="field-value"><strong>${C(t.household_name||`—`)}</strong></td></tr>
  <tr><td class="field-label">Household Type</td><td class="field-value">${C(t.household_type||`—`)}${t.household_type_other?` (`+C(t.household_type_other)+`)`:``}</td></tr>
  <tr><td class="field-label">Tenure Status</td><td class="field-value">${C(t.tenure_status||`—`)}${t.tenure_status_other?` (`+C(t.tenure_status_other)+`)`:``}</td></tr>
  <tr><td class="field-label">Household Unit / Structure</td><td class="field-value">${C(t.household_unit||`—`)}${t.household_unit_other?` (`+C(t.household_unit_other)+`)`:``}</td></tr>
  <tr><td class="field-label">Number of Families in the Household</td><td class="field-value">${t.no_of_families??`—`}</td></tr>
  <tr><td class="field-label">Number of Household Members</td><td class="field-value">${t.no_of_household_members??`—`}</td></tr>
  <tr><td class="field-label">Number of Migrants (OFW / Previous Residents)</td><td class="field-value">${t.no_of_migrants??`—`}</td></tr>
  <tr><td class="field-label">Monthly Household Income (PHP)</td><td class="field-value">${t.monthly_income==null?`—`:`PHP `+Number(t.monthly_income).toLocaleString()}</td></tr>
</table>

<!-- ─── NATIONAL INDICATORS ──────────────────────────────────── -->
<div class="section-title">National Indicators (DILG MC No. 2025-104)</div>
<table>
  <tr>
    <td class="field-label">Water System</td>
    <td class="field-value">${C(t.water_system||`—`)}</td>
  </tr>
  <tr>
    <td class="field-label">Waste Disposal</td>
    <td class="field-value">${C(t.waste_disposal||`—`)}</td>
  </tr>
  <tr>
    <td class="field-label">Power Supply</td>
    <td class="field-value">${C(t.power_supply||`—`)}</td>
  </tr>
  <tr>
    <td class="field-label">Toilet Type</td>
    <td class="field-value">${C(t.toilet_type||`—`)}</td>
  </tr>
</table>

<!-- ─── PART 2: HOUSEHOLD MEMBERS ─────────────────────────────── -->
<div class="form-title">Part 2 — Household Members (List of All Members)</div>

<table>
  <thead>
    <tr>
      <th style="width:4%;">#</th>
      <th style="width:22%;">Last Name</th>
      <th style="width:18%;">First Name</th>
      <th style="width:15%;">Middle Name</th>
      <th style="width:8%;">Ext.</th>
      <th style="width:14%;">Relationship to Head</th>
      <th style="width:19%;">Source of Income</th>
    </tr>
  </thead>
  <tbody>
    ${n.length===0?`<tr><td colspan="7" style="text-align:center;font-style:italic;">No household members recorded.</td></tr>`:n.map((e,t)=>`
    <tr>
      <td style="text-align:center;">${t+1}</td>
      <td>${C(e.last_name)}</td>
      <td>${C(e.first_name)}</td>
      <td>${C(e.middle_name||`—`)}</td>
      <td>${C(e.ext_name||`—`)}</td>
      <td>${C(ee(e.relationship_to_head))}</td>
      <td>${o(e.source_of_income)}</td>
    </tr>`).join(``)}
  </tbody>
</table>

<!-- Member Income Detail -->
${n.some(e=>e.monthly_income!=null&&e.monthly_income>0)?`
<table>
  <caption style="font-size:8pt;font-weight:bold;text-align:left;margin-bottom:2pt;">Individual Monthly Income of Members</caption>
  <thead>
    <tr>
      <th style="width:4%;">#</th>
      <th style="width:48%;">Full Name</th>
      <th style="width:48%;">Monthly Income (PHP)</th>
    </tr>
  </thead>
  <tbody>
    ${n.filter(e=>e.monthly_income!=null&&e.monthly_income>0).map((e,t)=>`
    <tr>
      <td style="text-align:center;">${t+1}</td>
      <td>${C(e.last_name)}, ${C(e.first_name)} ${C(e.middle_name||``)} ${C(e.ext_name||``)}</td>
      <td style="text-align:right;">PHP ${Number(e.monthly_income).toLocaleString()}</td>
    </tr>`).join(``)}
  </tbody>
</table>
`:``}

<!-- ─── PART 3: MIGRANT INFORMATION ──────────────────────────── -->
<div class="form-title">Part 3 — Migrant Information</div>

${r.length===0?`
<p style="text-align:center;font-style:italic;padding:10pt 0;border:1px solid #999;">No migrant records for this household.</p>
`:`
<table>
  <thead>
    <tr>
      <th style="width:3%;">#</th>
      <th style="width:13%;">Full Name</th>
      <th style="width:15%;">Previous Residence</th>
      <th style="width:9%;">Length of Stay (Prev.)</th>
      <th style="width:14%;">Reason for Leaving</th>
      <th style="width:11%;">Date of Transfer</th>
      <th style="width:14%;">Reason for Transferring</th>
      <th style="width:8%;">Duration Here</th>
      <th style="width:6%;">Intend to Return?</th>
    </tr>
  </thead>
  <tbody>
    ${r.map((e,t)=>`
    <tr>
      <td style="text-align:center;">${t+1}</td>
      <td><strong>${C(e.last_name)}</strong>, ${C(e.first_name)}</td>
      <td>${C(e.previous_residence)}</td>
      <td style="text-align:center;">${C(e.length_of_stay_previous_barangay)}</td>
      <td>${C(e.reason_for_leaving)}${e.reason_for_leaving_other?`<br><em>Specify: `+C(e.reason_for_leaving_other)+`</em>`:``}</td>
      <td style="text-align:center;">${C(e.date_of_transfer)}</td>
      <td>${C(e.reason_for_transferring)}${e.reason_for_transferring_other?`<br><em>Specify: `+C(e.reason_for_transferring_other)+`</em>`:``}</td>
      <td style="text-align:center;">${C(e.duration_of_stay_current_barangay)}</td>
      <td style="text-align:center;">${e.intention_to_return?`Yes`:`No`}</td>
    </tr>`).join(``)}
  </tbody>
</table>
`}

<!-- ─── DATA QUALITY / CONTROL INFO ──────────────────────────── -->
<div class="section-title">Data Control &amp; Quality Assurance</div>
<table>
  <tr>
    <td style="width:25%;font-weight:bold;background:#f8f8f8;">Form Version</td>
    <td style="width:25%;">BIMS A1 v1.0</td>
    <td style="width:25%;font-weight:bold;background:#f8f8f8;">Data Set Identifier</td>
    <td style="width:25%;">${C(t.data_set||`BIPS`)}</td>
  </tr>
  <tr>
    <td style="font-weight:bold;background:#f8f8f8;">Number of Pages</td>
    <td>—</td>
    <td style="font-weight:bold;background:#f8f8f8;">Date Exported</td>
    <td>${C(s)}</td>
  </tr>
</table>

<!-- ─── SIGNATURES ────────────────────────────────────────────── -->
<div class="sig-section">
  <div class="sig-grid">
    <div class="sig-box">
      <div class="label">Prepared by:</div>
      <div class="line">
        <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u><br>
        <span class="sub">Signature over Printed Name of Household Head / Member</span>
      </div>
      <div class="date-line">Date: _______________</div>
    </div>
    <div class="sig-box">
      <div class="label">Certified Correct by:</div>
      <div class="line">
        <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u><br>
        <span class="sub"><strong>Barangay Secretary</strong><br>Printed Name &amp; Signature</span>
      </div>
      <div class="date-line">Date: _______________</div>
    </div>
    <div class="sig-box">
      <div class="label">Validated by:</div>
      <div class="line">
        <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u><br>
        <span class="sub"><strong>Punong Barangay</strong><br>Printed Name &amp; Signature</span>
      </div>
      <div class="date-line">Date: _______________</div>
    </div>
  </div>
</div>

<!-- Signature for Encoding -->
<div style="margin-top:10pt;border-top:1px solid #999;padding-top:4pt;display:flex;justify-content:center;gap:40pt;">
  <div style="text-align:center;">
    <div style="font-size:8pt;font-weight:bold;">Encoded by:</div>
    <div style="border-top:1px solid #000;margin-top:24pt;padding-top:2pt;font-size:8pt;">
      <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u><br>
      <span style="font-size:7pt;color:#555;">Signature over Printed Name</span>
    </div>
  </div>
  <div style="text-align:center;">
    <div style="font-size:8pt;font-weight:bold;">Verified / Spot-checked by:</div>
    <div style="border-top:1px solid #000;margin-top:24pt;padding-top:2pt;font-size:8pt;">
      <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u><br>
      <span style="font-size:7pt;color:#555;">Signature over Printed Name of MPDC / Planner</span>
    </div>
  </div>
</div>

<div class="footer">
  <strong>CLUSTR</strong> — LGUSS-BIMS Compliant | Generated ${C(s)}
  <br>This form complies with DILG Memorandum Circular No. 2025-104
</div>

<script>
  setTimeout(function() { window.print(); }, 500);
<\/script>

</body>
</html>`,c=window.open(``,`_blank`);if(!c){alert(`Popup blocked. Please allow popups for this site to export.`);return}c.document.write(te),c.document.close()}function C(e){return e==null?`—`:String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)}var w=ee(),T={1:1,"2a":2,"2b":3,3:4,4:5,5:6,6:7,7:8,8:9,9:10,10:11,11:12,12:13,13:14,14:15,15:16,16:17,17:18,18:19,19:20,20:21,21:22,22:23,23:24,24:25,25:26,26:27};function ke(e){return[...e].sort((e,t)=>{let n=T[e.relationship_to_head]??99,r=T[t.relationship_to_head]??99;return n===r?(e.sort_order??0)-(t.sort_order??0):n-r})}function Ae(){return{household_number:``,region:``,province:``,city_municipality:``,barangay:``,sitio_purok:``,household_complete_address:``,no_of_families:0,no_of_household_members:0,no_of_migrants:0,household_type:``,household_type_other:``,tenure_status:``,tenure_status_other:``,household_unit:``,household_unit_other:``,household_name:``,monthly_income:0,water_system:``,waste_disposal:``,power_supply:``,toilet_type:``}}function E(){return{first_name:``,last_name:``,middle_name:``,ext_name:``,relationship_to_head:``,source_of_income:``,monthly_income:0}}function je(){return{first_name:``,last_name:``,middle_name:``,ext_name:``,previous_residence:``,length_of_stay_previous_barangay:``,reason_for_leaving:``,reason_for_leaving_other:``,date_of_transfer:``,reason_for_transferring:``,reason_for_transferring_other:``,duration_of_stay_current_barangay:``,intention_to_return:!1}}function Me(e){return e.map(e=>({label:e.label,value:e.code??e.label}))}function Ne(){let[e,n]=(0,y.useState)([]),[i,ee]=(0,y.useState)(!0),[o,l]=(0,y.useState)(null),[S,C]=(0,y.useState)([]),[T,Ne]=(0,y.useState)([]),[Pe,Fe]=(0,y.useState)(!1),[D,O]=(0,y.useState)(Ae()),[k,A]=(0,y.useState)(null),[Ie,Le]=(0,y.useState)(!1),[j,M]=(0,y.useState)([]),[N,P]=(0,y.useState)([]);ge(Ie);let[F,I]=(0,y.useState)(!1),[L,R]=(0,y.useState)(E()),[z,B]=(0,y.useState)(``),[Re,V]=(0,y.useState)([]),[ze,Be]=(0,y.useState)(!1),[H,U]=(0,y.useState)(null),Ve=(0,y.useRef)(null),[W,G]=(0,y.useState)(``),[He,K]=(0,y.useState)([]),[Ue,We]=(0,y.useState)(!1),Ge=(0,y.useRef)(null),q=(0,y.useMemo)(()=>j.find(e=>e.relationship_to_head===`1`)??null,[j]),[Ke,qe]=(0,y.useState)(!1),[J,Y]=(0,y.useState)(je()),[Je,Ye]=(0,y.useState)(null),[Xe,X]=(0,y.useState)(null),[Z,Q]=(0,y.useState)({});function Ze(e){Q(t=>{let n={...t};return delete n[e],n})}function Qe(){let e={};D.region.trim()||(e.region=`Region is required`),D.province.trim()||(e.province=`Province is required`),D.city_municipality.trim()||(e.city_municipality=`City/Municipality is required`),D.barangay.trim()||(e.barangay=`Barangay is required`),D.household_complete_address.trim()||(e.household_complete_address=`Complete address is required`),D.household_type||(e.household_type=`Household type is required`),D.household_type===`Others`&&!D.household_type_other.trim()&&(e.household_type_other=`Please specify household type`),D.tenure_status||(e.tenure_status=`Tenure status is required`),D.tenure_status===`Others`&&!D.tenure_status_other.trim()&&(e.tenure_status_other=`Please specify tenure status`),D.household_unit||(e.household_unit=`Household unit is required`),D.household_unit===`Others`&&!D.household_unit_other.trim()&&(e.household_unit_other=`Please specify household unit`),D.no_of_families<0&&(e.no_of_families=`Must be 0 or more`),Q(e);let t=Object.keys(e);return t.length>0?`Please fix ${t.length} field(s) before saving.`:null}let{data:$e}=_(`household_type`),{data:et}=_(`tenure_status`),{data:tt}=_(`household_unit`),{data:nt}=_(`relationship_to_head`),{data:rt}=_(`source_of_income`),{data:it}=_(`reason_for_leaving`),{data:at}=_(`reason_for_transferring`),ot=(0,y.useMemo)(()=>Me(nt),[nt]),st=(0,y.useMemo)(()=>Me(it),[it]),ct=(0,y.useMemo)(()=>{let e=new Map;for(let t of nt)e.set(t.code??t.label,t.label);return e},[nt]),lt=(0,y.useMemo)(()=>{let e=new Map;for(let t of rt)e.set(t.code??t.label,t.label);return e},[rt]),ut=(0,y.useMemo)(()=>{let e=new Map;for(let t of it)e.set(t.code??t.label,t.label);return e},[it]);(0,y.useEffect)(()=>{oe().then(n).catch(e=>X(e instanceof Error?e.message:`Failed to load households`)).finally(()=>ee(!1))},[]);let[dt]=ue(),ft=dt.get(`selected`);(0,y.useEffect)(()=>{if(ft&&e.length>0){let t=e.find(e=>e.id===ft);t&&l(t),window.history.replaceState(null,``,window.location.pathname)}},[ft,e]),(0,y.useEffect)(()=>{if(!o){C([]),Ne([]);return}Fe(!0),Promise.all([b(o.id),x(o.id)]).then(([e,t])=>{C(ke(e)),Ne(t)}).catch(()=>{}).finally(()=>Fe(!1))},[o]),(0,y.useEffect)(()=>{if(z.length<3){V([]);return}Be(!0);let e=setTimeout(()=>{ce(z).then(V).catch(()=>V([])).finally(()=>Be(!1))},400);return()=>clearTimeout(e)},[z]),(0,y.useEffect)(()=>{if(W.length<3){K([]);return}We(!0);let e=setTimeout(()=>{ce(W).then(K).catch(()=>K([])).finally(()=>We(!1))},400);return()=>clearTimeout(e)},[W]),(0,y.useEffect)(()=>{if(!F)return;let e=e=>{Ve.current&&!Ve.current.contains(e.target)&&V([])};return document.addEventListener(`mousedown`,e),()=>document.removeEventListener(`mousedown`,e)},[F]),(0,y.useEffect)(()=>{if(!k)return;let e=e=>{Ge.current&&!Ge.current.contains(e.target)&&K([])};return document.addEventListener(`mousedown`,e),()=>document.removeEventListener(`mousedown`,e)},[k]);function $(e,t){O(n=>({...n,[e]:t})),Ze(e)}function pt(e,t){let n=t===``?0:Number(t);O(t=>({...t,[e]:n})),Ze(e)}function mt(){Le(!1),A(null),O(Ae()),M([]),P([]),I(!1),R(E()),U(null),B(``),V([]),G(``),K([]),qe(!1),Y(je()),X(null),Q({})}async function ht(){X(null),A(null),O(Ae());let e=await ie();O(t=>({...t,household_number:e})),M([]),P([]),Le(!0)}function gt(e){A(e.id),O({household_number:e.household_number,region:e.region??``,province:e.province??``,city_municipality:e.city_municipality??``,barangay:e.barangay??``,sitio_purok:e.sitio_purok??``,household_complete_address:e.household_complete_address||``,no_of_families:e.no_of_families??0,no_of_household_members:e.no_of_household_members??0,no_of_migrants:e.no_of_migrants??0,household_type:e.household_type??``,household_type_other:e.household_type_other??``,tenure_status:e.tenure_status??``,tenure_status_other:e.tenure_status_other??``,household_unit:e.household_unit??``,household_unit_other:e.household_unit_other??``,household_name:e.household_name??``,monthly_income:e.monthly_income??0,water_system:e.water_system??``,waste_disposal:e.waste_disposal??``,power_supply:e.power_supply??``,toilet_type:e.toilet_type??``}),Le(!0),X(null),I(!1),R(E()),U(null),B(``),V([]),G(``),K([]),Promise.all([b(e.id),x(e.id)]).then(([e,t])=>{M(ke(e)),P(t)}).catch(()=>{M([]),P([])})}async function _t(e){if(e.preventDefault(),!D.household_number.trim())return;let t=Qe();if(t){X(t);return}let r={...D,no_of_household_members:j.length,no_of_migrants:N.length};try{if(k){let e=await d(k,r);n(t=>t.map(t=>t.id===k?e:t)),mt()}else{let e=await he(r);n(t=>[e,...t]),A(e.id),O(t=>({...t,household_number:e.household_number})),X(null),Q({});return}}catch(e){X(e instanceof Error?e.message:`Failed to save household`)}}async function vt(){if(!H||!L.relationship_to_head)return;let e=k;if(!e){let t=Qe();if(t){X(t);return}try{let t=await he({...D,no_of_household_members:j.length,no_of_migrants:N.length});n(e=>[t,...e]),A(t.id),e=t.id,O(e=>({...e,household_number:t.household_number})),X(null),Q({})}catch(e){X(e instanceof Error?e.message:`Failed to save household`);return}}try{let t=j.length>0?Math.max(...j.map(e=>e.sort_order??0)):0,n=await we({household_id:e,first_name:H.first_name,last_name:H.last_name,middle_name:H.middle_name||`N/A`,ext_name:H.ext_name||void 0,resident_id:H.id,relationship_to_head:L.relationship_to_head,source_of_income:L.source_of_income||void 0,monthly_income:L.monthly_income||0,sort_order:t+1});try{await me(H.id,{household_id:e})}catch(e){console.warn(`Failed to link resident to household:`,e)}M(e=>ke([...e,n])),U(null),B(``),V([]),R(E()),I(!1)}catch(e){X(e instanceof Error?e.message:`Failed to add member`)}}async function yt(e){try{await Te(e),M(t=>t.filter(t=>t.id!==e))}catch(e){X(e instanceof Error?e.message:`Failed to remove member`)}}async function bt(e){if(k)try{q&&await Te(q.id);let t=await we({household_id:k,first_name:e.first_name,last_name:e.last_name,middle_name:e.middle_name||`N/A`,ext_name:e.ext_name||void 0,resident_id:e.id,relationship_to_head:`1`,sort_order:1});try{await me(e.id,{household_id:k})}catch{}M(e=>ke([...e,t])),D.household_name||$(`household_name`,`${e.last_name}, ${e.first_name} Family`),G(``),K([])}catch(e){X(e instanceof Error?e.message:`Failed to set household head`)}}async function xt(){if(!(!J.first_name.trim()||!J.last_name.trim()||!J.previous_residence||!J.date_of_transfer)&&k)try{let e=await Ee({household_id:k,first_name:J.first_name.trim(),last_name:J.last_name.trim(),middle_name:J.middle_name.trim()||void 0,ext_name:J.ext_name.trim()||void 0,previous_residence:J.previous_residence,length_of_stay_previous_barangay:J.length_of_stay_previous_barangay,reason_for_leaving:J.reason_for_leaving,reason_for_leaving_other:J.reason_for_leaving===`16`?J.reason_for_leaving_other:void 0,date_of_transfer:J.date_of_transfer,reason_for_transferring:J.reason_for_transferring,reason_for_transferring_other:J.reason_for_transferring===`5`?J.reason_for_transferring_other:void 0,duration_of_stay_current_barangay:J.duration_of_stay_current_barangay,intention_to_return:J.intention_to_return});P(t=>[...t,e]),Y(je()),qe(!1)}catch(e){X(e instanceof Error?e.message:`Failed to add migrant`)}}async function St(e){try{await De(e),P(t=>t.filter(t=>t.id!==e))}catch(e){X(e instanceof Error?e.message:`Failed to remove migrant`)}}async function Ct(e){Ye(e)}async function wt(){if(Je)try{await le(Je),n(e=>e.filter(e=>e.id!==Je))}catch(e){X(e instanceof Error?e.message:`Failed to delete household`)}finally{Ye(null)}}function Tt(){l(null)}let[Et,Dt]=(0,y.useState)(!1);async function Ot(){Dt(!0);try{let e=await oe(),t=new Map,n=new Map;for(let r of e){let[e,i]=await Promise.all([b(r.id).catch(()=>[]),x(r.id).catch(()=>[])]);t.set(r.id,e),n.set(r.id,i)}Se(`bims_households.csv`,ye(e)),Se(`bims_household_members.csv`,be(e,t)),Se(`bims_migrants.csv`,ve(e,n))}catch(e){X(e instanceof Error?e.message:`Export failed`)}finally{Dt(!1)}}let kt=re(`admin`,`staff`);return(0,w.jsxs)(w.Fragment,{children:[(0,w.jsx)(`div`,{className:`-ml-4 -mr-4 sm:-ml-6 sm:-mr-6 lg:-ml-8 lg:-mr-8 -mt-4 sm:-mt-6 lg:-mt-8 -mb-4 sm:-mb-6 lg:-mb-8 h-[calc(100vh-56px)] h-[calc(100dvh-60px)] md:h-[calc(100dvh-52px)] flex flex-col overflow-hidden`,children:(0,w.jsx)(s,{title:`HOUSEHOLDS`,toolbarActions:(0,w.jsxs)(`div`,{className:`flex items-center gap-1`,children:[kt?(0,w.jsxs)(u,{variant:`ghost`,size:`sm`,className:`gap-1.5 rounded-md text-blue-400 hover:text-blue-300 motion-press`,onClick:ht,children:[(0,w.jsx)(ne,{className:`size-3`}),`New Household`]}):null,(0,w.jsx)(u,{variant:`outline`,size:`sm`,className:`gap-1.5`,onClick:Ot,disabled:Et,children:Et?`Exporting...`:`Export CSV (BIMS)`})]}),columns:[{key:`household_number`,label:`Household #`,sortable:!0,filterType:`text`},{key:`household_name`,label:`Household Head`,filterType:`text`,render:e=>(0,w.jsxs)(`div`,{className:`flex items-center gap-1.5`,children:[(0,w.jsx)(`div`,{className:`flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground`,children:(0,w.jsx)(se,{className:`size-3`})}),(0,w.jsx)(`span`,{className:`font-medium text-xs`,children:e.household_name||`—`})]})},{key:`sitio_purok`,label:`Sitio / Purok`,sortable:!0,filterType:`text`,render:e=>e.sitio_purok||`—`},{key:`household_type`,label:`Type`,filterType:`text`,render:e=>e.household_type||`—`},{key:`member_count`,label:`Members`,render:e=>(e.no_of_household_members??0).toString()}],data:e,loading:i,onRowClick:e=>l(e),emptyState:e.length===0?(0,w.jsx)(te,{title:`No households yet`,description:`Create your first household.`,action:kt?{label:`Create first household`,onClick:ht}:void 0}):void 0,rowKey:e=>e.id,toolbar:!0,exportable:!0})}),Ie&&(0,w.jsxs)(`div`,{className:`fixed inset-0 z-40 flex max-md:flex-col max-md:justify-end md:justify-end`,children:[(0,w.jsx)(`div`,{className:`fixed inset-0 bg-black/40 motion-fade-in`,onClick:mt,"aria-hidden":`true`}),(0,w.jsxs)(`div`,{className:`relative w-full bg-card shadow-xl motion-slide-up motion-fade-in overflow-y-auto md:w-1/2 md:border-l md:border-border max-md:max-h-[85vh] max-md:rounded-t-2xl font-display`,children:[(0,w.jsxs)(`div`,{className:`flex items-center justify-between border-b px-5 py-4`,children:[(0,w.jsx)(`h2`,{className:`font-display text-sm font-semibold text-foreground`,children:k?`Edit Household`:`New Household`}),(0,w.jsx)(`button`,{type:`button`,onClick:mt,className:`flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground`,"aria-label":`Close`,children:(0,w.jsx)(de,{className:`size-4`})})]}),(0,w.jsxs)(`form`,{onSubmit:_t,className:`space-y-5 p-5`,children:[Xe&&(0,w.jsx)(`div`,{className:`rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive`,children:Xe}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-household-number`,children:`Household Number *`}),(0,w.jsx)(f,{id:`panel-household-number`,value:D.household_number,disabled:!0,className:`bg-muted`})]}),(0,w.jsxs)(v,{icon:(0,w.jsx)(c,{className:`size-4`}),title:`Address`,defaultOpen:!0,children:[(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-region`,className:`text-xs`,children:`Region *`}),(0,w.jsx)(f,{id:`panel-region`,value:D.region,onChange:e=>$(`region`,e.target.value),className:a(`h-8 text-xs`,Z.region&&`border-destructive`)}),Z.region&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.region})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-province`,className:`text-xs`,children:`Province *`}),(0,w.jsx)(f,{id:`panel-province`,value:D.province,onChange:e=>$(`province`,e.target.value),className:a(`h-8 text-xs`,Z.province&&`border-destructive`)}),Z.province&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.province})]})]}),(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-city`,className:`text-xs`,children:`City / Municipality *`}),(0,w.jsx)(f,{id:`panel-city`,value:D.city_municipality,onChange:e=>$(`city_municipality`,e.target.value),className:a(`h-8 text-xs`,Z.city_municipality&&`border-destructive`)}),Z.city_municipality&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.city_municipality})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-barangay`,className:`text-xs`,children:`Barangay *`}),(0,w.jsx)(f,{id:`panel-barangay`,value:D.barangay,onChange:e=>$(`barangay`,e.target.value),className:a(`h-8 text-xs`,Z.barangay&&`border-destructive`)}),Z.barangay&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.barangay})]})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-sitio-purok`,className:`text-xs`,children:`Sitio / Purok`}),(0,w.jsx)(f,{id:`panel-sitio-purok`,value:D.sitio_purok,onChange:e=>$(`sitio_purok`,e.target.value),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-address`,className:`text-xs`,children:`Household Complete Address *`}),(0,w.jsx)(`textarea`,{id:`panel-address`,value:D.household_complete_address,onChange:e=>$(`household_complete_address`,e.target.value),rows:2,className:a(`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`,Z.household_complete_address&&`border-destructive`)}),Z.household_complete_address&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.household_complete_address})]})]}),(0,w.jsxs)(v,{icon:(0,w.jsx)(pe,{className:`size-4`}),title:`Classification`,defaultOpen:!0,children:[(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-household-type`,className:`text-xs`,children:`Household Type *`}),(0,w.jsxs)(m,{id:`panel-household-type`,value:D.household_type,onValueChange:e=>$(`household_type`,e),className:a(`h-8 text-xs`,Z.household_type&&`border-destructive`),children:[(0,w.jsx)(`option`,{value:``,children:`Select type`}),$e.map(e=>(0,w.jsx)(`option`,{value:e.label,children:e.label},e.label))]}),Z.household_type&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.household_type})]}),D.household_type===`Others`&&(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-hh-type-other`,className:`text-xs`,children:`Specify household type *`}),(0,w.jsx)(f,{id:`panel-hh-type-other`,value:D.household_type_other,onChange:e=>$(`household_type_other`,e.target.value),className:a(`h-8 text-xs`,Z.household_type_other&&`border-destructive`)}),Z.household_type_other&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.household_type_other})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-tenure-status`,className:`text-xs`,children:`Tenure Status *`}),(0,w.jsxs)(m,{id:`panel-tenure-status`,value:D.tenure_status,onValueChange:e=>$(`tenure_status`,e),className:a(`h-8 text-xs`,Z.tenure_status&&`border-destructive`),children:[(0,w.jsx)(`option`,{value:``,children:`Select tenure`}),et.map(e=>(0,w.jsx)(`option`,{value:e.label,children:e.label},e.label))]}),Z.tenure_status&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.tenure_status})]}),D.tenure_status===`Others`&&(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-tenure-other`,className:`text-xs`,children:`Specify tenure status *`}),(0,w.jsx)(f,{id:`panel-tenure-other`,value:D.tenure_status_other,onChange:e=>$(`tenure_status_other`,e.target.value),className:a(`h-8 text-xs`,Z.tenure_status_other&&`border-destructive`)}),Z.tenure_status_other&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.tenure_status_other})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-household-unit`,className:`text-xs`,children:`Household Unit *`}),(0,w.jsxs)(m,{id:`panel-household-unit`,value:D.household_unit,onValueChange:e=>$(`household_unit`,e),className:a(`h-8 text-xs`,Z.household_unit&&`border-destructive`),children:[(0,w.jsx)(`option`,{value:``,children:`Select unit`}),tt.map(e=>(0,w.jsx)(`option`,{value:e.label,children:e.label},e.label))]}),Z.household_unit&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.household_unit})]}),D.household_unit===`Others`&&(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-unit-other`,className:`text-xs`,children:`Specify household unit *`}),(0,w.jsx)(f,{id:`panel-unit-other`,value:D.household_unit_other,onChange:e=>$(`household_unit_other`,e.target.value),className:a(`h-8 text-xs`,Z.household_unit_other&&`border-destructive`)}),Z.household_unit_other&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.household_unit_other})]})]}),(0,w.jsxs)(v,{icon:(0,w.jsx)(ae,{className:`size-4`}),title:`Demographics`,defaultOpen:!0,children:[(0,w.jsxs)(`div`,{className:`grid grid-cols-3 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-no-families`,className:`text-xs`,children:`No. of Families *`}),(0,w.jsx)(f,{id:`panel-no-families`,type:`number`,min:0,value:D.no_of_families,onChange:e=>pt(`no_of_families`,e.target.value),className:a(`h-8 text-xs`,Z.no_of_families&&`border-destructive`)}),Z.no_of_families&&(0,w.jsx)(`p`,{className:`text-xs text-destructive`,children:Z.no_of_families})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-no-members`,className:`text-xs`,children:`No. of Members`}),(0,w.jsx)(f,{id:`panel-no-members`,type:`number`,min:0,value:j.length,disabled:!0,className:`h-8 text-xs bg-muted`}),(0,w.jsx)(`p`,{className:`text-[10px] text-muted-foreground`,children:`Auto-calculated from member list`})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-no-migrants`,className:`text-xs`,children:`No. of Migrants`}),(0,w.jsx)(f,{id:`panel-no-migrants`,type:`number`,min:0,value:N.length,disabled:!0,className:`h-8 text-xs bg-muted`}),(0,w.jsx)(`p`,{className:`text-[10px] text-muted-foreground`,children:`Auto-calculated from migrant list`})]})]}),k&&(0,w.jsxs)(`div`,{className:`space-y-1`,ref:Ge,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Household Head`}),q?(0,w.jsxs)(`div`,{className:`flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs`,children:[(0,w.jsxs)(`span`,{className:`font-medium`,children:[q.last_name,`, `,q.first_name,q.middle_name?` ${q.middle_name}`:``,q.ext_name?` ${q.ext_name}`:``]}),(0,w.jsx)(`button`,{type:`button`,onClick:async()=>{await yt(q.id),G(``),K([])},className:`text-destructive hover:text-destructive/80 text-sm leading-none`,"aria-label":`Remove household head`,children:`×`})]}):(0,w.jsxs)(`div`,{className:`relative`,children:[(0,w.jsx)(f,{value:W,onChange:e=>G(e.target.value),placeholder:`Type at least 3 letters to search...`,className:`h-8 text-xs`}),W.length>=3&&(0,w.jsx)(`div`,{className:`absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-lg`,children:Ue?(0,w.jsx)(`div`,{className:`px-3 py-2 text-xs text-muted-foreground`,children:`Searching...`}):He.length===0?(0,w.jsx)(`div`,{className:`px-3 py-2 text-xs text-muted-foreground`,children:`No matching residents found.`}):He.map(e=>(0,w.jsxs)(`button`,{type:`button`,onClick:()=>bt(e),className:`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground`,children:[(0,w.jsxs)(`span`,{className:`font-medium`,children:[e.last_name,`, `,e.first_name]}),e.middle_name&&(0,w.jsx)(`span`,{className:`text-muted-foreground`,children:e.middle_name}),e.ext_name&&(0,w.jsx)(`span`,{className:`text-muted-foreground`,children:e.ext_name})]},e.id))})]})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-household-name`,className:`text-xs`,children:`Household Head Name`}),(0,w.jsx)(f,{id:`panel-household-name`,value:D.household_name,onChange:e=>$(`household_name`,e.target.value),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-2`,children:[(0,w.jsx)(p,{htmlFor:`panel-monthly-income`,className:`text-xs`,children:`Monthly Income`}),(0,w.jsx)(f,{id:`panel-monthly-income`,type:`number`,min:0,value:D.monthly_income,onChange:e=>pt(`monthly_income`,e.target.value),className:`h-8 text-xs`})]})]}),(0,w.jsxs)(v,{icon:(0,w.jsx)(pe,{className:`size-4`}),title:`DILG / BIMS National Indicators`,defaultOpen:!1,children:[(0,w.jsx)(`p`,{className:`text-[10px] text-muted-foreground pb-1`,children:`Infrastructure and service indicators required under DILG MC No. 2025-104`}),(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-3`,children:[(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Water System`}),(0,w.jsxs)(`select`,{value:D.water_system,onChange:e=>$(`water_system`,e.target.value),className:`flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,children:[(0,w.jsx)(`option`,{value:``,children:`— Select —`}),(0,w.jsx)(`option`,{value:`Level I (Point Source)`,children:`Level I (Point Source)`}),(0,w.jsx)(`option`,{value:`Level II (Communal Faucet)`,children:`Level II (Communal Faucet)`}),(0,w.jsx)(`option`,{value:`Level III (Individual Connection)`,children:`Level III (Individual Connection)`}),(0,w.jsx)(`option`,{value:`Others`,children:`Others`})]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Waste Disposal`}),(0,w.jsxs)(`select`,{value:D.waste_disposal,onChange:e=>$(`waste_disposal`,e.target.value),className:`flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,children:[(0,w.jsx)(`option`,{value:``,children:`— Select —`}),(0,w.jsx)(`option`,{value:`Garbage Collection`,children:`Garbage Collection`}),(0,w.jsx)(`option`,{value:`Composting`,children:`Composting`}),(0,w.jsx)(`option`,{value:`Burning`,children:`Burning`}),(0,w.jsx)(`option`,{value:`Open Dumping`,children:`Open Dumping`}),(0,w.jsx)(`option`,{value:`Others`,children:`Others`})]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Power Supply`}),(0,w.jsxs)(`select`,{value:D.power_supply,onChange:e=>$(`power_supply`,e.target.value),className:`flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,children:[(0,w.jsx)(`option`,{value:``,children:`— Select —`}),(0,w.jsx)(`option`,{value:`Electric Connection`,children:`Electric Connection`}),(0,w.jsx)(`option`,{value:`Solar`,children:`Solar`}),(0,w.jsx)(`option`,{value:`Generator`,children:`Generator`}),(0,w.jsx)(`option`,{value:`None`,children:`None`}),(0,w.jsx)(`option`,{value:`Others`,children:`Others`})]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Toilet Type`}),(0,w.jsxs)(`select`,{value:D.toilet_type,onChange:e=>$(`toilet_type`,e.target.value),className:`flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,children:[(0,w.jsx)(`option`,{value:``,children:`— Select —`}),(0,w.jsx)(`option`,{value:`Water-Sealed`,children:`Water-Sealed`}),(0,w.jsx)(`option`,{value:`Antipolo`,children:`Antipolo`}),(0,w.jsx)(`option`,{value:`Pit Latrine`,children:`Pit Latrine`}),(0,w.jsx)(`option`,{value:`None`,children:`None`}),(0,w.jsx)(`option`,{value:`Others`,children:`Others`})]})]})]})]}),(0,w.jsxs)(v,{icon:(0,w.jsx)(ae,{className:`size-4`}),title:`Household Members (${j.length})`,defaultOpen:!0,children:[(0,w.jsxs)(`div`,{className:`flex items-center justify-between pb-1`,children:[(0,w.jsx)(`p`,{className:`text-[10px] text-muted-foreground`,children:`Manage household members and their relationships`}),!F&&(0,w.jsxs)(u,{type:`button`,variant:`ghost`,size:`sm`,onClick:()=>I(!0),className:`h-7 gap-1 text-xs`,children:[(0,w.jsx)(ne,{className:`size-3`}),`Add Member`]})]}),F&&(0,w.jsxs)(`div`,{className:`space-y-3 rounded-md border border-border/50 bg-muted/30 p-3`,children:[(0,w.jsxs)(`div`,{className:`space-y-1`,ref:Ve,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Search Resident *`}),(0,w.jsxs)(`div`,{className:`relative`,children:[(0,w.jsx)(f,{value:H?`${H.last_name}, ${H.first_name}`:z,onChange:e=>{B(e.target.value),H&&U(null)},onFocus:()=>{H&&(B(``),U(null))},placeholder:H?``:`Type at least 3 letters...`,className:`h-8 text-xs`}),H&&(0,w.jsx)(`button`,{type:`button`,onClick:()=>{U(null),B(``),V([])},className:`absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground leading-none`,"aria-label":`Clear`,children:`×`}),!H&&z.length>=3&&(0,w.jsx)(`div`,{className:`absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-lg`,children:ze?(0,w.jsx)(`div`,{className:`px-3 py-2 text-xs text-muted-foreground`,children:`Searching...`}):Re.length===0?(0,w.jsx)(`div`,{className:`px-3 py-2 text-xs text-muted-foreground`,children:`No matching residents found.`}):Re.map(e=>(0,w.jsxs)(`button`,{type:`button`,onClick:()=>U(e),className:`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground`,children:[(0,w.jsxs)(`span`,{className:`font-medium`,children:[e.last_name,`, `,e.first_name]}),e.middle_name&&(0,w.jsx)(`span`,{className:`text-muted-foreground`,children:e.middle_name}),e.ext_name&&(0,w.jsx)(`span`,{className:`text-muted-foreground`,children:e.ext_name})]},e.id))})]}),H&&(0,w.jsxs)(`p`,{className:`text-[10px] text-emerald-600 dark:text-emerald-400`,children:[`✓ Selected: `,H.last_name,`, `,H.first_name,H.middle_name?` ${H.middle_name}`:``,H.ext_name?` ${H.ext_name}`:``]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Relationship to Head *`}),(0,w.jsx)(xe,{options:ot,value:L.relationship_to_head,onChange:e=>R(t=>({...t,relationship_to_head:e})),placeholder:`Search relationship...`,className:`[&_input]:h-8 [&_input]:text-xs`})]}),(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Source of Income`}),(0,w.jsxs)(m,{value:L.source_of_income,onValueChange:e=>R(t=>({...t,source_of_income:e})),className:`h-8 text-xs`,children:[(0,w.jsx)(`option`,{value:``,children:`Select`}),rt.map(e=>(0,w.jsx)(`option`,{value:e.code??e.label,children:e.label},e.code??e.label))]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Monthly Income`}),(0,w.jsx)(f,{type:`number`,min:0,value:L.monthly_income,onChange:e=>R(t=>({...t,monthly_income:e.target.value===``?0:Number(e.target.value)})),className:`h-8 text-xs`})]})]}),(0,w.jsxs)(`div`,{className:`flex gap-2`,children:[(0,w.jsx)(u,{type:`button`,size:`sm`,onClick:vt,className:`h-7 text-xs`,children:`Add`}),(0,w.jsx)(u,{type:`button`,variant:`outline`,size:`sm`,onClick:()=>{I(!1),R(E()),U(null),B(``),V([])},className:`h-7 text-xs`,children:`Cancel`})]})]}),j.length>0&&(0,w.jsx)(`div`,{className:`space-y-1 max-h-48 overflow-y-auto`,children:j.map(e=>(0,w.jsxs)(`div`,{className:`flex items-center justify-between gap-1 rounded border border-border/50 p-2 text-xs`,children:[(0,w.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,w.jsxs)(`span`,{className:`font-medium text-foreground`,children:[e.last_name,`, `,e.first_name]}),e.middle_name&&(0,w.jsxs)(`span`,{className:`text-muted-foreground`,children:[` `,e.middle_name]}),e.ext_name&&(0,w.jsxs)(`span`,{className:`text-muted-foreground`,children:[` `,e.ext_name]}),(0,w.jsx)(`span`,{className:`ml-2 text-muted-foreground`,children:ct.get(e.relationship_to_head)??e.relationship_to_head})]}),(0,w.jsx)(`button`,{type:`button`,onClick:()=>yt(e.id),className:`shrink-0 text-destructive hover:text-destructive/80`,"aria-label":`Remove member`,children:`×`})]},e.id))})]}),k&&N.length>0&&(0,w.jsxs)(v,{icon:(0,w.jsx)(Ce,{className:`size-4`}),title:`Migrant Info (${N.length})`,defaultOpen:!0,children:[(0,w.jsxs)(`div`,{className:`flex items-center justify-between pb-1`,children:[(0,w.jsx)(`p`,{className:`text-[10px] text-muted-foreground`,children:`Track household migrant information`}),!Ke&&(0,w.jsxs)(u,{type:`button`,variant:`ghost`,size:`sm`,onClick:()=>qe(!0),className:`h-7 gap-1 text-xs`,children:[(0,w.jsx)(ne,{className:`size-3`}),`Add Migrant`]})]}),Ke&&(0,w.jsxs)(`div`,{className:`space-y-3 rounded-md border border-border/50 bg-muted/30 p-3`,children:[(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`First Name *`}),(0,w.jsx)(f,{value:J.first_name,onChange:e=>Y(t=>({...t,first_name:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Last Name *`}),(0,w.jsx)(f,{value:J.last_name,onChange:e=>Y(t=>({...t,last_name:e.target.value})),className:`h-8 text-xs`})]})]}),(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Middle Name`}),(0,w.jsx)(f,{value:J.middle_name,onChange:e=>Y(t=>({...t,middle_name:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Ext. Name`}),(0,w.jsx)(f,{value:J.ext_name,onChange:e=>Y(t=>({...t,ext_name:e.target.value})),className:`h-8 text-xs`})]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Previous Residence *`}),(0,w.jsx)(f,{value:J.previous_residence,onChange:e=>Y(t=>({...t,previous_residence:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`grid grid-cols-2 gap-2`,children:[(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Length of Stay (prev. barangay) *`}),(0,w.jsx)(f,{value:J.length_of_stay_previous_barangay,onChange:e=>Y(t=>({...t,length_of_stay_previous_barangay:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Date of Transfer *`}),(0,w.jsx)(f,{type:`date`,value:J.date_of_transfer,onChange:e=>Y(t=>({...t,date_of_transfer:e.target.value})),className:`h-8 text-xs`})]})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Reason for Leaving *`}),(0,w.jsx)(xe,{options:st,value:J.reason_for_leaving,onChange:e=>Y(t=>({...t,reason_for_leaving:e})),placeholder:`Search reason...`,className:`[&_input]:h-8 [&_input]:text-xs`})]}),J.reason_for_leaving===`16`&&(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Specify reason for leaving *`}),(0,w.jsx)(f,{value:J.reason_for_leaving_other,onChange:e=>Y(t=>({...t,reason_for_leaving_other:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Reason for Transferring *`}),(0,w.jsxs)(m,{value:J.reason_for_transferring,onValueChange:e=>Y(t=>({...t,reason_for_transferring:e})),className:`h-8 text-xs`,children:[(0,w.jsx)(`option`,{value:``,children:`Select`}),at.map(e=>(0,w.jsx)(`option`,{value:e.code??e.label,children:e.label},e.code??e.label))]})]}),J.reason_for_transferring===`5`&&(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Specify reason for transferring *`}),(0,w.jsx)(f,{value:J.reason_for_transferring_other,onChange:e=>Y(t=>({...t,reason_for_transferring_other:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`space-y-1`,children:[(0,w.jsx)(p,{className:`text-xs`,children:`Duration of Stay (current barangay) *`}),(0,w.jsx)(f,{value:J.duration_of_stay_current_barangay,onChange:e=>Y(t=>({...t,duration_of_stay_current_barangay:e.target.value})),className:`h-8 text-xs`})]}),(0,w.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,w.jsx)(`input`,{type:`checkbox`,id:`panel-intention-return`,checked:J.intention_to_return,onChange:e=>Y(t=>({...t,intention_to_return:e.target.checked})),className:`h-4 w-4 rounded border-input text-primary focus:ring-primary`}),(0,w.jsx)(p,{htmlFor:`panel-intention-return`,className:`text-xs cursor-pointer`,children:`Intention to return`})]}),(0,w.jsxs)(`div`,{className:`flex gap-2`,children:[(0,w.jsx)(u,{type:`button`,size:`sm`,onClick:xt,className:`h-7 text-xs`,children:`Add`}),(0,w.jsx)(u,{type:`button`,variant:`outline`,size:`sm`,onClick:()=>{qe(!1),Y(je())},className:`h-7 text-xs`,children:`Cancel`})]})]}),N.length>0&&(0,w.jsx)(`div`,{className:`space-y-1 max-h-48 overflow-y-auto`,children:N.map(e=>(0,w.jsxs)(`div`,{className:`flex items-center justify-between gap-1 rounded border border-border/50 p-2 text-xs`,children:[(0,w.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,w.jsxs)(`span`,{className:`font-medium text-foreground`,children:[e.last_name,`, `,e.first_name]}),(0,w.jsx)(`span`,{className:`ml-2 text-muted-foreground`,children:e.previous_residence})]}),(0,w.jsx)(`button`,{type:`button`,onClick:()=>St(e.id),className:`shrink-0 text-destructive hover:text-destructive/80`,"aria-label":`Remove migrant`,children:`×`})]},e.id))})]}),(0,w.jsxs)(`div`,{className:`flex gap-2 pt-2`,children:[(0,w.jsx)(u,{type:`submit`,children:k?`Update`:`Create`}),(0,w.jsx)(u,{type:`button`,variant:`outline`,onClick:mt,children:`Cancel`})]})]})]})]}),(0,w.jsx)(_e,{open:o!==null,onClose:Tt,title:o?`Household #${o.household_number}`:``,onEdit:kt&&o?()=>{gt(o),Tt()}:void 0,onDelete:kt&&o?()=>Ct(o.id):void 0,onExport:o?()=>Oe({household:o,members:S,migrants:T,relationshipLabels:ct,incomeLabels:lt,leavingLabels:ut}):void 0,loading:Pe,children:o&&(0,w.jsxs)(w.Fragment,{children:[(0,w.jsxs)(h,{icon:(0,w.jsx)(c,{className:`size-3`}),title:`Address`,children:[(0,w.jsx)(g,{label:`Region`,value:o.region||`—`}),(0,w.jsx)(g,{label:`Province`,value:o.province||`—`}),(0,w.jsx)(g,{label:`City/Municipality`,value:o.city_municipality||`—`}),(0,w.jsx)(g,{label:`Barangay`,value:o.barangay||`—`}),(0,w.jsx)(g,{label:`Sitio/Purok`,value:o.sitio_purok||`—`}),(0,w.jsx)(g,{label:`Complete Address`,value:o.household_complete_address||`—`})]}),(0,w.jsxs)(h,{icon:(0,w.jsx)(pe,{className:`size-3`}),title:`Classification`,children:[(0,w.jsx)(g,{label:`Household Type`,value:o.household_type||`—`}),(0,w.jsx)(g,{label:`Type (other)`,value:o.household_type_other||`—`}),(0,w.jsx)(g,{label:`Tenure Status`,value:o.tenure_status||`—`}),(0,w.jsx)(g,{label:`Tenure (other)`,value:o.tenure_status_other||`—`}),(0,w.jsx)(g,{label:`Household Unit`,value:o.household_unit||`—`}),(0,w.jsx)(g,{label:`Unit (other)`,value:o.household_unit_other||`—`})]}),(0,w.jsxs)(h,{icon:(0,w.jsx)(ae,{className:`size-3`}),title:`Demographics`,children:[(0,w.jsx)(g,{label:`Household Head`,value:o.household_name||`—`}),(0,w.jsx)(g,{label:`No. of Families`,value:o.no_of_families??`—`}),(0,w.jsx)(g,{label:`No. of Members`,value:o.no_of_household_members??`—`}),(0,w.jsx)(g,{label:`No. of Migrants`,value:o.no_of_migrants??`—`}),(0,w.jsx)(g,{label:`Monthly Income`,value:o.monthly_income==null?`—`:`PHP ${o.monthly_income.toLocaleString()}`})]}),(0,w.jsxs)(h,{icon:(0,w.jsx)(pe,{className:`size-3`}),title:`National Indicators (DILG/BIMS)`,children:[(0,w.jsx)(g,{label:`Water System`,value:o.water_system||`—`}),(0,w.jsx)(g,{label:`Waste Disposal`,value:o.waste_disposal||`—`}),(0,w.jsx)(g,{label:`Power Supply`,value:o.power_supply||`—`}),(0,w.jsx)(g,{label:`Toilet Type`,value:o.toilet_type||`—`})]}),(0,w.jsx)(h,{icon:(0,w.jsx)(ae,{className:`size-3`}),title:`Members (${S.length})`,children:S.length===0?(0,w.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`No members.`}):(0,w.jsx)(`div`,{className:`space-y-1 max-h-64 overflow-y-auto`,children:S.map(e=>(0,w.jsxs)(`div`,{className:`flex items-center justify-between gap-1 border-b border-border/30 pb-1 text-xs last:border-0`,children:[(0,w.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,w.jsxs)(`span`,{className:`font-medium text-foreground`,children:[e.last_name,`, `,e.first_name]}),e.middle_name&&(0,w.jsxs)(`span`,{className:`text-muted-foreground`,children:[` `,e.middle_name]}),(0,w.jsx)(`span`,{className:`ml-1.5 text-muted-foreground`,children:ct.get(e.relationship_to_head)??e.relationship_to_head})]}),(0,w.jsxs)(`span`,{className:`shrink-0 text-muted-foreground`,children:[e.source_of_income&&lt.get(e.source_of_income)&&(0,w.jsx)(`span`,{className:`mr-1`,children:lt.get(e.source_of_income)}),e.monthly_income!=null&&e.monthly_income>0&&(0,w.jsxs)(`span`,{className:`text-foreground`,children:[`PHP `,e.monthly_income.toLocaleString()]})]})]},e.id))})}),T.length>0&&(0,w.jsx)(h,{icon:(0,w.jsx)(Ce,{className:`size-3`}),title:`Migrants (${T.length})`,children:(0,w.jsx)(`div`,{className:`space-y-2 max-h-64 overflow-y-auto`,children:T.map(e=>(0,w.jsxs)(`div`,{className:`rounded border border-border/50 p-2 text-xs`,children:[(0,w.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,w.jsxs)(`span`,{className:`font-medium text-foreground`,children:[e.last_name,`, `,e.first_name]}),(0,w.jsx)(`span`,{className:a(`rounded px-1.5 py-0.5 text-[10px] font-medium`,e.intention_to_return?`bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`:`bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300`),children:e.intention_to_return?`Will return`:`No return`})]}),(0,w.jsxs)(`div`,{className:`mt-1 text-muted-foreground`,children:[(0,w.jsxs)(`div`,{children:[`Previous: `,e.previous_residence]}),(0,w.jsxs)(`div`,{children:[`Reason: `,ut.get(e.reason_for_leaving)??e.reason_for_leaving]}),(0,w.jsxs)(`div`,{children:[`Transferred: `,r(e.date_of_transfer)]}),(0,w.jsxs)(`div`,{children:[`Duration here: `,e.duration_of_stay_current_barangay]})]})]},e.id))})}),(0,w.jsxs)(h,{title:`Metadata`,children:[(0,w.jsx)(g,{label:`Created`,value:t(o.created)}),(0,w.jsx)(g,{label:`Updated`,value:t(o.updated)})]})]})}),(0,w.jsx)(fe,{open:Je!==null,title:`Delete household`,message:`This action cannot be undone. The household record will be permanently removed.`,confirmLabel:`Delete`,destructive:!0,onConfirm:wt,onCancel:()=>Ye(null)})]})}export{Ne as default};