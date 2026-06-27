(() => {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = document.body;

  if (!body || !body.classList.contains("luxe-relaunch")) {
    return;
  }

  const setPointer = (event) => {
    const x = Math.max(0, Math.min(1, event.clientX / Math.max(window.innerWidth, 1)));
    const y = Math.max(0, Math.min(1, event.clientY / Math.max(window.innerHeight, 1)));
    body.style.setProperty("--luxe-pointer-x", `${(x * 100).toFixed(2)}%`);
    body.style.setProperty("--luxe-pointer-y", `${(y * 100).toFixed(2)}%`);
  };

  if (!reduceMotion) {
    window.addEventListener("pointermove", setPointer, { passive: true });
  }

  const revealTargets = document.querySelectorAll(
    ".auth-stage, .auth-panel, .auth-info-card, .auth-project-strip article, .dashboard-command-bar, .neo-card, .metric-card, .upload-lab, .table-panel"
  );

  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("luxe-in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.16 }
    );
    revealTargets.forEach((target) => {
      target.classList.add("luxe-reveal");
      observer.observe(target);
    });
  } else {
    revealTargets.forEach((target) => target.classList.add("luxe-in-view"));
  }

  const magneticTargets = document.querySelectorAll(
    ".auth-3d-scene, .dashboard-command-visual, .neo-figure-stage, .demo-access-card"
  );

  magneticTargets.forEach((target) => {
    target.addEventListener(
      "pointermove",
      (event) => {
        if (reduceMotion) return;
        const rect = target.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
        target.style.setProperty("--luxe-local-x", `${(x * 100).toFixed(2)}%`);
        target.style.setProperty("--luxe-local-y", `${(y * 100).toFixed(2)}%`);
        target.style.setProperty("--luxe-tilt-x", `${((0.5 - y) * 6).toFixed(2)}deg`);
        target.style.setProperty("--luxe-tilt-y", `${((x - 0.5) * 8).toFixed(2)}deg`);
      },
      { passive: true }
    );

    target.addEventListener("pointerleave", () => {
      target.style.setProperty("--luxe-local-x", "50%");
      target.style.setProperty("--luxe-local-y", "50%");
      target.style.setProperty("--luxe-tilt-x", "0deg");
      target.style.setProperty("--luxe-tilt-y", "0deg");
    });
  });
})();
