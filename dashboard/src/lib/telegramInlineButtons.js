// Inline keyboards for the Telegram bot. Currently only the "create client"
// proposal flow uses one, but the format is centralised here so the 64-byte
// callback_data limit and the parse logic live in one place.
//
// Telegram's limit: callback_data must be ≤ 64 bytes. We only encode the
// action and the chat_id, which is well under the limit even for long
// supergroup IDs (~16 digits). If we ever need more payload, store the
// proposal in the DB and put just a `proposal_id` (UUID) in the callback.

const MAX_DATA = 64;

// ─── Client creation ──────────────────────────────────────────────────────────

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

// ─── Payment reminder buttons ─────────────────────────────────────────────────
// sr_no and chat_id are stored in callback_data so we can identify the renewal
// when the user clicks from the group chat.

function buildPaymentReminderKeyboard(srNo, chatId) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '🔔 Remind Later',  callback_data: `remind_later:${srNo}:${chatId}` },
        { text: '💳 Pay Now',      callback_data: `pay_now:${srNo}:${chatId}` },
      ]],
    },
  };
}

// Build keyboard for payment method selection (shown after clicking Pay Now)
function buildPaymentMethodKeyboard(srNo, chatId, bankKey) {
  const row = (label, method) => [{ text: label, callback_data: `select_payment:${srNo}:${chatId}:${method}` }];

  if (bankKey === 'crypto') {
    return {
      reply_markup: {
        inline_keyboard: [
          row('🟡 USDT (TRC20)', 'usdt_trc20'),
          row('🔵 USDT (ERC20)', 'usdt_erc20'),
          row('🟠 Bitcoin (BTC)', 'btc'),
        ],
      },
    };
  }
  if (bankKey === 'lhv') {
    return {
      reply_markup: {
        inline_keyboard: [row('🏦 Bank Transfer (SEPA/IBAN)', 'lhv')],
      },
    };
  }
  if (bankKey === 'slash') {
    return {
      reply_markup: {
        inline_keyboard: [row('🏦 Bank Transfer (US)', 'slash')],
      },
    };
  }
  if (bankKey === 'whop') {
    return {
      reply_markup: {
        inline_keyboard: [row('🌐 WHOP Subscription', 'whop')],
      },
    };
  }
  // Default fallback
  return {
    reply_markup: {
      inline_keyboard: [row('💳 Pay Now', 'default')],
    },
  };
}

// Build keyboard shown on the payment details message with Cancel + Already Paid
function buildPaymentDetailsKeyboard(srNo, chatId) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '❌ Cancel',      callback_data: `cancel_payment:${srNo}:${chatId}` },
        { text: '✅ Already Paid', callback_data: `already_paid:${srNo}:${chatId}` },
      ]],
    },
  };
}

// Returns { action, srNo, chatId, method? } or null.
// Actions: 'create' | 'cancel' | 'remind_later' | 'pay_now' | 'select_payment' | 'cancel_payment' | 'already_paid'
function parseCallbackData(data) {
  if (typeof data !== 'string') return { action: null, srNo: null, chatId: null, method: null };
  if (data.length > MAX_DATA) return { action: null, srNo: null, chatId: null, method: null };

  // create_client:<chatId>
  const m1 = data.match(/^(create|cancel)_client:(-?\d{1,20})$/);
  if (m1) return { action: m1[1] === 'create' ? 'create' : 'cancel', srNo: null, chatId: m1[2], method: null };

  // pay_now / remind_later / cancel_payment / already_paid : <sr_no> : <chat_id>
  const m2 = data.match(/^(pay_now|remind_later|cancel_payment|already_paid):(.+?):(-?\d{1,20})$/);
  if (m2) return { action: m2[1], srNo: m2[2], chatId: m2[3], method: null };

  // select_payment : <sr_no> : <chat_id> : <method>
  const m3 = data.match(/^select_payment:(.+?):(-?\d{1,20}):(\w+)$/);
  if (m3) return { action: 'select_payment', srNo: m3[1], chatId: m3[2], method: m3[3] };

  return { action: null, srNo: null, chatId: null, method: null };
}

export { MAX_DATA, buildCreateClientKeyboard, buildPaymentReminderKeyboard, buildPaymentMethodKeyboard, buildPaymentDetailsKeyboard, parseCallbackData };
