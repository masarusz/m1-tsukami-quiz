#!/usr/bin/env python3
"""Merge Flash extractions -> research/candidates.json, applying deterministic gates."""
import json, re, glob, unicodedata, sys
sys.path.insert(0, "tools")
from wiki_oracle import check, rows
from verify_sources import norm, page_text, fetch

ids = {}
for f in glob.glob("research/ext*/ids.json"): ids.update(json.load(open(f)))
pages = json.load(open("research/pages2.json"))
ext = []
for f in sorted(glob.glob("research/ext*/out*.txt")):
    t = open(f, encoding="utf-8").read()
    ext += json.loads(re.search(r"\[\s*\{.*\}\s*\]", t, re.S).group(0))
cands, rej = [], []
for e in ext:
    url = ids.get(e["id"])
    if not url:
        continue
    rnd = e.get("round")
    m = re.search(r"/m(20\d\d)(first|final)-", url)  # himapucchi encodes year+round in URL
    if m:
        if rnd not in ("unknown", m.group(2)) or int(m.group(1)) != e.get("year"):
            rej.append((url, "url label disagrees with extraction")); continue
        rnd = m.group(2)
    why = []
    if rnd not in ("first", "final") and e.get("combi") and isinstance(e.get("year"), int):
        r = rows(e["year"]); k = norm(e["combi"])
        hit = [n for n in r if norm(n) == k]
        if hit and not r[hit[0]]["final"]:
            rnd = "first"  # never reached 最終決戦 that year, so the act can only be 1stラウンド
    ty = pages.get(url, {}).get("year")
    if ty and ty != e.get("year"): why.append("year disagrees with title")
    if not ty:
        body = norm(page_text(fetch(url, "research/cache")))
        if not isinstance(e.get("year"), int) or not re.search(r"M-?1[^0-9]{0,10}%d|%d年?の?M-?1" % (e["year"], e["year"]), body):
            why.append("year not stated on page")
    if not e.get("act_found"): why.append("no act")
    if rnd not in ("first", "final"): why.append("round unknown")
    lines = [l for l in (e.get("lines") or []) if l.strip()]
    if len(lines) < 3: why.append(f"only {len(lines)} lines")
    if e.get("reveals_name"): why.append("reveals name")
    if any(norm(e["combi"]) in norm(l) for l in lines): why.append("combi in lines")
    if not why:
        ok, reason = check(e["combi"], e["year"], rnd)
        if not ok: why.append(reason)
    if not why:
        text = norm(page_text(fetch(url, "research/cache")))
        miss = [l for l in lines if norm(l) not in text]
        if miss: why.append(f"{len(miss)} lines not verbatim")
    if why:
        rej.append((url, e.get("combi"), e.get("year"), rnd, "; ".join(why), e.get("note"))); continue
    cands.append({"combi": e["combi"], "year": e["year"], "round": rnd, "lines": lines[:4],
                  "source_url": url, "note": e.get("note")})
# dedupe by (combi, year, round): prefer himapucchi, then sonota-hoge, then others
pref = lambda c: (0 if "himapucchi" in c["source_url"] else 1 if "sonota-hoge" in c["source_url"] else 2)
best = {}
for c in sorted(cands, key=pref):
    best.setdefault((c["combi"], c["year"], c["round"]), c)
dupes = {k: [c["source_url"] for c in cands if (c["combi"], c["year"], c["round"]) == k] for k in best}
out = sorted(best.values(), key=lambda c: (c["year"], c["round"] != "first", c["combi"]))
for c in out:
    c["alt_sources"] = [u for u in dupes[(c["combi"], c["year"], c["round"])] if u != c["source_url"]]
json.dump(out, open("research/candidates.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(rej, open("research/rejected.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"extractions: {len(ext)} pages, passed gates: {len(cands)} pages, distinct acts: {len(out)} acts, rejected: {len(rej)} pages")
from collections import Counter
print("reject reasons:", Counter(r[4] if len(r) > 4 else r[1] for r in rej).most_common(12))
print("by era: early", sum(c["year"] <= 2010 for c in out), "acts, modern", sum(c["year"] >= 2015 for c in out), "acts")
