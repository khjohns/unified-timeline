# Implementeringsplan: Dark Mode for CasePage

## Oversikt

Denne planen beskriver implementering av mørkt tema (dark mode) for CasePage og alle tilhørende komponenter. Kodebasen er godt tilrettelagt med et semantisk CSS-variabelsystem som gjør implementeringen relativt grei.

## Nåværende arkitektur

### Styling-oppsett
- **Tailwind CSS v4** med CSS-first konfigurasjon
- Alle farger definert som CSS-variabler i `src/index.css` under `@theme`-blokken
- Semantisk navngiving: `pkt-bg-card`, `pkt-text-body-dark`, etc.
- Ingen hardkodede Tailwind-farger (som `bg-white`)

### Farge-kategorier i `src/index.css`
1. **Brand-farger** (rå palett): Blues, Greens, Yellows, Reds, etc.
2. **Semantiske farger** (light mode defaults): Backgrounds, Borders, Surfaces, Text
3. **Legacy-aliaser** for bakoverkompatibilitet

### Kjente problemer
- `src/components/views/RevisionHistory.tsx` har **11 hardkodede hex-farger** i inline styles
- Scrollbar-styling i `src/index.css` har **8 hardkodede farger**

---

## Fase 1: Infrastruktur

### 1.1 Opprett ThemeContext

Opprett `src/context/ThemeContext.tsx`:

```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system';
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;

    const updateResolvedTheme = () => {
      let resolved: 'light' | 'dark';

      if (theme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };

    updateResolvedTheme();
    localStorage.setItem('theme', theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateResolvedTheme);

    return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

### 1.2 Wrap App med ThemeProvider

I `src/main.tsx`, wrap appen:

```tsx
import { ThemeProvider } from './context/ThemeContext';

// ... inne i render:
<ThemeProvider>
  <App />
</ThemeProvider>
```

### 1.3 Definer dark mode CSS-variabler

I `src/index.css`, legg til dark mode-variabler. Bruk `.dark`-selector:

```css
/* Etter eksisterende @theme block, legg til: */

.dark {
  /* Backgrounds */
  --color-pkt-bg-default: #1a1a2e;
  --color-pkt-bg-card: #252542;
  --color-pkt-bg-subtle: #1e1e36;

  /* Text */
  --color-pkt-text-body-dark: #e8e8f0;
  --color-pkt-text-body-default: #c8c8d8;
  --color-pkt-text-body-light: #ffffff;

  /* Borders */
  --color-pkt-border-default: #4a4a6a;
  --color-pkt-border-gray: #3a3a5a;
  --color-pkt-grays-gray-100: #2a2a4a;
  --color-pkt-grays-gray-200: #3a3a5a;
  --color-pkt-grays-gray-400: #5a5a7a;
  --color-pkt-grays-gray-500: #7a7a9a;
  --color-pkt-grays-gray-700: #a8a8c8;

  /* Surfaces */
  --color-pkt-surface-light-blue: #1a3a5a;
  --color-pkt-surface-light-green: #1a3a2a;
  --color-pkt-surface-yellow: #3a3a1a;

  /* Brand colors - justert for dark mode */
  --color-pkt-brand-blue-200: #2a4a6a;
  --color-pkt-brand-dark-blue-1000: #8ab4ff;
  --color-pkt-brand-dark-green-1000: #6adb8a;

  /* Status colors - beholder samme for gjenkjennelighet */
  /* --color-pkt-brand-green-1000: uendret */
  /* --color-pkt-brand-yellow-1000: uendret */
  /* --color-pkt-brand-red-1000: uendret */
}
```

**Viktig:** Finjuster disse verdiene basert på visuell testing. Sørg for WCAG AA kontrastkrav (4.5:1 for normal tekst).

---

## Fase 2: Fikse hardkodede farger

### 2.1 RevisionHistory.tsx

Erstatt inline styles med CSS-variabler. Finn og erstatt disse hardkodede verdiene:

| Hardkodet | Erstattes med |
|-----------|---------------|
| `#d1d5db` | `var(--color-pkt-grays-gray-300)` |
| `#f9fafb` | `var(--color-pkt-bg-subtle)` |
| `#4b5563` | `var(--color-pkt-grays-gray-600)` |
| `#d1fae5` | `var(--color-pkt-surface-light-green)` |
| `#065f46` | `var(--color-pkt-brand-dark-green-1000)` |
| `#fef3c7` | `var(--color-pkt-surface-yellow)` |
| `#92400e` | `var(--color-pkt-brand-yellow-800)` |
| `#f0fdf4` | `var(--color-pkt-surface-light-green)` |
| `#fffbeb` | `var(--color-pkt-surface-yellow)` |
| `#0369a1` | `var(--color-pkt-brand-dark-blue-1000)` |

Alternativt: Konverter inline styles til Tailwind-klasser der mulig.

### 2.2 Scrollbar-styling i index.css

Oppdater scrollbar-seksjonen (rundt linje 280-287):

```css
/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-pkt-bg-subtle);
}

::-webkit-scrollbar-thumb {
  background: var(--color-pkt-grays-gray-400);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-pkt-grays-gray-500);
}
```

---

## Fase 3: Opprett ThemeToggle-komponent

Opprett `src/components/ThemeToggle.tsx`:

```tsx
import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon, DesktopIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', icon: SunIcon, label: 'Lyst tema' },
    { value: 'dark', icon: MoonIcon, label: 'Mørkt tema' },
    { value: 'system', icon: DesktopIcon, label: 'Systemvalg' },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-1 bg-pkt-bg-subtle rounded-lg">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={clsx(
            'p-2 rounded-md transition-colors',
            theme === value
              ? 'bg-pkt-bg-card text-pkt-text-body-dark shadow-sm'
              : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark'
          )}
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
```

---

## Fase 4: Integrer i CasePage

### 4.1 Legg til ThemeToggle i header

I `src/pages/CasePage.tsx`, importer og legg til ThemeToggle ved siden av ModeToggle:

```tsx
import { ThemeToggle } from '../components/ThemeToggle';

// I header-seksjonen:
<div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
  <ThemeToggle />
  <Button
    variant="ghost"
    size="sm"
    onClick={() => downloadContractorClaimPdf(state)}
    title="Last ned PDF"
  >
    <DownloadIcon className="w-4 h-4" />
    <span className="ml-2 sm:hidden">Last ned PDF</span>
  </Button>
  <ModeToggle userRole={userRole} onToggle={setUserRole} />
</div>
```

---

## Fase 5: Verifiser komponenter

Gå systematisk gjennom disse komponentene og verifiser at de fungerer i dark mode:

### Primitives (`src/components/primitives/`)
- [ ] Alert.tsx
- [ ] AlertDialog.tsx
- [ ] Badge.tsx
- [ ] Button.tsx - **Viktig:** Sjekk alle 4 varianter (primary, secondary, ghost, danger)
- [ ] Card.tsx
- [ ] Checkbox.tsx
- [ ] Collapsible.tsx
- [ ] CurrencyInput.tsx
- [ ] DatePicker.tsx
- [ ] FormField.tsx
- [ ] InfoLabel.tsx
- [ ] Input.tsx
- [ ] Label.tsx
- [ ] MetadataGrid.tsx
- [ ] Modal.tsx - **Viktig:** Sjekk backdrop/overlay
- [ ] RadioGroup.tsx
- [ ] RevisionTag.tsx
- [ ] Select.tsx
- [ ] StepIndicator.tsx
- [ ] Textarea.tsx
- [ ] Tooltip.tsx

### Views (`src/components/views/`)
- [ ] StatusCard.tsx
- [ ] StatusDashboard.tsx
- [ ] Timeline.tsx
- [ ] TimelineItem.tsx
- [ ] ComprehensiveMetadata.tsx
- [ ] RevisionHistory.tsx - **Allerede fikset i Fase 2**
- [ ] EventDetailModal.tsx

### Actions (`src/components/actions/`)
- [ ] SendGrunnlagModal.tsx
- [ ] SendVederlagModal.tsx
- [ ] SendFristModal.tsx
- [ ] RespondGrunnlagModal.tsx
- [ ] RespondVederlagModal.tsx
- [ ] RespondFristModal.tsx
- [ ] SendGrunnlagUpdateModal.tsx
- [ ] ReviseVederlagModal.tsx
- [ ] ReviseFristModal.tsx
- [ ] RespondGrunnlagUpdateModal.tsx
- [ ] UpdateResponseVederlagModal.tsx
- [ ] UpdateResponseFristModal.tsx
- [ ] SendForseringModal.tsx

### Spesielle tilfeller å se etter:
1. **`bg-white`** - Erstatt med `bg-pkt-bg-card`
2. **Hardkodede border-farger** - Bruk CSS-variabler
3. **Focus-states** - Sørg for synlighet i dark mode
4. **Disabled states** - Verifiser kontrast
5. **Hover states** - Test at de er synlige

---

## Fase 6: Testing

### 6.1 Visuell testing
- [ ] Test alle sider i både light og dark mode
- [ ] Test system preference (endre OS-innstilling)
- [ ] Test toggle mellom moduser
- [ ] Verifiser at valg persisteres (localStorage)

### 6.2 Tilgjengelighet
- [ ] Kjør kontrastsjekk (WCAG AA: 4.5:1 for tekst)
- [ ] Test med skjermleser
- [ ] Verifiser fokusindikatorer i dark mode

### 6.3 Enheter
- [ ] Desktop (Chrome, Firefox, Safari)
- [ ] Mobil (iOS Safari, Android Chrome)
- [ ] Test dark mode toggle på mobil

---

## Filer som må endres

| Fil | Endring |
|-----|---------|
| `src/index.css` | Legg til `.dark` CSS-variabler + fiks scrollbar |
| `src/context/ThemeContext.tsx` | **Ny fil** |
| `src/components/ThemeToggle.tsx` | **Ny fil** |
| `src/main.tsx` | Wrap med ThemeProvider |
| `src/pages/CasePage.tsx` | Legg til ThemeToggle |
| `src/components/views/RevisionHistory.tsx` | Fiks hardkodede farger |
| ~40 komponentfiler | Verifiser/juster etter behov |

---

## Estimert tidsbruk

| Fase | Beskrivelse | Tid |
|------|-------------|-----|
| 1 | Infrastruktur (context, provider, CSS-variabler) | 2-3 timer |
| 2 | Fiks hardkodede farger | 1-2 timer |
| 3 | ThemeToggle-komponent | 30 min |
| 4 | Integrer i CasePage | 30 min |
| 5 | Verifiser komponenter | 3-4 timer |
| 6 | Testing | 1-2 timer |
| **Totalt** | | **8-12 timer** |

---

## Tips for implementering

1. **Start med infrastruktur** - Få ThemeContext og CSS-variablene på plass først
2. **Test tidlig** - Verifiser at dark mode-klassen legges på `<html>`
3. **Bruk DevTools** - Chrome DevTools kan emulere `prefers-color-scheme`
4. **Én komponent om gangen** - Systematisk gjennomgang er bedre enn å fikse alt samtidig
5. **Ikke endre brand-farger for mye** - Status-farger (grønn, gul, rød) bør være gjenkjennelige

---

## Referanser

- Tailwind CSS v4 Dark Mode: https://tailwindcss.com/docs/dark-mode
- WCAG Contrast Requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
