/**
 * ============================================================
 * FUSION BELLS FILMS — email auto-responder  (GMAIL ONLY)
 * ============================================================
 *
 * !! IMPORTANT — THIS DOES NOT WORK FOR hello@fusionbellsfilms.com !!
 *
 * That address is hosted on ZOHO, not Gmail:
 *     fusionbellsfilms.com  MX -> mx.zoho.in, mx2.zoho.in, mx3.zoho.in
 *
 * This script reads a GMAIL inbox. Mail delivered to Zoho never reaches
 * Gmail, so this will never see it and will never reply.
 *
 * Use ONE of these instead:
 *   A. Set the auto-reply up inside Zoho Mail itself (recommended) and
 *      use email/auto-reply.html as the message body.
 *   B. Forward hello@fusionbellsfilms.com into a Gmail account, then this
 *      script works — but replies must still be sent through a verified
 *      "Send mail as" alias, or they will come from the Gmail address.
 *
 * Everything below is correct and tested for a Gmail-hosted mailbox.
 *
 * SETUP (about 5 minutes)
 *
 * 1. Sign in to the Google account that RECEIVES hello@fusionbellsfilms.com
 *    (if hello@ forwards into fusionbellsfilms@gmail.com, use that account).
 * 2. Go to https://script.google.com/ and click "New project".
 *    Name it "Fusion Bells Films Auto Reply".
 *      -> Keep this SEPARATE from the gallery script.
 * 3. Paste this whole file into Code.gs (replacing what is there).
 * 4. Click the "+" next to Files -> HTML. Name it exactly:  auto-reply
 *    Delete its contents and paste in everything from email/auto-reply.html
 * 5. If hello@fusionbellsfilms.com is a SEND-AS ALIAS on this account,
 *    leave SETTINGS.sendAs as it is. Gmail must already list it under
 *    Settings -> Accounts -> "Send mail as". If it is a full Workspace
 *    mailbox you are signed into directly, set sendAs to "".
 * 6. Run the function `testAutoReply` once. Google will ask for permission
 *    -> Review permissions -> choose the account -> Advanced -> Allow.
 *    Check your inbox: you should receive the email. Confirm it looks right.
 * 7. Run the function `installTrigger` once. That is it — replies now go
 *    out automatically, checked every 5 minutes.
 *
 * TO EDIT THE WORDING later: edit the auto-reply HTML file in this project.
 * TO PAUSE it: run `removeTrigger`.
 *
 * SAFETY — this will not create a mail loop. It:
 *   - never replies to no-reply / mailer-daemon / bounce style addresses
 *   - never replies to mail already flagged as automatic (Auto-Submitted,
 *     Precedence: bulk, mailing lists, other vacation responders)
 *   - never replies to yourself or your own domain
 *   - replies at most ONCE per thread (tracked by a Gmail label)
 *   - replies at most once per person per COOLDOWN_DAYS
 *   - leaves messages unread so you still see them normally
 */

const SETTINGS = {
  // Leave as the alias you send from; set to "" to send as the signed-in account.
  sendAs: 'hello@fusionbellsfilms.com',
  fromName: 'Fusion Bells Films',
  subject: 'Thank you for writing to Fusion Bells Films',

  // Your own addresses/domains — mail from these is ignored.
  ownDomains: ['fusionbellsfilms.com'],
  ownAddresses: ['fusionbellsfilms@gmail.com'],

  labelName: 'Auto-replied',
  lookbackDays: 2,      // only consider recent mail, so old inbox isn't blasted
  maxPerRun: 20,        // gentle cap per 5-minute run
  cooldownDays: 7       // same person won't get a second acknowledgement sooner
};

/** Main entry point — this is what the trigger calls. */
function sendAutoReplies() {
  const label = getOrCreateLabel_(SETTINGS.labelName);
  const query = 'in:inbox -label:"' + SETTINGS.labelName + '" newer_than:' + SETTINGS.lookbackDays + 'd';
  const threads = GmailApp.search(query, 0, SETTINGS.maxPerRun);

  threads.forEach(function (thread) {
    try {
      const messages = thread.getMessages();
      const first = messages[0];
      const from = first.getFrom();
      const address = extractAddress_(from);

      if (!address) { label.addToThread(thread); return; }

      if (isOwnAddress_(address)) { label.addToThread(thread); return; }
      if (isRobotAddress_(address)) { label.addToThread(thread); return; }
      if (isAutomatedMessage_(first)) { label.addToThread(thread); return; }
      if (weAlreadyRepliedIn_(thread)) { label.addToThread(thread); return; }
      if (inCooldown_(address)) { label.addToThread(thread); return; }

      const wasUnread = thread.isUnread();

      GmailApp.sendEmail(address, SETTINGS.subject, buildPlainBody_(), {
        htmlBody: buildHtmlBody_(extractName_(from)),
        name: SETTINGS.fromName,
        from: SETTINGS.sendAs || undefined,
        replyTo: SETTINGS.sendAs || undefined
      });

      label.addToThread(thread);
      rememberReply_(address);

      // Sending can flip the thread to read — put it back so you still spot it.
      if (wasUnread) thread.markUnread();

    } catch (err) {
      // Do NOT mark it replied — a misconfigured send-as alias fails every
      // time, and labelling here would silently bury real enquiries forever.
      // Retry a few times so fixing the alias makes it work retroactively,
      // then give up on that thread rather than looping indefinitely.
      const key = 'fail:' + thread.getId();
      const store = PropertiesService.getScriptProperties();
      const count = Number(store.getProperty(key) || 0) + 1;
      store.setProperty(key, String(count));
      console.error('Auto-reply failed (attempt ' + count + ') for "' +
                    thread.getFirstMessageSubject() + '": ' + err);
      if (count >= 3) {
        console.error('Giving up on this thread after 3 attempts. ' +
                      'Run diagnose() to see why sending is failing.');
        try { label.addToThread(thread); } catch (e) {}
      }
    }
  });
}

/* ------------------------------------------------------------------
   Message building
   ------------------------------------------------------------------ */

function buildHtmlBody_(name) {
  let html;
  try {
    html = HtmlService.createHtmlOutputFromFile('auto-reply').getContent();
  } catch (err) {
    // The HTML file is missing — fall back to plain text rather than fail.
    console.warn('auto-reply.html not found in this project; sending plain text only.');
    return null;
  }

  const greeting = name
    ? '<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:27px;color:#16120F;padding-bottom:16px;">Dear ' +
      escapeHtml_(name) + ',</div>'
    : '';

  return html.replace('<!--GREETING-->', greeting);
}

function buildPlainBody_() {
  return [
    'Thank you for writing to us.',
    '',
    'Your note has landed safely with the studio. Someone here reads every enquiry',
    'personally - not a bot - and you will hear back from us within 24 hours,',
    'usually a good deal sooner.',
    '',
    'If your date is close, or you would rather talk it through, WhatsApp is the',
    'quickest way to reach us: https://wa.me/918970511524',
    '',
    'A few details help us answer properly:',
    '  - Your wedding dates, and which events you would like covered',
    '  - The venue and city - or the destination, if you are travelling',
    '  - Whether you are after photography, films, or both',
    '  - Anything about the two of you we ought to know',
    '',
    'Warmly,',
    'Anantha Ramu',
    'Founder & Lead Cinematographer',
    '',
    '--',
    'FUSION BELLS FILMS',
    'Hosakerehalli, Bangalore, Karnataka 560085',
    '+91 89705 11524 / +91 74116 87671',
    'hello@fusionbellsfilms.com | https://fusionbellsfilms.com',
    'Studio hours - Monday to Saturday, 10:00 am to 7:00 pm IST',
    '',
    'This is an automatic acknowledgement, sent once so you know your email',
    'arrived. Replying to this message reaches us directly.'
  ].join('\n');
}

/* ------------------------------------------------------------------
   Guards
   ------------------------------------------------------------------ */

function extractAddress_(from) {
  const angled = from.match(/<([^>]+)>/);
  const raw = angled ? angled[1] : from;
  const clean = raw.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean) ? clean : null;
}

function extractName_(from) {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (!m) return '';
  const name = m[1].trim();
  // Ignore "names" that are just the address again.
  if (!name || name.indexOf('@') !== -1) return '';
  // First name only reads warmer, and avoids mangling long formal names.
  return name.split(/\s+/)[0];
}

function isOwnAddress_(address) {
  if (SETTINGS.ownAddresses.indexOf(address) !== -1) return true;
  return SETTINGS.ownDomains.some(function (d) {
    return address.slice(-(d.length + 1)) === '@' + d;
  });
}

function isRobotAddress_(address) {
  return /(^|[._-])(no-?reply|do-?not-?reply|noreply|mailer-daemon|postmaster|bounce[sd]?|notifications?|automated|auto-?confirm|newsletter|support-?bot)([._-]|@)/i
    .test(address) || /^(mailer-daemon|postmaster)@/i.test(address);
}

/** Reads the headers to spot other autoresponders, bulk mail and lists. */
function isAutomatedMessage_(message) {
  let head;
  try {
    head = message.getRawContent().slice(0, 6000);
  } catch (err) {
    return false;   // cannot read it; fall through to the other guards
  }
  return /^Auto-Submitted:\s*(?!no\b)/mi.test(head) ||
         /^Precedence:\s*(bulk|list|junk|auto_reply)/mi.test(head) ||
         /^X-Auto(reply|respond|-Response-Suppress)/mi.test(head) ||
         /^List-(Unsubscribe|Id):/mi.test(head) ||
         /^Return-Path:\s*<>\s*$/mi.test(head);
}

/** Have we already sent something into this conversation? */
function weAlreadyRepliedIn_(thread) {
  const me = Session.getActiveUser().getEmail().toLowerCase();
  return thread.getMessages().some(function (m) {
    const sender = extractAddress_(m.getFrom());
    return sender && (sender === me || isOwnAddress_(sender));
  });
}

function inCooldown_(address) {
  const store = PropertiesService.getScriptProperties();
  const key = 'replied:' + address;
  const last = store.getProperty(key);
  if (!last) return false;
  const days = (Date.now() - Number(last)) / 86400000;
  return days < SETTINGS.cooldownDays;
}

function rememberReply_(address) {
  PropertiesService.getScriptProperties().setProperty('replied:' + address, String(Date.now()));
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function escapeHtml_(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------
   Setup helpers — run these by hand from the editor
   ------------------------------------------------------------------ */

/** Sends one copy to yourself so you can check the design. */
function testAutoReply() {
  const me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, '[TEST] ' + SETTINGS.subject, buildPlainBody_(), {
    htmlBody: buildHtmlBody_('Anantha'),
    name: SETTINGS.fromName,
    from: SETTINGS.sendAs || undefined,
    replyTo: SETTINGS.sendAs || undefined
  });
  console.log('Test sent to ' + me + '. If it did not arrive, check that "' +
              SETTINGS.sendAs + '" is listed under Gmail Settings > Accounts > Send mail as.');
}

/** Turns the auto-responder on: checks for new mail every 5 minutes. */
function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('sendAutoReplies').timeBased().everyMinutes(5).create();
  console.log('Auto-responder is live — checking every 5 minutes.');
}

/** Turns it off again. */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendAutoReplies') ScriptApp.deleteTrigger(t);
  });
  console.log('Auto-responder trigger removed.');
}

/**
 * ============================================================
 * RUN THIS FIRST when an expected reply did not arrive.
 * ============================================================
 * Checks the setup, then walks recent inbox threads and prints, for each one,
 * exactly which guard stopped it — or that it would have been answered.
 * Nothing is sent and nothing is modified.
 */
function diagnose() {
  const line = '--------------------------------------------------';
  console.log(line);
  console.log('SETUP');
  console.log(line);

  let me = '';
  try { me = Session.getActiveUser().getEmail(); } catch (e) {}
  console.log('signed in as        : ' + (me || '(unknown — normal on consumer Gmail)'));

  let aliases = [];
  try { aliases = GmailApp.getAliases(); } catch (e) {}
  console.log('send-as aliases     : ' + (aliases.length ? aliases.join(', ') : '(none)'));

  const wantAlias = SETTINGS.sendAs;
  if (wantAlias) {
    const ok = aliases.indexOf(wantAlias) !== -1 || wantAlias === me;
    console.log('sendAs "' + wantAlias + '" usable: ' + (ok ? 'YES' : 'NO  <-- THIS WILL BREAK SENDING'));
    if (!ok) {
      console.log('   Fix: Gmail > Settings > Accounts > "Send mail as" > add and verify it,');
      console.log('   or set SETTINGS.sendAs = "" to send as ' + (me || 'this account') + '.');
    }
  }

  const triggers = ScriptApp.getProjectTriggers()
      .filter(function (t) { return t.getHandlerFunction() === 'sendAutoReplies'; });
  console.log('trigger installed   : ' + (triggers.length
      ? 'YES (' + triggers.length + ')' : 'NO  <-- run installTrigger()'));

  let htmlOk = true;
  try { HtmlService.createHtmlOutputFromFile('auto-reply').getContent(); }
  catch (e) { htmlOk = false; }
  console.log('auto-reply.html file: ' + (htmlOk ? 'found' : 'MISSING (plain text only)'));

  console.log('');
  console.log(line);
  console.log('RECENT INBOX THREADS');
  console.log(line);

  const threads = GmailApp.search('in:inbox newer_than:' + SETTINGS.lookbackDays + 'd', 0, 15);
  if (!threads.length) {
    console.log('No inbox mail in the last ' + SETTINGS.lookbackDays + ' days.');
    console.log('If you expected some: was it filtered to Spam or another tab?');
    console.log('This script only ever looks at in:inbox.');
  }

  threads.forEach(function (thread) {
    const first = thread.getMessages()[0];
    const from = first.getFrom();
    const address = extractAddress_(from);
    const subject = thread.getFirstMessageSubject();
    let verdict;

    if (!address)                          verdict = 'SKIP  unreadable From address';
    else if (isOwnAddress_(address))       verdict = 'SKIP  it is your own address/domain (self-reply guard)';
    else if (isRobotAddress_(address))     verdict = 'SKIP  looks like a no-reply/robot address';
    else if (isAutomatedMessage_(first))   verdict = 'SKIP  headers mark it as automated/bulk';
    else if (weAlreadyRepliedIn_(thread))  verdict = 'SKIP  thread already contains a message from you';
    else if (inCooldown_(address))         verdict = 'SKIP  already acknowledged within ' + SETTINGS.cooldownDays + ' days';
    else if (isLabelled_(thread))          verdict = 'SKIP  already labelled "' + SETTINGS.labelName + '"';
    else                                   verdict = 'WOULD REPLY';

    console.log(verdict + '  |  ' + (address || from) + '  |  ' + subject);
  });

  console.log('');
  console.log('Testing tip: send from an address that is NOT yours and NOT on');
  console.log('your own domain — a friend, or a personal account. Mail from');
  console.log('your own addresses is skipped on purpose to prevent mail loops.');
}

function isLabelled_(thread) {
  return thread.getLabels().some(function (l) { return l.getName() === SETTINGS.labelName; });
}

/** Clears the "already replied" memory, e.g. after testing. */
function resetReplyMemory() {
  const store = PropertiesService.getScriptProperties();
  Object.keys(store.getProperties()).forEach(function (k) {
    if (k.indexOf('replied:') === 0) store.deleteProperty(k);
  });
  console.log('Reply memory cleared.');
}
