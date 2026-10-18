// Everything UniSweep remembers lives in your browser (localStorage):
// your shortlist, notes, email profile and optional OpenAlex API key.
(function () {
  const KEY = "unisweep.v1";
  const empty = () => ({ faculty: {}, unis: {}, profile: {}, settings: {}, read: {} });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? Object.assign(empty(), JSON.parse(raw)) : empty();
    } catch (e) {
      return empty();
    }
  }

  let state = load();
  const listeners = [];

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
    listeners.forEach((fn) => fn(state));
  }

  window.Store = {
    STATUSES: ["Interested", "Reading papers", "Email drafted", "Emailed", "Replied", "Not a fit"],
    get: () => state,
    onChange: (fn) => listeners.push(fn),

    isSaved: (fid) => Boolean(state.faculty[fid]),
    toggleFaculty(fid) {
      if (state.faculty[fid]) delete state.faculty[fid];
      else state.faculty[fid] = { status: "Interested", note: "", added: Date.now() };
      save();
    },
    updateFaculty(fid, patch) {
      if (!state.faculty[fid]) return;
      Object.assign(state.faculty[fid], patch);
      save();
    },

    isUniSaved: (uid) => Boolean(state.unis[uid]),
    toggleUni(uid) {
      if (state.unis[uid]) delete state.unis[uid];
      else state.unis[uid] = { added: Date.now() };
      save();
    },

    // Papers you've ticked as read, per professor: [[paperId, title], ...]
    setRead(fid, entries) {
      if (entries.length) state.read[fid] = entries;
      else delete state.read[fid];
      save();
    },

    setProfile(patch) { Object.assign(state.profile, patch); save(); },
    setSetting(key, value) { state.settings[key] = value; save(); },
    savedCount: () => Object.keys(state.faculty).length + Object.keys(state.unis).length,
  };
})();
