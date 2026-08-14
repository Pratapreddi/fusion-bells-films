/**
 * POST /api/enquiry — Cloudflare Pages Function
 * ============================================================
 * Takes a website contact-form submission and sends two emails:
 *   1. the enquiry, to the studio
 *   2. a branded acknowledgement, to the visitor
 *
 * Runs on Cloudflare alongside the site — no separate host.
 *
 * WHY NOT NODEMAILER: it speaks SMTP over raw TCP sockets, which the
 * Workers runtime does not provide. Mail goes out over an HTTPS API
 * instead, which is also faster and avoids storing SMTP credentials.
 *
 * REQUIRED environment variables (Cloudflare dashboard →
 * Workers & Pages → your project → Settings → Variables):
 *
 *   RESEND_API_KEY   secret, from resend.com
 *   MAIL_FROM        e.g. "Fusion Bells Films <hello@fusionbellsfilms.com>"
 *   MAIL_TO          where enquiries land, e.g. hello@fusionbellsfilms.com
 *
 * Set RESEND_API_KEY as a SECRET (encrypted), never as plain text, and
 * never commit it to this repository.
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

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Could not read that submission.' }, 400);
  }

  // Honeypot: a field hidden from people but filled in by scrapers. Answer
  // 200 so the bot believes it succeeded and does not retry.
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

  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM || 'Fusion Bells Films <hello@fusionbellsfilms.com>';
  const to = env.MAIL_TO || 'hello@fusionbellsfilms.com';

  if (!apiKey) {
    // Misconfigured rather than the visitor's fault — say so plainly so the
    // form can offer WhatsApp instead of pretending the message was sent.
    console.error('RESEND_API_KEY is not set on this environment.');
    return json({ ok: false, error: 'Email is not configured yet.', fallback: true }, 503);
  }

  const send = (payload) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

  // The studio copy is the one that must not be lost, so it is sent and
  // checked first. Replying straight to the visitor is what makes the
  // "Reply" button in the inbox do the right thing.
  const studio = await send({
    from,
    to: [to],
    reply_to: f.email && looksLikeEmail(f.email) ? f.email : undefined,
    subject: `New enquiry — ${f.name}${f.date ? ` · ${f.date}` : ''}`,
    html: studioEmail(f),
    text: studioText(f)
  });

  if (!studio.ok) {
    const detail = await studio.text().catch(() => '');
    console.error('Studio email failed', studio.status, detail);
    return json({ ok: false, error: 'We could not send that just now.', fallback: true }, 502);
  }

  // The acknowledgement is a nicety — if it fails the enquiry is still safe,
  // so never fail the whole request over it.
  let acknowledged = false;
  if (f.email && looksLikeEmail(f.email)) {
    try {
      const ack = await send({
        from,
        to: [f.email],
        reply_to: to,
        subject: 'Thank you for writing to Fusion Bells Films',
        html: visitorEmail(f),
        text: visitorText(f)
      });
      acknowledged = ack.ok;
      if (!ack.ok) console.error('Acknowledgement failed', ack.status, await ack.text().catch(() => ''));
    } catch (err) {
      console.error('Acknowledgement threw', err);
    }
  }

  return json({ ok: true, acknowledged });
}

// Only onRequestPost is exported on purpose. Adding an onRequest catch-all
// alongside it makes which handler wins ambiguous; with just this one,
// Cloudflare answers any other method with 405 by itself.
