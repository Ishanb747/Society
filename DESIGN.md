# Design system

Inspired by konrad.com's visual language (monochrome ink on white, a single sharp blue, Inter with tight tracking, hairlines instead of shadows, expo-out motion). Only the language is borrowed: no Konrad branding, copy or assets.
Adapted for the client's brief: minimal, lots of white space, every element has a job, residents glance for seconds, actions within 2 taps.

## Principles

1. **Ink and paper.** Near-black on white. Colour only carries meaning: one blue for action, plus status colours.
2. **Numbers are the hero.** Dues, timers and totals are set large with `tabular-nums`. Everything else steps back.
3. **Hairlines, not shadows.** 1px borders and tonal surfaces separate content. No drop shadows, except a single soft one on floating sheets.
4. **One dark moment per screen.** Konrad's signature is a dark band. Here it is the resident's dues card and the desk's critical-alert strip. Never more than one per screen.
5. **Motion explains, never decorates.** Text reveals only on headings at first paint, and state changes slide in with expo-out. Respect `prefers-reduced-motion`.

## Tokens (CSS variables → Tailwind v4 `@theme`)

```css
/* surfaces */
--surface-1: #ffffff;  --surface-2: #f7f7f7;  --surface-3: #ebebeb;
--surface-ink-1: #090a0a; --surface-ink-2: #15191b; --surface-ink-3: #2d3235;
/* text */
--text-1: #090a0a; --text-2: #4e5a61; --text-3: #8d969b; --text-on-ink-1: #ffffff; --text-on-ink-2: #b8bdc0;
/* lines */
--line-1: #ebebeb; --line-2: #b8bdc0; --line-strong: #090a0a;
/* action */
--accent: #002acf;  --accent-hover: #0022a6;  --accent-soft: #e8ecfb;  --focus: #002acf;
/* status (text on light surfaces; all ≥ 4.5:1) */
--ok: #047a35;  --ok-soft: #e6f4ec;
--warn: #9a5b00; --warn-soft: #fbf1e1;
--danger: #c00000; --danger-soft: #fbe9e9;
--info: #0066b3;
/* radius */
--radius-sm: 4px; --radius-md: 8px; --radius-pill: 999px;
/* motion */
--ease-out: cubic-bezier(.16, 1, .3, 1);   --ease-in: cubic-bezier(.7, 0, .84, 0);
--dur-fast: 160ms; --dur: 280ms; --dur-slow: 500ms;
```

Dark mode: swap surfaces and text (ink becomes the page, `#15191b` the cards), and the accent lifts to `#5b7cff` for contrast. Ship it if time allows, otherwise light only.

Spacing: 4px scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96). Page gutter 20px on mobile, 40px on desktop. Content max width 1200px (desk/committee), 560px (resident).

## Type

- **Inter Variable** (`next/font`), with **Noto Sans Devanagari** as fallback for Marathi/Hindi (Inter has no Devanagari).
- `font-feature-settings: "cv11", "ss01"`, and `tabular-nums` on all money and timers.

| Token | Size / line | Tracking | Weight | Use |
|---|---|---|---|---|
| display | 56/56 (mobile 40/40) | -0.045em | 600 | dues amount, dashboard KPIs |
| h1 | 32/38 | -0.03em | 600 | page title |
| h2 | 22/28 | -0.02em | 600 | section |
| h3 | 18/24 | -0.02em | 500 | card title |
| body | 16/22 | 0 | 400 | default |
| small | 14/20 | 0 | 400 | meta |
| label | 12/16 | +0.06em, UPPERCASE | 500 | eyebrows, table headers, chips |

Money: `₹7,475` with Indian grouping (`en-IN`), paise hidden unless non-zero.

## Components

- **Button**: primary is ink fill + white text, 48px tall on mobile and 40px on desktop, 4px radius. Accent fill only for the single most important action on a screen (Pay). Secondary is a 1px ink outline. Ghost is text with an animated underline. Pressed: scale .98.
- **Link**: 1px underline that wipes in from the left on hover (`--ease-out` 280ms) and out to the right (`--ease-in`).
- **Card**: surface-1, 1px `--line-1`, radius 8, padding 20. No shadow.
- **Dues card** (signature): ink surface, label "DUE BY 10 NOV" in `--text-on-ink-2`, display amount in white, a thin progress hairline showing paid/total, full-width accent Pay button. When the flat is paid up: switches to surface-2 with a ✓ "All paid", not an empty card.
- **Status chip**: label type, pill, soft background + strong text (NEW grey, ASSIGNED blue, IN PROGRESS amber, RESOLVED green, REOPENED red).
- **Urgency marker**: 3px left border on rows (critical = danger, high = warn). Safety-escalated rows get a full ink strip with a white "SAFETY · Duty manager notified" label.
- **Timer**: `tabular-nums`, counts down to the response target, turns warn at 25% left and danger when breached.
- **Timeline**: vertical 1px line, 8px dots, the newest event on top.
- **AI suggestion**: a quiet row below the textarea: "Looks like **Plumbing · High** (AI)" + "Change". If the AI is unsure: "We'll let the help desk categorise this."
- **Table** (desk/committee): label-type headers, 1px row lines, 52px rows, sticky header. Below 768px it becomes stacked cards.
- **Bottom tab bar** (resident): Home, Bills, Complaints, More. 64px + safe area, 1px top line, active tab is ink with a 2px bar.
- **Empty state**: one line in h3, one line of body text, one action. No illustrations.
- **Skeleton**: surface-2 blocks with a slow shimmer (disabled for reduced motion).
- **Toast**: ink, bottom-centre on mobile, auto-dismiss after 4s, undo where possible.

## Motion

- Headings: per-line reveal (translateY 100% → 0, clip) at 500ms `--ease-out`, first paint only.
- Lists: 40ms stagger, opacity + 8px rise.
- Sheets/dialogs: slide up 280ms `--ease-out`.
- Numbers: count up on dashboard KPIs (600ms) on first view only.
- Everything off under `prefers-reduced-motion`.

## Screen notes

- **Resident home**: greeting + flat ID label → dues card → "Open complaints" (max 3, status chip + timer) → notices. FAB-free; "Raise complaint" is a secondary button under the complaints block.
- **Help desk queue**: left filter rail on desktop (chips on mobile), critical/safety rows pinned on top, row = urgency marker, title, flat, category chip (tap to change), assignee, timer.
- **Payments review**: three counters across the top (Auto-posted / Needs review / Unmatched) as display numbers, then the review list. Each row shows the narration in mono, reason chips ("Flat ID in ref +60", "Known UPI +50") and the top suggestion with Confirm as the primary action.
- **Committee**: four KPI tiles (Collected this month, Collection rate, Avg first response, Reopen rate), an ageing stacked bar, collections by month line chart, complaint resolution by category. Ink header band with month picker and "Export PDF".
- **Accessibility**: 4.5:1 minimum, visible 2px `--focus` ring with 2px offset, 44px minimum hit targets, and labels on every input.
