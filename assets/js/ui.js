// Shared helpers: data indexes, icons, and reusable card/row components.
(function () {
  const D = window.UNISWEEP_DATA;
  const LABS = window.UNISWEEP_LABS;

  // ---------- Data indexes ----------
  const FIELDS = D.fields.map((f, i) => Object.assign({ index: i, color: `var(--f-${f.key})` }, f, FIELD_INFO()[f.key]));
  const fieldByKey = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
  const unis = D.universities;
  const faculty = D.faculty;
  unis.forEach((u, i) => { u.index = i; u.rank = i + 1; u.people = []; });
  faculty.forEach((p) => { p.u = unis[p.uni]; p.u.people.push(p); });
  const uniById = Object.fromEntries(unis.map((u) => [u.id, u]));
  const facultyById = Object.fromEntries(faculty.map((p) => [p.id, p]));
  const labById = Object.fromEntries(LABS.map((l) => [l.id, l]));

  function FIELD_INFO() {
    return {
      ml: { short: "ML", icon: "brain", blurb: "Deep learning, optimization, generative models, reinforcement learning and learning theory." },
      cv: { short: "Vision", icon: "eye", blurb: "Image and video understanding, 3D vision, image/video generation and vision-language models." },
      nlp: { short: "NLP", icon: "chat", blurb: "Large language models, reasoning, alignment, translation, dialogue and evaluation." },
      robotics: { short: "Robotics", icon: "robot", blurb: "Robot learning, manipulation, navigation, embodied agents and RL for control." },
      ai: { short: "AI", icon: "spark", blurb: "Planning, search, multi-agent systems, knowledge representation and reasoning." },
      mining: { short: "Mining", icon: "graph", blurb: "Learning from large-scale data: graphs, time series, recommendation and applied ML." },
      ir: { short: "IR", icon: "search", blurb: "Search engines, recommender systems and web-scale information access." },
    };
  }

  const VENUE_NAMES = {
    nips: "NeurIPS", icml: "ICML", iclr: "ICLR", cvpr: "CVPR", iccv: "ICCV", eccv: "ECCV", acl: "ACL",
    emnlp: "EMNLP", naacl: "NAACL", icra: "ICRA", iros: "IROS", rss: "RSS", aaai: "AAAI", ijcai: "IJCAI",
    kdd: "KDD", sigir: "SIGIR", www: "WWW",
  };

  const REGIONS = [
    { key: "all", name: "All regions", test: () => true },
    { key: "us", name: "United States", test: (u) => u.country === "US" },
    { key: "ca", name: "Canada", test: (u) => u.country === "CA" },
    { key: "europe", name: "Europe", test: (u) => u.region === "europe" },
    { key: "uk", name: "United Kingdom", test: (u) => u.country === "GB" },
    { key: "asia", name: "Asia", test: (u) => u.region === "asia" },
    { key: "in", name: "India", test: (u) => u.country === "IN" },
    { key: "au", name: "Australia & NZ", test: (u) => u.region === "australasia" },
    { key: "other", name: "Latin America & Africa", test: (u) => u.region === "southamerica" || u.region === "africa" },
  ];
  const regionByKey = Object.fromEntries(REGIONS.map((r) => [r.key, r]));

  // ---------- Small helpers ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n * 10) / 10));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

  function uniMark(u) {
    const a = acronym(u.name);
    return a.length >= 2 && a.length <= 4 ? a : initials(u.name);
  }

  function initials(name) {
    const words = name.replace(/[^A-Za-zÀ-ɏ\s-]/g, " ").split(/[\s-]+/).filter((w) => w && !/^(of|the|and|at|de|di|du|la|le|der|für)$/i.test(w));
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  // Acronyms like CMU, MIT, UIUC, UCSD come straight from the name's capitals.
  function acronym(name) {
    return name.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("");
  }
  const EXTRA_ALIASES = { "University of Washington": "uw", "University of Texas at Austin": "ut austin", "Georgia Institute of Technology": "georgia tech gatech", "ETH Zurich": "eth", "University of Southern California": "usc" };
  unis.forEach((u) => {
    u.search = norm([u.name, u.short, u.countryName, acronym(u.name), EXTRA_ALIASES[u.name] || ""].join(" "));
  });
  faculty.forEach((p) => { p.search = norm(p.name); });

  function hue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }
  const monoStyle = (name) => `background:hsl(${hue(name)} 55% 46%)`;

  function topFields(scores, n) {
    return scores.map((s, i) => ({ s, f: FIELDS[i] })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n || 3).map((x) => x.f);
  }

  // ---------- Icons (inline SVG, stroke-based) ----------
  const ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    starFill: '<path fill="currentColor" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10a3 3 0 0 0 1 2.2A3 3 0 0 0 6 17a3 3 0 0 0 3 3V4z"/><path d="M15 4a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 10a3 3 0 0 1-1 2.2 3 3 0 0 1-1 4.8 3 3 0 0 1-3 3V4z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    graph: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="17" r="2"/><path d="m7.7 7.2 1.1 9M8 6.3l8 1.4M9.8 17.8l5.3-.6M17.8 10l-.6 5"/>',
    building: '<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/>',
  };
  const icon = (name, cls) => `<svg class="icon ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;

  // ---------- Components ----------
  function fieldBar(scores) {
    const total = scores.reduce((a, b) => a + b, 0) || 1;
    return `<div class="bar" title="${esc(FIELDS.map((f, i) => `${f.name}: ${scores[i]}`).join("\n"))}">${scores
      .map((s, i) => (s > 0 ? `<span style="width:${(100 * s) / total}%;background:${FIELDS[i].color}"></span>` : ""))
      .join("")}</div>`;
  }

  function fieldChip(f) {
    return `<span class="chip"><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</span>`;
  }

  function starButton(kind, id) {
    const on = kind === "uni" ? Store.isUniSaved(id) : Store.isSaved(id);
    return `<button class="star ${on ? "on" : ""}" data-star="${kind}" data-id="${esc(id)}" aria-label="${on ? "Remove from" : "Add to"} shortlist" title="${on ? "Saved to shortlist" : "Save to shortlist"}">${icon(on ? "starFill" : "star")}</button>`;
  }

  function location(u) {
    return u.countryName || (u.region ? u.region.replace("northamerica", "North America") : "");
  }

  function uniCard(u, field) {
    const tf = topFields(u.scores, 2);
    const score = field ? u.scores[field.index] : u.total;
    return `<a class="card" href="#/u/${esc(u.id)}">
      <div class="card-top">
        <div class="monogram" style="${monoStyle(u.name)}">${esc(uniMark(u))}</div>
        <div style="min-width:0;flex:1;padding-right:28px">
          <div class="card-title">${esc(u.name)}</div>
          <div class="card-sub">${esc(location(u))}</div>
        </div>
      </div>
      ${fieldBar(u.scores)}
      <div class="row-chips">${tf.map(fieldChip).join("")}</div>
      <div class="card-foot"><span>${u.facultyCount} AI faculty</span><span>${field ? esc(field.short) + " " : ""}score ${fmt(score)}</span></div>
      <span class="rank">#${u._rank || u.rank}</span>
    </a>`;
  }

  function facultyRow(p, field) {
    const tf = topFields(p.scores, 3);
    const score = field ? p.scores[field.index] : p.total;
    return `<div class="row">
      <a href="#/p/${esc(p.id)}" class="monogram avatar" style="${monoStyle(p.name)}">${esc(initials(p.name))}</a>
      <a href="#/p/${esc(p.id)}" style="min-width:0">
        <div class="row-name">${esc(p.name)}</div>
        <div class="row-sub">${esc(p.u.name)}</div>
      </a>
      <div class="row-chips">${tf.map(fieldChip).join("")}</div>
      <div class="row-score small muted" title="Credit-adjusted top-venue papers since ${D.sinceYear}">score ${fmt(score)}<br><span class="faint">active ${p.lastYear}</span></div>
      <div class="row-actions">${starButton("faculty", p.id)}</div>
    </div>`;
  }

  function labCard(l) {
    return `<a class="card" href="#/lab/${esc(l.id)}">
      <div class="card-top">
        <div class="monogram" style="${monoStyle(l.name)}">${esc(initials(l.name))}</div>
        <div style="min-width:0;flex:1">
          <div class="card-title">${esc(l.name)}</div>
          <div class="card-sub">${esc(l.hq)}</div>
        </div>
      </div>
      <p class="muted small">${esc(l.focus)}</p>
      <div class="row-chips">${l.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
    </a>`;
  }

  function paperItem(w, opts) {
    const authors = w.authors.slice(0, 5).join(", ") + (w.authors.length > 5 ? ` +${w.authors.length - 5} more` : "");
    const url = safeUrl(w.url);
    return `<article class="paper">
      <div class="paper-title">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(w.title)}</a>` : esc(w.title)}</div>
      ${authors ? `<div class="paper-authors">${esc(authors)}</div>` : ""}
      <div class="paper-meta">
        ${w.date ? `<span>${esc(w.date)}</span>` : ""}
        ${w.venue ? `<span>${esc(w.venue)}</span>` : ""}
        <span>${fmt(w.citations)} citations</span>
        ${w.topic ? `<span>${esc(w.topic)}</span>` : ""}
      </div>
      <div class="paper-actions">
        ${w.abstract ? `<button class="link-btn" data-toggle-abstract>Show abstract</button>` : ""}
        ${safeUrl(w.pdf) ? `<a class="link-btn" href="${esc(safeUrl(w.pdf))}" target="_blank" rel="noopener">PDF ↗</a>` : ""}
        ${opts && opts.selectable ? `<label class="check"><input type="checkbox" data-read-paper="${esc(w.id)}" ${opts.checked ? "checked" : ""}> I've read this — mention in email</label>` : ""}
      </div>
      ${w.abstract ? `<div class="paper-abstract" hidden>${esc(w.abstract)}</div>` : ""}
    </article>`;
  }

  function skeletonList(n) {
    return Array.from({ length: n || 4 }, () => `<div class="paper"><div class="skeleton" style="width:80%"></div><div class="skeleton" style="width:45%;margin-top:10px"></div></div>`).join("");
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  window.UI = {
    D, LABS, FIELDS, fieldByKey, unis, faculty, uniById, facultyById, labById, VENUE_NAMES, REGIONS, regionByKey,
    esc, fmt, norm, safeUrl, initials, uniMark, monoStyle, topFields, icon, location,
    fieldBar, fieldChip, starButton, uniCard, facultyRow, labCard, paperItem, skeletonList, toast,
  };
})();
