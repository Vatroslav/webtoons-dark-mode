// Webtoons Dark Mode - content script.
//
// Reads the site's own stylesheets and appends a copy of every color declaration
// with the color remapped to a dark palette (like Dark Reader's dynamic mode,
// but for one site). Images are never touched, so comic colors stay exact.
(() => {
  'use strict';

  const MARK = 'data-wdm'; // marks our own <style> elements so we never re-process them

  const FG_PROPS = new Set([
    'color', 'fill', 'stroke', 'caret-color', 'text-decoration-color',
    '-webkit-text-fill-color', '-webkit-text-stroke-color',
  ]);
  const BG_PROPS = new Set(['background-color', 'background-image']);
  const BORDER_PROPS = new Set([
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'outline-color', 'column-rule-color',
  ]);

  // Lightness mappings (0..1). Light backgrounds become dark, dark text becomes light;
  // things that are already dark background / light text stay on their side.
  const mapBg = (l) => (l > 0.5 ? 0.07 + (1 - l) * 2 * 0.23 : l * 0.6); // white -> #121212
  const mapBorder = (l) => (l > 0.5 ? 0.16 + (1 - l) * 2 * 0.14 : l * 0.6);
  const mapFg = (l) => (l < 0.5 ? 0.88 - l * 0.56 : l); // black -> #e0e0e0

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h / 6, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map((v) => Math.round(v * 255));
  }

  // Any color syntax (names, #hex, rgb(), hsl()) is normalized through a canvas, which
  // returns '#rrggbb' for opaque colors and 'rgba(r, g, b, a)' otherwise.
  const ctx = document.createElement('canvas').getContext('2d');
  const colorCache = new Map();
  function normalizeColor(token) {
    if (!colorCache.has(token)) {
      ctx.fillStyle = '#010203';
      ctx.fillStyle = token;
      const v = ctx.fillStyle;
      colorCache.set(token, v === '#010203' && token.toLowerCase() !== '#010203' ? null : v);
    }
    return colorCache.get(token);
  }

  function parseColor(token) {
    const v = normalizeColor(token);
    if (!v) return null;
    if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1);
    const n = v.slice(v.indexOf('(') + 1, -1).split(',').map(parseFloat);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  }

  function remapToken(token, map) {
    const c = parseColor(token);
    if (!c || c[3] === 0) return token;
    const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
    const [r, g, b] = hslToRgb(h, s, map(l));
    return c[3] === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${c[3]})`;
  }

  // A bare word only counts as a color name when it isn't part of a hyphenated name.
  const COLOR_TOKEN = /(?:rgba?|hsla?)\([^)]*\)|#[0-9a-f]{3,8}(?![\w-])|(?<![\w-])[a-z]+(?![\w-])/gi;
  const NOT_COLORS = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none']);

  function remapValue(value, map) {
    // url(...) parts are cut out first so file names are never mistaken for color words.
    return value.split(/(url\([^)]*\))/).map((part) => (part.startsWith('url(')
      ? part
      : part.replace(COLOR_TOKEN, (t) => (NOT_COLORS.has(t.toLowerCase()) ? t : remapToken(t, map))))).join('');
  }

  // CSS variables (the comments use them) are resolved to their color where they are
  // used, because one variable can serve as text color in one rule and background in
  // another. Definitions come from :root, or else from any rule that sets them.
  const vars = new Map();
  const rootStyle = getComputedStyle(document.documentElement);
  const VAR_REF = /var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g;

  function collectVars(rules) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (prop.startsWith('--')) vars.set(prop, rule.style.getPropertyValue(prop).trim());
        }
      }
      if (rule.cssRules) collectVars(rule.cssRules);
    }
  }

  function resolveVars(value) {
    for (let depth = 0; depth < 5 && value.includes('var('); depth++) {
      value = value.replace(VAR_REF, (m, name, fallback) => (
        rootStyle.getPropertyValue(name).trim() || vars.get(name) || (fallback || '').trim() || m));
    }
    return value;
  }

  // Shorthands only matter when they hold a var(): then CSSOM leaves their longhands empty.
  const SHORTHANDS = {
    background: mapBg,
    border: mapBorder, 'border-top': mapBorder, 'border-right': mapBorder,
    'border-bottom': mapBorder, 'border-left': mapBorder, 'border-color': mapBorder, outline: mapBorder,
  };

  function remapDecl(prop, value, map, out) {
    if (!value) return;
    const resolved = resolveVars(value);
    if (resolved.includes('var(')) return; // unresolvable - leave the site's value alone
    const next = remapValue(resolved, map);
    if (next !== value) out.push(`${prop}: ${next} !important;`);
  }

  function remapStyle(style) {
    const out = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      const map = FG_PROPS.has(prop) ? mapFg : BG_PROPS.has(prop) ? mapBg : BORDER_PROPS.has(prop) ? mapBorder : null;
      if (!map) continue;
      const value = style.getPropertyValue(prop);
      // Images stay untouched; a gradient layered with a url() is skipped too, because
      // a relative url would resolve against the page instead of the source sheet.
      if (prop === 'background-image' && (!value.includes('gradient') || value.includes('url('))) continue;
      remapDecl(prop, value, map, out);
    }
    for (const [prop, map] of Object.entries(SHORTHANDS)) {
      const value = style.getPropertyValue(prop);
      if (value.includes('var(') && !value.includes('url(')) remapDecl(prop, value, map, out);
    }
    return out.join(' ');
  }

  function remapRules(rules) {
    let css = '';
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const body = remapStyle(rule.style);
        if (body) css += `${rule.selectorText} { ${body} }\n`;
        if (rule.cssRules && rule.cssRules.length) css += remapRules(rule.cssRules); // nested CSS
      } else if (rule instanceof CSSImportRule) {
        if (rule.styleSheet) css += sheetCss(rule.styleSheet);
      } else if (rule instanceof CSSMediaRule) {
        const inner = remapRules(rule.cssRules);
        if (inner) css += `@media ${rule.conditionText} {\n${inner}}\n`;
      } else if (rule instanceof CSSSupportsRule) {
        const inner = remapRules(rule.cssRules);
        if (inner) css += `@supports ${rule.conditionText} {\n${inner}}\n`;
      }
    }
    return css;
  }

  function sheetCss(sheet) {
    try {
      collectVars(sheet.cssRules);
      return remapRules(sheet.cssRules);
    } catch (e) {
      return ''; // cross-origin sheet - cannot be read
    }
  }

  // One generated <style> per source sheet, kept in sync if the source changes.
  const generated = new Map(); // owner node -> { style, key }

  function writeGenerated(owner, key, css) {
    const entry = generated.get(owner);
    const style = entry ? entry.style : document.createElement('style');
    style.setAttribute(MARK, '');
    style.textContent = css;
    // Right after the source sheet, so later site sheets keep their precedence.
    if (style.previousSibling !== owner) owner.after(style);
    generated.set(owner, { style, key });
  }

  // Sheets from another domain (the comments come from ssl.pstatic.net) can't be read
  // through CSSOM, but that server allows CORS, so the file is fetched and parsed here.
  function processCrossOrigin(owner) {
    const key = `fetch|${owner.href}`;
    if (generated.get(owner)?.key === key) return;
    generated.set(owner, { style: generated.get(owner)?.style ?? document.createElement('style'), key });
    fetch(owner.href, { mode: 'cors', credentials: 'omit' })
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((text) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text);
        writeGenerated(owner, key, sheetCss(sheet));
      })
      .catch(() => {}); // no CORS - this sheet stays as it is
  }

  function processOwner(owner) {
    if (owner.hasAttribute(MARK)) return;
    const sheet = owner.sheet;
    if (!sheet) return;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch (e) {
      if (owner.href) processCrossOrigin(owner);
      return;
    }
    const key = `${rules.length}|${owner.textContent.length}`;
    if (generated.get(owner)?.key === key) return;
    writeGenerated(owner, key, sheetCss(sheet));
  }

  const waiting = new WeakSet(); // <link>s whose file hasn't loaded yet

  function processAll() {
    for (const owner of document.querySelectorAll('link[rel~="stylesheet"], style')) {
      if (owner.hasAttribute(MARK)) continue;
      if (owner.tagName === 'LINK' && !owner.sheet) {
        if (!waiting.has(owner)) {
          waiting.add(owner);
          owner.addEventListener('load', () => processOwner(owner), { once: true });
        }
        continue;
      }
      processOwner(owner);
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      processAll();
    });
  }

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (target && target.closest(`[${MARK}]`)) continue;
      if (m.type === 'characterData' || (target && target.tagName === 'STYLE')) return schedule();
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches('link[rel~="stylesheet"], style') || n.querySelector('link[rel~="stylesheet"], style'))) {
          return schedule();
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // CSS-in-JS libraries can add rules through insertRule() without touching the DOM,
  // so re-check rule counts a few times while the page settles.
  document.addEventListener('DOMContentLoaded', processAll);
  window.addEventListener('load', () => {
    processAll();
    [1000, 3000, 8000].forEach((t) => setTimeout(processAll, t));
  });
  processAll();
})();
