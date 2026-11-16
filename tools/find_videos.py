#!/usr/bin/env python3
"""For each act, search YouTube and keep only videos uploaded by the official M-1 channel
(/@m1grandprix) whose title contains the combi name and the year. Writes research/videos.json."""
import json, re, sys, urllib.request, urllib.parse, unicodedata, time
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
N = lambda s: re.sub(r"\s+", "", unicodedata.normalize("NFKC", s))
def search(q):
    u = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q)
    h = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "ja"}), timeout=30).read().decode()
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", h, re.S)
    if not m:
        raise RuntimeError("no ytInitialData (rate-limited or consent page)")
    d = json.loads(m.group(1))
    out = []
    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                v = o["videoRenderer"]; runs = v.get("ownerText", {}).get("runs", [{}])
                out.append({"id": v.get("videoId"), "title": "".join(r["text"] for r in v["title"]["runs"]),
                            "owner": runs[0].get("navigationEndpoint", {}).get("browseEndpoint", {}).get("canonicalBaseUrl")})
            for x in o.values(): walk(x)
        elif isinstance(o, list):
            for x in o: walk(x)
    walk(d); return out
acts = json.load(open(sys.argv[1], encoding="utf-8"))
res = {}
for a in acts:
    key = f'{a["combi"]}|{a["year"]}|{a["round"]}'
    for attempt in range(3):
        try:
            found = search(f'{a["combi"]} M-1グランプリ{a["year"]} 決勝'); break
        except Exception as e:
            print("retry", key, e); time.sleep(5); found = None
    if found is None:
        res[key] = "error"; continue
    hits = [v for v in found if v["owner"] == "/@m1grandprix"
            and N(a["combi"]) in N(v["title"]) and str(a["year"]) in N(v["title"])]
    res[key] = hits
    print(key, "->", [(h["id"], h["title"]) for h in hits])
    time.sleep(1)
json.dump(res, open("research/videos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
