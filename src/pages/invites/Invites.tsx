import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Mail, RotateCw, Send, UserPlus, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api, errorMessage } from '../../lib/api';
import { cx, formatDate, relativeTime } from '../../lib/format';
import type { Invite, InviteList, InviteSent, InviteStatus } from '../../lib/types';
import { Avatar, ConfirmDialog, EmptyState, ErrorBanner, Field, PageHeader, PageLoader, Spinner } from '../../components/ui';

const STATUS_STYLES: Record<InviteStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-200' },
  accepted: { label: 'Joined', className: 'bg-emerald-500/15 text-emerald-200' },
  expired: { label: 'Expired', className: 'bg-gray-700/60 text-gray-300' },
  revoked: { label: 'Revoked', className: 'bg-gray-700/60 text-gray-400' },
};

export default function Invites() {
  const toast = useToast();
  const [data, setData] = useState<InviteList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<InviteSent | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<Invite | null>(null);

  useEffect(() => { document.title = 'Invite friends · GigMasterPro'; }, []);

  const load = useCallback(() => {
    setError(null);
    return api.get<InviteList>('/invites').then(setData).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const showSent = (res: InviteSent) => {
    setSent(res);
    setCopied(false);
    setData((d) => d && { ...d, remaining_today: res.remaining_today, invites: [res.invite, ...d.invites.filter((i) => i.id !== res.invite.id)] });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSending(true);
    try {
      const res = await api.post<InviteSent>('/invites', { email: email.trim(), message: message.trim() });
      showSent(res);
      setEmail('');
      setMessage('');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const resend = async (inv: Invite) => {
    setBusyId(inv.id);
    try {
      showSent(await api.post<InviteSent>(`/invites/${inv.id}/resend`));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setBusyId(cancelling.id);
    try {
      const updated = await api.del<Invite>(`/invites/${cancelling.id}`);
      setData((d) => d && { ...d, invites: d.invites.map((i) => (i.id === updated.id ? updated : i)) });
      if (sent?.invite.id === updated.id) setSent(null);
      setCancelling(null);
      toast.success('Invite revoked. Its link no longer works.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const copy = async () => {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.link);
      setCopied(true);
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <PageLoader />;
  const limitReached = data.remaining_today === 0;

  return (
    <div>
      <PageHeader title="Invite friends" icon={<UserPlus className="h-5 w-5" />} subtitle="Invite bandmates and fellow musicians to GigMasterPro. When they join, you're connected automatically." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-2" aria-labelledby="invite-form-heading">
          <h2 id="invite-form-heading" className="font-semibold text-white">Send an invite</h2>
          <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
            <Field label="Email" htmlFor="invite-email">
              <input id="invite-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" autoComplete="off" required maxLength={191} />
            </Field>
            <Field label="Personal note (optional)" htmlFor="invite-message" hint={`${message.length}/500`}>
              <textarea id="invite-message" className="input min-h-[90px]" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="Hey! I'm using this to run our setlists. Join me?" />
            </Field>
            {formError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">{formError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={sending || limitReached || !email.trim()}>
              {sending ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />} Send invite
            </button>
            <p className="text-xs text-gray-500">
              {limitReached ? `You've reached today's limit of ${data.daily_limit} invites.` : `${data.remaining_today} of ${data.daily_limit} invites left today.`} Links expire after 14 days.
            </p>
          </form>
          {sent && (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm" role="status">
              <p className="flex items-center gap-2 font-medium text-emerald-200">
                {sent.email_sent ? <><Mail className="h-4 w-4" /> Invite emailed to {sent.invite.email}</> : <>Invite created for {sent.invite.email}</>}
              </p>
              <p className="mt-1 text-gray-300">{sent.email_sent ? 'You can also share this link yourself:' : "We couldn't send the email. Share this link with them yourself:"}</p>
              <div className="mt-2 flex gap-2">
                <input className="input min-w-0 flex-1 text-xs" value={sent.link} readOnly onFocus={(e) => e.target.select()} aria-label="Invite link" />
                <button type="button" className="btn-secondary btn-sm shrink-0" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card lg:col-span-3" aria-labelledby="invite-list-heading">
          <h2 id="invite-list-heading" className="border-b border-gray-800 px-5 py-4 font-semibold text-white">Your invites ({data.invites.length})</h2>
          {data.invites.length === 0 ? (
            <div className="p-5"><EmptyState icon={<UserPlus className="h-7 w-7" />} title="No invites yet" body="People you invite show up here, along with whether they've joined." /></div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {data.invites.map((inv) => {
                const st = STATUS_STYLES[inv.status];
                const open = inv.status !== 'accepted';
                return (
                  <li key={inv.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {inv.accepted_user ? <Avatar name={inv.accepted_user.display_name} url={inv.accepted_user.avatar_url} /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-gray-400"><Mail className="h-4 w-4" /></div>}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {inv.accepted_user ? <>{inv.accepted_user.display_name} <span className="text-xs font-normal text-gray-500">@{inv.accepted_user.username}</span></> : inv.email}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {inv.status === 'accepted' && inv.accepted_at ? `Joined ${relativeTime(inv.accepted_at)}` : inv.status === 'pending' ? `Sent ${relativeTime(inv.sent_at)} · expires ${formatDate(inv.expires_at)}` : `Sent ${relativeTime(inv.sent_at)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium', st.className)}>{st.label}</span>
                      {inv.status === 'accepted' && <Link to="/community" className="btn-secondary btn-sm">View in Community</Link>}
                      {open && (
                        <button className="btn-secondary btn-sm" onClick={() => resend(inv)} disabled={busyId === inv.id || limitReached}>
                          <RotateCw className="h-3.5 w-3.5" /> {inv.status === 'pending' ? 'Resend' : 'Send again'}
                        </button>
                      )}
                      {inv.status === 'pending' && (
                        <button className="btn-secondary btn-sm" onClick={() => setCancelling(inv)} disabled={busyId === inv.id}>
                          <X className="h-3.5 w-3.5" /> Revoke
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={!!cancelling}
        title="Revoke this invite?"
        body={`The link sent to ${cancelling?.email ?? ''} will stop working. You can invite them again later.`}
        confirmLabel="Revoke invite"
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
        busy={busyId === cancelling?.id}
      />
    </div>
  );
}
