/**
 * Shared Teachometry icon set.
 *
 * Utility icons stay deliberately quiet. Semantic icons use more distinctive
 * pictograms so the evaluation dimensions and research concepts do not read
 * like generic placeholder glyphs.
 */
const semanticIcons = new Set([
  "diagnosis",
  "guidance",
  "actionability",
  "correctness",
  "adaptation",
  "document",
  "book",
  "database",
  "chart",
  "flask",
  "robot",
  "shield",
  "target",
  "user",
  "leaf",
]);

export function siteIcon(name: string): string {
  const paths: Record<string, string> = {
    arrow: '<path d="M4.5 12h14.5"/><path d="m14 6.5 5.5 5.5-5.5 5.5"/>',
    left: '<path d="m15 5.5-6.5 6.5 6.5 6.5"/>',
    right: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',

    // Evaluation dimensions: purpose-built rather than generic stock glyphs.
    diagnosis:
      '<circle cx="10.25" cy="10.25" r="6.75"/><path d="m15.2 15.2 4.9 4.9"/><path d="M7.4 9.4c.7-1.35 1.75-2.05 3.05-2.05 1.5 0 2.65.9 2.65 2.2 0 1.08-.62 1.68-1.58 2.2-.83.45-1.17.86-1.17 1.55"/><circle cx="10.35" cy="15.65" r=".7" fill="currentColor" stroke="none"/>',
    guidance:
      '<path d="M4.25 5.25h15.5v10.1a2.4 2.4 0 0 1-2.4 2.4H10l-4.15 2.65v-2.65h-1.6z"/><path d="M7.5 9.1h7.8"/><path d="m12.35 7.15 2.95 1.95-2.95 1.95"/><circle cx="8.15" cy="13.1" r=".7" fill="currentColor" stroke="none"/>',
    actionability:
      '<rect x="4.25" y="3.75" width="15.5" height="16.5" rx="2.1"/><path d="m7.2 8.2 1.45 1.45 2.25-2.55"/><path d="M12.8 8.45h3.9"/><path d="m7.2 14 1.45 1.45 2.25-2.55"/><path d="M12.8 14.25h3.9"/><path d="M17.2 18.25h2.7"/><path d="m18.55 16.9 1.35 1.35-1.35 1.35"/>',
    correctness:
      '<path d="M12 3.3 19.4 6v5.45c0 4.55-2.75 7.75-7.4 9.25-4.65-1.5-7.4-4.7-7.4-9.25V6z"/><path d="m8.15 12.05 2.45 2.45 5.2-5.35"/>',
    adaptation:
      '<path d="M5 5.25h14"/><path d="M5 12h14"/><path d="M5 18.75h14"/><circle cx="9" cy="5.25" r="2"/><circle cx="15.25" cy="12" r="2"/><circle cx="11.25" cy="18.75" r="2"/>',

    document:
      '<path d="M6.2 3.3h7.2l4.4 4.4v13H6.2z"/><path d="M13.4 3.3v4.6h4.4"/><path d="M9 11.2h6"/><path d="M9 14.5h6"/><path d="M9 17.8h3.7"/>',
    list:
      '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><circle cx="4.2" cy="6" r=".9"/><circle cx="4.2" cy="12" r=".9"/><circle cx="4.2" cy="18" r=".9"/>',
    grid:
      '<rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.25"/><rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.25"/><rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.25"/><rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.25"/>',
    search:
      '<circle cx="10.4" cy="10.4" r="6.35"/><path d="m15.25 15.25 4.7 4.7"/>',
    filter:
      '<path d="M4 6h16"/><circle cx="8" cy="6" r="1.7"/><path d="M4 12h16"/><circle cx="15" cy="12" r="1.7"/><path d="M4 18h16"/><circle cx="11" cy="18" r="1.7"/>',
    refresh:
      '<path d="M19.5 8.5A8 8 0 1 0 20 15"/><path d="M19.5 3.5v5h-5"/>',
    chart:
      '<path d="M4.25 20.25h15.5"/><rect x="5.25" y="12.25" width="3.1" height="6.2" rx=".7"/><rect x="10.45" y="8.4" width="3.1" height="10.05" rx=".7"/><rect x="15.65" y="4.65" width="3.1" height="13.8" rx=".7"/>',
    clock:
      '<circle cx="12" cy="12" r="8.75"/><path d="M12 6.7V12l3.45 2.1"/>',
    spark:
      '<path d="m12 3 1.55 5.05L18.6 9.6l-5.05 1.55L12 16.2l-1.55-5.05L5.4 9.6l5.05-1.55z"/><path d="m18.7 15.7.65 2.15 2.15.65-2.15.65-.65 2.15-.65-2.15-2.15-.65 2.15-.65z"/>',
    check: '<path d="m5.2 12.2 4 4 9.6-10"/>',
    close: '<path d="m6.2 6.2 11.6 11.6"/><path d="M17.8 6.2 6.2 17.8"/>',
    bookmark:
      '<path d="M7 3.25h10a1.75 1.75 0 0 1 1.75 1.75v16l-6.75-4.05L5.25 21V5A1.75 1.75 0 0 1 7 3.25Z"/>',
    package:
      '<path d="m12 3.25 7.75 4.25v9L12 20.75 4.25 16.5v-9z"/><path d="m4.25 7.5 7.75 4.25 7.75-4.25"/><path d="M12 11.75v9"/>',
    book:
      '<path d="M3.25 5.1c2.6-1.45 5.4-1.15 8.75.85v14.2c-3.35-2-6.15-2.3-8.75-.85z"/><path d="M20.75 5.1c-2.6-1.45-5.4-1.15-8.75.85v14.2c3.35-2 6.15-2.3 8.75-.85z"/><path d="M7 8.1c1.25.05 2.35.35 3.3.9"/><path d="M17 8.1c-1.25.05-2.35.35-3.3.9"/>',
    database:
      '<ellipse cx="12" cy="5.25" rx="7.75" ry="2.75"/><path d="M4.25 5.25v6c0 1.52 3.47 2.75 7.75 2.75s7.75-1.23 7.75-2.75v-6"/><path d="M4.25 11.25v6c0 1.52 3.47 2.75 7.75 2.75s7.75-1.23 7.75-2.75v-6"/><path d="M16.1 8.25h.01"/>',
    link:
      '<path d="M9.75 13.6a4.35 4.35 0 0 0 6.15 0l2.15-2.15a4.35 4.35 0 0 0-6.15-6.15L10.7 6.45"/><path d="M14.25 10.4a4.35 4.35 0 0 0-6.15 0l-2.15 2.15a4.35 4.35 0 0 0 6.15 6.15l1.15-1.15"/>',
    laptop:
      '<rect x="4.75" y="4" width="14.5" height="11.25" rx="1.5"/><path d="M3 19.3h18"/><path d="M9 19.3h6"/>',
    play: '<path d="m9 6.2 8.8 5.8L9 17.8z"/>',
    cloud:
      '<path d="M7.1 19.25h9.8a3.85 3.85 0 0 0 .55-7.66A5.8 5.8 0 0 0 6.15 10a4.25 4.25 0 0 0 .95 9.25Z"/>',
    ban:
      '<circle cx="12" cy="12" r="8.75"/><path d="m5.8 5.8 12.4 12.4"/>',
    copy:
      '<rect x="8.25" y="7.75" width="10.5" height="12.25" rx="1.5"/><path d="M15.75 7.75V5.5A1.5 1.5 0 0 0 14.25 4h-8.5a1.5 1.5 0 0 0-1.5 1.5v9.5a1.5 1.5 0 0 0 1.5 1.5h2.5"/>',
    flask:
      '<path d="M8.6 3.3h6.8"/><path d="M10 3.3v5.3l-5.3 8.65a2.25 2.25 0 0 0 1.92 3.42h10.76a2.25 2.25 0 0 0 1.92-3.42L14 8.6V3.3"/><path d="M7.7 15.4h8.6"/><circle cx="10" cy="17.7" r=".65" fill="currentColor" stroke="none"/>',
    info:
      '<circle cx="12" cy="12" r="8.75"/><path d="M12 10.7v5.4"/><circle cx="12" cy="7.7" r=".7" fill="currentColor" stroke="none"/>',
    robot:
      '<rect x="4.2" y="7.2" width="15.6" height="11.6" rx="2.8"/><path d="M12 3.2v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M8.25 15.8h7.5"/><path d="M2.8 11.2v4"/><path d="M21.2 11.2v4"/>',
    shield:
      '<path d="M12 3.15 19.6 6v5.05c0 4.85-2.95 8.25-7.6 9.65-4.65-1.4-7.6-4.8-7.6-9.65V6z"/><path d="m8.3 11.9 2.35 2.35 5.05-5.15"/>',
    target:
      '<circle cx="12" cy="12" r="8.7"/><circle cx="12" cy="12" r="4.65"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><path d="M18.15 5.85 20.7 3.3"/><path d="M18.15 5.85h2.55V3.3"/>',
    user:
      '<circle cx="12" cy="8.1" r="3.35"/><path d="M5.2 20.5c.6-4.2 2.9-6.3 6.8-6.3s6.2 2.1 6.8 6.3"/><path d="M8.2 17.2h7.6"/>',
    leaf:
      '<path d="M19.9 3.45C11.2 2.1 5.25 4.35 4.35 10.1c-.75 4.8 3 7.95 7.45 6.85 4.4-1.1 7.15-5.6 8.1-13.5Z"/><path d="M3.7 21c4.2-5.2 8.55-9.3 13.05-12.3"/><path d="M8.35 15.55c-.1-2.2.25-4.25 1.05-6.15"/><path d="M11.65 12.45c1.65.1 3.15-.15 4.5-.75"/>',

    sun:
      '<circle cx="12" cy="12" r="3.75"/><path d="M12 1.5v2.1"/><path d="M12 20.4v2.1"/><path d="M1.5 12h2.1"/><path d="M20.4 12h2.1"/><path d="m4.6 4.6 1.5 1.5"/><path d="m17.9 17.9 1.5 1.5"/><path d="m4.6 19.4 1.5-1.5"/><path d="m17.9 6.1 1.5-1.5"/>',
    moon:
      '<path d="M20 15.8A8.75 8.75 0 0 1 8.2 4 8.75 8.75 0 1 0 20 15.8Z"/>',
    github:
      '<path d="M9 21c-5 1-5-3-7-3m14 4v-4a3.5 3.5 0 0 0-1-3c3-.3 6-1.5 6-6a5 5 0 0 0-1.4-3.5A4.5 4.5 0 0 0 19.5 2S18.3 1.7 16 3a13 13 0 0 0-8 0C5.7 1.7 4.5 2 4.5 2a4.5 4.5 0 0 0-.1 3.5A5 5 0 0 0 3 9c0 4.5 3 5.7 6 6a3.5 3.5 0 0 0-1 3v4"/>',
  };

  const semanticClass = semanticIcons.has(name) ? " site-icon--semantic" : "";
  return `<svg class="site-icon${semanticClass}" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${semanticIcons.has(name) ? "1.55" : "1.7"}" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" focusable="false" aria-hidden="true">${paths[name] ?? paths.arrow}</svg>`;
}
