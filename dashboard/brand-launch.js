(() => {
  const LAUNCH_STORAGE_KEY = "receiptpulse-brand-launch-v1";
  const VISIBLE_MS = 2150;
  const EXIT_MS = 760;
  const REDUCED_VISIBLE_MS = 620;
  const REDUCED_EXIT_MS = 260;

  function canUseStorage() {
    try {
      return typeof window.sessionStorage !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function hasShownLaunch() {
    if (!canUseStorage()) {
      return false;
    }
    try {
      return window.sessionStorage.getItem(LAUNCH_STORAGE_KEY) === "shown";
    } catch (error) {
      return false;
    }
  }

  function markLaunchShown() {
    if (!canUseStorage()) {
      return;
    }
    try {
      window.sessionStorage.setItem(LAUNCH_STORAGE_KEY, "shown");
    } catch (error) {
      // Ignore storage write failures.
    }
  }

  function shouldSkipLaunch() {
    if (!document.body) {
      return true;
    }
    if (document.body.dataset.brandLaunch === "off") {
      return true;
    }
    return hasShownLaunch();
  }

  function buildLaunchOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "brand-launch";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <span class="brand-launch-grid" aria-hidden="true"></span>
      <span class="brand-launch-aura brand-launch-aura--ember" aria-hidden="true"></span>
      <span class="brand-launch-aura brand-launch-aura--mist" aria-hidden="true"></span>
      <span class="brand-launch-blade" aria-hidden="true"></span>
      <span class="brand-launch-character" data-scene-asset="splash" aria-hidden="true"></span>
      <div class="brand-launch-card">
        <span class="brand-launch-mark-shell">
          <img class="brand-launch-mark" src="./receiptpulse-mark.svg?v=20260402c" alt="" />
        </span>
        <img class="brand-launch-logo" src="./receiptpulse-logo.svg?v=20260402c" alt="ReceiptPulse" />
        <p class="brand-launch-copy">Receipt breathing: first form, clean ledger.</p>
        <span class="brand-launch-progress" aria-hidden="true"><span></span></span>
      </div>
    `;
    return overlay;
  }

  function runLaunchAnimation() {
    if (shouldSkipLaunch()) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visibleMs = reducedMotion ? REDUCED_VISIBLE_MS : VISIBLE_MS;
    const exitMs = reducedMotion ? REDUCED_EXIT_MS : EXIT_MS;

    const overlay = buildLaunchOverlay();
    document.body.appendChild(overlay);
    document.body.classList.add("brand-launch-running");
    markLaunchShown();

    requestAnimationFrame(() => {
      overlay.classList.add("brand-launch--visible");
    });

    window.setTimeout(() => {
      overlay.classList.add("brand-launch--exit");
      document.body.classList.remove("brand-launch-running");
      document.body.classList.add("brand-launch-finished");

      window.setTimeout(() => {
        overlay.remove();
      }, exitMs);
    }, visibleMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runLaunchAnimation, { once: true });
  } else {
    runLaunchAnimation();
  }
})();
