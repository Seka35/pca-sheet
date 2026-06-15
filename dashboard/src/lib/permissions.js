// Shared permissions constants (client + server)

export const PERMISSIONS = {
  READ_CLIENTS: 'read_clients',
  WRITE_CLIENTS: 'write_clients',
  READ_PAYMENTS: 'read_payments',
  WRITE_PAYMENTS: 'write_payments',
  READ_RENEWALS: 'read_renewals',
  WRITE_RENEWALS: 'write_renewals',
  CREATE_INVOICE: 'create_invoice',
  READ_APPROVALS: 'read_approvals',
  WRITE_APPROVALS: 'write_approvals',
  READ_BOT: 'read_bot',
  WRITE_BOT: 'write_bot',
  READ_BACKUP: 'read_backup',
  WRITE_BACKUP: 'write_backup',
  MANAGE_USERS: 'manage_users',
};

// Role to permissions mapping
export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS), // All permissions
  admin: [
    PERMISSIONS.READ_CLIENTS,
    PERMISSIONS.WRITE_CLIENTS,
    PERMISSIONS.READ_PAYMENTS,
    PERMISSIONS.WRITE_PAYMENTS,
    PERMISSIONS.READ_RENEWALS,
    PERMISSIONS.WRITE_RENEWALS,
    PERMISSIONS.CREATE_INVOICE,
    PERMISSIONS.READ_APPROVALS,
    PERMISSIONS.WRITE_APPROVALS,
    PERMISSIONS.READ_BOT,
    PERMISSIONS.WRITE_BOT,
    PERMISSIONS.READ_BACKUP,
    PERMISSIONS.WRITE_BACKUP,
    // NOT manage_users
  ],
  read_only: [
    PERMISSIONS.READ_CLIENTS,
    PERMISSIONS.READ_PAYMENTS,
    PERMISSIONS.READ_RENEWALS,
    PERMISSIONS.READ_APPROVALS,
    PERMISSIONS.READ_BOT,
    PERMISSIONS.READ_BACKUP,
  ],
  invoice_only: [
    PERMISSIONS.READ_CLIENTS,
    PERMISSIONS.READ_PAYMENTS,
    PERMISSIONS.READ_RENEWALS,
    PERMISSIONS.CREATE_INVOICE,
  ],
  custom: null, // Uses explicit permissions array
};
