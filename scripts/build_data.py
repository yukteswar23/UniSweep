"""
UniSweep data builder.

Downloads the open CSRankings dataset (https://github.com/emeryberger/CSrankings),
keeps only faculty who publish in top AI venues, and writes data/data.js,
which the website loads directly (no server needed).

Run from the project folder:
    python scripts/build_data.py

Re-run it every few months to refresh the faculty lists.
"""

import csv
import io
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
OUT = ROOT / "data" / "data.js"
SOURCE = "https://raw.githubusercontent.com/emeryberger/CSrankings/gh-pages/"

# Only count papers from this year onward, so the scores reflect current activity.
SINCE_YEAR = 2016
# A professor needs at least this much top-venue AI output to be included.
MIN_FACULTY_SCORE = 1.0

# Each UniSweep research field is defined by the top conferences in that field.
FIELDS = {
    "ml":       {"name": "Machine Learning",       "venues": ["nips", "icml", "iclr"]},
    "cv":       {"name": "Computer Vision",        "venues": ["cvpr", "iccv", "eccv"]},
    "nlp":      {"name": "NLP & LLMs",             "venues": ["acl", "emnlp", "naacl"]},
    "robotics": {"name": "Robotics & Embodied AI", "venues": ["icra", "iros", "rss"]},
    "ai":       {"name": "AI, Reasoning & Agents", "venues": ["aaai", "ijcai"]},
    "mining":   {"name": "Data Mining",            "venues": ["kdd"]},
    "ir":       {"name": "Search & Recommender",   "venues": ["sigir", "www"]},
}
FIELD_KEYS = list(FIELDS)
VENUE_TO_FIELD = {v: k for k, f in FIELDS.items() for v in f["venues"]}

# CSRankings shortens names ("Univ. of ..."); expand them for display.
NAME_FIXES = [
    (r"\bUniv\.", "University"),
    (r"\bInst\.", "Institute"),
    (r"\bTech\.", "Technology"),
    (r"\bSci\.", "Science"),
]
COUNTRY_CODE_FIXES = {"uk": "gb"}


def fetch(name):
    """Download a CSRankings file once and keep a local copy."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists() or "--refresh" in sys.argv:
        print(f"Downloading {name} ...")
        with urllib.request.urlopen(SOURCE + name, timeout=120) as resp:
            path.write_bytes(resp.read())
    return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8"))))


def display_name(name):
    for pattern, repl in NAME_FIXES:
        name = re.sub(pattern, repl, name)
    return name.replace(" - ", " ")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def valid_orcid(orcid):
    return orcid if orcid and orcid != "0000-0000-0000-0000" else ""


def main():
    pubs = fetch("generated-author-info.csv")
    people = fetch("csrankings.csv")
    institutions = fetch("institutions.csv")
    countries = fetch("countries.csv")

    country_names = {c["alpha_2"].lower(): c["name"] for c in countries}
    inst_info = {i["institution"]: i for i in institutions}

    # Sum each person's adjusted publication count per field (CSRankings splits
    # credit between co-authors, so this rewards actually doing the work).
    scores = defaultdict(lambda: defaultdict(float))
    last_year = defaultdict(int)
    for row in pubs:
        field = VENUE_TO_FIELD.get(row["area"])
        year = int(row["year"])
        if not field or year < SINCE_YEAR:
            continue
        key = (row["name"], row["dept"])
        scores[key][field] += float(row["adjustedcount"])
        last_year[key] = max(last_year[key], year)

    profiles = {(p["name"], p["affiliation"]): p for p in people}

    faculty = []
    seen = set()  # the same person can appear under several name spellings
    for (name, dept), by_field in scores.items():
        total = sum(by_field.values())
        if total < MIN_FACULTY_SCORE:
            continue
        p = profiles.get((name, dept), {})
        scholar = p.get("scholarid", "")
        if scholar in ("", "NOSCHOLARPAGE"):
            scholar = ""
        dedupe_key = (dept, scholar or name)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        faculty.append({
            "name": re.sub(r"\s\d{4}$", "", name),  # drop DBLP disambiguation suffixes
            "dept": dept,
            "homepage": p.get("homepage", ""),
            "scholar": scholar,
            "orcid": valid_orcid(p.get("orcid", "")),
            "scores": [round(by_field.get(f, 0.0), 1) for f in FIELD_KEYS],
            "total": round(total, 1),
            "lastYear": last_year[(name, dept)],
        })

    # Group faculty into universities.
    unis = {}
    for f in faculty:
        dept = f["dept"]
        if dept not in unis:
            info = inst_info.get(dept, {})
            cc = COUNTRY_CODE_FIXES.get(info.get("countryabbrv", ""), info.get("countryabbrv", ""))
            unis[dept] = {
                "id": slugify(dept),
                "name": display_name(dept),
                "short": dept,
                "region": info.get("region", ""),
                "country": cc.upper(),
                "countryName": country_names.get(cc, ""),
                "homepage": info.get("homepage", ""),
                "scores": [0.0] * len(FIELD_KEYS),
                "faculty": [],
            }
        u = unis[dept]
        u["faculty"].append(f)
        u["scores"] = [a + b for a, b in zip(u["scores"], f["scores"])]

    uni_list = sorted(unis.values(), key=lambda u: -sum(u["scores"]))
    uni_index = {u["short"]: i for i, u in enumerate(uni_list)}

    # Compact output: faculty refer to their university by index.
    out_faculty = []
    used_ids = set()
    for u in uni_list:
        u["faculty"].sort(key=lambda f: -f["total"])
        for f in u["faculty"]:
            fid = base_id = slugify(f"{f['name']}-{u['id']}")
            n = 2
            while fid in used_ids:
                fid, n = f"{base_id}-{n}", n + 1
            used_ids.add(fid)
            out_faculty.append({
                "id": fid,
                "name": f["name"],
                "uni": uni_index[f["dept"]],
                "homepage": f["homepage"],
                "scholar": f["scholar"],
                "orcid": f["orcid"],
                "scores": f["scores"],
                "total": f["total"],
                "lastYear": f["lastYear"],
            })
        u["facultyCount"] = len(u["faculty"])
        u["scores"] = [round(s, 1) for s in u["scores"]]
        u["total"] = round(sum(u["scores"]), 1)
        del u["faculty"]

    data = {
        "generated": date.today().isoformat(),
        "sinceYear": SINCE_YEAR,
        "fields": [{"key": k, "name": FIELDS[k]["name"], "venues": FIELDS[k]["venues"]} for k in FIELD_KEYS],
        "universities": uni_list,
        "faculty": out_faculty,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(f"window.UNISWEEP_DATA = {payload};\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(uni_list)} universities, "
          f"{len(out_faculty)} faculty, {len(payload) // 1024} KB")


if __name__ == "__main__":
    main()
