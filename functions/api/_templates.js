/**
 * Email bodies for the enquiry endpoint.
 *
 * Underscore-prefixed so Cloudflare treats this as a shared module rather
 * than a routable endpoint — /api/_templates is not reachable from outside.
 */

const BRAND = {
  name: 'Fusion Bells Films',
  site: 'https://fusionbellsfilms.com',
  phone1: '+91 89705 11524',
  phone2: '+91 74116 87671',
  email: 'hello@fusionbellsfilms.com',
  whatsapp: 'https://wa.me/918970511524',
  address: 'Hosakerehalli, Bangalore, Karnataka 560085',
  hours: 'Monday to Saturday, 10:00 am to 7:00 pm IST'
};

/** Escape anything a visitor typed before it goes anywhere near HTML. */
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** What lands in the studio inbox. Plain and scannable on a phone. */
export function studioEmail(f) {
  const row = (label, value) => value
    ? `<tr>
         <td style="padding:8px 16px 8px 0;color:#8A7E73;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
         <td style="padding:8px 0;color:#16120F;font-size:16px;">${esc(value)}</td>
       </tr>`
    : '';

  return `<div style="font-family:Helvetica,Arial,sans-serif;background:#F7F3EC;padding:28px;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;padding:28px;">
    <div style="font-size:11px;letter-spacing:3px;color:#B0854A;padding-bottom:6px;">NEW WEBSITE ENQUIRY</div>
    <div style="font-family:Georgia,serif;font-size:26px;color:#16120F;padding-bottom:18px;">${esc(f.name || 'Someone')}</div>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Name', f.name)}
      ${row('Phone', f.phone)}
      ${row('Email', f.email)}
      ${row('Wedding date', f.date)}
      ${row('Interested in', f.service)}
      ${row('Venue & city', f.venue)}
    </table>
    ${f.message ? `<div style="margin-top:18px;padding:16px;background:#F7F3EC;color:#5A5048;font-size:15px;line-height:25px;white-space:pre-wrap;">${esc(f.message)}</div>` : ''}
    <div style="margin-top:22px;">
      ${f.phone ? `<a href="https://wa.me/${esc(String(f.phone).replace(/[^0-9]/g, ''))}" style="background:#1F8F4E;color:#fff;text-decoration:none;padding:12px 22px;border-radius:40px;font-size:14px;font-weight:bold;display:inline-block;">WhatsApp them</a>` : ''}
      ${f.email ? `<a href="mailto:${esc(f.email)}" style="color:#16120F;font-size:14px;padding-left:16px;">Reply by email</a>` : ''}
    </div>
    <div style="margin-top:20px;color:#8A7E73;font-size:12px;">
      Sent from the website contact form${f.pageUrl ? ` &middot; ${esc(f.pageUrl)}` : ''}
    </div>
  </div>
</div>`;
}

export function studioText(f) {
  return [
    'NEW WEBSITE ENQUIRY',
    '',
    `Name         : ${f.name || '-'}`,
    `Phone        : ${f.phone || '-'}`,
    `Email        : ${f.email || '-'}`,
    `Wedding date : ${f.date || '-'}`,
    `Interested in: ${f.service || '-'}`,
    `Venue & city : ${f.venue || '-'}`,
    '',
    'Message:',
    f.message || '(none)',
    '',
    '-- sent from the website contact form'
  ].join('\n');
}

/** The branded acknowledgement the visitor receives. */
export function visitorEmail(f) {
  const first = String(f.name || '').trim().split(/\s+/)[0];
  const greeting = first
    ? `<p style="font-size:16px;line-height:27px;color:#16120F;margin:0 0 16px 0;">Dear ${esc(first)},</p>`
    : '';

  return `<div style="background:#F7F3EC;padding:32px 24px;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;">

    <div style="background:#16120F;padding:30px 24px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:34px;letter-spacing:6px;color:#D8B071;">FBF</div>
      <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:5px;color:#F4EDE1;padding-top:8px;">FUSION&nbsp;BELLS&nbsp;FILMS</div>
      <div style="font-size:10px;letter-spacing:2px;color:#8A7E73;padding-top:10px;">REAL MOMENTS. TIMELESS STORIES.</div>
    </div>

    <div style="padding:34px 28px 6px 28px;">
      <div style="font-size:11px;letter-spacing:3px;color:#B0854A;padding-bottom:14px;">YOUR ENQUIRY HAS ARRIVED</div>
      <div style="font-family:Georgia,serif;font-size:30px;line-height:38px;color:#16120F;padding-bottom:18px;">Thank you for writing to us.</div>
      ${greeting}
      <p style="font-size:16px;line-height:27px;color:#5A5048;margin:0 0 18px 0;">
        Your note has landed safely with the studio. Someone here reads every enquiry
        personally &mdash; not a bot &mdash; and you will hear back from us
        <strong style="color:#16120F;">within 24 hours</strong>, usually a good deal sooner.
      </p>
      <p style="font-size:16px;line-height:27px;color:#5A5048;margin:0 0 26px 0;">
        If your date is close, or you would simply rather talk it through,
        WhatsApp is the quickest way to reach us.
      </p>
      <p style="margin:0 0 30px 0;">
        <a href="${BRAND.whatsapp}" style="background:#1F8F4E;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:40px;font-size:15px;font-weight:bold;display:inline-block;">Message us on WhatsApp</a>
      </p>
    </div>

    ${summaryBlock(f)}

    <div style="padding:22px 28px 30px 28px;">
      <p style="font-size:16px;line-height:26px;color:#5A5048;margin:0 0 12px 0;">Warmly,</p>
      <div style="font-size:19px;font-weight:bold;color:#B0854A;">Anantha Ramu</div>
      <div style="font-size:11px;letter-spacing:2px;color:#8A7E73;padding-top:4px;">FOUNDER &amp; LEAD CINEMATOGRAPHER</div>
    </div>

    <div style="background:#16120F;padding:28px;color:#C9BFAE;font-size:14px;line-height:24px;">
      <div style="font-family:Georgia,serif;font-size:19px;color:#F4EDE1;padding-bottom:12px;">${BRAND.name}</div>
      ${BRAND.address}<br>Shooting across India &amp; worldwide<br><br>
      <a href="tel:${BRAND.phone1.replace(/\s/g, '')}" style="color:#D8B071;text-decoration:none;">${BRAND.phone1}</a>
      &nbsp;/&nbsp;
      <a href="tel:${BRAND.phone2.replace(/\s/g, '')}" style="color:#D8B071;text-decoration:none;">${BRAND.phone2}</a><br>
      <a href="mailto:${BRAND.email}" style="color:#D8B071;text-decoration:none;">${BRAND.email}</a><br><br>
      <span style="font-size:13px;color:#8A7E73;">Studio hours &mdash; ${BRAND.hours}</span>
      <div style="font-size:11px;color:#8A7E73;padding-top:18px;line-height:18px;">
        This is an automatic acknowledgement, sent once so you know your enquiry arrived.
        Replying to this message reaches us directly.
      </div>
    </div>

  </div>
</div>`;
}

/** Shows the visitor what they actually sent, so they can spot a typo. */
function summaryBlock(f) {
  const items = [
    ['Wedding date', f.date],
    ['Interested in', f.service],
    ['Venue & city', f.venue]
  ].filter(([, v]) => v);
  if (!items.length) return '';

  return `<div style="background:#EFE9DE;padding:22px 26px;margin:0 28px;">
    <div style="font-family:Georgia,serif;font-size:19px;color:#16120F;padding-bottom:10px;">What you sent us</div>
    <p style="font-size:15px;line-height:26px;color:#5A5048;margin:0;">
      ${items.map(([k, v]) => `<strong style="color:#16120F;">${esc(k)}:</strong> ${esc(v)}`).join('<br>')}
    </p>
  </div>`;
}

export function visitorText(f) {
  const first = String(f.name || '').trim().split(/\s+/)[0];
  return [
    first ? `Dear ${first},` : 'Hello,',
    '',
    'Thank you for writing to us.',
    '',
    'Your note has landed safely with the studio. Someone here reads every',
    'enquiry personally - not a bot - and you will hear back from us within',
    '24 hours, usually a good deal sooner.',
    '',
    `If your date is close, WhatsApp is quickest: ${BRAND.whatsapp}`,
    '',
    'Warmly,',
    'Anantha Ramu',
    'Founder & Lead Cinematographer',
    '',
    '--',
    BRAND.name.toUpperCase(),
    BRAND.address,
    `${BRAND.phone1} / ${BRAND.phone2}`,
    `${BRAND.email} | ${BRAND.site}`,
    `Studio hours - ${BRAND.hours}`
  ].join('\n');
}

export { BRAND };
