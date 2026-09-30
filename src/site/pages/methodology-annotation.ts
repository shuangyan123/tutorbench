// 两行固定注记使用手绘单线字形，避免系统手写字体改变字宽、换行或引线关系。
const glyphs: Readonly<Record<string, readonly [number, string]>> = {
  F: [8, "M1 11Q2 5 3 0L9 0M2 5L7 5"],
  r: [5, "M1 11L2 4M2 7Q4 3 6 4"],
  o: [7, "M7 5C2 2 0 7 2 10C5 13 9 7 7 5Z"],
  m: [11, "M1 11L2 4M2 7Q6 1 6 7L5 11M6 7Q10 1 11 6L10 11"],
  c: [7, "M7 5Q4 2 2 6C0 11 4 13 7 9"],
  a: [8, "M7 5C2 2 0 7 2 10Q5 13 7 5L6 11Q7 12 9 10"],
  s: [6, "M6 4Q3 2 2 5C1 7 6 6 5 9Q4 12 1 11"],
  e: [7, "M1 8Q7 8 7 5C6 2 1 5 1 8Q1 13 7 10"],
  t: [5, "M4 0L2 9Q1 13 5 10M0 5L6 4"],
  i: [4, "M2 5L1 10Q1 12 4 10M3 1L3 1.2"],
  n: [8, "M1 11L2 4M2 7Q7 0 8 6L7 11"],
  g: [8, "M7 5C2 2 0 7 2 10Q5 13 7 5L6 14C5 19 0 18 1 15"],
  h: [8, "M1 11L4 0M2 7Q7 1 8 6L7 11"],
  '.': [3, "M1 11L1 11.2"],
  ' ': [4, ""],
};

function lettering(line: string, y: number): string {
  let x = 1;
  return [...line].map((character) => {
    const glyph = glyphs[character];
    if (!glyph) throw new Error("Unsupported methodology annotation glyph");
    const [advance, path] = glyph;
    const markup = path ? `<path transform="translate(${x} ${y})" d="${path}"/>` : "";
    x += advance + 1;
    return markup;
  }).join("");
}

export function renderMethodologyAnnotation(): string {
  return `<svg class="method-hero-lettering" viewBox="0 0 127 43" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round">${lettering("From", 1)}${lettering("cases to insights.", 22)}</svg>`;
}
