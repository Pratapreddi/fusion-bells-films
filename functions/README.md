# Contact form email — setup

The website form posts to `/api/enquiry`, a Cloudflare Pages Function that
sends two emails:

1. **the enquiry** → to the studio
2. **a branded acknowledgement** → to the visitor (if they gave an email)

It deploys automatically with the site. No second host, no server to maintain.

---

## Why not Nodemailer

Nodemailer speaks SMTP over raw TCP sockets, which the Cloudflare Workers
runtime does not provide, so it cannot run here. Mail goes out over an HTTPS
API instead — which is faster anyway, and means no SMTP password is stored.

If you ever move this to a normal Node host (Vercel, Render), Nodemailer with
your Zoho SMTP credentials would work fine. It just cannot run on Cloudflare.

---

## 1. Get a sending key

Sign up at **resend.com** (free tier: 3,000 emails/month, 100/day — far more
than this form will ever use) and create an API key.

Brevo, Postmark or SendGrid all work too; only the `fetch` call in
`api/enquiry.js` would need changing.

---

## 2. Verify your domain — READ THIS BIT CAREFULLY

Resend needs to prove you own the domain before it will send as you. It gives
you DNS records to add.

> **Use a subdomain when it offers one — `send.fusionbellsfilms.com`.**
>
> Your live mail runs on Zoho:
> `fusionbellsfilms.com  MX → mx.zoho.in, mx2.zoho.in, mx3.zoho.in`
>
> Verifying on a subdomain keeps Resend's records completely separate from
> the records Zoho relies on, so your actual mailbox cannot be affected.

**The one mistake that breaks email:** a domain may have only **one** SPF
record. If `fusionbellsfilms.com` already has `v=spf1 ... include:zoho.in ...`
and you add a second `v=spf1` TXT record for Resend, SPF becomes invalid and
your mail starts landing in spam — including mail you send by hand from Zoho.

If you must send from the root domain, do not add a second record: extend the
existing one by adding Resend's `include:` to it.

---

## 3. Add the variables in Cloudflare

Dashboard → **Workers & Pages** → your project → **Settings** → **Variables
and Secrets**:

| Name | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | **Secret** (encrypted) | your key from step 1 |
| `MAIL_FROM` | Plain text | `Fusion Bells Films <hello@send.fusionbellsfilms.com>` |
| `MAIL_TO` | Plain text | `hello@fusionbellsfilms.com` |

`MAIL_FROM` must be on a domain you verified in step 2, or Resend rejects it.
`MAIL_TO` is where enquiries land and can be any address.

Add them to **Production** (and Preview, if you use preview deployments).

> Never put the API key in this repository. It belongs only in the Cloudflare
> dashboard, as a Secret.

Redeploy after adding variables — running deployments do not pick them up.

---

## 4. Test it

Submit the form on the live site with your own email in the Email field.
You should get the acknowledgement, and the studio should get the enquiry.

**If it fails**, the form will say so and offer WhatsApp rather than pretending
it worked. To see why: Cloudflare dashboard → your project → **Functions** →
**Real-time Logs**, then submit again. Common causes:

| Symptom | Cause |
|---|---|
| `RESEND_API_KEY is not set` | Variable missing, or added after the last deploy |
| Resend 403 / "domain not verified" | `MAIL_FROM` domain not verified in step 2 |
| Enquiry arrives, acknowledgement does not | Visitor left the Email field blank — by design |

---

## What is protected

- **Honeypot field** — a `Company` input hidden off-screen. Bots fill it,
  people never see it. Filled = silently discarded, and the bot is told
  "success" so it does not retry.
- **Escaping** — everything a visitor types is HTML-escaped before it goes
  into an email. Verified by parsing the generated HTML: hostile input creates
  zero scripts, iframes, images or event handlers.
- **Length caps** — every field is truncated, so no one can post a
  multi-megabyte body.
- **Honest failure** — if sending fails the visitor is told, and given a
  WhatsApp link with their message. It never shows a false confirmation.
- **Reply-To** — the studio email is set to reply straight to the visitor, so
  hitting Reply in your inbox does the right thing.

---

## Files

| File | Purpose |
|---|---|
| `functions/api/enquiry.js` | the endpoint |
| `functions/api/_templates.js` | email bodies (underscore = not routable) |
| `email/auto-reply-zoho.html` | separate: for Zoho's own auto-reply to direct email |

Note the form and direct email are **two different paths**. This function
handles the website form. Emails sent straight to `hello@fusionbellsfilms.com`
never touch Cloudflare — those need Zoho's own auto-reply.
