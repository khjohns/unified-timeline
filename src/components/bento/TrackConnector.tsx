/**
 * TrackConnector - Visuell kobling mellom master- og dependent-kort.
 *
 * Viser en subtil vertikal-til-horisontal forgreningslinje
 * fra grunnlag (master) til vederlag+frist (dependent).
 * Kun synlig på xl+ hvor alle tre kort er side-by-side.
 *
 * Layout:
 *   [Grunnlag] ──┬── [Vederlag]
 *                 └── [Frist]
 *
 * På xl er det grid-cols-12 med 4+4+4. Connectoren er en
 * SVG overlay som tegner forgreningslinjer.
 */

import { clsx } from 'clsx';

interface TrackConnectorProps {
  /** Whether grunnlag track is active (sent or beyond) */
  grunnlagActive: boolean;
  /** Whether both dependent tracks should be visually connected */
  className?: string;
}

/**
 * Compact connector shown between cards on xl (3-col) layout.
 * This is placed in a separate grid cell or as an overlay.
 *
 * Uses a simpler approach: small arrow indicators at the top of
 * dependent cards that point back to the master card.
 */
export function TrackConnectorDots({ grunnlagActive, className }: TrackConnectorProps) {
  return (
    <div
      className={clsx(
        'hidden xl:flex items-center justify-center',
        'transition-opacity duration-500',
        grunnlagActive ? 'opacity-100' : 'opacity-30',
        className,
      )}
      aria-hidden="true"
    >
      {/* Simple connecting dots */}
      <div className="flex flex-col items-center gap-1">
        <div className={clsx(
          'w-1 h-1 rounded-full',
          grunnlagActive ? 'bg-pkt-brand-dark-blue-1000/40' : 'bg-pkt-grays-gray-300',
        )} />
        <div className={clsx(
          'w-0.5 h-3',
          grunnlagActive ? 'bg-pkt-brand-dark-blue-1000/20' : 'bg-pkt-grays-gray-200',
        )} />
        <div className={clsx(
          'w-1 h-1 rounded-full',
          grunnlagActive ? 'bg-pkt-brand-dark-blue-1000/40' : 'bg-pkt-grays-gray-300',
        )} />
      </div>
    </div>
  );
}

/**
 * Dependency arrow shown at top of dependent cards on xl layout.
 * A small "from grunnlag" indicator.
 */
export function DependencyIndicator({ grunnlagActive, className }: TrackConnectorProps) {
  if (!grunnlagActive) return null;

  return (
    <div
      className={clsx(
        'hidden xl:flex items-center gap-1 px-3 pt-1.5',
        'text-[9px] text-pkt-text-body-muted',
        className,
      )}
      aria-hidden="true"
    >
      <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="shrink-0 opacity-40">
        <path
          d="M0 4H8M8 4L5 1M8 4L5 7"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="opacity-60">fra grunnlag</span>
    </div>
  );
}

/**
 * Flow line overlay for the full 3-card bento layout.
 * Positioned absolutely over the grid container.
 *
 * Draws a faint "T" shape:
 *   ━━━━━━━┳━━━━━━━
 *           ┃
 *     ━━━━━━┻━━━━━━━
 *
 * Uses CSS gradients instead of SVG for simplicity.
 */
export function TrackFlowOverlay({ grunnlagActive, className }: TrackConnectorProps) {
  return (
    <div
      className={clsx(
        'hidden xl:block absolute inset-0 pointer-events-none z-0',
        'transition-opacity duration-500',
        grunnlagActive ? 'opacity-100' : 'opacity-0',
        className,
      )}
      aria-hidden="true"
    >
      {/* Horizontal connector line at card mid-height */}
      <div
        className="absolute top-1/2 left-[33.33%] right-[33.33%] h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--color-pkt-brand-dark-blue-1000) 30%, var(--color-pkt-brand-dark-blue-1000) 70%, transparent 100%)',
          opacity: 0.12,
        }}
      />
    </div>
  );
}
