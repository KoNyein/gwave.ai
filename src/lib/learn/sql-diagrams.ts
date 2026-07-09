// Original teaching diagrams for the SQL course, drawn as inline SVG and
// exposed as data URIs (no image files, no network). Used as section.image.src.
// All hand-drawn here — no third-party artwork. Greens match the GreenWave
// palette so they read the same in light and dark cards.

function svg(raw: string): string {
  return `data:image/svg+xml,${encodeURIComponent(raw.trim())}`;
}

const FONT = "font-family='ui-sans-serif,system-ui,sans-serif'";

/** A table = columns (fields) across the top, rows (records) down the side. */
export const TABLE_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 230" ${FONT}>
  <text x="14" y="22" font-size="13" fill="#3B6D11">Table: growers</text>
  <rect x="14" y="34" width="432" height="30" fill="#639922"/>
  <text x="30" y="54" font-size="12" fill="#fff">id</text>
  <text x="96" y="54" font-size="12" fill="#fff">name</text>
  <text x="210" y="54" font-size="12" fill="#fff">city</text>
  <text x="350" y="54" font-size="12" fill="#fff">plants</text>
  <text x="410" y="26" font-size="11" fill="#3B6D11">columns</text>
  <line x1="410" y1="30" x2="390" y2="44" stroke="#7FA84B"/>
  <g font-size="12" fill="#2c3d17">
    <rect x="14" y="64" width="432" height="30" fill="#EAF3DE" stroke="#CFE0B4"/>
    <text x="30" y="84">1</text><text x="96" y="84">Mai</text><text x="210" y="84">Yangon</text><text x="350" y="84">12</text>
    <rect x="14" y="94" width="432" height="30" fill="#F5FAEE" stroke="#CFE0B4"/>
    <text x="30" y="114">2</text><text x="96" y="114">Aung</text><text x="210" y="114">Mandalay</text><text x="350" y="114">5</text>
    <rect x="14" y="124" width="432" height="30" fill="#EAF3DE" stroke="#CFE0B4"/>
    <text x="30" y="144">3</text><text x="96" y="144">Su</text><text x="210" y="144">Yangon</text><text x="350" y="144">20</text>
  </g>
  <text x="14" y="176" font-size="11" fill="#3B6D11">← each row is one record</text>
</svg>`);

/** SELECT columns FROM table WHERE condition — the shape of a query. */
export const SELECT_FLOW_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 150" ${FONT}>
  <rect x="10" y="30" width="120" height="46" rx="8" fill="#639922"/>
  <text x="70" y="52" font-size="13" fill="#fff" text-anchor="middle">SELECT</text>
  <text x="70" y="68" font-size="10" fill="#EAF3DE" text-anchor="middle">which columns</text>
  <rect x="175" y="30" width="120" height="46" rx="8" fill="#7FA84B"/>
  <text x="235" y="52" font-size="13" fill="#fff" text-anchor="middle">FROM</text>
  <text x="235" y="68" font-size="10" fill="#EAF3DE" text-anchor="middle">which table</text>
  <rect x="340" y="30" width="120" height="46" rx="8" fill="#9CBE6E"/>
  <text x="400" y="52" font-size="13" fill="#243a10" text-anchor="middle">WHERE</text>
  <text x="400" y="68" font-size="10" fill="#33501a" text-anchor="middle">which rows</text>
  <path d="M130 53 L175 53" stroke="#7FA84B" stroke-width="2" marker-end="url(#a)"/>
  <path d="M295 53 L340 53" stroke="#9CBE6E" stroke-width="2" marker-end="url(#a)"/>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#7FA84B"/></marker></defs>
  <text x="235" y="112" font-size="12" fill="#3B6D11" text-anchor="middle">SELECT name, city FROM growers WHERE plants &gt; 10;</text>
</svg>`);

/** A JOIN matches rows across two tables on a shared key. */
export const JOIN_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 210" ${FONT}>
  <text x="14" y="22" font-size="12" fill="#3B6D11">growers</text>
  <rect x="14" y="30" width="150" height="26" fill="#639922"/>
  <text x="24" y="47" font-size="11" fill="#fff">id · name</text>
  <rect x="14" y="56" width="150" height="24" fill="#EAF3DE" stroke="#CFE0B4"/>
  <text x="24" y="72" font-size="11" fill="#2c3d17">1 · Mai</text>
  <rect x="14" y="80" width="150" height="24" fill="#F5FAEE" stroke="#CFE0B4"/>
  <text x="24" y="96" font-size="11" fill="#2c3d17">3 · Su</text>
  <text x="300" y="22" font-size="12" fill="#3B6D11">strains</text>
  <rect x="296" y="30" width="150" height="26" fill="#7FA84B"/>
  <text x="306" y="47" font-size="11" fill="#fff">name · grower_id</text>
  <rect x="296" y="56" width="150" height="24" fill="#EAF3DE" stroke="#CFE0B4"/>
  <text x="306" y="72" font-size="11" fill="#2c3d17">Blue Dream · 1</text>
  <rect x="296" y="80" width="150" height="24" fill="#F5FAEE" stroke="#CFE0B4"/>
  <text x="306" y="96" font-size="11" fill="#2c3d17">OG Kush · 3</text>
  <path d="M164 68 C 230 68 230 68 296 68" stroke="#639922" stroke-width="2" fill="none"/>
  <path d="M164 92 C 230 92 230 92 296 92" stroke="#7FA84B" stroke-width="2" fill="none"/>
  <text x="230" y="140" font-size="12" fill="#3B6D11" text-anchor="middle">strains.grower_id = growers.id</text>
  <text x="230" y="162" font-size="11" fill="#6b7d55" text-anchor="middle">the key that links the two tables</text>
</svg>`);

/** GROUP BY collapses rows that share a value into one summary row. */
export const GROUP_BY_SVG = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 210" ${FONT}>
  <text x="14" y="20" font-size="12" fill="#3B6D11">rows</text>
  <g font-size="11" fill="#2c3d17">
    <rect x="14" y="28" width="150" height="24" fill="#EAF3DE" stroke="#CFE0B4"/><text x="24" y="44">Yangon · 12</text>
    <rect x="14" y="52" width="150" height="24" fill="#EAF3DE" stroke="#CFE0B4"/><text x="24" y="68">Mandalay · 5</text>
    <rect x="14" y="76" width="150" height="24" fill="#EAF3DE" stroke="#CFE0B4"/><text x="24" y="92">Yangon · 20</text>
    <rect x="14" y="100" width="150" height="24" fill="#EAF3DE" stroke="#CFE0B4"/><text x="24" y="116">Mandalay · 15</text>
  </g>
  <path d="M175 72 L255 72" stroke="#7FA84B" stroke-width="2" marker-end="url(#g)"/>
  <text x="215" y="62" font-size="11" fill="#3B6D11" text-anchor="middle">GROUP BY city</text>
  <defs><marker id="g" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#7FA84B"/></marker></defs>
  <g font-size="11" fill="#fff">
    <rect x="266" y="40" width="180" height="26" fill="#639922"/><text x="276" y="58">Yangon · SUM 32</text>
    <rect x="266" y="78" width="180" height="26" fill="#639922"/><text x="276" y="96">Mandalay · SUM 20</text>
  </g>
  <text x="356" y="140" font-size="11" fill="#6b7d55" text-anchor="middle">one row per group</text>
</svg>`);
