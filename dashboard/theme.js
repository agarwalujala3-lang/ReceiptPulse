(function () {
  const THEME_STORAGE_KEY = "receiptpulse-ui-theme";
  const root = document.documentElement;

  function readStoredTheme() {
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      return raw === "light" ? "light" : "dark";
    } catch (error) {
      console.warn("Unable to read stored theme.", error);
      return "dark";
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Unable to persist selected theme.", error);
    }
  }

  function updateButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      button.textContent = nextTheme === "light" ? "Light Mode" : "Dark Mode";
      button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
      button.dataset.nextTheme = nextTheme;
    });
  }

  function applyTheme(theme, persist = true) {
    const normalized = theme === "light" ? "light" : "dark";
    root.dataset.uiTheme = normalized;
    if (persist) {
      writeStoredTheme(normalized);
    }
    updateButtons(normalized);
  }

  function toggleTheme() {
    applyTheme(root.dataset.uiTheme === "light" ? "dark" : "light");
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.uiTheme || readStoredTheme(), false);
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", toggleTheme);
    });
  });

  window.ReceiptPulseTheme = {
    applyTheme,
    getTheme() {
      return root.dataset.uiTheme || readStoredTheme();
    },
  };
})();
