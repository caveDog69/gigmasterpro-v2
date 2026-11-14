import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, HelpCircle, Upload, XCircle } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { SearchResult } from '../../lib/types';
import { formatDuration, parseDuration, cx } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader, Spinner, Toggle } from '../../components/ui';

interface RawEntry { title: string; artist: string; key?: string; tempo?: string; duration?: string; genre?: string; notes?: string }
type MatchStatus = 'matched' | 'ambiguous' | 'not_found';
interface ReviewRow extends RawEntry {
  rowId: number;
  status: MatchStatus;
  candidates: SearchResult[];
  selected: number | null;
  include: boolean;
  duplicateId: number | null;
}

const BATCH = 10;
const HEADER_ALIASES: Record<keyof RawEntry, string[]> = {
  title: ['title', 'song', 'song title', 'name', 'track'],
  artist: ['artist', 'band', 'performer', 'by'],
  key: ['key'],
  tempo: ['tempo', 'bpm'],
  duration: ['duration', 'length', 'time'],
  genre: ['genre', 'style'],
  notes: ['notes', 'note', 'comments'],
};

function splitLine(line: string): RawEntry | null {
  const t = line.trim().replace(/^\d+[.)]\s+/, '');
  if (!t) return null;
  let parts: string[];
  if (t.includes('\t')) parts = t.split('\t');
  else if (t.includes(',')) parts = t.split(',');
  else if (/\s[-–—]\s/.test(t)) parts = t.split(/\s[-–—]\s/);
  else if (/\sby\s/i.test(t)) parts = t.split(/\sby\s/i);
  else parts = [t];
  const [title, ...rest] = parts.map((p) => p.trim().replace(/^"|"$/g, ''));
  return title ? { title, artist: rest.join(', ').trim() } : null;
}

function rowsFromTable(rows: unknown[][]): RawEntry[] {
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => String(c ?? '').trim().toLowerCase());
  const map: Partial<Record<keyof RawEntry, number>> = {};
  (Object.keys(HEADER_ALIASES) as (keyof RawEntry)[]).forEach((k) => {
    const i = header.findIndex((h) => HEADER_ALIASES[k].includes(h));
    if (i >= 0) map[k] = i;
  });
  const hasHeader = map.title !== undefined;
  const body = hasHeader ? rows.slice(1) : rows;
  const cell = (r: unknown[], i: number | undefined) => (i === undefined ? '' : String(r[i] ?? '').trim());
  return body
    .map((r) => ({
      title: cell(r, hasHeader ? map.title : 0),
      artist: cell(r, hasHeader ? map.artist : 1),
      key: cell(r, map.key),
      tempo: cell(r, map.tempo),
      duration: cell(r, map.duration),
      genre: cell(r, map.genre),
      notes: cell(r, map.notes),
    }))
    .filter((e) => e.title);
}

const STATUS_UI: Record<MatchStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  matched: { label: 'Matched', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', icon: CheckCircle2 },
  ambiguous: { label: 'Check match', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', icon: HelpCircle },
  not_found: { label: 'Not found', cls: 'bg-gray-500/20 text-gray-300 ring-gray-500/30', icon: XCircle },
};

export default function SongImport() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileEntries, setFileEntries] = useState<RawEntry[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState<MatchStatus | 'all'>('all');

  const onFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!]!;
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: false });
      const entries = rowsFromTable(table);
      if (!entries.length) throw new Error('No songs found. Put titles in the first column (or a column named "Title").');
      setFileEntries(entries);
      setFileName(file.name);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const startMatching = async () => {
    const entries = fileEntries ?? text.split(/\r?\n/).map(splitLine).filter((e): e is RawEntry => !!e);
    if (!entries.length) return toast.error('Add at least one song first.');
    if (entries.length > 500) return toast.error('Import at most 500 songs at a time.');
    const out: ReviewRow[] = [];
    setProgress({ done: 0, total: entries.length });
    try {
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH);
        const res = await api.post<{ results: { status: MatchStatus; candidates: SearchResult[]; selected_index: number | null; duplicate_song_id: number | null }[] }>(
          '/songs/import/match',
          { entries: batch.map((e) => ({ title: e.title, artist: e.artist })) },
        );
        res.results.forEach((r, j) => {
          out.push({ ...batch[j]!, rowId: i + j, status: r.status, candidates: r.candidates, selected: r.selected_index, include: true, duplicateId: r.duplicate_song_id });
        });
        setProgress({ done: Math.min(i + BATCH, entries.length), total: entries.length });
      }
      setRows(out);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  const update = (rowId: number, patch: Partial<ReviewRow>) => setRows((rs) => rs?.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)) ?? null);

  const doImport = async () => {
    if (!rows) return;
    const chosen = rows.filter((r) => r.include && !(skipDuplicates && r.duplicateId));
    if (!chosen.length) return toast.error('Nothing selected to import.');
    setImporting(true);
    const songs = chosen.map((r) => {
      const c = r.selected !== null ? r.candidates[r.selected] : undefined;
      const tempo = Number(r.tempo) || c?.tempo || undefined;
      return {
        title: r.title.trim() || c?.title,
        artist: r.artist.trim() || c?.artist || '',
        album: c?.album || '',
        release_date: c?.release_date || null,
        duration: (r.duration ? parseDuration(r.duration) : null) ?? c?.duration ?? 0,
        genre: r.genre || c?.genre || '',
        key: r.key || c?.key || '',
        tempo: tempo && tempo >= 40 && tempo <= 300 ? tempo : 120,
        lyrics: c?.lyrics || '',
        notes: r.notes || '',
        lrclib_id: c?.lrclib_id ?? null,
      };
    });
    try {
      const res = await api.post<{ inserted: number; skipped: unknown[] }>('/songs/import', { songs, skip_duplicates: skipDuplicates });
      toast.success(`Imported ${res.inserted} song${res.inserted === 1 ? '' : 's'}${res.skipped.length ? `, skipped ${res.skipped.length} duplicate${res.skipped.length === 1 ? '' : 's'}` : ''}.`);
      navigate('/songs');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  const counts = rows ? { matched: rows.filter((r) => r.status === 'matched').length, ambiguous: rows.filter((r) => r.status === 'ambiguous').length, not_found: rows.filter((r) => r.status === 'not_found').length } : null;
  const toImport = rows ? rows.filter((r) => r.include && !(skipDuplicates && r.duplicateId)).length : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/songs" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Songs</Link>
      <PageHeader title="Import songs" icon={<Upload className="h-5 w-5" />} subtitle="Paste a list or upload a spreadsheet. We'll match each song so you can review before importing." />

      {!rows ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-semibold text-white">Paste a list</h2>
            <p className="mt-1 text-sm text-gray-400">One song per line: <code className="text-purple-300">Title, Artist</code> (also accepts “Title - Artist” or tabs).</p>
            <textarea
              className="input mt-4 min-h-[260px] font-mono"
              placeholder={'Wonderwall, Oasis\nSweet Caroline, Neil Diamond\nValerie - Amy Winehouse'}
              value={text}
              onChange={(e) => { setText(e.target.value); setFileEntries(null); setFileName(''); }}
              disabled={!!progress}
              aria-label="Song list"
            />
          </section>
          <section className="card flex flex-col p-5">
            <h2 className="font-semibold text-white">Upload a spreadsheet</h2>
            <p className="mt-1 text-sm text-gray-400">.csv, .xls or .xlsx. Use columns named Title and Artist (optional: Key, Tempo, Duration, Genre, Notes), or put titles in column A and artists in column B.</p>
            <button
              type="button"
              className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-700 p-8 text-gray-400 transition hover:border-purple-500/60 hover:text-gray-200"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
              disabled={!!progress}
            >
              <FileSpreadsheet className="h-10 w-10 text-purple-400" />
              {fileEntries ? <span className="text-sm text-gray-200">{fileName}: {fileEntries.length} songs found</span> : <span className="text-sm">Drop a file here or click to choose</span>}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          </section>
          <div className="flex items-center justify-end gap-3 lg:col-span-2">
            {progress && (
              <div className="flex flex-1 items-center gap-3 text-sm text-gray-400">
                <Spinner className="h-4 w-4" /> Matching {progress.done} / {progress.total}…
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800"><div className="h-full bg-purple-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
              </div>
            )}
            <button className="btn-primary" onClick={startMatching} disabled={!!progress || (!text.trim() && !fileEntries)}>Find matches</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center gap-2 p-4 text-sm">
            {(['all', 'matched', 'ambiguous', 'not_found'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cx('rounded-full px-3 py-1 transition', filter === f ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}>
                {f === 'all' ? `All (${rows.length})` : `${STATUS_UI[f].label} (${counts![f]})`}
              </button>
            ))}
            <div className="ml-auto"><Toggle checked={skipDuplicates} onChange={setSkipDuplicates} label="Skip songs already in my repertoire" /></div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-gray-800 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-3"><span className="sr-only">Include</span></th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 font-medium">Artist</th>
                  <th className="px-3 py-3 font-medium">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.filter((r) => filter === 'all' || r.status === filter).map((r) => {
                  const S = STATUS_UI[r.status];
                  const dupSkipped = skipDuplicates && !!r.duplicateId;
                  return (
                    <tr key={r.rowId} className={cx(!r.include || dupSkipped ? 'opacity-50' : '')}>
                      <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4 accent-purple-600" checked={r.include} onChange={(e) => update(r.rowId, { include: e.target.checked })} aria-label={`Include ${r.title}`} /></td>
                      <td className="px-3 py-2">
                        <span className={cx('chip', S.cls)}><S.icon className="h-3 w-3" />{S.label}</span>
                        {r.duplicateId && <span className="chip mt-1 flex w-fit bg-red-500/10 text-red-300 ring-red-500/30"><AlertTriangle className="h-3 w-3" />Duplicate</span>}
                      </td>
                      <td className="px-3 py-2"><input className="input py-1.5" value={r.title} onChange={(e) => update(r.rowId, { title: e.target.value })} aria-label="Title" /></td>
                      <td className="px-3 py-2"><input className="input py-1.5" value={r.artist} onChange={(e) => update(r.rowId, { artist: e.target.value })} aria-label="Artist" /></td>
                      <td className="px-3 py-2">
                        {r.candidates.length ? (
                          <select
                            className="input py-1.5"
                            value={r.selected ?? -1}
                            onChange={(e) => {
                              const idx = Number(e.target.value);
                              const c = r.candidates[idx];
                              update(r.rowId, idx < 0 ? { selected: null } : { selected: idx, status: 'matched', title: c?.title ?? r.title, artist: c?.artist ?? r.artist });
                            }}
                            aria-label="Choose match"
                          >
                            <option value={-1}>No match — use my text only</option>
                            {r.candidates.map((c, i) => (
                              <option key={i} value={i}>{c.title} — {c.artist}{c.duration ? ` (${formatDuration(c.duration)})` : ''} · {c.source === 'catalog' ? 'Catalog' : 'lrclib'}{c.lyrics ? ' · lyrics' : ''}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500">Will be added with the details you entered.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button className="btn-ghost" onClick={() => setRows(null)}>Start over</button>
            <button className="btn-primary" onClick={doImport} disabled={importing || !toImport}>
              {importing && <Spinner className="h-4 w-4 text-white" />} Import {toImport} song{toImport === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
