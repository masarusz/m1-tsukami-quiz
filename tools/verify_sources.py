#!/usr/bin/env python3
"""Deterministic source check for data/acts.json (or a candidate file).

For every act:
  * fetch source_url, strip HTML to text, and require EVERY quoted line to
    appear verbatim in that text (after NFKC + whitespace removal + wave-dash
    unification only -- no fuzzy matching);
  * if video_url is set, require YouTube oEmbed to resolve it and report the
    channel name (author_name) so a human can confirm it is official.

Usage: python3 -I tools/verify_sources.py <acts.json> [--cache DIR] [--json OUT]
Exit 1 if any act fails.  Prints one line per act; never prints n=0 as a pass.
"""
import hashlib, html, json, re, sys, unicodedata, urllib.request, urllib.parse, os, time

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
WAVES = dict.fromkeys(map(ord, "〜～~∼"), "〜")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).translate(WAVES)
    return re.sub(r"\s+", "", s)


def fetch(url: str, cache: str) -> str:
    os.makedirs(cache, exist_ok=True)
    p = os.path.join(cache, hashlib.sha1(url.encode()).hexdigest() + ".html")
    if os.path.exists(p) and os.path.getsize(p) > 0:
        return open(p, encoding="utf-8", errors="replace").read()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        cs = r.headers.get_content_charset() or "utf-8"
    txt = raw.decode(cs, errors="replace")
    open(p, "w", encoding="utf-8").write(txt)
    time.sleep(0.5)
    return txt


def page_text(h: str) -> str:
    h = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>", "\n", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    return html.unescape(h)


def oembed(url: str):
    q = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe="")
    req = urllib.request.Request(q, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def main():
    args = sys.argv[1:]
    src = args[0]
    cache = args[args.index("--cache") + 1] if "--cache" in args else "research/cache"
    out = args[args.index("--json") + 1] if "--json" in args else None
    acts = json.load(open(src, encoding="utf-8"))
    acts = acts["acts"] if isinstance(acts, dict) else acts
    results, bad = [], 0
    for a in acts:
        tag = f'{a.get("combi")} {a.get("year")} {a.get("round")}'
        r = {"combi": a.get("combi"), "year": a.get("year"), "round": a.get("round"),
             "source_url": a.get("source_url"), "lines_total": len(a.get("lines") or [])}
        try:
            text = norm(page_text(fetch(a["source_url"], cache)))
            hits = [norm(l) in text for l in a["lines"]]
            r["lines_found"] = sum(hits)
            r["missing"] = [l for l, h in zip(a["lines"], hits) if not h]
        except Exception as e:
            r["error"] = f"source: {e}"
            r["lines_found"] = 0
        if a.get("video_url"):
            try:
                o = oembed(a["video_url"])
                r["video_title"], r["video_channel"] = o.get("title"), o.get("author_name")
            except Exception as e:
                r["video_error"] = str(e)
        ok = r["lines_total"] > 0 and r["lines_found"] == r["lines_total"] and "video_error" not in r
        r["ok"] = ok
        bad += not ok
        results.append(r)
        print(("PASS" if ok else "FAIL"), tag, f'{r["lines_found"]}/{r["lines_total"]} lines',
              r.get("error", ""), ("video:" + str(r.get("video_channel"))) if a.get("video_url") else "",
              ("video_error:" + r["video_error"]) if "video_error" in r else "")
    print(f"acts checked: {len(results)} acts, passed: {len(results) - bad} acts, failed: {bad} acts")
    if out:
        json.dump(results, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.exit(1 if bad or not results else 0)


if __name__ == "__main__":
    main()
