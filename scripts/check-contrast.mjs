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
  // If color2 (background) is semi-transparent, blend with base first
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

// Dark mode base backgrounds
const baseBackgrounds = {
  'bg-default': '#1a1a2e',
  'bg-card': '#252542',
  'bg-subtle': '#1e1e36',
};

// Current dark mode colors from index.css
const darkColors = {
  // Base backgrounds
  ...baseBackgrounds,

  // Text colors
  'text-body-dark': '#f0f0f8',
  'text-body-default': '#e0e0ec',
  'text-body-light': '#ffffff',
  'text-body-subtle': '#a8a8c0',
  'text-placeholder': '#9a9ab0',

  // Grays
  'grays-gray-100': '#2a2a4a',
  'grays-gray-300': '#707090',
  'grays-gray-700': '#c8c8e0',

  // ============ ALERT COLORS ============
  'alert-info-bg': 'rgba(180, 210, 255, 0.85)',
  'alert-success-bg': 'rgba(176, 240, 208, 0.85)',
  'alert-warning-bg': 'rgba(255, 224, 160, 0.85)',
  'alert-danger-bg': 'rgba(255, 202, 202, 0.85)',
  'alert-info-text': '#1a3a5a',
  'alert-success-text': '#0a4030',
  'alert-warning-text': '#3a3020',
  'alert-danger-text': '#5a2020',

  // ============ TAG COLORS ============
  'tag-neutral-bg': 'rgba(200, 200, 220, 0.85)',
  'tag-info-bg': 'rgba(180, 210, 255, 0.85)',
  'tag-warning-bg': 'rgba(255, 224, 160, 0.85)',
  'tag-frist-bg': 'rgba(255, 231, 188, 0.85)',
  'tag-neutral-text': '#3a3a5a',
  'tag-info-text': '#1a3a5a',
  'tag-warning-text': '#3a3020',
  'tag-frist-text': '#3a3020',

  // ============ ROW COLORS ============
  'row-te-bg': 'rgba(176, 240, 208, 0.85)',
  'row-bh-bg': 'rgba(255, 224, 160, 0.85)',
  'row-te-text': '#0a4030',
  'row-bh-text': '#3a3020',

  // ============ SURFACE COLORS (semi-transparent) ============
  'surface-yellow': 'rgba(255, 224, 160, 0.85)',
  'surface-light-blue': 'rgba(180, 210, 255, 0.85)',
  'surface-light-green': 'rgba(176, 240, 208, 0.85)',
  'surface-faded-red': 'rgba(255, 202, 202, 0.85)',
  'surface-red': 'rgba(255, 180, 172, 0.85)',
  'surface-faded-green': 'rgba(176, 240, 208, 0.85)',

  // ============ SURFACE COLORS (solid dark) ============
  'surface-gray': '#2a2a4a',
  'surface-subtle': '#1e1e36',
  'surface-subtle-light-blue': '#2a3a5a',
  'surface-subtle-light-red': '#3a2a3a',

  // ============ BADGE COLORS ============
  'badge-info-bg': 'rgba(180, 210, 255, 0.85)',
  'badge-info-text': '#1a3a5a',
  'badge-success-bg': 'rgba(176, 240, 208, 0.85)',
  'badge-success-text': '#0a4030',
  'badge-warning-bg': 'rgba(255, 224, 160, 0.85)',
  'badge-warning-text': '#3a3020',
  'badge-danger-bg': 'rgba(255, 202, 202, 0.85)',
  'badge-danger-text': '#5a2020',

  // ============ BORDER COLORS ============
  'border-blue': '#1a3a5a',
  'border-green': '#0a4030',
  'border-red': '#5a2020',
  'border-yellow': '#5a4a20',
  'border-gray': '#7a7a9a',  /* Lightened */
  'border-default': '#7a7aaa',  /* Lightened */

  // ============ BRAND COLORS ============
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

  // ============ BADGES (using dedicated badge colors) ============
  { name: 'Badge Default: body-default on surface-gray', fg: 'text-body-default', bg: 'surface-gray', type: 'normal', category: 'Badges' },
  { name: 'Badge Info: badge-text on badge-bg', fg: 'badge-info-text', bg: 'badge-info-bg', type: 'normal', category: 'Badges' },
  { name: 'Badge Success: badge-text on badge-bg', fg: 'badge-success-text', bg: 'badge-success-bg', type: 'normal', category: 'Badges' },
  { name: 'Badge Warning: badge-text on badge-bg', fg: 'badge-warning-text', bg: 'badge-warning-bg', type: 'normal', category: 'Badges' },
  { name: 'Badge Danger: badge-text on badge-bg', fg: 'badge-danger-text', bg: 'badge-danger-bg', type: 'normal', category: 'Badges' },
  { name: 'Badge Neutral: gray-700 on grays-gray-100', fg: 'grays-gray-700', bg: 'grays-gray-100', type: 'normal', category: 'Badges' },

  // ============ TAGS ============
  { name: 'Tag Neutral: text on bg', fg: 'tag-neutral-text', bg: 'tag-neutral-bg', type: 'normal', category: 'Tags' },
  { name: 'Tag Info: text on bg', fg: 'tag-info-text', bg: 'tag-info-bg', type: 'normal', category: 'Tags' },
  { name: 'Tag Warning: text on bg', fg: 'tag-warning-text', bg: 'tag-warning-bg', type: 'normal', category: 'Tags' },
  { name: 'Tag Frist: text on bg', fg: 'tag-frist-text', bg: 'tag-frist-bg', type: 'normal', category: 'Tags' },

  // ============ TABLE ROWS ============
  { name: 'Row TE: text on bg', fg: 'row-te-text', bg: 'row-te-bg', type: 'normal', category: 'Table Rows' },
  { name: 'Row BH: text on bg', fg: 'row-bh-text', bg: 'row-bh-bg', type: 'normal', category: 'Table Rows' },

  // ============ MODAL BOXES (Beregning av kostnadsgrense etc.) ============
  // Note: These use alert/badge text colors for proper contrast on light surfaces
  { name: 'Modal Yellow Box: warning-text on surface-yellow', fg: 'alert-warning-text', bg: 'surface-yellow', type: 'normal', category: 'Modal Boxes' },
  { name: 'Modal Red Box: danger-text on surface-faded-red', fg: 'alert-danger-text', bg: 'surface-faded-red', type: 'normal', category: 'Modal Boxes' },
  { name: 'Modal Red Box: danger-text on surface-red', fg: 'alert-danger-text', bg: 'surface-red', type: 'normal', category: 'Modal Boxes' },
  { name: 'Modal Blue Box: body-default on surface-subtle-light-blue', fg: 'text-body-default', bg: 'surface-subtle-light-blue', type: 'normal', category: 'Modal Boxes' },

  // ============ TIMELINE EVENT BADGES ============
  // Note: Timeline badges should use badge colors, same as Badge component
  { name: 'Timeline Grunnlag: badge-info-text on surface-light-blue', fg: 'badge-info-text', bg: 'surface-light-blue', type: 'normal', category: 'Timeline' },
  { name: 'Timeline Vederlag: badge-success-text on surface-light-green', fg: 'badge-success-text', bg: 'surface-light-green', type: 'normal', category: 'Timeline' },
  { name: 'Timeline Frist: frist-text on frist-bg', fg: 'tag-frist-text', bg: 'tag-frist-bg', type: 'normal', category: 'Timeline' },

  // ============ BORDERS ON LIGHT BACKGROUNDS ============
  { name: 'Border blue on info bg', fg: 'border-blue', bg: 'alert-info-bg', type: 'ui', category: 'Borders' },
  { name: 'Border green on success bg', fg: 'border-green', bg: 'alert-success-bg', type: 'ui', category: 'Borders' },
  { name: 'Border yellow on warning bg', fg: 'border-yellow', bg: 'alert-warning-bg', type: 'ui', category: 'Borders' },
  { name: 'Border red on danger bg', fg: 'border-red', bg: 'alert-danger-bg', type: 'ui', category: 'Borders' },
  { name: 'Border gray on surface-gray', fg: 'border-gray', bg: 'surface-gray', type: 'ui', category: 'Borders' },
  { name: 'Border default on bg-card', fg: 'border-default', bg: 'bg-card', type: 'ui', category: 'Borders' },

  // ============ MAIN TEXT ON DARK BACKGROUNDS ============
  { name: 'Body text on default bg', fg: 'text-body-default', bg: 'bg-default', type: 'normal', category: 'Main Text' },
  { name: 'Body text on card bg', fg: 'text-body-default', bg: 'bg-card', type: 'normal', category: 'Main Text' },
  { name: 'Subtle text on card bg', fg: 'text-body-subtle', bg: 'bg-card', type: 'normal', category: 'Main Text' },
  { name: 'Placeholder on card bg', fg: 'text-placeholder', bg: 'bg-card', type: 'normal', category: 'Main Text' },
  { name: 'Body-dark on subtle bg', fg: 'text-body-dark', bg: 'bg-subtle', type: 'normal', category: 'Main Text' },

  // ============ ERROR/STATUS TEXT ============
  { name: 'Error: red-1000 on card bg', fg: 'brand-red-1000', bg: 'bg-card', type: 'normal', category: 'Status Text' },
  { name: 'Success: dark-green on card bg', fg: 'brand-dark-green-1000', bg: 'bg-card', type: 'normal', category: 'Status Text' },
  { name: 'Info: dark-blue on card bg', fg: 'brand-dark-blue-1000', bg: 'bg-card', type: 'normal', category: 'Status Text' },
  { name: 'Warning: yellow-1000 on card bg', fg: 'brand-yellow-1000', bg: 'bg-card', type: 'normal', category: 'Status Text' },
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
let categoryStats = {};

combinations.forEach(combo => {
  // Print category header
  if (combo.category !== currentCategory) {
    currentCategory = combo.category;
    categoryStats[currentCategory] = { pass: 0, fail: 0 };
    console.log('-'.repeat(40));
    console.log(`${currentCategory.toUpperCase()}`);
    console.log('-'.repeat(40));
  }

  const fgColor = darkColors[combo.fg];
  const bgColor = darkColors[combo.bg];

  if (!fgColor || !bgColor) {
    console.log(`⚠️  SKIP ${combo.name} - color not found`);
    console.log(`       fg: ${combo.fg} = ${fgColor}`);
    console.log(`       bg: ${combo.bg} = ${bgColor}`);
    console.log('');
    return;
  }

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

  if (passes) {
    categoryStats[currentCategory].pass++;
  } else {
    categoryStats[currentCategory].fail++;
  }

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
      effectiveBgHex: effectiveBgHex.startsWith('#') ? effectiveBgHex : bgColor,
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
console.log('SUMMARY BY CATEGORY');
console.log('='.repeat(80));
Object.entries(categoryStats).forEach(([cat, stats]) => {
  const total = stats.pass + stats.fail;
  const icon = stats.fail === 0 ? '✅' : '❌';
  console.log(`${icon} ${cat}: ${stats.pass}/${total} passed`);
});

console.log('');
console.log('='.repeat(80));
console.log('OVERALL SUMMARY');
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
    const displayBg = f.effectiveBgHex.startsWith('#') ? f.effectiveBgHex : rgbToHex(getEffectiveRgb(f.bgColor, baseBackgrounds['bg-default']));
    console.log(`  Current: ${f.fgColor} on ${displayBg} = ${f.ratio.toFixed(2)}:1`);

    // Calculate needed luminance adjustment
    const fgRgb = hexToRgb(f.fgColor);
    const bgRgb = hexToRgb(displayBg);
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

// Final statistics
console.log('');
console.log('='.repeat(80));
const totalTests = combinations.length;
const totalPassed = totalTests - failures.length;
console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
console.log('='.repeat(80));
