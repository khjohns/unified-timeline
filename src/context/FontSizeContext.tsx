/**
 * FontSizeContext - Provides font size scaling for bento cards
 *
 * Two modes:
 * - 'default': Standard bento token sizes (11-16px, bumped from original 9-14px)
 * - 'large': All bento tokens bumped +2px for extra readability
 *
 * Applies a CSS class on <html> which overrides CSS custom properties.
 * Preference is persisted to localStorage.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type FontSize = 'default' | 'large';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('font-size') as FontSize | null;
      // Migration: users who had 'large' now get 'default' (sizes were bumped)
      if (stored === 'large' && !localStorage.getItem('font-size-migrated-v2')) {
        localStorage.setItem('font-size-migrated-v2', '1');
        localStorage.setItem('font-size', 'default');
        return 'default';
      }
      return stored || 'default';
    }
    return 'default';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-default', 'font-large');
    root.classList.add(`font-${fontSize}`);
    localStorage.setItem('font-size', fontSize);
  }, [fontSize]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
