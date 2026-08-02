"""SVG diagram generators for the Gwave architecture document.

Everything is emitted as inline SVG so the final HTML is a single self-contained
file that Chromium can print without any external fetches.
"""

import math

# ---------------------------------------------------------------- palette ----
INK = "#0f172a"
MUTED = "#64748b"
LINE = "#cbd5e1"
BRAND = "#0f5132"
BRAND_SOFT = "#e7f2ec"
ACCENT = "#b45309"
ACCENT_SOFT = "#fdf3e3"
BLUE = "#1d4ed8"
BLUE_SOFT = "#eaf0ff"
PANEL = "#f8fafc"

FONT = "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif"
MONO = "'DejaVu Sans Mono', 'Liberation Mono', monospace"


def _defs():
    return f"""
  <defs>
    <marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{MUTED}"/>
    </marker>
    <marker id="arwb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
            markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{BRAND}"/>
    </marker>
  </defs>"""


def _esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ------------------------------------------------------------ ER diagrams ----
def _entity(x, y, w, name, fields, fill, stroke, title_fill="#ffffff"):
    """Entity card. (x, y) is the top-left corner."""
    head = 21
    row = 14
    h = head + row * len(fields) + 7
    out = [
        f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" '
        f'fill="#ffffff" stroke="{stroke}" stroke-width="1"/>',
        f'<path d="M{x} {y+4} a4 4 0 0 1 4 -4 h{w-8} a4 4 0 0 1 4 4 v{head-4} h{-w} z" '
        f'fill="{fill}"/>',
        f'<text x="{x+7}" y="{y+14.5}" font-family="{FONT}" font-size="10.5" '
        f'font-weight="bold" fill="{title_fill}">{_esc(name)}</text>',
    ]
    for i, f in enumerate(fields):
        ty = y + head + row * i + 10.5
        col = MUTED if f.startswith("→") else INK
        out.append(
            f'<text x="{x+7}" y="{ty}" font-family="{MONO}" font-size="8.6" '
            f'fill="{col}">{_esc(f)}</text>'
        )
    out.append("</g>")
    return "".join(out), h


def _edge(x1, y1, x2, y2, label=None, dashed=False):
    d = ' stroke-dasharray="4 3"' if dashed else ""
    s = (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
         f'stroke="{LINE}" stroke-width="1.2"{d}/>')
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        s += (f'<text x="{mx:.1f}" y="{my-3:.1f}" font-family="{FONT}" font-size="8" '
              f'fill="{MUTED}" text-anchor="middle">{_esc(label)}</text>')
    return s


def _rect_edge_point(cx, cy, w, h, tx, ty):
    """Point where the line from (cx,cy) toward (tx,ty) leaves the box."""
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (w / 2) / abs(dx) if dx else float("inf")
    sy = (h / 2) / abs(dy) if dy else float("inf")
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def er_hub(hub_name, hub_fields, satellites, width=900, height=560,
           rx=320, ry=205, hub_fill=BRAND, sat_fill=BLUE_SOFT,
           sat_stroke="#c7d2fe", sat_title="#1e3a8a", start=-90):
    """Radial ER diagram: one hub entity, satellites around it."""
    cx, cy = width / 2, height / 2
    parts = [
        f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
        f'class="dia">', _defs(),
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="{PANEL}" rx="6"/>',
    ]

    hw = 176
    hub_svg, hh = _entity(cx - hw / 2, cy - 0, hw, hub_name, hub_fields,
                          hub_fill, hub_fill)
    hy = cy - hh / 2
    hub_svg, hh = _entity(cx - hw / 2, hy, hw, hub_name, hub_fields,
                          hub_fill, hub_fill)

    n = len(satellites)
    edges, boxes = [], []
    for i, (name, fields, fk) in enumerate(satellites):
        a = math.radians(start + 360.0 * i / n)
        sw = 168
        _, sh = _entity(0, 0, sw, name, fields, sat_fill, sat_stroke, sat_title)
        scx, scy = cx + rx * math.cos(a), cy + ry * math.sin(a)
        bx, by = scx - sw / 2, scy - sh / 2
        svg, _ = _entity(bx, by, sw, name, fields, sat_fill, sat_stroke, sat_title)
        boxes.append(svg)
        p1 = _rect_edge_point(cx, cy, hw, hh, scx, scy)
        p2 = _rect_edge_point(scx, scy, sw, sh, cx, cy)
        edges.append(_edge(p1[0], p1[1], p2[0], p2[1], fk))
    parts += edges + boxes + [hub_svg, "</svg>"]
    return "".join(parts)


def er_free(entities, edges, width=900, height=520, caption=None):
    """Free-form ER diagram. entities: name -> (x, y, w, fields, kind)."""
    kinds = {
        "core": (BRAND, BRAND, "#ffffff"),
        "blue": (BLUE_SOFT, "#c7d2fe", "#1e3a8a"),
        "amber": (ACCENT_SOFT, "#f0d3a0", "#78350f"),
        "green": (BRAND_SOFT, "#bcd9c9", "#14532d"),
        "grey": ("#eef2f6", "#d7dee6", "#334155"),
    }
    parts = [
        f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
        f'class="dia">', _defs(),
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="{PANEL}" rx="6"/>',
    ]
    geo, drawn = {}, []
    for name, (x, y, w, fields, kind) in entities.items():
        fill, stroke, tf = kinds[kind]
        svg, h = _entity(x, y, w, name, fields, fill, stroke, tf)
        geo[name] = (x + w / 2, y + h / 2, w, h)
        drawn.append(svg)
    for a, b, label in edges:
        ax, ay, aw, ah = geo[a]
        bx, by, bw, bh = geo[b]
        p1 = _rect_edge_point(ax, ay, aw, ah, bx, by)
        p2 = _rect_edge_point(bx, by, bw, bh, ax, ay)
        parts.append(_edge(p1[0], p1[1], p2[0], p2[1], label))
    parts += drawn
    if caption:
        parts.append(
            f'<text x="{width/2}" y="{height-10}" font-family="{FONT}" font-size="9" '
            f'fill="{MUTED}" text-anchor="middle">{_esc(caption)}</text>')
    parts.append("</svg>")
    return "".join(parts)


# -------------------------------------------------------------- flowcharts ---
def node(x, y, w, h, text, kind="plain", sub=None, fs=10):
    styles = {
        "plain": ("#ffffff", "#cbd5e1", INK),
        "brand": (BRAND, BRAND, "#ffffff"),
        "soft": (BRAND_SOFT, "#bcd9c9", "#14532d"),
        "blue": (BLUE_SOFT, "#c7d2fe", "#1e3a8a"),
        "amber": (ACCENT_SOFT, "#f0d3a0", "#78350f"),
        "dark": ("#1e293b", "#1e293b", "#ffffff"),
        "grey": ("#eef2f6", "#d7dee6", "#334155"),
    }
    fill, stroke, tc = styles[kind]
    lines = text.split("|")
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{fill}" '
           f'stroke="{stroke}" stroke-width="1.1"/>']
    total = len(lines) + (1 if sub else 0)
    ty0 = y + h / 2 - (total - 1) * 6.5 + 3.5
    for i, ln in enumerate(lines):
        out.append(
            f'<text x="{x+w/2}" y="{ty0+i*13:.1f}" font-family="{FONT}" '
            f'font-size="{fs}" font-weight="600" fill="{tc}" '
            f'text-anchor="middle">{_esc(ln)}</text>')
    if sub:
        out.append(
            f'<text x="{x+w/2}" y="{ty0+len(lines)*13:.1f}" font-family="{MONO}" '
            f'font-size="8.2" fill="{tc}" opacity="0.8" '
            f'text-anchor="middle">{_esc(sub)}</text>')
    return "".join(out)


def arrow(x1, y1, x2, y2, label=None, dashed=False, color=MUTED, curve=0,
          lab_dy=-5, lab_anchor="middle"):
    d = ' stroke-dasharray="5 3"' if dashed else ""
    mk = "arwb" if color == BRAND else "arw"
    if curve:
        mx, my = (x1 + x2) / 2 + curve, (y1 + y2) / 2
        path = f'M{x1} {y1} Q{mx} {my} {x2} {y2}'
    else:
        path = f'M{x1} {y1} L{x2} {y2}'
    s = (f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.3"{d} '
         f'marker-end="url(#{mk})"/>')
    if label:
        lx, ly = (x1 + x2) / 2 + curve * 0.6, (y1 + y2) / 2 + lab_dy
        s += (f'<text x="{lx:.1f}" y="{ly:.1f}" font-family="{FONT}" font-size="8.4" '
              f'fill="{MUTED}" text-anchor="{lab_anchor}">{_esc(label)}</text>')
    return s


def elbow(x1, y1, x2, y2, via_x=None, via_y=None, label=None, color=MUTED,
          dashed=False, lab_dy=-5):
    d = ' stroke-dasharray="5 3"' if dashed else ""
    mk = "arwb" if color == BRAND else "arw"
    if via_x is not None:
        path = f'M{x1} {y1} H{via_x} V{y2} H{x2}'
    else:
        path = f'M{x1} {y1} V{via_y} H{x2} V{y2}'
    s = (f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.3"{d} '
         f'marker-end="url(#{mk})"/>')
    if label:
        lx = via_x if via_x is not None else (x1 + x2) / 2
        ly = (y1 + y2) / 2 if via_x is not None else via_y
        s += (f'<text x="{lx:.1f}" y="{ly+lab_dy:.1f}" font-family="{FONT}" '
              f'font-size="8.4" fill="{MUTED}" text-anchor="middle">{_esc(label)}</text>')
    return s


def label(x, y, text, size=9, color=MUTED, anchor="start", weight="normal",
          mono=False):
    fam = MONO if mono else FONT
    return (f'<text x="{x}" y="{y}" font-family="{fam}" font-size="{size}" '
            f'fill="{color}" text-anchor="{anchor}" '
            f'font-weight="{weight}">{_esc(text)}</text>')


def zone(x, y, w, h, title, color="#cbd5e1", fill="none"):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="{fill}" '
            f'stroke="{color}" stroke-width="1" stroke-dasharray="6 4"/>'
            f'<text x="{x+10}" y="{y+14}" font-family="{FONT}" font-size="9" '
            f'font-weight="bold" fill="{MUTED}" letter-spacing="0.6">'
            f'{_esc(title.upper())}</text>')


def sequence(actors, steps, width=900, note_col=None, top=64, step_h=30,
             head_w=None):
    """UML-ish sequence diagram.

    actors: list of actor labels (columns, left to right)
    steps:  list of (from, to, label) or (from, to, label, style) where style is
            'dashed' (return message), 'self' (self-call) or 'note'.
    """
    n = len(actors)
    margin = 24
    span = (width - 2 * margin) / n
    xs = [margin + span * (i + 0.5) for i in range(n)]
    hw = head_w or min(150, span - 12)
    height = top + step_h * len(steps) + 34
    parts = [f'<rect x="0" y="0" width="{width}" height="{height}" fill="{PANEL}" rx="6"/>']
    for i, a in enumerate(actors):
        lines = a.split("|")
        h = 24 + (len(lines) - 1) * 11
        parts.append(
            f'<rect x="{xs[i]-hw/2:.1f}" y="16" width="{hw}" height="{h}" rx="4" '
            f'fill="{BRAND}" stroke="{BRAND}"/>')
        for k, ln in enumerate(lines):
            parts.append(
                f'<text x="{xs[i]:.1f}" y="{31+k*11}" font-family="{FONT}" '
                f'font-size="9.2" font-weight="bold" fill="#ffffff" '
                f'text-anchor="middle">{_esc(ln)}</text>')
        parts.append(
            f'<line x1="{xs[i]:.1f}" y1="{16+h}" x2="{xs[i]:.1f}" y2="{height-16}" '
            f'stroke="{LINE}" stroke-width="1" stroke-dasharray="3 3"/>')
    y = top
    for st in steps:
        frm, to, text = st[0], st[1], st[2]
        style = st[3] if len(st) > 3 else ""
        if style == "note":
            parts.append(
                f'<rect x="{xs[frm]-span/2+8:.1f}" y="{y-11}" '
                f'width="{span-16:.1f}" height="20" rx="3" fill="{ACCENT_SOFT}" '
                f'stroke="#f0d3a0"/>')
            parts.append(
                f'<text x="{xs[frm]:.1f}" y="{y+3}" font-family="{FONT}" font-size="8.4" '
                f'fill="#78350f" text-anchor="middle">{_esc(text)}</text>')
        elif frm == to:
            x = xs[frm]
            # Loop to the left for the right-hand actors so the label stays on
            # the page instead of running off the edge.
            left = frm >= n - 2
            d = -1 if left else 1
            parts.append(
                f'<path d="M{x} {y-8} h{34*d} v16 h{-34*d}" fill="none" stroke="{MUTED}" '
                f'stroke-width="1.2" marker-end="url(#arw)"/>')
            parts.append(
                f'<text x="{x+40*d}" y="{y+2}" font-family="{FONT}" font-size="8.6" '
                f'fill="{MUTED}" text-anchor="{"end" if left else "start"}">'
                f'{_esc(text)}</text>')
        else:
            d = ' stroke-dasharray="5 3"' if style == "dashed" else ""
            x1, x2 = xs[frm], xs[to]
            sgn = 1 if x2 > x1 else -1
            parts.append(
                f'<line x1="{x1+sgn*3:.1f}" y1="{y}" x2="{x2-sgn*4:.1f}" y2="{y}" '
                f'stroke="{MUTED}" stroke-width="1.2"{d} marker-end="url(#arw)"/>')
            parts.append(
                f'<text x="{(x1+x2)/2:.1f}" y="{y-5}" font-family="{FONT}" '
                f'font-size="8.6" fill="{INK}" text-anchor="middle">{_esc(text)}</text>')
        y += step_h
    return (f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'class="dia">{_defs()}{"".join(parts)}</svg>')


def svg(width, height, body, bg=PANEL):
    return (f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'class="dia">{_defs()}'
            f'<rect x="0" y="0" width="{width}" height="{height}" fill="{bg}" rx="6"/>'
            f'{body}</svg>')
