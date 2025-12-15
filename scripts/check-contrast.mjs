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

// Parse rgba string to RGB + alpha
function parseRgba(rgba) {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1
    };
  }
  return null;
}

// Blend semi-transparent color with background
function blendColors(fgRgba, bgRgb) {
  const alpha = fgRgba.a;
  return {
    r: Math.round(fgRgba.r * alpha + bgRgb.r * (1 - alpha)),
    g: Math.round(fgRgba.g * alpha + bgRgb.g * (1 - alpha)),
    b: Math.round(fgRgba.b * alpha + bgRgb.b * (1 - alpha))
  };
}

// Get RGB from any color format (hex or rgba)
function getEffectiveRgb(color, bgHex = null) {
  if (color.startsWith('#')) {
    return hexToRgb(color);
  } else if (color.startsWith('rgba')) {
    const rgba = parseRgba(color);
    if (rgba && bgHex) {
      const bgRgb = hexToRgb(bgHex);
      return blendColors(rgba, bgRgb);
    }
    return rgba;
  }
  return null;
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
function getContrastRatio(color1, color2, baseBackground = '#1a1a2e') {
  // If color1 (foreground text) is on a semi-transparent background (color2),
  // we need to blend the background with the base first
  let bgRgb;
  if (color2.startsWith('rgba')) {
    bgRgb = getEffectiveRgb(color2, baseBackground);
  } else {
    bgRgb = hexToRgb(color2);
  }

  // Text color is always solid
  const fgRgb = hexToRgb(color1);

  const l1 = getLuminance(fgRgb);
  const l2 = getLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// RGB to hex for display
function rgbToHex(rgb) {
  return '#' + [rgb.r, rgb.g, rgb.b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Check if passes WCAG
function checkWCAG(ratio) {
  return {
    AANormal: ratio >= 4.5,
    AALarge: ratio >= 3.0,
    AAANormal: ratio >= 7.0,
    AAALarge: ratio >= 4.5,
  };
}

// Dark mode base backgrounds
const baseBackgrounds = {
  'bg-default': '#1a1a2e',
  'bg-card': '#252542',
  'bg-subtle': '#1e1e36',
};

// Current dark mode colors from index.css (updated with new values)
const darkColors = {
  // Base backgrounds
  ...baseBackgrounds,

  // Text colors
  'text-body-dark': '#f0f0f8',
  'text-body-default': '#e0e0ec',
  'text-body-light': '#ffffff',
  'text-body-subtle': '#a8a8c0',
  'text-placeholder': '#9a9ab0',

  // Alert backgrounds (semi-transparent on dark bg)
  'alert-info-bg': 'rgba(180, 210, 255, 0.85)',
  'alert-success-bg': 'rgba(176, 240, 208, 0.85)',
  'alert-warning-bg': 'rgba(255, 224, 160, 0.85)',
  'alert-danger-bg': 'rgba(255, 202, 202, 0.85)',

  // Alert text/border colors (dark, matching)
  'alert-info-text': '#1a3a5a',
  'alert-success-text': '#0a4030',
  'alert-warning-text': '#3a3020',
  'alert-danger-text': '#5a2020',

  // Tag backgrounds (semi-transparent)
  'tag-neutral-bg': 'rgba(200, 200, 220, 0.85)',
  'tag-info-bg': 'rgba(180, 210, 255, 0.85)',
  'tag-warning-bg': 'rgba(255, 224, 160, 0.85)',
  'tag-frist-bg': 'rgba(255, 231, 188, 0.85)',

  // Tag text colors
  'tag-neutral-text': '#3a3a5a',
  'tag-info-text': '#1a3a5a',
  'tag-warning-text': '#3a3020',
  'tag-frist-text': '#3a3020',

  // Row backgrounds (semi-transparent)
  'row-te-bg': 'rgba(176, 240, 208, 0.85)',
  'row-bh-bg': 'rgba(255, 224, 160, 0.85)',

  // Row text colors
  'row-te-text': '#0a4030',
  'row-bh-text': '#3a3020',

  // Surface colors (semi-transparent)
  'surface-yellow': 'rgba(255, 224, 160, 0.85)',
  'surface-light-blue': 'rgba(180, 210, 255, 0.85)',
  'surface-light-green': 'rgba(176, 240, 208, 0.85)',
  'surface-faded-red': 'rgba(255, 202, 202, 0.85)',
  'surface-red': 'rgba(255, 180, 172, 0.85)',

  // Border colors (dark, for contrast on light bg)
  'border-blue': '#1a3a5a',
  'border-green': '#0a4030',
  'border-red': '#5a2020',
  'border-yellow': '#5a4a20',

  // Brand colors
  'brand-dark-blue-1000': '#8ab4ff',
  'brand-dark-green-1000': '#6adb8a',
  'brand-yellow-1000': '#fbbf24',
  'brand-red-1000': '#ff6b6b',
  'brand-neutrals-1000': '#f0f0f8',
};

// Define color combinations to test
const combinations = [
  // ============ ALERTS ============
  { name: 'Alert Info: text on bg', fg: 'alert-info-text', bg: 'alert-info-bg', type: 'normal', category: 'Alerts' },
  { name: 'Alert Success: text on bg', fg: 'alert-success-text', bg: 'alert-success-bg', type: 'normal', category: 'Alerts' },
  { name: 'Alert Warning: text on bg', fg: 'alert-warning-text', bg: 'alert-warning-bg', type: 'normal', category: 'Alerts' },
  { name: 'Alert Danger: text on bg', fg: 'alert-danger-text', bg: 'alert-danger-bg', type: 'normal', category: 'Alerts' },

  // ============ TAGS ============
  { name: 'Tag Neutral: text on bg', fg: 'tag-neutral-text', bg: 'tag-neutral-bg', type: 'normal', category: 'Tags' },
  { name: 'Tag Info: text on bg', fg: 'tag-info-text', bg: 'tag-info-bg', type: 'normal', category: 'Tags' },
  { name: 'Tag Warning: text on bg', fg: 'tag-warning-text', bg: 'tag-warning-bg', type: 'normal', category: 'Tags' },
  { name: 'Tag Frist: text on bg', fg: 'tag-frist-text', bg: 'tag-frist-bg', type: 'normal', category: 'Tags' },

  // ============ TABLE ROWS ============
  { name: 'Row TE: text on bg', fg: 'row-te-text', bg: 'row-te-bg', type: 'normal', category: 'Table Rows' },
  { name: 'Row BH: text on bg', fg: 'row-bh-text', bg: 'row-bh-bg', type: 'normal', category: 'Table Rows' },

  // ============ BORDERS ON LIGHT BG ============
  { name: 'Border blue on info bg', fg: 'border-blue', bg: 'alert-info-bg', type: 'ui', category: 'Borders' },
  { name: 'Border green on success bg', fg: 'border-green', bg: 'alert-success-bg', type: 'ui', category: 'Borders' },
  { name: 'Border yellow on warning bg', fg: 'border-yellow', bg: 'alert-warning-bg', type: 'ui', category: 'Borders' },
  { name: 'Border red on danger bg', fg: 'border-red', bg: 'alert-danger-bg', type: 'ui', category: 'Borders' },

  // ============ MAIN TEXT ON DARK BG ============
  { name: 'Body text on default bg', fg: 'text-body-default', bg: 'bg-default', type: 'normal', category: 'Main Text' },
  { name: 'Body text on card bg', fg: 'text-body-default', bg: 'bg-card', type: 'normal', category: 'Main Text' },
  { name: 'Subtle text on card bg', fg: 'text-body-subtle', bg: 'bg-card', type: 'normal', category: 'Main Text' },
  { name: 'Placeholder on card bg', fg: 'text-placeholder', bg: 'bg-card', type: 'normal', category: 'Main Text' },
];

console.log('='.repeat(80));
console.log('WCAG CONTRAST CHECK FOR DARK MODE COLORS');
console.log('='.repeat(80));
console.log('');
console.log('Requirements: AA Normal text = 4.5:1, AA Large text/UI = 3:1');
console.log('Base background for blending: #1a1a2e (bg-default)');
console.log('');

let failures = [];
let warnings = [];
let currentCategory = '';

combinations.forEach(combo => {
  // Print category header
  if (combo.category !== currentCategory) {
    currentCategory = combo.category;
    console.log('-'.repeat(40));
    console.log(`${currentCategory.toUpperCase()}`);
    console.log('-'.repeat(40));
  }

  const fgColor = darkColors[combo.fg];
  const bgColor = darkColors[combo.bg];

  // Calculate effective background (blend rgba with base if needed)
  let effectiveBg = bgColor;
  let effectiveBgHex = bgColor;
  if (bgColor.startsWith('rgba')) {
    const blended = getEffectiveRgb(bgColor, baseBackgrounds['bg-default']);
    effectiveBgHex = rgbToHex(blended);
    effectiveBg = `${bgColor} → ${effectiveBgHex}`;
  }

  const ratio = getContrastRatio(fgColor, bgColor, baseBackgrounds['bg-default']);
  const requiredRatio = combo.type === 'ui' ? 3.0 : 4.5;
  const passes = ratio >= requiredRatio;
  const status = passes ? '✅ PASS' : '❌ FAIL';

  console.log(`${status} ${combo.name}`);
  console.log(`       FG: ${fgColor}`);
  console.log(`       BG: ${effectiveBg}`);
  console.log(`       Ratio: ${ratio.toFixed(2)}:1 (Required: ${requiredRatio}:1)`);
  console.log('');

  if (!passes) {
    failures.push({
      ...combo,
      fgColor,
      bgColor,
      effectiveBgHex,
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
    console.log(`  Current: ${f.fgColor} on ${f.effectiveBgHex} = ${f.ratio.toFixed(2)}:1`);

    // Calculate needed luminance adjustment
    const fgRgb = hexToRgb(f.fgColor);
    const bgRgb = hexToRgb(f.effectiveBgHex);
    const fgLum = getLuminance(fgRgb);
    const bgLum = getLuminance(bgRgb);

    // For light backgrounds (high luminance), we need darker foreground
    // For dark backgrounds (low luminance), we need lighter foreground
    if (bgLum > 0.5) {
      // Light background - need darker text
      const neededLum = (bgLum + 0.05) / f.requiredRatio - 0.05;
      console.log(`  Background luminance: ${bgLum.toFixed(4)} (LIGHT)`);
      console.log(`  Foreground luminance: ${fgLum.toFixed(4)}`);
      console.log(`  Foreground needs luminance <= ${neededLum.toFixed(4)}`);
      console.log(`  → DARKEN the text color`);
    } else {
      // Dark background - need lighter text
      const neededLum = f.requiredRatio * (bgLum + 0.05) - 0.05;
      console.log(`  Background luminance: ${bgLum.toFixed(4)} (DARK)`);
      console.log(`  Foreground luminance: ${fgLum.toFixed(4)}`);
      console.log(`  Foreground needs luminance >= ${neededLum.toFixed(4)}`);
      console.log(`  → LIGHTEN the text color`);
    }
  });
}
