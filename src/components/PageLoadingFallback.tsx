import { useState, useEffect } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';

/**
 * Roterende folkelige meldinger for å gjøre ventetiden mer engasjerende.
 * Bytter melding hvert 750ms i tilfeldig rekkefølge.
 */
const LOADING_MESSAGES = [
  'Henter kaffe …',
  'Leter i arkivet …',
  'Finner frem papirene …',
  'Støvsuger mappene …',
  'Sorterer bunken …',
  'Nesten der …',
];

function getRandomIndex(currentIndex: number): number {
  let newIndex: number;
  do {
    newIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
  } while (newIndex === currentIndex && LOADING_MESSAGES.length > 1);
  return newIndex;
}

/**
 * Loading fallback for lazy-loaded pages.
 * Shows a centered spinner with rotating friendly messages.
 */
export function PageLoadingFallback() {
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGES.length)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => getRandomIndex(prev));
    }, 750);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <ReloadIcon className="w-8 h-8 animate-spin text-pkt-brand-purple-1000" />
        <p className="text-sm text-pkt-text-body-default animate-pulse">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  );
}
