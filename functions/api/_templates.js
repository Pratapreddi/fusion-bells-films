/**
 * Email bodies for the enquiry endpoint.
 * ============================================================
 * Luxury editorial styling for Fusion Bells Films emails.
 */

const BRAND = {
  name: 'Fusion Bells Films',
  site: 'https://fusionbellsfilms.com',
  logoUrl: 'https://fusionbellsfilms.com/images/logo-wordmark.png',
  logoMonogram: 'https://fusionbellsfilms.com/images/FBF.png',
  phone1: '+91 89705 11524',
  phone2: '+91 74116 87671',
  email: 'hello@fusionbellsfilms.com',
  whatsapp: 'https://wa.me/918970511524',
  instagram: 'https://instagram.com/fusionbellsfilms',
  youtube: 'https://youtube.com/@fusionbellsfilms',
  address: 'Hosakerehalli, Bangalore, Karnataka 560085, India',
  hours: 'Mon – Sat, 10:00 am – 7:00 pm IST'
};

/** Escape anything a visitor typed before it goes into HTML. */
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** What lands in the studio inbox. */
export function studioEmail(f) {
  const row = (label, value) => value
    ? `<tr>
         <td style="padding:10px 14px 10px 0;color:#8A7E73;font-size:11.5px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;white-space:nowrap;vertical-align:top;border-bottom:1px solid #EFE9DE;">${esc(label)}</td>
         <td style="padding:10px 0;color:#16120F;font-size:15.5px;font-weight:500;border-bottom:1px solid #EFE9DE;">${esc(value)}</td>
       </tr>`
    : '';

  const cleanPhone = String(f.phone || '').replace(/[^0-9]/g, '');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7F4EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:30px auto;background:#FFFFFF;border:1px solid #E7DFD1;border-radius:4px;overflow:hidden;box-shadow:0 4px 20px rgba(22,18,15,0.06);">

    <!-- Header with Brand Logo -->
    <div style="background:#16120F;padding:32px 28px;text-align:center;border-bottom:2px solid #B0854A;">
      <a href="${BRAND.site}" target="_blank" style="text-decoration:none;display:inline-block;">
        <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="height:48px;max-width:220px;width:auto;display:block;margin:0 auto;filter:brightness(0) invert(1);" />
      </a>
      <div style="color:#D8B071;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:10px;font-weight:600;">NEW CLIENT INQUIRY</div>
    </div>

    <!-- Body Content -->
    <div style="padding:34px 30px;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B0854A;font-weight:600;margin-bottom:8px;">INQUIRY DETAILS</div>
      <h2 style="margin:0 0 20px 0;font-family:Georgia,serif;font-size:26px;color:#16120F;font-weight:normal;">${esc(f.name || 'New Client')}</h2>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row('Full Name', f.name)}
        ${row('Phone / WhatsApp', f.phone)}
        ${row('Email Address', f.email)}
        ${row('Wedding / Event Date', f.date)}
        ${row('Interested Service', f.service)}
        ${row('Venue & Location', f.venue)}
      </table>

      ${f.message ? `
      <div style="margin:20px 0;padding:18px 20px;background:#F9F6F0;border-left:3px solid #B0854A;border-radius:2px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8A7E73;margin-bottom:6px;font-weight:600;">CLIENT MESSAGE:</div>
        <div style="color:#332C26;font-size:15px;line-height:1.7;white-space:pre-wrap;">${esc(f.message)}</div>
      </div>` : ''}

      <!-- Action Buttons -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #EFE9DE;">
        ${cleanPhone ? `
        <a href="https://wa.me/${cleanPhone}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:3px;font-size:14px;font-weight:600;letter-spacing:0.5px;margin-right:12px;margin-bottom:10px;">
          💬 Reply on WhatsApp
        </a>` : ''}
        ${f.email ? `
        <a href="mailto:${esc(f.email)}" style="display:inline-block;background:#16120F;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:3px;font-size:14px;font-weight:500;letter-spacing:0.5px;margin-bottom:10px;">
          ✉️ Reply by Email
        </a>` : ''}
      </div>

      <div style="margin-top:24px;color:#8A7E73;font-size:12px;line-height:1.5;">
        Submitted via <strong>${esc(f.pageUrl || BRAND.site)}</strong>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F7F4EE;padding:18px 30px;border-top:1px solid #EAE2D5;text-align:center;font-size:12px;color:#8A7E73;">
      ${BRAND.name} &bull; ${BRAND.address}
    </div>
  </div>
</body>
</html>`;
}

export function studioText(f) {
  return [
    '=== NEW CLIENT INQUIRY ===',
    `Name         : ${f.name || '-'}`,
    `Phone        : ${f.phone || '-'}`,
    `Email        : ${f.email || '-'}`,
    `Event Date   : ${f.date || '-'}`,
    `Service      : ${f.service || '-'}`,
    `Venue & City : ${f.venue || '-'}`,
    '',
    'Message:',
    f.message || '(No note provided)',
    '',
    `Source: ${f.pageUrl || BRAND.site}`
  ].join('\n');
}

/** The branded acknowledgement the visitor receives. */
export function visitorEmail(f) {
  const first = String(f.name || '').trim().split(/\s+/)[0];
  const greeting = first ? `Dear ${esc(first)},` : 'Hello,';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F0E6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:32px auto;background:#FFFFFF;border:1px solid #E6DCCD;border-radius:4px;overflow:hidden;box-shadow:0 6px 28px rgba(22,18,15,0.07);">

    <!-- Elegant Dark Header with Official Logo -->
    <div style="background:#14100D;padding:36px 24px;text-align:center;border-bottom:2px solid #B0854A;">
      <a href="${BRAND.site}" target="_blank" style="text-decoration:none;display:inline-block;">
        <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="height:52px;max-width:240px;width:auto;display:block;margin:0 auto;filter:brightness(0) invert(1);" />
      </a>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:12px;letter-spacing:3px;color:#D8B071;margin-top:12px;">Real Moments. Timeless Stories.</div>
    </div>

    <!-- Main Message -->
    <div style="padding:40px 34px 20px 34px;">
      <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#B0854A;font-weight:600;margin-bottom:12px;">ENQUIRY RECEIVED</div>
      <h1 style="margin:0 0 20px 0;font-family:Georgia,serif;font-size:28px;line-height:1.25;color:#16120F;font-weight:normal;">Thank you for reaching out to us.</h1>

      <p style="font-size:16px;line-height:1.7;color:#16120F;margin:0 0 16px 0;font-weight:500;">
        ${greeting}
      </p>

      <p style="font-size:15.5px;line-height:1.75;color:#4A4036;margin:0 0 18px 0;">
        Your inquiry has safely arrived with our studio team. We personally review every request—not automated bots—and will get back to you with availability and details <strong style="color:#16120F;">within 24 hours</strong>.
      </p>

      <p style="font-size:15.5px;line-height:1.75;color:#4A4036;margin:0 0 28px 0;">
        If your wedding date is approaching soon, or you'd love to chat directly with us right away, WhatsApp is always our fastest channel:
      </p>

      <!-- WhatsApp Action Button -->
      <div style="text-align:center;margin:30px 0;">
        <a href="${BRAND.whatsapp}" target="_blank" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:15px 32px;border-radius:3px;font-size:15px;font-weight:600;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(37,211,102,0.3);">
          Message Us on WhatsApp &rarr;
        </a>
      </div>
    </div>

    <!-- Summary of Submitted Details -->
    ${summaryBlock(f)}

    <!-- Sign-off Block -->
    <div style="padding:28px 34px 32px 34px;">
      <p style="font-size:15px;color:#665C52;margin:0 0 10px 0;font-style:italic;">Warmly,</p>
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#B0854A;">Anantha Ramu</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A7E73;margin-top:3px;font-weight:600;">Founder &amp; Lead Cinematographer</div>
    </div>

    <!-- Luxury Dark Footer -->
    <div style="background:#14100D;padding:32px 34px;color:#C9BFAE;font-size:13.5px;line-height:1.75;">
      <div style="font-family:Georgia,serif;font-size:18px;color:#F4EDE1;margin-bottom:8px;">${BRAND.name}</div>
      <div style="color:#A39788;margin-bottom:16px;">${BRAND.address}<br>Documenting weddings across India &amp; Worldwide</div>

      <div style="border-top:1px solid rgba(244,237,225,0.12);padding-top:16px;margin-top:16px;">
        <a href="tel:${BRAND.phone1.replace(/\s/g, '')}" style="color:#D8B071;text-decoration:none;font-weight:500;">${BRAND.phone1}</a>
        &nbsp;&bull;&nbsp;
        <a href="tel:${BRAND.phone2.replace(/\s/g, '')}" style="color:#D8B071;text-decoration:none;font-weight:500;">${BRAND.phone2}</a><br>
        <a href="mailto:${BRAND.email}" style="color:#D8B071;text-decoration:none;">${BRAND.email}</a>
        &nbsp;&bull;&nbsp;
        <a href="${BRAND.site}" style="color:#D8B071;text-decoration:none;">${BRAND.site.replace('https://', '')}</a>
      </div>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(244,237,225,0.08);font-size:11.5px;color:#7A6F62;">
        Studio Hours: ${BRAND.hours}<br>
        You are receiving this confirmation because you submitted an inquiry on our website.
      </div>
    </div>

  </div>
</body>
</html>`;
}

/** Summary block of what the client submitted. */
function summaryBlock(f) {
  const items = [
    ['Wedding / Event Date', f.date],
    ['Interested In', f.service],
    ['Venue & City', f.venue]
  ].filter(([, v]) => v);

  if (!items.length) return '';

  return `<div style="background:#F9F6F0;border:1px solid #EBE3D5;border-radius:3px;padding:20px 24px;margin:0 34px 10px 34px;">
    <div style="font-family:Georgia,serif;font-size:17px;color:#16120F;margin-bottom:12px;font-weight:500;">Inquiry Summary</div>
    <table style="width:100%;border-collapse:collapse;">
      ${items.map(([k, v]) => `
        <tr>
          <td style="padding:4px 12px 4px 0;color:#8A7E73;font-size:12.5px;font-weight:600;white-space:nowrap;vertical-align:top;">${esc(k)}:</td>
          <td style="padding:4px 0;color:#16120F;font-size:14px;">${esc(v)}</td>
        </tr>
      `).join('')}
    </table>
  </div>`;
}

export function visitorText(f) {
  const first = String(f.name || '').trim().split(/\s+/)[0];
  return [
    first ? `Dear ${first},` : 'Hello,',
    '',
    'Thank you for writing to Fusion Bells Films.',
    '',
    'Your inquiry has landed safely with our studio team. We personally review every inquiry and will get back to you with availability and details within 24 hours.',
    '',
    `If your date is close, WhatsApp is our quickest channel: ${BRAND.whatsapp}`,
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
    `Studio hours: ${BRAND.hours}`
  ].join('\n');
}

export { BRAND };
