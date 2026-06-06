import { buildBadge } from '../../lib/render.js';

// Resolve the badge slug (everything after "/badge/") from the request.
//
// This function is a catch-all (api/badge/[...slug].js) that is also reached
// via the vercel.json rewrite from /badge/*. When invoked through that rewrite
// Vercel does not reliably populate the dynamic `slug` param on req.query, so
// the path — which is always present on req.url — is the source of truth. The
// raw (still percent-encoded) value is returned; decoding happens downstream in
// parsePath(). req.query.slug is honoured as a fallback for direct invocations.
function badgeSlug(req) {
  const path = (req.url || '').split('?')[0];
  const m = path.match(/\/badge\/(.+)$/);
  if (m && m[1]) return m[1];

  const raw = req.query && req.query.slug;
  if (Array.isArray(raw)) return raw.join('/');
  return String(raw || '');
}

// Vercel serverless function. Mounted at /api/badge/* and (via vercel.json
// rewrite) also at /badge/* so the URLs are drop-in compatible with
// https://img.shields.io/badge/... and custom-icon-badges.demolab.com/badge/...
export default function handler(req, res) {
  const sendSvg = (svg) => {
    res.setHeader('Content-Type', 'image/svg+xml;charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );
    res.statusCode = 200;
    res.end(svg);
  };

  try {
    sendSvg(buildBadge(badgeSlug(req), req.query || {}));
  } catch (err) {
    // Never 500 on a badge endpoint — return a visible "error" badge whose
    // message carries the failure reason (truncated), so the cause is readable
    // straight from the rendered badge / the X-Badge-Error header.
    const reason = String((err && err.message) || err || 'error')
      .replace(/[-_]/g, ' ')
      .slice(0, 60);
    try {
      res.setHeader('X-Badge-Error', reason.slice(0, 120));
    } catch (_) {
      /* headers already sent */
    }
    try {
      sendSvg(buildBadge(`badge-${reason}-red`, { style: 'flat' }));
    } catch (_) {
      res.statusCode = 500;
      res.end('badge error: ' + reason);
    }
  }
}
