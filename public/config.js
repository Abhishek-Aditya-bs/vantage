// Public runtime configuration, read by src/lib/config.ts via window.__VANTAGE__.
// Safe to commit: a Turnstile SITE key is PUBLIC by design (it ships in every
// page's HTML). The matching SECRET key is a Wrangler secret (TURNSTILE_SECRET),
// never in source. Loaded as a same-origin <script> so it passes the CSP.
window.__VANTAGE__ = {
  turnstileSiteKey: "0x4AAAAAADf8WhusAEpPl0Ig",
};
