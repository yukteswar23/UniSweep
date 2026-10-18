// App shell: routing, header, quick search (Ctrl/⌘+K), theme and shared click handling.
(function () {
  const { unis, faculty, LABS, FIELDS, esc, norm, initials, uniMark, monoStyle, topFields, icon, location, toast } = UI;
  const root = document.getElementById("app");

  // ---------- Router ----------
  const ROUTES = [
    [/^\/?$/, () => Views.home],
    [/^\/universities$/, () => Views.universities],
    [/^\/u\/([^/]+)$/, () => Views.university, ["id"]],
    [/^\/faculty$/, () => Views.facultyDirectory],
    [/^\/p\/([^/]+)$/, () => Views.professor, ["id"]],
    [/^\/areas$/, () => Views.areas],
    [/^\/area\/([^/]+)$/, () => Views.area, ["key"]],
    [/^\/labs$/, () => Views.labs],
    [/^\/lab\/([^/]+)$/, () => Views.lab, ["id"]],
    [/^\/shortlist$/, () => Views.shortlist],
    [/^\/settings$/, () => Views.settings],
  ];

  function parseHash() {
    const raw = window.location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    return { path, query: new URLSearchParams(qs || "") };
  }

  function render(opts) {
    const { path, query } = parseHash();
    let view = Views.notFound("Page");
    for (const [re, getView, names] of ROUTES) {
      const m = path.match(re);
      if (m) {
        const params = {};
        (names || []).forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
        view = getView()(params, query);
        break;
      }
    }
    const y = window.scrollY;
    root.innerHTML = view.html;
    document.title = view.title;
    if (view.mount) view.mount(root);
    window.scrollTo(0, opts && opts.keepScroll ? y : 0);
    updateNav(path);
  }

  function updateNav(path) {
    const section = "/" + (path.split("/")[1] || "");
    const map = { "/u": "/universities", "/p": "/faculty", "/area": "/areas", "/lab": "/labs" };
    const active = map[section] || section;
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + active));
    const n = Store.savedCount();
    document.getElementById("saved-count").innerHTML = n ? `<span class="badge">${n}</span>` : "";
  }

  // ---------- Quick search palette ----------
  const backdrop = document.getElementById("palette");
  const pInput = document.getElementById("palette-input");
  const pResults = document.getElementById("palette-results");
  let items = [];
  let selected = 0;

  const PAGES = [
    { label: "Universities", sub: "Rank and filter universities", href: "#/universities", ic: "building" },
    { label: "Faculty", sub: "All AI professors", href: "#/faculty", ic: "user" },
    { label: "Research areas", sub: "ML, Vision, NLP & LLMs, Robotics…", href: "#/areas", ic: "spark" },
    { label: "Industry labs", sub: "OpenAI, Anthropic, DeepMind, NVIDIA…", href: "#/labs", ic: "flask" },
    { label: "Shortlist", sub: "Professors you've saved", href: "#/shortlist", ic: "star" },
    { label: "Top US universities", sub: "Universities in the United States", href: "#/universities?region=us", ic: "building" },
    { label: "Top Indian universities", sub: "IITs, IISc, IIITs and more", href: "#/universities?region=in", ic: "building" },
  ];

  function search(q) {
    const nq = norm(q.trim());
    if (!nq) return { pages: PAGES, unis: unis.slice(0, 5), people: [], labs: [] };
    const starts = (s) => s.startsWith(nq) || s.includes(" " + nq);
    const uni = unis.filter((u) => u.search.includes(nq)).sort((a, b) => starts(b.search) - starts(a.search) || a.index - b.index).slice(0, 6);
    const people = faculty.filter((p) => p.search.includes(nq)).sort((a, b) => starts(b.search) - starts(a.search) || b.total - a.total).slice(0, 8);
    const labs = LABS.filter((l) => norm(l.name + " " + l.tags.join(" ")).includes(nq)).slice(0, 4);
    const fields = FIELDS.filter((f) => norm(f.name).includes(nq)).map((f) => ({ label: f.name, sub: "Research area", href: "#/area/" + f.key, ic: f.icon }));
    const pages = fields.concat(PAGES.filter((pg) => norm(pg.label).includes(nq)));
    return { pages, unis: uni, people, labs };
  }

  function renderPalette() {
    const r = search(pInput.value);
    items = [];
    const group = (title, list, fn) => (list.length ? `<div class="palette-group">${title}</div>` + list.map(fn).join("") : "");
    const item = (href, mono, title, sub, cls) => {
      const i = items.push(href) - 1;
      return `<a class="palette-item ${cls || ""}" data-i="${i}" href="${esc(href)}">${mono}<div class="meta"><div>${esc(title)}</div><div>${esc(sub)}</div></div>${icon("arrow", "faint")}</a>`;
    };
    const html =
      group(pInput.value.trim() ? "Universities" : "Top universities", r.unis, (u) => item("#/u/" + u.id, `<div class="monogram" style="${monoStyle(u.name)}">${esc(uniMark(u))}</div>`, u.name, `${location(u)} · ${u.facultyCount} AI faculty`)) +
      group("Professors", r.people, (p) => item("#/p/" + p.id, `<div class="monogram" style="${monoStyle(p.name)}">${esc(initials(p.name))}</div>`, p.name, `${p.u.name} · ${topFields(p.scores, 2).map((f) => f.name).join(", ")}`, "avatar-item")) +
      group("Industry labs", r.labs, (l) => item("#/lab/" + l.id, `<div class="monogram" style="${monoStyle(l.name)}">${esc(initials(l.name))}</div>`, l.name, l.tags.join(" · "))) +
      group("Go to", r.pages, (pg) => item(pg.href, `<div class="monogram" style="background:var(--surface-2);color:var(--text)">${icon(pg.ic)}</div>`, pg.label, pg.sub));
    pResults.innerHTML = html || `<div class="empty"><h3>No matches</h3><p>Try a university acronym like “CMU”, “MIT” or “IISc”.</p></div>`;
    selected = 0;
    highlight();
  }

  function highlight() {
    pResults.querySelectorAll(".palette-item").forEach((el) => el.classList.toggle("selected", Number(el.dataset.i) === selected));
    const el = pResults.querySelector(`[data-i="${selected}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  function openPalette(initial) {
    backdrop.classList.add("open");
    pInput.value = initial || "";
    renderPalette();
    setTimeout(() => pInput.focus(), 0);
  }
  function closePalette() { backdrop.classList.remove("open"); }

  pInput.addEventListener("input", renderPalette);
  pInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(selected + 1, items.length - 1); highlight(); }
    if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(selected - 1, 0); highlight(); }
    if (e.key === "Enter" && items[selected]) { window.location.hash = items[selected].slice(1); closePalette(); }
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.closest(".palette-item")) closePalette();
  });
  pResults.addEventListener("mousemove", (e) => {
    const el = e.target.closest(".palette-item");
    if (el && Number(el.dataset.i) !== selected) { selected = Number(el.dataset.i); highlight(); }
  });

  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); openPalette(""); }
    if (e.key === "Escape") closePalette();
  });

  // ---------- Theme ----------
  function applyTheme() {
    const saved = Store.get().settings.theme;
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.getElementById("theme-btn").innerHTML = icon(dark ? "sun" : "moon");
  }
  document.getElementById("theme-btn").addEventListener("click", () => {
    Store.setSetting("theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    applyTheme();
  });

  // ---------- Shared clicks (stars, abstracts) ----------
  document.addEventListener("click", (e) => {
    const star = e.target.closest("[data-star]");
    if (star) {
      e.preventDefault();
      const id = star.dataset.id;
      if (star.dataset.star === "uni") Store.toggleUni(id); else Store.toggleFaculty(id);
      const on = star.dataset.star === "uni" ? Store.isUniSaved(id) : Store.isSaved(id);
      star.classList.toggle("on", on);
      star.innerHTML = icon(on ? "starFill" : "star");
      toast(on ? "Added to shortlist" : "Removed from shortlist");
      return;
    }
    const tog = e.target.closest("[data-toggle-abstract]");
    if (tog) {
      const abs = tog.closest(".paper").querySelector(".paper-abstract");
      abs.hidden = !abs.hidden;
      tog.textContent = abs.hidden ? "Show abstract" : "Hide abstract";
    }
    if (e.target.closest("#search-btn")) openPalette("");
  });

  Store.onChange(() => updateNav(parseHash().path));
  window.addEventListener("hashchange", () => render());

  window.App = { rerender: render, openPalette };
  applyTheme();
  render();
})();
