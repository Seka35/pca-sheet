# CSV to Database Import Guide

## Overview

This document explains how to map your Google Sheets CSV columns to the SQLite database schema so you can bulk-import client and payment data.

**Database:** SQLite at `dashboard/src/lib/pca_renew.db`
**Key Entities to Populate:** `clients`, `renewals`, `payments`, `payment_history`, `client_products`

---

## Entity Relationship Diagram

```
clients (1) ──── (N) renewals (sr_no)
                       │
                       ├── (N) payments
                       ├── (N) whop_product_payments
                       ├── (N) payment_transactions
                       └── (N) upgrade_requests

clients (1) ──── (N) client_products
                       │
                       └── (N) payment_history
```

---

## Primary Key Strategy

Your CSV's **`Sr No.`** column is the master key that links everything.

Format examples: `92-A`, `92.01-A`, `92.02-A`, `272,01`, `272,02`, etc.

- **`Sr No.`** → `renewals.sr_no` (PRIMARY KEY)
- A single client can have multiple rows (one per subscription period, identified by different sub-numbers like `92.01-A`, `92.02-A`, etc.)

---

## Column Mapping

### 1. `clients` table

Populated **once per unique client** (deduplicated by client name or tele_id).

| CSV Column | DB Column | Notes |
|---|---|---|
| `Client Name` | `name` | Strip emoji prefix (🟢, 🔴, etc.) |
| `Client Status` | `status` | Client-level status (rarely used) |
| `Referral Partner Name` | `referral_partner_name` | e.g. "N.A.", "Chris" |
| `Notes` | `notes` | General notes |
| — | `id` | Auto-generated INTEGER PRIMARY KEY |
| — | `telegram_group_id` | Not in CSV — leave blank |
| — | `email` | Not in CSV — leave blank |

**Deduplication rule:** Group rows by the **base client name** (strip tier/product suffixes like `: Tele 92`, `X Prime circle`, emoji, etc.). One `clients` row per unique base name.

**Example normalization:**
```
"Tyler farrington X Prime circle: Tele 92" → "Tyler farrington"
"[DC]🟢Mar Besso x Prime circle : Tele 272" → "Mar Besso"
```

---

### 2. `renewals` table

This is the **main product subscription table** — one row per Sr No. in your CSV.

| CSV Column | DB Column | Notes |
|---|---|---|
| `Sr No.` | `sr_no` | PRIMARY KEY (e.g. `92.01-A`) |
| — | `client_id` | FOREIGN KEY → `clients.id` (look up by normalized client name) |
| `Client Name` | `client_name` | Full client name as shown in CSV |
| `Client Status` | `client_status_history` | Values: "New", "Trial", "Renewed", "Upgraded", "Replacement" |
| `Month` | `month` | e.g. "May-2026", "Jun-2026" |
| `START DATE` | `start_date` | Format: YYYY-MM-DD |
| `Client Ad ID Name` | `client_ad_id_name` | e.g. "Tele 92 X TF X PCA X CC1: Tier 3" |
| `Ad ID Number` | `ad_id_number` | e.g. "921892230503652" |
| `Ad Account Type` | `ad_account_type` | e.g. "CC", "Other work" |
| `TIER` | `tier` | e.g. "TIER 3", "TIER 1" |
| `Ad Spend Limit` | `ad_spend_limit` | e.g. "$10 000,00" — stored as TEXT with currency |
| `Set up type` | `setup_type` | e.g. "Ad Account", "Setup", "Only Pages" |
| `Subscription` | `subscription_fee` | e.g. "$499,00" |
| `Setup fee` | `setup_fee` | e.g. "$299,00", "$0,00" |
| `Discount` | `discount` | e.g. "$0,00" |
| `CL Amount` | `cl_amount` | Credit line amount — e.g. "$0,00" |
| `Referral Partner Name` | `referral_partner_name` | e.g. "N.A." |
| `Referral Amount` | `referral_amount` | e.g. "$0,00" |
| `VALID / Stopped Date` | `valid_stopped_date` | e.g. "2026-06-23" |
| `Payment Name` | `payment_name` | WHOP account name — e.g. "pastypardonfe" |
| `Bank Name` | `bank_name` | e.g. "WHOP" |
| `Amount Received` | `amount_received` | e.g. "$483,16" |
| `Payment received Date` | `payment_received_date` | e.g. "2026-05-22" |
| `Payment received Month` | `payment_received_month` | e.g. "mai-2026", "juin-2026" |
| `Reference No.` | `reference_no` | WHOP payment ref — e.g. "pay_PI7RUEX6GqvE5T" |
| `Actual Balance Diffrence` | `actual_balance_difference` | e.g. "-$15,84" |
| `Notes` | `notes` | e.g. "Good to GO" |
| `Status` | `visual_status` | e.g. "Active" |
| `Renewal Type` | `renewal_type` | e.g. "Auto", "Manual" |
| `Remark by Sanjay on 4th April` | `notes` | Append to notes field |
| `Special Comments for Stopped and Refund Clients` | `notes` | Append to notes field |
| — | `is_trial` | Set to `1` if `Client Status` = "Trial" |
| — | `upgrade_status` | Set based on `Client Status`: "Upgraded" rows |

---

### 3. `payments` table

One row **per payment** (if a Sr No. has a payment, create one payment row linked to the renewal).

| CSV Column | DB Column | Notes |
|---|---|---|
| — | `id` | Auto-increment PRIMARY KEY |
| — | `client_id` | FOREIGN KEY → `clients.id` |
| `Sr No.` | `renewal_sr_no` | FOREIGN KEY → `renewals.sr_no` |
| `Amount Received` | `amount_received` | e.g. "$483,16" |
| `Payment received Date` | `payment_received_date` | e.g. "2026-05-22" |
| `Payment received Month` | `payment_received_month` | e.g. "mai-2026" |
| `Reference No.` | `reference_no` | e.g. "pay_PI7RUEX6GqvE5T" |
| `Bank Name` | `bank_name` | e.g. "WHOP" |
| `Notes` | `notes` | e.g. "Good to GO" |

**When to create a payment row:**
- If `Amount Received` is present and not `"-"` or `"-"`

---

### 4. `payment_history` table

The new transaction architecture. This tracks **all money movements** for a client's product.

| CSV Column | DB Column | Notes |
|---|---|---|
| — | `id` | Auto-increment PRIMARY KEY |
| — | `client_id` | FOREIGN KEY → `clients.id` |
| — | `product_id` | FOREIGN KEY → `client_products.id` (create first) |
| `Client Status` → map to `type` | `type` | `"MONTHLY"` for normal rows; `"UPGRADE_PONCTUAL"` for Upgraded/Replacement rows; `"RETURN"` if amount is negative (refund) |
| — | `amount` | `Amount Received` value |
| `Payment received Date` | `date` | Payment date |
| `Payment received Month` | `until_date` | Month the payment covers |
| `Actual Balance Diffrence` | `notes` | Store as notes |
| — | `prorata_amount` | Leave blank for monthly payments |

**Type mapping from `Client Status`:**
| Client Status | payment_history.type |
|---|---|
| New | `MONTHLY` |
| Renewed | `MONTHLY` |
| Trial | `MONTHLY` (amount = 0) |
| Upgraded | `UPGRADE_PONCTUAL` |
| Replacement | `UPGRADE_PONCTUAL` |

---

### 5. `client_products` table

The new product architecture — one row per active product subscription.

| CSV Column | DB Column | Notes |
|---|---|---|
| — | `id` | Auto-increment PRIMARY KEY |
| — | `client_id` | FOREIGN KEY → `clients.id` |
| `TIER` | `tier` | e.g. "TIER 3" |
| `Set up type` | `setup_type` | e.g. "Ad Account", "Setup" |
| — | `original_tier` | First tier this client ever had (track from CSV order) |
| — | `original_setup` | First setup type |
| — | `is_ponctual` | `0` for normal, `1` for Replacement rows |
| `START DATE` | `start_date` | e.g. "2026-05-24" |
| `VALID / Stopped Date` | `valid_until` | e.g. "2026-06-23" |
| `Subscription` | `subscription_fee` | e.g. "$499,00" |
| `Setup fee` | `setup_fee` | e.g. "$299,00", "$0,00" |
| `Discount` | `discount` | e.g. "$0,00" |
| `Ad Spend Limit` | `ad_spend_limit` | e.g. "$10 000,00" |
| — | `is_active` | `1` if `Status` = "Active" |

---

### 6. `whop_product_payments` table

Stores the WHOP payment reference per product component.

| CSV Column | DB Column | Notes |
|---|---|---|
| — | `id` | Auto-increment PRIMARY KEY |
| `Sr No.` | `renewal_sr_no` | FOREIGN KEY → `renewals.sr_no` |
| `Set up type` | `product_type` | "Ad Account" → "tier", "Setup" → "setup" |
| `Client Ad ID Name` | `product_name` | The ad account name |
| `Payment Name` | `whop_email` | WHOP account name (e.g. "pastypardonfe") |
| `Reference No.` | `whop_payment_reference` | WHOP payment ID (e.g. "pay_PI7RUEX6GqvE5T") |

---

## Recommended Import Order

1. **`clients`** — Extract unique clients, normalize names
2. **`renewals`** — Insert all rows with `sr_no`, link `client_id` via lookup
3. **`payments`** — Insert payment rows for renewals that have payments
4. **`client_products`** — Create product rows linked to clients
5. **`payment_history`** — Create transaction history from payment data
6. **`whop_product_payments`** — Insert WHOP payment references

---

## Name Normalization Reference

Use this function to extract a normalized client name for deduplication:

```javascript
function normalizeClientName(name) {
  return name
    .replace(/^[🟢🔴🟡⚠️📌]+\s*/g, '')           // Remove status emoji
    .replace(/^\[DC\]\s*/g, '')                   // Remove [DC] prefix
    .replace(/\s*:\s*Tele\s+\d+\s*$/g, '')        // Remove ": Tele 92" suffix
    .replace(/\s*X\s+Prime\s+circle\s*$/gi, '')  // Remove "X Prime circle" suffix
    .replace(/\s*×\s*Prime\s+circle\s*$/gi, '')  // Remove "× Prime circle" variant
    .replace(/x\s+Prime\s+circle\s*:\s*/gi, '')  // Remove "x Prime circle :" variant
    .trim();
}

// Examples:
normalizeClientName("🟢Tyler farrington X Prime circle: Tele 92")  // → "Tyler farrington"
normalizeClientName("[DC]🟢Mar Besso x Prime circle : Tele 272")   // → "Mar Besso"
normalizeClientName("Ruslan Koval X Prime circle: Tele 313")      // → "Ruslan Koval"
```

---

## Sr No. Parsing Reference

The `Sr No.` column encodes the relationship between subscription periods:

| Sr No. | Meaning |
|---|---|
| `92-A` | Client-level header row (skip — no product data) |
| `92.01-A` | First subscription period for client 92 (sub-row 01) |
| `92.02-A` | Second subscription period for client 92 |
| `92.03-A` | Third subscription period... |
| `272,01` | Alternative format — same pattern (comma instead of dot) |
| `272,02` | Second period for client 272 |

**Important:** Rows with `Sr No.` ending in `-A` without a decimal/comma sub-number (e.g. `92-A`) are **header rows** with no product data — skip these.

---

## Currency/Amount Parsing

Amounts use European formatting: `"$10 000,00"` = $10,000.00 USD

```javascript
function parseAmount(amountStr) {
  if (!amountStr || amountStr === '-' || amountStr.trim() === '-') return null;
  // Remove $, spaces, and replace comma with decimal point
  return parseFloat(amountStr.replace(/[$\s]/g, '').replace(',', '.'));
}
```

---

## Date Parsing

| CSV format | Example | Convert to |
|---|---|---|
| `YYYY-MM-DD` | `2026-05-24` | ISO 8601 (keep as-is) |
| Month name | `mai-2026`, `juin-2026`, `juil.-2026` | Map to number: jan=01, fév=02, mar=03, avr=04, **mai=05**, **jun=06**, **juil.=07**, aoû=08, sep=09, oct=10, nov=11, déc=12 |

```javascript
const monthMap = {
  'jan': '01', 'fév': '02', 'mar': '03', 'avr': '04',
  'mai': '05', 'jun': '06', 'jui': '07', 'jul': '07',
  'juil.': '07', 'juil': '07', 'aoû': '08', 'sep': '09',
  'oct': '10', 'nov': '11', 'déc': '12', 'dec': '12'
};

function parseMonth(monthStr) {
  // e.g. "mai-2026" → "2026-05"
  const [month, year] = monthStr.split('-');
  return `${year}-${monthMap[month.toLowerCase()] || month}`;
}
```

---

## Special Field Notes

- **`DST (For CL)`** — No matching DB column. Internal field, skip.
- **`Remark by Sanjay on 4th April`** — Append to `notes` field
- **`Special Comments for Stopped and Refund Clients`** — Append to `notes` field
- **`is_trial`** — Set to `1` when `Client Status` = `"Trial"` and `Subscription` = `"$0,00"`
- **`is_ponctual_upgrade`** — Set to `1` when `Client Status` = `"Replacement"`
- **`upgrade_chain_json`** — Track tier changes across sub-rows (e.g. 272.05 upgraded from Tier 1 → Tier 2)
