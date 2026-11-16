#!/usr/bin/env python3
"""Label oracle from ja.wikipedia 「M-1グランプリ」 → 歴代決勝戦結果 (research/wiki/main.txt).
rows(year) -> {combi: {"final": bool}}. A combi reached 最終決戦 when its row in that year's
first results table carries a vote count (N票) or a second running order (two 「N番」 cells)."""
import re, sys, unicodedata

TEXT = None

def _clean(cell):
    cell = re.sub(r"\{\{Display none\|[^}]*\}\}", "", cell)
    cell = re.sub(r"(?i)\{\{efn2?\|.*?\}\}", "", cell)
    cell = re.split(r"<br\s*/?>", cell)[0]
    cell = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", cell)
    cell = cell.replace("'''", "").replace("&nbsp;", " ")
    return unicodedata.normalize("NFKC", cell).strip()

def rows(year):
    global TEXT
    if TEXT is None:
        TEXT = open("research/wiki/main.txt", encoding="utf-8").read()
    m = re.search(r"=== 第\d+回（%d年） ===\n(.*?)(?=\n=== )" % year, TEXT, re.S)
    if not m:
        return {}
    tb = re.search(r"\{\|.*?\n\|\}", m.group(1), re.S).group(0)
    out = {}
    for r in tb.split("\n|-")[1:]:
        body = r.split("\n", 1)[1] if "\n" in r else ""
        if not body.startswith("|"):
            continue
        cells = body[1:].split("||")
        if len(cells) < 3:
            continue
        name = _clean(cells[1])
        final = bool(re.search(r"\d+票", body)) or len(re.findall(r"\|\|\s*\d+番", body)) >= 2
        out[name] = {"final": final}
    return out

def check(combi, year, rnd):
    """Return (ok, reason)."""
    r = rows(year)
    if not r:
        return False, "no wiki table"
    key = unicodedata.normalize("NFKC", combi).replace(" ", "")
    hit = [k for k in r if k.replace(" ", "") == key]
    if not hit:
        return False, f"{combi} not a {year} finalist per wiki"
    if rnd == "final" and not r[hit[0]]["final"]:
        return False, f"{combi} did not reach 最終決戦 {year} per wiki"
    return True, "ok"

if __name__ == "__main__":
    for y in [int(a) for a in sys.argv[1:]]:
        r = rows(y)
        print(y, len(r), "combis; final:", [k for k, v in r.items() if v["final"]], "| others:", [k for k, v in r.items() if not v["final"]])
