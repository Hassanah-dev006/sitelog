"""
Draws the SiteLog entity relationship diagram as an SVG.

The table and column lists here mirror src/db/migrations/. Run this after a
schema change so the diagram and the database do not drift apart.

    python3 docs/make-erd.py

Writes docs/erd.svg and docs/erd.html (open the HTML to screenshot it).
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))

GREEN = "#0f3d2e"
GREEN_MID = "#1a5c46"
INK = "#15201c"
MUTED = "#5c6b65"
LINE = "#c3d2cb"
SURFACE = "#ffffff"
BG = "#f6f8f7"
KEY = "#a8641a"

ROW_H = 17
HEAD_H = 26
PAD = 9
CHAR_W = 6.1

# name, x, y, [(column, marker)]
TABLES = [
    ("projects", 30, 40, [
        ("id", "PK"), ("code", "UK"), ("name", ""), ("client", ""),
        ("start_date", ""), ("planned_end_date", ""), ("status", "CHK"),
    ]),
    ("sites", 30, 230, [
        ("id", "PK"), ("project_id", "FK"), ("name", ""),
        ("location", ""), ("is_active", ""),
    ]),
    ("users", 30, 400, [
        ("id", "PK"), ("full_name", ""), ("email", "UK"),
        ("password_hash", ""), ("role", "CHK"), ("is_active", ""),
        ("password_changed_at", ""), ("must_change_password", ""),
    ]),
    ("site_assignments", 290, 430, [
        ("user_id", "PK FK"), ("site_id", "PK FK"), ("assigned_at", ""),
    ]),
    ("daily_reports", 540, 200, [
        ("id", "PK"), ("site_id", "FK"), ("report_date", ""),
        ("submitted_by", "FK"), ("weather", ""), ("progress_notes", ""),
        ("delays_notes", ""), ("status", "CHK"), ("client_uuid", "UK"),
        ("submitted_at", ""),
    ]),
    ("manpower_entries", 880, 30, [
        ("id", "PK"), ("report_id", "FK"), ("trade", ""),
        ("headcount", ""), ("hours_worked", ""),
    ]),
    ("equipment_entries", 880, 190, [
        ("id", "PK"), ("report_id", "FK"), ("equipment_name", ""),
        ("hours_run", ""), ("status", "CHK"),
    ]),
    ("material_entries", 880, 350, [
        ("id", "PK"), ("report_id", "FK"), ("material_name", ""),
        ("unit", ""), ("quantity_received", ""), ("quantity_used", ""),
    ]),
    ("incidents", 880, 530, [
        ("id", "PK"), ("report_id", "FK"), ("category", "CHK"),
        ("severity", "CHK"), ("description", ""),
    ]),
    ("report_photos", 880, 690, [
        ("id", "PK"), ("report_id", "FK"), ("file_path", ""),
        ("byte_size", ""), ("mime_type", ""), ("uploaded_by", "FK"),
    ]),
]

# from_table, to_table, label  (one-to-many, from the "one" side)
RELATIONS = [
    ("projects", "sites", "has"),
    ("sites", "daily_reports", "reported on"),
    ("sites", "site_assignments", "covered by"),
    ("users", "site_assignments", "assigned"),
    ("users", "daily_reports", "submits"),
    ("daily_reports", "manpower_entries", ""),
    ("daily_reports", "equipment_entries", ""),
    ("daily_reports", "material_entries", ""),
    ("daily_reports", "incidents", ""),
    ("daily_reports", "report_photos", ""),
]


def box_width(name, cols):
    longest = max([len(name)] + [len(c) + (len(m) + 2 if m else 0) for c, m in cols])
    return max(170, int(longest * CHAR_W) + PAD * 2 + 10)


def box_height(cols):
    return HEAD_H + len(cols) * ROW_H + PAD


GEOM = {}
for name, x, y, cols in TABLES:
    GEOM[name] = {
        "x": x, "y": y,
        "w": box_width(name, cols),
        "h": box_height(cols),
        "cols": cols,
    }


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def edge_points(a, b):
    """Pick sides so the line leaves one box and enters the other sensibly."""
    ga, gb = GEOM[a], GEOM[b]
    acx, acy = ga["x"] + ga["w"] / 2, ga["y"] + ga["h"] / 2
    bcx, bcy = gb["x"] + gb["w"] / 2, gb["y"] + gb["h"] / 2

    if abs(bcx - acx) >= abs(bcy - acy):
        if bcx > acx:
            return (ga["x"] + ga["w"], acy), (gb["x"], bcy)
        return (ga["x"], acy), (gb["x"] + gb["w"], bcy)
    if bcy > acy:
        return (acx, ga["y"] + ga["h"]), (bcx, gb["y"])
    return (acx, ga["y"]), (bcx, gb["y"] + gb["h"])


parts = []
W, H = 1180, 880

parts.append(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
    f'font-family="ui-monospace, SFMono-Regular, Menlo, monospace">'
)
parts.append(f'<rect width="{W}" height="{H}" fill="{BG}"/>')

parts.append(
    f'<text x="30" y="26" font-size="15" font-weight="700" fill="{GREEN}" '
    f'font-family="system-ui, sans-serif">SiteLog — Entity Relationship Diagram</text>'
)
parts.append(
    f'<text x="{W - 30}" y="26" font-size="10" fill="{MUTED}" text-anchor="end" '
    f'font-family="system-ui, sans-serif">Tihama Limited (Constructions), Kano · '
    f'generated from src/db/migrations/</text>'
)

# ---- relationship lines, drawn first so boxes sit on top ------------------
for a, b, label in RELATIONS:
    (x1, y1), (x2, y2) = edge_points(a, b)
    mx = (x1 + x2) / 2

    path = f"M {x1} {y1} C {mx} {y1}, {mx} {y2}, {x2} {y2}"
    parts.append(f'<path d="{path}" fill="none" stroke="{LINE}" stroke-width="1.6"/>')

    # "1" at the parent end, "many" at the child end
    parts.append(
        f'<text x="{x1 + (6 if x2 > x1 else -6)}" y="{y1 - 5}" font-size="10" fill="{MUTED}" '
        f'text-anchor="{"start" if x2 > x1 else "end"}">1</text>'
    )
    parts.append(
        f'<text x="{x2 + (-6 if x2 > x1 else 6)}" y="{y2 - 5}" font-size="11" fill="{MUTED}" '
        f'text-anchor="{"end" if x2 > x1 else "start"}">∞</text>'
    )
    if label:
        parts.append(
            f'<text x="{mx}" y="{(y1 + y2) / 2 - 6}" font-size="9" fill="{MUTED}" '
            f'text-anchor="middle" font-family="system-ui, sans-serif">{esc(label)}</text>'
        )

# ---- tables ---------------------------------------------------------------
for name, _, _, cols in TABLES:
    g = GEOM[name]
    x, y, w, h = g["x"], g["y"], g["w"], g["h"]

    parts.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="{SURFACE}" '
        f'stroke="{LINE}" stroke-width="1.4"/>'
    )
    parts.append(
        f'<path d="M {x} {y + HEAD_H} L {x} {y + 7} Q {x} {y} {x + 7} {y} '
        f'L {x + w - 7} {y} Q {x + w} {y} {x + w} {y + 7} L {x + w} {y + HEAD_H} Z" '
        f'fill="{GREEN}"/>'
    )
    parts.append(
        f'<text x="{x + PAD}" y="{y + 17}" font-size="11.5" font-weight="700" fill="#fff">'
        f'{esc(name)}</text>'
    )

    for i, (col, marker) in enumerate(cols):
        ty = y + HEAD_H + (i + 1) * ROW_H - 4
        is_key = marker in ("PK", "UK") or "PK" in marker
        weight = ' font-weight="700"' if is_key else ""
        colour = INK if is_key else MUTED
        parts.append(
            f'<text x="{x + PAD}" y="{ty}" font-size="10.5" fill="{colour}"{weight}>'
            f'{esc(col)}</text>'
        )
        if marker:
            parts.append(
                f'<text x="{x + w - PAD}" y="{ty}" font-size="8.5" fill="{KEY}" '
                f'text-anchor="end" font-weight="700">{esc(marker)}</text>'
            )

# ---- legend ---------------------------------------------------------------
ly = H - 42
parts.append(
    f'<text x="30" y="{ly}" font-size="10" fill="{MUTED}" font-family="system-ui, sans-serif">'
    f'<tspan font-weight="700" fill="{KEY}">PK</tspan> primary key  ·  '
    f'<tspan font-weight="700" fill="{KEY}">FK</tspan> foreign key  ·  '
    f'<tspan font-weight="700" fill="{KEY}">UK</tspan> unique  ·  '
    f'<tspan font-weight="700" fill="{KEY}">CHK</tspan> check constraint  ·  '
    f'1 → ∞ one-to-many</text>'
)
parts.append(
    f'<text x="30" y="{ly + 16}" font-size="10" fill="{MUTED}" '
    f'font-family="system-ui, sans-serif">'
    f'One report per site per day: UNIQUE (site_id, report_date).  '
    f'client_uuid is set by the phone and reused on retry, so a resent report is stored once.'
    f'</text>'
)

parts.append("</svg>")
svg = "\n".join(parts)

with open(os.path.join(HERE, "erd.svg"), "w") as f:
    f.write(svg)

html = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    "<title>SiteLog ERD</title>"
    f"<style>body{{margin:0;background:{BG};}}svg{{display:block;max-width:100%;}}</style>"
    f"</head><body>{svg}</body></html>"
)
with open(os.path.join(HERE, "erd.html"), "w") as f:
    f.write(html)

print("Wrote docs/erd.svg and docs/erd.html")

# A PNG as well, because Excel cannot embed an SVG and most places that ask
# for "an image" mean a raster one. Scale 2 keeps the small type readable.
try:
    import cairosvg

    cairosvg.svg2png(
        url=os.path.join(HERE, "erd.svg"),
        write_to=os.path.join(HERE, "erd.png"),
        scale=2,
        background_color=BG,
    )
    print("Wrote docs/erd.png")
except ImportError:
    print("\nSkipped the PNG: cairosvg is not installed.")
    print("  pip3 install cairosvg --break-system-packages")
    print("Or just open docs/erd.html and screenshot it.")
except Exception as err:
    print(f"\nCould not write the PNG ({err}). Open docs/erd.html and screenshot it instead.")

print(f"{len(TABLES)} tables, {len(RELATIONS)} relationships")
