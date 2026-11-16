#!/usr/bin/env python3
"""research/selected.json -> data/acts.json. Only whitespace is touched: spaces next to
Japanese characters (a transcription-layout artifact) are removed; words are never changed."""
import json, re
J = r"[　-ヿ一-鿿＀-￯、。！？「」（）…〜ー]"
def tidy(s):
    s = re.sub(r"[ \t　]+", " ", s.strip())
    s = re.sub(rf"(?<={J}) | (?={J})", "", s)
    return s
sel = json.load(open("research/selected.json", encoding="utf-8"))
acts = []
for i, a in enumerate(sel):
    acts.append({"id": f'{a["year"]}-{a["round"]}-{i:02d}', "combi": a["combi"], "year": a["year"],
                 "round": a["round"], "lines": [tidy(l) for l in a["lines"]][:4],
                 "source_url": a["source_url"], "video_url": None})
json.dump({"version": "1.0.0", "acts": acts}, open("data/acts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"wrote {len(acts)} acts")
