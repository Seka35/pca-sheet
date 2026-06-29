import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';
import { get } from '@/lib/db';

export async function GET(req) {
  const user = getUserFromRequest(req);

  if (!user || user.role !== 'client') {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Get client data
  const client = get('SELECT * FROM clients WHERE id = ?', [user.client_id]);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Calculate tenure from earliest renewal start_date
  const earliestRenewal = get(`
    SELECT MIN(start_date) as earliest FROM renewals WHERE client_id = ? AND start_date IS NOT NULL AND start_date != ''
  `, [user.client_id]);

  let clientSince = null;
  if (earliestRenewal?.earliest) {
    const startDate = new Date(earliestRenewal.earliest);
    const now = new Date();
    const months = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    if (months < 1) {
      clientSince = 'New';
    } else if (months < 12) {
      clientSince = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      clientSince = `${years} year${years > 1 ? 's' : ''}${remainingMonths > 0 ? ` ${remainingMonths}m` : ''}`;
    }
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    client: {
      id: client.id,
      name: client.name,
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      address: client.address,
      telegram_group_id: client.telegram_group_id,
      tele_id: client.tele_id,
      status: client.status,
      trustpilot_reviewed: client.trustpilot_reviewed,
      contract_file_path: client.contract_file_path,
      client_since: clientSince,
    }
  });
}