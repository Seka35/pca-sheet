import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// GET - Retrieve contract data or HTML preview matching TEMPLATE_Referral_Agreement_PCS_v2_1_1.html exactly
export async function GET(req) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'custom' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get('partner_id');
  const format = searchParams.get('format'); // 'json' or 'html'

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, ' / ');

  let partnerData = {
    agreement_date: todayStr,
    partner_name: '',
    partner_company: '',
    partner_nationality: '',
    partner_phone: '',
    partner_email: '',
    partner_address: '',
    commission_rate: '10',
    company_sign_date: todayStr,
    partner_sign_date: todayStr
  };

  if (partnerId) {
    try {
      const partner = get('SELECT * FROM referral_partners WHERE id = ?', [partnerId]);
      if (partner) {
        partnerData.partner_name = partner.name || '';
        partnerData.partner_company = partner.company_name || '';
        partnerData.partner_nationality = partner.nationality || '';
        partnerData.partner_phone = partner.phone || '';
        partnerData.partner_email = partner.email || '';
        partnerData.partner_address = partner.address || '';
        partnerData.commission_rate = partner.commission_percentage !== undefined ? String(partner.commission_percentage) : '10';
      }
    } catch (e) {
      console.error('Error fetching partner for contract:', e);
    }
  }

  // Override with query parameters if present
  for (const [key, val] of searchParams.entries()) {
    if (key in partnerData && val) {
      partnerData[key] = val;
    }
  }

  if (format === 'html') {
    const html = generate3PageAgreementHtml(partnerData);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  return NextResponse.json(partnerData);
}

// POST - Update partner agreement contact info in DB
export async function POST(req) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { partner_id, partner_name, partner_company, partner_nationality, partner_phone, partner_email, partner_address, commission_rate } = body;

    if (partner_id) {
      run(
        `UPDATE referral_partners 
         SET name = ?, company_name = ?, nationality = ?, phone = ?, email = ?, address = ?, commission_percentage = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          partner_name || '',
          partner_company || '',
          partner_nationality || '',
          partner_phone || '',
          partner_email || '',
          partner_address || '',
          parseFloat(commission_rate) || 0,
          partner_id
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /api/referral-partners/agreement error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export function generate3PageAgreementHtml(data) {
  const defaultUnderline = '__________________';
  const agreementDate = data.agreement_date || '_________________________________';
  const partnerName = data.partner_name || defaultUnderline;
  const partnerCompany = data.partner_company || 'N/A';
  const partnerNationality = data.partner_nationality || defaultUnderline;
  const partnerPhone = data.partner_phone || defaultUnderline;
  const partnerEmail = data.partner_email || defaultUnderline;
  const partnerAddress = data.partner_address || defaultUnderline;
  const commissionRate = data.commission_rate || '10';
  const companySignDate = data.company_sign_date || defaultUnderline;
  const partnerSignDate = data.partner_sign_date || defaultUnderline;

  const getDynamicSpan = (val, isDefault = false) => {
    const isFilled = val && val !== defaultUnderline && val !== '_________________________________' && val !== 'N/A';
    return `<span class="dynamic-val ${isFilled ? 'filled' : ''}">${escapeHtml(val)}</span>`;
  };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Referral Partner Agreement | Prime Circle Structuring LLC</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,400&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary-navy: #1B2A4A;
      --accent-gold: #C8A84B;
      --text-dark: #1A1A1A;
      --text-muted: #555555;
      --border-color: #CBD5E1;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background-color: #0F172A;
      color: #1A1A1A;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
    }

    .a4-page {
      width: 210mm;
      min-height: 297mm;
      background-color: #FFFFFF;
      color: var(--text-dark);
      padding: 20mm 18mm 18mm 18mm;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      border-radius: 2px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 9.5pt;
      line-height: 1.45;
      margin-bottom: 24px;
    }

    .page-content { flex: 1; }

    .doc-top-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 8pt; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 18px;
    }

    .doc-top-header .left-title { font-weight: 700; color: var(--primary-navy); text-transform: uppercase; letter-spacing: 0.02em; }
    .doc-top-header .right-confidential { font-weight: 700; color: #64748B; letter-spacing: 0.05em; }

    .doc-title-block { text-align: center; margin-bottom: 22px; }
    .doc-main-title { font-size: 20pt; font-weight: 800; color: var(--primary-navy); letter-spacing: 0.04em; margin-bottom: 4px; text-transform: uppercase; }
    .doc-subtitle { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 11pt; color: var(--accent-gold); margin-bottom: 4px; }
    .doc-confidential-tag { font-size: 8.5pt; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 12px; }
    .doc-date-line { font-size: 10pt; font-weight: 600; color: var(--text-dark); margin-top: 8px; }

    .dynamic-val {
      color: #0F172A; font-weight: 600; border-bottom: 1px dashed var(--accent-gold); padding: 0 4px;
    }
    .dynamic-val.filled { border-bottom: none; }

    .contract-intro { margin-bottom: 16px; font-size: 9.5pt; }

    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .party-card { background-color: #FAFAFA; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; }
    .party-card-header { background-color: var(--primary-navy); color: #FFFFFF; font-size: 8.5pt; font-weight: 700; padding: 6px 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .party-card-body { padding: 10px 12px; font-size: 8.5pt; line-height: 1.5; }
    .party-card-body .company-name { font-size: 9.5pt; font-weight: 700; color: var(--primary-navy); margin-bottom: 4px; }
    .party-card-body .party-label { font-style: italic; color: var(--accent-gold); font-weight: 600; margin-top: 8px; display: block; }
    .party-row { display: flex; margin-bottom: 3px; }
    .party-row .label { font-weight: 600; width: 85px; color: #475569; flex-shrink: 0; }
    .party-row .val { font-weight: 500; color: #0F172A; word-break: break-word; }

    .parties-collective { text-align: center; font-style: italic; font-size: 9pt; color: var(--text-muted); margin-bottom: 20px; }

    .article-section { margin-bottom: 16px; }
    .article-title { font-size: 10pt; font-weight: 800; color: var(--primary-navy); margin-bottom: 6px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
    .article-title .art-num { color: var(--accent-gold); }
    .article-body { font-size: 9.5pt; text-align: justify; color: #1E293B; line-height: 1.45; }

    .article-list { list-style: none; padding-left: 14px; margin: 6px 0; }
    .article-list li { position: relative; padding-left: 14px; margin-bottom: 4px; font-size: 9.5pt; text-align: justify; }
    .article-list li::before { content: "•"; color: var(--primary-navy); font-weight: bold; font-size: 11pt; position: absolute; left: 0; top: -2px; }

    .sub-article-title { font-size: 9.5pt; font-weight: 700; color: var(--primary-navy); margin: 10px 0 4px 0; }

    .commission-box-table { width: 100%; border-collapse: collapse; margin: 14px 0; border: 1px solid #1E293B; }
    .commission-box-table td { width: 50%; vertical-align: top; padding: 10px 14px; border: 1px solid #1E293B; }
    .commission-box-table .box-title { font-weight: 700; font-size: 9.5pt; color: var(--primary-navy); margin-bottom: 6px; }
    .commission-box-table .box-default { font-size: 8.5pt; color: #475569; margin-bottom: 6px; }
    .commission-box-table .box-rate-highlight { font-size: 10.5pt; font-weight: 700; color: var(--accent-gold); }
    .commission-box-table .box-trigger-text { font-size: 8.5pt; color: #1E293B; line-height: 1.35; margin-bottom: 4px; }
    .commission-box-table .box-note { font-size: 8pt; font-style: italic; color: var(--text-muted); }

    .signatures-block { margin-top: 24px; }
    .signatures-title { font-size: 11pt; font-weight: 800; color: var(--primary-navy); text-transform: uppercase; margin-bottom: 4px; }
    .signatures-intro { font-size: 9pt; margin-bottom: 16px; }
    .signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .sig-column-title { font-size: 9.5pt; font-weight: 700; color: var(--primary-navy); margin-bottom: 8px; }
    .sig-field-row { font-size: 9pt; margin-bottom: 6px; display: flex; }
    .sig-field-row .label { font-weight: 600; width: 75px; color: #475569; }
    .sig-box-container { height: 60px; border-bottom: 1px solid #94A3B8; margin-top: 8px; }

    .doc-footer { border-top: 1px solid #E2E8F0; padding-top: 6px; text-align: center; font-size: 7.5pt; font-style: italic; color: #94A3B8; margin-top: auto; }

    @media print {
      @page { size: A4 portrait; margin: 0; }
      body { background-color: #FFFFFF !important; padding: 0 !important; }
      .a4-page {
        box-shadow: none !important; border-radius: 0 !important;
        width: 210mm !important; height: 296mm !important; margin: 0 !important;
        padding: 15mm 16mm 14mm 16mm !important; page-break-after: always !important;
        page-break-inside: avoid !important; box-sizing: border-box !important;
      }
      .dynamic-val { border-bottom: none !important; }
    }
  </style>
</head>
<body>

  <!-- PAGE 1 -->
  <div class="a4-page" id="page-1">
    <div class="page-content">
      <div class="doc-top-header">
        <span class="left-title">Prime Circle Structuring LLC - Referral Partner Agreement</span>
        <span class="right-confidential">CONFIDENTIAL</span>
      </div>

      <div class="doc-title-block">
        <h1 class="doc-main-title">REFERRAL PARTNER AGREEMENT</h1>
        <div class="doc-subtitle">Prime Circle Structuring LLC - Independent Referral Program</div>
        <div class="doc-confidential-tag">CONFIDENTIAL DOCUMENT</div>
        <div class="doc-date-line">
          Agreement Date : ${getDynamicSpan(agreementDate)}
        </div>
      </div>

      <p class="contract-intro">
        This Referral Partner Agreement (the "Agreement") is entered into between:
      </p>

      <div class="parties-grid">
        <div class="party-card">
          <div class="party-card-header">THE COMPANY</div>
          <div class="party-card-body">
            <div class="company-name">Prime Circle Structuring LLC</div>
            <div>Wyoming LLC - ID : 2025-001853063</div>
            <div>30 N Gould St, Ste R, Sheridan, WY 82801, USA</div>
            <div>contact@primecircle-banking.com</div>
            <span class="party-label">("the Company")</span>
          </div>
        </div>

        <div class="party-card">
          <div class="party-card-header">THE REFERRAL PARTNER</div>
          <div class="party-card-body">
            <div class="party-row"><span class="label">Full Name :</span><span class="val">${getDynamicSpan(partnerName)}</span></div>
            <div class="party-row"><span class="label">Company :</span><span class="val">${getDynamicSpan(partnerCompany)}</span></div>
            <div class="party-row"><span class="label">Nationality :</span><span class="val">${getDynamicSpan(partnerNationality)}</span></div>
            <div class="party-row"><span class="label">Address :</span><span class="val">${getDynamicSpan(partnerAddress)}</span></div>
            <div class="party-row"><span class="label">Email :</span><span class="val">${getDynamicSpan(partnerEmail)}</span></div>
            <div class="party-row"><span class="label">Phone :</span><span class="val">${getDynamicSpan(partnerPhone)}</span></div>
            <span class="party-label">("the Referral Partner")</span>
          </div>
        </div>
      </div>

      <div class="parties-collective">
        The Company and the Referral Partner are collectively referred to as the "Parties".
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">1.</span> PURPOSE</h2>
        <p class="article-body">
          The Company appoints the Referral Partner on a non-exclusive basis to refer potential clients to Prime Circle Structuring LLC's services, including US LLC formation, US bank account opening, ITIN applications, physical address delivery, and any other services offered by the Company. The Referral Partner acts as an independent intermediary and is not an employee, agent, or representative of the Company.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">2.</span> REFERRAL PROCESS</h2>
        <p class="article-body">The Referral Partner agrees to:</p>
        <ul class="article-list">
          <li>Introduce potential clients through the channels approved by the Company</li>
          <li>Collect and transmit all required client documents exclusively through the secure channels designated by the Company</li>
          <li>Ensure referred clients are informed of and consent to the services they subscribe to</li>
          <li>Provide accurate and truthful information about the Company's services</li>
        </ul>
        <p class="article-body" style="margin-top: 6px;">
          The Company reserves the right to accept or decline any referred client at its sole discretion.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">3.</span> COMMISSION</h2>
        <table class="commission-box-table">
          <tr>
            <td>
              <div class="box-default">Default : 10% of service amount collected</div>
              <div class="box-rate-highlight">
                Rate for this Agreement : ${getDynamicSpan(commissionRate)} %
              </div>
            </td>
            <td>
              <div class="box-title">Payment Trigger</div>
              <div class="box-trigger-text">
                One-time payment, after full collection from the referred client.
              </div>
              <div class="box-note">
                No commission on unpaid, cancelled or refunded transactions.
              </div>
            </td>
          </tr>
        </table>
        <p class="article-body">
          The commission is a one-time payment per referred client, calculated on the net amount effectively collected by the Company. No recurring commission is due regardless of any future purchases made by the referred client. Commission is paid within 30 days following full receipt of client payment, upon submission of an invoice by the Referral Partner. No commission is due on existing clients already registered with the Company.
        </p>
      </div>
    </div>
    <div class="doc-footer">
      Prime Circle Structuring LLC - Referral Partner Agreement Template - CONFIDENTIAL
    </div>
  </div>

  <!-- PAGE 2 -->
  <div class="a4-page" id="page-2">
    <div class="page-content">
      <div class="doc-top-header">
        <span class="left-title">Prime Circle Structuring LLC - Referral Partner Agreement</span>
        <span class="right-confidential">CONFIDENTIAL</span>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">4.</span> DATA HANDLING AND RESPONSIBILITY FOR CLIENT DOCUMENTS</h2>
        <p class="article-body" style="margin-bottom: 10px;">
          The Referral Partner assumes full and exclusive responsibility for any client data they collect, store, or transmit. Prime Circle Structuring LLC shall bear no liability whatsoever for any misuse, loss, or unauthorized disclosure of client information occurring prior to its receipt by the Company.
        </p>

        <div class="sub-article-title">4.1 Referral Partner's Sole Responsibility</div>
        <p class="article-body">
          The Referral Partner may collect sensitive personal information from referred clients, including passports, identity documents, proof of address, financial statements, and any other documentation required for the Company's services. The Referral Partner is solely and exclusively responsible for:
        </p>
        <ul class="article-list">
          <li>The lawful collection of client documents, with the client's full informed consent</li>
          <li>The secure storage of any client documents prior to transmission to the Company</li>
          <li>The secure transmission of client documents exclusively through the channels approved by the Company</li>
          <li>Any use, misuse, loss, theft, or unauthorized disclosure of client data occurring prior to its receipt by the Company</li>
          <li>Full compliance with all applicable data protection laws in the Referral Partner's jurisdiction</li>
        </ul>

        <div class="sub-article-title">4.2 Approved Transmission Channels</div>
        <p class="article-body">
          Client documents must be transmitted exclusively through the secure channels designated by the Company. Transmission via unencrypted channels, unauthorized third-party platforms, or non-approved messaging applications is strictly prohibited.
        </p>

        <div class="sub-article-title">4.3 Exoneration of Prime Circle Structuring LLC</div>
        <p class="article-body">
          Prime Circle Structuring LLC disclaims any and all liability for any loss, misuse, or breach of client data that occurs while such data is in the possession of the Referral Partner. The Referral Partner agrees to indemnify and hold harmless Prime Circle Structuring LLC from any claim or liability arising from a breach of data handling obligations under this Article.
        </p>

        <div class="sub-article-title">4.4 Data Retention</div>
        <p class="article-body">
          The Referral Partner shall not retain any copy of client documents beyond what is strictly necessary, and in any event must securely delete all copies upon confirmed receipt by the Company.
        </p>

        <div class="sub-article-title">4.5 Limitation of Prime Circle Structuring LLC's Responsibility to the Referred Service Only</div>
        <p class="article-body">
          The Company's responsibility is strictly limited to the service explicitly requested for each client individually referred by the Referral Partner. For each referred client, Prime Circle Structuring LLC undertakes solely to:
        </p>
        <ul class="article-list">
          <li>Receive and process the client's documents in connection with the specific service requested</li>
          <li>Connect the referred client with the relevant institution or authority required for that specific service (such as the Secretary of State, the IRS, a banking partner, or any other applicable third party)</li>
        </ul>
        <p class="article-body" style="margin-top: 6px;">
          The Company's engagement begins upon receipt of a referred client's documents and ends upon completion of the service for which the client was referred. The Company bears no responsibility whatsoever for any other dealings, services, or arrangements that the Referral Partner may have made with or on behalf of the same client, outside the scope of the referral.
        </p>
        <p class="article-body" style="margin-top: 6px;">
          Furthermore, the Company expressly disclaims any and all liability arising from:
        </p>
        <ul class="article-list">
          <li>Any subcontracting, sub-referral, or independent commercial activity carried out by the Referral Partner, whether in the Company's name or otherwise</li>
          <li>Any client acquired, approached, or engaged by the Referral Partner through their own channels, who has not been formally referred to and accepted by the Company under this Agreement</li>
        </ul>
      </div>
    </div>
    <div class="doc-footer">
      Prime Circle Structuring LLC - Referral Partner Agreement Template - CONFIDENTIAL
    </div>
  </div>

  <!-- PAGE 3 -->
  <div class="a4-page" id="page-3">
    <div class="page-content">
      <div class="doc-top-header">
        <span class="left-title">Prime Circle Structuring LLC - Referral Partner Agreement</span>
        <span class="right-confidential">CONFIDENTIAL</span>
      </div>

      <div class="article-section">
        <ul class="article-list" style="margin-bottom: 10px;">
          <li>Any representation, promise, or commitment made by the Referral Partner to any client or third party, beyond the scope of the services explicitly offered by Prime Circle Structuring LLC</li>
          <li>Any legal, financial, or reputational consequences arising from the Referral Partner's independent commercial activities, even where such activities reference or involve the Company's name, brand, or services</li>
        </ul>
        <p class="article-body">
          The Referral Partner agrees not to engage in any sub-referral arrangement, downstream partnership, or commercial activity involving third parties in connection with the Company's services, without the prior express written consent of the Company.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">5.</span> CONFIDENTIALITY</h2>
        <p class="article-body">
          The Referral Partner agrees to maintain strict confidentiality regarding the Company's commission rates, pricing, business processes, client information, and the terms of this Agreement. This obligation survives termination indefinitely.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">6.</span> INDEPENDENT STATUS</h2>
        <p class="article-body">
          The Referral Partner is an independent contractor. Nothing in this Agreement creates an employment, agency, or partnership relationship. The Referral Partner is solely responsible for their own taxes and legal obligations, and shall not make any representations on behalf of the Company without prior written authorization.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">7.</span> NON-SOLICITATION</h2>
        <p class="article-body">
          During the term of this Agreement and for 12 months following termination, the Referral Partner agrees not to directly solicit any referred client for competing services, or recruit any employee or contractor of the Company for competing activities.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">8.</span> TERM AND TERMINATION</h2>
        <p class="article-body">
          This Agreement continues indefinitely until terminated by either Party with 14 days written notice, or immediately by the Company in case of material breach. Pending commissions for already-referred clients whose payment has been received remain due upon termination.
        </p>
      </div>

      <div class="article-section">
        <h2 class="article-title"><span class="art-num">9.</span> LIABILITY AND GOVERNING LAW</h2>
        <p class="article-body">
          The Referral Partner is fully liable for damages resulting from breach of data handling obligations, misrepresentation of the Company's services, unauthorized use of the Company's brand, or breach of confidentiality. This Agreement is governed by the laws of the State of Wyoming, USA. Any unresolved dispute shall be submitted to binding arbitration under the rules of the American Arbitration Association (AAA).
        </p>
      </div>

      <div class="signatures-block">
        <h2 class="signatures-title">SIGNATURES</h2>
        <p class="signatures-intro">
          Both Parties acknowledge having read, understood, and accepted all terms of this Agreement, and in particular the data handling responsibilities set out in Article 4.
        </p>

        <div class="signatures-grid">
          <div>
            <div class="sig-column-title">For Prime Circle Structuring LLC</div>
            <div class="sig-field-row"><span class="label">Name :</span><span>Maxence Yves Eric Van Beneden</span></div>
            <div class="sig-field-row"><span class="label">Title :</span><span>Member / Manager</span></div>
            <div class="sig-field-row"><span class="label">Date :</span><span>${getDynamicSpan(companySignDate)}</span></div>
            <div class="sig-field-row" style="margin-top: 4px;"><span class="label">Signature :</span></div>
            <div class="sig-box-container"></div>
          </div>

          <div>
            <div class="sig-column-title">The Referral Partner</div>
            <div class="sig-field-row"><span class="label">Full Name :</span><span>${getDynamicSpan(partnerName)}</span></div>
            <div class="sig-field-row"><span class="label">Company :</span><span>${getDynamicSpan(partnerCompany)}</span></div>
            <div class="sig-field-row"><span class="label">Date :</span><span>${getDynamicSpan(partnerSignDate)}</span></div>
            <div class="sig-field-row" style="margin-top: 4px;"><span class="label">Signature :</span></div>
            <div class="sig-box-container"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="doc-footer">
      Prime Circle Structuring LLC - Referral Partner Agreement Template - CONFIDENTIAL
    </div>
  </div>

</body>
</html>`;
}
