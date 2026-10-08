/**
 * Export the whole book. Word gets an HTML document in Word's own dialect (.doc), which Word,
 * Google Docs and LibreOffice all open, with the page cut to the book's trim size, right-to-left
 * for Hebrew, and a page number in the footer. PDF is the print page (pages/PrintBook.tsx) saved
 * through the browser, which keeps every Hebrew glyph exactly as on screen.
 */
import type { Book, Chapter } from './api';
import { escapeHtml, paragraphsOf } from './bookText';

const isRtl = (s: string) => /[֐-׿]/.test(s.slice(0, 600));

export const downloadDoc = (book: Book, chapters: Chapter[], chapterLabel: string) => {
  const rtl = isRtl(`${book.title} ${chapters.map(c => c.title + c.body).join(' ')}`);
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const body = chapters.map((c, i) => {
    const ps = paragraphsOf(c.body).map(p => p.trim()
      ? `<p class="Body" dir="${dir}">${escapeHtml(p)}</p>`
      : '<p class="Body">&nbsp;</p>').join('');
    return `<p class="ChapNo" dir="${dir}" style="page-break-before:always">${escapeHtml(`${chapterLabel} ${i + 1}`)}</p>
      <h1 dir="${dir}">${escapeHtml(c.title)}</h1>${ps}`;
  }).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page Book { size: 5.5in 8.5in; margin: .75in .6in .85in .6in; mso-footer: footer1; mso-page-orientation: portrait; }
div.Book { page: Book; }
body { font-family: 'Frank Ruhl Libre', 'David', 'Times New Roman', serif; font-size: 11.5pt; }
p.Body { margin: 0; text-indent: .25in; line-height: 150%; text-align: justify; direction: ${dir}; unicode-bidi: embed; }
p.ChapNo { text-align: center; font-size: 9pt; letter-spacing: 2pt; color: #9a3412; margin: 1.2in 0 6pt; }
h1 { text-align: center; font-size: 20pt; margin: 0 0 .4in; direction: ${dir}; }
p.Title { text-align: center; font-size: 28pt; font-weight: bold; margin: 2.4in 0 12pt; direction: ${dir}; }
p.Author { text-align: center; font-size: 13pt; color: #5b5247; direction: ${dir}; }
p.MsoFooter { text-align: center; font-size: 9pt; color: #8a7f70; }
</style></head>
<body dir="${dir}" style="text-align:${align}"><div class="Book">
<p class="Title">${escapeHtml(book.title)}</p>
${book.authorName || book.author || book.ownerDisplay ? `<p class="Author">${escapeHtml(book.authorName || book.author || book.ownerDisplay || '')}</p>` : ''}
${body}
<div style="mso-element:footer" id="footer1"><p class="MsoFooter"><span style="mso-field-code:' PAGE '"></span></p></div>
</div></body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${book.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'book'}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
