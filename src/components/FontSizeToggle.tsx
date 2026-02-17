/**
 * FontSizeToggle Component
 *
 * Toggles between default and large font sizes for bento cards.
 * Shows "A" in current scale to indicate text size.
 */

import { useFontSize } from '../context/FontSizeContext';

export function FontSizeToggle() {
  const { fontSize, setFontSize } = useFontSize();

  const toggle = () => {
    setFontSize(fontSize === 'default' ? 'large' : 'default');
  };

  const isLarge = fontSize === 'large';

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg bg-pkt-bg-subtle border border-pkt-grays-gray-200
                 hover:bg-pkt-bg-card hover:border-pkt-border-default
                 focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30
                 transition-all duration-200"
      aria-label={isLarge ? 'Bytt til standard tekststørrelse' : 'Bytt til større tekststørrelse'}
      title={isLarge ? 'Standard tekst' : 'Større tekst'}
    >
      <span className="flex items-baseline gap-px w-4 h-4 justify-center text-pkt-text-body-default select-none">
        <span className="text-[9px] font-medium leading-none">A</span>
        <span className={`font-semibold leading-none ${isLarge ? 'text-[13px] text-pkt-brand-warm-blue-1000' : 'text-[12px]'}`}>A</span>
      </span>
    </button>
  );
}
