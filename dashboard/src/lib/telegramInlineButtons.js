// Inline keyboards for the Telegram bot. Currently only the "create client"
// proposal flow uses one, but the format is centralised here so the 64-byte
// callback_data limit and the parse logic live in one place.
//
// Telegram's limit: callback_data must be ≤ 64 bytes. We only encode the
// action and the chat_id, which is well under the limit even for long
// supergroup IDs (~16 digits). If we ever need more payload, store the
// proposal in the DB and put just a `proposal_id` (UUID) in the callback.

const MAX_DATA = 64;

function buildCreateClientKeyboard(chatId) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Create this client', callback_data: `create_client:${chatId}` },
        { text: '❌ Cancel',              callback_data: `cancel_create:${chatId}` },
      ]],
    },
  };
}

// Returns { action: 'create' | 'cancel' | null, chatId: string | null }.
// `action` is null when the data doesn't match the expected format — the
// caller should answer the callback query and ignore the click.
function parseCallbackData(data) {
  if (typeof data !== 'string') return { action: null, chatId: null };
  if (data.length > MAX_DATA) return { action: null, chatId: null };
  const m = data.match(/^(create|cancel)_client:(-?\d{1,20})$/);
  if (!m) return { action: null, chatId: null };
  return {
    action: m[1] === 'create' ? 'create' : 'cancel',
    chatId: m[2],
  };
}

export { MAX_DATA, buildCreateClientKeyboard, parseCallbackData };
