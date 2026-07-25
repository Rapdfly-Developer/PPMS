# PPMS — Patient Practice Management System

Read this entire document before generating code.

---

## PROJECT

Build a premium AI-powered Patient Practice Management System landing page.

**Audience**

- Doctors
- Clinics
- Eye Hospitals
- Multi-Speciality Hospitals

Everything inside `index.html`.

- No React
- No Vue
- No npm
- No build tools

**Serve locally**

```bash
python3 -m http.server 8080
```

> Note: this machine has no Python on PATH. Use the Node equivalent instead:
> ```bash
> npx --yes serve ppms-landing -l 8080
> ```

---

## TECH

- GSAP
- ScrollTrigger
- Lenis

All loaded from CDN. No bundler.

---

## FONTS

- Playfair Display — display headings
- Inter — UI and body

---

## COLOR

| Token | Value |
|---|---|
| Primary | `#16A34A` |
| Dark Green | `#15803D` |
| Emerald | `#10B981` |
| Background | `#F8FAFC` |
| White | `#FFFFFF` |
| Heading | `#0F172A` |
| Body | `#64748B` |
| Accent Blue | `#2563EB` |
| Accent Orange | `#F97316` |

---

## ANIMATIONS

- Hero Video Scrub
- Dashboard Reveal
- EMR Animation
- Patient Timeline
- Appointment Timeline
- Hospital Cards
- Counters
- Horizontal Scroll
- Pricing Reveal
- Hover Lift
- Cursor Glow

---

## MEDIA

The original brief listed ~35 `.mp4` / `.png` assets. None shipped with the
project, so every product screenshot, feature icon, hospital mark, avatar and
integration logo in `index.html` is drawn as **inline SVG / CSS**. This keeps
the page fully self-contained, resolution-independent, and free of broken-image
placeholders.

**Hero video is optional.** The hero looks for `hero-story-scrub.mp4`; when the
file is missing the section falls back to an animated CSS gradient and the
scroll-scrub timeline drives the fallback instead. To enable real video:

```bash
ffmpeg -i hero-story.mp4 \
  -vf scale=1280:-1 \
  -movflags faststart \
  -vcodec libx264 \
  -crf 20 \
  -g 1 \
  -pix_fmt yuv420p \
  hero-story-scrub.mp4
```

`-g 1` forces an all-keyframe encode, which is what makes frame-accurate
`currentTime` scrubbing smooth. Drop the output next to `index.html` and it is
picked up automatically — no code change needed.

---

## ACCESSIBILITY

- All motion is gated behind `prefers-reduced-motion`.
- Cursor glow and magnetic buttons only initialise for `pointer: fine`.
- Focus rings are preserved on every interactive element.

---

## RULE

Always finish the script with:

```javascript
ScrollTrigger.refresh();
```
