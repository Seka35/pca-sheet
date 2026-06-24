"use client";

import { PERMISSIONS } from '@/lib/permissions';

// SVG Icons matching sidebar style
const IconClients = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconPayments = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const IconRenewals = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0115-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 01-15 6.7L3 16" />
  </svg>
);

const IconApprovals = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const IconBot = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" />
    <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" />
  </svg>
);

const IconBackup = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconUsers = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const PERMISSION_LABELS = {
  [PERMISSIONS.READ_CLIENTS]:    'View',
  [PERMISSIONS.CREATE_CLIENTS]: 'Add',
  [PERMISSIONS.UPDATE_CLIENTS]: 'Edit',
  [PERMISSIONS.DELETE_CLIENTS]: 'Delete',
  [PERMISSIONS.READ_PAYMENTS]:    'View',
  [PERMISSIONS.CREATE_PAYMENTS]:  'Add',
  [PERMISSIONS.UPDATE_PAYMENTS]:  'Edit',
  [PERMISSIONS.DELETE_PAYMENTS]:  'Delete',
  [PERMISSIONS.EXPORT_PAYMENTS]:  'Export',
  [PERMISSIONS.READ_RENEWALS]:    'View',
  [PERMISSIONS.UPDATE_RENEWALS]:  'Edit',
  [PERMISSIONS.READ_APPROVALS]:    'View',
  [PERMISSIONS.APPROVE_APPROVALS]: 'Approve',
  [PERMISSIONS.REJECT_APPROVALS]:  'Reject',
  [PERMISSIONS.READ_BOT]:   'View',
  [PERMISSIONS.UPDATE_BOT]:  'Configure',
  [PERMISSIONS.READ_BACKUP]:    'View',
  [PERMISSIONS.CREATE_BACKUP]:  'Create',
  [PERMISSIONS.RESTORE_BACKUP]: 'Restore',
  [PERMISSIONS.READ_USERS]:    'View',
  [PERMISSIONS.CREATE_USERS]:  'Add',
  [PERMISSIONS.UPDATE_USERS]:  'Edit',
  [PERMISSIONS.DELETE_USERS]:  'Delete',
};

const PERMISSION_GROUPS = [
  {
    label: 'CLIENTS',
    Icon: IconClients,
    permissions: [
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.CREATE_CLIENTS,
      PERMISSIONS.UPDATE_CLIENTS,
      PERMISSIONS.DELETE_CLIENTS,
    ],
  },
  {
    label: 'PAYMENTS',
    Icon: IconPayments,
    permissions: [
      PERMISSIONS.READ_PAYMENTS,
      PERMISSIONS.CREATE_PAYMENTS,
      PERMISSIONS.UPDATE_PAYMENTS,
      PERMISSIONS.DELETE_PAYMENTS,
      PERMISSIONS.EXPORT_PAYMENTS,
    ],
  },
  {
    label: 'RENEWALS',
    Icon: IconRenewals,
    permissions: [
      PERMISSIONS.READ_RENEWALS,
      PERMISSIONS.UPDATE_RENEWALS,
    ],
  },
  {
    label: 'APPROVALS',
    Icon: IconApprovals,
    permissions: [
      PERMISSIONS.READ_APPROVALS,
      PERMISSIONS.APPROVE_APPROVALS,
      PERMISSIONS.REJECT_APPROVALS,
    ],
  },
  {
    label: 'BOT TELEGRAM',
    Icon: IconBot,
    permissions: [
      PERMISSIONS.READ_BOT,
      PERMISSIONS.UPDATE_BOT,
    ],
  },
  {
    label: 'BACKUP',
    Icon: IconBackup,
    permissions: [
      PERMISSIONS.READ_BACKUP,
      PERMISSIONS.CREATE_BACKUP,
      PERMISSIONS.RESTORE_BACKUP,
    ],
  },
  {
    label: 'USERS (Admin)',
    Icon: IconUsers,
    permissions: [
      PERMISSIONS.READ_USERS,
      PERMISSIONS.CREATE_USERS,
      PERMISSIONS.UPDATE_USERS,
      PERMISSIONS.DELETE_USERS,
    ],
  },
];

export default function PermissionCheckboxes({ permissions = [], onChange, disabled }) {
  const handleToggle = (permission) => {
    if (disabled) return;
    const newPerms = permissions.includes(permission)
      ? permissions.filter(p => p !== permission)
      : [...permissions, permission];
    onChange(newPerms);
  };

  const handleSelectAll = (groupPerms) => {
    if (disabled) return;
    const allSelected = groupPerms.every(p => permissions.includes(p));
    const newPerms = allSelected
      ? permissions.filter(p => !groupPerms.includes(p))
      : [...new Set([...permissions, ...groupPerms])];
    onChange(newPerms);
  };

  const isChecked = (permission) => permissions.includes(permission);
  const isGroupAllSelected = (groupPerms) => groupPerms.every(p => permissions.includes(p));
  const isGroupSomeSelected = (groupPerms) => groupPerms.some(p => permissions.includes(p)) && !groupPerms.every(p => permissions.includes(p));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <group.Icon size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {group.label}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectAll(group.permissions)}
              disabled={disabled}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: isGroupAllSelected(group.permissions) ? '#EF4444' : 'var(--primary-accent)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {isGroupAllSelected(group.permissions) ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {group.permissions.map(perm => (
              <label
                key={perm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: isChecked(perm) ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: `1px solid ${isChecked(perm) ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked(perm)}
                  onChange={() => handleToggle(perm)}
                  disabled={disabled}
                  style={{ display: 'none' }}
                />
                <span style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: `2px solid ${isChecked(perm) ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                  backgroundColor: isChecked(perm) ? 'var(--primary-accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isChecked(perm) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#0B111A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span style={{ fontSize: '13px', color: isChecked(perm) ? 'var(--primary-accent)' : 'var(--text-secondary)' }}>
                  {PERMISSION_LABELS[perm]}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
