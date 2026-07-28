import { NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPTS_PATH = join(process.cwd(), 'public/scripts/csvParser.js');

export async function POST(req) {
  try {
    const body = await req.json();
    const { newCode } = body;

    if (!newCode) {
      console.error('[apply-patch] ERROR: newCode is required');
      return NextResponse.json({ error: 'newCode is required' }, { status: 400 });
    }

    console.log('[apply-patch] Received patch, length:', newCode.length);
    console.log('[apply-patch] Patch preview (first 200):', newCode.slice(0, 200));

    if (!existsSync(SCRIPTS_PATH)) {
      console.error('[apply-patch] ERROR: csvParser.js does not exist at', SCRIPTS_PATH);
      return NextResponse.json({ error: 'csvParser.js not found' }, { status: 500 });
    }

    const existing = readFileSync(SCRIPTS_PATH, 'utf-8');
    console.log('[apply-patch] Existing file length:', existing.length);

    // Strategy: find the buildSimulatedClients function in both existing and patch
    // Replace ONLY that function in the existing file with the one from the patch
    // This preserves ALL other code (TIER_PRICING, SETUP_PRICING, parseAmount, normalizeClientName)

    // Match the buildSimulatedClients function in the existing file
    // Look for: function buildSimulatedClients(headers, rows, mapping) { ... }
    const existingFnMatch = existing.match(
      /(export\s+)?function\s+buildSimulatedClients\s*\([^)]*\)\s*\{/
    );

    if (!existingFnMatch) {
      console.error('[apply-patch] Could not find buildSimulatedClients in existing file');
      return NextResponse.json(
        { error: 'buildSimulatedClients function not found in existing script' },
        { status: 500 }
      );
    }

    console.log('[apply-patch] Found existing function at index:', existingFnMatch.index);

    // Now find the full function body in the patch
    // We need to extract the complete function from the patch
    const patchFnMatch = newCode.match(
      /function\s+buildSimulatedClients\s*\([^)]*\)\s*\{/
    );

    if (!patchFnMatch) {
      console.error('[apply-patch] Could not find buildSimulatedClients in patch');
      return NextResponse.json(
        { error: 'buildSimulatedClients function not found in patch' },
        { status: 400 }
      );
    }

    console.log('[apply-patch] Found patch function at index:', patchFnMatch.index);

    // Extract the function from the patch by finding matching braces
    let braceCount = 0;
    let fnStart = patchFnMatch.index;
    let inFn = false;
    let fnEnd = -1;

    for (let i = fnStart; i < newCode.length; i++) {
      if (newCode[i] === '{') {
        braceCount++;
        inFn = true;
      } else if (newCode[i] === '}') {
        braceCount--;
        if (inFn && braceCount === 0) {
          fnEnd = i + 1;
          break;
        }
      }
    }

    if (fnEnd === -1) {
      console.error('[apply-patch] Could not find end of patch function');
      return NextResponse.json(
        { error: 'Could not parse patch function body' },
        { status: 400 }
      );
    }

    const patchFn = newCode.slice(fnStart, fnEnd);
    console.log('[apply-patch] Extracted patch function, length:', patchFn.length);
    console.log('[apply-patch] Patch function preview:', patchFn.slice(0, 100));

    // Find the function start in existing file and replace its body
    const existingFnStart = existingFnMatch.index;
    const existingFnDeclEnd = existing.indexOf('{', existingFnMatch.index) + 1;

    // Find the end of the existing function
    braceCount = 0;
    let existingFnEnd = -1;
    for (let i = existingFnDeclEnd - 1; i < existing.length; i++) {
      if (existing[i] === '{') braceCount++;
      else if (existing[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          existingFnEnd = i + 1;
          break;
        }
      }
    }

    if (existingFnEnd === -1) {
      console.error('[apply-patch] Could not find end of existing function');
      return NextResponse.json(
        { error: 'Could not parse existing function body' },
        { status: 500 }
      );
    }

    // Build new file: everything before existing function + patch function + everything after
    const before = existing.slice(0, existingFnDeclEnd);
    const after = existing.slice(existingFnEnd);

    // Check if before ends with \n\n\n etc and after starts correctly
    const newFile = before + '\n' + patchFn.slice(patchFn.indexOf('{') + 1) + after.slice(1);

    console.log('[apply-patch] New file length:', newFile.length);

    // Validate: try to find all key elements
    const hasTierPricing = newFile.includes('TIER_PRICING');
    const hasSetupPricing = newFile.includes('SETUP_PRICING');
    const hasParseAmount = newFile.includes('function parseAmount');
    const hasNormalize = newFile.includes('function normalizeClientName');
    const hasBuildFn = newFile.includes('function buildSimulatedClients');

    console.log('[apply-patch] Validation - TIER_PRICING:', hasTierPricing);
    console.log('[apply-patch] Validation - SETUP_PRICING:', hasSetupPricing);
    console.log('[apply-patch] Validation - parseAmount:', hasParseAmount);
    console.log('[apply-patch] Validation - normalizeClientName:', hasNormalize);
    console.log('[apply-patch] Validation - buildSimulatedClients:', hasBuildFn);

    if (!hasTierPricing || !hasSetupPricing || !hasBuildFn) {
      console.error('[apply-patch] Validation FAILED - missing critical elements');
      return NextResponse.json(
        { error: 'Patch would break critical functions' },
        { status: 500 }
      );
    }

    writeFileSync(SCRIPTS_PATH, newFile, 'utf-8');
    console.log('[apply-patch] SUCCESS - file written');

    return NextResponse.json({
      applied: true,
      debug: {
        existingLength: existing.length,
        newLength: newFile.length,
        patchFnLength: patchFn.length,
      },
    });
  } catch (error) {
    console.error('[apply-patch] EXCEPTION:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply patch' },
      { status: 500 }
    );
  }
}
