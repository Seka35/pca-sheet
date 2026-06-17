import { NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const clientId = parseInt(id, 10);
    if (!Number.isInteger(clientId) || clientId < 1) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const existing = get('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'contracts');
    await mkdir(uploadDir, { recursive: true });

    // Generate safe filename: contract_{clientId}_{timestamp}_{originalName}
    const ext = path.extname(file.name);
    const safeName = `contract_${clientId}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    const publicPath = `/uploads/contracts/${safeName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Update DB with file path
    run('UPDATE clients SET contract_file_path = ? WHERE id = ?', [publicPath, clientId]);

    return NextResponse.json({ ok: true, path: publicPath });
  } catch (error) {
    console.error('[POST /api/clients/[id]/contract]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
