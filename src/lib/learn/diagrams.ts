// Original teaching diagrams, drawn as inline SVG and exposed as data URIs so
// they need no image files and no network. Used as section.image.src on
// flagship lessons. All hand-drawn here — no third-party artwork.

function svg(raw: string): string {
  return `data:image/svg+xml,${encodeURIComponent(raw.trim())}`;
}

const FONT = "font-family='ui-sans-serif,system-ui,sans-serif'";

/** The CSS box model: content wrapped by padding, border and margin. */
export const BOX_MODEL_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260" ${FONT}>
  <rect x="6" y="6" width="408" height="248" rx="8" fill="#F1F7E9" stroke="#9CBE6E"/>
  <text x="16" y="24" font-size="13" fill="#3B6D11">margin</text>
  <rect x="60" y="40" width="300" height="184" rx="6" fill="#DCEBC4" stroke="#7FA84B"/>
  <text x="70" y="58" font-size="13" fill="#3B6D11">border</text>
  <rect x="104" y="72" width="212" height="120" rx="4" fill="#EAF3DE" stroke="#639922"/>
  <text x="114" y="90" font-size="13" fill="#3B6D11">padding</text>
  <rect x="150" y="104" width="120" height="56" rx="4" fill="#639922"/>
  <text x="210" y="138" font-size="13" fill="#ffffff" text-anchor="middle">content</text>
</svg>`);

/** The HTML document tree: html holds head and body. */
export const HTML_STRUCTURE_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 250" ${FONT}>
  <rect x="150" y="14" width="120" height="34" rx="6" fill="#173404"/>
  <text x="210" y="36" font-size="14" fill="#fff" text-anchor="middle">&lt;html&gt;</text>
  <line x1="210" y1="48" x2="110" y2="86" stroke="#7FA84B" stroke-width="2"/>
  <line x1="210" y1="48" x2="310" y2="86" stroke="#7FA84B" stroke-width="2"/>
  <rect x="55" y="86" width="110" height="32" rx="6" fill="#639922"/>
  <text x="110" y="107" font-size="13" fill="#fff" text-anchor="middle">&lt;head&gt;</text>
  <rect x="255" y="86" width="110" height="32" rx="6" fill="#639922"/>
  <text x="310" y="107" font-size="13" fill="#fff" text-anchor="middle">&lt;body&gt;</text>
  <line x1="110" y1="118" x2="110" y2="150" stroke="#9CBE6E" stroke-width="2"/>
  <rect x="55" y="150" width="110" height="28" rx="5" fill="#EAF3DE" stroke="#639922"/>
  <text x="110" y="169" font-size="12" fill="#3B6D11" text-anchor="middle">title, meta</text>
  <line x1="310" y1="118" x2="310" y2="150" stroke="#9CBE6E" stroke-width="2"/>
  <rect x="245" y="150" width="130" height="72" rx="5" fill="#EAF3DE" stroke="#639922"/>
  <text x="310" y="172" font-size="12" fill="#3B6D11" text-anchor="middle">h1, p, img,</text>
  <text x="310" y="190" font-size="12" fill="#3B6D11" text-anchor="middle">button…</text>
  <text x="310" y="210" font-size="11" fill="#6b7280" text-anchor="middle">(what you see)</text>
</svg>`);

/** Flexbox: items laid along a main axis, sized on the cross axis. */
export const FLEXBOX_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" ${FONT}>
  <rect x="10" y="40" width="400" height="120" rx="8" fill="#F1F7E9" stroke="#9CBE6E"/>
  <rect x="30" y="70" width="90" height="60" rx="6" fill="#639922"/>
  <rect x="140" y="70" width="90" height="60" rx="6" fill="#3B6D11"/>
  <rect x="250" y="70" width="90" height="60" rx="6" fill="#639922"/>
  <text x="75" y="105" font-size="13" fill="#fff" text-anchor="middle">1</text>
  <text x="185" y="105" font-size="13" fill="#fff" text-anchor="middle">2</text>
  <text x="295" y="105" font-size="13" fill="#fff" text-anchor="middle">3</text>
  <line x1="30" y1="180" x2="360" y2="180" stroke="#173404" stroke-width="2" marker-end="url(#a)"/>
  <text x="195" y="200" font-size="12" fill="#173404" text-anchor="middle">main axis (row)</text>
  <line x1="385" y1="60" x2="385" y2="150" stroke="#7FA84B" stroke-width="2" marker-end="url(#b)"/>
  <defs>
    <marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#173404"/></marker>
    <marker id="b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#7FA84B"/></marker>
  </defs>
  <text x="405" y="108" font-size="11" fill="#7FA84B" text-anchor="middle" transform="rotate(90 405 108)">cross axis</text>
</svg>`);

/** The water cycle: sun evaporates water, clouds form, rain falls. */
export const WATER_CYCLE_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 240" ${FONT}>
  <rect x="0" y="0" width="420" height="240" rx="8" fill="#EAF6FF"/>
  <circle cx="60" cy="52" r="26" fill="#F6C445"/>
  <text x="60" y="57" font-size="12" fill="#7a5b00" text-anchor="middle">sun</text>
  <ellipse cx="250" cy="60" rx="70" ry="30" fill="#ffffff" stroke="#c9d6e5"/>
  <text x="250" y="64" font-size="13" fill="#516072" text-anchor="middle">clouds</text>
  <line x1="250" y1="92" x2="250" y2="150" stroke="#4a90d9" stroke-width="2" stroke-dasharray="4 5"/>
  <line x1="285" y1="92" x2="285" y2="150" stroke="#4a90d9" stroke-width="2" stroke-dasharray="4 5"/>
  <line x1="215" y1="92" x2="215" y2="150" stroke="#4a90d9" stroke-width="2" stroke-dasharray="4 5"/>
  <text x="330" y="120" font-size="12" fill="#4a90d9">rain</text>
  <path d="M120,150 C150,120 150,110 130,92" fill="none" stroke="#639922" stroke-width="2" marker-end="url(#up)"/>
  <text x="95" y="130" font-size="12" fill="#3B6D11">evaporation</text>
  <rect x="0" y="176" width="420" height="64" fill="#2f7dbf"/>
  <rect x="0" y="176" width="210" height="64" fill="#639922"/>
  <text x="105" y="214" font-size="12" fill="#fff" text-anchor="middle">land</text>
  <text x="315" y="214" font-size="12" fill="#fff" text-anchor="middle">sea</text>
  <defs><marker id="up" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto"><path d="M4,0 L8,6 L0,6 Z" fill="#639922"/></marker></defs>
</svg>`);
