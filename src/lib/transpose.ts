const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

function noteIndex(note: string): number {
  const i = SHARPS.indexOf(note);
  return i >= 0 ? i : FLATS.indexOf(note);
}

export function transposeNote(note: string, steps: number, preferFlats: boolean): string {
  const i = noteIndex(note);
  if (i < 0) return note;
  const j = (((i + steps) % 12) + 12) % 12;
  return (preferFlats ? FLATS : SHARPS)[j]!;
}

/** Transposes a key such as "C#/Db" or "Am", returning it in the same form as the key picker. */
export function transposeKey(key: string, steps: number): string {
  if (!key || steps === 0) return key;
  const m = key.match(/^([A-G][#b]?)(m?)(?:\/|$)/);
  if (!m) return key;
  const i = noteIndex(m[1]!);
  if (i < 0) return key;
  const j = (((i + steps) % 12) + 12) % 12;
  const minor = m[2] ?? '';
  const sharp = SHARPS[j]!;
  const flat = FLATS[j]!;
  return sharp === flat ? sharp + minor : `${sharp}${minor}/${flat}${minor}`;
}

const CHORD_RE = /^([A-G][#b]?)((?:maj|min|m|dim|aug|sus|add|M)?[0-9]*(?:[#b][0-9]+)*(?:sus[24]?|add[0-9]+)?[0-9]*)(\/([A-G][#b]?))?$/;

function isChordToken(tok: string): boolean {
  return CHORD_RE.test(tok);
}

/** A line counts as a chord line when most of its tokens look like chords. */
function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const chords = tokens.filter((t) => isChordToken(t.replace(/[()|]/g, ''))).length;
  return chords / tokens.length >= 0.6;
}

function transposeChord(chord: string, steps: number, preferFlats: boolean): string {
  const m = chord.match(CHORD_RE);
  if (!m) return chord;
  const root = transposeNote(m[1]!, steps, preferFlats);
  const bass = m[4] ? '/' + transposeNote(m[4], steps, preferFlats) : '';
  return root + (m[2] ?? '') + bass;
}

/** Transposes chord lines and inline [C] chords; lyric lines are left alone. */
export function transposeText(text: string, steps: number, targetKey = ''): string {
  if (!text || steps === 0) return text;
  const preferFlats = FLAT_KEYS.has(targetKey) || /b/.test(targetKey.replace(/m$/, '').slice(1));
  return text
    .split('\n')
    .map((line) => {
      let out = line.replace(/\[([^\]\s]+)\]/g, (all, c: string) => (isChordToken(c) ? `[${transposeChord(c, steps, preferFlats)}]` : all));
      if (isChordLine(out) && !/\[/.test(out)) {
        out = out.replace(/(\(?)([A-G][#b]?[^\s()|]*)(\)?)/g, (all, a: string, c: string, b: string) =>
          isChordToken(c) ? a + transposeChord(c, steps, preferFlats) + b : all,
        );
      }
      return out;
    })
    .join('\n');
}
