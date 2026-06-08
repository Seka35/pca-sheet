#!/usr/bin/env node
// Standalone script to generate PDF from HTML invoice
// This runs outside Next.js webpack context

const puppeteer = require('puppeteer');
const path = require('path');

async function generatePdf(sr_no, client_name, bank_name, product_name, subtotal, discount, invoice_date, invoice_no) {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // Set viewport to match the invoice page width
    await page.setViewport({ width: 985, height: 1400, deviceScaleFactor: 2 });

    const params = new URLSearchParams({
      sr_no: sr_no || '',
      client_id: '',
      client_name: client_name || '',
      bank_name: bank_name || 'crypto',
      product_name: product_name || 'Service',
      subtotal: subtotal || '0',
      discount: discount || '0',
      invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      invoice_no: invoice_no || '001'
    });

    const invoiceUrl = `http://localhost:3000/api/invoice/generate?${params.toString()}`;
    console.error('Loading URL:', invoiceUrl);
    await page.goto(invoiceUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    // Wait for content to fully render
    await page.waitForSelector('.page', { timeout: 10000 }).catch(() => {});
    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args.length >= 7) {
  const [sr_no, client_name, bank_name, product_name, subtotal, discount, invoice_date, invoice_no] = args;
  generatePdf(sr_no, client_name, bank_name, product_name, subtotal, discount, invoice_date, invoice_no)
    .then(buf => {
      process.stdout.write(buf.toString('base64'));
      process.exit(0);
    })
    .catch(e => {
      console.error(e.message);
      process.exit(1);
    });
} else {
  console.error('Usage: generateInvoicePdf.js <sr_no> <client_name> <bank_name> <product_name> <subtotal> <discount> <invoice_date> <invoice_no>');
  process.exit(1);
}