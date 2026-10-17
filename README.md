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
- `favicon.svg`: monogram favicon
- `assets/logo-mark.svg`: standalone vector of the B monogram
- `assets/hero-architecture.svg`: source for the empty architectural stage; `hero-architecture.webp` and `-sm.webp` are rasterised from it so the camera can move it cheaply

## Hero story
The hero background is a short story told with three articulated silhouettes: someone brings a problem in (Identify), hands it over (Design), a third person joins and the idea becomes a system (Build), and it resolves into a finished form (Deploy).

- One playhead drives the story. Autoplay moves it forward; scrolling through the pinned hero on desktop pushes it forward or rewinds it proportionally.
- Characters, object, lines, light and camera are keyframed in `hero-story.js` (`CAST`, `track(...)`). Each limb is a separate SVG group, and the object follows the holder's hands through forward kinematics.
- `?story=12` freezes the scene at that second, which is handy for design review.
- Rendering pauses when the hero is off screen or the tab is hidden. Under reduced motion the finished scene is shown still, and the rail and button step through key frames instead.

## Motion and accessibility
- Entrance sequence and line reveals use CSS keyframes; scroll reveals use IntersectionObserver; scroll work is batched with requestAnimationFrame.
- Everything is disabled under `prefers-reduced-motion: reduce`, and content is fully visible without JavaScript.
- The mobile menu traps focus while open, closes on Escape and returns focus to the toggle.

## Before publishing
1. Confirm the public contact address `hello@josephiwe.com` receives mail, or change it in `index.html`.
2. Confirm `https://huntlyagent.com` is the preferred public Huntly URL.
3. Venture marks (H, T, M) are typographic placeholders, not official logos. Swap in approved logo files when they exist.
4. No client logos, testimonials, metrics or performance claims are included. Add them only with evidence and permission.
