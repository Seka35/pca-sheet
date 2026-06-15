"use client";

import { PERMISSIONS } from '@/lib/permissions';

const PERMISSION_LABELS = {
  [PERMISSIONS.READ_CLIENTS]: 'Read Clients',
  [PERMISSIONS.WRITE_CLIENTS]: 'Write Clients',
  [PERMISSIONS.READ_PAYMENTS]: 'Read Payments',
  [PERMISSIONS.WRITE_PAYMENTS]: 'Write Payments',
  [PERMISSIONS.READ_RENEWALS]: 'Read Renewals',
  [PERMISSIONS.WRITE_RENEWALS]: 'Write Renewals',
  [PERMISSIONS.CREATE_INVOICE]: 'Create Invoice',
  [PERMISSIONS.READ_APPROVALS]: 'Read Approvals',
  [PERMISSIONS.WRITE_APPROVALS]: 'Write Approvals',
  [PERMISSIONS.READ_BOT]: 'Read Bot',
  [PERMISSIONS.WRITE_BOT]: 'Write Bot',
  [PERMISSIONS.READ_BACKUP]: 'Read Backup',
  [PERMISSIONS.WRITE_BACKUP]: 'Write Backup',
  [PERMISSIONS.MANAGE_USERS]: 'Manage Users',
};

const PERMISSION_GROUPS = {
  'Clients': [PERMISSIONS.READ_CLIENTS, PERMISSIONS.WRITE_CLIENTS],
  'Payments': [PERMISSIONS.READ_PAYMENTS, PERMISSIONS.WRITE_PAYMENTS],
  'Renewals': [PERMISSIONS.READ_RENEWALS, PERMISSIONS.WRITE_RENEWALS],
  'Invoices': [PERMISSIONS.CREATE_INVOICE],
  'Approvals': [PERMISSIONS.READ_APPROVALS, PERMISSIONS.WRITE_APPROVALS],
  'Bot': [PERMISSIONS.READ_BOT, PERMISSIONS.WRITE_BOT],
  'Backup': [PERMISSIONS.READ_BACKUP, PERMISSIONS.WRITE_BACKUP],
  'Admin': [PERMISSIONS.MANAGE_USERS],
};

export default function PermissionCheckboxes({ permissions = [], onChange, disabled }) {
  const handleToggle = (permission) => {
    if (disabled) return;
    const newPerms = permissions.includes(permission)
      ? permissions.filter(p => p !== permission)
      : [...permissions, permission];
    onChange(newPerms);
  };

  const isChecked = (permission) => permissions.includes(permission);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
        <div key={group} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
            {group}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
            {perms.map(perm => (
              <label
                key={perm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked(perm)}
                  onChange={() => handleToggle(perm)}
                  disabled={disabled}
                  style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: '13px' }}>{PERMISSION_LABELS[perm]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
