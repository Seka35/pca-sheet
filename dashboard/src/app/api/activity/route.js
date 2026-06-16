import { NextResponse } from 'next/server';
import { all, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(request) {
  const auth = requirePermission(request, 'read_users');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const userId = searchParams.get('user_id');
  const action = searchParams.get('action');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const conditions = [];
  const params = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (from) {
    conditions.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('created_at <= ?');
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = get(`SELECT COUNT(*) as cnt FROM activity_logs ${where}`, params);
  const logs = all(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return NextResponse.json({
    logs: logs.map(l => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null,
    })),
    total: total?.cnt || 0,
  });
}
