import { NextResponse } from 'next/server';
import { all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// GET /api/admin/clients - List clients that have login accounts (role='client')
export async function GET(req) {
  const auth = requirePermission(req, 'read_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Get all users with role='client' and their associated client info
    const clientUsers = all(`
      SELECT u.id as user_id, u.username, u.role, u.created_at as login_created,
             c.id as client_id, c.name, c.status, c.telegram_group_id, c.tele_id
      FROM users u
      LEFT JOIN clients c ON u.client_id = c.id
      WHERE u.role = 'client'
      ORDER BY c.name ASC
    `);

    const formattedClients = clientUsers.map(row => ({
      user_id: row.user_id,
      username: row.username,
      client_id: row.client_id,
      name: row.name || row.username,
      status: row.status === 'Actif' ? 'Active' : 'Inactive',
      telegram_group_id: row.telegram_group_id,
      tele_id: row.tele_id,
      login_created: row.login_created,
    }));

    return NextResponse.json(formattedClients);
  } catch (error) {
    console.error('[GET /api/admin/clients]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}