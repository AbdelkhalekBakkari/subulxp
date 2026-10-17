<context>
SUBUL XP (by Smartovate) turns a student's PFE (final-year project) into a supervised, company-grade experience so it becomes their first job. This film plays as an Instagram Reel, 9:16, 20.57 s. It must read with the sound off.
Read `videos/BRAND.md` first. This prompt only adds the story.
</context>

<inputs>
Type: product launch / promo hybrid.
Facts from the owner, word for word (carousel + landing page): "Fais de ton PFE ton premier emploi." · "Pendant ton PFE avec SUBUL XP" · "Un expert qui t'encadre chaque semaine" · "Jira Premium et un Project Manager" · "Un Product Owner" · "Formation certifiée par SUBUL selon ton sujet" · "Formation soft skills" · "01 CV, LinkedIn et portfolio" · "02 Entretiens RH et techniques" · "03 Visibilité auprès des entreprises" · "Ingénieur & Master · 6 mois — 600 TND" · "Licence · 4 mois — 400 TND" · "Contacte-nous sur WhatsApp" · "Sans engagement · Réponse sous 48 h" · app.subul.uk (the owner's URL).
Assets used: slides 1 to 5 as unlit 3D cards (chapter 2); logo-pill.png at the lockup. Missing: SVG logo (replaced by the crop), a licensed track (replaced by a generated trap bed), the reference LinkedIn video (unreachable; the slides are the reference look).
Decided: 1080x1920, 60 fps, alternating dark/light chapters, 12 bars at 140 BPM, 20.5714 s. Music: generated with synth.py, F minor, i VI VII v, energy 123333333321, hits on bars 3 5 9 11, riser into 5, gap before 5, in `assets/audio/bed.wav`.
</inputs>

<direction>
Fast, lit, proud. Pink light on navy, then a bright flip, then back.
The message, in three statements: 1. Fais de ton PFE ton premier emploi. 2. Un expert t'encadre chaque semaine. 3. CV, entretiens, visibilité auprès des entreprises.
Showreel defaults: a lit 3D showpiece per chapter, a camera cut every 2 beats, slammed words over wide shots, a colour flip per chapter (navy, light, plum, lilac, violet, navy), the HUD with chapter labels and "0N / 06" counters, particles converging into the SUBUL XP wordmark at the end.
Only the brand's colours, type and logo; light, depth and motion are the showreel's.
Banned: uppercase headlines (the brand writes sentence case), any guarantee of hiring, partner names, numbers not on the slides, exclamation marks.
</direction>

<cast>
- The brand element: the "SUBUL XP" gradient wordmark and the SUBUL | Smartovate logo pill, at the lockup only.
- Cursors: none.
- Demo world: the carousel's own lines and cards.
</cast>

<structure>
140 BPM, 4/4, 12 bars. One beat is 0.4286 s, a bar 1.714 s. Something happens on every beat.
Bars 1 and 2, cold open + hook (navy). A glossy grape ribbon races through fog with a pink glow head, dust drifting; the camera cuts on beat 3. Bar 2: "Fais de ton PFE" / "ton premier" / "emploi." slam on beats 1, 2, 3 (the last in the pink-to-lavender gradient of slide 7). Magenta flood up on the last eighth.
Bars 3 and 4, the name (light). The five slides fan as unlit cards in an arc, slowly turning under a cutting camera; "avec" and "SUBUL XP" (rose-to-grape gradient, as slide 6) slam on the downbeat. Flood left.
Bars 5 and 6, the drop (plum). A field of glossy columns rises in a wave through the navy-magenta-pink ramp, a pink glow sphere rides above, one shake; "Un expert" / "chaque semaine" slam on beats 1 and 3 of bar 5; the four feature pills of slide 6 pop in on the four beats of bar 6. Flood up.
Bars 7 and 8, the outcomes (lilac). Three glossy spheres (pink, magenta, purple) drop and bounce on beats 7.1, 7.3, 8.1 while the three numbered lines of slides 3 to 5 land in the top band: 01 CV, LinkedIn et portfolio; 02 Entretiens RH et techniques; 03 Visibilité auprès des entreprises. Flood right.
Bars 9 and 10, the two formats (violet). A spiral ribbon and dust behind; the two white price cards of slide 7 pop in on 9.1 and 9.3, "Sans engagement · Réponse sous 48 h" on 10.1. Flood up.
Bars 11 and 12, the lockup (navy). Particles converge into "SUBUL XP"; the crisp gradient wordmark lands on 11.3; the logo pill and app.subul.uk on 12.1; "Contacte-nous sur WhatsApp" on 12.3 and the two WhatsApp numbers (+32 49 249 38 52 · +44 74 512 68 070) right after; hold to the downbeat after bar 12 so the Reel loops on the beat.
</structure>

<build>
1. HyperFrames project in `videos/subul-xp-reel/` (`scripts/setup.mjs`). Kit in `kit/`, runtimes vendored in `vendor/`.
2. Every style is a pure function of t: `setup()` builds and measures once, `draw(t)` sets styles.
3. `cues.js` is the beat sheet as data; scene code never holds a literal time.
4. Springs are closed form (`PF.step`).
5. Transitions: magenta floods (`PF.flood`) across every chapter cut, hard camera cuts (`PF.three.shots`) inside chapters.
6. Music: `scripts/synth.py music` (done) and `synth.py sfx` + `scripts/place-audio.mjs`.
7. Gate: `npx hyperframes check`. Final: `scripts/render.mjs`, then `scripts/verify.py`.
</build>

<gotchas>
No closing script tag in any script or comment. Shown means visibility: inherit. Measure after fonts. Never put will-change on anything the camera scales. Text never travels across text. Keep a slot for every word before it lands. Draw dashes as SVG strokes. Judge the encoded file.
Claims: prices and lines exactly as on the slides; no "garanti".
</gotchas>

<start>
Read `videos/BRAND.md`. Show the beat sheet and three style frames (the hook, the drop, the lockup), then the draft.
</start>
