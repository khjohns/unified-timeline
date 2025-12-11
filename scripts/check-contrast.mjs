/**
 * WCAG Contrast Checker for Dark Mode Colors
 *
 * WCAG AA Requirements:
 * - Normal text: 4.5:1
 * - Large text (18pt+ or 14pt bold): 3:1
 * - UI components: 3:1
 */

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate relative luminance (WCAG formula)
function getLuminance(rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio
function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Check if passes WCAG
function checkWCAG(ratio, level = 'AA') {
  const AANormal = 4.5;
  const AALarge = 3.0;
  const AAANormal = 7.0;
  const AAALarge = 4.5;

  return {
    AANormal: ratio >= AANormal,
    AALarge: ratio >= AALarge,
    AAANormal: ratio >= AAANormal,
    AAALarge: ratio >= AAALarge,
  };
}

// Dark mode colors from index.css
const darkColors = {
  // Backgrounds
  'bg-default': '#1a1a2e',
  'bg-card': '#252542',
  'bg-subtle': '#1e1e36',

  // Text
  'text-body-dark': '#e8e8f0',
  'text-body-default': '#c8c8d8',
  'text-body-light': '#ffffff',
  'text-placeholder': '#9a9ab0',

  // Grays (WCAG AA compliant)
  'grays-gray-100': '#2a2a4a',
  'grays-gray-200': '#3a3a5a',
  'grays-gray-300': '#707090',  // Updated for 3:1 border contrast
  'grays-gray-400': '#7a7a9a',  // Updated for 3:1 border contrast
  'grays-gray-500': '#9090b0',  // Updated for 4.5:1 text contrast
  'grays-gray-600': '#a0a0c0',  // Updated
  'grays-gray-700': '#b0b0d0',  // Updated
  'grays-gray-900': '#e8e8f0',

  // Surfaces
  'surface-faded-green': '#1a3a2a',
  'surface-faded-red': '#3a2a2a',
  'surface-light-blue': '#1a3a5a',
  'surface-light-green': '#1a4a3a',
  'surface-yellow': '#3d3520',  // Updated to warmer amber

  // Brand colors (dark mode adjusted)
  'brand-dark-blue-1000': '#8ab4ff',
  'brand-dark-green-1000': '#6adb8a',
  'brand-warm-blue-1000': '#6a9aff',
  'brand-neutrals-1000': '#e8e8f0',
  'brand-red-1000': '#ff6b6b',
  'brand-yellow-1000': '#f9c66b',
};

// Define color combinations to test
const combinations = [
  // Main text on backgrounds
  { name: 'Body text on default bg', fg: 'text-body-default', bg: 'bg-default', type: 'normal' },
  { name: 'Dark text on default bg', fg: 'text-body-dark', bg: 'bg-default', type: 'normal' },
  { name: 'Body text on card bg', fg: 'text-body-default', bg: 'bg-card', type: 'normal' },
  { name: 'Dark text on card bg', fg: 'text-body-dark', bg: 'bg-card', type: 'normal' },
  { name: 'Body text on subtle bg', fg: 'text-body-default', bg: 'bg-subtle', type: 'normal' },
  { name: 'Placeholder text on card bg', fg: 'text-placeholder', bg: 'bg-card', type: 'normal' },

  // Gray text variations
  { name: 'Gray-500 on card bg', fg: 'grays-gray-500', bg: 'bg-card', type: 'normal' },
  { name: 'Gray-600 on card bg', fg: 'grays-gray-600', bg: 'bg-card', type: 'normal' },
  { name: 'Gray-700 on card bg', fg: 'grays-gray-700', bg: 'bg-card', type: 'normal' },
  { name: 'Gray-700 on subtle bg', fg: 'grays-gray-700', bg: 'bg-subtle', type: 'normal' },

  // Badge/Status combinations
  { name: 'Success: green text on green surface', fg: 'brand-dark-green-1000', bg: 'surface-light-green', type: 'normal' },
  { name: 'Info: blue text on blue surface', fg: 'brand-dark-blue-1000', bg: 'surface-light-blue', type: 'normal' },
  { name: 'Warning: neutrals text on yellow surface', fg: 'brand-neutrals-1000', bg: 'surface-yellow', type: 'normal' },
  { name: 'Frist tag: dark text on yellow surface', fg: 'text-body-dark', bg: 'surface-yellow', type: 'normal' },
  { name: 'Danger: red text on red surface', fg: 'brand-red-1000', bg: 'surface-faded-red', type: 'normal' },

  // Borders/UI components (need 3:1)
  { name: 'Gray-300 border on card bg', fg: 'grays-gray-300', bg: 'bg-card', type: 'ui' },
  { name: 'Gray-400 border on card bg', fg: 'grays-gray-400', bg: 'bg-card', type: 'ui' },
  { name: 'Gray-500 border on subtle bg', fg: 'grays-gray-500', bg: 'bg-subtle', type: 'ui' },

  // Tooltip
  { name: 'Light text on gray-900 (tooltip)', fg: 'text-body-light', bg: 'grays-gray-100', type: 'normal' },
];

console.log('='.repeat(80));
console.log('WCAG CONTRAST CHECK FOR DARK MODE COLORS');
console.log('='.repeat(80));
console.log('');
console.log('Requirements: AA Normal text = 4.5:1, AA Large text/UI = 3:1');
console.log('');

let failures = [];
let warnings = [];

combinations.forEach(combo => {
  const fgColor = darkColors[combo.fg];
  const bgColor = darkColors[combo.bg];
  const ratio = getContrastRatio(fgColor, bgColor);
  const wcag = checkWCAG(ratio);

  const requiredRatio = combo.type === 'ui' ? 3.0 : 4.5;
  const passes = ratio >= requiredRatio;
  const status = passes ? '✅ PASS' : '❌ FAIL';

  console.log(`${status} ${combo.name}`);
  console.log(`       ${combo.fg} (${fgColor}) on ${combo.bg} (${bgColor})`);
  console.log(`       Ratio: ${ratio.toFixed(2)}:1 (Required: ${requiredRatio}:1)`);
  console.log('');

  if (!passes) {
    failures.push({
      ...combo,
      fgColor,
      bgColor,
      ratio,
      requiredRatio,
    });
  } else if (ratio < 4.5 && combo.type === 'normal') {
    warnings.push({
      ...combo,
      fgColor,
      bgColor,
      ratio,
      note: 'Passes for large text only'
    });
  }
});

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

if (failures.length === 0) {
  console.log('✅ All color combinations pass WCAG AA requirements!');
} else {
  console.log(`❌ ${failures.length} combination(s) failed:`);
  failures.forEach(f => {
    console.log(`   - ${f.name}: ${f.ratio.toFixed(2)}:1 (need ${f.requiredRatio}:1)`);
  });
}

if (warnings.length > 0) {
  console.log('');
  console.log(`⚠️  ${warnings.length} combination(s) only pass for large text:`);
  warnings.forEach(w => {
    console.log(`   - ${w.name}: ${w.ratio.toFixed(2)}:1`);
  });
}

console.log('');

// Export failures for fixing
if (failures.length > 0) {
  console.log('='.repeat(80));
  console.log('SUGGESTED FIXES');
  console.log('='.repeat(80));

  failures.forEach(f => {
    console.log(`\n${f.name}:`);
    console.log(`  Current: ${f.fgColor} on ${f.bgColor} = ${f.ratio.toFixed(2)}:1`);

    // Calculate needed luminance adjustment
    const fgRgb = hexToRgb(f.fgColor);
    const bgRgb = hexToRgb(f.bgColor);
    const bgLum = getLuminance(bgRgb);

    // For dark backgrounds, we need lighter foreground
    // (L1 + 0.05) / (L2 + 0.05) >= 4.5
    // L1 >= 4.5 * (L2 + 0.05) - 0.05
    const neededLum = f.requiredRatio * (bgLum + 0.05) - 0.05;
    console.log(`  Background luminance: ${bgLum.toFixed(4)}`);
    console.log(`  Foreground needs luminance >= ${neededLum.toFixed(4)}`);
    console.log(`  Consider: Lighten the foreground color or darken the background`);
  });
}
