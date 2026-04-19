(function bootDailyGamesTheme() {
  var STORAGE_KEY = "dailygames:theme";
  var MODE_V2 = "v2";
  var MODE_CLASSIC = "classic";
  var root = document.documentElement;

  function applyTheme(mode) {
    if (mode === MODE_V2) {
      root.setAttribute("data-theme", MODE_V2);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function safeGetStoredMode() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === MODE_V2 || stored === MODE_CLASSIC) return stored;
    } catch (err) {}
    return null;
  }

  function safeSetStoredMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (err) {}
  }

  function readQueryMode() {
    try {
      var params = new URLSearchParams(location.search);
      var mode = params.get("theme");
      if (mode !== MODE_V2 && mode !== MODE_CLASSIC) return null;
      params.delete("theme");
      var next = location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash;
      history.replaceState(null, "", next);
      return mode;
    } catch (err) {
      return null;
    }
  }

  var queryMode = readQueryMode();
  var initialMode = queryMode || safeGetStoredMode() || MODE_V2;
  if (queryMode) safeSetStoredMode(queryMode);
  applyTheme(initialMode);

  window.DailyGamesTheme = {
    get: function getThemeMode() {
      return root.getAttribute("data-theme") === MODE_V2 ? MODE_V2 : MODE_CLASSIC;
    },
    set: function setThemeMode(mode) {
      var next = mode === MODE_CLASSIC ? MODE_CLASSIC : MODE_V2;
      safeSetStoredMode(next);
      applyTheme(next);
      return next;
    },
    toggle: function toggleThemeMode() {
      var current = this.get();
      return this.set(current === MODE_V2 ? MODE_CLASSIC : MODE_V2);
    }
  };
})();
