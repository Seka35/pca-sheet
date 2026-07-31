"use client";

import { useState, useRef, useCallback } from 'react';
import { parseCSV, buildSimulatedClients, MAPPABLE_FIELDS, saveMapping, loadMapping, clearMapping, formatCurrency } from '@/lib/csvImport';
import SimulationClientModal from '@/components/SimulationClientModal';
import ClaudeChat from '@/components/admin/ClaudeChat';
import { useProducts } from '@/hooks/useProducts';

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({ currentStep }) {
  const steps = [
    { key: 'upload', label: '1. Upload CSV' },
    { key: 'mapping', label: '2. Map Columns' },
    { key: 'preview', label: '3. Preview & Simulate' },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
      {steps.map((s) => {
        const isActive = currentStep === s.key;
        const isPast = steps.findIndex((x) => x.key === currentStep) > steps.findIndex((x) => x.key === s.key);
        return (
          <div
            key={s.key}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: isActive ? 'var(--primary-accent)' : 'rgba(255,255,255,0.05)',
              color: isActive ? '#000' : isPast ? 'var(--primary-accent)' : 'var(--text-secondary)',
              border: isActive ? 'none' : '1px solid var(--border-color)',
            }}
          >
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File upload area with drag & drop
// ---------------------------------------------------------------------------
function FileUpload({ onFileSelected, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      onFileSelected(file);
    }
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelected(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--primary-accent)' : 'var(--border-color)'}`,
        borderRadius: '16px',
        padding: '64px 32px',
        textAlign: 'center',
        cursor: uploading ? 'not-allowed' : 'pointer',
        backgroundColor: dragging ? 'rgba(52, 211, 153, 0.05)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s',
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} style={{ display: 'none' }} />
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
      <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
        {uploading ? 'Processing...' : 'Drop your CSV file here'}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
        {uploading ? 'Please wait' : 'or click to browse • CSV files only'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column mapping row
// ---------------------------------------------------------------------------
function MappingRow({ csvHeader, dbField, onChange, index }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 48px 1fr',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          color: 'var(--text-primary)',
          backgroundColor: 'rgba(255,255,255,0.05)',
          padding: '8px 12px',
          borderRadius: '6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {csvHeader || (
          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>(empty column)</span>
        )}
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '18px' }}>→</div>

      <select
        value={dbField === null ? '' : dbField}
        onChange={(e) => onChange(index, e.target.value === '' ? null : e.target.value)}
        style={{
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 12px',
          color: dbField ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: '13px',
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <option value="">— Skip —</option>
        {MAPPABLE_FIELDS.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.required ? `* ${field.label}` : field.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column mapping screen
// ---------------------------------------------------------------------------
function ColumnMapping({ headers, mapping, onMappingChange, onBack, onImport, isClientNameMapped }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Map CSV Columns</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Match your CSV columns to database fields.{' '}
            <strong style={{ color: 'var(--primary-accent)' }}>client_name</strong> is required.
          </p>
        </div>
        <button
          onClick={() => {
            const saved = loadMapping();
            if (saved && saved.length === headers.length) {
              onMappingChange(saved);
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Load Saved Mapping
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 48px 1fr',
          gap: '0',
          padding: '0 16px',
          marginBottom: '8px',
          fontSize: '11px',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <div>Your CSV Column</div>
        <div></div>
        <div>Database Field</div>
      </div>

      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '8px 24px',
        }}
      >
        {headers.map((header, idx) => (
          <MappingRow
            key={idx}
            csvHeader={header}
            dbField={mapping[idx]}
            onChange={(colIdx, dbField) => {
              const next = [...mapping];
              next[colIdx] = dbField;
              onMappingChange(next);
            }}
            index={idx}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        {!isClientNameMapped && (
          <div style={{ color: '#FBBF24', fontSize: '13px', alignSelf: 'center', marginRight: 'auto' }}>
            ⚠️ client_name is required to group products into clients
          </div>
        )}
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={onImport}
          disabled={!isClientNameMapped}
          style={{
            padding: '12px 32px',
            backgroundColor: isClientNameMapped ? 'var(--primary-accent)' : 'rgba(255,255,255,0.05)',
            color: isClientNameMapped ? '#000' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: isClientNameMapped ? 'pointer' : 'not-allowed',
          }}
        >
          Parse & Preview →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  let color, bg;
  if (status === 'Active') {
    color = '#34D399';
    bg = 'rgba(16, 185, 129, 0.1)';
  } else if (status === 'Paused') {
    color = '#FBBF24';
    bg = 'rgba(245, 158, 11, 0.1)';
  } else {
    color = '#F87171';
    bg = 'rgba(239, 68, 68, 0.1)';
  }
  return (
    <span
      style={{
        color,
        backgroundColor: bg,
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: '600',
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Simulated client row (matches /clients page table style)
// ---------------------------------------------------------------------------
function SimulatedClientRow({ client, onClick }) {
  return (
    <tr
      onClick={onClick}
      style={{
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {client.hasIssues && (
            <span style={{ fontSize: '12px', color: '#EF4444' }} title={`${client.parsingIssues?.length || 0} anomalie(s) détectée(s)`}>⚠️</span>
          )}
          <span>{client.nom}</span>
        </div>
      </td>
      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
        {client.productDetails?.map((p, i) => (
          <span
            key={i}
            style={{
              marginRight: '4px',
              padding: '2px 8px',
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              color: '#34D399',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
            }}
          >
            {p.tier || p.setup_type}
          </span>
        ))}
      </td>
      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: 'var(--primary-accent)' }}>
        {formatCurrency(client.mensuel)}
      </td>
      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
        <StatusBadge status={client.statut} />
      </td>
      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{client.canal}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Simulation results table
// ---------------------------------------------------------------------------
function SimulationResults({ clients, onClientClick, onBack, onRemap }) {
  const clientsWithIssues = clients.filter(c => c.hasIssues || (c.parsingIssues && c.parsingIssues.length > 0));

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Red Alert Banner for Clients Requiring Human Review */}
      {clientsWithIssues.length > 0 && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <h4 style={{ color: '#F87171', fontSize: '15px', fontWeight: '700', margin: 0 }}>
              {clientsWithIssues.length} Client{clientsWithIssues.length > 1 ? 's nécessitent' : ' nécessite'} une révision humaine (incohérences / erreurs CSV)
            </h4>
          </div>
          <p style={{ color: '#FCA5A5', fontSize: '12px', margin: '0 0 12px 0', lineHeight: '1.5' }}>
            Ces clients contiennent des données incomplètes ou ambiguës (ex: nom manquant, date invalide, montant non spécifié). Veuillez vérifier les lignes dans votre CSV ou cliquer dessus pour les inspecter :
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {clientsWithIssues.map(client => (
              <div
                key={client.id}
                onClick={() => onClientClick(client)}
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: '700', color: '#FEE2E2', fontSize: '13px' }}>{client.nom}</span>
                  <span style={{ color: '#F87171', fontSize: '11px' }}>({client.produits})</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {client.parsingIssues.map((issue, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: issue.type === 'CRITICAL' ? '#EF4444' : '#DC2626',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {issue.field}: {issue.message}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '2px' }}>
            {clients.length} Client{clients.length !== 1 ? 's' : ''} Parsed
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Click any row to preview in ClientModal. This is a simulation — no data is saved.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: '#FBBF24',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
            }}
          >
            SIMULATION MODE
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={onRemap}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          ← Remap Columns
        </button>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Clear & Start Over
        </button>
      </div>

      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                Client Name
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                Products
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                Monthly CA
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                Channel
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}
                >
                  No clients parsed yet
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <SimulatedClientRow
                  key={client.id}
                  client={client}
                  onClick={() => onClientClick(client)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Phase 2 placeholder */}
      <div
        style={{
          marginTop: '32px',
          padding: '20px',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '16px' }}>🔜</span>
          <h4 style={{ fontSize: '14px', fontWeight: '600' }}>Phase 2: Real Import</h4>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          When ready, click below to import these clients into the database for real. This will create
          new client records and their associated product rows.
        </p>
        <button
          disabled
          title="Coming in Phase 2"
          style={{
            marginTop: '12px',
            padding: '10px 24px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            color: 'rgba(245, 158, 11, 0.5)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'not-allowed',
          }}
        >
          Import for Real (Phase 2)
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ImportTab component
// ---------------------------------------------------------------------------
export default function ImportTab() {
  const { tierProducts, setupProducts } = useProducts();

  const STEPS = { UPLOAD: 'upload', HEADER_ROW: 'header_row', MAPPING: 'mapping', PREVIEW: 'preview' };

  const [step, setStep] = useState(STEPS.UPLOAD);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [rawCsvRows, setRawCsvRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState([]);
  const [simulatedClients, setSimulatedClients] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSimulatedClient, setSelectedSimulatedClient] = useState(null);
  const [sessionId] = useState(() => `import_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  // Auto-detect column mapping
  const autoDetectMapping = useCallback((headers) => {
    const { autoDetectMapping: detect } = require('@/lib/csvImport');
    return detect(headers);
  }, []);

  const handleFileSelected = async (file) => {
    setUploading(true);
    setError('');
    try {
      // Parse without header inference — just get raw rows
      const { rows } = await parseCSV(file, 0);
      if (rows.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }
      setRawCsvRows(rows);
      setFileName(file.name);
      setStep(STEPS.HEADER_ROW);
    } catch (err) {
      setError(err.message || 'Failed to parse CSV');
    } finally {
      setUploading(false);
    }
  };

  const handleHeaderRowSelected = (headerRowIndex) => {
    const headerRow = rawCsvRows[headerRowIndex];
    const headers = headerRow.map((h) => String(h || '').trim());
    const rows = rawCsvRows.slice(headerRowIndex + 1);
    setCsvHeaders(headers);
    setCsvRows(rows);

    // Load saved mapping or auto-detect
    const saved = loadMapping();
    if (saved && saved.length === headers.length) {
      setMapping(saved);
    } else {
      const detected = autoDetectMapping(headers);
      setMapping(detected);
    }

    setStep(STEPS.MAPPING);
  };

  const handleMappingChange = (newMapping) => {
    setMapping(newMapping);
  };

  const handleImport = async () => {
    const sparseMapping = {};
    mapping.forEach((dbField, csvColIdx) => {
      if (dbField !== null) {
        sparseMapping[dbField] = csvColIdx;
      }
    });

    try {
      // Fetch the dynamic script (not bundled by webpack) — no-cache to avoid stale script after patch
      const res = await fetch('/scripts/csvParser.js?t=' + Date.now(), { cache: 'no-store' });
      const scriptCode = await res.text();

      // Build helper functions that the script needs
      const helpers = `
        function parseAmount(val) {
          if (!val || val === '-' || val.toString().trim() === '-') return 0;
          let str = val.toString().trim();
          let cleaned = str.replace(/[^0-9.,\-]/g, '');
          if (!cleaned) return 0;
          if (cleaned.includes(',') && cleaned.includes('.')) {
            if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
              cleaned = cleaned.replace(/,/g, '');
            } else {
              cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            }
          } else if (cleaned.includes(',')) {
            if (/,\d{1,2}$/.test(cleaned)) {
              cleaned = cleaned.replace(',', '.');
            } else {
              cleaned = cleaned.replace(/,/g, '');
            }
          }
          return parseFloat(cleaned) || 0;
        }
        function normalizeClientName(name) {
          return (name || '').replace(/^[🟢🔴🟡⚠️📌]+\s*/g, '').replace(/^\[DC\]\s*/gi, '').replace(/\s*:\s*Tele\s+\d+\s*$/g, '').replace(/\s*X\s+Prime\s+circle\s*$/gi, '').trim();
        }
      `;

      // Create executable function
      const fullCode = helpers + scriptCode;
      const fn = new Function('headers', 'rows', 'mapping', fullCode + '\nreturn buildSimulatedClients(headers, rows, mapping);');
      const clients = fn(csvHeaders, csvRows, sparseMapping);
      console.log('[ImportTab] Using csvParser.js script — client count:', clients.length);
      setSimulatedClients(clients);
    } catch (e) {
      console.error('Dynamic parse error:', e);
      console.warn('[ImportTab] USING FALLBACK — csvParser.js fetch failed, using bundled buildSimulatedClients');
      // Fallback to bundled function
      const clients = buildSimulatedClients(csvHeaders, csvRows, sparseMapping);
      setSimulatedClients(clients);
    }

    saveMapping(mapping);
    setStep(STEPS.PREVIEW);
  };

  const handleReset = () => {
    setStep(STEPS.UPLOAD);
    setCsvHeaders([]);
    setCsvRows([]);
    setFileName('');
    setMapping([]);
    setSimulatedClients([]);
    setError('');
    clearMapping();
  };

  const openModal = (client) => {
    setSelectedSimulatedClient(client);
  };

  const closeModal = () => {
    setSelectedSimulatedClient(null);
  };

  const handlePatchApplied = () => {
    // Re-run import to parse with the updated script
    if (csvHeaders.length > 0 && csvRows.length > 0) {
      handleImport();
    }
  };

  const isClientNameMapped = mapping.some((m) => m === 'client_name');

  return (
    <div>
      <StepIndicator currentStep={step} />

      {error && (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            marginBottom: '24px',
            color: '#EF4444',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* STEP 1b: Choose Header Row */}
      {step === STEPS.HEADER_ROW && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Select Header Row</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Which row contains the column names? The previous row(s) will be skipped.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            {rawCsvRows.slice(0, 5).map((row, idx) => (
              <button
                key={idx}
                onClick={() => handleHeaderRowSelected(idx)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Row {idx + 1}
              </button>
            ))}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              Preview — click a row number above to use it as headers
            </div>
            {rawCsvRows.slice(0, 5).map((row, rowIdx) => (
              <div
                key={rowIdx}
                style={{
                  padding: '10px 16px',
                  borderBottom: rowIdx < 4 ? '1px solid var(--border-color)' : 'none',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', minWidth: '40px' }}>Row {rowIdx + 1}:</span>
                <span style={{ color: 'var(--text-primary)' }}>{row.map((c) => String(c || '').trim()).join(' | ')}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(STEPS.UPLOAD)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        </div>
      )}
      {step === STEPS.UPLOAD && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Import Clients from CSV</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Upload a CSV file with your client data. The file is parsed in your browser — no data is sent to
              any external server.
            </p>
          </div>

          <FileUpload onFileSelected={handleFileSelected} uploading={uploading} />

          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>CSV Format Guide</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              Your CSV should have one row per client product. Multiple rows with the same{' '}
              <code
                style={{
                  fontFamily: 'monospace',
                  color: 'var(--primary-accent)',
                }}
              >
                client_name
              </code>{' '}
              will be grouped into a single client with multiple products.
            </p>
            <div
              style={{
                marginTop: '12px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
              }}
            >
              client_name, tier, setup_type, month, subscription_fee, setup_fee, bank_name, amount_received, ...
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {step === STEPS.MAPPING && (
        <ColumnMapping
          headers={csvHeaders}
          mapping={mapping}
          onMappingChange={handleMappingChange}
          onBack={() => setStep(STEPS.UPLOAD)}
          onImport={handleImport}
          isClientNameMapped={isClientNameMapped}
        />
      )}

      {/* STEP 3: Preview */}
      {step === STEPS.PREVIEW && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Simulation Preview</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Review parsed clients. Click any row to open the full ClientModal. Use the chat to refine the script.
              </p>
            </div>
          </div>

          {/* Split view: table + chat */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 520px',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {/* Left: simulation results */}
            <div>
              <SimulationResults
                clients={simulatedClients}
                onClientClick={openModal}
                onBack={handleReset}
                onRemap={() => setStep(STEPS.MAPPING)}
              />
            </div>

            {/* Right: Claude chat */}
            <div style={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 200px)' }}>
              <ClaudeChat
                csvHeaders={csvHeaders}
                csvRows={csvRows}
                sessionId={sessionId}
                onPatchApplied={handlePatchApplied}
              />
            </div>
          </div>
        </div>
      )}

      {/* Simulation ClientModal */}
      {selectedSimulatedClient && (
        <SimulationClientModal
          selectedClient={selectedSimulatedClient}
          onClose={closeModal}
          onSaved={() => {}}
          tierProducts={tierProducts}
          setupProducts={setupProducts}
        />
      )}
    </div>
  );
}
