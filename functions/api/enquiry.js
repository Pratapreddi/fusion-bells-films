/**
 * POST /api/enquiry — Cloudflare Pages Function
 * ============================================================
 * Takes a website contact-form submission and sends two emails:
 *   1. the enquiry, to the studio
 *   2. a branded acknowledgement, to the visitor
 *
 * Runs natively on Cloudflare Pages using Zoho ZeptoMail (or Resend) HTTPS API.
 * Hardened with strict input validation, phone digit bounds, anti-spam link limits,
 * and honeypot bot defenses.
 *
 * REQUIRED Environment Variables (Cloudflare Dashboard -> Settings -> Variables):
 *   ZOHO_ZEPTOMAIL_TOKEN  (or ZOHO_MAIL_TOKEN) - Send Mail Token from zeptomail.zoho.in
 *   MAIL_FROM             e.g. "Fusion Bells Films <hello@fusionbellsfilms.com>"
 *   MAIL_TO               e.g. "hello@fusionbellsfilms.com"
 */

import { studioEmail, studioText, visitorEmail, visitorText } from './_templates.js';

const MAX_LEN = { name: 70, phone: 20, email: 120, date: 30, service: 80, venue: 150, message: 2000 };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

function clean(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function isValidEmail(value) {
  if (!value || value.length > 120) return false;
  // RFC 5322 compliant regex with proper TLD validation
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value);
}

function isValidPhone(value) {
  if (!value) return false;
  // Strip all formatting to inspect raw digits
  const digits = value.replace(/\D/g, '');
  // Standard international / Indian phone numbers have between 8 and 15 digits (ITU-T E.164)
  if (digits.length < 8 || digits.length > 15) return false;

  // Ensure characters only include +, digits, spaces, hyphens, and parentheses
  if (!/^[\+]?[0-9\s\-()]{8,20}$/.test(value.trim())) return false;

  // Reject repeating single-digit junk (e.g. 1111111111 or 0000000000)
  if (/^(\d)\1{7,}$/.test(digits)) return false;

  return true;
}

function isValidName(value) {
  if (!value || value.length < 2 || value.length > 70) return false;
  // Must contain at least one letter and cannot contain HTML or script characters
  if (!/[a-zA-Z]/.test(value) || /<[^>]*>|[<>{}\\]/.test(value)) return false;
  return true;
}

function isValidDate(value) {
  if (!value) return true; // Date is optional
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;

  // Enforce upcoming dates starting from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 4);

  // Parse value as YYYY-MM-DD or standard date
  const parts = String(value).split('-');
  let selected;
  if (parts.length === 3) {
    selected = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    selected = new Date(d);
    selected.setHours(0, 0, 0, 0);
  }

  return selected >= today && selected <= maxDate;
}

function countUrls(text) {
  if (!text) return 0;
  const matches = text.match(/https?:\/\/|www\./gi);
  return matches ? matches.length : 0;
}

function parseAddress(str, defaultName = 'Fusion Bells Films') {
  if (!str) return { address: 'hello@fusionbellsfilms.com', name: defaultName };
  const match = str.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || defaultName, address: match[2].trim() };
  }
  return { name: defaultName, address: str.trim() };
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Could not read that submission.' }, 400);
  }

  // 1. Honeypot check (field hidden from genuine users, filled by bots)
  if (clean(body.company, 100) || clean(body.website, 100)) {
    return json({ ok: true }); // Answer 200 so the bot believes it succeeded
  }

  // 2. Bot speed trap (form submitted in less than 1.2 seconds from page load)
  if (body._ts && typeof body._ts === 'number') {
    const elapsed = Date.now() - body._ts;
    if (elapsed > 0 && elapsed < 1200) {
      console.warn('Bot speed submission detected, elapsed:', elapsed);
      return json({ ok: true }); // Silently drop bot burst
    }
  }

  const f = {
    name:    clean(body.name, MAX_LEN.name),
    phone:   clean(body.phone, MAX_LEN.phone),
    email:   clean(body.email, MAX_LEN.email).toLowerCase(),
    date:    clean(body.date, MAX_LEN.date),
    service: clean(body.service, MAX_LEN.service),
    venue:   clean(body.venue, MAX_LEN.venue),
    message: String(body.message == null ? '' : body.message).trim().slice(0, MAX_LEN.message),
    pageUrl: clean(body.pageUrl, 200)
  };

  // 3. Strict Validation
  if (!isValidName(f.name)) {
    return json({ ok: false, error: 'Please enter a valid name (at least 2 letters).' }, 422);
  }

  if (!f.phone && !f.email) {
    return json({ ok: false, error: 'Please provide either a phone number or email address.' }, 422);
  }

  if (f.phone && !isValidPhone(f.phone)) {
    return json({ ok: false, error: 'Please enter a valid phone number (8 to 15 digits).' }, 422);
  }

  if (f.email && !isValidEmail(f.email)) {
    return json({ ok: false, error: 'Please enter a valid email address (e.g. name@example.com).' }, 422);
  }

  if (f.date && !isValidDate(f.date)) {
    return json({ ok: false, error: 'Please choose an upcoming date for your event.' }, 422);
  }

  // 4. Anti-spam link limiter (reject messages loaded with URLs)
  if (countUrls(f.message) > 2) {
    return json({ ok: false, error: 'Please remove excess links from your message.' }, 422);
  }

  const zohoToken = env.ZOHO_ZEPTOMAIL_TOKEN || env.ZOHO_MAIL_TOKEN || env.ZEPTOMAIL_TOKEN;
  const resendKey = env.RESEND_API_KEY;
  const fromStr = env.MAIL_FROM || 'Fusion Bells Films <hello@fusionbellsfilms.com>';
  const toStr = env.MAIL_TO || 'hello@fusionbellsfilms.com';

  if (!zohoToken && !resendKey) {
    console.error('Neither ZOHO_ZEPTOMAIL_TOKEN nor RESEND_API_KEY is set on this environment.');
    return json({ ok: false, error: 'Email configuration is missing.', fallback: true }, 503);
  }

  const fromParsed = parseAddress(fromStr);
  const toParsed = parseAddress(toStr, 'Studio Admin');

  // Unified sender function
  async function sendEmail({ toEmail, toName, replyTo, subject, html, text }) {
    if (zohoToken) {
      // Ensure token prefix is present
      const authHeader = zohoToken.startsWith('Zoho-enczapikey')
        ? zohoToken
        : `Zoho-enczapikey ${zohoToken.trim()}`;

      const zeptoEndpoint = env.ZOHO_ENDPOINT || 'https://api.zeptomail.in/v1.1/email';

      const payload = {
        from: {
          address: fromParsed.address,
          name: fromParsed.name
        },
        to: [
          {
            email_address: {
              address: toEmail,
              name: toName || toEmail
            }
          }
        ],
        subject: subject,
        htmlbody: html,
        textbody: text
      };

      if (replyTo && isValidEmail(replyTo)) {
        payload.reply_to = [
          {
            address: replyTo,
            name: f.name || replyTo
          }
        ];
      }

      let res = await fetch(zeptoEndpoint, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': authHeader
        },
        body: JSON.stringify(payload)
      });

      // Handle potential India DC vs Global DC region routing
      if (!res.ok && zeptoEndpoint.includes('.in')) {
        const comEndpoint = 'https://api.zeptomail.com/v1.1/email';
        const retryRes = await fetch(comEndpoint, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': authHeader
          },
          body: JSON.stringify(payload)
        }).catch(() => null);

        if (retryRes && retryRes.ok) return { ok: true };
      }

      const out = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, error: out };
    }

    // Fallback to Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${resendKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: fromStr,
        to: [toEmail],
        reply_to: replyTo && isValidEmail(replyTo) ? replyTo : undefined,
        subject: subject,
        html: html,
        text: text
      })
    });
    return { ok: res.ok, status: res.status };
  }

  // 1. Send Studio Notification
  const studioResult = await sendEmail({
    toEmail: toParsed.address,
    toName: toParsed.name,
    replyTo: f.email && isValidEmail(f.email) ? f.email : undefined,
    subject: `New enquiry — ${f.name}${f.date ? ` · ${f.date}` : ''}`,
    html: studioEmail(f),
    text: studioText(f)
  });

  if (!studioResult.ok) {
    console.error('Studio notification email failed', studioResult);
    return json({ ok: false, error: 'Could not send enquiry email right now.', fallback: true }, 502);
  }

  // 2. Send Visitor Auto-Reply Acknowledgement
  let acknowledged = false;
  if (f.email && isValidEmail(f.email)) {
    try {
      const ackResult = await sendEmail({
        toEmail: f.email,
        toName: f.name,
        replyTo: toParsed.address,
        subject: 'Thank you for writing to Fusion Bells Films',
        html: visitorEmail(f),
        text: visitorText(f)
      });
      acknowledged = ackResult.ok;
      if (!ackResult.ok) console.error('Visitor auto-reply acknowledgement failed', ackResult);
    } catch (err) {
      console.error('Visitor auto-reply threw exception', err);
    }
  }

  return json({ ok: true, acknowledged });
}
