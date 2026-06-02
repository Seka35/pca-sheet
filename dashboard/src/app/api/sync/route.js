import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req) {
  return new Promise((resolve) => {
    // Navigate to the root directory where sync.js is located
    const syncScriptPath = path.resolve(process.cwd(), '../sync.js');
    const rootDir = path.resolve(process.cwd(), '../');

    exec(`node ${syncScriptPath}`, { cwd: rootDir }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error running sync:', error);
        return resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
      }
      
      resolve(NextResponse.json({ success: true, message: 'Sync complete' }));
    });
  });
}
