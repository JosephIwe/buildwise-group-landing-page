/* POST /api/website-audit: the Website & AI Visibility Audit. See lib/audit/. */
import { createLimiter, errorResponse, handleAudit } from '../../lib/audit/handler.mjs';

// Lives as long as this isolate does; see the note in handler.mjs.
const limiter = createLimiter();

export const onRequestPost = context => handleAudit(context.request, {
  fetch: (url, init) => fetch(url, init),
  cache: typeof caches !== 'undefined' ? caches.default : null,
  limiter,
  waitUntil: promise => context.waitUntil(promise)
});

export const onRequest = () => errorResponse('method_not_allowed', { allow: 'POST' });
