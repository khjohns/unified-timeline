import { useState, useEffect, useCallback } from 'react';

/**
 * ASCII Construction Animation
 *
 * Animert historie om KOE-prosessen fra byggeplass til avtale.
 * Kan brukes som loading-indikator eller dekorativt element.
 */

// Scene-definisjon
interface Scene {
  id: string;
  label: string;
  frames: string[];
  frameDuration?: number; // ms per frame innenfor scenen
  position?: { x: number; y: number }; // relativ posisjon (0-100%)
}

const SCENES: Scene[] = [
  {
    id: 'discover',
    label: 'Oppdager',
    position: { x: 5, y: 50 },
    frames: [
`
     "Oi! Dette står
      ikke i kontrakten!"
           \\
           (O)
  ~~~~~~~~~~\\|/~~~~~~~
 |  GRØFT   /'>  ???  |
 |_________|___|______|
`,
`
     "Oi! Dette står
      ikke i kontrakten!"
           \\
           (O)
  ~~~~~~~~~~\\|/~~~~~~~
 |  GRØFT   /<'  ???  |
 |_________|___|______|
`,
    ],
  },
  {
    id: 'writing',
    label: 'Skriver',
    position: { x: 15, y: 50 },
    frames: [
`
    "Krav om endring..."
             |
            (O)   ___
            /|\\  |   |
            /'\\  |___|
           [BORD]
`,
`
    "Krav om endring..."
             |
            (O)   ___
            /|\\  | ~ |
            /'\\  |___|
           [BORD]
`,
`
    "Krav om endring..."
             |
            (O)   ___
            /|\\  |~~ |
            /'\\  |___|
           [BORD]
`,
`
    "Krav om endring..."
             |
            (O)   ___
            /|\\  |~~~|
            /'\\  |___|
           [BORD]
`,
    ],
  },
  {
    id: 'letter-ready',
    label: 'Krav klart',
    position: { x: 25, y: 50 },
    frames: [
`
      .-----------.
     |  KRAV OM    |
     |  ENDRING    |
     | ~~~~~~~~~~~ |
     | kr 847.000  |
     |_____________|
           |
          (O)
          /|\\
          / \\
`,
    ],
  },
  {
    id: 'sending',
    label: 'Sender',
    position: { x: 35, y: 45 },
    frameDuration: 150,
    frames: [
`
                .--------.
   (O)          | KRAV   |
   /|\\  ~~~>    '--------'
   / \\
`,
`
                     .--------.
   (O)               | KRAV   |  ~>
   /|\\   ~~~>        '--------'
   / \\
`,
`
                          .--------.
   (O)                    | KRAV   |
   /|\\    ~~~>            '--------'  ~>
   / \\
`,
    ],
  },
  {
    id: 'arriving',
    label: 'Ankommer',
    position: { x: 55, y: 50 },
    frames: [
`
                      "Post?"
                          \\
    .--------.            (O)
    | KRAV   |  ~~~>      -|--
    '--------'            /|
                       [PULT]
`,
`
                      "Hva er dette?"
                             /
          .--------.       (O)
          | KRAV   | ~~~>  -|--
          '--------'       /|
                        [PULT]
`,
    ],
  },
  {
    id: 'reading',
    label: 'Leser',
    position: { x: 65, y: 50 },
    frames: [
`
                  .-----------.
                 |  KRAV OM    |
                 |  ENDRING    |
     (O)  <---   | ~~~~~~~~~~~ |
     /|\\         | kr 847.000  |
     / \\         |_____________|
  [PULT]
`,
`
       "847.000?!"
            /
          (O)    .-----------.
          /|\\   |  KRAV OM    |
          / \\   |  ENDRING    |
       [PULT]   | kr 847.000  |
                |_____________|
`,
    ],
  },
  {
    id: 'reject',
    label: 'Avslag',
    position: { x: 70, y: 50 },
    frames: [
`
          "NEI! For dyrt!"
                 /
               (O)
   .-----.     \\|
   | AVS |      |\\
   | LAG |     / \\
   '-----'  [PULT]
`,
`
          "AVSLATT!"
                /
              (O)
   .-----.    \\|/
   | AVS |     |
   | LAG |    / \\
   '-----' [PULT]
`,
    ],
  },
  {
    id: 'reject-sending',
    label: 'Avslag sendes',
    position: { x: 50, y: 45 },
    frameDuration: 150,
    frames: [
`
          .-------.
  <~~~    | AVSLAG|         (O)
          '-------'         /|\\
                            / \\
                         [PULT]
`,
`
     .-------.
     | AVSLAG|   <~~~       (O)
     '-------'              /|\\
                            / \\
                         [PULT]
`,
`
.-------.
| AVSLAG|        <~~~       (O)
'-------'                   /|\\
                            / \\
                         [PULT]
`,
    ],
  },
  {
    id: 'receive-reject',
    label: 'Mottar avslag',
    position: { x: 25, y: 50 },
    frames: [
`
    "Hva?!"
       \\
       (O)    .-------.
       /|\\<---| AVSLAG|
       / \\    '-------'
`,
`
    "Dette godtar jeg ikke!"
              |
             (O)
             /|\\
             / \\
`,
    ],
  },
  {
    id: 'disagreement',
    label: 'Uenighet',
    position: { x: 45, y: 50 },
    frames: [
`
  "847.000!"                "Maks 200.000!"
       \\                          /
       \\O/                      \\O/
        |         VS             |
       / \\                      / \\
`,
`
  "Vi krever!"                "Urimelig!"
       \\                          /
       \\O/                      \\O/
        |    !!  VS  !!          |
       / \\                      / \\
`,
`
  "Kontrakten sier..."      "Uenig!"
          \\                     /
          \\O/                 \\O/
           |      <--->        |
          / \\                 / \\
`,
    ],
  },
  {
    id: 'negotiation',
    label: 'Forhandler',
    position: { x: 45, y: 50 },
    frames: [
`
      "Hmm..."                 "Vel..."
           \\                      /
           (O)                  (O)
           /|\\   [FORHANDLING]  /|\\
           / \\   |  500.000? |  / \\
                 |___________|
`,
`
      "Kanskje..."             "Hvis..."
            \\                     /
            (O)                 (O)
            /|\\  [FORHANDLING]  /|\\
            / \\  |  450.000? |  / \\
                 |___________|
`,
`
      "Ok, men..."             "Greit..."
            \\                      /
            (O)                  (O)
            /|\\  [FORHANDLING]   /|\\
            / \\  |  523.500? |   / \\
                 |___________|
`,
    ],
  },
  {
    id: 'agreement',
    label: 'Avtale!',
    position: { x: 45, y: 50 },
    frames: [
`
              "AVTALE!"
                  |
           (O)========(O)
            |\\   ||   /|
           / \\   ||  / \\
                 ||
         .---------------.
         |  ENDRINGSORDRE |
         |   kr 523.500   |
         |    GODKJENT    |
         '---------------'
`,
`
            * AVTALE! *
                  |
           (O)========(O)
            |\\   ||   /|
           / \\   ||  / \\
              \\  ||  /
         .---------------.
         |  ENDRINGSORDRE |
         |   kr 523.500   |
         |  * GODKJENT *  |
         '---------------'
`,
    ],
  },
];

interface ConstructionAnimationProps {
  /** Auto-start animasjonen */
  autoPlay?: boolean;
  /** Hastighet multiplier (1 = normal, 2 = dobbelt så rask) */
  speed?: number;
  /** Callback når animasjonen er ferdig */
  onComplete?: () => void;
  /** Loop animasjonen */
  loop?: boolean;
  /** Vis tidslinje under */
  showTimeline?: boolean;
  /** Vis i kompakt modus (mindre plass) */
  compact?: boolean;
  /** Aktiver bevegelse på tvers av skjermen */
  enableMovement?: boolean;
  /** CSS klasse for container */
  className?: string;
}

export function ConstructionAnimation({
  autoPlay = true,
  speed = 1,
  onComplete,
  loop = false,
  showTimeline = true,
  compact = false,
  enableMovement = false,
  className = '',
}: ConstructionAnimationProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const currentScene = SCENES[currentSceneIndex];
  const currentFrame = currentScene.frames[currentFrameIndex];

  // Oppdater posisjon basert på scene
  useEffect(() => {
    if (enableMovement && currentScene.position) {
      setPosition(currentScene.position);
    }
  }, [currentSceneIndex, enableMovement, currentScene.position]);

  // Frame-animasjon innenfor scene
  useEffect(() => {
    if (!isPlaying) return;

    const frameDuration = (currentScene.frameDuration || 400) / speed;

    const frameTimer = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        const nextFrame = prev + 1;
        if (nextFrame >= currentScene.frames.length) {
          return 0; // Loop innenfor scene
        }
        return nextFrame;
      });
    }, frameDuration);

    return () => clearInterval(frameTimer);
  }, [isPlaying, currentScene, speed]);

  // Scene-overgang
  useEffect(() => {
    if (!isPlaying) return;

    const sceneDuration = (2000 + currentScene.frames.length * 300) / speed;

    const sceneTimer = setTimeout(() => {
      setCurrentSceneIndex((prev) => {
        const nextScene = prev + 1;
        if (nextScene >= SCENES.length) {
          if (loop) {
            return 0;
          }
          setIsPlaying(false);
          onComplete?.();
          return prev;
        }
        return nextScene;
      });
      setCurrentFrameIndex(0);
    }, sceneDuration);

    return () => clearTimeout(sceneTimer);
  }, [isPlaying, currentSceneIndex, speed, loop, onComplete]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentSceneIndex(0);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
  }, []);

  const handleSceneClick = useCallback((index: number) => {
    setCurrentSceneIndex(index);
    setCurrentFrameIndex(0);
  }, []);

  const containerStyle = enableMovement
    ? {
        transform: `translate(${position.x}%, ${position.y - 50}%)`,
        transition: 'transform 1s ease-in-out',
      }
    : {};

  return (
    <div className={`relative ${className}`}>
      {/* Hovedanimasjon */}
      <div
        className={`font-mono text-sm leading-tight whitespace-pre bg-slate-900 text-green-400 rounded-lg overflow-hidden ${
          compact ? 'p-2' : 'p-4'
        } ${enableMovement ? 'absolute' : ''}`}
        style={containerStyle}
      >
        <pre className={compact ? 'text-xs' : 'text-sm'}>{currentFrame}</pre>
      </div>

      {/* Kontroller */}
      {!compact && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={handlePlayPause}
            className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 text-sm"
          >
            {isPlaying ? 'Pause' : 'Spill'}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 text-sm"
          >
            Start på nytt
          </button>
        </div>
      )}

      {/* Tidslinje */}
      {showTimeline && !compact && (
        <div className="mt-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {SCENES.map((scene, index) => (
              <button
                key={scene.id}
                onClick={() => handleSceneClick(index)}
                className={`flex-shrink-0 px-2 py-1 text-xs rounded transition-colors ${
                  index === currentSceneIndex
                    ? 'bg-blue-600 text-white'
                    : index < currentSceneIndex
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {scene.label}
              </button>
            ))}
          </div>
          <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${((currentSceneIndex + 1) / SCENES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Flytende versjon som beveger seg rundt på siden
 * Perfekt for loading-states eller dekorasjon
 */
interface FloatingAnimationProps {
  /** Hvor på siden den skal starte (CSS) */
  startPosition?: { top?: string; left?: string; right?: string; bottom?: string };
  /** Animasjonsbane: 'horizontal' | 'diagonal' | 'custom' */
  path?: 'horizontal' | 'diagonal' | 'bounce';
}

export function FloatingConstructionAnimation({
  startPosition = { top: '20%', left: '10%' },
  path = 'horizontal',
}: FloatingAnimationProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.01;

      switch (path) {
        case 'horizontal':
          setOffset({ x: Math.sin(frame) * 30, y: 0 });
          break;
        case 'diagonal':
          setOffset({ x: Math.sin(frame) * 20, y: Math.cos(frame) * 10 });
          break;
        case 'bounce':
          setOffset({ x: frame * 10 % 80, y: Math.abs(Math.sin(frame * 2)) * -20 });
          break;
      }

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [path]);

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        ...startPosition,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      <ConstructionAnimation
        compact
        showTimeline={false}
        loop
        speed={1.5}
      />
    </div>
  );
}

export default ConstructionAnimation;
