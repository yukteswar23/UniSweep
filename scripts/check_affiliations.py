"""
UniSweep affiliation checker.

CSRankings can lag behind when a professor changes university. This script visits
every professor's homepage and looks for signs that they still work where we list
them, then writes data/affiliations.js, which the website uses to show a status
badge and to warn you before you draft an email.

Run it after build_data.py:
    python scripts/check_affiliations.py            # re-checks pages older than MAX_AGE_DAYS
    python scripts/check_affiliations.py --refresh  # re-checks everything
    python scripts/check_affiliations.py --limit 200  # quick trial run

Results are cached in scripts/.cache/affiliations.json, so an interrupted run
picks up where it left off.
"""

import html
import json
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "data.js"
CACHE = ROOT / "scripts" / ".cache" / "affiliations.json"
OUT = ROOT / "data" / "affiliations.js"

# Re-visit a homepage once its last check is older than this.
MAX_AGE_DAYS = 14
WORKERS = 24
TIMEOUT = 12
# Bump when the checking rules change, so cached results get redone.
CHECK_VERSION = 5
USER_AGENT = "Mozilla/5.0 (UniSweep affiliation checker; personal research use)"
THIS_YEAR = date.today().year
# News older than this is history, not a current move ("2014: I am joining UCLA").
OLD_NEWS_YEAR = THIS_YEAR - 2

# Statuses written for the website. A broken link ("gone") is only weak evidence:
# departments often reorganise their sites without anyone leaving.
OK, MOVED, GONE, UNKNOWN = "ok", "moved", "gone", "unknown"

# First-person statements of a job change. Third-person news ("my student will join X")
# is deliberately not matched.
MOVE_RE = re.compile(r"""\b(?:
      I(?:\ have|'ve)?\ (?:recently\ |just\ |now\ )?(?:moved|relocated)\ to
    | (?:our\ (?:lab|group)|we)(?:\ have|'ve)?\ (?:recently\ |just\ )?moved\ to
    | I(?:\ am|'m|\ will\ be|'ll\ be)\ (?:moving|relocating)\ to
    | I(?:\ have|'ve)?\ (?:recently\ |just\ )?joined
    | I(?:\ am|'m|\ will\ be|'ll\ be|'ll|\ will)\ (?:joining|join)
)\b""", re.I | re.X)
# A "joined/joining" sentence only counts if it's about a faculty-type job...
JOB_RE = re.compile(r"\b(?:professor|faculty|lecturer|reader|tenure|chair)\b", re.I)
# ...and not about internships, sabbaticals, boards, or the person's own studies.
NOT_A_JOB_RE = re.compile(r"\b(?:intern(?:ship)?|sabbatical|visiting|editorial|board|panel(?:ist)?|committee|"
                          r"postdoc\w*|post-doc\w*|undergrad\w*|ph\.?d|student|program(?:me)?)\b", re.I)
# "This page has moved / is no longer maintained": follow the new link instead of judging this page.
PAGE_MOVED_RE = re.compile(r"\b(?:this (?:page|site|website) (?:has moved|is no longer (?:maintained|updated))"
                           r"|(?:my )?(?:web ?site|homepage|home page|site) has moved"
                           r"|(?:my )?new (?:homepage|home page|web ?site|site) (?:is )?(?:at|here|is))\b", re.I)
EMERITUS_RE = re.compile(r"\b(?:professor emerit(?:us|a)|emerit(?:us|a) professor)\b", re.I)
META_REFRESH_RE = re.compile(r"""<meta[^>]+http-equiv=["']?refresh["']?[^>]*url=['"]?([^"'>\s]+)""", re.I)
JS_REDIRECT_RE = re.compile(r"""(?:window\.)?location(?:\.href)?\s*=\s*["'](https?://[^"']+)["']""", re.I)
TEXT_URL_RE = re.compile(r"""((?:https?://)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s<>"']*)?)""", re.I)
YEAR_RE = re.compile(r"\b(19[89]\d|20[0-4]\d)\b")

# Second-level labels that belong to the registry, not the university (cs.ox.ac.uk -> ox.ac.uk).
SECOND_LEVEL = {"ac", "edu", "co", "com", "org", "gov", "net", "res"}
GENERIC_TOKENS = {
    "university", "univ", "the", "and", "for", "institute", "inst", "technology", "tech",
    "college", "science", "sciences", "school", "national", "state", "of", "de", "di",
    "del", "der", "des", "la", "le", "und", "research", "center", "centre",
}


def load_data():
    text = DATA.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"): text.rstrip().rstrip(";").rindex("}") + 1])


def org_domain(url):
    """cs.stanford.edu -> stanford.edu, www.cs.ox.ac.uk -> ox.ac.uk."""
    host = (urlparse(url).hostname or "").lower()
    parts = host.split(".")
    if len(parts) >= 3 and (parts[-2] in SECOND_LEVEL or len(parts[-2]) <= 2):
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def is_academic(domain):
    return bool(re.search(r"\.(?:edu|ac\.[a-z]{2}|edu\.[a-z]{2})$", domain))


def tokens(s):
    s = s.lower().replace("univ.", "university")
    return {t for t in re.split(r"[^a-z0-9]+", s) if len(t) > 2 and t not in GENERIC_TOKENS}


class Uni:
    """The ways a page might name a university: its words, acronym, or web domain."""

    def __init__(self, uni):
        self.name = uni["name"]
        self.domain = org_domain(uni["homepage"]) if uni.get("homepage") else ""
        self.words = tokens(uni["name"]) | tokens(uni["short"])
        self.aliases = set()
        for name in (uni["name"], uni["short"]):
            caps = "".join(w[0] for w in re.split(r"[\s-]+", name) if w[:1].isupper())
            if len(caps) >= 3:
                self.aliases.add(caps.lower())  # Carnegie Mellon University -> cmu
            self.aliases |= {w.lower() for w in re.findall(r"\b[A-Z]{3,6}\b", name)}  # "HKUST", "KAIST"
        stem = self.domain.split(".")[0]
        if len(stem) >= 3:
            self.aliases.add(stem)  # pku.edu.cn -> pku, ucsd.edu -> ucsd

    def named_in(self, text):
        low = text.lower()
        if self.domain and self.domain in low:
            return True
        words = set(re.findall(r"[a-z0-9]+", low))
        if self.aliases & words:
            return True
        return bool(self.words) and len(self.words & words) >= max(1, len(self.words) - 1)


def page_text(raw):
    raw = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(raw)).strip()


def snippet(text, match, width=110):
    start = max(0, match.start() - width // 2)
    return ("…" if start else "") + text[start: match.end() + width].strip() + "…"


def fetch(url, tries=3):
    """Return (final_url, html) or raise. Only reads the first 1.5 MB.

    DNS lookups fail spuriously when many run at once, so those are retried before
    we conclude a domain is really gone."""
    for attempt in range(tries):
        try:
            return _fetch(url)
        except urllib.error.URLError as e:
            if not isinstance(e.reason, socket.gaierror) or attempt == tries - 1:
                raise
            time.sleep(2 + 3 * attempt)


def _fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        body = resp.read(1_500_000)
        charset = resp.headers.get_content_charset()
        if not charset:
            m = re.search(rb"""<meta[^>]+charset=["']?([\w-]+)""", body[:4000], re.I)
            charset = m.group(1).decode() if m else "utf-8"
        try:
            "".encode(charset)
        except LookupError:
            charset = "utf-8"
        return resp.geturl(), body.decode(charset, errors="replace")


def forwarding_url(raw, text, base):
    """Where a 'this page has moved' page points to, if we can tell."""
    for rx in (META_REFRESH_RE, JS_REDIRECT_RE):
        m = rx.search(raw[:20000])
        if m:
            return urljoin(base, html.unescape(m.group(1)))
    m = PAGE_MOVED_RE.search(text)
    if not m:
        return ""
    # A web address written right after the notice ("This site has moved to viliam.lisy.me").
    u = TEXT_URL_RE.search(text[m.end(): m.end() + 120])
    if u:
        link = u.group(1).rstrip(".,;)")
        return link if link.startswith("http") else "https://" + link
    # Otherwise the first link after the notice in the HTML.
    rm = PAGE_MOVED_RE.search(raw)
    if rm:
        h = re.search(r"""href=["']([^"'#]+)["']""", raw[rm.end(): rm.end() + 1500], re.I)
        if h and not h.group(1).startswith("mailto:"):
            return urljoin(base, html.unescape(h.group(1)))
    return ""


def newest_year(text):
    years = [int(y) for y in YEAR_RE.findall(text) if int(y) <= THIS_YEAR + 1]
    return max(years) if years else 0


def find_move(text, uni):
    """A recent first-person statement of moving somewhere other than the listed university."""
    for m in MOVE_RE.finditer(text):
        window = text[m.start(): m.end() + 160]
        if uni.named_in(window):
            continue  # "I joined <listed university>" confirms the listing
        # Judge only the clause about the move, not "…, and I'm recruiting students".
        sentence = re.split(r"[.!?;](?:\s|$)|[—–(]|,? and I|, and ", window, maxsplit=1)[0]
        if "join" in m.group(0).lower() and not JOB_RE.search(sentence):
            continue
        if NOT_A_JOB_RE.search(sentence):
            continue
        # Dated news: "June 2014: I am joining UCLA" is history.
        years = [int(y) for y in YEAR_RE.findall(text[max(0, m.start() - 80): m.end() + 160])]
        if years and max(years) <= OLD_NEWS_YEAR:
            continue
        return m
    return None


def find_emeritus(text, prof, uni):
    """'Professor Emeritus' about this person at the listed university (not a colleague on a directory page)."""
    last = re.compile(r"\b" + re.escape(prof["name"].split()[-1]) + r"\b", re.I)
    for m in EMERITUS_RE.finditer(text):
        if last.search(text[max(0, m.start() - 60): m.end() + 60]) and uni.named_in(text[max(0, m.start() - 250): m.end() + 250]):
            return m
    return None


def check(prof, uni_row):
    """Decide whether the homepage still places this professor at their listed university."""
    url = prof["homepage"]
    result = {"checked": date.today().isoformat(), "url": url, "v": CHECK_VERSION}
    if not re.match(r"https?://", url or ""):
        return dict(result, status=UNKNOWN, note="No homepage on record.")
    return dict(result, **check_page(url, prof, Uni(uni_row), hops=2))


def check_page(url, prof, uni, hops):
    try:
        final_url, raw = fetch(url)
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return dict(status=GONE, note=f"Homepage link is broken (HTTP {e.code}).")
        return dict(status=UNKNOWN, note=f"Homepage returned HTTP {e.code}; couldn't check.")
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.gaierror):
            return dict(status=GONE, note="Homepage link is broken (domain no longer exists).")
        return dict(status=UNKNOWN, note="Homepage didn't respond; couldn't check.")
    except Exception:
        return dict(status=UNKNOWN, note="Homepage didn't respond; couldn't check.")

    text = page_text(raw)

    # "This page has moved to …": judge the new page instead.
    nxt = forwarding_url(raw, text, final_url)
    if nxt and hops and nxt.rstrip("/") != final_url.rstrip("/"):
        return check_page(nxt, prof, uni, hops - 1)

    # Move claims on a page nobody has updated in years are old news.
    newest = newest_year(text)
    stale = newest and newest < THIS_YEAR - 3
    m = None if stale else find_move(text, uni)
    if m:
        return dict(status=MOVED, note="Homepage mentions a move: " + snippet(text, m), final=final_url)
    m = find_emeritus(text, prof, uni)
    if m:
        return dict(status=MOVED, note="Homepage says Professor Emeritus (likely not taking students): " + snippet(text, m), final=final_url)

    if uni.named_in(text):
        # A page nobody has touched in years confirms little.
        if stale:
            return dict(status=UNKNOWN, note=f"Homepage names {uni.name} but looks out of date (nothing after {newest}).", final=final_url)
        return dict(status=OK, note=f"Homepage lists {uni.name}.", final=final_url)

    # Redirected off the listed university's site, and the new page doesn't name it
    # (so it's not just a rename like IST Austria -> ISTA).
    start_domain, end_domain = org_domain(url), org_domain(final_url)
    if uni.domain and start_domain == uni.domain and end_domain != uni.domain and is_academic(end_domain):
        if not re.search(r"\b" + re.escape(prof["name"].split()[-1]) + r"\b", text, re.I):
            # Landed on a generic page, not this person's new one.
            return dict(status=GONE, note=f"Homepage link is broken (redirects to a {end_domain} page that doesn't mention them).", final=final_url)
        return dict(status=MOVED, note=f"Homepage now redirects to {end_domain}.", final=final_url)
    if uni.domain and end_domain == uni.domain:
        return dict(status=OK, note=f"Homepage is hosted on {uni.domain}.", final=final_url)
    if len(text) < 300:
        # Probably rendered with JavaScript, so there's nothing to read.
        return dict(status=UNKNOWN, note="Homepage has too little text to check.", final=final_url)
    return dict(status=UNKNOWN, note=f"Homepage doesn't mention {uni.name}.", final=final_url)


def main():
    data = load_data()
    unis = data["universities"]
    faculty = data["faculty"]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None

    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    stale_before = (datetime.now() - timedelta(days=MAX_AGE_DAYS)).date().isoformat()

    def needs_check(p):
        c = cache.get(p["id"])
        return ("--refresh" in sys.argv or not c or c.get("v") != CHECK_VERSION
                or c.get("url") != p["homepage"] or c["checked"] < stale_before)

    todo = [p for p in faculty if needs_check(p)]
    print(f"{len(faculty)} faculty: {len(faculty) - len(todo)} checked recently, {len(todo)} due.")
    if limit:
        todo = todo[:limit]
        print(f"Checking the first {len(todo)} (--limit).")

    started, done = time.time(), 0
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(check, p, unis[p["uni"]]): p for p in todo}
        for fut in as_completed(futures):
            p = futures[fut]
            cache[p["id"]] = fut.result()
            done += 1
            if done % 100 == 0 or done == len(todo):
                CACHE.write_text(json.dumps(cache), encoding="utf-8")
                print(f"  {done}/{len(todo)}  ({time.time() - started:.0f}s)")

    # Only ship entries for people still in the dataset.
    ids = {p["id"] for p in faculty}
    out = {pid: {k: v for k, v in c.items() if k in ("status", "checked", "note", "final")}
           for pid, c in cache.items() if pid in ids}
    counts = {}
    for c in out.values():
        counts[c["status"]] = counts.get(c["status"], 0) + 1

    payload = json.dumps({"generated": date.today().isoformat(), "byId": out}, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(f"window.UNISWEEP_AFFILIATIONS = {payload};\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: " + ", ".join(f"{n} {s}" for s, n in sorted(counts.items())))


if __name__ == "__main__":
    main()
