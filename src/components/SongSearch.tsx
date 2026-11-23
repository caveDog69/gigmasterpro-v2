import { useEffect, useRef, useState } from 'react';
import { Database, Globe, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import type { SearchResult } from '../lib/types';
import { formatDuration } from '../lib/format';
import { Field, Spinner } from './ui';

/** Searches the shared catalog + lrclib.net (merged server-side) and returns the chosen result. */
export default function SongSearch({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lrclibOk, setLrclibOk] = useState(true);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const q = title.trim();
  const a = artist.trim();
  const al = album.trim();
  const ready = q.length >= 2 || a.length >= 2;
  const hasInput = !!(title || artist || album);

  const clear = () => {
    setTitle('');
    setArtist('');
    setAlbum('');
  };

  useEffect(() => {
    if (!ready) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (a) params.set('artist', a);
    if (al) params.set('album', al);
    const t = setTimeout(() => {
      api
        .get<{ results: SearchResult[]; lrclib_ok: boolean }>(`/songs/search?${params}`)
        .then((r) => {
          if (id !== seq.current) return;
          setResults(r.results);
          setLrclibOk(r.lrclib_ok);
          setOpen(true);
        })
        .catch(() => id === seq.current && setResults([]))
        .finally(() => id === seq.current && setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q, a, al, ready]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={box}>
      <p className="label">Search the song catalog</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Title" htmlFor="song-search" className="sm:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              id="song-search"
              className="input pl-9 pr-9"
              placeholder="e.g. “Wonderwall”"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => results.length && setOpen(true)}
              autoComplete="off"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? <Spinner className="h-4 w-4" /> : hasInput && <button type="button" onClick={clear} aria-label="Clear search"><X className="h-4 w-4 text-gray-500" /></button>}
            </span>
          </div>
        </Field>
        <Field label="Artist" htmlFor="song-search-artist">
          <input
            id="song-search-artist"
            className="input"
            placeholder="e.g. “Oasis”"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            autoComplete="off"
          />
        </Field>
        <Field label="Album" htmlFor="song-search-album">
          <input
            id="song-search-album"
            className="input"
            placeholder="Optional"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            autoComplete="off"
          />
        </Field>
      </div>
      <p className="mt-1 text-xs text-gray-500">Enter a title or artist (album narrows the results). Pick a result to pre-fill the form; you can still edit every field.</p>
      {open && ready && !loading && (
        <div className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl scrollbar-thin">
          {!lrclibOk && <p className="border-b border-gray-800 px-4 py-2 text-xs text-amber-300">lrclib.net didn't respond; showing catalog results only.</p>}
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No matches. Fill in the details manually below.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.source}-${r.catalog_id ?? r.lrclib_id ?? i}`}
                type="button"
                className="flex w-full items-center gap-3 border-b border-gray-800/60 px-4 py-3 text-left last:border-0 hover:bg-gray-800"
                onClick={() => {
                  onSelect(r);
                  setOpen(false);
                  clear();
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-100">{r.title}</span>
                  <span className="block truncate text-xs text-gray-400">{[r.artist, r.album].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`chip ${r.source === 'catalog' ? 'bg-purple-500/15 text-purple-300 ring-purple-500/30' : 'bg-sky-500/15 text-sky-300 ring-sky-500/30'}`}>
                    {r.source === 'catalog' ? <Database className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {r.source === 'catalog' ? 'Catalog' : 'lrclib'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {r.duration ? formatDuration(r.duration) : ''}{r.lyrics ? ' · lyrics' : ''}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
