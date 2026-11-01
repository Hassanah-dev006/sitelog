"""
Generates every diagram and title card for the artefact documentary.

    python3 docs/make-video-assets.py

Writes PNGs to docs/video/ at 1920x1080, which is what a 1080p timeline
expects. Drop them straight into CapCut, iMovie or DaVinci Resolve.

Needs cairosvg:  pip3 install cairosvg --break-system-packages
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "video")
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080

GREEN = "#0f3d2e"
GREEN_MID = "#1a5c46"
GREEN_PALE = "#e7f5ed"
INK = "#15201c"
MUTED = "#5c6b65"
LINE = "#c3d2cb"
BG = "#f6f8f7"
SURFACE = "#ffffff"
RED = "#a3241c"
RED_PALE = "#fdecea"
AMBER = "#c97a10"
AMBER_PALE = "#fff4e0"

SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size=28, fill=INK, anchor="start", weight="400", font=SANS, opacity=1):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" font-family="{font}" '
            f'opacity="{opacity}">{esc(s)}</text>')


def wrapped(x, y, s, width_chars, size=26, fill=MUTED, line_height=1.45,
            anchor="start", weight="400"):
    """Very simple greedy wrap — enough for short diagram labels."""
    words = s.split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if len(trial) <= width_chars:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)

    out = []
    for i, line in enumerate(lines):
        out.append(text(x, y + i * size * line_height, line, size, fill, anchor, weight))
    return "".join(out), len(lines)


def box(x, y, w, h, fill=SURFACE, stroke=LINE, rx=14, width=2):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')


def arrow(x1, y1, x2, y2, colour=LINE, width=3, dashed=False):
    dash = ' stroke-dasharray="10 8"' if dashed else ""
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{colour}" '
            f'stroke-width="{width}" marker-end="url(#arrow)"{dash}/>')


def svg(body, bg=BG):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{W}" height="{H}">'
        f'<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{LINE}"/></marker></defs>'
        f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        f"{body}</svg>"
    )


def write(name, markup):
    path_svg = os.path.join(OUT, f"{name}.svg")
    with open(path_svg, "w") as f:
        f.write(markup)

    try:
        import cairosvg
        cairosvg.svg2png(url=path_svg, write_to=os.path.join(OUT, f"{name}.png"),
                         output_width=W, output_height=H)
        print(f"  {name}.png")
    except ImportError:
        print(f"  {name}.svg  (install cairosvg for a PNG)")
    except Exception as err:
        print(f"  {name}.svg  (PNG failed: {err})")


# ---------------------------------------------------------------------------
# 1. The problem — how reporting works today
# ---------------------------------------------------------------------------
def as_is_process():
    p = [text(120, 120, "How site reporting works today", 52, GREEN, weight="700")]
    p.append(text(120, 172, "Tihama Limited — before SiteLog", 28, MUTED))

    steps = [
        ("Supervisor", "writes the day's\nreport on paper", "6pm, on site"),
        ("Site office", "collects it when\nsomeone passes", "next day, maybe"),
        ("Head office", "receives paper\nor a message", "days later"),
        ("Compiled", "typed up by hand\ninto a summary", "end of month"),
    ]

    bw, bh, gap = 360, 230, 60
    total = len(steps) * bw + (len(steps) - 1) * gap
    x0 = (W - total) / 2
    y = 330

    for i, (title, body, when) in enumerate(steps):
        x = x0 + i * (bw + gap)
        p.append(box(x, y, bw, bh))
        p.append(text(x + 30, y + 58, title, 34, INK, weight="700"))
        for j, line in enumerate(body.split("\n")):
            p.append(text(x + 30, y + 104 + j * 32, line, 25, MUTED))
        p.append(box(x + 30, y + bh - 62, bw - 60, 40, RED_PALE, RED_PALE, 8, 0))
        p.append(text(x + bw / 2, y + bh - 35, when, 23, RED, "middle", "600"))

        if i < len(steps) - 1:
            p.append(arrow(x + bw + 12, y + bh / 2, x + bw + gap - 12, y + bh / 2))

    # The consequence
    p.append(box(x0, 650, total, 150, RED_PALE, RED, 14, 3))
    p.append(text(W / 2, 712, "A site can go quiet for three weeks",
                  42, RED, "middle", "700"))
    p.append(text(W / 2, 762, "and nobody at head office notices until the month is closed.",
                  28, RED, "middle"))

    write("01-problem-today", svg("".join(p)))


# ---------------------------------------------------------------------------
# 2. The solution — how it works now
# ---------------------------------------------------------------------------
def to_be_process():
    p = [text(120, 120, "How it works with SiteLog", 52, GREEN, weight="700")]
    p.append(text(120, 172, "Same supervisor, same six o'clock", 28, MUTED))

    steps = [
        ("Supervisor", "fills in the report\non a phone", "2 minutes"),
        ("Saved on phone", "kept safely even\nwith no signal", "instant"),
        ("Sent by itself", "when the connection\nreturns", "automatic"),
        ("Head office", "sees it on the\ndashboard", "same evening"),
    ]

    bw, bh, gap = 360, 230, 60
    total = len(steps) * bw + (len(steps) - 1) * gap
    x0 = (W - total) / 2
    y = 330

    for i, (title, body, when) in enumerate(steps):
        x = x0 + i * (bw + gap)
        highlight = i in (1, 2)
        p.append(box(x, y, bw, bh, SURFACE, AMBER if highlight else LINE, 14,
                     3 if highlight else 2))
        p.append(text(x + 30, y + 58, title, 34, INK, weight="700"))
        for j, line in enumerate(body.split("\n")):
            p.append(text(x + 30, y + 104 + j * 32, line, 25, MUTED))
        pale = AMBER_PALE if highlight else GREEN_PALE
        col = AMBER if highlight else GREEN
        p.append(box(x + 30, y + bh - 62, bw - 60, 40, pale, pale, 8, 0))
        p.append(text(x + bw / 2, y + bh - 35, when, 23, col, "middle", "600"))

        if i < len(steps) - 1:
            p.append(arrow(x + bw + 12, y + bh / 2, x + bw + gap - 12, y + bh / 2))

    p.append(text(W / 2, 630, "The two highlighted steps are the ones that make it work "
                  "where the network does not.", 26, MUTED, "middle"))

    p.append(box(x0, 680, total, 150, GREEN_PALE, GREEN, 14, 3))
    p.append(text(W / 2, 742, "Head office knows the same evening",
                  42, GREEN, "middle", "700"))
    p.append(text(W / 2, 792, "and the dashboard names any site that has not reported today.",
                  28, GREEN, "middle"))

    write("02-solution-now", svg("".join(p)))


# ---------------------------------------------------------------------------
# 3. Architecture
# ---------------------------------------------------------------------------
def architecture():
    p = [text(120, 120, "How SiteLog is built", 52, GREEN, weight="700")]
    p.append(text(120, 172, "One deployed service, one hosted database", 28, MUTED))

    # Devices
    p.append(box(130, 300, 330, 300))
    p.append(text(160, 356, "On a phone", 34, INK, weight="700"))
    p.append(text(160, 404, "React, mobile first", 25, MUTED))
    p.append(text(160, 440, "Outbox in browser", 25, MUTED))
    p.append(text(160, 476, "storage", 25, MUTED))
    p.append(box(160, 510, 270, 54, AMBER_PALE, AMBER_PALE, 8, 0))
    p.append(text(295, 545, "works offline", 25, AMBER, "middle", "700"))

    # Render
    p.append(box(640, 270, 480, 360, SURFACE, GREEN, 14, 3))
    p.append(text(670, 326, "Render", 34, GREEN, weight="700"))
    p.append(text(670, 366, "one web service, Frankfurt", 23, MUTED))

    p.append(box(670, 400, 420, 90, BG, LINE, 10, 2))
    p.append(text(692, 442, "Express API", 28, INK, weight="600"))
    p.append(text(692, 472, "auth, reports, dashboard, exports", 22, MUTED))

    p.append(box(670, 505, 420, 90, BG, LINE, 10, 2))
    p.append(text(692, 547, "Built React app", 28, INK, weight="600"))
    p.append(text(692, 577, "served from the same origin", 22, MUTED))

    # Neon
    p.append(box(1300, 300, 400, 300))
    p.append(text(1330, 356, "Neon", 34, INK, weight="700"))
    p.append(text(1330, 396, "managed PostgreSQL", 25, MUTED))
    p.append(text(1330, 432, "Frankfurt", 25, MUTED))
    p.append(box(1330, 466, 340, 54, GREEN_PALE, GREEN_PALE, 8, 0))
    p.append(text(1500, 501, "10 tables", 25, GREEN, "middle", "700"))
    p.append(text(1330, 560, "TLS on every connection", 22, MUTED))

    p.append(arrow(470, 450, 630, 450))
    p.append(text(550, 428, "HTTPS", 22, MUTED, "middle"))
    p.append(arrow(1130, 450, 1290, 450))
    p.append(text(1210, 428, "SQL", 22, MUTED, "middle"))

    p.append(box(130, 700, 1570, 130, SURFACE, LINE, 14, 2))
    p.append(text(165, 752, "Chosen for who maintains it in December, not for what is newest.",
                  32, INK, weight="600"))
    p.append(text(165, 796, "No ORM, no CSS framework, no charting library — a small "
                  "dependency list the IT team can read.", 25, MUTED))

    write("03-architecture", svg("".join(p)))


# ---------------------------------------------------------------------------
# 4. The offline flow — the heart of the project
# ---------------------------------------------------------------------------
def offline_flow():
    p = [text(120, 110, "What happens when there is no signal", 52, GREEN, weight="700")]
    p.append(text(120, 162, "The sequence that makes SiteLog usable on a real site", 28, MUTED))

    rows = [
        ("1", "Supervisor presses Send", "The report is written to the phone first, "
         "before any network call.", GREEN),
        ("2", "No connection", "The app says so plainly: saved on this phone, it will send "
         "by itself.", AMBER),
        ("3", "The phone keeps trying", "Each attempt reuses the same identifier, generated "
         "once when Send was pressed.", AMBER),
        ("4", "Signal returns", "The queue sends itself. Nobody has to remember to do "
         "anything.", GREEN),
        ("5", "Stored exactly once", "The database refuses a repeat of that identifier. "
         "Three sends, one record.", GREEN),
    ]

    y = 260
    for num, title, body, colour in rows:
        p.append(box(150, y, 1620, 118, SURFACE, LINE, 12, 2))
        p.append(f'<circle cx="212" cy="{y + 59}" r="32" fill="{colour}"/>')
        p.append(text(212, y + 72, num, 34, "#ffffff", "middle", "700"))
        p.append(text(276, y + 48, title, 32, INK, weight="700"))
        p.append(text(276, y + 88, body, 25, MUTED))
        y += 136

    p.append(box(150, y + 10, 1620, 110, GREEN_PALE, GREEN, 14, 3))
    p.append(text(W / 2, y + 62, "A report sent three times from a failing connection",
                  32, GREEN, "middle", "600"))
    p.append(text(W / 2, y + 102, "is stored once.", 32, GREEN, "middle", "700"))

    write("04-offline-flow", svg("".join(p)))


# ---------------------------------------------------------------------------
# 5. What testing found
# ---------------------------------------------------------------------------
def testing_found():
    p = [text(120, 120, "What the tests missed", 52, GREEN, weight="700")]
    p.append(text(120, 172, "Three faults found by deploying it and using it", 28, MUTED))

    faults = [
        ("The export that would not download",
         "A plain link is a browser navigation, so no JavaScript runs and the login token "
         "is never attached. The server was right to refuse."),
        ("The site number nobody could know",
         "Supervisors cannot list projects, so the form quietly fell back to asking them to "
         "type a site id they had no way of finding."),
        ("The script that wrote NaN and said it worked",
         "The same flag meant a site id in one script and a site name in another. It did not "
         "crash — it stored nonsense and reported success."),
    ]

    y = 300
    for title, body in faults:
        p.append(box(150, y, 1620, 160, SURFACE, RED, 12, 3))
        p.append(text(190, y + 56, title, 34, RED, weight="700"))
        lines, _ = wrapped(190, y + 102, body, 95, 25, MUTED)
        p.append(lines)
        y += 186

    p.append(box(150, y + 10, 1620, 120, SURFACE, LINE, 14, 2))
    p.append(text(W / 2, y + 60, "All three passed 228 automated tests.",
                  34, INK, "middle", "700"))
    p.append(text(W / 2, y + 102, "None survived contact with a real user.",
                  28, MUTED, "middle"))

    write("05-testing-found", svg("".join(p)))


# ---------------------------------------------------------------------------
# 6. The numbers
# ---------------------------------------------------------------------------
def numbers():
    p = [text(120, 120, "SiteLog in numbers", 52, GREEN, weight="700")]
    p.append(text(120, 172, "Eleven weeks, Tihama Limited", 28, MUTED))

    stats = [
        ("228", "automated tests"),
        ("11", "weeks"),
        ("10", "database tables"),
        ("297", "hours"),
        ("4.8 MB → 300 KB", "photo compression"),
        ("1.2 KB", "added by the whole dashboard"),
    ]

    bw, bh = 500, 200
    gx, gy = 60, 50
    x0 = (W - (3 * bw + 2 * gx)) / 2
    y0 = 300

    for i, (big, label) in enumerate(stats):
        col, row = i % 3, i // 3
        x = x0 + col * (bw + gx)
        y = y0 + row * (bh + gy)
        p.append(box(x, y, bw, bh))
        size = 76 if len(big) <= 4 else 46
        p.append(text(x + bw / 2, y + 100, big, size, GREEN, "middle", "700"))
        p.append(text(x + bw / 2, y + 152, label, 26, MUTED, "middle"))

    p.append(text(W / 2, 880, "Source: the project's own test suite, commit history and build output.",
                  24, MUTED, "middle"))

    write("06-numbers", svg("".join(p)))


# ---------------------------------------------------------------------------
# 7. Title cards
# ---------------------------------------------------------------------------
def title_cards():
    cards = [
        ("00-title", "SiteLog", "Daily site reporting for Tihama Limited",
         "Hassanat Ajoke Bello  ·  Skills Immersion 1"),
        ("10-card-problem", "The Problem", "Paper reports, days late", None),
        ("11-card-research", "The Research", "Asking the people who do the reporting", None),
        ("12-card-build", "The Build", "Eleven weeks", None),
        ("13-card-offline", "Working Offline", "The part that mattered most", None),
        ("14-card-testing", "What Testing Found", "Three faults the tests missed", None),
        ("15-card-mission", "What It Changed", None, None),
    ]

    for name, big, sub, byline in cards:
        p = []
        p.append(text(W / 2, H / 2 - (40 if sub else 0), big, 110, "#ffffff",
                      "middle", "700"))
        if sub:
            p.append(text(W / 2, H / 2 + 50, sub, 36, "#ffffff", "middle",
                          opacity=0.82))
        if byline:
            p.append(text(W / 2, H / 2 + 130, byline, 28, "#ffffff", "middle",
                          opacity=0.68))
        # A quiet rule ABOVE the title. The text baseline sits at H/2, and a
        # 110px face rises about 80px from it, so the rule has to clear that
        # or it strikes straight through the words.
        rule_y = H / 2 - (40 if sub else 0) - 112
        p.append(f'<rect x="{W / 2 - 60}" y="{rule_y}" '
                 f'width="120" height="5" rx="2" fill="#ffffff" opacity="0.5"/>')
        write(name, svg("".join(p), bg=GREEN))


def credits():
    p = []
    left = 420
    y = 200
    p.append(text(left, y, "SiteLog", 64, "#ffffff", weight="700"))
    p.append(text(left, y + 56, "Artefact Documentary", 30, "#ffffff", opacity=0.75))

    y += 150
    lines = [
        ("Hassanat Ajoke Bello", 34, "700", 1),
        ("BSc Software Engineering", 26, "400", 0.8),
        ("Skills Immersion 1  ·  September 2026 Term", 26, "400", 0.8),
        ("African Leadership University", 26, "400", 0.8),
        ("", 20, "400", 1),
        ("Internship host", 24, "600", 0.95),
        ("Tihama Limited (Constructions), Kano, Nigeria", 26, "400", 0.8),
        ("", 16, "400", 1),
        ("Supervisor", 24, "600", 0.95),
        ("Muhammad Umar, IT Manager", 26, "400", 0.8),
    ]
    for s, size, weight, op in lines:
        if s:
            p.append(text(left, y, s, size, "#ffffff", weight=weight, opacity=op))
        y += size * 1.6

    rx = 1080
    ry = 350
    p.append(text(rx, ry, "References", 28, "#ffffff", weight="600", opacity=0.95))
    refs = [
        "DataReportal. (2026). Digital 2026: Nigeria.",
        "    https://datareportal.com/reports/digital-2026-nigeria",
        "",
        "STL Partners. (2025). Delays in data centre",
        "    construction [Press release].",
        "    https://stlpartners.com/press/",
        "    delays-in-data-centre-construction/",
    ]
    ry += 50
    for line in refs:
        if line:
            p.append(text(rx, ry, line, 22, "#ffffff", font=MONO, opacity=0.72))
        ry += 34

    write("99-credits", svg("".join(p), bg=GREEN))


as_is_process()
to_be_process()
architecture()
offline_flow()
testing_found()
numbers()
title_cards()
credits()

print(f"\nWritten to {OUT}")
