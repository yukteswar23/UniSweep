// Page views. Each view returns { title, html, mount(root) }.
(function () {
  const { D, LABS, FIELDS, fieldByKey, unis, faculty, uniById, facultyById, labById, VENUE_NAMES, REGIONS, regionByKey,
    esc, fmt, norm, safeUrl, initials, uniMark, monoStyle, topFields, icon, location,
    fieldBar, fieldChip, starButton, uniCard, facultyRow, labCard, paperItem, skeletonList, toast } = UI;

  const PAGE = 48;

  // Keep filters in the URL (so links and the back button work) without re-rendering the page.
  function setQuery(path, params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "all")).toString();
    history.replaceState(null, "", "#" + path + (qs ? "?" + qs : ""));
  }

  function fieldPills(active, attr) {
    return `<div class="pills" role="tablist">
      <button class="pill ${!active ? "active" : ""}" data-${attr}="all">All AI fields</button>
      ${FIELDS.map((f) => `<button class="pill ${active === f.key ? "active" : ""}" data-${attr}="${f.key}"><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</button>`).join("")}
    </div>`;
  }

  function regionSelect(active) {
    return `<select class="select" data-region aria-label="Region">${REGIONS.map((r) => `<option value="${r.key}" ${active === r.key ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>`;
  }

  function legend() {
    return `<div class="legend">${FIELDS.map((f) => `<span><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</span>`).join("")}</div>`;
  }

  // ======================= Home =======================
  function home() {
    const topUS = unis.filter((u) => u.country === "US").slice(0, 8);
    const topWorld = unis.slice(0, 8);
    return {
      title: "UniSweep — AI research, university by university",
      html: `
      <section class="hero container">
        <div class="eyebrow">${icon("spark")} ${fmt(faculty.length)} AI faculty · ${unis.length} universities · ${LABS.length} industry labs</div>
        <h1>Sweep the world's AI research.<br><span class="soft">Find your advisor.</span></h1>
        <p>Search any university and see who works on machine learning, computer vision, LLMs, robotics and RL — with their latest papers, one click away.</p>
        <div class="hero-search">
          ${icon("search")}
          <input class="input" id="hero-q" placeholder="Search a university, professor or lab — try “CMU”, “IISc” or “Fei-Fei Li”" autocomplete="off">
        </div>
        <div class="pills">${FIELDS.map((f) => `<a class="pill" href="#/area/${f.key}"><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</a>`).join("")}</div>
      </section>

      <div class="container">
        <section class="section">
          <div class="section-head"><h2>Top AI universities in the US</h2><a href="#/universities?region=us">See all →</a></div>
          <div class="grid">${topUS.map((u, i) => uniCard(Object.assign(u, { _rank: i + 1 }))).join("")}</div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Top worldwide</h2><a href="#/universities">See all →</a></div>
          <div class="grid">${topWorld.map((u) => uniCard(Object.assign(u, { _rank: u.rank }))).join("")}</div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Explore by field</h2><a href="#/areas">All fields →</a></div>
          <div class="grid grid-sm">${FIELDS.map(fieldCard).join("")}</div>
        </section>

        <section class="section">
          <div class="section-head"><h2>What industry labs are publishing</h2><a href="#/labs">All labs →</a></div>
          <div class="grid">${LABS.slice(0, 6).map(labCard).join("")}</div>
        </section>

        <section class="section">
          <div class="section-head"><h2>How to use UniSweep for grad applications</h2></div>
          <div class="steps">
            <div class="step"><div class="num">1</div><h3>Sweep</h3><p>Filter universities by field and region. Open a university to see every AI professor and what they focus on.</p></div>
            <div class="step"><div class="num">2</div><h3>Read</h3><p>On a professor's page, skim recent and most-cited papers. Tick the ones you actually read.</p></div>
            <div class="step"><div class="num">3</div><h3>Shortlist</h3><p>Star professors, track status (reading → emailed → replied) and keep notes in your shortlist.</p></div>
            <div class="step"><div class="num">4</div><h3>Reach out</h3><p>Draft a specific, personal email that references their papers and your research — then send it yourself.</p></div>
          </div>
        </section>
      </div>`,
      mount(root) {
        const q = root.querySelector("#hero-q");
        q.addEventListener("focus", () => { q.blur(); App.openPalette(""); });
        q.addEventListener("keydown", (e) => { e.preventDefault(); App.openPalette(e.key.length === 1 ? e.key : ""); });
      },
    };
  }

  function fieldCard(f) {
    const best = unis.slice().sort((a, b) => b.scores[f.index] - a.scores[f.index]).slice(0, 3);
    return `<a class="card field-card" href="#/area/${f.key}">
      <div class="field-icon" style="background:color-mix(in srgb, ${f.color} 14%, transparent);color:${f.color}">${icon(f.icon)}</div>
      <h3>${esc(f.name)}</h3>
      <p>${esc(f.blurb)}</p>
      <div class="small faint">Top: ${best.map((u) => esc(u.name)).join(" · ")}</div>
    </a>`;
  }

  // ======================= Universities =======================
  function universities(params, query) {
    const st = { field: fieldByKey[query.get("field")] ? query.get("field") : "", region: regionByKey[query.get("region")] ? query.get("region") : "all", q: query.get("q") || "", sort: query.get("sort") || "score", limit: PAGE };

    function results() {
      const f = fieldByKey[st.field];
      const region = regionByKey[st.region];
      let list = unis.filter(region.test);
      if (st.sort === "faculty") list.sort((a, b) => b.facultyCount - a.facultyCount);
      else if (st.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
      else if (f) list.sort((a, b) => b.scores[f.index] - a.scores[f.index]);
      list.forEach((u, i) => (u._rank = i + 1));
      if (f) list = list.filter((u) => u.scores[f.index] > 0);
      if (st.q) { const q = norm(st.q); list = list.filter((u) => u.search.includes(q)); }
      return list;
    }

    function renderList(root) {
      const list = results();
      const f = fieldByKey[st.field];
      root.querySelector("#count").textContent = `${list.length} universities${f ? " active in " + f.name : ""}${st.region !== "all" ? " · " + regionByKey[st.region].name : ""}`;
      root.querySelector("#list").innerHTML = list.length
        ? `<div class="grid">${list.slice(0, st.limit).map((u) => uniCard(u, f)).join("")}</div>`
        : `<div class="empty"><h3>No universities match</h3><p>Try a different search or region.</p></div>`;
      root.querySelector("#more").innerHTML = list.length > st.limit ? `<button class="btn" data-more>Show more (${list.length - st.limit} left)</button>` : "";
      setQuery("/universities", { field: st.field, region: st.region, q: st.q, sort: st.sort === "score" ? "" : st.sort });
    }

    return {
      title: "Universities — UniSweep",
      html: `<div class="container page">
        <div class="page-head"><div><h1>Universities</h1><p>Ranked by top-venue AI publications since ${D.sinceYear} (credit split between co-authors, data from CSRankings). Pick a field to re-rank.</p></div></div>
        ${fieldPills(st.field, "field")}
        <div class="toolbar" style="margin-top:16px">
          <input class="input" data-q placeholder="Filter by name, e.g. Stanford, IIT, ETH" value="${esc(st.q)}">
          ${regionSelect(st.region)}
          <select class="select" data-sort aria-label="Sort">
            <option value="score" ${st.sort === "score" ? "selected" : ""}>Sort: AI score</option>
            <option value="faculty" ${st.sort === "faculty" ? "selected" : ""}>Sort: # AI faculty</option>
            <option value="name" ${st.sort === "name" ? "selected" : ""}>Sort: Name</option>
          </select>
        </div>
        ${legend()}
        <div class="result-count" id="count" style="margin-top:14px"></div>
        <div id="list"></div><div class="show-more" id="more"></div>
      </div>`,
      mount(root) {
        renderList(root);
        root.addEventListener("click", (e) => {
          const pill = e.target.closest("[data-field]");
          if (pill) {
            st.field = pill.dataset.field === "all" ? "" : pill.dataset.field;
            st.limit = PAGE;
            root.querySelectorAll("[data-field]").forEach((p) => p.classList.toggle("active", p === pill));
            renderList(root);
          }
          if (e.target.closest("[data-more]")) { st.limit += PAGE; renderList(root); }
        });
        root.querySelector("[data-q]").addEventListener("input", (e) => { st.q = e.target.value; st.limit = PAGE; renderList(root); });
        root.querySelector("[data-region]").addEventListener("change", (e) => { st.region = e.target.value; st.limit = PAGE; renderList(root); });
        root.querySelector("[data-sort]").addEventListener("change", (e) => { st.sort = e.target.value; renderList(root); });
      },
    };
  }

  // ======================= University detail =======================
  function university(params, query) {
    const u = uniById[params.id];
    if (!u) return notFound("University");
    const st = { field: fieldByKey[query.get("field")] ? query.get("field") : "", q: "", active: false };
    const total = u.scores.reduce((a, b) => a + b, 0) || 1;
    const fieldRank = (i) => 1 + unis.filter((x) => x.scores[i] > u.scores[i]).length;

    function renderList(root) {
      const f = fieldByKey[st.field];
      let list = u.people.slice();
      if (f) list = list.filter((p) => p.scores[f.index] > 0).sort((a, b) => b.scores[f.index] - a.scores[f.index]);
      if (st.active) list = list.filter((p) => p.lastYear >= new Date().getFullYear() - 1);
      if (st.q) { const q = norm(st.q); list = list.filter((p) => p.search.includes(q)); }
      root.querySelector("#count").textContent = `${list.length} faculty${f ? " in " + f.name : ""}`;
      root.querySelector("#list").innerHTML = list.length ? `<div class="list">${list.map((p) => facultyRow(p, f)).join("")}</div>` : `<div class="empty"><h3>No one matches</h3></div>`;
      setQuery("/u/" + u.id, { field: st.field });
    }

    return {
      title: u.name + " — UniSweep",
      html: `<div class="container page">
        <div class="crumbs"><a href="#/universities">Universities</a> / <span>${esc(u.name)}</span></div>
        <div class="detail-head">
          <div class="monogram lg" style="${monoStyle(u.name)}">${esc(uniMark(u))}</div>
          <div class="grow">
            <h1>${esc(u.name)}</h1>
            <div class="sub">${esc(location(u))} · #${u.rank} worldwide in AI · ${u.facultyCount} AI faculty</div>
            <div class="detail-actions">
              ${safeUrl(u.homepage) ? `<a class="btn btn-primary" href="${esc(u.homepage)}" target="_blank" rel="noopener">${icon("globe")} CS department site</a>` : ""}
              <a class="btn" href="https://www.google.com/search?q=${encodeURIComponent(u.name + " computer science graduate admissions PhD MS")}" target="_blank" rel="noopener">${icon("external")} Grad admissions</a>
              <button class="btn ${Store.isUniSaved(u.id) ? "saved" : ""}" data-save-uni>${icon(Store.isUniSaved(u.id) ? "starFill" : "star")} ${Store.isUniSaved(u.id) ? "Saved" : "Save university"}</button>
            </div>
          </div>
        </div>

        <div class="layout">
          <div>
            ${fieldPills(st.field, "field")}
            <div class="toolbar" style="margin-top:14px">
              <input class="input" data-q placeholder="Find a professor">
              <label class="check"><input type="checkbox" data-active> Published in ${new Date().getFullYear() - 1} or later</label>
            </div>
            <div class="result-count" id="count"></div>
            <div id="list"></div>
          </div>
          <aside class="side-sticky">
            <div class="panel">
              <h3>Research strength by field</h3>
              <div class="field-bars">${FIELDS.map((f, i) => u.scores[i] > 0 ? `
                <div class="field-bar-row">
                  <span><span class="dot" style="background:${f.color};display:inline-block;margin-right:8px"></span>${esc(f.name)}</span>
                  <span class="muted">#${fieldRank(i)} · ${fmt(u.scores[i])}</span>
                  <div class="bar"><span style="width:${(100 * u.scores[i]) / total}%;background:${f.color}"></span></div>
                </div>` : "").join("")}</div>
              <p class="small faint" style="margin-top:14px">Rank is worldwide in that field. Score = credit-adjusted papers at ${FIELDS.map((f) => f.venues.map((v) => VENUE_NAMES[v]).join("/")).join(", ")} since ${D.sinceYear}.</p>
            </div>
          </aside>
        </div>
      </div>`,
      mount(root) {
        renderList(root);
        root.addEventListener("click", (e) => {
          const pill = e.target.closest("[data-field]");
          if (pill) {
            st.field = pill.dataset.field === "all" ? "" : pill.dataset.field;
            root.querySelectorAll("[data-field]").forEach((p) => p.classList.toggle("active", p === pill));
            renderList(root);
          }
          if (e.target.closest("[data-save-uni]")) { Store.toggleUni(u.id); App.rerender(); }
        });
        root.querySelector("[data-q]").addEventListener("input", (e) => { st.q = e.target.value; renderList(root); });
        root.querySelector("[data-active]").addEventListener("change", (e) => { st.active = e.target.checked; renderList(root); });
      },
    };
  }

  // ======================= Faculty directory =======================
  function facultyDirectory(params, query) {
    const st = { field: fieldByKey[query.get("field")] ? query.get("field") : "", region: regionByKey[query.get("region")] ? query.get("region") : "all", q: query.get("q") || "", active: true, limit: 60 };

    function renderList(root) {
      const f = fieldByKey[st.field];
      const region = regionByKey[st.region];
      const recent = new Date().getFullYear() - 1;
      let list = faculty.filter((p) => region.test(p.u) && (!st.active || p.lastYear >= recent));
      if (f) list = list.filter((p) => p.scores[f.index] > 0).sort((a, b) => b.scores[f.index] - a.scores[f.index]);
      else list = list.slice().sort((a, b) => b.total - a.total);
      if (st.q) { const q = norm(st.q); list = list.filter((p) => p.search.includes(q) || p.u.search.includes(q)); }
      root.querySelector("#count").textContent = `${fmt(list.length)} professors`;
      root.querySelector("#list").innerHTML = list.length ? `<div class="list">${list.slice(0, st.limit).map((p) => facultyRow(p, f)).join("")}</div>` : `<div class="empty"><h3>No professors match</h3></div>`;
      root.querySelector("#more").innerHTML = list.length > st.limit ? `<button class="btn" data-more>Show more</button>` : "";
      setQuery("/faculty", { field: st.field, region: st.region, q: st.q });
    }

    return {
      title: "Faculty — UniSweep",
      html: `<div class="container page">
        <div class="page-head"><div><h1>Faculty</h1><p>Every AI professor in the index, ranked by top-venue output in the selected field. Star anyone to add them to your shortlist.</p></div></div>
        ${fieldPills(st.field, "field")}
        <div class="toolbar" style="margin-top:16px">
          <input class="input" data-q placeholder="Search by professor or university" value="${esc(st.q)}">
          ${regionSelect(st.region)}
          <label class="check"><input type="checkbox" data-active checked> Active recently</label>
        </div>
        <div class="result-count" id="count"></div>
        <div id="list"></div><div class="show-more" id="more"></div>
      </div>`,
      mount(root) {
        renderList(root);
        root.addEventListener("click", (e) => {
          const pill = e.target.closest("[data-field]");
          if (pill) {
            st.field = pill.dataset.field === "all" ? "" : pill.dataset.field;
            st.limit = 60;
            root.querySelectorAll("[data-field]").forEach((p) => p.classList.toggle("active", p === pill));
            renderList(root);
          }
          if (e.target.closest("[data-more]")) { st.limit += 60; renderList(root); }
        });
        root.querySelector("[data-q]").addEventListener("input", (e) => { st.q = e.target.value; st.limit = 60; renderList(root); });
        root.querySelector("[data-region]").addEventListener("change", (e) => { st.region = e.target.value; st.limit = 60; renderList(root); });
        root.querySelector("[data-active]").addEventListener("change", (e) => { st.active = e.target.checked; renderList(root); });
      },
    };
  }

  // ======================= Professor detail =======================
  function professor(params) {
    const p = facultyById[params.id];
    if (!p) return notFound("Professor");
    const u = p.u;
    const tf = topFields(p.scores, 3);
    const total = p.scores.reduce((a, b) => a + b, 0) || 1;
    const colleagues = u.people.filter((x) => x !== p && tf.length && x.scores[tf[0].index] > 0).slice(0, 6);
    const read = new Map((Store.get().read && Store.get().read[p.id]) || []);
    let author = null;
    let papers = { recent: null, cited: null };
    let openalexPlace = null; // { names, agrees } once OpenAlex has loaded

    // Is this person still at the university we list? Combines the homepage check
    // (scripts/check_affiliations.py) with OpenAlex's latest affiliation.
    function affiliationNotices() {
      const a = p.affil;
      const when = a && a.checked ? new Date(a.checked + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
      const out = [];
      if (a && a.status === "moved") out.push({ level: "warn", html: `<strong>Possible move.</strong> ${esc(a.note)} <span class="faint">(checked ${when})</span>` });
      if (openalexPlace && !openalexPlace.agrees) out.push({ level: "warn", html: `<strong>OpenAlex disagrees.</strong> Their most recent papers list them at ${esc(openalexPlace.names.join(", "))}, not ${esc(u.name)}.` });
      if (a && a.status === "ok") out.push({ level: out.length ? "" : "ok", html: `${icon("check")} Homepage confirms ${esc(u.name)} <span class="faint">(checked ${when})</span>${openalexPlace && openalexPlace.agrees && openalexPlace.names.length ? "; OpenAlex agrees" : ""}.` });
      else if (a && a.status === "gone") out.push({ level: "", html: `Homepage link is broken <span class="faint">(checked ${when})</span>, so we couldn't confirm they're still at ${esc(u.name)}.` });
      else if (a && a.status === "unknown") out.push({ level: "", html: `Couldn't verify from their homepage: ${esc(a.note)}` });
      else if (!a) out.push({ level: "", html: `Affiliation not verified yet.` });
      if (openalexPlace && openalexPlace.agrees && openalexPlace.names.length && !(a && a.status === "ok")) out.push({ level: out.some((n) => n.level === "warn") ? "" : "ok", html: `OpenAlex's latest papers list them at ${esc(openalexPlace.names.join(", "))}.` });
      return out;
    }

    function renderAffiliation(root) {
      const notices = affiliationNotices();
      root.querySelector("#affil-status").innerHTML = notices.map((n) => `<div class="notice ${n.level}">${n.html}</div>`).join("");
      const risky = notices.some((n) => n.level === "warn");
      const confirmed = !risky && notices.some((n) => n.level === "ok");
      root.querySelector("#email-affil").innerHTML = risky
        ? `<div class="notice warn" style="margin-bottom:14px"><strong>Check where they work before sending.</strong> This draft says you're interested in ${esc(u.name)}, but there are signs they may have moved (see the top of this page). Confirm on their homepage and edit the email if needed.</div>`
        : confirmed ? "" : `<div class="notice" style="margin-bottom:14px">We couldn't confirm they're still at ${esc(u.name)}. Take a quick look at their homepage before sending.</div>`;
    }

    function emailDraft() {
      const pr = Store.get().profile;
      const last = p.name.split(" ").pop();
      const topic = (author && author.topics && author.topics[0] && author.topics[0].display_name) || (tf[0] && tf[0].name) || "your research";
      const titles = [...read.values()];
      const subject = `Prospective ${pr.program || "PhD"} student — interest in ${topic}`;
      const lines = [
        `Dear Prof. ${last},`,
        "",
        `My name is ${pr.name || "[Your name]"}, a ${pr.year || "third-year"} ${pr.degree || "B.Tech student in Computer Science"} at ${pr.school || "[Your university]"}. I am applying to ${pr.program || "PhD"} programs for ${pr.term || "[Fall 20XX]"}, and your work on ${topic.toLowerCase()} is a big reason I am interested in ${u.name}.`,
        "",
        titles.length
          ? `I recently read ${titles.length === 1 ? "your paper" : "your papers"} ${titles.map((t) => `"${t}"`).join(" and ")}. [Write 1–2 specific sentences: what idea stood out to you, or a question it raised.]`
          : `[Mention one of their papers you read, and 1–2 specific sentences about what stood out to you. Tick papers above with "I've read this" to fill this in.]`,
        "",
        pr.summary ? `About my own work: ${pr.summary}` : `[1–2 sentences about your own research or projects and how they connect to the professor's work.]`,
        "",
        `Would you be taking new students in your group for the upcoming cycle? I would be grateful for the chance to discuss possible research directions. My CV is attached${pr.links ? ` and more of my work is at ${pr.links}` : ""}.`,
        "",
        "Thank you for your time.",
        "",
        "Best regards,",
        pr.name || "[Your name]",
      ];
      return { subject, body: lines.join("\n") };
    }

    function renderEmail(root) {
      const { subject, body } = emailDraft();
      root.querySelector("#email-subject").value = subject;
      root.querySelector("#email-body").value = body;
    }

    function renderPapers(root, which) {
      const box = root.querySelector("#papers");
      const list = papers[which];
      if (!list) return;
      box.innerHTML = list.length ? list.map((w) => paperItem(w, { selectable: true, checked: read.has(w.id) })).join("") : `<div class="notice">No papers found in OpenAlex for this person.</div>`;
    }

    async function loadPapers(root, which) {
      const box = root.querySelector("#papers");
      if (!author) return;
      if (!papers[which]) {
        box.innerHTML = skeletonList(5);
        try {
          papers[which] = await OpenAlex.authorWorks(author.id, which === "cited" ? "cited_by_count:desc" : "publication_date:desc");
        } catch (e) {
          box.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
          return;
        }
      }
      if (root.querySelector(".tab.active").dataset.tab === which) renderPapers(root, which);
    }

    async function loadAuthor(root) {
      const prof = root.querySelector("#profile");
      try {
        author = await OpenAlex.findAuthor(p, u);
      } catch (e) {
        prof.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
        root.querySelector("#papers").innerHTML = "";
        return;
      }
      if (author) {
        openalexPlace = OpenAlex.currentAffiliation(author, u);
        renderAffiliation(root);
      }
      if (!author) {
        prof.innerHTML = `<div class="notice">Couldn't find this professor on OpenAlex. Use their homepage or Google Scholar instead.</div>`;
        root.querySelector("#papers").innerHTML = "";
        return;
      }
      const stats = author.summary_stats || {};
      const topics = (author.topics || []).slice(0, 10);
      prof.innerHTML = `
        <div class="kv">
          <div><strong>${fmt(author.works_count || 0)}</strong><span>papers</span></div>
          <div><strong>${fmt(author.cited_by_count || 0)}</strong><span>citations</span></div>
          <div><strong>${stats.h_index != null ? stats.h_index : "—"}</strong><span>h-index</span></div>
        </div>
        ${topics.length ? `<h3 style="margin:18px 0 10px">Research topics</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${topics.map((t) => `<span class="chip">${esc(t.display_name)}</span>`).join("")}</div>` : ""}
        <p class="small faint" style="margin-top:14px">From <a href="${esc(author.id)}" target="_blank" rel="noopener" style="text-decoration:underline">OpenAlex</a>${p.orcid && String(author.orcid || "").endsWith(p.orcid) ? " (matched by ORCID)" : " (matched by name + university — double-check on their homepage)"}.</p>`;
      renderEmail(root);
      loadPapers(root, "recent");
    }

    const link = (href, label, ic) => (safeUrl(href) ? `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${icon(ic || "external")} ${label}</a>` : "");

    return {
      title: p.name + " — UniSweep",
      html: `<div class="container page">
        <div class="crumbs"><a href="#/universities">Universities</a> / <a href="#/u/${esc(u.id)}">${esc(u.name)}</a> / <span>${esc(p.name)}</span></div>
        <div class="detail-head">
          <div class="monogram lg avatar" style="${monoStyle(p.name)}">${esc(initials(p.name))}</div>
          <div class="grow">
            <h1>${esc(p.name)}</h1>
            <div class="sub"><a href="#/u/${esc(u.id)}" style="text-decoration:underline;text-underline-offset:3px">${esc(u.name)}</a> · ${esc(location(u))} · last top-venue paper ${p.lastYear}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${tf.map(fieldChip).join("")}</div>
            <div class="detail-actions">
              <button class="btn btn-primary ${Store.isSaved(p.id) ? "saved" : ""}" data-save-prof>${icon(Store.isSaved(p.id) ? "starFill" : "star")} ${Store.isSaved(p.id) ? "In shortlist" : "Add to shortlist"}</button>
              ${link(p.homepage, "Homepage", "globe")}
              ${p.scholar ? link("https://scholar.google.com/citations?user=" + encodeURIComponent(p.scholar), "Google Scholar") : ""}
              ${p.orcid ? link("https://orcid.org/" + p.orcid, "ORCID") : ""}
              <a class="btn" href="#email">${icon("mail")} Draft email</a>
            </div>
            <div id="affil-status"></div>
          </div>
        </div>

        <div class="layout">
          <div>
            <div class="panel">
              <div class="tabs">
                <button class="tab active" data-tab="recent">Recent papers</button>
                <button class="tab" data-tab="cited">Most cited</button>
              </div>
              <div id="papers">${skeletonList(5)}</div>
            </div>

            <div class="panel" id="email">
              <h3>${icon("mail")} Draft an outreach email</h3>
              <div id="email-affil"></div>
              <p class="small muted" style="margin-bottom:14px">Built from your <a href="#/settings" style="text-decoration:underline">profile</a> and the papers you ticked. Fill in the [brackets] yourself — specific, honest emails get replies; generic ones don't. Find their email address on their homepage.</p>
              <label class="field">Subject<input class="input" id="email-subject"></label>
              <label class="field" style="margin-top:12px">Message<textarea class="textarea" id="email-body" rows="16"></textarea></label>
              <div class="detail-actions">
                <button class="btn btn-primary" data-copy-email>${icon("copy")} Copy email</button>
                <button class="btn" data-gmail>${icon("external")} Open in Gmail</button>
                <button class="btn" data-mark-drafted>Mark as “Email drafted”</button>
              </div>
            </div>
          </div>

          <aside class="side-sticky">
            <div class="panel" id="profile"><div class="skeleton" style="height:64px"></div><div class="skeleton" style="margin-top:14px;width:70%"></div></div>
            <div class="panel">
              <h3>Top-venue publications by field</h3>
              <div class="field-bars">${FIELDS.map((f, i) => p.scores[i] > 0 ? `
                <div class="field-bar-row">
                  <span><span class="dot" style="background:${f.color};display:inline-block;margin-right:8px"></span>${esc(f.name)}</span>
                  <span class="muted">${fmt(p.scores[i])}</span>
                  <div class="bar"><span style="width:${(100 * p.scores[i]) / total}%;background:${f.color}"></span></div>
                </div>` : "").join("")}</div>
              <p class="small faint" style="margin-top:12px">Credit-adjusted papers since ${D.sinceYear} (CSRankings).</p>
            </div>
            ${colleagues.length ? `<div class="panel"><h3>Also at ${esc(u.short)} in ${esc(tf[0].name)}</h3>
              ${colleagues.map((c) => `<a href="#/p/${esc(c.id)}" class="palette-item avatar-item"><div class="monogram" style="${monoStyle(c.name)}">${esc(initials(c.name))}</div><div class="meta"><div>${esc(c.name)}</div><div>${topFields(c.scores, 2).map((f) => esc(f.name)).join(" · ")}</div></div></a>`).join("")}
            </div>` : ""}
          </aside>
        </div>
      </div>`,
      mount(root) {
        renderEmail(root);
        renderAffiliation(root);
        loadAuthor(root);
        root.addEventListener("click", (e) => {
          const tab = e.target.closest("[data-tab]");
          if (tab) {
            root.querySelectorAll("[data-tab]").forEach((t) => t.classList.toggle("active", t === tab));
            if (papers[tab.dataset.tab]) renderPapers(root, tab.dataset.tab);
            else loadPapers(root, tab.dataset.tab);
          }
          if (e.target.closest("[data-save-prof]")) { Store.toggleFaculty(p.id); App.rerender({ keepScroll: true }); }
          if (e.target.closest("[data-copy-email]")) {
            const text = `Subject: ${root.querySelector("#email-subject").value}\n\n${root.querySelector("#email-body").value}`;
            navigator.clipboard.writeText(text).then(() => toast("Email copied"), () => toast("Couldn't copy — select the text manually"));
          }
          if (e.target.closest("[data-gmail]")) {
            const url = "https://mail.google.com/mail/?view=cm&fs=1&su=" + encodeURIComponent(root.querySelector("#email-subject").value) + "&body=" + encodeURIComponent(root.querySelector("#email-body").value);
            window.open(url, "_blank", "noopener");
          }
          if (e.target.closest("[data-mark-drafted]")) {
            if (!Store.isSaved(p.id)) Store.toggleFaculty(p.id);
            Store.updateFaculty(p.id, { status: "Email drafted" });
            toast("Saved to shortlist as “Email drafted”");
          }
          if (e.target.closest('a[href="#email"]')) {
            e.preventDefault();
            root.querySelector("#email").scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
        root.addEventListener("change", (e) => {
          const box = e.target.closest("[data-read-paper]");
          if (!box) return;
          const all = [...(papers.recent || []), ...(papers.cited || [])];
          const w = all.find((x) => x.id === box.dataset.readPaper);
          if (box.checked && w) read.set(w.id, w.title);
          else read.delete(box.dataset.readPaper);
          Store.setRead(p.id, [...read.entries()]);
          renderEmail(root);
        });
      },
    };
  }

  // ======================= Research areas =======================
  function areas() {
    return {
      title: "Research areas — UniSweep",
      html: `<div class="container page">
        <div class="page-head"><div><h1>Research areas</h1><p>Each field is defined by its top conferences. Reinforcement learning work shows up mainly under Machine Learning and Robotics — look for it in each professor's research topics.</p></div></div>
        <div class="grid grid-sm">${FIELDS.map(fieldCard).join("")}</div>
      </div>`,
    };
  }

  function area(params) {
    const f = fieldByKey[params.key];
    if (!f) return notFound("Field");
    const topU = unis.slice().sort((a, b) => b.scores[f.index] - a.scores[f.index]);
    topU.forEach((u, i) => (u._rank = i + 1));
    const recent = new Date().getFullYear() - 1;
    const topP = faculty.filter((p) => p.lastYear >= recent).sort((a, b) => b.scores[f.index] - a.scores[f.index]).slice(0, 15);
    return {
      title: f.name + " — UniSweep",
      html: `<div class="container page">
        <div class="crumbs"><a href="#/areas">Research areas</a> / <span>${esc(f.name)}</span></div>
        <div class="detail-head">
          <div class="monogram lg" style="background:${f.color}">${icon(f.icon)}</div>
          <div class="grow">
            <h1>${esc(f.name)}</h1>
            <div class="sub">${esc(f.blurb)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${f.venues.map((v) => `<span class="chip">${VENUE_NAMES[v]}</span>`).join("")}</div>
          </div>
        </div>
        <section class="section">
          <div class="section-head"><h2>Top universities</h2><a href="#/universities?field=${f.key}">Full ranking →</a></div>
          <div class="grid">${topU.slice(0, 8).map((u) => uniCard(u, f)).join("")}</div>
        </section>
        <section class="section">
          <div class="section-head"><h2>Most active professors</h2><a href="#/faculty?field=${f.key}">All professors →</a></div>
          <div class="list">${topP.map((p) => facultyRow(p, f)).join("")}</div>
        </section>
        <section class="section">
          <div class="section-head"><h2>Top in India</h2><a href="#/universities?field=${f.key}&region=in">See all →</a></div>
          <div class="grid">${topU.filter((u) => u.country === "IN").slice(0, 4).map((u) => uniCard(u, f)).join("") || `<div class="notice">No Indian universities in this field yet.</div>`}</div>
        </section>
      </div>`,
    };
  }

  // ======================= Industry labs =======================
  function labs() {
    return {
      title: "Industry labs — UniSweep",
      html: `<div class="container page">
        <div class="page-head"><div><h1>Industry labs</h1><p>What the big AI labs are publishing. Papers come live from OpenAlex; for product launches and blog posts, use each lab's own research page.</p></div></div>
        <div class="grid">${LABS.map(labCard).join("")}</div>
      </div>`,
    };
  }

  function lab(params) {
    const l = labById[params.id];
    if (!l) return notFound("Lab");
    const cache = {};
    async function load(root, which) {
      const box = root.querySelector("#papers");
      if (!cache[which]) {
        box.innerHTML = skeletonList(6);
        try {
          cache[which] = await OpenAlex.labWorks(l.openalex, which === "cited" ? "cited_by_count:desc" : "publication_date:desc");
        } catch (e) {
          box.innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
          return;
        }
      }
      if (root.querySelector(".tab.active").dataset.tab !== which) return;
      box.innerHTML = cache[which].length ? cache[which].map((w) => paperItem(w)).join("") : `<div class="notice">No recent papers indexed yet.</div>`;
    }
    return {
      title: l.name + " — UniSweep",
      html: `<div class="container page">
        <div class="crumbs"><a href="#/labs">Industry labs</a> / <span>${esc(l.name)}</span></div>
        <div class="detail-head">
          <div class="monogram lg" style="${monoStyle(l.name)}">${esc(initials(l.name))}</div>
          <div class="grow">
            <h1>${esc(l.name)}</h1>
            <div class="sub">${esc(l.hq)} · ${esc(l.focus)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${l.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
            <div class="detail-actions">${l.links.map(([label, href], i) => `<a class="btn ${i === 0 ? "btn-primary" : ""}" href="${esc(href)}" target="_blank" rel="noopener">${icon("external")} ${esc(label)}</a>`).join("")}</div>
          </div>
        </div>
        <div class="panel" style="margin-top:32px">
          <div class="tabs">
            <button class="tab active" data-tab="recent">Latest papers</button>
            <button class="tab" data-tab="cited">Most cited (last 12 months)</button>
          </div>
          <div id="papers"></div>
          <p class="small faint" style="margin-top:12px">Affiliations come from OpenAlex and are occasionally wrong — a paper may appear because one co-author once listed this company.</p>
        </div>
      </div>`,
      mount(root) {
        load(root, "recent");
        root.addEventListener("click", (e) => {
          const tab = e.target.closest("[data-tab]");
          if (!tab) return;
          root.querySelectorAll("[data-tab]").forEach((t) => t.classList.toggle("active", t === tab));
          load(root, tab.dataset.tab);
        });
      },
    };
  }

  // ======================= Shortlist =======================
  function shortlist() {
    const s = Store.get();
    const people = Object.entries(s.faculty).map(([id, v]) => ({ p: facultyById[id], v })).filter((x) => x.p).sort((a, b) => b.v.added - a.v.added);
    const savedUnis = Object.keys(s.unis).map((id) => uniById[id]).filter(Boolean);
    return {
      title: "Shortlist — UniSweep",
      html: `<div class="container page">
        <div class="page-head">
          <div><h1>Your shortlist</h1><p>Track every professor you're considering. Everything is saved in this browser.</p></div>
          ${people.length ? `<button class="btn" data-export>${icon("copy")} Export CSV</button>` : ""}
        </div>
        ${people.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Professor</th><th>University</th><th>Fields</th><th style="width:170px">Status</th><th style="min-width:220px">Notes</th><th></th></tr></thead>
          <tbody>${people.map(({ p, v }) => `<tr>
            <td><a href="#/p/${esc(p.id)}" style="font-weight:600">${esc(p.name)}</a></td>
            <td><a href="#/u/${esc(p.u.id)}" class="muted">${esc(p.u.short)}</a></td>
            <td><div class="row-chips">${topFields(p.scores, 2).map(fieldChip).join("")}</div></td>
            <td><select class="select" data-status="${esc(p.id)}">${Store.STATUSES.map((st) => `<option ${v.status === st ? "selected" : ""}>${st}</option>`).join("")}</select></td>
            <td><input class="input" data-note="${esc(p.id)}" value="${esc(v.note)}" placeholder="e.g. works on RLHF, ask about MS"></td>
            <td>${starButton("faculty", p.id)}</td>
          </tr>`).join("")}</tbody></table></div>`
        : `<div class="empty"><h3>No professors yet</h3><p>Tap the ☆ next to any professor to save them here.</p><p style="margin-top:16px"><a class="btn btn-primary" href="#/faculty">Browse faculty</a></p></div>`}
        ${savedUnis.length ? `<section class="section"><div class="section-head"><h2>Saved universities</h2></div><div class="grid">${savedUnis.map((u) => uniCard(u)).join("")}</div></section>` : ""}
      </div>`,
      mount(root) {
        root.addEventListener("change", (e) => {
          if (e.target.dataset.status) { Store.updateFaculty(e.target.dataset.status, { status: e.target.value }); toast("Status updated"); }
        });
        root.addEventListener("input", (e) => {
          if (e.target.dataset.note) Store.updateFaculty(e.target.dataset.note, { note: e.target.value });
        });
        const exp = root.querySelector("[data-export]");
        if (exp) exp.addEventListener("click", () => {
          const q = (x) => `"${String(x || "").replace(/"/g, '""')}"`;
          const rows = [["Professor", "University", "Country", "Fields", "Status", "Notes", "Homepage", "UniSweep page"]].concat(
            people.map(({ p, v }) => [p.name, p.u.name, p.u.countryName, topFields(p.scores, 3).map((f) => f.name).join("; "), v.status, v.note, p.homepage, window.location.href.split("#")[0] + "#/p/" + p.id]));
          const blob = new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" });
          const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "unisweep-shortlist.csv" });
          a.click();
          URL.revokeObjectURL(a.href);
        });
      },
    };
  }

  // ======================= Settings =======================
  function settings() {
    const pr = Store.get().profile;
    const key = Store.get().settings.openalexKey || "";
    const fieldInput = (k, label, ph, hint) => `<label class="field">${label}${hint ? ` <span class="hint">${hint}</span>` : ""}<input class="input" data-profile="${k}" value="${esc(pr[k] || "")}" placeholder="${esc(ph)}"></label>`;
    return {
      title: "Settings — UniSweep",
      html: `<div class="container page" style="max-width:760px">
        <div class="page-head"><div><h1>Settings</h1><p>Your profile fills in outreach emails. Nothing leaves this browser.</p></div></div>
        <div class="panel">
          <h3>Your profile</h3>
          <div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
            ${fieldInput("name", "Full name", "Your name")}
            ${fieldInput("school", "Current university", "e.g. IIT Hyderabad")}
            ${fieldInput("degree", "Degree", "e.g. B.Tech student in Computer Science")}
            ${fieldInput("year", "Year", "e.g. third-year")}
            ${fieldInput("program", "Applying for", "PhD or MS")}
            ${fieldInput("term", "Intake", "e.g. Fall 2027")}
          </div>
          <label class="field" style="margin-top:14px">Your research in 1–3 sentences <span class="hint">used in emails</span>
            <textarea class="textarea" rows="4" data-profile="summary" placeholder="e.g. I worked on improving sample efficiency of offline RL for robotic grasping, which led to a workshop paper at ...">${esc(pr.summary || "")}</textarea>
          </label>
          <div style="margin-top:14px">${fieldInput("links", "Links", "personal site / GitHub / Google Scholar")}</div>
        </div>

        <div class="panel">
          <h3>OpenAlex API key <span class="muted small">(optional, free)</span></h3>
          <p class="small muted" style="margin-bottom:12px">Papers load from OpenAlex. Without a key you share a small free daily budget with everyone on your network; a free personal key gives you far more. Get one at <a href="https://openalex.org/settings/api" target="_blank" rel="noopener" style="text-decoration:underline">openalex.org/settings/api</a>.</p>
          <input class="input" data-key value="${esc(key)}" placeholder="Paste your API key">
        </div>

        <div class="panel">
          <h3>Data</h3>
          <p class="small muted">Faculty index built ${esc(D.generated)} from CSRankings (top-venue papers ${D.sinceYear}–now). Refresh it by running <code>python scripts/build_data.py --refresh</code>.</p>
          <div class="detail-actions"><button class="btn" data-clear-cache>Clear cached papers</button></div>
        </div>
      </div>`,
      mount(root) {
        root.addEventListener("input", (e) => {
          if (e.target.dataset.profile) Store.setProfile({ [e.target.dataset.profile]: e.target.value.trim() });
          if (e.target.hasAttribute("data-key")) Store.setSetting("openalexKey", e.target.value.trim());
        });
        root.querySelector("[data-clear-cache]").addEventListener("click", () => {
          try { Object.keys(localStorage).filter((k) => k.startsWith("oa:")).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
          toast("Paper cache cleared");
        });
      },
    };
  }

  function notFound(what) {
    return { title: "Not found — UniSweep", html: `<div class="container page"><div class="empty"><h3>${what} not found</h3><p><a class="btn" href="#/">Go home</a></p></div></div>` };
  }

  window.Views = { home, universities, university, facultyDirectory, professor, areas, area, labs, lab, shortlist, settings, notFound };
})();
