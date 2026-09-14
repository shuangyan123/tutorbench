/** 首页图标仅表达操作与维度，品牌标记仍使用批准的静态资源。 */
export function siteIcon(name: string): string {
  const paths: Record<string, string> = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    diagnosis: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    guidance: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-9a9 9 0 1 1 19-2Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/>',
    actionability: '<path d="M9 5h12M9 12h12M9 19h12"/><circle cx="3" cy="5" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="19" r="1"/>',
    correctness: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    adaptation: '<circle cx="9" cy="6" r="3"/><path d="M2 22v-5a7 7 0 0 1 14 0v5M16 3a4 4 0 0 1 0 8m3 3a6 6 0 0 1 3 5v3"/>',
    book: '<path d="M12 5C8 2 4 2 2 4v16c3-2 6-2 10 0 4-2 7-2 10 0V4c-3-2-6-2-10 1Zm0 0v15"/>',
    leaf: '<path d="M20 3C8 1 2 7 5 14s15 3 15-11ZM3 22 15 9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    moon: '<path d="M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z"/>',
    github: '<path d="M9 21c-5 1-5-3-7-3m14 4v-4a3.5 3.5 0 0 0-1-3c3-.3 6-1.5 6-6a5 5 0 0 0-1.4-3.5A4.5 4.5 0 0 0 19.5 2S18.3 1.7 16 3a13 13 0 0 0-8 0C5.7 1.7 4.5 2 4.5 2a4.5 4.5 0 0 0-.1 3.5A5 5 0 0 0 3 9c0 4.5 3 5.7 6 6a3.5 3.5 0 0 0-1 3v4"/>',
  };
  return `<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.arrow}</svg>`;
}
