/**
 * BentoCard - Wrapper component for dashboard bento tiles.
 *
 * Provides consistent styling, mount animation, and optional CTA variant
 * for tiles that need contract data but don't have it yet.
 */

import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  /** Grid column span class, e.g. "col-span-5" */
  colSpan?: string;
  /** Delay for staggered mount animation (ms) */
  delay?: number;
}

export function BentoCard({ children, className, colSpan, delay = 0 }: BentoCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={clsx(
        'rounded-lg bg-pkt-bg-card border border-pkt-border-subtle overflow-hidden',
        'transition-all duration-500 ease-out',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
        colSpan,
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface BentoCtaCardProps {
  title: string;
  description: string;
  ctaLabel?: string;
  colSpan?: string;
  delay?: number;
}

export function BentoCtaCard({
  title,
  description,
  ctaLabel = 'Konfigurer',
  colSpan,
  delay = 0,
}: BentoCtaCardProps) {
  const navigate = useNavigate();

  return (
    <BentoCard colSpan={colSpan} delay={delay}>
      <div className="flex flex-col items-center justify-center text-center p-6 h-full min-h-[140px]">
        <p className="text-sm font-medium text-pkt-text-body-subtle mb-1">{title}</p>
        <p className="text-xs text-pkt-text-body-subtle mb-3">{description}</p>
        <button
          onClick={() => navigate('/innstillinger')}
          className="text-xs font-medium text-pkt-text-action-active hover:underline"
        >
          {ctaLabel} &rarr;
        </button>
      </div>
    </BentoCard>
  );
}
