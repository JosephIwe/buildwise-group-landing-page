# BuildWise Group landing page

Single-page static site for BuildWise Group, built to the BuildWise brand board: geometric "B" monogram, cobalt / graphite / slate / stone / off-white palette, editorial typography and restrained, cinematic motion.

## Run locally
Serve this directory with any static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. There is no build step; Cloudflare Pages serves the repository root as-is.

## Files
- `index.html`: page structure, copy and the inline SVG sprite (logo mark and icons)
- `styles.css`: brand tokens (`:root`), layout, responsive rules and motion
- `script.js`: scroll reveals, header state, progress bar, active navigation and the mobile menu
- `hero-story.js`: the animated hero story (articulated SVG characters, camera, lighting and the story rail)
- `scan.html`, `scanner.css`, `scanner.js`: the AI Business Opportunity Scanner page and its homepage entry point (`#scan`)
- `scanner-engine.js`: the scanner's questions, opportunity library and rule-based report engine
- `website-audit.html`, `website-audit.css`, `website-audit.js`: the Website & AI Visibility Audit page; `functions/api/website-audit.js` and `lib/audit/`: its server-side checks; `_routes.json`: runs Functions only for `/api/*`
- `analytics.js`: Cloudflare Web Analytics loader (off until a site token is added)
- `brief/brief.json`: entries for the future Business Opportunity Brief (empty for now)
- `tests/`: engine and browser tests
- `favicon.svg`: monogram favicon; `apple-touch-icon.png` is the same mark for home screens and the structured-data logo
- `robots.txt`, `sitemap.xml`, `llms.txt`, `404.html`, `_headers`: discoverability files (see below)
- `assets/og-image.jpg`: 1200×630 social-sharing image
- `assets/logo-mark.svg`: standalone vector of the B monogram
- `assets/ventures/`: one illustrative photo per venture (Huntly, Tradr, Maya), cropped to 4:3 and exported at 480, 800 and 1200px wide as AVIF and WebP
- `assets/hero-architecture.svg`: source for the empty architectural stage; `hero-architecture.webp` and `-sm.webp` are rasterised from it so the camera can move it cheaply

## Hero story
The hero background is a short story told with three articulated silhouettes: someone brings a problem in (Identify), hands it over (Design), a third person joins and the idea becomes a system (Build), and it resolves into a finished form (Deploy).

- One playhead drives the story. Autoplay moves it forward; scrolling through the pinned hero on desktop pushes it forward or rewinds it proportionally.
- Characters, object, lines, light and camera are keyframed in `hero-story.js` (`CAST`, `track(...)`). Each limb is a separate SVG group, and the object follows the holder's hands through forward kinematics.
- `?story=12` freezes the scene at that second, which is handy for design review.
- Rendering pauses when the hero is off screen or the tab is hidden. Under reduced motion the finished scene is shown still, and the rail and button step through key frames instead.

## AI Business Opportunity Scanner
`scan.html` asks eight short questions (four required, four skippable, including budget and technical capacity) and builds a report with up to three prioritised opportunities. Each one explains why it was selected and covers the problem, how the solution works, why it matches, qualitative benefits, complexity, dependencies, risks and human review, a first step and sequence, success metrics, and the information needed to estimate cost or ROI.

- **How reports are made.** `scanner-engine.js` is rule-based and runs in the browser. It ranks a fixed library of 18 patterns (`LIBRARY`) against the visitor's answers, so it can miss opportunities outside the library; the report says so. There is no AI model, server, API key or running cost. Reports are general recommendations, not verified findings, and say so.
- **Scoring.** Points come only from answers that describe the problem: the biggest bottleneck (6 direct, 1 partial), repetitive tasks (3 each, capped at 6), words in the notes (2 each, capped at 4), the objective (2, or 6 when it is the pattern's core objective), industry (1) and stage (up to 2). Tools never add points; they only change complexity. Complexity, AI and the visitor's capacity adjust the ranking, not the evidence. Each opportunity shows its points in "How this was scored".
- **Match labels.** "Strong" needs a direct bottleneck match plus two other strong signals, "Good" a direct bottleneck plus one (or two strong signals), "Partial" one specific signal, and anything else is a "General suggestion". When nothing reaches Good, the report is headed "Starting points" and suggests how to sharpen the answers. The report shows fewer than three opportunities rather than padding with poor fits.
- **Distinct and simplest first.** Only one opportunity per problem area is shown; the runner-up appears as "Also considered". AI patterns need a strong signal, are dropped for small budgets with no technical staff, and name the simpler non-AI option to try first (a help centre, status notifications or off-the-shelf software are in the library for this reason).
- **Copy rules.** Benefits start with "Could", "Would", "Keeps" or "Lets" and are framed as outcomes to validate, never typical or proven results. Each opportunity lists its costs and dependencies, and AI options name the human review they need. The tests enforce this and check every answer combination for placeholders and invented figures.
- **Optional website.** The last question ("Anything else") also has an optional website field, so the flow stays at eight questions. It is context only: the scanner never visits, fetches or checks it, it does not change the ranking, and the report says "You added example.com, but the scanner did not visit or check it. This report is based only on your answers." `normalizeWebsite` in `scanner-engine.js` accepts only public-looking `http`/`https` addresses on the default ports (no IP addresses, `localhost`, internal names or credentials) and keeps just the host and path, so a query string or fragment is never stored or repeated. Invalid input shows an error on that question; Skip clears it.
- **Privacy.** Answers stay in the browser (`sessionStorage` keeps a draft and the open report for this tab). Answers are never left in the address bar: shareable links (`#r=…`) are only produced by "Copy link" or "Email to myself", carry the multiple-choice answers but never the optional notes or website (a link edited to include them is ignored), and are removed from the address bar as soon as they are opened. The scanner page explains this under "How your data is handled". Nothing reaches BuildWise unless the visitor sends the pre-filled email themselves.
- **Next steps.** "Request help" opens the visitor's email app addressed to `hello@josephiwe.com`, so it only works once that inbox is confirmed. "Save or email" offers a text download, print or PDF, a copyable link, and an email to yourself.
- **Analytics hook.** `scanner.js` dispatches a `bw:scanner` window event (and pushes to `window.dataLayer` if one exists) for `scanner_start`, `scanner_step_complete`, `scanner_report_view`, `scanner_opportunity_expand`, `scanner_explore_open`, `scanner_help_request`, `scanner_help_copy`, `scanner_report_download`, `scanner_report_print`, `scanner_report_copy_link`, `scanner_report_email`, `scanner_edit_answers`, `scanner_restart` and `scanner_error`. Events carry step numbers and opportunity ids only, never answers. These events stay in the page: Cloudflare Web Analytics cannot receive custom events.
- **Cloudflare Web Analytics.** `analytics.js` loads Cloudflare's cookie-free beacon on the homepage and the scanner page once `TOKEN` is filled in with the site token from the Cloudflare dashboard (Web Analytics > Add a site > manual snippet; it is public, not a secret). It counts page views, so the funnel it shows is homepage visits to scanner visits. It is not loaded on a page opened from a report link. Measuring steps inside the scanner (completions, help requests) would need an events-capable tool listening to `bw:scanner`. Use this manual token rather than the Pages "automatic setup" toggle: automatic injection adds the beacon to every page, including pages opened from a report link.

### Business Opportunity Brief
The report reads `brief/brief.json` and shows up to three related entries when any entry's `tags` match the visitor's bottleneck, objective, industry or recommended opportunity ids. It is empty today, so nothing shows. To publish an entry, add an item and merge it:

```json
{ "title": "Reading supplier invoices with AI", "summary": "A short worked example.", "date": "2026-11", "tags": ["document-processing", "admin"], "url": "/brief/supplier-invoices.html" }
```

`url` must start with `https://` or `/`.

## Website & AI Visibility Audit
`/website-audit` (`website-audit.html`, `website-audit.css`, `website-audit.js`) checks one public page and reports technical SEO, crawler access and content-clarity findings with evidence. It is a separate funnel from the scanner: the scanner never fetches the website it is given, and its report only links here (handing the address over in `sessionStorage`, never in a URL).

- **Why a server function.** Browsers cannot read another site's HTML or robots.txt (CORS), so the fetching runs in a Cloudflare Pages Function inside the existing `buildwise-group` Pages project: `functions/api/website-audit.js` (POST only) using `lib/audit/`. `_routes.json` limits Functions to `/api/*`, so every other page stays a free static asset. No new service, database, key or paid plan.
- **What it requests.** The page (following up to 5 redirects), the `http://` or `https://` counterpart, `/robots.txt`, one sitemap (the first `Sitemap:` line, else `/sitemap.xml`) and up to 5 internal links. At most 20 requests and 4 hostnames per audit, 6 s per request, 20 s per audit, and it reads at most 1 MB of HTML, 200 KB of robots.txt and 1 MB of sitemap. GET only, as `BuildWiseAudit/1.0 (+https://buildwisegroup.dev/website-audit)`, no cookies, no JavaScript execution, no forms, no logins.
- **SSRF protection** (`lib/audit/net.mjs`). Only `http`/`https` on ports 80/443, no credentials, no IP literals (decimal, hex and octal forms included), no `localhost`, single-label or internal suffixes (`.local`, `.internal`, `.lan`, `.home.arpa` and others). Every hostname, including each redirect hop, is resolved over DNS-over-HTTPS (`cloudflare-dns.com`) first and refused if any A/AAAA record is private, loopback, link-local, CGNAT, multicast, reserved, documentation, metadata (169.254.169.254, fd00:ec2::254, 100.100.100.200) or outside IPv6 global unicast (which also covers mapped, NAT64, 6to4 and Teredo forms). Redirects are followed by hand so every hop is re-validated. Residual risk: Workers cannot pin the IP a check returned, so a record that changes between the check and the request (DNS rebinding) is not fully excluded; it is bounded because Workers cannot fetch IP addresses, resolve with the same Cloudflare resolver and have no private network or metadata service to reach.
- **Request limits** (`lib/audit/handler.mjs`). Same-origin JSON POSTs only (checked with `Origin` and `Sec-Fetch-Site`), 4 KB body, 5 audits per client IP per 10 minutes, 40 per 10 minutes and 3 at once, per Cloudflare isolate. Pages Functions do not support the Workers rate-limiting binding, so these counters are per location, not global. **Recommended:** add one zone rate-limiting rule in the Cloudflare dashboard (Security > WAF > Rate limiting rules; the free plan includes one) for `/api/website-audit`, for example 10 requests per minute per IP. Results are cached at the edge for 10 minutes under a SHA-256 key, so repeat audits of one address do not hit that site again.
- **Workers plan limits.** Functions requests share the account's Workers quota (100,000 a day on the free plan, shared with other Workers on the account) and the free plan allows 10 ms of CPU per request. Parsing is a single linear pass (no backtracking regexes, measured at about 1–7 ms for typical pages warm), but a very large page can exceed 10 ms on a cold start, in which case the visitor sees "Something went wrong" and can retry.
- **Findings** (`lib/audit/checks.mjs`). Each finding has a title, severity (Critical, High, Medium, Low), category, evidence (the URL, header, tag or robots.txt line), why it matters, a fix and any limits. *Confirmed* findings are measured facts; *recommendations* are judgement calls. Anything the audit could not measure goes under "What this audit could not check" instead of becoming a finding. There is deliberately no overall score.
- **Crawlers** (`lib/audit/crawlers.mjs`, reviewed 2026-10, each linked to its operator's documentation). robots.txt is parsed per RFC 9309 (`lib/audit/robots.mjs`: grouping, case-insensitive agents, longest match, allow wins ties, `*` and `$`, a linear wildcard matcher). Crawlers are labelled search, AI search, user-triggered fetch, AI training or usage-control token. Blocking search or AI search crawlers is a finding; blocking training crawlers is shown as "Opted out" and is not. The report never claims a crawler visited, indexed or cited the site, and says firewall/CDN bot rules cannot be seen.
- **Report safety.** The page inserts everything with `textContent`, links only to fixed `https:` documentation URLs, and `/website-audit` is served with a strict Content-Security-Policy from `_headers`. The report is `noindex` while shown, the audited address never appears in the page URL, and the report is kept only in this tab's `sessionStorage`.
- **Lead capture.** "Request help" opens the visitor's own email app addressed to `hello@josephiwe.com` with the audited address and finding titles; nothing is sent or stored automatically. Events (`audit_start`, `audit_report_view`, `audit_help_request`, `audit_help_copy`, `audit_report_download`, `audit_report_print`, `audit_error`, `audit_restart`) are dispatched as `bw:audit` window events with counts and error codes only, never the address.
- **Local testing.** `npm test` in `tests/` runs the audit with a fake network (`tests/fixtures/fake-net.mjs`). To run the real Function locally: `npx wrangler pages dev .` (it needs outbound access to `cloudflare-dns.com` and the target site).

## Discoverability
- **Canonical domain.** `https://buildwisegroup.dev` (the apex) is the canonical public address. Canonical URLs, `og:url`, structured data, `robots.txt`, `sitemap.xml` and `llms.txt` all use it. `www.buildwisegroup.dev` and `buildwise-group.pages.dev` should 301 to it; both redirects are Cloudflare dashboard settings (Bulk Redirects), not files in this repository, so they keep working for every path. Browsers carry the `#r=…` part of a scanner report link across a redirect, so old report links keep opening. Preview deployments (`<hash>.buildwise-group.pages.dev`, `<branch>.buildwise-group.pages.dev`) are not redirected and stay `noindex`.
- **Indexed pages.** The homepage (`/`), the scanner's start page (`/scan`) and the website audit (`/website-audit`) are indexable and listed in the sitemap. `robots.txt` disallows `/api/`. Internal links use `/scan`, the address Pages serves `scan.html` at, so there is no redirect hop.
- **Scanner reports are not indexable.** Report contents are never in a URL a crawler can request: shared links keep the answers after `#` (never sent to the server) and are removed from the address bar on opening, and the open report lives in `sessionStorage`. As a second safeguard `scanner.js` adds `<meta name="robots" content="noindex">` while a report is on screen and removes it when the visitor returns to the questions.
- **Not-found pages.** Without `404.html`, Cloudflare Pages treats a site as a single-page app and answers every unknown path with the homepage and a 200. `404.html` gives those paths a real 404 with links home.
- **Non-page files.** The repository root is deployed as-is, so `_headers` sends `X-Robots-Tag: noindex` for `README.md`, `tests/` and `brief/`. Pages already adds `noindex` to preview deployments.
- **Structured data.** The homepage carries `Organization` and `WebSite` JSON-LD using only facts visible on the page (name, address, email, description and venture names).
- **Crawler policy.** `robots.txt` allows every crawler. Search crawlers (Googlebot, Bingbot) and AI search/answer crawlers (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot) are what make BuildWise findable, so they must stay allowed. Model-training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended) are also allowed on purpose: the site is public marketing copy whose value comes from being known, there is nothing proprietary on it, and visitor answers never appear in a crawlable URL. To opt out of training later, add a `User-agent: <name>` / `Disallow: /` group per training crawler; do not block the search crawlers. The `buildwisegroup.dev` zone's own settings can override this file: "Block AI bots" (Security > Bots or AI Crawl Control) blocks AI crawlers at the edge, and "Manage your robots.txt" prepends Cloudflare's own rules. Keep AI search crawlers allowed there too.
- **`llms.txt`.** A short plain-text summary for AI tools that look for it. It is not a ranking factor and no major search engine is known to use it; it is kept because it costs nothing and repeats only what the homepage says. Update it when the services or ventures change.
- None of this guarantees indexing or inclusion in AI answers. Submit `https://buildwisegroup.dev/sitemap.xml` in Google Search Console and Bing Webmaster Tools to request crawling and see what is actually indexed.

## Tests
```bash
cd tests
npm install   # installs Playwright for the browser tests
npm test      # engine tests (node:test) and browser tests (Chromium)
```
The engine tests need nothing installed. If Chromium is already on the machine, set `CHROMIUM_PATH` to use it.

## Motion and accessibility
- Entrance sequence and line reveals use CSS keyframes; scroll reveals use IntersectionObserver; scroll work is batched with requestAnimationFrame.
- Everything is disabled under `prefers-reduced-motion: reduce`, and content is fully visible without JavaScript.
- Venture images are static. On devices with a fine pointer, hovering a card eases its photo to 1.03 inside a fixed 4:3 frame over 0.65s and lightens the overlay; the card, frame and text never move. Touch devices show the images as-is, and reduced motion removes the zoom.
- The mobile menu traps focus while open, closes on Escape and returns focus to the toggle.

## Before publishing
1. Confirm the public contact address `hello@josephiwe.com` receives mail, or change it in `index.html` and `CONTACT` in `scanner.js`.
2. Confirm `https://huntlyagent.com` is the preferred public Huntly URL.
3. Venture marks (H, T, M) are typographic placeholders, not official logos. Swap in approved logo files when they exist.
4. Venture photos are AI-generated illustrations of each venture's theme, not product screenshots or real customers. Screens in them are deliberately unreadable so they show no figures. They are decorative (`alt=""`); the card text carries the meaning.
5. No client logos, testimonials, metrics or performance claims are included. Add them only with evidence and permission.
