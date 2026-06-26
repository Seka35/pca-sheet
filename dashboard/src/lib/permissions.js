// Shared permissions constants (client + server)

// Granular permissions — one per action per category
export const PERMISSIONS = {
  // Clients
  READ_CLIENTS:    'read_clients',
  CREATE_CLIENTS: 'create_clients',
  UPDATE_CLIENTS: 'update_clients',
  DELETE_CLIENTS: 'delete_clients',

  // Payments
  READ_PAYMENTS:    'read_payments',
  CREATE_PAYMENTS:  'create_payments',
  UPDATE_PAYMENTS:  'update_payments',
  DELETE_PAYMENTS:  'delete_payments',
  EXPORT_PAYMENTS:  'export_payments',

  // Renewals
  READ_RENEWALS:   'read_renewals',
  UPDATE_RENEWALS: 'update_renewals',

  // Approvals
  READ_APPROVALS:    'read_approvals',
  APPROVE_APPROVALS: 'approve_approvals',
  REJECT_APPROVALS:  'reject_approvals',

  // Bot Telegram
  READ_BOT:   'read_bot',
  UPDATE_BOT: 'update_bot',

  // Backup
  READ_BACKUP:    'read_backup',
  CREATE_BACKUP:  'create_backup',
  RESTORE_BACKUP: 'restore_backup',

  // Users (admin management)
  READ_USERS:    'read_users',
  CREATE_USERS:  'create_users',
  UPDATE_USERS:  'update_users',
  DELETE_USERS:  'delete_users',
};

// Role to permissions mapping
export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS), // All permissions

  admin: [
    PERMISSIONS.READ_CLIENTS,
    PERMISSIONS.CREATE_CLIENTS,
    PERMISSIONS.UPDATE_CLIENTS,
    PERMISSIONS.DELETE_CLIENTS,
    PERMISSIONS.READ_PAYMENTS,
    PERMISSIONS.CREATE_PAYMENTS,
    PERMISSIONS.UPDATE_PAYMENTS,
    PERMISSIONS.DELETE_PAYMENTS,
    PERMISSIONS.EXPORT_PAYMENTS,
    PERMISSIONS.READ_RENEWALS,
    PERMISSIONS.UPDATE_RENEWALS,
    PERMISSIONS.READ_APPROVALS,
    PERMISSIONS.APPROVE_APPROVALS,
    PERMISSIONS.REJECT_APPROVALS,
    PERMISSIONS.READ_BOT,
    PERMISSIONS.UPDATE_BOT,
    PERMISSIONS.READ_BACKUP,
    PERMISSIONS.CREATE_BACKUP,
    PERMISSIONS.RESTORE_BACKUP,
    // No user management for admin
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
    'create_invoice', // legacy — kept for backwards compat
  ],

  custom: null, // Uses explicit permissions array

  client: [
    PERMISSIONS.READ_CLIENTS,
    PERMISSIONS.READ_PAYMENTS,
    PERMISSIONS.READ_RENEWALS,
  ],
};

// Legacy permission aliases (for backwards compat with existing users)
export const LEGACY_PERMISSION_MAP = {
  'write_clients':   [PERMISSIONS.CREATE_CLIENTS, PERMISSIONS.UPDATE_CLIENTS],
  'write_payments':  [PERMISSIONS.CREATE_PAYMENTS, PERMISSIONS.UPDATE_PAYMENTS],
  'write_renewals':  [PERMISSIONS.UPDATE_RENEWALS],
  'write_approvals': [PERMISSIONS.APPROVE_APPROVALS, PERMISSIONS.REJECT_APPROVALS],
  'write_bot':       [PERMISSIONS.UPDATE_BOT],
  'write_backup':    [PERMISSIONS.CREATE_BACKUP, PERMISSIONS.RESTORE_BACKUP],
  'manage_users':    [PERMISSIONS.READ_USERS, PERMISSIONS.CREATE_USERS, PERMISSIONS.UPDATE_USERS, PERMISSIONS.DELETE_USERS],
};
