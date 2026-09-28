/*
 * cues.js: the beat sheet as data. The composition reads it in the browser
 * (window.CUES) and the scripts read it in Node (beat-sheet, place-audio,
 * stills, render). Scene code never holds a literal time: it asks b(bar, beat).
 * `at` / `from` / `to` are [bar, beat, fraction] on the grid, or seconds.
 */
window.CUES = {
  name: "subul-xp-reel",
  title: "SUBUL XP",
  width: 1080,
  height: 1920,
  duration: 20.5714, // 12 bars at 140 BPM, no tail: the Reel loops on the downbeat
  grid: { bpm: 140, firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 }, // from assets/audio/bed.grid.json (exact)
  music: { src: "assets/audio/bed.wav", volume: 0.8, license: "generated with synth.py (trap, F minor, 140 BPM), no samples" },
  sfx: { dir: "assets/audio/sfx", peaks: "assets/audio/sfx/peaks.json" },
  safe: { top: 250, bottom: 420, left: 60, right: 120 },
  scenes: [
    { name: "01 Hook", from: [1, 1], to: [3, 1], what: "navy; a grape ribbon races through fog, pink glow head; 'Fais de ton PFE / ton premier / emploi.' slam on bar 2" },
    { name: "02 SUBUL XP", from: [3, 1], to: [5, 1], what: "light; the five slides fan as 3D cards; 'avec SUBUL XP' slams" },
    { name: "03 Encadrement", from: [5, 1], to: [7, 1], what: "plum; the drop: a field of glossy columns rises, glow sphere, shake; 'Un expert / chaque semaine'; four feature pills" },
    { name: "04 Résultats", from: [7, 1], to: [9, 1], what: "lilac; three glossy spheres bounce in; 01 CV, LinkedIn et portfolio / 02 Entretiens RH et techniques / 03 Visibilité auprès des entreprises" },
    { name: "05 Formats", from: [9, 1], to: [11, 1], what: "violet; spiral ribbon; the two white price cards (600 TND, 400 TND); 'Sans engagement · Réponse sous 48 h'" },
    { name: "06 Lockup", from: [11, 1], to: 20.5714, what: "navy; particles converge into SUBUL XP; wordmark, logo pill, xp.subul.uk, Contacte-nous sur WhatsApp" },
  ],
  events: [
    { at: [1, 1], what: "ribbon already racing, dust drifting" },
    { at: [1, 3], what: "camera cut: close on the glow head", sfx: "tick", volume: 0.2 },
    { at: [2, 1], what: "'Fais de ton PFE' slams", sfx: "thud", volume: 0.4 },
    { at: [2, 2], what: "'ton premier' slams", sfx: "thud", volume: 0.3 },
    { at: [2, 3], what: "'emploi.' slams in the pink-lavender gradient", sfx: "thud", volume: 0.4 },
    { at: [2, 4, 0.5], what: "magenta flood up", sfx: "whoosh", volume: 0.28 },
    { at: [3, 1], what: "light flip; 'avec' + 'SUBUL XP' slam; slides fan", sfx: "thud", volume: 0.45 },
    { at: [3, 3], what: "camera cut: close on the slides", sfx: "tick", volume: 0.2 },
    { at: [4, 1], what: "camera cut: high wide", sfx: "tick", volume: 0.2 },
    { at: [4, 3], what: "camera cut: low pass", sfx: "tick", volume: 0.2 },
    { at: [4, 4, 0.5], what: "magenta flood left (half-beat gap in the music)", sfx: "whoosh", volume: 0.28 },
    { at: [5, 1], what: "THE DROP: columns rise, shake; 'Un expert' slams", sfx: "thud", volume: 0.5 },
    { at: [5, 3], what: "'chaque semaine' slams; camera cut", sfx: "thud", volume: 0.4 },
    { at: [6, 1], what: "pill: Jira Premium et un Project Manager", sfx: "pop", volume: 0.35 },
    { at: [6, 2], what: "pill: Un Product Owner", sfx: "pop", volume: 0.3 },
    { at: [6, 3], what: "pill: Formation certifiée par SUBUL selon ton sujet", sfx: "pop", volume: 0.3 },
    { at: [6, 4], what: "pill: Formation soft skills", sfx: "pop", volume: 0.3 },
    { at: [6, 4, 0.5], what: "magenta flood up", sfx: "whoosh", volume: 0.28 },
    { at: [7, 1], what: "lilac flip; sphere 1 drops; '01 CV, LinkedIn et portfolio'", sfx: "ping", volume: 0.35 },
    { at: [7, 3], what: "sphere 2 drops; '02 Entretiens RH et techniques'", sfx: "ping", volume: 0.35 },
    { at: [8, 1], what: "sphere 3 drops; '03 Visibilité auprès des entreprises'", sfx: "ping", volume: 0.35 },
    { at: [8, 3], what: "camera cut: low, close on the spheres", sfx: "tick", volume: 0.2 },
    { at: [8, 4, 0.5], what: "magenta flood right", sfx: "whoosh", volume: 0.28 },
    { at: [9, 1], what: "violet flip; card 'Ingénieur & Master · 6 mois / 600 TND' pops", sfx: "pop", volume: 0.4 },
    { at: [9, 3], what: "card 'Licence · 4 mois / 400 TND' pops", sfx: "pop", volume: 0.4 },
    { at: [10, 1], what: "chip 'Sans engagement · Réponse sous 48 h'", sfx: "tick", volume: 0.25 },
    { at: [10, 3], what: "camera cut: the spiral from above", sfx: "tick", volume: 0.2 },
    { at: [10, 4, 0.5], what: "magenta flood up", sfx: "whoosh", volume: 0.28 },
    { at: [11, 1], what: "navy; particles converge into SUBUL XP", sfx: "chime", volume: 0.35 },
    { at: [11, 3], what: "the crisp SUBUL XP wordmark lands", sfx: "thud", volume: 0.4 },
    { at: [12, 1], what: "logo pill + xp.subul.uk", sfx: "pop", volume: 0.35 },
    { at: [12, 3], what: "'Contacte-nous sur WhatsApp'", sfx: "tick", volume: 0.2 },
  ],
};
