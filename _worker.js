/**
 * Cloudflare Worker / Pages Entrypoint (_worker.js)
 * ============================================================
 * Handles /api/enquiry endpoints and delegates all static asset
 * requests (HTML, CSS, images, videos) to Cloudflare Assets.
 */

import { onRequestPost } from './functions/api/enquiry.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route API enquiries
    if (url.pathname === '/api/enquiry' || url.pathname === '/api/enquiry/') {
      if (request.method === 'POST') {
        return onRequestPost({ request, env, params: {}, ctx });
      }
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Pass through all static assets (HTML, CSS, JS, WebP, etc.)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return fetch(request);
  }
};
