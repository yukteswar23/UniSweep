// Live paper data from OpenAlex (https://openalex.org), a free open index of research.
// Responses are cached in your browser for 3 days so revisiting a page costs nothing.
(function () {
  const BASE = "https://api.openalex.org";
  const TTL = 3 * 24 * 3600 * 1000;
  const ZENODO = "S4306400562";
  const WORK_FIELDS = "id,title,publication_date,primary_location,doi,cited_by_count,primary_topic,abstract_inverted_index,authorships";

  function cacheGet(url) {
    try {
      const hit = JSON.parse(localStorage.getItem("oa:" + url));
      if (hit && Date.now() - hit.t < TTL) return hit.v;
    } catch (e) { /* ignore */ }
    return null;
  }

  function cacheSet(url, value) {
    try {
      localStorage.setItem("oa:" + url, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) {
      // Storage full: drop old OpenAlex entries and carry on without caching.
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("oa:")).forEach((k) => localStorage.removeItem(k));
      } catch (e2) { /* ignore */ }
    }
  }

  async function get(path) {
    const url = BASE + path;
    const cached = cacheGet(url);
    if (cached) return cached;
    const key = Store.get().settings.openalexKey;
    const res = await fetch(key ? url + (url.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(key) : url);
    if (res.status === 429) throw new Error("OpenAlex's free daily limit was reached. Add a free API key in Settings to keep going.");
    if (!res.ok) throw new Error("OpenAlex returned an error (" + res.status + ").");
    const json = await res.json();
    cacheSet(url, json);
    return json;
  }

  function abstractText(inv) {
    if (!inv) return "";
    const words = [];
    for (const [word, positions] of Object.entries(inv)) positions.forEach((p) => (words[p] = word));
    return words.join(" ");
  }

  function normalizeWork(w) {
    const loc = w.primary_location || {};
    const landing = loc.landing_page_url || (w.doi ? w.doi : w.id);
    return {
      id: w.id,
      title: w.title || "Untitled",
      date: w.publication_date || "",
      venue: (loc.source && loc.source.display_name) || "",
      url: landing,
      pdf: loc.pdf_url || "",
      citations: w.cited_by_count || 0,
      topic: (w.primary_topic && w.primary_topic.display_name) || "",
      abstract: abstractText(w.abstract_inverted_index),
      authors: (w.authorships || []).map((a) => a.author && a.author.display_name).filter(Boolean),
    };
  }

  // Data-dump repositories attach many unreviewed uploads to big companies; hide them.
  const isNoise = (w) => /zenodo|figshare|researchgate|ssrn\.com/i.test(w.url + " " + w.venue);

  function tokens(s) {
    return new Set(s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((t) => t.length > 2 && !["university", "the", "and", "institute", "technology", "college"].includes(t)));
  }

  // Find the OpenAlex author record for a professor: by ORCID when we have it,
  // otherwise by name, picking the candidate whose institution matches.
  const AUTHOR_FIELDS = "&select=id,display_name,works_count,cited_by_count,summary_stats,topics,last_known_institutions,affiliations,orcid";

  async function findAuthor(prof, uni) {
    if (prof.orcid) {
      // One ORCID can be attached to several OpenAlex records (including tiny
      // mis-merged ones), so take the record whose name matches with the most papers.
      const res = await get("/authors?filter=orcid:" + prof.orcid + "&per_page=10" + AUTHOR_FIELDS);
      const nameTokens = tokens(prof.name);
      const nameMatch = (a) => [...nameTokens].every((t) => tokens(a.display_name).has(t));
      const sorted = res.results.slice().sort((a, b) => nameMatch(b) - nameMatch(a) || b.works_count - a.works_count);
      if (sorted.length) return sorted[0];
    }
    const res = await get("/authors?search=" + encodeURIComponent(prof.name) + "&per_page=10" + AUTHOR_FIELDS);
    const want = new Set([...tokens(uni.name), ...tokens(uni.short)]);
    let best = null, bestScore = -1;
    for (const a of res.results) {
      const insts = [...(a.last_known_institutions || []), ...(a.affiliations || []).map((x) => x.institution)];
      let overlap = 0;
      insts.forEach((i) => tokens((i && i.display_name) || "").forEach((t) => want.has(t) && overlap++));
      const score = overlap * 1000 + Math.log10(1 + (a.works_count || 0));
      if (score > bestScore) { best = a; bestScore = score; }
    }
    return best;
  }

  async function works(filter, sort, perPage) {
    const res = await get("/works?filter=" + filter + "&sort=" + sort + "&per_page=" + (perPage || 20) + "&select=" + WORK_FIELDS);
    return res.results.map(normalizeWork).filter((w) => !isNoise(w));
  }

  window.OpenAlex = {
    findAuthor,
    // Restricted to computer science: OpenAlex sometimes merges same-name researchers
    // from other fields into one profile, and this hides most of those papers.
    authorWorks: (authorId, sort) => works("author.id:" + authorId.split("/").pop() + ",primary_topic.field.id:17", sort || "publication_date:desc", 20),
    // "Most cited" for a lab means most cited among the last 12 months of papers.
    labWorks(ids, sort) {
      // Computer-science papers and preprints only, excluding Zenodo software/data uploads.
      let filter = "institutions.id:" + ids.join("|") + ",primary_topic.field.id:17,type:article|preprint,primary_location.source.id:!" + ZENODO;
      if (sort && sort.startsWith("cited")) {
        const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        filter += ",from_publication_date:" + since;
      }
      return works(filter, sort || "publication_date:desc", 40);
    },
  };
})();
