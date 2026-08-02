# Architecture PDF generator

Builds `docs/Gwave-System-Design.pdf` — the 47-page system design and
architecture document (project plan, feature catalogue, AWS topology,
flowcharts, ER diagrams, process designs, route/table/env appendices).

```bash
python3 docs/architecture-pdf/build.py
```

Requirements: `pypdf` (for the table-of-contents page numbers) and a Chromium
that Playwright can launch. Set `CHROMIUM_PATH` if Playwright's bundled browser
version does not match the one installed.

## Layout

| File | Contents |
| --- | --- |
| `build.py` | Assembles the parts, generates the appendices from the live repository (route lists, table list, env vars), renders twice — once to discover page numbers, once with a real table of contents. |
| `doc_1.html` … `doc_5.html` | Prose: cover and §1–2, §3–4, §5, §6–7, §8–12. Figures are referenced as `{{fig:name}}` placeholders. |
| `figures.py` | Every figure in the document, built as inline SVG. |
| `diagrams.py` | Drawing primitives: entity cards, ER layouts, flow nodes, arrows, sequence diagrams. |
| `render.js` | Playwright/Chromium print-to-PDF with the running header and footer. |
| `schema.txt`, `edges.txt` | Extracted table columns and foreign keys, used by Appendix C. Regenerate them from `supabase/migrations/` and `db/sql/` when the schema changes materially. |

Appendices A, B and D read the repository at build time, so route counts and
environment variables stay correct without editing prose. Everything else is
written text and needs updating by hand when the system changes.
