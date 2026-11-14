import { formatDuration, formatTotal } from './format';

export interface PdfSong { title: string; artist?: string; key?: string; tempo?: number; duration?: number; notes?: string | null }
export interface PdfSection { heading?: string; songs: PdfSong[] }

/** Builds a clean, printable setlist PDF (one or more sections) and downloads it. */
export async function exportSetlistPdf(title: string, subtitleLines: string[], sections: PdfSection[], filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(title, M, y + 8);
  y += 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  subtitleLines.filter(Boolean).forEach((line) => {
    doc.text(line, M, y);
    y += 14;
  });
  doc.setTextColor(0);
  y += 6;
  let n = 0;
  for (const section of sections) {
    const total = section.songs.reduce((s, x) => s + (x.duration || 0), 0);
    if (section.heading) {
      ensure(40);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(section.heading, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(`${section.songs.length} songs · ${formatTotal(total)}`, W - M, y, { align: 'right' });
      doc.setTextColor(0);
      y += 6;
      doc.setDrawColor(200);
      doc.line(M, y, W - M, y);
      y += 16;
    }
    for (const s of section.songs) {
      n++;
      const notes = s.notes ? doc.splitTextToSize(s.notes, W - M * 2 - 30) : [];
      ensure(22 + notes.length * 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`${n}.`, M, y);
      doc.text(s.title, M + 26, y);
      const meta = [s.key, s.tempo ? `${s.tempo} BPM` : '', s.duration ? formatDuration(s.duration) : ''].filter(Boolean).join('   ');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(meta, W - M, y, { align: 'right' });
      if (s.artist) {
        doc.setTextColor(110);
        doc.text(s.artist, M + 26, y + 12);
        doc.setTextColor(0);
        y += 12;
      }
      if (notes.length) {
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text(notes, M + 26, y + 12);
        doc.setTextColor(0);
        y += notes.length * 11;
      }
      y += 20;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`GigMasterPro · ${title}`, M, H - 24);
    doc.text(`${i} / ${pages}`, W - M, H - 24, { align: 'right' });
  }
  doc.save(filename.replace(/[^\w.-]+/g, '_'));
}
