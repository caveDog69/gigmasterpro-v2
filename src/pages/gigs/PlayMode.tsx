import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Guitar, List, Maximize, Minimize, Minus, Music2, Pause, Play, Plus, Settings, Timer, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Gig, PlayModeSettings, PlaySong } from '../../lib/types';
import { PLAY_FIELDS } from '../../lib/constants';
import { formatDuration, formatTotal, formatTime, cx } from '../../lib/format';
import { transposeKey, transposeText } from '../../lib/transpose';
import { useToast } from '../../contexts/ToastContext';
import { Modal, Spinner, Toggle } from '../../components/ui';

type Mode = 'lyrics' | 'songs';
interface PlayData { gig: Gig; songs: PlaySong[]; settings: PlayModeSettings }

const FONT_KEY = 'gmp_play_font';
const MODE_KEY = 'gmp_play_mode';

function fieldValue(s: PlaySong, f: string, transpose = 0): string {
  switch (f) {
    case 'artist': return s.artist;
    case 'key': return s.key ? transposeKey(s.key, transpose) : '';
    case 'tempo': return s.tempo ? `${s.tempo} BPM` : '';
    case 'duration': return s.duration ? formatDuration(s.duration) : '';
    case 'guitar_tuning': return s.guitar_tuning;
    case 'genre': return s.genre;
    case 'album': return s.album;
    case 'notes': return s.entry_notes || s.notes || '';
    case 'is_original': return s.is_original ? 'Original' : '';
    default: return '';
  }
}

function useMetronome(bpm: number, on: boolean) {
  const [beat, setBeat] = useState(-1);
  useEffect(() => {
    if (!on || !bpm) { setBeat(-1); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    let n = 0;
    const tick = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = n % 4 === 0 ? 1500 : 1000;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
      setBeat(n % 4);
      n++;
    };
    tick();
    const t = setInterval(tick, 60000 / bpm);
    return () => { clearInterval(t); ctx.close(); };
  }, [bpm, on]);
  return beat;
}

export default function PlayMode() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState<PlayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) as Mode) || 'lyrics');
  const [index, setIndex] = useState(0);
  const [font, setFont] = useState(() => Math.min(32, Math.max(12, Number(localStorage.getItem(FONT_KEY)) || 20)));
  const [listOpen, setListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transposeMap, setTransposeMap] = useState<Record<number, number>>({});
  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [metronome, setMetronome] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<PlayData>(`/gigs/${id}/play`).then((d) => { setData(d); document.title = `Play · ${d.gig.name}`; }).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(() => localStorage.setItem(FONT_KEY, String(font)), [font]);
  useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode]);

  const songs = useMemo(() => data?.songs ?? [], [data]);
  const song = songs[index];
  const steps = song ? transposeMap[song.id] ?? 0 : 0;
  const beat = useMetronome(song?.tempo ?? 0, metronome && mode === 'lyrics');

  const go = useCallback((i: number) => {
    if (i < 0 || i >= songs.length) return;
    setIndex(i);
    setScrolling(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [songs.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(index - 1); }
      else if (e.key === '+' || e.key === '=') setFont((f) => Math.min(32, f + 2));
      else if (e.key === '-') setFont((f) => Math.max(12, f - 2));
      else if (e.key === ' ' && mode === 'lyrics') { e.preventDefault(); setScrolling((s) => !s); }
      else if (e.key === 'Escape') setListOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, mode]);

  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (t: number) => {
      const el = scrollRef.current;
      if (!el) return;
      acc += ((t - last) / 1000) * scrollSpeed * 12;
      last = t;
      if (acc >= 1) { el.scrollTop += Math.floor(acc); acc -= Math.floor(acc); }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setScrolling(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, scrollSpeed]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => undefined);

  const saveSettings = async (s: PlayModeSettings) => {
    setData((d) => (d ? { ...d, settings: s } : d));
    try {
      await api.put('/profile/play-mode-settings', s);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (error) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-6 text-center text-gray-300"><p>{error}</p><Link to={`/gigs/${id}`} className="btn-secondary">Back to gig</Link></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-black"><Spinner className="h-8 w-8" /></div>;

  const { gig, settings } = data;
  const total = songs.reduce((s, x) => s + (x.duration || 0), 0);

  const body = (() => {
    if (!song) return '';
    const lyrics = transposeText(song.lyrics || '', steps);
    const chords = transposeText(song.chords || '', steps);
    if (settings.lyrics.content === 'chords') return chords || lyrics;
    if (settings.lyrics.content === 'both') return [chords, lyrics].filter(Boolean).join('\n\n— Lyrics —\n\n');
    return lyrics || chords;
  })();
  const usingFallback = !!song && settings.lyrics.content === 'lyrics' && !song.lyrics && !!song.chords;

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-gray-100">
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-800 bg-gray-950 px-3 py-2">
        <Link to={`/gigs/${gig.id}`} className="btn-icon" aria-label="Exit Play Mode"><X className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{gig.name}</p>
          <p className="truncate text-xs text-gray-500">{[gig.venue, formatTime(gig.date_time)].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex rounded-lg bg-gray-800 p-0.5 text-xs">
          <button onClick={() => setMode('lyrics')} className={cx('flex items-center gap-1 rounded-md px-2.5 py-1.5', mode === 'lyrics' ? 'bg-purple-600 text-white' : 'text-gray-400')}><FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Singer</span></button>
          <button onClick={() => setMode('songs')} className={cx('flex items-center gap-1 rounded-md px-2.5 py-1.5', mode === 'songs' ? 'bg-purple-600 text-white' : 'text-gray-400')}><Music2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Musician</span></button>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <button className="btn-icon" onClick={() => setFont((f) => Math.max(12, f - 2))} disabled={font <= 12} aria-label="Smaller text"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center text-xs text-gray-400">{font}px</span>
          <button className="btn-icon" onClick={() => setFont((f) => Math.min(32, f + 2))} disabled={font >= 32} aria-label="Larger text"><Plus className="h-4 w-4" /></button>
        </div>
        <button className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Display settings"><Settings className="h-5 w-5" /></button>
        <button className="btn-icon hidden sm:inline-flex" onClick={toggleFullscreen} aria-label="Toggle full screen">{fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}</button>
        <button className="btn-icon" onClick={() => setListOpen(true)} aria-label="Song list"><List className="h-5 w-5" /></button>
      </header>

      {songs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-400">
          <p>This gig has no songs yet.</p>
          <Link to={`/gigs/edit/${gig.id}`} className="btn-secondary">Attach setlists</Link>
        </div>
      ) : mode === 'lyrics' && song ? (
        <>
          <div className="shrink-0 border-b border-gray-900 px-4 py-3 sm:px-8">
            <p className="text-xs uppercase tracking-widest text-purple-300">{song.setlist_name} · Song {index + 1} of {songs.length}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{song.title}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              {settings.lyrics.show_artist && song.artist && <span>{song.artist}</span>}
              {settings.lyrics.header_fields.filter((f) => f !== 'artist').map((f) => {
                const v = fieldValue(song, f, steps);
                return v ? <span key={f} className={f === 'notes' ? 'text-purple-300' : ''}>{v}</span> : null;
              })}
            </div>
          </div>
          <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 sm:px-8" onWheel={() => scrolling && setScrolling(false)} onTouchStart={() => scrolling && setScrolling(false)}>
            {usingFallback && <p className="mb-4 text-xs text-gray-500">No lyrics saved; showing chords.</p>}
            {body ? (
              <pre className="whitespace-pre-wrap break-words font-mono leading-relaxed" style={{ fontSize: font }}>{body}</pre>
            ) : (
              <p className="text-gray-500">No lyrics or chords for this song. <Link to={`/songs/edit/${song.id}`} className="link">Add them</Link></p>
            )}
            <div className="h-[40vh]" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-gray-900 bg-gray-950 px-3 py-2 text-xs">
            <span className="text-gray-500">Transpose</span>
            <button className="btn-secondary btn-sm" onClick={() => setTransposeMap((m) => ({ ...m, [song.id]: steps - 1 }))} aria-label="Transpose down">−</button>
            <span className="w-14 text-center">{steps > 0 ? `+${steps}` : steps}{song.key ? ` (${transposeKey(song.key, steps)})` : ''}</span>
            <button className="btn-secondary btn-sm" onClick={() => setTransposeMap((m) => ({ ...m, [song.id]: steps + 1 }))} aria-label="Transpose up">+</button>
            <span className="mx-2 h-5 w-px bg-gray-800" />
            <button className={cx('btn-sm', scrolling ? 'btn-primary' : 'btn-secondary')} onClick={() => setScrolling((s) => !s)}>{scrolling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Auto-scroll</button>
            <input type="range" min={1} max={10} value={scrollSpeed} onChange={(e) => setScrollSpeed(Number(e.target.value))} className="w-20 accent-purple-500" aria-label="Scroll speed" />
            <span className="mx-2 h-5 w-px bg-gray-800" />
            <button className={cx('btn-sm', metronome ? 'btn-primary' : 'btn-secondary')} onClick={() => setMetronome((m) => !m)} disabled={!song.tempo}>
              <Timer className="h-3.5 w-3.5" /> {song.tempo} BPM
            </button>
            {metronome && (
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((b) => <span key={b} className={cx('h-2.5 w-2.5 rounded-full', beat === b ? (b === 0 ? 'bg-purple-400' : 'bg-gray-300') : 'bg-gray-700')} />)}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Songs', songs.length],
                ['Run time', formatTotal(total)],
                ['With lyrics', songs.filter((s) => s.lyrics).length],
                ['With chords', songs.filter((s) => s.chords).length],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
                  <p className="text-xl font-bold">{v}</p>
                  <p className="text-xs text-gray-500">{l}</p>
                </div>
              ))}
            </div>
            <ol className="space-y-1">
              {songs.map((s, i) => {
                const header = i === 0 || songs[i - 1]!.setlist_id !== s.setlist_id || songs[i - 1]!.setlist_position !== s.setlist_position;
                return (
                  <li key={`${s.setlist_position}-${s.song_position}`}>
                    {header && <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-widest text-purple-300">{s.setlist_name}</p>}
                    <button onClick={() => { setIndex(i); setMode('lyrics'); }} className={cx('flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-900', i === index && 'bg-purple-600/15 ring-1 ring-purple-500/40')} style={{ fontSize: font }}>
                      <span className="w-8 shrink-0 text-right text-gray-500">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{s.title}</span>
                        <span className="mt-0.5 flex flex-wrap gap-x-3 text-[0.7em] text-gray-400">
                          {settings.songs.fields.map((f) => {
                            const v = fieldValue(s, f, transposeMap[s.id] ?? 0);
                            return v ? <span key={f} className={f === 'notes' ? 'text-purple-300' : ''}>{v}</span> : null;
                          })}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1 pt-1">
                        {s.lyrics && <FileText className="h-4 w-4 text-gray-500" aria-label="Has lyrics" />}
                        {s.chords && <Guitar className="h-4 w-4 text-gray-500" aria-label="Has chords" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {mode === 'lyrics' && songs.length > 0 && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-gray-800 bg-gray-950 px-3 py-2">
          <button className="btn-secondary flex-1 py-3 sm:flex-none sm:px-6" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft className="h-5 w-5" /> Prev</button>
          <div className="hidden flex-1 items-center gap-1 sm:flex" aria-label={`Song ${index + 1} of ${songs.length}`}>
            {songs.map((_, i) => <button key={i} onClick={() => go(i)} className={cx('h-1.5 flex-1 rounded-full', i === index ? 'bg-purple-500' : i < index ? 'bg-purple-900' : 'bg-gray-800')} aria-label={`Go to song ${i + 1}`} />)}
          </div>
          <span className="text-sm text-gray-400 sm:hidden">{index + 1}/{songs.length}</span>
          <button className="btn-primary flex-1 py-3 sm:flex-none sm:px-6" onClick={() => go(index + 1)} disabled={index >= songs.length - 1}>
            <span className="max-w-[10rem] truncate">{songs[index + 1] ? songs[index + 1]!.title : 'Next'}</span> <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      )}

      {listOpen && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setListOpen(false)} />}
      <aside className={cx('fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col border-l border-gray-800 bg-gray-950 transition-transform', listOpen ? 'translate-x-0' : 'translate-x-full')} aria-hidden={!listOpen}>
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <p className="font-semibold">Songs ({songs.length})</p>
          <button className="btn-icon" onClick={() => setListOpen(false)} aria-label="Close song list"><X className="h-5 w-5" /></button>
        </div>
        <ol className="scrollbar-thin flex-1 overflow-y-auto py-2">
          {songs.map((s, i) => (
            <li key={`${s.setlist_position}-${s.song_position}`}>
              <button onClick={() => { go(i); setListOpen(false); }} className={cx('flex w-full gap-3 px-4 py-2 text-left text-sm hover:bg-gray-900', i === index && 'bg-purple-600/20 text-white')}>
                <span className="w-6 text-right text-gray-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="text-xs text-gray-500">{s.key}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Play Mode display">
        <div className="space-y-6 text-sm">
          <div className="sm:hidden">
            <p className="label">Font size: {font}px</p>
            <input type="range" min={12} max={32} step={2} value={font} onChange={(e) => setFont(Number(e.target.value))} className="w-full accent-purple-500" aria-label="Font size" />
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">Singer mode</p>
            <p className="label">Show</p>
            <div className="mb-3 flex gap-2">
              {(['lyrics', 'chords', 'both'] as const).map((c) => (
                <button key={c} onClick={() => saveSettings({ ...settings, lyrics: { ...settings.lyrics, content: c } })} className={cx('rounded-full px-3 py-1 capitalize', settings.lyrics.content === c ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300')}>{c}</button>
              ))}
            </div>
            <Toggle checked={settings.lyrics.show_artist} onChange={(v) => saveSettings({ ...settings, lyrics: { ...settings.lyrics, show_artist: v } })} label="Show artist" />
            <p className="label mt-3">Header details</p>
            <div className="flex flex-wrap gap-2">
              {PLAY_FIELDS.filter((f) => f.value !== 'artist').map((f) => {
                const on = settings.lyrics.header_fields.includes(f.value);
                return <button key={f.value} onClick={() => saveSettings({ ...settings, lyrics: { ...settings.lyrics, header_fields: on ? settings.lyrics.header_fields.filter((x) => x !== f.value) : [...settings.lyrics.header_fields, f.value] } })} className={cx('rounded-full px-3 py-1', on ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300')}>{f.label}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">Musician mode</p>
            <p className="label">Details under each song</p>
            <div className="flex flex-wrap gap-2">
              {PLAY_FIELDS.map((f) => {
                const on = settings.songs.fields.includes(f.value);
                return <button key={f.value} onClick={() => saveSettings({ ...settings, songs: { fields: on ? settings.songs.fields.filter((x) => x !== f.value) : [...settings.songs.fields, f.value] } })} className={cx('rounded-full px-3 py-1', on ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300')}>{f.label}</button>;
              })}
            </div>
          </div>
          <p className="text-xs text-gray-500">Saved to your account automatically. Shortcuts: ← → change song, + − text size, Space toggles auto-scroll.</p>
        </div>
      </Modal>
    </div>
  );
}
