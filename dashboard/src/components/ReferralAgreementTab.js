"use client";

import { useState, useEffect, useRef } from 'react';

export default function ReferralAgreementTab({ partner }) {
  const [formData, setFormData] = useState({
    agreement_date: new Date().toLocaleDateString('fr-FR'),
    partner_id: partner?.id || '',
    partner_name: partner?.name || '',
    partner_company: partner?.company_name || '',
    partner_nationality: partner?.nationality || '',
    partner_phone: partner?.phone || '',
    partner_email: partner?.email || '',
    partner_address: partner?.address || '',
    commission_rate: partner?.commission_percentage !== undefined ? String(partner.commission_percentage) : '10',
    company_sign_date: new Date().toLocaleDateString('fr-FR'),
    partner_sign_date: new Date().toLocaleDateString('fr-FR')
  });

  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(partner?.id || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    fetch('/api/referral-partners')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPartners(data);
          if (!selectedPartnerId && data.length > 0) {
            setSelectedPartnerId(data[0].id);
          }
        }
      })
      .catch(err => console.error('Error fetching partners:', err));
  }, []);

  useEffect(() => {
    if (selectedPartnerId) {
      setLoading(true);
      fetch(`/api/referral-partners/agreement?partner_id=${selectedPartnerId}`)
        .then(res => res.json())
        .then(data => {
          setFormData(prev => ({
            ...prev,
            ...data,
            partner_id: selectedPartnerId
          }));
          setPreviewKey(k => k + 1);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [selectedPartnerId]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      return next;
    });
    setPreviewKey(k => k + 1);
  };

  const handlePartnerSelect = (e) => {
    const id = e.target.value;
    setSelectedPartnerId(id);
  };

  const savePartnerDetails = async () => {
    setSaving(true);
    try {
      await fetch('/api/referral-partners/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch (err) {
      console.error('Error saving agreement info:', err);
    } finally {
      setSaving(false);
    }
  };

  const printDocument = () => {
    const params = new URLSearchParams({ ...formData, format: 'html' });
    const printWindow = window.open('/api/referral-partners/agreement?' + params.toString(), '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 300);
      };
    }
  };

  const queryParams = new URLSearchParams({ ...formData, format: 'html' }).toString();
  const previewSrc = `/api/referral-partners/agreement?${queryParams}`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', alignItems: 'start' }}>
      {/* Left: Form Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ padding: '24px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              📜 Referral Agreement Settings
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={printDocument}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--primary-accent)',
                  background: 'rgba(0, 242, 181, 0.08)',
                  color: 'var(--primary-accent)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🖨️ Print / Save PDF
              </button>
              <button
                onClick={savePartnerDetails}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-accent)',
                  color: '#0B111A',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Saving...' : 'Save Info'}
              </button>
            </div>
          </div>

          {/* Select Partner Dropdown */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
              Select Referral Partner
            </label>
            <select
              value={selectedPartnerId}
              onChange={handlePartnerSelect}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            >
              <option value="">-- Choose a partner --</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Agreement Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
              Agreement Date
            </label>
            <input
              type="text"
              value={formData.agreement_date}
              onChange={(e) => handleChange('agreement_date', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Partner Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Partner Information
            </h4>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Name / Representative</label>
              <input
                type="text"
                value={formData.partner_name}
                onChange={(e) => handleChange('partner_name', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                placeholder="e.g. Jean Dupont"
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Company Name (Optional)</label>
              <input
                type="text"
                value={formData.partner_company}
                onChange={(e) => handleChange('partner_company', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                placeholder="e.g. Dupont Digital Marketing FZ-LLC"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nationality</label>
                <input
                  type="text"
                  value={formData.partner_nationality}
                  onChange={(e) => handleChange('partner_nationality', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                  placeholder="e.g. French"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phone</label>
                <input
                  type="text"
                  value={formData.partner_phone}
                  onChange={(e) => handleChange('partner_phone', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                  placeholder="e.g. +33 6 12 34 56 78"
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
              <input
                type="email"
                value={formData.partner_email}
                onChange={(e) => handleChange('partner_email', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                placeholder="e.g. contact@dupont.com"
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Address</label>
              <input
                type="text"
                value={formData.partner_address}
                onChange={(e) => handleChange('partner_address', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                placeholder="e.g. 15 Ave des Champs-Elysées, Paris"
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Commission Rate (%)</label>
              <input
                type="number"
                value={formData.commission_rate}
                onChange={(e) => handleChange('commission_rate', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
              />
            </div>
          </div>

          {/* Signature Dates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Signatures & Dates
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Company Sign Date</label>
                <input
                  type="text"
                  value={formData.company_sign_date}
                  onChange={(e) => handleChange('company_sign_date', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Partner Sign Date</label>
                <input
                  type="text"
                  value={formData.partner_sign_date}
                  onChange={(e) => handleChange('partner_sign_date', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>

          {/* Docusign Integration Note */}
          <div style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#38BDF8', marginBottom: '4px' }}>
              🔗 E-Signature Link & Docusign (Prochaine étape)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Ce formulaire permet d'éditer et générer immédiatement l'accord en PDF. Le lien direct pour envoi au partenaire vers DocuSign / HelloSign ou plateforme de signature sera raccordé dès que la plateforme de signature sera choisie.
            </div>
          </div>
        </div>
      </div>

      {/* Right: Document Live Preview */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'sticky', top: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Agreement Document Preview</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>A4 Standard Format</span>
        </div>
        <div style={{ width: '100%', height: 'calc(100vh - 140px)', backgroundColor: '#334155', padding: '16px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.4)', width: '100%', maxWidth: '900px', backgroundColor: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
            <iframe
              key={previewKey}
              ref={iframeRef}
              src={previewSrc}
              style={{ width: '100%', height: '1200px', border: 'none', zoom: '0.7', transformOrigin: 'top center' }}
              title="Agreement Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
