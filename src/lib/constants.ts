import type { CommitmentLevel, ExperienceLevel, GigStatus } from './types';

export const KEY_OPTIONS = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
];

export const GENRES = [
  'Rock', 'Pop', 'Country', 'Blues', 'Jazz', 'R&B', 'Soul', 'Funk', 'Folk', 'Bluegrass', 'Reggae',
  'Hip Hop', 'Electronic', 'Metal', 'Punk', 'Alternative', 'Indie', 'Latin', 'Gospel', 'Classical', 'Other',
];

export const TUNINGS = [
  'Standard (E A D G B E)', 'Half Step Down (Eb Ab Db Gb Bb Eb)', 'Whole Step Down (D G C F A D)',
  'Drop D (D A D G B E)', 'Drop C (C G C F A D)', 'Open G (D G D G B D)', 'Open D (D A D F# A D)',
  'Open E (E B E G# B E)', 'DADGAD (D A D G A D)',
];

export const INSTRUMENTS = [
  'Vocals', 'Guitar', 'Bass', 'Drums', 'Keyboard', 'Piano', 'Saxophone', 'Trumpet', 'Trombone',
  'Violin', 'Cello', 'Flute', 'Harmonica', 'Banjo', 'Mandolin', 'Percussion',
];

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Professional' },
];

export const COMMITMENT_LEVELS: { value: CommitmentLevel; label: string }[] = [
  { value: 'casual', label: 'Casual — jam sessions & fun' },
  { value: 'serious', label: 'Serious — regular gigs' },
  { value: 'professional', label: 'Professional — full-time' },
];

export const US_STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
  ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'],
  ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
  ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export const GIG_STATUSES: GigStatus[] = ['scheduled', 'confirmed', 'completed', 'cancelled'];

export const STATUS_STYLES: Record<GigStatus, string> = {
  scheduled: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  completed: 'bg-gray-500/20 text-gray-300 ring-gray-500/30',
  cancelled: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

export const PLAY_FIELDS: { value: string; label: string }[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'key', label: 'Key' },
  { value: 'tempo', label: 'Tempo (BPM)' },
  { value: 'duration', label: 'Duration' },
  { value: 'guitar_tuning', label: 'Tuning' },
  { value: 'genre', label: 'Genre' },
  { value: 'album', label: 'Album' },
  { value: 'notes', label: 'Notes' },
  { value: 'is_original', label: 'Original badge' },
];

export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /[0-9]/.test(p) },
  { label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];
