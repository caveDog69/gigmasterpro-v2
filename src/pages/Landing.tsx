import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, FileDown, Guitar, ListMusic, MapPin, MessageSquare, Mic2, Music, Search, Upload, Users, Wifi } from 'lucide-react';
import Logo from '../components/Logo';
import AuthPanel from './auth/AuthPanel';

const features = [
  { icon: Music, title: 'Repertoire management', body: 'Keep every song in one place: key, tempo, tuning, lyrics, chord charts and notes. Search a shared catalog and lrclib.net to fill in details instantly.' },
  { icon: ListMusic, title: 'Setlist building', body: 'Drag songs into ordered setlists, add per-song cues, and see total run time as you build. Export a clean PDF for the band in one click.' },
  { icon: CalendarDays, title: 'Gig scheduling', body: 'Track venues, load-in times, pay and status from scheduled to completed. Subscribe to your gigs in Google, Apple or Outlook Calendar.' },
  { icon: Mic2, title: 'Stage Play Mode', body: 'A full-screen, distraction-free stage view with big lyrics or chords, transposition, auto-scroll, a metronome and one-tap next song.' },
  { icon: Users, title: 'Musician networking', body: 'Find players near you by instrument, genre and commitment, sorted by real distance. Connect, message, and form bands that share songs and gigs.' },
  { icon: Upload, title: 'Bulk import', body: 'Paste a list or upload a spreadsheet (.csv, .xls, .xlsx). GigMasterPro matches each song, lets you review the matches, and imports them in one go.' },
];

const faqs = [
  { q: 'Who is GigMasterPro for?', a: 'Working and weekend musicians: cover bands, wedding bands, solo acoustic acts, worship teams, and anyone who plays live and needs their songs, setlists and gigs organized.' },
  { q: 'Does it work on a phone or tablet on stage?', a: 'Yes. GigMasterPro is fully responsive, and Play Mode is built for tablets on a music stand, with large adjustable text (12–32px), swipe-free navigation and auto-scroll.' },
  { q: 'Can I import my existing song list?', a: 'Paste "Title, Artist" lines or upload a CSV or Excel file. Each song is matched against our shared catalog and lrclib.net, and you review the results before anything is saved.' },
  { q: 'Can I take my data with me?', a: 'Yes. Export your songs, setlists and gigs as CSV, or everything as JSON, from your profile at any time.' },
];

function StageMockup() {
  return (
    <figure className="relative mx-auto w-full max-w-xl" aria-label="Play Mode screenshot">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-purple-600/30 to-fuchsia-500/10 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-gray-700 bg-black shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-2.5 text-xs text-gray-400">
          <span className="font-medium text-gray-200">Friday @ The Blue Room</span>
          <span className="rounded-full bg-purple-600/20 px-2 py-0.5 text-purple-300">Song 4 of 18</span>
        </div>
        <div className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-widest text-purple-300">Set 1 · Key of G · 92 BPM</p>
          <p className="mt-1 text-2xl font-bold text-white">Brown Eyed Girl</p>
          <p className="text-sm text-gray-400">Van Morrison</p>
          <div className="mt-4 space-y-2 font-mono text-[13px] leading-relaxed">
            <p className="text-purple-300">G           C          G         D</p>
            <p className="text-gray-200">Hey, where did we go, days when the rains came</p>
            <p className="text-purple-300">G           C          G         D</p>
            <p className="text-gray-200">Down in the hollow, playin' a new game</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-800 bg-gray-950 px-4 py-2.5 text-xs text-gray-400">
          <span>◀ Previous</span>
          <span className="flex items-center gap-3"><span>A− A+</span><span>♩ 92</span><span>Auto-scroll</span></span>
          <span className="text-white">Next ▶</span>
        </div>
      </div>
      <figcaption className="sr-only">Play Mode showing lyrics with chords, key and tempo for the current song</figcaption>
    </figure>
  );
}

function DashboardMockup() {
  const rows = [
    ['Sweet Caroline', 'Neil Diamond', 'B', '3:21'],
    ['Mr. Brightside', 'The Killers', 'D♭', '3:42'],
    ['Valerie', 'Amy Winehouse', 'E♭', '3:39'],
    ['September', 'Earth, Wind & Fire', 'A', '3:35'],
  ];
  return (
    <figure className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" aria-label="Setlist builder screenshot">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-xs text-gray-500">Setlist · Wedding — Dance Set</span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-gray-400"><span>4 songs</span><span>Total 14:17</span></div>
        <ol className="space-y-2">
          {rows.map(([t, a, k, d], i) => (
            <li key={t} className="flex items-center gap-3 rounded-lg bg-gray-800/60 px-3 py-2 text-sm">
              <span className="w-5 text-gray-500">{i + 1}</span>
              <span className="flex-1"><span className="block text-gray-100">{t}</span><span className="block text-xs text-gray-500">{a}</span></span>
              <span className="rounded bg-purple-500/15 px-1.5 text-xs text-purple-300">{k}</span>
              <span className="text-xs text-gray-400">{d}</span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="sr-only">Setlist builder with song keys and total duration</figcaption>
    </figure>
  );
}

function CommunityMockup() {
  const people = [
    ['Maya R.', 'Bass · Funk', '3.2 mi'],
    ['Dev P.', 'Drums · Rock', '7.8 mi'],
    ['Sam O.', 'Keys · Jazz', '12 mi'],
  ];
  return (
    <figure className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 p-4 shadow-2xl" aria-label="Community screenshot">
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-400"><Search className="h-3.5 w-3.5" /> Bass players near 32901</div>
      <ul className="space-y-2">
        {people.map(([n, r, d]) => (
          <li key={n} className="flex items-center gap-3 rounded-lg bg-gray-800/60 px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-700 text-xs font-bold text-white">{n[0]}</span>
            <span className="flex-1 text-sm"><span className="block text-gray-100">{n}</span><span className="block text-xs text-gray-500">{r}</span></span>
            <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin className="h-3 w-3" />{d}</span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">Musician search sorted by distance</figcaption>
    </figure>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-900 text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-800/80 bg-gray-900/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Primary">
          <Link to="/" aria-label="GigMasterPro home"><Logo /></Link>
          <div className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#play-mode" className="hover:text-white">Play Mode</a>
            <a href="#community" className="hover:text-white">Community</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn-primary hidden sm:inline-flex">Get started free</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-purple-700/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-8 lg:pt-20">
            <div className="flex flex-col justify-center">
              <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
                <Guitar className="h-3.5 w-3.5" /> Built for gigging musicians
              </p>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Your songs, setlists and gigs —{' '}
                <span className="bg-gradient-to-r from-purple-300 to-fuchsia-400 bg-clip-text text-transparent">ready for the stage.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-gray-300">
                GigMasterPro is the gig management app for working musicians. Organize your repertoire, build setlists, schedule gigs,
                perform from a full-screen stage view, and connect with musicians near you.
              </p>
              <ul className="mt-6 grid max-w-xl gap-2 text-sm text-gray-300 sm:grid-cols-2">
                {['Lyrics & chords with transposition', 'Bulk import from Excel or CSV', 'Calendar sync & PDF setlists', 'Find players by real distance'].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-purple-400" /> {t}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3 lg:hidden">
                <Link to="/signup" className="btn-primary px-6 py-3 text-base">Create free account <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/login" className="btn-secondary px-6 py-3 text-base">Sign in</Link>
              </div>
            </div>
            <div id="get-started" className="hidden items-center lg:flex">
              <AuthPanel initialMode="signup" />
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-gray-800 bg-gray-950/40 py-20" aria-labelledby="features-heading">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything a gigging musician needs</h2>
              <p className="mt-4 text-gray-400">From the first rehearsal to the encore: one app for the business and the performance.</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <article key={title} className="card p-6 transition hover:border-purple-500/40">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="play-mode" className="py-20" aria-labelledby="play-heading">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 id="play-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Stage Play Mode that keeps up with you</h2>
              <p className="mt-4 text-gray-400">
                Open any gig and go full screen. Singers get big, readable lyrics one song at a time. Players get the running order with keys, tempos and cues.
                Choose exactly which details each mode shows, and your layout is saved to your account on every device.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-300">
                {['Singer (lyrics) and Musician (song list) modes', 'Transpose chords on the fly', 'Auto-scroll and a built-in click metronome', 'Font size from 12 to 32px, slide-out song list, keyboard shortcuts'].map((t) => (
                  <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" /> {t}</li>
                ))}
              </ul>
            </div>
            <StageMockup />
          </div>
        </section>

        <section className="border-y border-gray-800 bg-gray-950/40 py-20" aria-labelledby="setlist-heading">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <DashboardMockup />
            <div>
              <h2 id="setlist-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Setlists and gigs, organized</h2>
              <p className="mt-4 text-gray-400">
                Build setlists from your repertoire, attach them to gigs, and print or export a PDF for the band. Every gig tracks venue, load-in, pay and status,
                and syncs to your calendar with an iCal feed.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-300">
                <span className="chip bg-gray-800 text-gray-200 ring-gray-700"><FileDown className="h-3.5 w-3.5" /> PDF export</span>
                <span className="chip bg-gray-800 text-gray-200 ring-gray-700"><CalendarDays className="h-3.5 w-3.5" /> iCal feed</span>
                <span className="chip bg-gray-800 text-gray-200 ring-gray-700"><Wifi className="h-3.5 w-3.5" /> Works on any device</span>
              </div>
            </div>
          </div>
        </section>

        <section id="community" className="py-20" aria-labelledby="community-heading">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 id="community-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Find your next bandmate</h2>
              <p className="mt-4 text-gray-400">
                Browse public musician profiles by instrument, genre and commitment level, sorted by real distance from your ZIP code. Send a connection request,
                chat, and start a band that shares songs, setlists and gigs.
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-gray-300"><MessageSquare className="h-4 w-4 text-purple-400" /> Direct messages with unread badges</p>
            </div>
            <CommunityMockup />
          </div>
        </section>

        <section id="faq" className="border-t border-gray-800 bg-gray-950/40 py-20" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 id="faq-heading" className="text-center text-3xl font-bold tracking-tight text-white">Frequently asked questions</h2>
            <dl className="mt-10 space-y-4">
              {faqs.map(({ q, a }) => (
                <div key={q} className="card p-5">
                  <dt className="font-semibold text-white">{q}</dt>
                  <dd className="mt-2 text-sm text-gray-400">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="py-20" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 id="cta-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Spend less time organizing and more time playing.</h2>
            <p className="mt-4 text-gray-400">Set up your repertoire tonight and walk into your next gig prepared.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup" className="btn-primary px-6 py-3 text-base">Get started free <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/login" className="btn-secondary px-6 py-3 text-base">I already have an account</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p>Song metadata from our community catalog and <a className="link" href="https://lrclib.net" rel="noopener">lrclib.net</a>.</p>
          <p>© {new Date().getFullYear()} GigMasterPro</p>
        </div>
      </footer>
    </div>
  );
}
