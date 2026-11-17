import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cx } from '../lib/format';
import type { AdPlacement } from '../lib/types';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Reserved heights per breakpoint keep the layout from jumping while an ad loads:
 * banner: 320x50 / 320x100 (mobile), 728x90 (tablet), 970x90 (desktop);
 * sidebar: 160x600 (xl), 300x600 (2xl); footer: 300x250 (mobile), 728x90 (sm+).
 */
const PLACEMENTS: Record<AdPlacement, { box: string; format: string; fullWidth: boolean; label: string }> = {
  banner: { box: 'min-h-[50px] sm:min-h-[90px]', format: 'horizontal', fullWidth: true, label: 'Banner · 320×50 / 728×90 / 970×90' },
  sidebar: { box: 'min-h-[600px]', format: 'vertical', fullWidth: false, label: 'Sidebar · 160×600 / 300×600' },
  footer: { box: 'min-h-[250px] sm:min-h-[90px]', format: 'auto', fullWidth: true, label: 'Footer · 300×250 / 728×90' },
};

let scriptClient: string | null = null;

function loadAdSense(client: string) {
  if (scriptClient === client || typeof document === 'undefined') return;
  scriptClient = client;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

export default function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const { ads, user } = useAuth();
  const { pathname } = useLocation();
  const cfg = PLACEMENTS[placement];
  const slot = ads?.slots[placement] ?? '';
  const live = !!ads?.show && !!ads.client && !!slot;

  if (!live) {
    // Admins see where ads will go while ads are on but not fully configured.
    if (ads?.enabled && user?.role === 'admin' && !user.ad_free) {
      return (
        <div
          className={cx('no-print flex items-center justify-center rounded-lg border border-dashed border-gray-700 p-2 text-center text-xs text-gray-500', cfg.box, className)}
          data-ad-placeholder={placement}
        >
          Ad slot not configured: {cfg.label}
        </div>
      );
    }
    return null;
  }
  // Re-mount on navigation so each page view requests a fresh ad.
  return <AdUnit key={pathname} client={ads.client} slot={slot} placement={placement} className={className} />;
}

function AdUnit({ client, slot, placement, className }: { client: string; slot: string; placement: AdPlacement; className?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const cfg = PLACEMENTS[placement];

  useEffect(() => {
    loadAdSense(client);
    if (ref.current && !ref.current.dataset.adsbygoogleStatus) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ad blockers or duplicate pushes */
      }
    }
  }, [client]);

  return (
    <div className={cx('no-print overflow-hidden text-center', cfg.box, className)} aria-label="Advertisement">
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={cfg.format}
        data-full-width-responsive={cfg.fullWidth ? 'true' : 'false'}
      />
    </div>
  );
}
