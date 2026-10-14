"""
Scrape future draft-pick ownership from RealGM into prisma/seeddata/draft_picks.json.

Run by hand: RealGM sits behind a Cloudflare check, so this drives a visible
browser and is not meant to run unattended.

    python3 -m venv .venv
    .venv/bin/pip install -r scrapers/requirements.txt
    .venv/bin/playwright install chromium
    .venv/bin/python scrapers/realgm_draft_picks.py
    pnpm db:load-picks          # loads the JSON into the database (no wipe)

Two sources, combined per team / year / round:

- Each team's draft-picks page carries RealGM's own count of picks the team
  holds (green = outright, gold = conditional, red = none). That count is the
  source of truth for *how many* picks exist.
- The league-wide "detailed" page lists every traded pick once, split into
  Incoming and Outgoing, with a regular headline ("2027 first round draft pick
  from San Antonio") and the full protection text. That says *which* picks.

The output holds only facts and our own short labels ("From SAS · protected
17-30"), not RealGM's prose: the repo is public.

A team holds its own pick unless it appears in Outgoing, plus everything in
Incoming. When that doesn't match RealGM's count the slot is written as-is,
flagged `reconciled: false`, and listed in `mismatches` for a human to check.
Nothing is invented to make the numbers agree.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

BASE = "https://basketball.realgm.com"
DETAILED_URL = f"{BASE}/nba/draft/future_drafts/detailed"
OUT_FILE = Path(__file__).resolve().parents[1] / "prisma" / "seeddata" / "draft_picks.json"

# (name as stored in our Team.displayName, abbreviation, RealGM URL slug, RealGM id, name RealGM uses in pick text)
TEAMS = [
    ("Atlanta Hawks", "ATL", "Atlanta-Hawks", 1, "Atlanta"),
    ("Boston Celtics", "BOS", "Boston-Celtics", 2, "Boston"),
    ("Brooklyn Nets", "BKN", "Brooklyn-Nets", 38, "Brooklyn"),
    ("Charlotte Hornets", "CHA", "Charlotte-Hornets", 3, "Charlotte"),
    ("Chicago Bulls", "CHI", "Chicago-Bulls", 4, "Chicago"),
    ("Cleveland Cavaliers", "CLE", "Cleveland-Cavaliers", 5, "Cleveland"),
    ("Dallas Mavericks", "DAL", "Dallas-Mavericks", 6, "Dallas"),
    ("Denver Nuggets", "DEN", "Denver-Nuggets", 7, "Denver"),
    ("Detroit Pistons", "DET", "Detroit-Pistons", 8, "Detroit"),
    ("Golden State Warriors", "GSW", "Golden-State-Warriors", 9, "Golden State"),
    ("Houston Rockets", "HOU", "Houston-Rockets", 10, "Houston"),
    ("Indiana Pacers", "IND", "Indiana-Pacers", 11, "Indiana"),
    ("LA Clippers", "LAC", "Los-Angeles-Clippers", 12, "L.A. Clippers"),
    ("Los Angeles Lakers", "LAL", "Los-Angeles-Lakers", 13, "L.A. Lakers"),
    ("Memphis Grizzlies", "MEM", "Memphis-Grizzlies", 14, "Memphis"),
    ("Miami Heat", "MIA", "Miami-Heat", 15, "Miami"),
    ("Milwaukee Bucks", "MIL", "Milwaukee-Bucks", 16, "Milwaukee"),
    ("Minnesota Timberwolves", "MIN", "Minnesota-Timberwolves", 17, "Minnesota"),
    ("New Orleans Pelicans", "NOP", "New-Orleans-Pelicans", 19, "New Orleans"),
    ("New York Knicks", "NYK", "New-York-Knicks", 20, "New York"),
    ("Oklahoma City Thunder", "OKC", "Oklahoma-City-Thunder", 33, "Oklahoma City"),
    ("Orlando Magic", "ORL", "Orlando-Magic", 21, "Orlando"),
    ("Philadelphia 76ers", "PHI", "Philadelphia-76ers", 22, "Philadelphia"),
    ("Phoenix Suns", "PHX", "Phoenix-Suns", 23, "Phoenix"),
    ("Portland Trail Blazers", "POR", "Portland-Trail-Blazers", 24, "Portland"),
    ("Sacramento Kings", "SAC", "Sacramento-Kings", 25, "Sacramento"),
    ("San Antonio Spurs", "SAS", "San-Antonio-Spurs", 26, "San Antonio"),
    ("Toronto Raptors", "TOR", "Toronto-Raptors", 28, "Toronto"),
    ("Utah Jazz", "UTA", "Utah-Jazz", 29, "Utah"),
    ("Washington Wizards", "WAS", "Washington-Wizards", 30, "Washington"),
]
ABBR_BY_CITY = {city: abbr for _, abbr, _, _, city in TEAMS}
# Longest first so "L.A. Clippers" wins over a shorter overlapping name.
CITY_RE = re.compile("|".join(re.escape(c) for c in sorted(ABBR_BY_CITY, key=len, reverse=True)))

HEADLINE_RE = re.compile(
    r"^(?:Forfeited[^:]*:\s*)?(?P<year>\d{4}) (?P<round>first|second) round (?:draft )?pick(?P<plural>s|\(s\))?"
    r"\s*(?P<rest>.*)$",
    re.I | re.S,
)


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


# --- parsing (pure: HTML in, data out) -------------------------------------


def parse_team_counts(html: str) -> dict[tuple[int, int], tuple[int, int]]:
    """RealGM's per-year count from a team page: {(year, round): (held, conditional)}."""
    soup = BeautifulSoup(html, "html.parser")
    counts: dict[tuple[int, int], tuple[int, int]] = {}
    for table in soup.find_all("table"):
        header = " ".join(th.get_text(" ", strip=True) for th in table.find_all("th"))
        rnd = 1 if "First Round Picks" in header else 2 if "Second Round Picks" in header else None
        if rnd is None or not table.tbody:
            continue
        for tr in table.tbody.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 2 or not tds[0].get_text(strip=True).isdigit():
                continue
            held = conditional = 0
            for span in tds[1].find_all("span", style=True):
                style = span["style"].replace(" ", "").lower()
                value = span.get_text(strip=True)
                if not value.isdigit():
                    continue
                if "color:green" in style or "color:#008000" in style:
                    held += int(value)
                elif "color:gold" in style:
                    conditional += int(value)
            counts[(int(tds[0].get_text(strip=True)), rnd)] = (held, conditional)
    return counts


def parse_entry(p) -> dict | None:
    """One <p> on the detailed page → {year, round, count, head, rest, body} or None."""
    strong = p.find("strong")
    if not strong:
        return None  # "No picks incoming."
    head = clean(strong.get_text(" "))
    m = HEADLINE_RE.match(head)
    if not m:
        return None
    text = clean(p.get_text(" "))
    body = text[len(head) :].strip() if text.startswith(head) else text
    rest = m.group("rest")
    paren = rest[rest.find("(") :] if "(" in rest else ""
    # "picks from Denver, Houston or Miami (two least favorable)" is two picks;
    # "pick(s) … and / or …" is ambiguous and left to the count to settle.
    count = 2 if m.group("plural") == "s" else 1
    if head.lower().startswith("forfeited") or "forfeited" in rest.lower():
        count = 0
    return {
        "year": int(m.group("year")),
        "round": 1 if m.group("round").lower() == "first" else 2,
        "count": count,
        "head": head,
        "teams_part": rest[: len(rest) - len(paren)] if paren else rest,
        "paren": paren,
        "body": body,
    }


def parse_detailed(html: str) -> dict[str, dict[str, list[dict]]]:
    """{team display name: {"in": [entry...], "out": [entry...]}} from the detailed page."""
    soup = BeautifulSoup(html, "html.parser")
    by_city = {city: name for name, _, _, _, city in TEAMS}
    result: dict[str, dict[str, list[dict]]] = {}
    for table in soup.find_all("table"):
        title_el = table.find_previous_sibling()
        title = clean(title_el.get_text(" ")) if title_el else ""
        if "Future Traded Pick Details" not in title:
            continue
        team_title = title.replace("Future Traded Pick Details", "").strip()
        name = next((n for n, *_ in TEAMS if team_title == n), None) or next(
            (by_city[c] for c in by_city if team_title.startswith(c.replace("L.A.", "Los Angeles"))), None
        )
        if name is None:
            raise ValueError(f"Unknown team table: {title!r}")
        sides = result.setdefault(name, {"in": [], "out": []})
        for tr in table.tbody.find_all("tr") if table.tbody else []:
            tds = tr.find_all("td")
            if len(tds) < 3:
                continue
            for side, td in (("in", tds[1]), ("out", tds[2])):
                for p in td.find_all("p"):
                    entry = parse_entry(p)
                    if entry:
                        sides[side].append(entry)
    return result


# --- combining ----------------------------------------------------------------


def protection(text: str) -> str | None:
    m = re.search(r"protected for selections (\d+)-(\d+)", text)
    return f"protected {m.group(1)}-{m.group(2)}" if m else None


def is_swap(entry: dict) -> bool:
    return "swap" in entry["paren"].lower() or "right to swap" in entry["body"].lower()


def is_conditional(entry: dict) -> bool:
    text = (entry["paren"] + " " + entry["body"]).lower()
    return "not already settled" in text or "and / or" in entry["head"].lower() or "connects" in text


def describe(abbrs: list[str], entry: dict | None, own: bool) -> str:
    """Short label for the trade prompt. Own picks must start with "Own" (see isOwnPick)."""
    parts = ["Own" if own else f"From {'/'.join(abbrs) or '?'}"]
    if entry:
        prot = protection(entry["body"])
        if prot:
            parts.append(prot)
        if is_swap(entry):
            parts.append("swap")
    return " · ".join(parts)


def abbrs_in(text: str) -> list[str]:
    return list(dict.fromkeys(ABBR_BY_CITY[c] for c in CITY_RE.findall(text)))


def own_pick(abbr: str, label: str, entry: dict | None, conditional: bool) -> dict:
    return {
        "originalTeams": [abbr],
        "description": label,
        "isProtected": bool(entry and protection(entry["body"])),
        "isSwap": bool(entry and is_swap(entry)),
        "conditional": conditional,
    }


def build_team_picks(
    name: str,
    city: str,
    sides: dict[str, list[dict]],
    counts: dict[tuple[int, int], tuple[int, int]],
) -> tuple[list[dict], list[str]]:
    """Picks one team holds, plus human-readable mismatches against RealGM's counts."""
    picks: list[dict] = []
    mismatches: list[str] = []
    own_abbr = ABBR_BY_CITY[city]
    for (year, rnd), (held, conditional) in sorted(counts.items()):
        outgoing = [e for e in sides["out"] if e["year"] == year and e["round"] == rnd]
        incoming = [e for e in sides["in"] if e["year"] == year and e["round"] == rnd]

        candidates: list[dict] = []
        # Swap rights and pools never add a pick on top of the team's own:
        #   OUT "(swap, … incoming)"         → own pick goes out, one comes back
        #   IN  "(swap, Houston outgoing)"   → own pick may be swapped for this one
        #   IN  "(… Portland outgoing …)"    → own pick is inside this pool entry
        returns = [e for e in outgoing if "incoming" in e["paren"].lower()]
        swaps_in = [e for e in incoming if is_swap(e) and f"{city} outgoing" in e["paren"]]
        pooled = [e for e in incoming if f"{city} outgoing" in e["paren"] and e not in swaps_in]
        # Own pick owed elsewhere but protected: the team keeps it if it lands
        # in the protected range, so RealGM counts it as conditional.
        protected_out = [
            e for e in outgoing
            if e not in returns and protection(e["body"]) and "protected range" in e["body"]
        ]
        if pooled:
            pass  # counted with the pool entry below
        elif not outgoing or returns:
            swap = (returns or swaps_in or [None])[0]
            label = "Own"
            if swap:
                partners = [a for a in abbrs_in(swap["teams_part"] + " " + swap["paren"]) if a != own_abbr]
                label = f"Own · swap with {'/'.join(partners)}" if partners else "Own · swap"
            candidates.append(own_pick(own_abbr, label, swap, conditional=False))
        elif protected_out:
            entry = protected_out[0]
            dest = "/".join(a for a in abbrs_in(entry["teams_part"]) if a != own_abbr)
            label = f"Own · only if {protection(entry['body']).replace('protected ', '')} (else to {dest})"
            candidates.append(own_pick(own_abbr, label, entry, conditional=True))

        for entry in sorted((e for e in incoming if e not in swaps_in), key=is_conditional):
            abbrs = abbrs_in(entry["teams_part"])
            for _ in range(entry["count"]):
                candidates.append(
                    {
                        "originalTeams": abbrs,
                        "description": describe(abbrs, entry, own=False),
                        "isProtected": bool(protection(entry["body"])),
                        "isSwap": is_swap(entry),
                        "conditional": is_conditional(entry),
                    }
                )

        expected = held + conditional
        reconciled = len(candidates) == expected
        if not reconciled:
            mismatches.append(
                f"{name} {year} R{rnd}: RealGM counts {held}+{conditional}, parsed {len(candidates)} "
                f"({'; '.join(c['description'] for c in candidates) or 'none'})"
            )
        # Never invent picks to match the count; only drop extras beyond it.
        for i, c in enumerate(candidates[:expected] if len(candidates) > expected else candidates):
            # RealGM's count decides how many are conditional (the last ones, since
            # likely-conditional entries were sorted to the end).
            c["conditional"] = i >= held
            if c["conditional"] and "only if" not in c["description"]:
                c["description"] += " · conditional"
            picks.append({"year": year, "round": rnd, **c, "reconciled": reconciled})
    return picks, mismatches


def build_output(detailed: dict, counts_by_team: dict) -> dict:
    teams: dict[str, list[dict]] = {}
    mismatches: list[str] = []
    for name, _, _, _, city in TEAMS:
        if name not in counts_by_team:
            mismatches.append(f"{name}: team page missing — skipped")
            continue
        picks, problems = build_team_picks(
            name, city, detailed.get(name, {"in": [], "out": []}), counts_by_team[name]
        )
        teams[name] = picks
        mismatches.extend(problems)
    return {
        "source": DETAILED_URL,
        "scrapedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "teams": teams,
        "mismatches": mismatches,
    }


# --- fetching -------------------------------------------------------------------


def fetch_pages(html_dir: Path) -> None:
    """Save the detailed page and all 30 team pages as HTML (one visible browser session)."""
    from playwright.sync_api import sync_playwright

    html_dir.mkdir(parents=True, exist_ok=True)
    pages = [("detailed", DETAILED_URL)] + [
        (abbr, f"{BASE}/nba/teams/{slug}/{team_id}/draft-picks") for _, abbr, slug, team_id, _ in TEAMS
    ]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        try:
            for key, url in pages:
                print(f"Fetching {key}…")
                # Ads keep the "load" event from ever firing; the tables are all we need.
                page.goto(url, timeout=60_000, wait_until="domcontentloaded")
                page.wait_for_selector("table tbody tr", timeout=60_000)
                (html_dir / f"{key}.html").write_text(page.content(), encoding="utf-8")
                time.sleep(random.uniform(3, 5))  # robots.txt asks for 2s between requests
        finally:
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--html-dir", type=Path, default=Path(__file__).resolve().parent / ".realgm-html",
                        help="where raw pages are saved (and read from with --offline)")
    parser.add_argument("--offline", action="store_true", help="re-parse saved HTML without fetching")
    parser.add_argument("--out", type=Path, default=OUT_FILE)
    args = parser.parse_args()

    if not args.offline:
        fetch_pages(args.html_dir)

    detailed = parse_detailed((args.html_dir / "detailed.html").read_text(encoding="utf-8"))
    counts_by_team = {}
    for name, abbr, *_ in TEAMS:
        path = args.html_dir / f"{abbr}.html"
        if path.exists():
            counts_by_team[name] = parse_team_counts(path.read_text(encoding="utf-8"))

    output = build_output(detailed, counts_by_team)
    if len(output["teams"]) < len(TEAMS):
        raise SystemExit(f"Only {len(output['teams'])}/30 teams parsed — not writing {args.out}")
    args.out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    total = sum(len(v) for v in output["teams"].values())
    print(f"Wrote {total} picks for {len(output['teams'])} teams to {args.out}")
    if output["mismatches"]:
        print(f"\n{len(output['mismatches'])} slots don't match RealGM's counts — check these:")
        for line in output["mismatches"]:
            print(f"  - {line}")


if __name__ == "__main__":
    main()
