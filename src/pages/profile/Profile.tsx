import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Camera, Copy, Download, KeyRound, MailCheck, RefreshCw, Save, Trash2, User as UserIcon } from 'lucide-react';
import { api, API_BASE, downloadFile, errorMessage } from '../../lib/api';
import type { Profile as ProfileT } from '../../lib/types';
import { COMMITMENT_LEVELS, EXPERIENCE_LEVELS, GENRES, INSTRUMENTS, US_STATES } from '../../lib/constants';
import { cx } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import PasswordRules, { passwordValid } from '../../components/PasswordRules';
import { Avatar, Field, PageHeader, PageLoader, Spinner, Toggle } from '../../components/ui';

const MAX_AVATAR = 5 * 1024 * 1024;
type Form = Omit<ProfileT, 'id' | 'avatar_url' | 'created_at' | 'updated_at' | 'calendar_token'>;

function toForm(p: ProfileT): Form {
  return {
    username: p.username, display_name: p.display_name, bio: p.bio ?? '', location: p.location ?? '', city: p.city ?? '', state: p.state ?? '',
    zip: p.zip ?? '', phone: p.phone ?? '', instrument: p.instrument ?? '', genre: p.genre ?? '', website: p.website ?? '', instruments: p.instruments ?? [],
    experience_level: p.experience_level, commitment_level: p.commitment_level, equipment: p.equipment ?? '', is_public: p.is_public,
  };
}

export default function Profile() {
  const { user, profile, setProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(profile ? toForm(profile) : null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Profile · GigMasterPro';
    api.get<ProfileT>('/profile').then((p) => { setProfile(p); setForm(toForm(p)); }).catch((e) => toast.error(errorMessage(e)));
  }, [setProfile, toast]);

  if (!form || !profile || !user) return <PageLoader />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => f && { ...f, [k]: v });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.display_name.trim()) errs.display_name = 'Display name is required.';
    if (!/^[a-z0-9_]{3,30}$/.test(form.username)) errs.username = '3–30 lowercase letters, numbers or underscores.';
    if (form.zip && !/^\d{5}(-\d{4})?$/.test(form.zip)) errs.zip = 'Enter a 5-digit ZIP code.';
    if (form.website && !/^https?:\/\/\S+\.\S+/.test(form.website)) errs.website = 'Start with http:// or https://';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const p = await api.put<ProfileT>('/profile', { ...form, instrument: form.instruments[0] ?? form.instrument });
      setProfile(p);
      setForm(toForm(p));
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > MAX_AVATAR) return toast.error('Images must be 5 MB or smaller.');
    if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) return toast.error('Use a JPG, PNG, GIF or WebP image.');
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    try {
      setProfile(await api.upload<ProfileT>('/profile/avatar', fd));
      toast.success('Photo updated.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try { setProfile(await api.del<ProfileT>('/profile/avatar')); } catch (e) { toast.error(errorMessage(e)); }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValid(pw.next)) return toast.error('New password does not meet the requirements.');
    setPwSaving(true);
    try {
      await api.put('/auth/password', { current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPwSaving(false);
    }
  };

  const resendVerification = () => api.post('/auth/resend-verification').then(() => toast.success('Verification email sent.')).catch((e) => toast.error(errorMessage(e)));
  const regenerateToken = () => api.post<ProfileT>('/profile/calendar-token').then((p) => { setProfile(p); toast.success('New calendar link created.'); }).catch((e) => toast.error(errorMessage(e)));
  const feedUrl = profile.calendar_token ? new URL(`${API_BASE}/calendar/${profile.calendar_token}.ics`, window.location.href).href : '';
  const toggleInstrument = (i: string) => set('instruments', form.instruments.includes(i) ? form.instruments.filter((x) => x !== i) : form.instruments.length >= 16 ? form.instruments : [...form.instruments, i]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Your profile" icon={<UserIcon className="h-5 w-5" />} subtitle={user.email} />
      <form onSubmit={save} noValidate className="space-y-6">
        <section className="card flex flex-col items-center gap-5 p-5 sm:flex-row">
          <div className="relative">
            <Avatar name={profile.display_name} url={profile.avatar_url} size="xl" />
            {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60"><Spinner className="h-6 w-6" /></div>}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-semibold text-white">Profile photo</p>
            <p className="text-sm text-gray-400">JPG, PNG, GIF or WebP, up to 5 MB.</p>
            <div className="mt-3 flex justify-center gap-2 sm:justify-start">
              <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}><Camera className="h-3.5 w-3.5" /> Upload</button>
              {profile.avatar_url && <button type="button" className="btn-ghost btn-sm" onClick={removeAvatar}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </div>
          <div className="sm:w-72"><Toggle checked={form.is_public} onChange={(v) => set('is_public', v)} label="Public profile" description="Show me in Community search so other musicians can find and message me." /></div>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold text-white sm:col-span-2">About you</h2>
          <Field label="Display name *" htmlFor="p-dn" error={errors.display_name}><input id="p-dn" className="input" value={form.display_name} onChange={(e) => set('display_name', e.target.value)} maxLength={100} /></Field>
          <Field label="Username *" htmlFor="p-un" error={errors.username}><input id="p-un" className="input" value={form.username} onChange={(e) => set('username', e.target.value.toLowerCase())} maxLength={30} /></Field>
          <Field label="Bio" htmlFor="p-bio" className="sm:col-span-2"><textarea id="p-bio" className="input min-h-[90px]" value={form.bio ?? ''} onChange={(e) => set('bio', e.target.value)} maxLength={2000} placeholder="Your sound, influences, what you're looking for…" /></Field>
          <Field label="Website" htmlFor="p-web" error={errors.website}><input id="p-web" type="url" className="input" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></Field>
          <Field label="Phone" htmlFor="p-ph" hint="Visible only to your connections."><input id="p-ph" type="tel" className="input" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} maxLength={30} /></Field>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-6">
          <h2 className="font-semibold text-white sm:col-span-6">Location</h2>
          <Field label="City" htmlFor="p-city" className="sm:col-span-3"><input id="p-city" className="input" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="State" htmlFor="p-st" className="sm:col-span-1">
            <select id="p-st" className="input" value={form.state ?? ''} onChange={(e) => set('state', e.target.value)}><option value="">—</option>{US_STATES.map(([code, name]) => <option key={code} value={code} title={name}>{code}</option>)}</select>
          </Field>
          <Field label="ZIP" htmlFor="p-zip" error={errors.zip} hint="Used for distance only; never shown." className="sm:col-span-2"><input id="p-zip" className="input" inputMode="numeric" value={form.zip ?? ''} onChange={(e) => set('zip', e.target.value)} maxLength={10} /></Field>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <h2 className="font-semibold text-white sm:col-span-3">Musicianship</h2>
          <div className="sm:col-span-3">
            <p className="label">Instruments <span className="text-gray-500">({form.instruments.length}/16; first is primary)</span></p>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map((i) => (
                <button key={i} type="button" onClick={() => toggleInstrument(i)} aria-pressed={form.instruments.includes(i)} className={cx('rounded-full px-3 py-1 text-sm transition', form.instruments.includes(i) ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}>{i}</button>
              ))}
            </div>
          </div>
          <Field label="Primary genre" htmlFor="p-genre"><select id="p-genre" className="input" value={form.genre ?? ''} onChange={(e) => set('genre', e.target.value)}><option value="">—</option>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Experience" htmlFor="p-exp"><select id="p-exp" className="input" value={form.experience_level ?? ''} onChange={(e) => set('experience_level', (e.target.value || null) as Form['experience_level'])}><option value="">—</option>{EXPERIENCE_LEVELS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
          <Field label="Commitment" htmlFor="p-com"><select id="p-com" className="input" value={form.commitment_level ?? ''} onChange={(e) => set('commitment_level', (e.target.value || null) as Form['commitment_level'])}><option value="">—</option>{COMMITMENT_LEVELS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
          <Field label="Equipment" htmlFor="p-eq" className="sm:col-span-3"><textarea id="p-eq" className="input min-h-[80px]" value={form.equipment ?? ''} onChange={(e) => set('equipment', e.target.value)} placeholder="Amps, PA, vehicle, in-ears…" /></Field>
        </section>

        <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} Save profile</button></div>
      </form>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white"><MailCheck className="h-4 w-4 text-purple-400" /> Email</h2>
        <p className="text-sm text-gray-300">{user.email} · {user.email_verified ? <span className="text-emerald-300">Verified</span> : <span className="text-amber-300">Not verified</span>}</p>
        {!user.email_verified && <button className="btn-secondary btn-sm" onClick={resendVerification}>Resend verification email</button>}
      </section>

      <form onSubmit={changePassword} className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white"><KeyRound className="h-4 w-4 text-purple-400" /> Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" htmlFor="pw-cur"><input id="pw-cur" type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} /></Field>
          <Field label="New password" htmlFor="pw-new"><input id="pw-new" type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} /></Field>
        </div>
        {pw.next && <PasswordRules password={pw.next} />}
        <div className="flex justify-end"><button className="btn-secondary" disabled={pwSaving || !pw.current || !pw.next}>{pwSaving && <Spinner className="h-4 w-4" />} Update password</button></div>
      </form>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white"><CalendarDays className="h-4 w-4 text-purple-400" /> Calendar sync</h2>
        <p className="text-sm text-gray-400">Subscribe to this private link in Google Calendar, Apple Calendar or Outlook to see your gigs automatically.</p>
        {feedUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1 font-mono text-xs" readOnly value={feedUrl} onFocus={(e) => e.target.select()} aria-label="Calendar feed URL" />
            <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(feedUrl).then(() => toast.success('Link copied.'))}><Copy className="h-4 w-4" /> Copy</button>
            <button className="btn-ghost" onClick={regenerateToken} title="Invalidates the old link"><RefreshCw className="h-4 w-4" /> Reset link</button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={regenerateToken}>Create calendar link</button>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white"><Download className="h-4 w-4 text-purple-400" /> Export your data</h2>
        <div className="flex flex-wrap gap-2">
          {([['/export', 'gigmasterpro-export.json', 'Everything (JSON)'], ['/export/songs.csv', 'songs.csv', 'Songs CSV'], ['/export/setlists.csv', 'setlists.csv', 'Setlists CSV'], ['/export/gigs.csv', 'gigs.csv', 'Gigs CSV']] as const).map(([path, name, label]) => (
            <button key={path} className="btn-secondary btn-sm" onClick={() => downloadFile(path, name).catch((e) => toast.error(errorMessage(e)))}>{label}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
