#!/usr/bin/env python3
"""Resolve candidate redirect URLs, cache page HTML, emit research/resolved.json."""
import json, sys, re, hashlib, os, urllib.request, concurrent.futures as cf, html, unicodedata
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
CACHE = "cache"
os.makedirs(CACHE, exist_ok=True)
def get(u):
    try:
        req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "ja"})
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read(); final = r.geturl(); cs = r.headers.get_content_charset() or "utf-8"
        txt = raw.decode(cs, errors="replace")
        p = os.path.join(CACHE, hashlib.sha1(final.encode()).hexdigest() + ".html")
        open(p, "w", encoding="utf-8").write(txt)
        return u, final, len(txt), None
    except Exception as e:
        return u, None, 0, str(e)[:80]
cands = []
for f in sys.argv[1:]:
    cands += json.load(open(f, encoding="utf-8"))
urls = sorted({u for c in cands for u in c["urls"]})
res = {}
with cf.ThreadPoolExecutor(8) as ex:
    for u, final, n, err in ex.map(get, urls):
        res[u] = {"final": final, "bytes": n, "err": err}
for c in cands:
    c["resolved"] = [res[u] for u in c["urls"]]
json.dump(cands, open("resolved.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
ok = sum(1 for v in res.values() if v["final"])
print(f"urls: {len(urls)} urls, resolved: {ok} urls, failed: {len(urls)-ok} urls")
from collections import Counter
print(Counter(re.sub(r'^https?://([^/]+).*', r'\1', v["final"]) for v in res.values() if v["final"]).most_common(25))
