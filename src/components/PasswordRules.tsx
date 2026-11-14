import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '../lib/constants';
import { cx } from '../lib/format';

export const passwordValid = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

export default function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.label} className={cx('flex items-center gap-1.5', ok ? 'text-emerald-400' : 'text-gray-500')}>
            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {r.label}
          </li>
        );
      })}
    </ul>
  );
}
