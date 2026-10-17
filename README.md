# BuildWise Group landing page

A responsive, cinematic single-page website implementation for BuildWise Group.

## Run locally
Open `index.html` in a browser, or serve this directory with any static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Files
- `index.html` — semantic page structure and copy
- `styles.css` — responsive visual system, custom CSS illustrations and motion
- `script.js` — reveal-on-scroll, scroll progress and mobile navigation

## Before publishing
1. Confirm the public contact email `hello@josephiwe.com` and change it in `index.html` if needed.
2. Confirm `https://huntlyagent.com` is the preferred public Huntly URL.
3. Replace venture copy/status with current approved wording before launch.
4. Add verified case studies, customer permissions, privacy/legal pages and analytics only when ready.
5. Consider hosting the page at `josephiwe.com/buildwise` and point DNS/deployment to your chosen host.

## Notes
- No fabricated customer logos, testimonials, revenue figures or performance metrics are included.
- Huntly is described as an assistant that recommends and drafts but does not submit applications.
- Tradr and Maya are presented conservatively; Maya is explicitly described as still being validated.
- The motion is custom-built with CSS and IntersectionObserver, and respects `prefers-reduced-motion`.
- Google Fonts are loaded remotely; system fallbacks are defined for offline use.
