import { useEffect, useRef, useState } from 'react';
import { Database, Globe, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import type { SearchResult } from '../lib/types';
import { formatDuration } from '../lib/format';
import { Spinner } from './ui';

/** Searches the shared catalog + lrclib.net (merged server-side) and returns the chosen result. */
export default function SongSearch({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lrclibOk, setLrclibOk] = useState(true);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<{ results: SearchResult[]; lrclib_ok: boolean }>(`/songs/search?q=${encodeURIComponent(q)}`)
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
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={box}>
      <label htmlFor="song-search" className="label">Search the song catalog</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          id="song-search"
          className="input pl-9 pr-9"
          placeholder="Song title and/or artist, e.g. “Wonderwall Oasis”"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          autoComplete="off"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? <Spinner className="h-4 w-4" /> : query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X className="h-4 w-4 text-gray-500" /></button>}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">Pick a result to pre-fill the form. You can still edit every field.</p>
      {open && query.trim().length >= 2 && !loading && (
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
                  setQuery('');
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
