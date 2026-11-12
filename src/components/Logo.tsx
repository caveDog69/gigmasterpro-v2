import { Music } from 'lucide-react';
import { cx } from '../lib/format';

export default function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-700 shadow-lg shadow-purple-900/40">
        <Music className="h-5 w-5 text-white" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-lg font-bold tracking-tight text-white">
          GigMaster<span className="text-purple-400">Pro</span>
        </span>
      )}
    </span>
  );
}
