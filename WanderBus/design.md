# WanderBus design system & redesign spec

> A bus ride you can play with.
> Status: v1, 4 Nov 2026. Deadline: Week 12, Fri 6 Nov, 9am.
> The build happens in tiers: finish Tier 0 before Tier 1, and Tier 1 before Tier 2.

This document is the single source of truth for how WanderBus looks, moves and responds.
- §0 records the audit of the app as it stood on 4 Nov 2026.
- §1–§3 define the system.
- §4 applies it page by page.
- §6 maps everything to the grading criteria.

---

## 0. Audit: where we started

### 0.1 Automated checks (4 Nov 2026)
**Taste lint**, run as `node ~/.claude/skills/design-taste-frontend/scripts/lint.mjs app`: **116 FAIL, 33 WARN**.

| Finding | Count | Examples |
|---|---|---|
| Emoji used as UI | 78 | `LandingFeatures.vue:3-7`, `LandingHero.vue:27`, map pins, passport timeline |
| Resting shadows | 20 | `SpinFilters.vue:191,206,240,277,365`, `ActivityCard.vue:102` |
| 1px divider rules | 12 | `main.css:28-29`, `GroupLobby.vue:259`, `LandingFeatures.vue:41`, `SiteFooter.vue:103` |
| Gradients | 6 | `SpinResults.vue:206,241`, `PlaceCard.vue:84`, `AuthCard.vue:39`, `SpinTicket.vue:200`, `StopMap.vue:294` (radar, keep) |
| 1px outlined boxes (warn) | 29 | `GroupLobby.vue:181`, `LandingSafety.vue:90,134`, `SpinFilters.vue:138,185` |
| Backdrop blur (warn) | 2 | `SpinFilters.vue:287,363` |
| `transition: all` | 1 | `passport.vue:632` |
| `100vh` | 1 | `main.css:16` |

**WCAG 2.2 contrast** (AA needs 4.5:1 for text and 3:1 for large text and UI edges):

| Pair | Ratio | Verdict |
|---|---|---|
| Amber `#f5a623` text on white, or white on amber | 2.03 | **FAIL** |
| Signpost amber `#f5a623` on its tint `#fdf3d7` | 1.83 | **FAIL** |
| White on disabled green `#9cc9b5` | 1.84 | **FAIL** |
| Input border `#c9ccd6` on white (UI edge, needs 3:1) | 1.60 | **FAIL** |
| Footer `#6b7085` on navy `#141a33` | 3.3 | **FAIL** |
| Food `#d1432f`, nature `#1e8a4c`, challenge `#2d6fd3` and shopping `#c27c0e` on their tints | 3.1–4.2 | below AA |
| Ink, body text, white on green, footer links | 5.4–16.3 | pass |

**Typography:**
- No web font is loaded. The app renders in `sans-serif` plus the Bootstrap system stack.
- About 9 font sizes are in use (3.6, 2.4, 1.8, 1.6, 1.5, 1.1, 1, 0.9, 0.85rem), mostly at weight 800.
- No tabular figures on times or codes.

**Consistency:**
- No design tokens. Hex values are hard-coded in every component.
- `.btn-wb-*` is redefined in five components.
- The Passport page uses an off-system teal (`#1b7a86`) and Bootstrap greys.

### 0.2 Web Interface Guidelines audit (Vercel), top 10
| # | Issue | Where |
|---|---|---|
| 1 | Pins can only be repositioned by dragging, so keyboard and touch users can't move them | `StopMap.vue:104-117`, `:190`, `ActivityForm.vue:39` |
| 2 | Host "Leave" deletes the group for everyone with no confirmation | `GroupLobby.vue:120-127` |
| 3 | `alert()` used for errors and success (11 places) | `login.vue:18`, `register.vue:14,27`, `home.vue:93,96`, `passport.vue:305,329`, `group.vue:66-136`, `GroupLobby.vue:102` |
| 4 | Clickable `<article>` with buttons nested inside | `PlaceCard.vue:26`, `ActivityCard.vue:38` |
| 5 | Controls with no keyboard access or no name | `passport.vue:145-155` (file input behind a label), `SpinFilters.vue:129` (`'…'` button), `SpinFilters.vue:59-73` (autocomplete without combobox ARIA) |
| 6 | LedBoard announces every flip and can't be paused, even under reduced motion | `LedBoard.vue:75-85,145` |
| 7 | `transition: all` with a `max-height` animation; reveal and preview animations not guarded for reduced motion | `passport.vue:630-640`, `SpinTicket.vue:319`, `SpinResults.vue:282` |
| 8 | Tabs and filters aren't in the URL, and the tabs have no ARIA roles | `[code].vue:16-18,232-291`, `SpinFilters.vue:9-12` |
| 9 | Skipped heading levels; no `lang`, `theme-color` or `color-scheme`; no skip link | `LandingFeatures.vue:26`, `SpinTicket.vue:82`, `SiteFooter.vue:37`, `passport.vue:6`, `nuxt.config.ts`, `layouts/default.vue` |
| 10 | Tap targets under 44px; `...` instead of `…`; straight quotes; no `tabular-nums` | `ActivityCard.vue:81`, `ActivityForm.vue:113`, `[code].vue:229`, `PlaceCard.vue:45`, `passport.vue:163`, `SpinTicket.vue:121`, `SiteHeader.vue:76` |

### 0.3 What already works (keep it)
- **LedBoard.** The dot-matrix destination sign is the brand's strongest asset.
- **TearTicket / SpinTicket.** The tear-to-reveal is physical, delightful and accessible by keyboard.
- **StopMap radar sweep.** Pins pop in as the sweep passes, which tells a story.
- **SpinFilters on phones.** The bottom sheet and dock pattern is correct.

---

## 1. Principles

1. **A bus ride you can play with.** Every metaphor comes from the trip: the stop sign, the LED, the ticket, the stamp, the seat. Don't invent ornaments.
2. **Feedback within 100 ms.** Every press, drop, save and failure gets a visible response: motion, colour or a message.
3. **Motion explains state, never decorates.** Loading, success, error, waiting and arriving each have one motion.
4. **One component per concept.** One button set, one toast, one mascot, one ticket. No copies.
5. **Accessible by default.**
   - WCAG AA contrast.
   - 44 × 44 px targets.
   - Keyboard parity for every pointer interaction.
   - `prefers-reduced-motion` respected.
   - No horizontal scroll at 375 px (iPhone 6 is the grader's smallest width).

### Design rules (house rules, adapted)
| Rule | Detail |
|---|---|
| **No emoji in the UI** | All UI emoji become Bootstrap Icons (§2.6). |
| **Gradients only in two places** | The map radar sweep and the scrim under text on photos. No other gradient anywhere. |
| **Shadows only on things that float** | A lifted or dragged ticket stub, a dragged pin, dropdowns, dialogs, the bottom sheet and toasts. Surfaces at rest are separated by tone (`--wb-surface-2`), not by lines or shadows. |
| **No glass or blur** | Drop `backdrop-filter`. Sticky bars are opaque. |
| **No dotted-grid backgrounds** | Remove them from `AuthCard.vue:39` and `SpinResults.vue:206`. |
| **No 1px divider lines** | Use space or a tone step. The exceptions are form controls, the pill tabs' active track and real tables. |
| **No eyebrows or tiny uppercase labels** | Sentence case at a readable size. The LED sign is the one all-caps element, because real ones are. |
| **Headlines at most two lines at every width** | Cut words before shrinking type. |

---

## 2. Foundations: Tier 0 (≈ half a day, must ship)

Put everything here in `app/assets/css/main.css` and make every component reference tokens only. A raw hex value in a component is a bug.

### 2.1 Colour

**Brand story, for the slides:** the green comes from Singapore's green public-bus livery. The amber is the glow of the LED destination sign. Navy is the night-time bus-stop panel.

```css
:root {
  color-scheme: light;

  /* grounds */
  --wb-ground:      #f9f9fb;  /* page background */
  --wb-surface:     #ffffff;  /* cards, sheets, inputs */
  --wb-surface-2:   #f1f2f6;  /* one tone step: chips, wells, hover rows */

  /* text */
  --wb-ink:         #141a33;  /* headings + primary text — 16.3:1 on ground */
  --wb-text-2:      #4a5068;  /* secondary text — 7.6:1 ground, 7.1:1 surface-2 */
  --wb-muted:       #6b7085;  /* meta on ground/surface ONLY — 4.66:1 (fails on surface-2: 4.38) */
  --wb-on-ink:      #ffffff;  /* text on navy — 17.1:1 */
  --wb-on-ink-2:    #9aa0b8;  /* secondary on navy — 6.6:1 (replaces #6b7085 in footer) */

  /* primary = action / go / selected */
  --wb-green:       #0b7a4b;  /* white on it 5.39:1; as text on ground 5.12:1 */
  --wb-green-hover: #096640;  /* white on it 7.03:1 */
  --wb-green-tint:  #e3f2ea;  /* selected chip bg; green text on it 4.66:1, ink 14.8:1 */

  /* signal = LED, signposts, the one highlight per screen */
  --wb-amber:       #f5a623;  /* FILL ONLY — never text, never white on it. Ink on it 8.46:1 */
  --wb-amber-tint:  #fdf3d7;
  --wb-amber-ink:   #7a5200;  /* amber-family text — 6.25:1 on amber-tint */

  /* lines (use sparingly) */
  --wb-control:     #80869a;  /* input/checkbox borders — 3.62:1 white, 3.45:1 ground (WCAG 1.4.11) */
  --wb-line:        #e3e5ec;  /* decorative only, never the sole boundary of a control */

  /* status */
  --wb-danger:      #b42318;
  --wb-danger-bg:   #fdecea;  /* danger text on it 5.75:1 */
  --wb-success:     var(--wb-green);   /* green IS success — no second green */
  --wb-disabled-bg: #e3e5ec;
  --wb-disabled-fg: #6b7085;  /* 3.9:1 — disabled controls are exempt, but stay legible */

  /* elevation — floating things only */
  --wb-float: 0 12px 32px rgba(20, 26, 51, .14);
  --wb-lift:  0 6px 16px rgba(20, 26, 51, .18);  /* dragged pin / lifted stub */
}
```

**Rules for using colour:**
- **Proportions:** ground about 80%, ink as text plus one dark section per page (the LED band or the footer), green under 5% of any screen, amber under 3%.
- **Green** marks only the primary action and the selected or active state. It is never used for headings, icons or decorative borders.
- **Amber** is a fill only: LED dots, signpost pins, the highlight strip. Its text partner is always `--wb-amber-ink` or `--wb-ink`, never white.
- **Grey text** goes only on `--wb-ground` or `--wb-surface`. On `--wb-surface-2` use `--wb-text-2`.
- **Focus and hover** make contrast stronger, never weaker.
- **Passport teal** (`#1b7a86`, `#b9d9dd`, `#e8f4f5`, `#f1f8f9`) and Bootstrap greys (`#dc3545`, `#6c757d`, `#495057`) are removed from `passport.vue`.

**Map category palette.** This replaces the values in `app/utils/placeStyles.ts`. All pairs were checked.

| Category | Ink (glyph / pin fill) | Tint (chip bg) | Ink on tint | White on ink | Icon |
|---|---|---|---|---|---|
| Food | `#b8381f` | `#fdecea` | 5.07 | 5.80 | `bi-egg-fried` |
| Nature | `#4d6b12` (olive, moved off brand green) | `#eef3e2` | 5.41 | 6.13 | `bi-tree` |
| Heritage | `#8a4a1f` (brown, replaces indigo) | `#f6ece4` | 5.86 | 6.82 | `bi-bank` |
| Art | `#b5307a` | `#fbeaf3` | 4.95 | 5.72 | `bi-palette` |
| Shopping | `#0e6e78` (teal, moved off amber) | `#e3f3f4` | 5.22 | 5.97 | `bi-bag` |
| Signpost | `#f5a623` fill with **ink** glyph | `#fdf3d7`, text `#7a5200` | 6.25 | ink 8.46 | `bi-signpost-2` |
| Challenge | `#1f5fbf` | `#e8f0fc` | 5.31 | 6.09 | `bi-flag` |
| Bus stop | `#141a33` square, amber border | n/a | n/a | 17.1 | `bi-bus-front` |

- Pins are white glyphs on a filled circle. Signposts use an ink glyph. Activities stay square.
- Category colour appears only on pins, chips and the card's category label. It never fills a card.

### 2.2 Typography

**System: Fredoka (display) + Lexend Deca (UI and body) + Caveat (handwritten notes only).**
- **Why:** Fredoka's rounded forms match the blob mascot and the friendly side-quest tone.
- **Lexend Deca** was designed for reading fluency, which helps the "Readability" criterion.
- **Caveat is content, not UI.** It appears only inside notes a user wrote.
- **IBM Plex Mono is not used.** The LED sign is already custom dot-matrix SVG (`app/utils/ledFont.js`).

```ts
// nuxt.config.ts → app.head
app: {
  head: {
    htmlAttrs: { lang: 'en-SG' },
    title: 'WanderBus',
    meta: [
      { name: 'theme-color', content: '#141a33' },
      { name: 'color-scheme', content: 'light' },
    ],
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      { rel: 'preconnect', href: 'https://www.onemap.gov.sg' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Lexend+Deca:wght@400;500;600&family=Caveat:wght@500&display=swap' },
    ],
  },
},
```

```css
:root {
  --font-display: "Fredoka", "Lexend Deca", system-ui, sans-serif;
  --font-ui:      "Lexend Deca", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-hand:    "Caveat", "Comic Sans MS", cursive;
  --bs-body-font-family: var(--font-ui);   /* Bootstrap follows */

  /* five steps, far apart */
  --fs-meta:  0.75rem;   /* 12px  timestamps, legal, map legend */
  --fs-small: 0.875rem;  /* 14px  chips, captions, helper text */
  --fs-body:  1rem;      /* 16px  everything readable; line-height 1.5; max 65ch */
  --fs-lead:  1.25rem;   /* 20px  card titles, supporting line, LED-adjacent labels */
  --fs-title: 1.75rem;   /* 28px  app page h1 (Fredoka 600, lh 1.1, tracking -0.01em) */
  --fs-hero:  clamp(2.75rem, 1.5rem + 5vw, 5rem);  /* landing hero ONLY (lh 1.0, -0.02em) */
}
body { font: 400 var(--fs-body)/1.5 var(--font-ui); color: var(--wb-ink); background: var(--wb-ground); }
h1, h2, .display { font-family: var(--font-display); font-weight: 600; color: var(--wb-ink); text-wrap: balance; }
.num { font-variant-numeric: tabular-nums; }
.hand { font-family: var(--font-hand); font-size: 1.375rem; line-height: 1.25; }
```

**Type rules:**
- **Weights:**
  - Fredoka 500/600 for h1, h2 and buttons that read as "signs" (the LED-sign CTA).
  - Lexend 400 for body, 500 for buttons and labels, and 600 for emphasis.
  - **Weight 800 is no longer used.**
- **Sizes:**
  - App pages have a 28px h1. Only the landing hero goes larger.
  - Section h2 is 20–24px, Fredoka on landing and Lexend 600 inside the app.
  - Don't add a sixth size.
- **Headings:** one `<h1>` per page and no skipped levels. Make `SpinTicket.vue:82` take its heading level as a prop.
- **Figures:**
  - Apply `.num` to minutes, ETAs, distances, the crew code, credits and counts.
  - Build check: confirm that Lexend Deca's digit widths actually change with `tabular-nums`. If they don't, set `.num` in Fredoka.
- **Text formatting:**
  - Use `…`, not `...`. Use curly quotes and apostrophes.
  - Use sentence case for buttons and headings ("Log in", not "Login" or "LOGIN").
  - Space above a heading is at least twice the space below it.
- **Money:** `new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' })`. This replaces the hand-built "S$" at `ActivityCard.vue:54`.

**Kept in view, the "pro" theme.** One attribute swaps the faces if the team wants a more SaaS feel.
```css
:root[data-type="pro"] {
  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-ui:      "Atkinson Hyperlegible Next", system-ui, sans-serif;
}
```
It loads `Bricolage+Grotesque:opsz,wght@12..96,500..700` and `Atkinson+Hyperlegible+Next:wght@400;500;700`. Leave it out of the font `<link>` unless it's switched on.

### 2.3 Space, radius and layout
```css
:root {
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 24px;
  --sp-6: 32px; --sp-7: 48px; --sp-8: 64px; --sp-9: 96px;
  --r-card: 16px;  --r-control: 12px;  --r-pill: 999px;   /* one soft family; nested radii step down */
  --gutter: clamp(16px, 4vw, 32px);   /* equal outer margins at every width */
  --header-h: 64px;
}
html { scroll-padding-top: calc(var(--header-h) + 8px); }
.app-layout { min-height: 100dvh; }   /* was 100vh (main.css:16) */
```
- **Gaps:** landing sections are 96–160 px apart on desktop and 64 px on phones. App screens use 24–32 px between blocks.
- **Card padding:** 20–24 px. Don't put a card inside a card.
- **Reset:** remove the global `* { margin:0; padding:0 }` reset (`main.css:2-6`). It fights Bootstrap's spacing, and `AuthCard.vue:36` compensates with `margin:-20px`.

### 2.4 Buttons: one set, shared

Delete the per-component copies in `LandingHero`, `AuthCard`, `SpinFilters` and `SpinResults`.

| Class | Use | Fill / text |
|---|---|---|
| `.btn-wb-primary` | The one main action per view (Spin, Save, Board, Log in) | `--wb-green` / white |
| `.btn-wb-secondary` | Second action (Spin again, Cancel) | transparent, 2px `--wb-ink` border / ink |
| `.btn-wb-signal` | Rare highlight (landing "Tap to board", Nudge) | `--wb-amber` / `--wb-ink` |
| `.btn-wb-ghost` | Tertiary, inline (Edit, Dismiss) | none / `--wb-text-2`, hover `--wb-surface-2` |
| `.btn-wb-danger` | Destructive, only inside confirm dialogs | `--wb-danger` / white |

Shared states:
```css
.btn-wb { min-height: 44px; padding: 0 20px; border-radius: var(--r-pill); font: 500 var(--fs-body)/1 var(--font-ui);
  transition: transform 150ms var(--ease), background-color 150ms var(--ease); touch-action: manipulation; }
.btn-wb:hover        { transform: translateY(-1px); }
.btn-wb:active       { transform: scale(.97); }
.btn-wb:focus-visible{ outline: 3px solid var(--wb-green); outline-offset: 3px; }
.btn-wb:disabled     { background: var(--wb-disabled-bg); color: var(--wb-disabled-fg); transform: none; cursor: not-allowed; }
.btn-wb[aria-busy="true"] { /* spinner + verb-ing label, e.g. "Saving…"; keep width stable */ }
```
- **Disabled buttons explain themselves.** A line of helper text sits beside the button, for example "Pick a starting point to spin" in `SpinFilters`, linked with `aria-describedby`.
- **Labels name the action:** "Save to passport", "Leave crew", "Delete signpost". Avoid "OK", "Submit" or "Yes".

### 2.5 Feedback: toasts and inline errors
- **`app/components/ui/WbToast.vue` plus `useToast()`** replaces every `alert()` (list in §0.2 #3).
  - Variants: `success` (`role="status"`, green bar, happy mascot), `error` (`role="alert"`, danger bar, sad mascot, with an action such as "Retry") and `info`.
  - Toasts stack top-centre on phones and bottom-right on desktop.
  - They auto-dismiss after 4 s. Errors stay until dismissed.
  - Toasts use `--wb-float`. Their entry is a 250 ms rise.
- **Forms:**
  - Errors appear inline, under the field, with `aria-invalid="true"` and `aria-describedby`. Focus moves to the first invalid field.
  - The password mismatch check moves inline (`register.vue:14`).
  - Login errors appear inline, and the email the user typed is kept (`login.vue:18`).
- **Confirmations** use a Bootstrap modal that names the item and uses a danger button:
  - "Delete your signpost at Blk 55?"
  - "Leave crew 4821? As host, this ends the crew for everyone."
  - Native `confirm()` is removed.
- **Network failures** show inside the block that failed: one sentence, the last good time and a Retry button. They are never only in `console.log` (`home.vue:99-101`).

### 2.6 Icons: Bootstrap Icons
Install `bootstrap-icons` and import its CSS in `nuxt.config.ts`. Credit it in the slides.

Icons are always `aria-hidden="true"` and sit beside a text label. An icon-only button carries an `aria-label`. Sizes are 16 px inline, 20 px in buttons and 24 px in empty states.

| Was | Now | Was | Now |
|---|---|---|---|
| 🚌 | `bi-bus-front` | 📷 | `bi-camera` |
| 🎫 | `bi-ticket-perforated` | ⏱ | `bi-stopwatch` |
| 🪧 | `bi-signpost-2` | ⭐ / ☆ | `bi-star-fill` / `bi-star` |
| 📍 | `bi-geo-alt-fill` | ✏️ | `bi-pencil` |
| 🚩 | `bi-flag-fill` | ✕ / × | `bi-x-lg` |
| 📔 | `bi-journal-bookmark` | 🏆 | `bi-trophy` |
| 👥 | `bi-people` | 👑 (host) | `bi-award-fill` |
| 🌳 | `bi-tree` | 🔔 (tie bell) | `bi-bell-fill` |
| 🍜 | `bi-egg-fried` | 🚶 (walk leg) | `bi-person-walking` |
| ☕ | `bi-cup-hot` | ✅ (ready) | `bi-check-circle-fill` |
| 🛍 | `bi-bag` | 🎨 | `bi-palette` |
| 🏛 | `bi-bank` | 📋 (copy code) | `bi-clipboard` |

The brand mark "🚌 WanderBus" becomes the small mascot-in-bus SVG (§3.1) plus the wordmark in Fredoka 600.

### 2.7 Motion tokens
```css
:root {
  --ease: cubic-bezier(0.22, 1, 0.36, 1);   /* already used in TearTicket/SpinTicket */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* drops, pops, squash */
  --t-micro: 150ms;  --t-ui: 250ms;  --t-reveal: 420ms;  --t-signature: 1200ms;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important;
                           transition-duration: 1ms !important; scroll-behavior: auto !important; }
}
```
- **Animate only `transform` and `opacity`.** Name the properties and never use `transition: all`.
- **`passport.vue:630-640`:** replace the `max-height` expand with `display:grid; grid-template-rows: 0fr → 1fr` plus an opacity change.
- **Interruptible:** a second tap cancels or completes the animation and never queues it.
- **Reduced motion:** the drive-by is skipped (go straight to the destination), the LED stops rotating and shows the first message, the mascot's gaze is centred and the radar draws all pins at once.
- **Entrances on the landing page only:** heading, then text, then media, staggered 70 ms, rising 24 px, triggered once by IntersectionObserver. The content must stay visible if the script fails.

### 2.8 Guideline fixes: Tier 0 checklist
- [ ] Skip link "Skip to content" as the first focusable element, and `<main id="main">` (`layouts/default.vue`).
- [ ] `<nav aria-label="Main">` in the header and `aria-label="Footer"` in the footer.
- [ ] Header links at least 44 px tall (`SiteHeader.vue:76`). Make "Log in" wording consistent.
- [ ] Footer "Log out" becomes a `<button>` (`SiteFooter.vue:49`), and `v-if` moves to the `<li>`.
- [ ] Heading order fixed (`LandingFeatures.vue:26` → h3, `SiteFooter.vue:37,45` → `<p class="footer-head">`, `passport.vue:6` → h1).
- [ ] PlaceCard and ActivityCard: remove `@click` on `<article>`. The title becomes a `<button>` that selects the pin, and the other controls sit alongside it.
- [ ] Passport photo picker becomes a real `<button>` that calls `input.click()` (`passport.vue:145`).
- [ ] Start-location autocomplete: add `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, arrow-key navigation and a result-count live region (`SpinFilters.vue:59-73`).
- [ ] Time slider gets `aria-valuetext="Up to 60 minutes"` (`SpinFilters.vue:80`).
- [ ] Dock Spin button shows "Spinning…" with visible text (`SpinFilters.vue:129`).
- [ ] LedBoard: the live region is updated only on state changes driven by the `label` prop. Auto-rotation pauses on hover or focus and under reduced motion. Listen for reduced-motion changes (`LedBoard.vue:75-85,145`).
- [ ] Stop page tabs get `role="tablist"`, `role="tab"`, `aria-selected` and arrow keys. Chips get `aria-pressed`. Tab, section and sub-filter go into `?tab=&section=&sub=` (`[code].vue:16-18,232-291`).
- [ ] Spin filters go into the URL: `?mins=60&cats=cafe,park` (the start location stays in memory).
- [ ] Notices: errors use `role="alert"`. The dismiss "×" becomes a 44 px `bi-x-lg` button with `aria-label="Dismiss"` (`[code].vue:227-229`).
- [ ] `scrollIntoView` respects reduced motion and guards against a null element (`[code].vue:202`).
- [ ] Images get `width`/`height` or `aspect-ratio`, `loading="lazy"` below the fold and descriptive alt text, for example "Your photo from Blk 55 Tampines".
- [ ] Number inputs get `inputmode="decimal"` (`ActivityForm.vue:60`). Email fields get `spellcheck="false"` and `autocomplete="email"`.
- [ ] Rating: replace the five toggle buttons with a radio group inside `<fieldset><legend>Your rating</legend>` (`ActivityForm.vue:46-53`).
- [ ] Unsaved-edit guard on Cancel when text has changed (`ActivityForm.vue:86`, `passport.vue:176`).
- [ ] Save buttons are disabled while busy to prevent duplicate passport entries (`home.vue:83`).
- [ ] Delete `app/pages/Supa-team.code-workspace` (a stray file inside `pages/`).
- [ ] Landing copy promises only built features: remove "3 mystery tickets", "card for every stop", "5-friend vote" and "live countdown & check-in" from `LandingHero.vue` and `LandingFeatures.vue`. Fix "interested in" (`LandingHero.vue:21`).

---

## 3. Signature components: Tier 1 (≈ 1 day)

### 3.1 `WanderMascot.vue`: the guide on the bus
A single inline SVG: a soft rounded blob with two dot eyes and a small mouth. It's drawn with simple paths, so no illustrator is needed. Its body colour defaults to `--wb-green`.

| Prop | Values | Notes |
|---|---|---|
| `mood` | `idle`, `loading`, `happy`, `sad`, `sleepy`, `wave`, `peek`, `cover-eyes` | Each mood is a CSS class that swaps the mouth and eye paths and runs one keyframe |
| `color` | any token or hex | User avatars use the hash palette from `ActivityCard.vue`, moved into `app/utils/userColor.ts` |
| `size` | px | 24 in the header, 48 for avatars, 96–160 for empty states |
| `gaze` | boolean | Eyes follow the pointer (see below) |

**Moods:**
- `idle`: blinks every 4–6 s at random.
- `loading`: a 6 px bob, 1.2 s loop.
- `happy`: a hop with squash and stretch, 420 ms, then a smile.
- `sad`: drops 4 px, mouth flips.
- `sleepy`: eyes become lines and a "z" floats up, 2 s loop.
- `wave`: one arm path rotates ±20°, three times.

**Gaze, the cursor effect** (inspired by found.runnable.app):
- A single shared `pointermove` listener (`app/composables/usePointer.ts`) is throttled with requestAnimationFrame.
- Each mascot computes the angle to the pointer and moves its pupils by up to 3 px.
- After 20 s with no pointer movement it switches to `sleepy`. Any movement wakes it with a startled blink.
- It's off on `(pointer: coarse)` and under reduced motion, where the eyes stay centred.

**Where it appears:**
- the header brand mark
- the login and register card
- F1 loading and empty states
- passport empty state
- lobby seats (as avatars)
- toasts

**For Q&A, in plain words:** "One listener reads where your mouse is. Each mascot works out which direction that is and moves its pupils a few pixels towards it. A timer puts it to sleep if you stop moving."

### 3.2 `BusDriveBy.vue`: the bus that carries every state
A flat SVG side view:
- a green body (`--wb-green`)
- ink windows
- the mascot in the second window
- a mini `LedBoard` in the front sign
- two wheels and a road line underneath

| Mode | Motion | Used for |
|---|---|---|
| `arrive` | Translates from -120% to 0 over 900 ms with `--ease`, a 120 ms squash on stop, then the doors slide open | Landing CTA, F1 result ready |
| `depart` | Doors close, then it translates to +120% over 700 ms | Navigating after the landing CTA |
| `idle-loop` | In place: wheels rotate, road dashes scroll, body bobs 2 px | F1 "finding your stop", lobby waiting for the spin |
| `breakdown` | A puff circle scales and fades, the bus tilts 3°, the mascot turns `sad` | F1 no result or API error |

It has a `label` prop for the LED text and a `skippable` prop: any click or key press jumps to the end state.

### 3.3 State table: one vocabulary across the app
| State | Mascot | Bus | LED text | Copy |
|---|---|---|---|---|
| F1 idle (no spin yet) | `idle` + gaze | parked | `READY WHEN YOU ARE` | "Set your time and tap Spin." |
| F1 searching | `loading` | `idle-loop` | `FINDING YOUR STOP` | "Checking live arrivals…" |
| F1 result | `happy` | `arrive` | `<bus no.> <stop>` | "Tear the stub to reveal." |
| F1 no result | `sad` | `breakdown` | `NO BUS FITS` | Names the filter that's blocking results: "No buses reach a park within 30 min. Try 45 min." |
| Saved to passport | `happy` | n/a | n/a | Toast "Saved to your passport" with a stamp thunk on the button |
| Passport empty | `sleepy` at the stop | parked | `NO TRIPS YET` | "Your first stamp is one spin away." Button: Spin a trip |
| Lobby waiting | looks at the empty seat | `idle-loop` | `CREW 4821` | "Waiting for Faith…" |
| Generic error | `sad` | n/a | n/a | One sentence, what failed, a Retry button |

### 3.4 Ticket under strict rules (`SpinTicket.vue`, `TearTicket.vue`)
- **Flat paper:** fill `--wb-surface`, a 2 px `--wb-ink` outline and **no resting shadow**. Remove the gradient at `SpinTicket.vue:200`.
- **Perforation:** punched notches as an SVG mask (half circles cut out of both edges plus a row of 4 px holes), not a dashed 1px line.
- **Stub:** `--wb-green` with white text (5.39:1).
- **Barcode:** stays. It's part of a real ticket.
- **Lift:** `--wb-lift` shadow and 1.02 scale appear only while the stub is being dragged or torn, because only then is it floating.
- **Focus:** a 3px `--wb-green` outline with 4 px offset **outside** the clip path. This replaces the clipped inset shadow at `TearTicket.vue:595-601`.
- **Controls and motion:**
  - "Put the stub back" becomes a 44 px `.btn-wb-ghost`.
  - Disable the window-wide tilt listener after the tear and under reduced motion (`TearTicket.vue:434,462`).
  - Guard the reveal transition with reduced motion (`SpinTicket.vue:319-334`).
- **Hint copy:** "Drag, tap or press Enter to tear the stub" (`LandingHero.vue:32`).

---

## 4. Page specs

Every page is specified at **375 px**, where it's its own composition, and at **≥ 992 px**. Every page has one `<h1>`, and its primary action is visible on the first screen.

### 4.1 Landing `/` (`app/pages/index.vue`, `components/landing/*`): Tier 1

**Hero: "the stop"**
- **Desktop:** two columns.
  - **Left:**
    - h1 at `--fs-hero`: "Take a random bus. Get off somewhere worth it."
    - A supporting line at `--fs-lead`: "WanderBus picks a stop you can reach in your time limit, with places worth exploring when you get off."
    - A secondary text link: "How it works ↓".
  - **Right:** a flat SVG **bus-stop pole** whose sign is the `LedBoard`, rotating `WANDERBUS` / `TAP TO BOARD`. The sign is a real `<button>` (`aria-label="Board WanderBus"`).
- **Phone:** the pole sits above the text, and the headline is capped at 2 lines.
- **Signature move:** tapping the sign plays this sequence:
  1. The LED flips to `BOARDING`.
  2. `BusDriveBy arrive` brings the bus in from the left and stops it at the pole.
  3. The mascot waves.
  4. The doors close and the bus departs.
  5. `navigateTo('/register')` runs, or `/home` if the user is logged in.

  The whole sequence takes about 2.4 s. A "Skip" button and any key press jump straight to the route. Under reduced motion the route changes immediately.
- **Keep the sections:**
  - Steps: a 4-stop route line.
  - Safety: limits list and check card.
  - Features: 5 rows with Bootstrap Icons instead of emoji tiles.
  - CTA: a navy band with LED and `.btn-wb-signal`.
- **Restyle the sections:**
  - Set the sections on tokens and the type scale.
  - Remove 1px borders and use tone steps.
  - The Safety check card loses its outline and sits on `--wb-surface-2`.
- **Footer:** a designed close. The navy band uses `--wb-on-ink` / `--wb-on-ink-2`, with the wordmark large in Fredoka and the tagline. Fix `SiteFooter.vue:104-105` contrast and the en dash.

### 4.2 Login / Register (`login.vue`, `register.vue`, `ui/AuthCard.vue`): Tier 0 + 1
- `AuthCard` sits on `--wb-ground`, without the dotted grid. The card uses `--wb-surface`, `--r-card` and no shadow.
- `WanderMascot` peeks over the card's top edge (`mood="peek"`, `gaze`). While the password field has focus it switches to `cover-eyes`.
- Inline errors (§2.5). On submit: `aria-busy`, a "Logging in…" label and a disabled state.
- After signing up, "Check your inbox" shows the happy mascot.

### 4.3 F1 Spin `/home` (`home.vue`, `spin/SpinFilters.vue`, `spin/SpinResults.vue`): Tier 0 + 1
- **Layout:**
  - Desktop: a 340 px filter column plus the result stage.
  - Phone: a bottom-sheet dock. Keep this, but remove the blur and make the dock opaque `--wb-surface` with `--wb-float`.
- **Filters:**
  - Category chips use `--wb-surface-2` with `--wb-text-2`, and selected chips use `--wb-green-tint` with green text and a `bi-check` icon. Each chip is at least 44 px.
  - The slider value uses `.num`.
- **Result stage:**
  - **Idle:** the parked bus, an idle mascot and the LED reading `READY WHEN YOU ARE`. This replaces the dashed ghost ticket.
  - **Searching:** `BusDriveBy idle-loop`. This replaces `ghost-bob`, which animated `border-color`.
  - **Result:** the bus arrives, then the ticket slides up from the bus door (420 ms). Then the tear interaction runs.
  - **After the tear:**
    - The legs timeline uses icons (walk, bus, ride, arrive) and `.num` times.
    - The "within 1 km" pills show category icons.
    - The amber total-time strip uses `--wb-amber-tint` with `--wb-amber-ink`.
- **Actions:**
  - `Explore this stop` is primary.
  - `Spin again` is secondary.
  - `Save to passport` is secondary: busy, then a toast, then the button swaps to a disabled "Saved" with `bi-check` and a stamp thunk (scale 1.15 → 1, 250 ms, `--ease-spring`).
- **Errors:** shown inside the stage with the `breakdown` state and a Retry button.

### 4.4 F2/F3 Around the stop `/stop/:code` (`stop/[code].vue`, `StopMap.vue`, `PlaceCard.vue`, `ActivityCard.vue`, `ActivityForm.vue`): Tier 0 + 1
- **Layout:**
  - Desktop: map on the left, sticky, 60%; card list on the right, 40%.
  - Phone: map on top at 55 svh, and the list in a draggable bottom sheet with a "Show list / Show map" toggle.
- **Map:**
  - Keep the radar sweep and pin pop-in.
  - The container gets `role="region"` and `aria-label="Map of places within 1 km of <stop>"`.
  - Pins are at least 44 px on touch (the visible circle can stay 32 px inside a 44 px hit area).
  - Pins use the category table (§2.1) and carry `aria-label`s.
- **Pin drop, the feedback cues:**

  | Moment | Visual | Cursor |
  |---|---|---|
  | Hover the "Leave a signpost" / "Set a challenge" button | Button lifts, and a pin icon wiggles once | `grab` |
  | Dragging over the map | A ghost pin under the pointer with an offset ground-shadow ellipse (`--wb-lift`); the 1 km circle pulses green (stroke 2 → 4 px, 8% → 14% fill) | `grabbing` |
  | Outside the 1 km circle | Circle stroke turns `--wb-danger`, the ghost pin shakes ±3° and the helper line reads "Drop it inside the circle" | `not-allowed` |
  | Drop inside | The pin falls 24 px with `--ease-spring`, squashes (scaleY .8 → 1), and a ripple ring expands and fades (420 ms); the form slides in | default |
  | Saved | Toast, the new pin pulses twice, and its card scrolls into view and highlights | n/a |

- **Alternatives to dragging** (fixes §0.2 #1):
  - Tapping "Leave a signpost" enters a **placing mode**. The banner reads "Tap the map to place your signpost", and the next tap inside the circle places the pin.
  - A **"Place at the stop"** button drops the pin on the stop.
  - When a draft pin has focus, the **arrow keys** nudge it by 10 m, Shift+arrow by 50 m, and Enter confirms.
- **Cards:**
  - Remove `@click` from `<article>`; the title is the button (§2.8).
  - Hovering a card highlights its pin, and hovering a pin highlights its card.
  - Photos sit at `aspect-ratio: 1`. The "Undiscovered" tile becomes a `--wb-surface-2` tile with `bi-camera` and "Be the first to add a photo", replacing the radial gradient at `PlaceCard.vue:84`.
  - Edit and Delete become 44 px ghost buttons with `aria-label="Edit your signpost"`.
  - Stars become `role="img"` with `aria-label="4 out of 5"` and hidden icons.
- **Tabs:** All / Places / Activities as a real tablist, with state in the URL.

### 4.5 F4 Passport `/passport` (`passport.vue`): Tier 1
**Concept: a wall of memories.** It uses Vue Bits **Flex Carousel**. Copy the source into `app/components/ui/FlexCarousel.vue` and credit it in the file header and slides, as was done for TearTicket.
- Each slide is one **memory card**, one per `passport_entries` row:
  - **Photo:** large, `aspect-ratio: 4/5` on phones and 3/4 on desktop, square corners inside a 16 px card.
  - **Stop name:** Fredoka 600 at `--fs-lead`. The date (`.num`) sits beside it.
  - **Ticket strip:** a flat mini-ticket with notched perforation showing bus `<no.>` · from → to · `<mins>` min. It reuses the ticket styles (§3.4).
  - **Ink stamp:** one SVG circle stamp with the stop name round the edge and the date in the middle. It's rotated -8°, drawn in `--wb-green` at 85% opacity with `mix-blend-mode: multiply`, and overlaps the photo corner.
  - **Note:** the user's thoughts in `--font-hand` on `--wb-surface-2`, 3 lines with "Read more" if longer.
- **Deal-in on load:** the cards enter one after another with a 70 ms stagger, from translateY(40px) rotate(-4°) opacity 0 to rest, over 420 ms with `--ease`.
- **Header:**
  - h1 "Your passport".
  - The credits pill (`bi-trophy`, `.num`) uses `--wb-amber-tint` / `--wb-amber-ink`.
  - The trip count.
- **Edit:** opens in place on the card. Notes go in a textarea set in `--font-hand`. The photo replace uses a real button (§2.8). Expanding uses the grid-rows transition. Saving shows a toast.
- **Delete:** a confirm modal naming the stop, then the card scales to 0.9, rotates 6° and falls 40 px with a fade over 420 ms. The carousel then closes the gap.
- **Empty state:** the sleepy mascot at a stop with LED `NO TRIPS YET` and the "Spin a trip" primary button.
- **Kept in view:** a Ring / Circular Gallery view as an alternative "overview" toggle. It uses WebGL, so check accessibility and performance first.
- **Data note:** photos are currently base64 data URLs in the row (`photo_url`). If time allows, move them to the `place-photos` bucket pattern in `supabase/place_photos.sql`. If not, keep them, but cap the size at upload.

### 4.6 F5 Crew lobby `/group` (`group.vue`, `group/GroupLobby.vue`): Tier 1
**Concept: the top deck from above.** Seats stay in fixed positions, like a team-select screen.
- **Join / host screen:**
  - Two cards on `--wb-surface`: "Host a crew" and "Join with a code".
  - The code input uses `inputmode="numeric"`, `pattern="\d{6}"` and `autocomplete="off"`, inside a real `<form>`.
  - Errors show inline with specific reasons: "That code doesn't exist", "This crew is full (6/6)", "You're already in crew 4821".
- **Lobby:**
  - **LED sign** at the front of the bus reads `CREW 4821` (`.num`), with a `bi-clipboard` "Copy code" button that confirms with a toast.
  - **Seat map:** a 2 × 3 grid of seats inside a bus-outline SVG, with a maximum of 6.
    - **Host seat:** front-left, with `bi-award-fill` as a crown.
    - **Empty seats:** dashed outline (allowed: it's an empty slot), with the label "Free seat".
    - **Filled seats:** the member's mascot in their colour plus their name.
    - **Ready:** the seat fill turns `--wb-green-tint` with a `bi-check-circle-fill` badge and a pop animation.
  - **Ready toggle** for members: "I'm ready".
  - **Host controls:**
    - `Start the trip` stays disabled with the reason "Waiting for Faith…".
    - `Nudge Faith` (`.btn-wb-signal`) makes Faith's seat shake on every screen.
    - After 60 s, `Continue without Faith` appears.
  - **Spin and vote:**
    1. The host spins with F1's flow (`chooseStop.ts`).
    2. The ticket is broadcast and appears on every screen.
    3. Each member taps **Board** or **Reroll** within 30 s. A seat shows a `bi-hand-thumbs-up` / `bi-arrow-repeat` chip once its member has voted.
    4. If most vote Board, everyone goes to `/stop/:code`. If most vote Reroll, the host's screen re-spins.
    5. **Tie:** `bi-bell-fill` rings (a 6° rotate shake), the LED flickers, and the bus picks at random.
  - **Leave:** a confirm modal. For the host it reads "Leaving ends crew 4821 for everyone".
- **Realtime spec** (Supabase Realtime is new to the app, so this needs a short explanation):
  - **Channel:** `supabase.channel('group:' + code)`.
  - **Presence:** `track({ user_id, name, color, ready })`. A `sync` event redraws the seats, so whoever is connected is shown sitting down.
  - **Broadcast events:**
    - `nudge {to}`
    - `ticket {stop, bus, …}`
    - `vote {user_id, choice}`
    - `result {choice}`
  - **For Q&A, in plain words:** "Everyone in the lobby joins the same live channel. Presence tells us who's connected and whether they're ready. Broadcast sends one-off messages like a nudge or a vote to everyone instantly. Nothing about seats is stored in the database."
  - Fix `GroupLobby.vue:58`, where it crashes if the host isn't found. Show a "Host left" state instead.

---

## 5. Tier 2: stretch, plus ideas kept in view

Only start these once Tiers 0 and 1 are working without bugs.

| Item | Spec |
|---|---|
| **Profile "bus pass"** `/profile` | One card shaped like a bus pass: mascot avatar in the user's colour, display name, credits (`user_rewards.credits`), and counts: trips (`passport_entries`), signposts, challenges completed, pioneer photos (`place_photos.is_pioneer`). Link it from the header avatar. No editing. |
| **Live location dot** (F2) | `navigator.geolocation.watchPosition` → update one Leaflet `circleMarker` (navy with a pulsing ring) → a "Recentre" button and a "1.2 km to stop" chip → `clearWatch` on unmount. If permission is denied, hide the dot and show the chip "Location off". In plain words: "The browser tells us where you are every few seconds, we move the dot, and we stop listening when you leave the page." |
| **Scroll route line** (landing How it works) | Steps become stops on a green route line that fills as you scroll (IntersectionObserver plus `scaleY`). The mascot's bus rides the line. No WebGL. |
| **Crumple delete** (passport) | SVG filter or a clip-path crumple before the fall. Replaces the simple fall. |

**Kept in view, not planned:**
- the Bricolage + Atkinson "pro" type theme (§2.2)
- the Ring / Circular Gallery passport view
- sound effects with a mute toggle

**Out of scope:**
- collectible cards and rarity
- the reward shop and packs
- the converging-routes map
- chat, reactions and the activity feed
- a 3D bus or three.js
- a global custom cursor
- dark mode

---

## 6. Rubric map

| Instructor criterion | Where it's met |
|---|---|
| **Animated / dynamic** | Drive-by CTA (§4.1); bus states (§3.2); tear ticket (§3.4); radar plus pin drop (§4.4); passport deal-in (§4.5); live seat map (§4.6); mascot gaze (§3.1) |
| **Responsive** | Every page at 375 and ≥ 992 (§4); fluid gutters and `100dvh` (§2.3); bottom sheets on phones; 44 px targets |
| **Consistent UI** | Tokens only (§2.1–2.3); one button set (§2.4); one icon set (§2.6); one state vocabulary (§3.3) |
| **Good feedback / visual cues** | Toasts and inline errors (§2.5); button states (§2.4); pin-drop cue table (§4.4); ready lights and nudge (§4.6) |
| **Readability & contrast** | Every pair checked against WCAG AA (§0.1, §2.1); Lexend body face; 5-step type scale (§2.2) |
| **Images & icons** | Bootstrap Icons everywhere (§2.6); mascot and bus SVGs (§3); user photos in the passport and place cards |
| **Easy to use & navigate** | Skip link, heading order and tablists (§2.8); state in the URL; alternatives to dragging; actions that name themselves; confirmations for destructive actions |

Briefing weights:
- **Styling + responsive (18%)** is covered by §2–§4.
- **Working, intuitive, no bugs (27%)** is covered by §2.5, §2.8 and §4. They follow IxDF's 10 rules: consistency, feedback, error prevention, recognition over recall.

---

## 7. Credits & AI use
- **Third-party code and assets** (credit in the code header and the slides):
  - TearTicket, ported from React Bits "Tear Ticket" by David Haz (MIT + Commons Clause).
  - Vue Bits Flex Carousel.
  - Bootstrap 5 and Bootstrap Icons (MIT).
  - Google Fonts: Fredoka, Lexend Deca and Caveat (OFL).
  - Leaflet (BSD-2).
  - OneMap basemap tiles (SLA).
- **README AI statement:** design.md was drafted with AI help, which counts as layouts and UI inspiration and is allowed under the briefing FAQ. The core interactivity and business logic are implemented by the team.

## 8. References
- **phomakesstuff.co.uk:**
  - Uses the Fredoka + Lexend Deca pairing.
  - Its playfulness comes from character art, which our mascot and bus supply.
- **motionsites.ai:** one signature hero move and scroll-linked storytelling. We take the idea, not the WebGL.
- **found.runnable.app:** a creature that follows the cursor and sleeps when idle. That becomes the mascot's gaze.
- **Sample demo video:** the "Continue without X" lobby pattern and its feedback cues.
- **Notion mascots and Clippy:** a minimal character that expresses state.

## 9. Build order & verification
1. **Tier 0:**
   - Tokens and fonts in `main.css` and `nuxt.config.ts`.
   - Buttons.
   - Icons swap.
   - WbToast replaces `alert()`.
   - §2.8 checklist.
   - Passport recolour.
   - Landing copy.
2. **Tier 1:**
   - WanderMascot.
   - BusDriveBy.
   - Ticket restyle.
   - Landing CTA.
   - F1 states.
   - Pin-drop cues and alternatives.
   - Passport carousel.
   - Lobby seat map and Realtime.
3. **Tier 2**, if time allows.

**Checks after each tier:**
- `node ~/.claude/skills/design-taste-frontend/scripts/lint.mjs app`: the FAIL count should fall from 116. Remaining hits must be justified: radar, scrim, floating shadows, the dashed empty seat.
- Chrome DevTools at 375 × 667 (iPhone 6) and 1440 × 900 on `/`, `/login`, `/home`, `/stop/:code`, `/passport` and `/group`. Check for no horizontal scroll.
- Rendering → emulate `prefers-reduced-motion: reduce`, then repeat the flows.
- Keyboard only: tab through each page, tear a ticket, place and nudge a pin, open and close the dialogs.
- Lighthouse Accessibility ≥ 95 on each page.
- Two browser windows, one normal and one incognito, to run the lobby: join, ready, nudge, vote and tie.
