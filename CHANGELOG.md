# Changelog

All notable changes to the BuildWise Group website. Newest first.

## Unreleased: SEO, AI visibility and growth upgrade (branch `growth-seo-upgrade`)

Built on top of PR #16 (/security) and PR #17 (experience/SEO upgrade), which are approved to merge first.

### Changed after owner review (3 Nov 2026)
- The phone field's example on every enquiry form (homepage, /cybersecurity and the eight service pages) is now the neutral `+[country code] 000 000 0000` instead of a UK number; the validation message matches.
- Regression tests guard the approved decisions: the homepage headline, the AI receptionist channel wording (WhatsApp and web chat first, voice assessed per project), drafts staying unpublished, analytics staying off, per-service form preselection and WhatsApp prefills.

### Added
- Eight service landing pages, each with one search intent: `/ai-automation-nigeria`, `/ai-automation-lagos`, `/ai-agents`, `/whatsapp-automation`, `/custom-software-development`, `/ai-visibility`, `/business-automation`, `/ai-receptionist`. Each page has a definition section, use cases, process, honest evidence, a "what we won't promise" note, an FAQ, related services and an embedded enquiry form.
- `WebPage` + `Service` + `BreadcrumbList` JSON-LD on every service page; `Article` + `BreadcrumbList` on articles.
- Ten Insights articles as **drafts** (`noindex`, not in the sitemap, not linked from public pages) at `/insights/<slug>`.
- `scripts/build-pages.mjs` and `content/`: the pages, the sitemap and the footer service links are generated from content files and committed, so Cloudflare Pages stays build-free.
- Enquiry project types: AI automation audit, WhatsApp automation, AI receptionist or voice agent, AI search visibility.
- Conversion events in `analytics.js` (`generate_lead`, `whatsapp_click`, `cta_click`, `ai_referral`) and an optional GA4 hook, off until a measurement ID is added.
- Footer "Services" links on every page; a service directory and an "AI automation audit" CTA in the homepage solutions section.
- `tests/growth.test.js` (13 tests): generated output is current, unique metadata, structured data rules, claims rules, form preselection, internal links, draft handling, robots groups, layout on phone and desktop, lead and click events.

### Changed
- Homepage positioning: H1 "Building intelligent businesses.", new supporting copy naming the services and the remote-first Nigeria + international model, "Book a consultation" as the primary CTA, "Explore our solutions" link, new title and meta description.
- Organization JSON-LD: `areaServed` (Nigeria, Worldwide), `slogan`, broader `knowsAbout`. No address, rating, founding date or employee count.
- `robots.txt`: explicit groups for Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot and Claude-SearchBot. Training crawlers are still allowed under `*` (unchanged).
- `llms.txt`: service list and remote-first description.
- Footer tagline "Building intelligent businesses." on every page.
- `_headers`: `noindex` for `CHANGELOG.md`, `content/` and `scripts/`.

### Removed
- Nothing. The previous hero line ("AI products. Business systems. Real impact.") is still in the social sharing image and can be restored from git history (`index.html` before this branch).
