// PDF Invoice generation - spawns a child process to run Puppeteer
// This avoids Next.js webpack bundling issues with puppeteer

import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

export function generateInvoicePdfBuffer({ sr_no, client_name, bank_name, product_name, subtotal, discount, invoice_date, invoice_no }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'generateInvoicePdf.js');

    const child = spawn('node', [
      scriptPath,
      sr_no || '',
      client_name || '',
      bank_name || 'crypto',
      product_name || 'Service',
      String(subtotal || '0'),
      String(discount || '0'),
      invoice_date || new Date().toISOString().split('T')[0],
      invoice_no || '001'
    ], {
      cwd: process.cwd()
    });

    let stdout = [];
    let stderr = [];

    child.stdout.on('data', (data) => stdout.push(data));
    child.stderr.on('data', (data) => stderr.push(data));

    child.on('close', (code) => {
      if (code === 0) {
        const base64 = Buffer.concat(stdout).toString('utf8');
        resolve(Buffer.from(base64, 'base64'));
      } else {
        const error = Buffer.concat(stderr).toString('utf8');
        reject(new Error(error || `Process exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
