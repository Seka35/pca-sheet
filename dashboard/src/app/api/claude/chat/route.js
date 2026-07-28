import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import https from 'https';

const CSVIMPORT_PATH = join(process.cwd(), 'src/lib/csvImport.js');

const conversations = new Map();

function getScript() {
  try {
    return readFileSync(CSVIMPORT_PATH, 'utf-8');
  } catch {
    return null;
  }
}

function patchScript(newCode) {
  try {
    writeFileSync(CSVIMPORT_PATH, newCode, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function callMiniMaxApi(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const baseURL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimax.io/v1';

    const data = JSON.stringify({
      model: 'MiniMax-M2.7',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : m.role,
          content: typeof m.content === 'string' ? m.content : m.content[0]?.text || ''
        }))
      ]
    });

    const url = new URL(baseURL + '/text/chatcompletion_v2');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const SYSTEM_PROMPT = `You are a concise CSV import expert. When the user describes a problem with the parsed CSV output:

1. Find the bug in buildSimulatedClients()
2. Explain it in 1-2 sentences
3. Give the EXACT code fix

Keep your response SHORT. Format code with \`\`\`javascript\\n...\`\`\`

Current csvImport.js has these key functions:
- parseCSV(file) → {headers, rows}
- buildSimiologicalClients(headers, rows, mapping) → client objects
- parseAmount(val) → number (handles "$10 000,00" format)
- normalizeClientName(name) → strips emoji/prefixes

Common fixes needed:
- Skip header/separator rows (rows where most cells match column names)
- Strip prefixes from ad ID numbers (remove "ID:", "BM ID:", etc.)
- Detect trial clients (is_trial = 1 when subscription = $0)
- Group products correctly by client name`;

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages, sessionId, csvRows, csvHeaders } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }

    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const history = conversations.get(sessionId);

    const currentScript = getScript() || '// Script not found';

    // Check for patch approval
    const lastMessage = messages[messages.length - 1];
    let patchResult = null;

    if (lastMessage && lastMessage.patchApproved && lastMessage.newCode) {
      const success = patchScript(lastMessage.newCode);
      patchResult = success ? { applied: true } : { applied: false, error: 'Failed to write script' };
    }

    // Build messages
    const apiMessages = [];
    for (const m of messages) {
      if (m.role === 'user') {
        let content = m.content;
        if (history.length === 0 && m.includeCsvContext && csvHeaders) {
          content += '\n\nCSV Headers: ' + JSON.stringify(csvHeaders);
          content += '\n\nFirst 3 data rows: ' + JSON.stringify((csvRows || []).slice(0, 3));
        }
        apiMessages.push({ role: 'user', content });
      } else {
        apiMessages.push({ role: 'assistant', content: m.content });
      }
    }

    // Update history
    for (const m of messages) {
      history.push({ role: m.role, content: m.content });
    }

    // Call API
    const response = await callMiniMaxApi(apiMessages, SYSTEM_PROMPT);

    // Extract response
    const text = response.choices?.[0]?.message?.content || '';
    history.push({ role: 'assistant', content: text });

    if (history.length > 40) {
      history.splice(0, history.length - 40);
    }

    // Extract patch from code blocks
    let proposedPatch = null;
    if (text.includes('```javascript')) {
      const match = text.match(/```javascript\n([\s\S]*?)```/);
      if (match) {
        proposedPatch = match[1].trim();
      }
    }

    return NextResponse.json({ text, proposedPatch, patchResult });
  } catch (error) {
    console.error('Claude chat error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to call Claude API' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId && conversations.has(sessionId)) {
      conversations.delete(sessionId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 });
  }
}
