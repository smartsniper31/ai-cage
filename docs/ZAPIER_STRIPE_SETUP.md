# AI CAGE — Zapier + Stripe Automatic License Key Flow

**Purpose:** When a customer pays €5 via Stripe, Zapier automatically:
1. Catches the Stripe payment event
2. Generates a Pro license key (same algorithm as the extension)
3. Sends an activation email to the customer via Gmail

**Zero code changes in the extension. Zero server. Zero backend.**

---

## Architecture

```
Customer pays on Stripe
        ↓
Stripe fires webhook: payment_intent.succeeded
        ↓
Zapier catches it (Trigger: Stripe → New Payment)
        ↓
Zapier Code Step: generate Pro license key (JavaScript)
        ↓
Zapier Action: Gmail → Send Email to customer
        ↓
Customer receives: license key + activation instructions
        ↓
Customer opens popup → Account tab → pastes key → Activate Pro ✅
```

---

## STEP 1 — Create the Zap on Zapier

Go to https://zapier.com → Create Zap

---

## STEP 2 — Trigger: Stripe New Payment

1. App: **Stripe**
2. Event: **New Payment** (or "Payment Intent Succeeded")
3. Connect your Stripe account
4. Filter: only trigger when `status = succeeded` and `amount >= 500` (500 = €5.00 in cents)

**Test data you will see:**
```json
{
  "id": "pi_xxxxx",
  "amount": 500,
  "currency": "eur",
  "receipt_email": "customer@example.com",
  "metadata": {
    "customer_name": "Karim Ben Ali"
  }
}
```

---

## STEP 3 — Action: Code by Zapier (JavaScript)

1. App: **Code by Zapier**
2. Action: **Run Javascript**
3. Input Data:
   - `email` → from Stripe: `receipt_email`
   - `customer` → from Stripe: `metadata.customer_name` (or fallback: `receipt_email`)
   - `seats` → hardcode `1`

**Paste this exact code in the Code field:**

```javascript
// ============================================================
// AI CAGE Pro License Key Generator — Zapier Code Step
// Reproduces packages/core/src/license.ts generateLicenseKey()
// EMBEDDED_KEY must match exactly what is in license.ts
// ============================================================

const EMBEDDED_KEY = 'ai-cage-verification-v1-7f3a9b2e8c1d4a6f';

// ── djb2 hash (matches license.ts djb2Hash) ──────────────────
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ── base64url encode (matches license.ts base64UrlEncode) ────
function base64UrlEncode(str) {
  // Node.js Buffer available in Zapier Code steps
  const b64 = Buffer.from(str, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Build license payload ─────────────────────────────────────
const now    = new Date();
const expiry = new Date(now);
expiry.setFullYear(expiry.getFullYear() + 1); // 1 year license

const payload = {
  tier:      'PRO',
  deviceId:  'stripe-' + inputData.email.replace('@','_').replace(/\./g,'_'),
  issuedAt:  now.toISOString(),
  expiresAt: expiry.toISOString(),
  features:  ['agentCage', 'auditExport', 'customPolicy', 'mcpMonitor'],
  customer:  inputData.customer || inputData.email,
  seats:     parseInt(inputData.seats) || 1,
};

// ── Generate key ──────────────────────────────────────────────
const payloadJson = JSON.stringify(payload);
const payloadB64  = base64UrlEncode(payloadJson);
const sig         = djb2Hash(payloadB64 + EMBEDDED_KEY);
const licenseKey  = payloadB64 + '.' + sig;

// ── Output ────────────────────────────────────────────────────
output = {
  licenseKey:  licenseKey,
  customerEmail: inputData.email,
  customerName:  inputData.customer || inputData.email,
  expiresAt:     expiry.toISOString().slice(0, 10),
  tier:          'PRO',
};
```

4. Click **Test** → you will see `licenseKey` in the output. ✅

---

## STEP 4 — Action: Gmail → Send Email

1. App: **Gmail**
2. Action: **Send Email**
3. Connect: `aicage.support@gmail.com`
4. Fill in:

| Field | Value |
|-------|-------|
| **To** | `{{Step 3: customerEmail}}` |
| **From Name** | `AI CAGE Support` |
| **Subject** | `Your AI CAGE Pro License Key 🔒` |
| **Body (HTML)** | See below |

**Email body (HTML) — paste exactly:**

```html
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">

  <div style="background:#15803d;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px">
    <h1 style="margin:0;font-size:22px">🔒 AI CAGE Pro — Activated!</h1>
    <p style="margin:4px 0 0;opacity:.85;font-size:14px">Your license key is ready</p>
  </div>

  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">

    <p style="font-size:15px;color:#0f172a">
      Hi <strong>{{Step 3: customerName}}</strong>,<br><br>
      Thank you for subscribing to AI CAGE Pro!
      Your data is now protected with <strong>unlimited cages</strong>.
    </p>

    <div style="background:#f0fdf4;border:1.5px solid #15803d;border-radius:10px;padding:16px;margin:20px 0">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#15803d;margin-bottom:8px">
        🔑 Your Pro License Key
      </div>
      <div style="font-family:monospace;font-size:13px;background:#fff;border:1px solid #e2e8f0;
                  border-radius:6px;padding:10px 12px;word-break:break-all;color:#0f172a">
        {{Step 3: licenseKey}}
      </div>
      <p style="font-size:11px;color:#64748b;margin-top:8px">
        Valid until: {{Step 3: expiresAt}} · Plan: Pro · 1 seat
      </p>
    </div>

    <h2 style="font-size:16px;color:#0f172a;margin-bottom:12px">
      How to activate (3 steps — takes 30 seconds)
    </h2>

    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="width:36px;padding:8px 12px 8px 0;vertical-align:top">
          <div style="background:#15803d;color:#fff;width:28px;height:28px;
                      border-radius:50%;text-align:center;line-height:28px;font-weight:800">1</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9">
          <strong>Open the AI CAGE extension</strong><br>
          <span style="color:#64748b;font-size:13px">Click the 🔒 lock icon in your Chrome toolbar</span>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top">
          <div style="background:#15803d;color:#fff;width:28px;height:28px;
                      border-radius:50%;text-align:center;line-height:28px;font-weight:800">2</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9">
          <strong>Go to the ⚙️ Account tab</strong><br>
          <span style="color:#64748b;font-size:13px">Click the "Account" tab inside the popup</span>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top">
          <div style="background:#15803d;color:#fff;width:28px;height:28px;
                      border-radius:50%;text-align:center;line-height:28px;font-weight:800">3</div>
        </td>
        <td style="padding:8px 0">
          <strong>Paste your key and click "Activate Pro"</strong><br>
          <span style="color:#64748b;font-size:13px">
            Copy the key above → paste it in the field → click ✅ Activate Pro.<br>
            You will immediately see "✅ Pro Plan Active" — unlimited cages unlocked!
          </span>
        </td>
      </tr>
    </table>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
                padding:14px;margin-top:20px;font-size:13px;color:#1e40af">
      💡 <strong>Haven't installed AI CAGE yet?</strong>
      <a href="https://ai-cage-gamma.vercel.app/install.html" style="color:#1d4ed8;font-weight:700">
        Download here →
      </a>
    </div>

    <p style="font-size:13px;color:#64748b;margin-top:20px;line-height:1.6">
      Questions? Reply to this email or write to
      <a href="mailto:aicage.support@gmail.com" style="color:#15803d">aicage.support@gmail.com</a>.<br>
      We respond within 24 hours.
    </p>

    <div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:16px;
                font-size:11px;color:#94a3b8;text-align:center">
      🇹🇳 Made in Tunisia · AI CAGE Pro · 100% local · Zero data leaves your device<br>
      <a href="https://ai-cage-gamma.vercel.app" style="color:#94a3b8">ai-cage-gamma.vercel.app</a>
    </div>

  </div>
</div>
```

---

## STEP 5 — Test the full Zap

1. In Zapier, click **Test Zap**
2. Use a real Stripe test payment (card `4242 4242 4242 4242`)
3. Check `aicage.support@gmail.com` inbox — you should receive the activation email
4. Copy the license key from the email
5. Open the AI CAGE extension → Account tab → paste key → Activate Pro
6. Confirm "✅ Pro Plan Active" appears

---

## STEP 6 — Turn on the Zap

Click **Publish Zap** → the automation is live.

Every customer who pays will now receive their key automatically within 60 seconds.

---

## Important notes

### On the EMBEDDED_KEY
The key `ai-cage-verification-v1-7f3a9b2e8c1d4a6f` is in the open-source code.
This means technically someone could generate their own key.
**This is acceptable for v0.6.0** — the value is in the service (support, updates),
not in the key protection. V0.7.0 will upgrade to ed25519 signature (cryptographically secure).

### On the license duration
The Zapier code generates a **1-year license**. For a monthly subscription (€5/month),
you should either:
- Generate a 31-day license and re-issue monthly (more complex Zapier logic)
- OR use a 1-year license and rely on Stripe's subscription cancellation to stop renewals

For v0.6.0, the 1-year license is simpler and acceptable.

### On Stripe test mode
The Stripe Payment Link you have (`test_4gMeVe82mf3AaGacIs9AA00`) is in **test mode**.
Before going live, create a real (non-test) Payment Link in the Stripe dashboard.

---

## Summary — What changes vs what stays the same

| Component | Change |
|-----------|--------|
| `packages/core/src/license.ts` | ✅ Unchanged |
| Extension popup Account tab | ✅ Unchanged |
| Stripe Payment Link | ✅ Unchanged |
| GitHub repo | ✅ No commit needed |
| Zapier | ➕ New (external, not in repo) |
| Gmail | ➕ Used for sending (external) |
| Privacy guarantee | ✅ Unchanged — key generated locally in Zapier, not stored on any server |
