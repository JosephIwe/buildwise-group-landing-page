# Buildwise Group landing page

Single-page static site for Buildwise Group, built to the Buildwise brand board: geometric "B" monogram, cobalt / graphite / slate / stone / off-white palette, editorial typography and restrained, cinematic motion.

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
- `security.html`, `.well-known/security.txt`, `SECURITY.md`: the vulnerability disclosure policy at `/security` (see Security disclosure)
- `cybersecurity.html`, `cybersecurity.css`: the Application & Cloud Security Review service page at `/cybersecurity` (linked from the main navigation, the "What we do" list and every footer); its enquiry form is the homepage form with the security review preselected
- `ai-automation.html`, `ai-automation.css`, `automation-form.js`, `content/ai-automation.mjs`: the AI business automation page at `/ai-automation` (generated; packages, Staff capability status and the assessment request form). Prices live only in `content/ai-automation.mjs`; `tests/ai-automation.test.js` fails if the page or structured data show any other price (and checks the internal proposal too when `PROPOSAL_PATH` points to it), or if a Staff capability is listed as available before it is.
- The reusable client proposal for AI business automation is an internal template kept in the project's shared files, not in this repository: everything here is deployed publicly, and `noindex` is not access control.
- `contact-form.js`: the project enquiry form in the contact section (validation and delivery through Web3Forms; off until an access key is added)
- `analytics.js`: Cloudflare Web Analytics loader (off until a site token is added)
- `social-links.js`: the one place official social profiles are listed; footers show a profile only once its verified URL is filled in (see Social profiles)
- `assets/fonts/`: self-hosted Manrope (variable, Latin subset) and its SIL Open Font License
- `brief/brief.json`: entries for the future Business Opportunity Brief (empty for now)
- `tests/`: engine and browser tests
- `favicon.svg`: monogram favicon; `apple-touch-icon.png` is the same mark for home screens and the structured-data logo
- `robots.txt`, `sitemap.xml`, `llms.txt`, `404.html`, `_headers`: discoverability files (see below)
- `assets/og-image.jpg`: 1200×630 social-sharing image
- `assets/logo-mark.svg`: standalone vector of the B monogram
- `assets/ventures/`: one product image per venture, supplied by the founder (Huntly landing page, Traider product page in `tradr-*`, Staff website on a reception display in `maya-*`; the VERAUS landing page in `veraus-*`, captured from a local build), kept at their own aspect ratio (uncropped) and exported at 480, 800 and 1200px wide as AVIF and WebP
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
- **Privacy.** Answers stay in the browser (`sessionStorage` keeps a draft and the open report for this tab). Answers are never left in the address bar: shareable links (`#r=…`) are only produced by "Copy link" or "Email to myself", carry the multiple-choice answers but never the optional notes or website (a link edited to include them is ignored), and are removed from the address bar as soon as they are opened. The scanner page explains this under "How your data is handled". Nothing reaches Buildwise unless the visitor sends the pre-filled email themselves.
- **Next steps.** "Request help" opens WhatsApp with a summary of the report prefilled for the visitor to edit and send. "Save or email" offers a text download, print or PDF, a copyable link, and an email to yourself.
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
- **What it requests.** The page (following up to 5 redirects), the `http://` or `https://` counterpart, `/robots.txt`, one sitemap (the first `Sitemap:` line, else `/sitemap.xml`) and up to 5 internal links. At most 20 requests and 4 hostnames per audit, 6 s per request, 20 s per audit, and it reads at most 1 MB of HTML, 200 KB of robots.txt and 1 MB of sitemap. GET only, as `BuildwiseAudit/1.0 (+https://buildwisegroup.dev/website-audit)`, no cookies, no JavaScript execution, no forms, no logins.
- **SSRF protection** (`lib/audit/net.mjs`). Only `http`/`https` on ports 80/443, no credentials, no IP literals (decimal, hex and octal forms included), no `localhost`, single-label or internal suffixes (`.local`, `.internal`, `.lan`, `.home.arpa` and others). Every hostname, including each redirect hop, is resolved over DNS-over-HTTPS (`cloudflare-dns.com`) first and refused if any A/AAAA record is private, loopback, link-local, CGNAT, multicast, reserved, documentation, metadata (169.254.169.254, fd00:ec2::254, 100.100.100.200) or outside IPv6 global unicast (which also covers mapped, NAT64, 6to4 and Teredo forms). Redirects are followed by hand so every hop is re-validated. Residual risk: Workers cannot pin the IP a check returned, so a record that changes between the check and the request (DNS rebinding) is not fully excluded; it is bounded because Workers cannot fetch IP addresses, resolve with the same Cloudflare resolver and have no private network or metadata service to reach.
- **Request limits** (`lib/audit/handler.mjs`). Same-origin JSON POSTs only (checked with `Origin` and `Sec-Fetch-Site`), 4 KB body, 5 audits per client IP per 10 minutes, 40 per 10 minutes and 3 at once, per Cloudflare isolate. Pages Functions do not support the Workers rate-limiting binding, so these counters are per location, not global. **Recommended:** add one zone rate-limiting rule for `/api/website-audit` (see "Cloudflare settings" below). Results are cached at the edge for 10 minutes under a SHA-256 key, so repeat audits of one address do not hit that site again.
- **Workers plan limits.** Functions requests share the account's Workers quota (100,000 a day on the free plan, shared with other Workers on the account) and the free plan allows 10 ms of CPU per request. Parsing is a single linear pass (no backtracking regexes, measured at about 1–7 ms for typical pages warm), but a very large page can exceed 10 ms on a cold start, in which case the visitor sees "Something went wrong" and can retry.
- **Findings** (`lib/audit/checks.mjs`). Each finding has a title, severity (Critical, High, Medium, Low), category, evidence (the URL, header, tag or robots.txt line), why it matters, a fix and any limits. *Confirmed* findings are measured facts; *recommendations* are judgement calls. Anything the audit could not measure goes under "What this audit could not check" instead of becoming a finding. There is deliberately no overall score.
- **Crawlers** (`lib/audit/crawlers.mjs`, reviewed 2026-10, each linked to its operator's documentation). robots.txt is parsed per RFC 9309 (`lib/audit/robots.mjs`: grouping, case-insensitive agents, longest match, allow wins ties, `*` and `$`, a linear wildcard matcher). Crawlers are labelled search, AI search, user-triggered fetch, AI training or usage-control token. Blocking search or AI search crawlers is a finding; blocking training crawlers is shown as "Opted out" and is not. The report never claims a crawler visited, indexed or cited the site, and says firewall/CDN bot rules cannot be seen.
- **Report safety.** The page inserts everything with `textContent`, links only to fixed `https:` documentation URLs, and `/website-audit` is served with a strict Content-Security-Policy from `_headers`. The report is `noindex` while shown, the audited address never appears in the page URL, and the report is kept only in this tab's `sessionStorage`.
- **Lead capture.** "Request help" opens WhatsApp with the audited address and finding titles prefilled; nothing is sent or stored automatically. Events (`audit_start`, `audit_report_view`, `audit_help_request`, `audit_help_copy`, `audit_report_download`, `audit_report_print`, `audit_error`, `audit_restart`) are dispatched as `bw:audit` window events with counts and error codes only, never the address.
- **Local testing.** `npm test` in `tests/` runs the audit with a fake network (`tests/fixtures/fake-net.mjs`). To run the real Function locally: `npx wrangler pages dev .` (it needs outbound access to `cloudflare-dns.com` and the target site).

## Discoverability
- **Canonical domain.** `https://buildwisegroup.dev` (the apex) is the canonical public address. Canonical URLs, `og:url`, structured data, `robots.txt`, `sitemap.xml` and `llms.txt` all use it. `www.buildwisegroup.dev` and `buildwise-group.pages.dev` should 301 to it; both redirects are Cloudflare dashboard settings (Bulk Redirects), not files in this repository, so they keep working for every path. Browsers carry the `#r=…` part of a scanner report link across a redirect, so old report links keep opening. Preview deployments (`<hash>.buildwise-group.pages.dev`, `<branch>.buildwise-group.pages.dev`) are not redirected and stay `noindex`.
- **Indexed pages.** The homepage (`/`), the scanner's start page (`/scan`), the website audit (`/website-audit`), the security review page (`/cybersecurity`), the privacy policy (`/privacy`) and the vulnerability disclosure policy (`/security`) are indexable and listed in the sitemap. `robots.txt` disallows `/api/`. Internal links use `/scan`, the address Pages serves `scan.html` at, so there is no redirect hop.
- **Service pages.** Eight service landing pages (`/ai-automation-nigeria`, `/ai-automation-lagos`, `/ai-agents`, `/whatsapp-automation`, `/custom-software-development`, `/ai-visibility`, `/business-automation`, `/ai-receptionist`) are indexable and in the sitemap. They are generated: edit `content/services.mjs`, run `node scripts/build-pages.mjs` and commit the output (`tests/growth.test.js` fails if the committed HTML is stale). Each has `WebPage`, `Service` and `BreadcrumbList` JSON-LD, an enquiry form preselected with its project type and its own `page` source, and its own WhatsApp prefill. Buildwise is remote-first: no address, no `LocalBusiness` markup, and the Lagos page says plainly there is no Lagos office.
- **Insights (articles).** Markdown in `content/insights/` is built into `/insights` and `/insights/<slug>`. Front matter `status: draft` pages carry `noindex, follow`, a visible "Draft for review" note, stay out of the sitemap and aren't linked from public pages. Set `status: published` (and keep `date`/`updated` current), rebuild, and the article joins the sitemap; `/insights` becomes indexable once one article is published. Link the Insights index from the main navigation at that point.
- **Scanner reports are not indexable.** Report contents are never in a URL a crawler can request: shared links keep the answers after `#` (never sent to the server) and are removed from the address bar on opening, and the open report lives in `sessionStorage`. As a second safeguard `scanner.js` adds `<meta name="robots" content="noindex">` while a report is on screen and removes it when the visitor returns to the questions.
- **Not-found pages.** Without `404.html`, Cloudflare Pages treats a site as a single-page app and answers every unknown path with the homepage and a 200. `404.html` gives those paths a real 404 with links home.
- **Non-page files.** The repository root is deployed as-is, so `_headers` sends `X-Robots-Tag: noindex` for `README.md`, `CHANGELOG.md`, `tests/`, `brief/`, `content/` and `scripts/`. Pages already adds `noindex` to preview deployments.
- **Structured data.** The homepage carries `Organization` and `WebSite` JSON-LD using only facts visible on the page (name, description, services, the three products as `Brand`s and the WhatsApp contact point). `sameAs` is added only for verified social profiles (see Social profiles). The homepage FAQ is plain HTML (`<details>`), so search engines read it; it has no `FAQPage` markup because Google limits FAQ rich results to well-known government and health sites, so the markup would add nothing. `/cybersecurity` carries `Service` (provided by that organisation) and `BreadcrumbList` JSON-LD; there is no `FAQPage` or review markup.
- **Crawler policy.** `robots.txt` allows every crawler, and names the search and AI-search crawlers (Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot) in their own groups so the decision is on record; each group repeats `Disallow: /api/` because a crawler only reads its most specific group. Search crawlers (Googlebot, Bingbot) and AI search/answer crawlers (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot) are what make Buildwise findable, so they must stay allowed. Model-training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended) are also allowed on purpose: the site is public marketing copy whose value comes from being known, there is nothing proprietary on it, and visitor answers never appear in a crawlable URL. To opt out of training later, add a `User-agent: <name>` / `Disallow: /` group per training crawler; do not block the search crawlers. The `buildwisegroup.dev` zone's own settings can override this file: "Block AI bots" (Security > Bots or AI Crawl Control) blocks AI crawlers at the edge, and "Manage your robots.txt" prepends Cloudflare's own rules. Keep AI search crawlers allowed there too.
- **`llms.txt`.** A short plain-text summary for AI tools that look for it. It is not a ranking factor and no major search engine is known to use it; it is kept because it costs nothing and repeats only what the homepage says. Update it when the services or ventures change.
- None of this guarantees indexing or inclusion in AI answers. Submit `https://buildwisegroup.dev/sitemap.xml` in Google Search Console and Bing Webmaster Tools to request crawling and see what is actually indexed.

## Conversion tracking
`analytics.js` pushes `generate_lead` (accepted enquiry, with project type and source page), `whatsapp_click`, `cta_click` (`data-track` buttons) and `ai_referral` (visits referred by chatgpt.com, perplexity.ai and similar) to `window.dataLayer`, without personal details. Cloudflare Web Analytics loads when `TOKEN` is set; Google Analytics 4 loads only when `GA4_ID` is set, and also receives the events. GA4 sets cookies, so update `/privacy` before turning it on.

## Tests
```bash
cd tests
npm install   # installs Playwright for the browser tests
npm test      # engine tests (node:test) and browser tests (Chromium)
```
The engine tests need nothing installed. If Chromium is already on the machine, set `CHROMIUM_PATH` to use it.

After a deploy or a Cloudflare settings change, check the live site (needs network access to it):
```bash
node scripts/check-production.mjs           # HTTP -> HTTPS 301s (path and query kept), HTTPS pages 200, audit API 405 to GET
node scripts/check-production.mjs --audit   # also runs one real audit of buildwisegroup.dev
```
It prints the status and `Location` each address actually returned and exits 1 if anything is off.

## Contact and project enquiries
The site offers exactly two contact routes: **WhatsApp** (`https://wa.me/2349165681202` with a prefilled greeting) and the **project enquiry form** in `#contact` (the same form, with "Application and cloud security review" preselected, is in `/cybersecurity#enquire`; its submissions say which page they came from in the `page` field and carry the project type in the subject). No email address is published anywhere (pages, structured data, llms.txt or scripts); `tests/contact.test.js` fails if one appears. WhatsApp is also in the footer and mobile menu, and the scanner and audit "Request help" buttons open WhatsApp with the report summary prefilled for the visitor to edit and send. There is no floating button or chat widget.

**How the form is delivered.** The form posts JSON from the browser to Web3Forms (`https://api.web3forms.com/submit`, free plan: 250 submissions a month). Web3Forms emails each accepted submission to the inbox its access key was created with. The recipient is set in the Web3Forms account, never in this repository or the page. The email subject is "New Buildwise Project Enquiry: <project type>", the sender stays Web3Forms', and reply-to is the prospect's email. Every field is included.

**The access key is public, not a secret.** `ACCESS_KEY` in `contact-form.js` is an alias for one inbox and can only send mail there; Web3Forms' free plan is designed for keys that sit in the browser. If it is ever emptied, the form hides itself and the WhatsApp route remains.

**Checking delivery:** on a preview, send one enquiry whose description starts with "TEST" and confirm it arrives in the Web3Forms account's inbox (including Spam).

**Security review page.** `/cybersecurity` describes scoped, authorised assessments only. Keep it free of certifications, team credentials, client logos, testimonials, results, prices, turnaround times, SLAs, 24/7 monitoring, incident response or guarantees unless the business can substantiate them; `tests/ui.test.js` checks for the obvious ones.

**Behaviour and safeguards.** Fields are validated and normalised in the browser (length limits, listed values only for project type, budget and contact method, control characters removed). A success message appears only when Web3Forms answers `success: true`; a rejection, rate limit, network error or 20-second timeout shows a plain message and keeps everything typed. The button is disabled while sending, so a double click sends once. A hidden `botcheck` honeypot is passed to Web3Forms, which rejects filled ones; Web3Forms also applies its own spam filtering. Nothing is stored by the site, and no cookies, analytics or third-party scripts are added. Web3Forms keeps submissions for 30 days on the free plan.

## Social profiles
`social-links.js` lists the official profiles: Instagram (`https://www.instagram.com/buildwisehq/`) and X (`https://x.com/buildwisex`), both confirmed by the founder on 30 October 2026. Each footer has an empty, hidden `<ul data-social-links>`; the script fills it only with profiles whose `url` is an `https://` address on that network's own host, so production never shows a placeholder or broken link. Links open in a new tab with `rel="noopener noreferrer me"` and an accessible name such as "Buildwise Group on Instagram (opens in a new tab)".

To publish a profile: put its address in `url`, add the same address to `sameAs` in the homepage `Organization` JSON-LD, and for X add `<meta name="twitter:site" content="@handle">`. `tests/ui.test.js` fails until the three agree, and checks that nothing social is published while the URLs are empty. To add another network, add an entry with its hosts and an icon in `ICONS` (LinkedIn and YouTube icons are already there).

## Industry experience and claims
The homepage "Technology built for real-world industries." section labels every area as a **client engagement**, a **Buildwise product** or a **capability**. Only client work may be called client work: today that is website maintenance and Maya for an aesthetics business, unnamed until the client gives permission. Huntly, Traider and Staff are Buildwise products, never client engagements. Businesses researched or contacted for outreach are not customers and must not appear. `tests/ui.test.js` checks the labels and bans customer-count, logo and testimonial wording.

## Cloudflare settings
These live in the Cloudflare dashboard for the `buildwisegroup.dev` zone, not in this repository.
- **HTTP to HTTPS:** SSL/TLS > Edge Certificates > **Always Use HTTPS** on. It answers every `http://` request on the zone with a 301 to the same host, path and query on `https://`. Pages does not do this for custom domains by itself, and `_redirects` cannot match on scheme. `*.pages.dev` is not part of the zone, so it is unaffected.
- **Audit API rate limit:** Security > Security rules > Create rule > Rate limiting rule. On the Free plan the rule can only match on URI path, counts per IP over a fixed 10-second period and blocks for 10 seconds, and the zone gets one such rule. Use `(http.request.uri.path eq "/api/website-audit")`, 2 requests per 10 seconds, action Block. Cloudflare counts per data center, so this is not one global counter. Static pages never match it.
- **Workers plan:** Pages Functions requests count towards the account's Workers plan. On Workers Free that is 100,000 requests a day, shared by every Worker and Pages Function in the same account, and 10 ms CPU per request. Only `/api/*` runs the Function (`_routes.json`); static pages are free and unlimited.

## Security disclosure
- `/security` (`security.html`) is the responsible-disclosure policy: report privately through GitHub private vulnerability reporting (`https://github.com/JosephIwe/buildwise-group-landing-page/security/advisories/new`), including for issues on the live site; WhatsApp and the enquiry form are only for asking for a private channel, never for details. It promises no response time, bounty, certification or security team; `tests/security.test.js` checks this.
- `/.well-known/security.txt` (RFC 9116) points `Contact:` at the same GitHub route and `Policy:` at `/security`. **`Expires:` must be renewed before it passes** (keep it under a year ahead); the test fails once it is less than 30 days away. `SECURITY.md` repeats the route for GitHub's Security tab.
- The route only works while **Settings > Security > Private vulnerability reporting** is enabled on the repository.

## Motion and accessibility
- Every response gets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` and a restrictive `Permissions-Policy` from `_headers`. Pages joins repeated headers with commas, so page-specific rules must not repeat these.
- Entrance sequence and line reveals use CSS keyframes; scroll reveals use IntersectionObserver; scroll work is batched with requestAnimationFrame.
- Everything is disabled under `prefers-reduced-motion: reduce`, and content is fully visible without JavaScript.
- Venture images are static. On devices with a fine pointer, hovering a card eases its photo to 1.03 inside a fixed 4:3 frame over 0.65s and lightens the overlay; the card, frame and text never move. Touch devices show the images as-is, and reduced motion removes the zoom.
- The mobile menu traps focus while open, closes on Escape and returns focus to the toggle.

## Before publishing
1. Do not publish an email address. Enquiries come through WhatsApp and the enquiry form (see Contact and project enquiries).
2. Confirm `https://huntlyagent.com` is the preferred public Huntly URL.
3. Venture marks (H, T, S) are typographic placeholders, not official logos. Swap in approved logo files when they exist.
4. Venture images are the founder-supplied product images, shown uncropped on a plain mat inside each 4:3 frame. They carry descriptive alt text. Any figures shown inside them are part of the supplied product images and are not repeated or restated in the site copy. The Staff image carries a small "Example employee: Maya · Receptionist" label so Staff reads as the platform and Maya as one employee built on it.
5. No client logos, testimonials, metrics or performance claims are included. Add them only with evidence and permission.
