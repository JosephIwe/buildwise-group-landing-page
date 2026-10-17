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
- `brief/brief.json`: entries for the future Business Opportunity Brief (empty for now)
- `tests/`: engine and browser tests
- `favicon.svg`: monogram favicon
- `assets/logo-mark.svg`: standalone vector of the B monogram
- `assets/hero-architecture.svg`: source for the empty architectural stage; `hero-architecture.webp` and `-sm.webp` are rasterised from it so the camera can move it cheaply

## Hero story
The hero background is a short story told with three articulated silhouettes: someone brings a problem in (Identify), hands it over (Design), a third person joins and the idea becomes a system (Build), and it resolves into a finished form (Deploy).

- One playhead drives the story. Autoplay moves it forward; scrolling through the pinned hero on desktop pushes it forward or rewinds it proportionally.
- Characters, object, lines, light and camera are keyframed in `hero-story.js` (`CAST`, `track(...)`). Each limb is a separate SVG group, and the object follows the holder's hands through forward kinematics.
- `?story=12` freezes the scene at that second, which is handy for design review.
- Rendering pauses when the hero is off screen or the tab is hidden. Under reduced motion the finished scene is shown still, and the rail and button step through key frames instead.

## AI Business Opportunity Scanner
`scan.html` asks seven short questions (four required, three skippable) and builds a report with three prioritised opportunities. Each one explains why it was selected and covers the problem, the proposed solution, qualitative benefits, complexity, dependencies, risks, a first experiment and an indicative sequence.

- **How reports are made.** `scanner-engine.js` is rule-based and runs in the browser. Every opportunity in `LIBRARY` lists the answers that point to it (`signals`), and the engine scores the library against the visitor's answers. There is no AI model, server, API key or running cost. To add or edit an opportunity, edit `LIBRARY`; the tests check every answer combination for leftover placeholders and invented figures.
- **Privacy.** Answers stay in the browser (`sessionStorage` keeps a draft). Report links (`#r=…`) carry the multiple-choice answers but never the optional notes, and the fragment is not sent to the server. Nothing reaches BuildWise unless the visitor sends the pre-filled email themselves.
- **Next steps.** "Request help" opens the visitor's email app addressed to `hello@josephiwe.com`, so it only works once that inbox is confirmed. "Save or email" offers a text download, print or PDF, a copyable link, and an email to yourself.
- **Analytics hook.** `scanner.js` dispatches a `bw:scanner` window event (and pushes to `window.dataLayer` if one exists) for `scanner_start`, `scanner_step_complete`, `scanner_report_view`, `scanner_opportunity_expand`, `scanner_explore_open`, `scanner_help_request`, `scanner_help_copy`, `scanner_report_download`, `scanner_report_print`, `scanner_report_copy_link`, `scanner_report_email`, `scanner_edit_answers`, `scanner_restart` and `scanner_error`. Events carry step numbers and opportunity ids only, never answers. No analytics tool is installed yet.

### Business Opportunity Brief
The report reads `brief/brief.json` and shows up to three related entries when any entry's `tags` match the visitor's bottleneck, objective, industry or recommended opportunity ids. It is empty today, so nothing shows. To publish an entry, add an item and merge it:

```json
{ "title": "Reading supplier invoices with AI", "summary": "A short worked example.", "date": "2026-11", "tags": ["document-processing", "admin"], "url": "/brief/supplier-invoices.html" }
```

`url` must start with `https://` or `/`.

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
- The mobile menu traps focus while open, closes on Escape and returns focus to the toggle.

## Before publishing
1. Confirm the public contact address `hello@josephiwe.com` receives mail, or change it in `index.html` and `CONTACT` in `scanner.js`.
2. Confirm `https://huntlyagent.com` is the preferred public Huntly URL.
3. Venture marks (H, T, M) are typographic placeholders, not official logos. Swap in approved logo files when they exist.
4. No client logos, testimonials, metrics or performance claims are included. Add them only with evidence and permission.
