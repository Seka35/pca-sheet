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

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'creatives');
    await mkdir(uploadDir, { recursive: true });

    // Generate safe filename: creative_{clientId}_{timestamp}_{originalName}
    const ext = path.extname(file.name);
    const safeName = `creative_${clientId}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    const publicPath = `/uploads/creatives/${safeName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Get existing creative_files JSON
    const currentFiles = existing.creative_files ? JSON.parse(existing.creative_files) : [];
    const updatedFiles = [...currentFiles, { path: publicPath, name: file.name, uploadedAt: new Date().toISOString() }];

    // Update DB with new creative file
    run('UPDATE clients SET creative_files = ? WHERE id = ?', [JSON.stringify(updatedFiles), clientId]);

    return NextResponse.json({ ok: true, path: publicPath, files: updatedFiles });
  } catch (error) {
    console.error('[POST /api/clients/[id]/creative]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
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

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');
    if (!filePath) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const existing = get('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Remove file from creative_files
    const currentFiles = existing.creative_files ? JSON.parse(existing.creative_files) : [];
    const updatedFiles = currentFiles.filter(f => f.path !== filePath);

    run('UPDATE clients SET creative_files = ? WHERE id = ?', [JSON.stringify(updatedFiles), clientId]);

    return NextResponse.json({ ok: true, files: updatedFiles });
  } catch (error) {
    console.error('[DELETE /api/clients/[id]/creative]', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
