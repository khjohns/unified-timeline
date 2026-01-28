import { useState, useEffect, useRef, useCallback } from 'react';
import { interpolate } from 'flubber';

/**
 * KOE Morph Animation
 *
 * Drømmeaktig, flytende SVG-animasjon som viser KOE-prosessen.
 * Figurene morpher smooth fra en tilstand til neste.
 */

// SVG paths for hver fase - enkle, stiliserte former
const PHASES = [
  {
    id: 'worker',
    label: 'Arbeider oppdager',
    // Person med hjelm som ser på noe
    path: 'M50,20 C50,15 55,10 60,10 C65,10 70,15 70,20 L70,25 L50,25 Z M55,25 L55,50 L45,50 L45,70 L55,70 L55,60 L65,60 L65,70 L75,70 L75,50 L65,50 L65,25 Z',
    color: '#3b82f6',
  },
  {
    id: 'thinking',
    label: 'Tenker',
    // Person med tankeboble
    path: 'M50,25 C50,18 58,12 65,12 C72,12 80,18 80,25 C80,32 72,38 65,38 L60,38 L60,45 L55,40 L50,40 C43,40 35,34 35,27 C35,20 43,25 50,25 Z M60,50 L60,75 L50,75 L50,90 L60,90 L60,80 L70,80 L70,90 L80,90 L80,75 L70,75 L70,50 Z',
    color: '#8b5cf6',
  },
  {
    id: 'writing',
    label: 'Skriver krav',
    // Person ved skrivebord
    path: 'M30,30 L30,50 L90,50 L90,30 Z M55,20 C55,15 60,10 65,10 C70,10 75,15 75,20 L75,30 L55,30 Z M55,50 L55,70 L45,70 L45,90 L55,90 L55,80 L75,80 L75,90 L85,90 L85,70 L75,70 L75,50 Z',
    color: '#6366f1',
  },
  {
    id: 'letter',
    label: 'Krav sendes',
    // Brev/konvolutt
    path: 'M20,30 L60,55 L100,30 L100,80 L20,80 Z M20,30 L20,80 M100,30 L100,80 M20,30 L60,55 L100,30',
    color: '#0ea5e9',
  },
  {
    id: 'receiving',
    label: 'Mottas',
    // Person mottar brev
    path: 'M75,20 C75,15 80,10 85,10 C90,10 95,15 95,20 L95,30 L75,30 Z M75,30 L75,55 L65,55 L65,90 L75,90 L75,75 L95,75 L95,90 L105,90 L105,55 L95,55 L95,30 Z M20,35 L45,50 L45,65 L20,65 Z',
    color: '#14b8a6',
  },
  {
    id: 'reject',
    label: 'Avslag',
    // X-markering / nei
    path: 'M30,30 L45,45 L60,30 L70,40 L55,55 L70,70 L60,80 L45,65 L30,80 L20,70 L35,55 L20,40 Z M75,20 C75,15 80,10 85,10 C90,10 95,15 95,25 L95,35 L75,35 Z M80,40 L80,90 L90,90 L90,40 Z',
    color: '#ef4444',
  },
  {
    id: 'discussion',
    label: 'Diskusjon',
    // To personer ansikt til ansikt
    path: 'M25,20 C25,14 30,10 35,10 C40,10 45,14 45,20 L45,28 L25,28 Z M30,30 L30,55 L20,55 L20,80 L30,80 L30,70 L40,70 L40,80 L50,80 L50,55 L40,55 L40,30 Z M75,20 C75,14 80,10 85,10 C90,10 95,14 95,20 L95,28 L75,28 Z M80,30 L80,55 L70,55 L70,80 L80,80 L80,70 L90,70 L90,80 L100,80 L100,55 L90,55 L90,30 Z',
    color: '#f59e0b',
  },
  {
    id: 'negotiation',
    label: 'Forhandling',
    // To personer nærmere hverandre med bord mellom
    path: 'M20,25 C20,20 25,16 30,16 C35,16 40,20 40,25 L40,32 L20,32 Z M25,35 L25,50 L45,50 L45,60 L75,60 L75,50 L95,50 L95,35 L80,35 L80,28 C80,22 85,18 90,18 C95,18 100,22 100,28 L100,35 L95,35 L95,75 L85,75 L85,60 L35,60 L35,75 L25,75 Z',
    color: '#22c55e',
  },
  {
    id: 'agreement',
    label: 'Avtale!',
    // Håndtrykk
    path: 'M25,45 L25,55 L40,55 L40,50 L50,50 L50,55 L60,55 L60,50 L70,50 L70,55 L80,55 L80,50 L95,50 L95,45 L80,40 L70,42 L60,40 L50,42 L40,40 Z M35,58 L35,75 L45,75 L45,65 L55,70 L65,65 L75,70 L85,65 L85,75 L95,75 L95,58 L85,55 L75,58 L65,55 L55,58 L45,55 Z',
    color: '#10b981',
  },
];

interface KOEMorphAnimationProps {
  /** Varighet per fase i ms */
  phaseDuration?: number;
  /** Varighet for morph-overgang i ms */
  morphDuration?: number;
  /** Loop animasjonen */
  loop?: boolean;
  /** Vis fase-label */
  showLabel?: boolean;
  /** Størrelse (width/height) */
  size?: number;
  /** CSS klasse */
  className?: string;
  /** Callback når ferdig */
  onComplete?: () => void;
}

export function KOEMorphAnimation({
  phaseDuration = 2000,
  morphDuration = 1500,
  loop = true,
  showLabel = true,
  size = 200,
  className = '',
  onComplete,
}: KOEMorphAnimationProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentPath, setCurrentPath] = useState(PHASES[0].path);
  const [currentColor, setCurrentColor] = useState(PHASES[0].color);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Morph til neste fase
  const morphToPhase = useCallback((fromIndex: number, toIndex: number) => {
    const fromPath = PHASES[fromIndex].path;
    const toPath = PHASES[toIndex].path;
    const fromColor = PHASES[fromIndex].color;
    const toColor = PHASES[toIndex].color;

    // Opprett interpolator for path
    const pathInterpolator = interpolate(fromPath, toPath, {
      maxSegmentLength: 5,
    });

    // Interpoler farge manuelt (hex til rgb og tilbake)
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : { r: 0, g: 0, b: 0 };
    };

    const rgbToHex = (r: number, g: number, b: number) =>
      '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');

    const fromRgb = hexToRgb(fromColor);
    const toRgb = hexToRgb(toColor);

    setIsTransitioning(true);
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / morphDuration, 1);

      // Easing (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Oppdater path
      setCurrentPath(pathInterpolator(eased));

      // Oppdater farge
      const r = fromRgb.r + (toRgb.r - fromRgb.r) * eased;
      const g = fromRgb.g + (toRgb.g - fromRgb.g) * eased;
      const b = fromRgb.b + (toRgb.b - fromRgb.b) * eased;
      setCurrentColor(rgbToHex(r, g, b));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsTransitioning(false);
        setCurrentPhase(toIndex);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [morphDuration]);

  // Håndter fase-overganger
  useEffect(() => {
    if (isTransitioning) return;

    const timer = setTimeout(() => {
      const nextPhase = currentPhase + 1;

      if (nextPhase >= PHASES.length) {
        if (loop) {
          morphToPhase(currentPhase, 0);
        } else {
          onComplete?.();
        }
      } else {
        morphToPhase(currentPhase, nextPhase);
      }
    }, phaseDuration);

    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentPhase, isTransitioning, loop, morphToPhase, onComplete, phaseDuration]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 100"
        className="drop-shadow-lg"
      >
        {/* Bakgrunn med gradient */}
        <defs>
          <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={currentColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={currentColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glød-effekt */}
        <circle cx="60" cy="50" r="45" fill="url(#bg-glow)" />

        {/* Hovedfigur */}
        <path
          d={currentPath}
          fill={currentColor}
          className="transition-opacity duration-300"
          style={{
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
          }}
        />
      </svg>

      {/* Label */}
      {showLabel && (
        <div className="mt-3 text-center">
          <span
            className="text-sm font-medium transition-colors duration-500"
            style={{ color: currentColor }}
          >
            {PHASES[currentPhase].label}
          </span>
          <div className="flex gap-1 mt-2 justify-center">
            {PHASES.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentPhase
                    ? 'scale-125'
                    : index < currentPhase
                    ? 'opacity-60'
                    : 'opacity-30'
                }`}
                style={{
                  backgroundColor: index <= currentPhase ? currentColor : '#cbd5e1',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Minimalistisk versjon for loading states
 */
export function KOEMorphLoader({ size = 80 }: { size?: number }) {
  return (
    <KOEMorphAnimation
      size={size}
      phaseDuration={1200}
      morphDuration={800}
      showLabel={false}
      loop
    />
  );
}

/**
 * Fullskjerm "splash" versjon
 */
export function KOEMorphSplash({ onComplete }: { onComplete?: () => void }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center z-50">
      <div className="text-center">
        <KOEMorphAnimation
          size={300}
          phaseDuration={2500}
          morphDuration={2000}
          showLabel
          loop={false}
          onComplete={onComplete}
          className="text-white"
        />
        <p className="mt-6 text-slate-400 text-sm animate-pulse">
          Laster...
        </p>
      </div>
    </div>
  );
}

export default KOEMorphAnimation;
