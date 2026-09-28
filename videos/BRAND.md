# SUBUL XP brand profile for video

The brand, the owner's standing choices and the films made so far. Every new film reads this first and only asks what is new.
Sources: the 7-slide "Fais de ton PFE ton premier emploi" carousel (5 slides supplied, 2026-09-28), the landing page `index.html` of this repo (xp.subul.uk, "Ta demande de lab"), the user's brief. The live sites (app.subul.uk, xp.subul.uk, subul.uk, smartovate.com) and the LinkedIn post were unreachable from the render environment (network policy). When this file and the brand's own files disagree, the brand's files win.

## Owner choices (standing: reuse for every film unless they say otherwise)
- Where films play: Instagram Reel 9:16 (1080x1920). Usual length: 20 s. Language: fr (tutoiement, "ton PFE"). Audience: Tunisian students finishing their studies (PFE = projet de fin d'études), licence, master, engineering.
- Music: no track supplied; generated trap bed (synth.py), F minor, 140 BPM. The owner may swap in-app audio when posting.
- Tone: confident, direct, young. The brand's loop in three statements: 1. "Fais de ton PFE ton premier emploi." 2. "Un expert t'encadre chaque semaine." 3. "CV, entretiens, visibilité auprès des entreprises."
- Ending: SUBUL XP wordmark, the SUBUL | Smartovate logo pill, `app.subul.uk`, "Contacte-nous sur WhatsApp", +32 49 249 38 52 · +44 74 512 68 070 (owner, 2026-09-28).
- Notes from past films that apply to all: "make the motion more pro" (2026-09-28): masked line reveals with tracking-in, eased exits before every cut, count-ups on numbers, staggered glides for UI, a two-tone wipe, a slow drift on every hold.

## Chosen by Claude (the owner can overrule)
- 2026-09-28: video type = product launch / promo hybrid (hook, name, what you get, outcomes, the two formats, lockup); 12 bars at 140 BPM; generated trap bed with hits on bars 3, 5, 9, 11; a magenta flood on every chapter cut; the HUD counters in Space Mono echo the "07 / 07" counters of the carousel.
- Headlines keep the carousel's sentence case (not uppercase): the brand's own casing wins on look.
- Display font: Plus Jakarta Sans (the landing page's font, Google Fonts, OFL). The carousel's geometric headline face was not supplied; Plus Jakarta Sans 800 is the closest brand-owned face. Mono for counters: Space Mono (OFL), matching the carousel's slashed-zero counters.

## Assumed, not asked
- The user sent the skill's example prompts plus the slides and "just go" context; no interview was possible (autonomous session). Format 9:16, 20 s, music generated, all facts taken from the slides and the landing page word for word.
- The 600 TND / 400 TND figures are shown exactly as the carousel shows them (label + amount on a white card); the film does not say what they are (fee or stipend) because the slides do not.

## Films
| Film | Type | Date | Owner's reaction, what changed |
|---|---|---|---|
| subul-xp-reel | launch / promo Reel, 20.57 s | 2026-09-28 | first cut, awaiting notes |

## Assets on file (reusable across films)
| Asset | Path | Notes (size, rights, consent) |
|---|---|---|
| Carousel slides 1 to 5 | `subul-xp-reel/assets/1.webp` .. `5.webp` | 1600x2000, owner's own creative |
| Logo pill (SUBUL | Smartovate) | `subul-xp-reel/assets/logo-pill.png` | 387x118 crop from slide 1; ask the owner for the SVG for a sharper lockup |
| Fonts | `subul-xp-reel/assets/fonts/` | Plus Jakarta Sans variable (OFL), Space Mono 400/700 (OFL) |
| Music, SFX | `subul-xp-reel/assets/audio/` | generated with synth.py, no samples, free to publish |

## Brand moment: what bends, what never does
- Bends for video: pace, light (env map, bloom on the pink highlight), depth (fog, particles), 3D, camera cuts, floods, shake, grain, motion blur, HUD.
- Never bends: the palette below, pink as the one highlight, the logo pill as supplied, the fonts, the tutoiement voice, the facts on the slides, the landing page's lines.
- Brand graphic pack used as stickers and slams: the white rounded feature pills with a pink dot (slide 6), the pink mono counters "01 / 07", the magenta-to-purple top gradient bar, the soft magenta radial glow in a corner.

## Hard rules
- Casing: sentence case headlines ("Fais de ton PFE"), product name always "SUBUL XP" in caps (slides 2, 6).
- Type: Plus Jakarta Sans 800 for headlines, 500/600 for body; mono only for counters and the URL.
- Corners: cards 28 px radius on the slides, 6 px on the landing page; film uses the slides' 28 px for white cards and pills.
- Surfaces: dark navy or light off-white backgrounds; white cards only where the slides have them.
- Borders and shadows: white pills carry a 1 px lilac border (#EAE4F0) on the light slide; no shadows.
- Copy: French, tutoiement, middle dot separators ("Ingénieur & Master · 6 mois"), no exclamation marks.
- Claims: see "Claims".

## Frame (1080x1920, 60 fps, alternating dark/light)
- Framing: full bleed.
- Safe zone: social 9:16: top 250, bottom 420, left 60, right 120 (social.md).
- Words: slammed headlines, Plus Jakarta Sans 800, 110 to 200 px, white or ink, key words in the pink-to-lavender gradient.
- Scenes: UI text only inside the white cards and pills; read content 90 px from the edges.

## Color
| Token | Value | Use |
|---|---|---|
| navy | #1A1350 | slides' dark background, the film's home background |
| plum | #291240 | landing page background, drop chapter |
| violet | #4C1D95 | landing button, offer chapter |
| ink | #1A0E2E | headline ink on light |
| light | #FAFAFC | slide 6 background |
| lilac | #F4EAFE | landing "purple-lt", outcomes chapter |
| magenta | #D6006E | landing accent, floods, prices |
| rose | #DB1E8D | gradient start (SUBUL) |
| grape | #751D86 | gradient end (XP) |
| pink | #FD51AF | the one highlight: counters, bloom |
| lavender | #CA7AF9 | gradient end of "emploi." |
| soft | #E3D9EF | body text on dark |
| label | #6C6880 | card labels |
| white | #FFFFFF | cards, headlines on dark |

Hex only for anything that animates.

## Type
- Fonts: `assets/fonts/PlusJakartaSans-800.woff2` (variable, declared 200 to 800), `assets/fonts/SpaceMono-400.woff2`, `assets/fonts/SpaceMono-700.woff2`.
- Math: none. Right-to-left script: none in this film (the SUBUL mark is Arabic calligraphy inside the logo image; never mirrored).
- Sizes at the delivery size: headlines 110 to 200 px, card labels 40 px, prices 116 px, chips 40 px, HUD 22 px.

## Signature elements
| Element | Look | Source | In films |
|---|---|---|---|
| Feature pill | white, 28 px radius, 1 px lilac border, pink dot, ink text | slide 6 | DOM chips in the drop chapter |
| Counter | Space Mono 700, pink, "05 / 07" | slides 3 to 7 | HUD top-right, outcome numbers "01 02 03" |
| Price card | white, 28 px radius, grey label, magenta price | slide 7 | DOM cards in the offer chapter |
| Top gradient bar | magenta to purple, 8 px | every slide | thin bar at the top of every frame |
| Corner glow | soft magenta radial | slides 1, 3, 4, 7 | fog and bloom in 3D |

## Logo and brand element
- Logo: `assets/logo-pill.png` (SUBUL mark | Smartovate). Animation used: pops in at the lockup; never redrawn.
- Wordmark: "SUBUL XP" set in Plus Jakarta Sans 800 with the rose-to-grape gradient, exactly as slide 6.
- Never: recolouring the logo, stretching it, placing it on a busy background.

## Components
| Need | Component (path) | In films: import / twin / redraw, and why |
|---|---|---|
| Feature pill | slide 6 pills | redrawn as DOM (crisp text, measurable by check) |
| Price card | slide 7 cards | redrawn as DOM |
| Slides | `assets/*.webp` | unlit 3D cards (exact colours) in the name chapter |

## Motion
- Landing page easing: transitions 0.14 to 0.18 s ease; the film uses the kit's slam and spring curves for the showreel register.
- Blur: the brand does not blur in UI; slams keep the kit's blur-to-sharp (showreel register).
- The one highlight: pink #FD51AF, the glow material and the bloom, one glowing object per 3D scene.
- Transitions: a magenta flood on every chapter cut, hard camera cuts every 2 beats inside 3D.

## Claims
- What the product does (films may show): weekly expert supervision, Jira Premium and a Project Manager, a Product Owner, SUBUL-certified training on the subject, soft-skills training, CV/LinkedIn/portfolio, HR and technical interview practice, visibility with Smartovate partner companies in Tunisia and abroad, two formats (Ingénieur & Master 6 mois 600 TND, Licence 4 mois 400 TND), WhatsApp contact, "Sans engagement · Réponse sous 48 h".
- What it never does (films must not show): guaranteed hiring, salary promises, partner company names or logos (none supplied), any figure not on the slides.
- Approved lines: "Fais de ton PFE ton premier emploi.", "Pendant ton PFE avec SUBUL XP", "Un expert qui t'encadre chaque semaine", "Jira Premium et un Project Manager", "Un Product Owner", "Formation certifiée par SUBUL selon ton sujet", "Formation soft skills", "CV, LinkedIn et portfolio", "Entretiens RH et techniques", "Visibilité auprès des entreprises", "Contacte-nous sur WhatsApp", "Sans engagement · Réponse sous 48 h".
- Words to avoid: "garanti", "emploi assuré", "formation" as the product's category (the README says "a tech residency, not a training center").

## Workspace
- Folder `videos/subul-xp-reel/`, HyperFrames 0.8.82 (pinned by init), vendored GSAP 3.14.2 and Three.js 0.181.2 in `vendor/`, fonts in `assets/fonts/`, components redrawn as DOM, scripts: setup, synth (music + sfx), place-audio, beat-sheet, stills, render, verify (all from the brand-motion-design skill).
