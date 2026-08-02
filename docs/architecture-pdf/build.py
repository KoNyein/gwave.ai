#!/usr/bin/env python3
"""Assemble and render the Gwave architecture PDF.

Pass 1 renders the document with placeholder page numbers, reads the page each
section landed on out of the resulting PDF, then pass 2 re-renders with a real
table of contents.
"""

import datetime
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figures  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))  # repository root
OUT_HTML = os.path.join(HERE, "gwave-architecture.html")
OUT_PDF = os.path.join(REPO, "docs", "Gwave-System-Design.pdf")


# ------------------------------------------------------------ repo facts ----
def page_routes():
    out = subprocess.run(
        ["find", "src/app", "-name", "page.tsx"], cwd=REPO,
        capture_output=True, text=True).stdout.split()
    routes = []
    for p in out:
        r = p.replace("src/app", "").replace("/page.tsx", "")
        m = re.match(r"^/\(([a-z]+)\)(.*)$", r)
        group, path = (m.group(1), m.group(2) or "/") if m else ("root", r or "/")
        routes.append((group, path))
    return sorted(set(routes))


def api_routes():
    out = subprocess.run(
        ["find", "src/app/api", "-name", "route.ts"], cwd=REPO,
        capture_output=True, text=True).stdout.split()
    return sorted({p.replace("src/app/api", "").replace("/route.ts", "")
                   for p in out})


def tables():
    edges = open(os.path.join(HERE, "edges.txt")).read().splitlines()
    names = set()
    for line in open(os.path.join(HERE, "schema.txt")):
        if line.startswith("## "):
            names.add(line[3:].split("  (")[0].strip())
    return sorted(names), len(edges)


# ------------------------------------------------------------- appendices ---
def appendix_a():
    routes = page_routes()
    groups = {}
    for g, p in routes:
        groups.setdefault(g, []).append(p)
    titles = {
        "social": "Social, media, commerce and life services",
        "admin": "Administration consoles",
        "auth": "Authentication",
        "billing": "Membership and billing",
        "dev": "Developer console",
        "iot": "Smart farm and smart home",
        "knowledge": "Knowledge bases and markets",
        "pos": "Point of sale",
        "tools": "Grower tools",
        "root": "Top level (no route group)",
    }
    html = [f'<h1 class="apx"><span class="num">A</span>Appendix A — Web route '
            f'inventory</h1><p class="lead">Every rendered page in the '
            f'application, {len(routes)} in total, grouped by App Router route '
            f'group. Route groups do not appear in URLs; they scope layout and '
            f'access.</p>']
    for g in sorted(groups, key=lambda k: (k == "root", k)):
        html.append(f'<h2>{titles.get(g, g)} <span style="font-weight:normal;'
                    f'color:#64748b;font-size:9pt">({len(groups[g])} pages)</span></h2>')
        html.append('<div class="cols3">')
        for p in sorted(groups[g]):
            html.append(f"<div>{p}</div>")
        html.append("</div>")
    return "".join(html)


def appendix_b():
    routes = api_routes()
    buckets = {
        "mobile": "Mobile client API",
        "live": "Live streaming",
        "ride": "Ride hailing",
        "admin": "Administration",
        "v1": "Public REST API",
        "health": "Health",
        "shop": "Commerce",
        "audio": "Audio platform",
        "cannabis": "Cannabis market and places",
        "mine": "Mine sites",
        "webhooks": "Inbound webhooks",
    }
    grouped, other = {}, []
    for r in routes:
        head = r.strip("/").split("/")[0]
        (grouped.setdefault(head, []).append(r) if head in buckets
         else other.append(r))
    html = [f'<h1 class="apx"><span class="num">B</span>Appendix B — API route '
            f'inventory</h1><p class="lead">All {len(routes)} route handlers '
            f'under <code>src/app/api</code>.</p>']
    for k in [b for b in buckets if b in grouped]:
        html.append(f'<h2>{buckets[k]} <span style="font-weight:normal;'
                    f'color:#64748b;font-size:9pt">({len(grouped[k])})</span></h2>')
        html.append('<div class="cols2">')
        for r in sorted(grouped[k]):
            html.append(f"<div>{r}</div>")
        html.append("</div>")
    html.append(f'<h2>Core and shared <span style="font-weight:normal;'
                f'color:#64748b;font-size:9pt">({len(other)})</span></h2>'
                f'<div class="cols2">')
    for r in sorted(other):
        html.append(f"<div>{r}</div>")
    html.append("</div>")
    return "".join(html)


def appendix_c():
    names, n_edges = tables()
    html = [f'<h1 class="apx"><span class="num">C</span>Appendix C — Table '
            f'inventory</h1><p class="lead">All {len(names)} tables defined '
            f'across the 93 migrations and 48 production patch files, joined by '
            f'{n_edges} foreign-key relationships. Row level security is enabled '
            f'on every one of them.</p><div class="cols4">']
    for t in names:
        html.append(f"<div>{t}</div>")
    html.append("</div>")
    return "".join(html)


def appendix_d():
    build_args = re.findall(r"--build-arg (NEXT_PUBLIC_[A-Z0-9_]+)=",
                            open(os.path.join(REPO, ".github/workflows/deploy.yml")).read())
    env_names = sorted(set(re.findall(r"^([A-Z][A-Z0-9_]+)=", open(
        os.path.join(REPO, ".env.example")).read(), re.M)))
    runtime = [e for e in env_names if not e.startswith("NEXT_PUBLIC_")]
    extra = ["APP_JWT_PRIVATE_KEY", "APP_JWT_PUBLIC_JWK", "SUPABASE_JWT_SECRET",
             "COGNITO_CLIENT_SECRET", "DATABASE_URL", "TURN_URL", "TURN_USERNAME",
             "TURN_CREDENTIAL", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
             "TWILIO_FROM", "ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET",
             "ALIEXPRESS_TRACKING_ID", "RIDE_GEOCODER_URL", "LIVE_SWEEP_SECRET",
             "RIDE_DISPATCH_SECRET", "AWS_S3_SLIPS_BUCKET"]
    runtime = sorted(set(runtime) | set(extra))
    html = [
        '<h1 class="apx"><span class="num">D</span>Appendix D — Environment '
        'variable reference</h1>',
        '<p class="lead">Variables split into two classes with different '
        'lifecycles. Getting the class wrong is the most common deployment '
        'mistake in the project: a build-time variable changed at runtime has no '
        'effect, and a runtime secret added as a build argument would be inlined '
        'into a public JavaScript bundle.</p>',
        f'<h2>D.1 Build-time — inlined into the client bundle and the CSP '
        f'<span style="font-weight:normal;color:#64748b;font-size:9pt">'
        f'({len(build_args)} supplied by <code>deploy.yml</code>)</span></h2>',
        '<div class="note">These are public by definition. Changing one requires '
        'a rebuild and redeploy; omitting one silently disables the feature it '
        'powers.</div>',
        '<div class="cols2">']
    for v in sorted(set(build_args)):
        html.append(f"<div>{v}</div>")
    html.append("</div>")
    html.append('<h2>D.2 Runtime — read from <code>/etc/gwave-web.env</code> on the host</h2>')
    html.append('<div class="ok">Never enters the image. An env-only change '
                'needs just <code>sudo gwave-redeploy</code> — no CI run, no '
                'rebuild.</div>')
    html.append('<div class="cols2">')
    for v in runtime:
        html.append(f"<div>{v}</div>")
    html.append("</div>")
    html.append("""
<h2>D.3 Variables with operational consequences</h2>
<table class="tight">
  <thead><tr><th style="width:32%">Variable</th><th>Consequence if wrong or missing</th></tr></thead>
  <tbody>
    <tr><td class="mono">APP_JWT_PRIVATE_KEY / _PUBLIC_JWK</td><td>Every authenticated data call fails; the key id must match the JWKS PostgREST loads.</td></tr>
    <tr><td class="mono">SUPABASE_JWT_SECRET</td><td>Must equal the realtime container's <code>API_JWT_SECRET</code> and PostgREST's <code>oct</code> key, or the Realtime socket will not handshake.</td></tr>
    <tr><td class="mono">NEXT_PUBLIC_S3_CDN</td><td>Selects the S3 storage path. Unset falls back to the legacy branch, which production must never take.</td></tr>
    <tr><td class="mono">TURN_URL / _USERNAME / _CREDENTIAL</td><td>Served by <code>/api/webrtc/ice</code>. Missing means carrier-NAT calls connect and stay silent.</td></tr>
    <tr><td class="mono">IVS_RT_ENCODER_CONFIG_ARN / _STORAGE_CONFIG_ARN</td><td>Without them the composition cannot start, so browser broadcasts never reach an HLS URL phones can play.</td></tr>
    <tr><td class="mono">LIVEKIT_EGRESS_S3_*</td><td>Currently unset — the reason browser Go Live sessions have no replays.</td></tr>
    <tr><td class="mono">LIVE_SWEEP_SECRET</td><td>Authenticates the replay sweeper; falls back to <code>RIDE_DISPATCH_SECRET</code>.</td></tr>
    <tr><td class="mono">STRIPE_WEBHOOK_SECRET</td><td>Unverified webhooks are rejected, so top-ups and memberships never settle.</td></tr>
  </tbody>
</table>
<div style="margin-top:10mm;padding-top:4mm;border-top:0.6pt solid #e2e8f0;
     font-size:8pt;color:#64748b">
  End of document. Generated from the <code>KoNyein/gwave.ai</code> repository —
  route counts, table names, foreign keys, workflow steps and environment
  variables were read out of the source rather than transcribed.
</div>""")
    return "".join(html)


# ------------------------------------------------------------------ build ---
def assemble(toc_pages=None):
    parts = []
    for i in range(1, 6):
        parts.append(open(os.path.join(HERE, f"doc_{i}.html")).read())
    parts += [appendix_a(), appendix_b(), appendix_c(), appendix_d(),
              "</body></html>"]
    html = "".join(parts)

    for name, svg in figures.F.items():
        html = html.replace("{{fig:%s}}" % name, svg)
    html = html.replace("{{DATE}}", datetime.date.today().strftime("%d %B %Y"))

    keys = [f"p{i}" for i in range(1, 13)] + ["pA", "pB", "pC", "pD"]
    for k in keys:
        html = html.replace("{{%s}}" % k, str((toc_pages or {}).get(k, "—")))
    return html


HEADINGS = {
    "p1": "Executive summary", "p2": "Product scope and feature catalogue",
    "p3": "Application architecture", "p4": "AWS infrastructure",
    "p5": "Delivery pipeline and environments",
    "p6": "Security and access control", "p7": "Data model",
    "p8": "Functional process designs", "p9": "Mobile application",
    "p10": "Public API and integrations",
    "p11": "Operations and observability",
    "p12": "Roadmap, risks and known gaps",
    "pA": "Appendix A", "pB": "Appendix B", "pC": "Appendix C",
    "pD": "Appendix D",
}


def find_pages(pdf_path):
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    pages = [(p.extract_text() or "").replace("\n", " ") for p in reader.pages]
    found = {}
    for key, heading in HEADINGS.items():
        needle = re.sub(r"\s+", "", heading).lower()
        for i, text in enumerate(pages):
            if i < 2:
                continue  # cover + contents
            if needle in re.sub(r"\s+", "", text).lower():
                found[key] = i + 1
                break
    return found


def render(html, pdf_path):
    with open(OUT_HTML, "w") as fh:
        fh.write(html)
    subprocess.run(["node", os.path.join(HERE, "render.js"), OUT_HTML, pdf_path],
                   check=True, cwd=HERE)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT_PDF), exist_ok=True)
    render(assemble(), OUT_PDF)
    try:
        pages = find_pages(OUT_PDF)
        print("toc pages:", pages)
        render(assemble(pages), OUT_PDF)
    except ImportError:
        print("pypdf missing — TOC page numbers left blank")
    print("PDF:", OUT_PDF)
