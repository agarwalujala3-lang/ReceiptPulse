(function () {
  const THEME_STORAGE_KEY = "receiptpulse-ui-theme";
  const root = document.documentElement;

  function persistLightTheme() {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    } catch (error) {
      console.warn("Unable to persist stable light theme.", error);
    }
  }

  function updateLogos() {
    document.querySelectorAll("img[data-logo-light]").forEach((img) => {
      const lightSrc = img.getAttribute("data-logo-light") || img.getAttribute("src") || "";
      if (lightSrc && img.getAttribute("src") !== lightSrc) {
        img.setAttribute("src", lightSrc);
      }
    });
  }

  function applyLightTheme() {
    root.dataset.uiTheme = "light";
    root.style.colorScheme = "light";
    persistLightTheme();
    updateLogos();

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.hidden = true;
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("tabindex", "-1");
    });
  }

  applyLightTheme();

  document.addEventListener("DOMContentLoaded", applyLightTheme);
  window.addEventListener("pageshow", applyLightTheme);

  window.ReceiptPulseTheme = {
    applyTheme: applyLightTheme,
    getTheme() {
      return "light";
    },
  };
})();
