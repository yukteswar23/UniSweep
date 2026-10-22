
# UniSweep

Sweep the world's AI research, university by university. UniSweep helps you find
grad-school advisors in Machine Learning, Computer Vision, NLP & LLMs, Robotics / RL
and related fields, read their recent papers, and draft personal outreach emails.

## Open it

Double-click `index.html`. That's it: no install, no server.

Tip: press **Ctrl K** (or `/`) anywhere to search universities, professors and labs.

## What's inside

| Page | What you get |
|------|--------------|
| Universities | ~550 universities worldwide ranked by top-venue AI papers; filter by field and region (US, India, Europe…) |
| University page | Every AI professor there, their fields, and the university's rank in each field |
| Professor page | Research topics, citations, h-index, recent + most-cited papers (live), links, and an email drafter |
| Faculty | All ~6,900 AI professors, filterable by field and region |
| Research areas | Top universities and most active professors per field |
| Industry labs | Latest papers from OpenAI, Anthropic, DeepMind, NVIDIA, Meta, Microsoft and more |
| Shortlist | Professors you starred, with status (Interested → Emailed → Replied), notes and CSV export |
| Settings | Your profile for emails, optional OpenAlex API key, dark mode |

Your shortlist, notes and profile are saved in your browser only.

## Where the data comes from

- **Faculty and research fields:** [CSRankings](https://csrankings.org) (open data). A professor's
  score in a field = their credit-adjusted papers at that field's top conferences since 2016
  (e.g. NeurIPS/ICML/ICLR for ML, CVPR/ICCV/ECCV for Vision, ACL/EMNLP/NAACL for NLP).
- **Papers, topics, citations:** [OpenAlex](https://openalex.org), fetched live and cached for 3 days.
  Without an API key you share a small free daily budget; a free key from
  https://openalex.org/settings/api (paste it in Settings) gives you plenty.

### Refreshing the faculty data

```
python scripts/build_data.py --refresh
```

This re-downloads CSRankings and rewrites `data/data.js`. Field definitions and thresholds
are at the top of `scripts/build_data.py`.

### Checking that professors haven't moved

CSRankings can lag behind when someone changes university, which matters before you write
"I'm interested in joining X". Two checks guard against that:

- **Homepage check:** `python scripts/check_affiliations.py` visits every professor's homepage
  and writes `data/affiliations.js`. It looks for redirects to another university, phrases
  like "I have moved to…", and whether the page still names the listed university.
  Pages checked in the last 14 days are skipped, so re-running it is cheap; `--refresh` forces
  a full re-check (about 30–40 minutes).
- **Live OpenAlex check:** each professor page compares the university we list with the
  institution on their most recent papers.

The professor page shows the result at the top. If there are signs of a move, the email
drafter warns you before you send. Lists show a "may have moved" tag.

## Project layout

```
index.html              the page shell (header, search palette)
assets/css/styles.css   all styling (light + dark themes)
assets/js/labs.js       list of industry labs — add more here
assets/js/store.js      shortlist / profile saved in the browser
assets/js/openalex.js   live paper lookups
assets/js/ui.js         shared components (cards, rows, icons)
assets/js/views.js      one function per page
assets/js/app.js        routing, Ctrl K search, dark mode
data/data.js            generated faculty data (don't edit by hand)
data/affiliations.js    generated homepage checks (don't edit by hand)
scripts/build_data.py   builds data/data.js
scripts/check_affiliations.py  builds data/affiliations.js
```

## Known limitations

- OpenAlex sometimes merges people with the same name; papers are limited to computer
  science to reduce this, but double-check on the professor's homepage.
- Professor emails aren't in the data. Find them on their homepage.
- Reinforcement learning isn't its own conference area, so it shows up under ML and
  Robotics. Look for it in a professor's research topics.

## Ideas for next steps

- "Ask UniSweep": chat over the data ("who works on RL for robotics in Europe and is active?")
- AI-assisted email drafting from the professor's abstracts and your own paper
- Publish it online for free (GitHub Pages) so friends can use it
