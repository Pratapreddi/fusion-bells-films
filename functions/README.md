# Contact Form Email — Setup (Zoho ZeptoMail)

The website contact form posts to `/api/enquiry`, a Cloudflare Pages Function that sends two emails:

1. **The Enquiry** → delivered to the studio (`hello@fusionbellsfilms.com`)
2. **Branded Auto-Reply** → sent to the visitor confirming receipt

It deploys automatically with the site directly on Cloudflare Pages.

---

## Why Zoho ZeptoMail API?

Cloudflare Workers/Pages runs in an edge V8 environment that does not support raw TCP/SMTP sockets. 

**Zoho ZeptoMail** is Zoho's official transactional email API. It connects directly over **HTTPS REST API** (`https://api.zeptomail.in/v1.1/email`), meaning your emails are sent through your verified **Zoho Mail domain** without requiring third-party email providers.

---

## Step 1: Get your Zoho ZeptoMail Send Mail Token

1. Go to **[https://zeptomail.zoho.in](https://zeptomail.zoho.in)** (if your Zoho account is based in India) or **[https://zeptomail.zoho.com](https://zeptomail.zoho.com)**.
2. Log in with your **Zoho Mail account** credentials.
3. Click **Mail Agents** → **Add Mail Agent** (name it `Website-Contact-Form`).
4. In the **Domains** section, add and verify `fusionbellsfilms.com` (since your domain already uses Zoho Mail, verification is instant).
5. Go to the **Setup Info** tab → copy the **Send Mail Token** (starts with `Zoho-enczapikey ...`).

---

## Step 2: Add the Environment Variables in Cloudflare Pages

1. Log in to **[dash.cloudflare.com](https://dash.cloudflare.com)**.
2. Go to **Workers & Pages** → click **fusion-bells-films**.
3. Go to **Settings** → **Variables and Secrets**.
4. Click **Add variable**:

| Variable Name | Type | Value |
|---|---|---|
| `ZOHO_ZEPTOMAIL_TOKEN` | **Secret** (encrypted) | Paste your Zoho Send Mail Token |
| `MAIL_FROM` | Plain text | `Fusion Bells Films <hello@fusionbellsfilms.com>` |
| `MAIL_TO` | Plain text | `hello@fusionbellsfilms.com` |

5. Click **Save and Deploy**.

---

## Step 3: Test Live

1. Open `https://fusionbellsfilms.com/#contact`.
2. Fill out the form with your name, phone, email, date, and a test note.
3. Submit the form:
   - The studio will receive the enquiry with direct client details.
   - The visitor will immediately receive the branded auto-reply confirmation.
