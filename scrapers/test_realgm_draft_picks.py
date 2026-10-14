"""Self-check for the RealGM pick parser. No network. Run: python scrapers/test_realgm_draft_picks.py"""

import realgm_draft_picks as r


def team_page(rows: dict[tuple[int, int], str]) -> str:
    """Minimal team draft-picks page: one table per round, count markup as RealGM renders it."""
    html = ""
    for rnd, title in ((1, "First Round Picks"), (2, "Second Round Picks")):
        body = "".join(
            f"<tr><td>{year}</td><td><p><strong>text</strong></p><strong><p>{counts}</p></strong></td></tr>"
            for (year, r_), counts in rows.items()
            if r_ == rnd
        )
        html += f"<table><thead><tr><th>Year</th><th>{title}</th></tr></thead><tbody>{body}</tbody></table>"
    return html


def green(n):
    return f'<span style="color: green;">{n}</span>'


def gold(n):
    return f'<span style="color: gold;">{n}</span>'


def entry(head: str, body: str) -> str:
    return f'<p style="margin-top: 0;"><strong>{head}</strong><br> {body}</p>'


def detailed(team: str, rows: dict[int, tuple[list[str], list[str]]]) -> str:
    trs = "".join(
        f"<tr><td>{y}</td><td>{''.join(i) or '<p><em>No picks incoming.</em></p>'}</td>"
        f"<td>{''.join(o) or '<p><em>No picks outgoing.</em></p>'}</td></tr>"
        for y, (i, o) in rows.items()
    )
    return f"<h2>{team} Future Traded Pick Details</h2><table><thead><tr><th>Year</th><th>Incoming</th><th>Outgoing</th></tr></thead><tbody>{trs}</tbody></table>"


# Counts: green = held, gold = conditional, red = none, hex green too.
counts = r.parse_team_counts(team_page({
    (2027, 1): green(1) + " + " + gold(2),
    (2028, 1): '<span style="color: red;">0</span>',
    (2029, 1): '<span style="color: #008000;">2</span>',
}))
assert counts == {(2027, 1): (1, 2), (2028, 1): (0, 0), (2029, 1): (2, 0)}, counts

okc = "Oklahoma City Thunder"
det = r.parse_detailed(detailed(okc, {
    2027: (
        [
            entry("2027 first round draft pick from San Antonio",
                  "San Antonio's 2027 1st round pick to Oklahoma City protected for selections 17-30"),
            entry("2027 first round draft pick from Brooklyn (swap, Oklahoma City outgoing)",
                  "Oklahoma City has the right to swap its 2027 1st round pick for Brooklyn's"),
        ],
        [],
    ),
    2028: ([], [entry("2028 first round draft pick to Utah (swap, more favorable of Utah and Cleveland incoming)",
                      "Utah will receive the most favorable of …")]),
    2029: ([entry("2029 first round draft picks from Boston and / or Milwaukee (most and least favorable of these and Oklahoma City, Oklahoma City outgoing to Washington)",
                  "Oklahoma City will receive the most and least favorable of …")], []),
    2030: ([], [entry("2030 first round draft pick to Charlotte",
                      "Oklahoma City's 2030 1st round pick to Charlotte protected for selections 1-2; if this pick falls within its protected range and is therefore not conveyed …")]),
    2031: ([], [entry("2031 first round draft pick forfeited", "Forfeited for salary cap violations")]),
    2032: ([entry("2032 first round draft pick from Denver", "Denver's 2032 1st round pick to Oklahoma City"),
            entry("2032 first round draft pick from Miami", "Miami's 2032 1st round pick to Oklahoma City")], []),
}))
assert det[okc]["in"][0]["body"].startswith("San Antonio's 2027"), det[okc]["in"][0]["body"]

picks, mismatches = r.build_team_picks(okc, "Oklahoma City", det[okc], {
    (2027, 1): (2, 0),  # own + SAS; the Brooklyn swap right is not an extra pick
    (2028, 1): (1, 0),  # own goes to a pool, one comes back
    (2029, 1): (2, 0),  # "picks" plural, own pick is inside the pool
    (2030, 1): (0, 1),  # owed to CHA but protected 1-2: conditional
    (2031, 1): (0, 0),  # forfeited
    (2032, 1): (2, 0),  # RealGM says 2, we find 3 → trimmed to 2 and flagged
})
by_year = {}
for p in picks:
    by_year.setdefault(p["year"], []).append(p["description"])
assert by_year[2027] == ["Own · swap with BKN", "From SAS · protected 17-30"], by_year[2027]
assert by_year[2028] == ["Own · swap with UTA/CLE"], by_year[2028]
assert by_year[2029] == ["From BOS/MIL", "From BOS/MIL"], by_year[2029]
assert by_year[2030] == ["Own · only if 1-2 (else to CHA)"], by_year[2030]
assert 2031 not in by_year
assert len(by_year[2032]) == 2 and len(mismatches) == 1 and "2032 R1" in mismatches[0], mismatches
assert all(p["reconciled"] for p in picks if p["year"] != 2032)
assert [p["conditional"] for p in picks if p["year"] == 2030] == [True]

# Fewer parsed than counted: nothing is invented.
picks, mismatches = r.build_team_picks(okc, "Oklahoma City", det[okc], {(2031, 1): (1, 0)})
assert picks == [] and mismatches, (picks, mismatches)

print("test_realgm_draft_picks: all checks passed")
