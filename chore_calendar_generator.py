#!/usr/bin/env python3
# Usage: python chore_calendar_generator.py config.json output.pdf
import sys, json, calendar
from datetime import date, timedelta
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch

def hex_to_rgb(hexstr):
    hexstr = hexstr.lstrip("#")
    return tuple(int(hexstr[i:i+2], 16)/255.0 for i in (0,2,4))

def weekly_dates_on_or_after(anchor, weekdays, end_date):
    out = []
    for w in weekdays:
        delta = (w - anchor.weekday()) % 7
        first = anchor + timedelta(days=delta)
        d = first
        while d <= end_date:
            out.append(d)
            d += timedelta(days=7)
    return sorted(out)

def month_span(year, month):
    _, nd = calendar.monthrange(year, month)
    return date(year, month, 1), date(year, month, nd)

def main():
    cfg_path, out_path = "config.json", "chore_calendar.pdf"
    with open(cfg_path, "r") as f:
        cfg = json.load(f)

    YEAR = int(cfg["year"]); MONTH = int(cfg["month"])
    ANCHOR = date.fromisoformat(cfg["anchor_date"])

    # People + colors
    person_colors = {}
    for p in cfg["people"]:
        r,g,b = hex_to_rgb(p["color"])
        person_colors[p["name"]] = colors.Color(r,g,b)

    rotations = cfg["rotations"]
    rules = cfg["rules"]
    start_person = cfg.get("start_person", {})
    sunday_first = bool(cfg.get("sunday_first", True))
    title = cfg.get("title", f"Chore Calendar — {calendar.month_name[MONTH]} {YEAR}")

    _, m_end = month_span(YEAR, MONTH)

    # Build due_map
    due_map = {}
    for chore, rule in rules.items():
        R = rotations[chore]
        sp = start_person.get(chore, R[0])
        start_idx = R.index(sp) if sp in R else 0
        dates = []

        if "weekly_on" in rule:
            dates = [d for d in weekly_dates_on_or_after(ANCHOR, rule["weekly_on"], m_end) if d.month == MONTH]
        elif "every_n_days" in rule:
            n = int(rule["every_n_days"])
            d = ANCHOR
            while d <= m_end:
                if d.month == MONTH:
                    dates.append(d)
                d += timedelta(days=n)

        for occ_idx, d in enumerate(sorted(dates)):
            due_map.setdefault(d, []).append((chore, R[(start_idx + occ_idx) % len(R)]))

    # Render
    width, height = landscape(letter)
    c = canvas.Canvas(out_path, pagesize=(width, height))

    margin = 0.5 * inch
    grid_width = width - 2 * margin
    grid_height = height - 2 * margin

    firstweekday = 6 if sunday_first else 0
    cal = calendar.Calendar(firstweekday=firstweekday)
    weeks = cal.monthdayscalendar(YEAR, MONTH)
    cell_w = grid_width / 7
    cell_h = grid_height / (len(weeks) + 2)

    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - margin + 0.12 * inch, f"{title} — {calendar.month_name[MONTH]} {YEAR}")

    headers = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] if sunday_first else ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    c.setFont("Helvetica-Bold", 12)
    for i, wd in enumerate(headers):
        x = margin + i * cell_w
        y = height - margin - cell_h
        c.setFillColor(colors.whitesmoke); c.rect(x, y, cell_w, cell_h, stroke=1, fill=1)
        c.setFillColor(colors.black); c.drawCentredString(x + cell_w/2, y + cell_h/2 - 4, wd)

    start_y = height - margin - 2 * cell_h
    for r, week in enumerate(weeks):
        for i, day in enumerate(week):
            x = margin + i * cell_w
            y = start_y - r * cell_h
            c.setFillColor(colors.white); c.rect(x, y, cell_w, cell_h, stroke=1, fill=1)
            if day != 0:
                d = date(YEAR, MONTH, day)
                c.setFillColor(colors.black); c.setFont("Helvetica-Bold", 11)
                c.drawString(x + 4, y + cell_h - 14, f"{day}")
                # Sort ALPHABETICALLY by chore name
                items = sorted(due_map.get(d, []), key=lambda t: t[0].lower())
                pill_h = 12; pad = 3; py = y + cell_h - 28
                for (chore_name, person) in items:
                    col = person_colors.get(person, colors.lightgrey)
                    if py - pill_h < y + 2:
                        c.setFillColor(colors.black); c.setFont("Helvetica", 8)
                        c.drawString(x + 4, y + 2, f"+{len(items)} more")
                        break
                    c.setFillColor(col); c.roundRect(x + 3, py - pill_h + 2, cell_w - 6, pill_h, 4, stroke=0, fill=1)
                    c.setFillColor(colors.black); c.setFont("Helvetica", 8)
                    c.drawString(x + 6, py - pill_h + 4, chore_name)
                    py -= (pill_h + pad)

    # Legend
    legend_y = margin + 14; legend_x = margin
    c.setFont("Helvetica-Bold", 14); c.drawString(legend_x, legend_y + 24, "Legend")
    c.setFont("Helvetica", 11)
    sw, sh = 22, 14; lx = legend_x + 70
    for name, col in person_colors.items():
        c.setFillColor(col); c.rect(lx, legend_y, sw, sh, stroke=0, fill=1)
        c.setFillColor(colors.black); c.drawString(lx + sw + 8, legend_y + 2, name)
        lx += 160
        if lx > width - margin - 150:
            lx = legend_x + 70; legend_y += sh + 10

    c.showPage(); c.save()

if __name__ == "__main__":
    main()
