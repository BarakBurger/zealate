/** How a chapter's text becomes book pages, shared by the reader, its page numbering and export. */

export const paragraphsOf = (body: string) => body.replace(/\r/g, '').split('\n');

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The same markup the reader renders, as a string, for off-screen measuring and for export. */
export const chapterHtml = (label: string, title: string, body: string, fin: string | null) => {
  const paras = paragraphsOf(body);
  let seenText = false;
  const ps = paras.map(p => {
    if (!p.trim()) return '<p class="blank" aria-hidden="true"></p>';
    const cls = seenText ? '' : ' class="first"';
    seenText = true;
    return `<p dir="auto"${cls}>${escapeHtml(p)}</p>`;
  }).join('');
  return `<span class="chap-no">${escapeHtml(label)}</span><h1 dir="auto">${escapeHtml(title)}</h1>${ps}${fin ? `<p class="fin">${fin}</p>` : ''}`;
};

export type Geo = { per: number; colW: number; gap: number };

/**
 * How many spreads a laid-out chapter fills. If the closing ornament had to start a page of its
 * own it is hidden first: a page holding nothing but a flourish reads as a mistake.
 */
export const countSpreads = (flow: HTMLElement, geo: Geo, dir: 'rtl' | 'ltr') => {
  const colOf = (r: DOMRect) => {
    const box = flow.getBoundingClientRect();
    return Math.round((dir === 'rtl' ? box.right - r.right : r.left - box.left) / (geo.colW + geo.gap));
  };
  const fins = flow.querySelectorAll<HTMLElement>('.fin');
  fins.forEach(f => { f.style.display = ''; });
  const last = fins[0]?.previousElementSibling as HTMLElement | null;
  if (fins[0] && last) {
    const rects = last.getClientRects();
    const lastRect = rects[rects.length - 1];
    if (lastRect && colOf(fins[0].getBoundingClientRect()) !== colOf(lastRect)) fins.forEach(f => { f.style.display = 'none'; });
  }
  const cols = Math.max(1, Math.round((flow.scrollWidth + geo.gap) / (geo.colW + geo.gap)));
  return Math.max(1, Math.ceil(cols / geo.per));
};
