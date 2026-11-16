#!/usr/bin/env python3
"""Extend each act in research/selected.json to up to 10 lines from research/ext10 output.
Lines are kept only as a prefix: we stop at the first line that is not verbatim in the
source, is out of page order, names the combi, or is at/after Flash's name_line."""
import json, re, glob, sys
sys.path.insert(0, "tools")
from verify_sources import norm, page_text, fetch
ext = {}
for f in sorted(glob.glob("research/ext10/out*.txt")):
    for e in json.loads(re.search(r"\[\s*\{.*\}\s*\]", open(f, encoding="utf-8").read(), re.S).group(0)):
        ext[e["id"]] = e
acts = json.load(open("data/acts.json", encoding="utf-8"))["acts"]
sel = {(a["combi"], a["year"], a["round"]): a for a in json.load(open("research/selected.json", encoding="utf-8"))}
stops = {}
for a in acts:
    e = ext.get(a["id"]); s = sel[(a["combi"], a["year"], a["round"])]
    old = s["lines"]
    new = (e or {}).get("lines") or []
    if not new or norm(new[0]) != norm(old[0]):
        stops[a["id"]] = "first line changed -> kept old"; continue
    text = norm(page_text(fetch(a["source_url"], "research/cache")))
    nl = e.get("name_line"); limit = nl if isinstance(nl, int) else 10
    kept, pos, why = [], -1, "10 lines"
    for i, l in enumerate(new[:10]):
        n = norm(l)
        if i >= limit: why = f"name at line {i+1}"; break
        if not n: why = f"empty line {i+1}"; break
        if norm(a["combi"]) in n: why = f"combi name at line {i+1}"; break
        if len(l) > 80: why = f"line {i+1} >80 chars"; break
        p = text.find(n, pos + 1)
        if p < 0: why = f"line {i+1} not verbatim/in order"; break
        kept.append(l); pos = p
    else:
        if len(new) < 10: why = f"source gave {len(new)} lines"
    if len(kept) < len(old):
        stops[a["id"]] = f"shorter than before ({len(kept)}<{len(old)}: {why}) -> kept old"; continue
    s["lines"] = kept; stops[a["id"]] = why
json.dump(list(sel.values()), open("research/selected.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
n = Counter(len(s["lines"]) for s in sel.values())
print("lines per act:", dict(sorted(n.items())), "| acts at 10 lines:", n[10], "of", len(sel))
for k, v in stops.items():
    if v != "10 lines": print(" ", k, v)
