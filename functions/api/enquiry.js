/**
 * POST /api/enquiry — Cloudflare Pages Function
 * ============================================================
 * Takes a website contact-form submission and sends two emails:
 *   1. the enquiry, to the studio
 *   2. a branded acknowledgement, to the visitor
 *
 * Runs natively on Cloudflare Pages using Zoho ZeptoMail (or Resend) HTTPS API.
 *
 * REQUIRED Environment Variables (Cloudflare Dashboard -> Settings -> Variables):
 *   ZOHO_ZEPTOMAIL_TOKEN  (or ZOHO_MAIL_TOKEN) - Send Mail Token from zeptomail.zoho.in
 *   MAIL_FROM             e.g. "Fusion Bells Films <hello@fusionbellsfilms.com>"
 *   MAIL_TO               e.g. "hello@fusionbellsfilms.com"
 */

import { studioEmail, studioText, visitorEmail, visitorText } from './_templates.js';

const MAX_LEN = { name: 120, phone: 40, email: 160, date: 40, service: 80, venue: 200, message: 4000 };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

function clean(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value);
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

  // Honeypot: field hidden from users but filled by bots
  if (clean(body.company, 100)) return json({ ok: true });

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

  if (!f.name || (!f.phone && !f.email)) {
    return json({ ok: false, error: 'Please add your name and a phone number or email.' }, 422);
  }
  if (f.email && !looksLikeEmail(f.email)) {
    return json({ ok: false, error: 'That email address does not look right.' }, 422);
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

      if (replyTo && looksLikeEmail(replyTo)) {
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
        reply_to: replyTo && looksLikeEmail(replyTo) ? replyTo : undefined,
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
    replyTo: f.email && looksLikeEmail(f.email) ? f.email : undefined,
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
  if (f.email && looksLikeEmail(f.email)) {
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
