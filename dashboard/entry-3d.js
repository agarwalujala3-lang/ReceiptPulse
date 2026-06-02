(() => {
  const host = document.body;
  if (!host || host.dataset.entryLaunch !== "root") {
    return;
  }

  const STORAGE_KEY = "receiptpulse-entry-launch-v2";
  const VISIBLE_MS = 5400;
  const EXIT_MS = 1050;
  const REDUCED_VISIBLE_MS = 1700;
  const REDUCED_EXIT_MS = 360;
  const messages = [
    "Assembling brand core",
    "Mapping receipt pipeline",
    "Warming private workspace",
    "Opening sign-in surface",
  ];

  function canUseStorage() {
    try {
      return typeof window.sessionStorage !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function hasShownEntry() {
    if (!canUseStorage()) {
      return false;
    }
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) === "shown";
    } catch (error) {
      return false;
    }
  }

  function markEntryShown() {
    if (!canUseStorage()) {
      return;
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "shown");
    } catch (error) {
      // Session storage can fail in strict privacy contexts.
    }
  }

  function buildOverlay() {
    const overlay = document.createElement("section");
    overlay.className = "entry-launch";
    overlay.setAttribute("aria-label", "ReceiptPulse brand entry animation");
    overlay.innerHTML = `
      <canvas class="entry-launch-canvas" data-entry-launch-canvas aria-hidden="true"></canvas>
      <div class="entry-launch-surface" aria-hidden="true">
        <span class="entry-launch-scan"></span>
        <span class="entry-launch-horizon"></span>
      </div>
      <div class="entry-launch-content">
        <img class="entry-launch-logo" src="./receiptpulse-logo-light.svg?v=20260417a" alt="ReceiptPulse" />
        <p class="entry-launch-kicker">Private Receipt Intelligence</p>
        <h2>ReceiptPulse</h2>
        <p class="entry-launch-copy">Upload, OCR, duplicate review, and analytics in one secured workspace.</p>
        <div class="entry-launch-progress" aria-live="polite">
          <span data-entry-launch-status>Assembling brand core</span>
          <strong data-entry-launch-countdown>05</strong>
          <i aria-hidden="true"><span data-entry-launch-bar></span></i>
        </div>
      </div>
      <button class="entry-launch-skip" type="button" data-entry-launch-skip>Skip</button>
    `;
    return overlay;
  }

  function startCanvas(canvas, reducedMotion) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return () => {};
    }

    const state = {
      width: 0,
      height: 0,
      dpr: 1,
      mouseX: 0,
      mouseY: 0,
      targetMouseX: 0,
      targetMouseY: 0,
      active: true,
      particles: Array.from({ length: 126 }, (_, index) => ({
        angle: index * 0.68,
        lane: (index % 8) / 8,
        speed: 0.18 + (index % 9) * 0.012,
        depth: 0.42 + (index % 10) * 0.06,
      })),
    };

    function resize() {
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(state.width * state.dpr));
      canvas.height = Math.max(1, Math.floor(state.height * state.dpr));
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
    }

    function project(point, rotX, rotY, scale) {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const x1 = point.x * cosY - point.z * sinY;
      const z1 = point.x * sinY + point.z * cosY;
      const y1 = point.y * cosX - z1 * sinX;
      const z2 = point.y * sinX + z1 * cosX;
      const perspective = 1 / (1 + z2 * 0.00175);

      return {
        x: state.width * 0.58 + x1 * scale * perspective,
        y: state.height * 0.49 + y1 * scale * perspective,
        z: z2,
        perspective,
      };
    }

    function drawPolygon(points, fill, stroke, lineWidth) {
      context.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });
      context.closePath();
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.stroke();
    }

    function drawReceiptStack(time, rotX, rotY, scale) {
      const layers = [
        { z: -72, shift: 42, fill: "rgba(191, 215, 228, 0.78)", stroke: "rgba(12, 39, 60, 0.48)" },
        { z: -26, shift: 14, fill: "rgba(224, 241, 248, 0.88)", stroke: "rgba(11, 82, 103, 0.58)" },
        { z: 22, shift: -12, fill: "rgba(250, 254, 255, 0.96)", stroke: "rgba(8, 38, 58, 0.76)" },
      ];

      layers.forEach((layer, index) => {
        const lift = Math.sin(time * 0.0014 + index) * 5;
        const points = [
          { x: -1.18, y: -0.72, z: layer.z },
          { x: 1.1, y: -0.62 + lift * 0.001, z: layer.z + 18 },
          { x: 1.24, y: 0.72, z: layer.z + 6 },
          { x: -1.05, y: 0.66, z: layer.z - 14 },
        ].map((point) =>
          project({ x: point.x * 170, y: point.y * 170 + layer.shift, z: point.z }, rotX, rotY, scale)
        );
        drawPolygon(points, layer.fill, layer.stroke, index === 2 ? 1.8 : 1.2);

        if (index === 2) {
          for (let line = 0; line < 5; line += 1) {
            const y = -78 + line * 31;
            const left = project({ x: -118, y, z: layer.z + 9 }, rotX, rotY, scale);
            const right = project({ x: 98 - line * 9, y: y + 5, z: layer.z + 15 }, rotX, rotY, scale);
            context.beginPath();
            context.moveTo(left.x, left.y);
            context.lineTo(right.x, right.y);
            context.strokeStyle = line === 0 ? "rgba(188, 70, 36, 0.88)" : "rgba(8, 78, 101, 0.52)";
            context.lineWidth = line === 0 ? 2.7 : 1.55;
            context.stroke();
          }
        }
      });
    }

    function drawDataRibbons(time, rotX, rotY, scale) {
      for (let band = 0; band < 5; band += 1) {
        const phase = time * 0.00072 + band * 0.74;
        const warm = band % 2 === 1;

        context.beginPath();
        for (let step = 0; step <= 72; step += 1) {
          const t = step / 72;
          const point = project(
            {
              x: -420 + t * 840,
              y: Math.sin(t * Math.PI * 2 + phase) * (42 + band * 7) + band * 30 - 58,
              z: Math.cos(t * Math.PI * 2 + phase) * 150 + band * 20 - 44,
            },
            rotX - 0.12,
            rotY + 0.24,
            scale
          );
          if (step === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }

        context.strokeStyle = warm ? "rgba(190, 72, 37, 0.34)" : "rgba(7, 102, 127, 0.34)";
        context.lineWidth = warm ? 1.8 : 1.55;
        context.stroke();
      }
    }

    function drawSignalNodes(time, rotX, rotY, scale) {
      const nodes = [
        { x: -360, y: -84, z: -32, size: 14, color: "rgba(14, 80, 105, 0.82)" },
        { x: -300, y: 92, z: 86, size: 10, color: "rgba(188, 70, 36, 0.78)" },
        { x: 300, y: -108, z: 64, size: 12, color: "rgba(10, 96, 121, 0.78)" },
        { x: 356, y: 84, z: -58, size: 9, color: "rgba(188, 70, 36, 0.72)" },
      ];

      nodes.forEach((node, index) => {
        const pulse = 1 + Math.sin(time * 0.002 + index) * 0.14;
        const point = project({ x: node.x, y: node.y, z: node.z }, rotX, rotY, scale);
        context.save();
        context.translate(point.x, point.y);
        context.rotate(time * 0.00055 + index * 0.35);
        context.beginPath();
        const radius = node.size * pulse * point.perspective;
        context.moveTo(0, -radius);
        context.lineTo(radius, 0);
        context.lineTo(0, radius);
        context.lineTo(-radius, 0);
        context.closePath();
        context.fillStyle = node.color;
        context.strokeStyle = "rgba(8, 34, 52, 0.52)";
        context.lineWidth = 1.2;
        context.fill();
        context.stroke();
        context.restore();
      });
    }

    function drawOrbit(time, rotX, rotY, scale) {
      for (let ring = 0; ring < 3; ring += 1) {
        context.beginPath();
        const steps = 128;
        for (let index = 0; index <= steps; index += 1) {
          const angle = (index / steps) * Math.PI * 2;
          const spin = time * 0.00038 + ring * 0.82;
          const point = project(
            {
              x: Math.cos(angle + spin) * (260 + ring * 34),
              y: Math.sin(angle) * (86 + ring * 18),
              z: Math.sin(angle + spin) * 168,
            },
            rotX + ring * 0.18,
            rotY - ring * 0.24,
            scale
          );
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
        context.strokeStyle = ring === 1 ? "rgba(188, 70, 36, 0.62)" : "rgba(7, 102, 127, 0.48)";
        context.lineWidth = ring === 1 ? 2.2 : 1.55;
        context.stroke();
      }
    }

    function drawParticles(time, rotX, rotY, scale) {
      state.particles.forEach((particle, index) => {
        const angle = particle.angle + time * 0.00032 * particle.speed * 10;
        const radius = 300 + particle.lane * 250;
        const point = project(
          {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle * 1.38 + index) * 190,
            z: Math.sin(angle) * radius * particle.depth,
          },
          rotX,
          rotY,
          scale
        );
        const alpha = Math.max(0.18, Math.min(0.66, 0.54 + point.z * 0.00055));
        context.beginPath();
        context.arc(point.x, point.y, Math.max(1.25, 2.55 * point.perspective), 0, Math.PI * 2);
        context.fillStyle = index % 5 === 0 ? `rgba(188, 70, 36, ${alpha})` : `rgba(7, 102, 127, ${alpha})`;
        context.fill();
      });
    }

    function drawGround(time) {
      const horizon = state.height * 0.64;
      for (let row = 0; row < 18; row += 1) {
        const y = horizon + row * row * 2.8;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(state.width, y);
        context.strokeStyle = `rgba(17, 62, 84, ${Math.max(0, 0.23 - row * 0.009)})`;
        context.lineWidth = 1;
        context.stroke();
      }

      for (let column = -14; column <= 14; column += 1) {
        const drift = Math.sin(time * 0.0003 + column) * 12;
        context.beginPath();
        context.moveTo(state.width * 0.5 + column * 32 + drift, horizon);
        context.lineTo(state.width * 0.5 + column * 96, state.height + 80);
        context.strokeStyle = "rgba(17, 62, 84, 0.17)";
        context.stroke();
      }
    }

    function draw(time) {
      if (!state.active) {
        return;
      }

      state.mouseX += (state.targetMouseX - state.mouseX) * 0.06;
      state.mouseY += (state.targetMouseY - state.mouseY) * 0.06;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(state.dpr, state.dpr);

      const gradient = context.createLinearGradient(0, 0, state.width, state.height);
      gradient.addColorStop(0, "#f4fbfe");
      gradient.addColorStop(0.52, "#d8e9f3");
      gradient.addColorStop(1, "#c4ddeb");
      context.fillStyle = gradient;
      context.fillRect(0, 0, state.width, state.height);

      drawGround(time);
      const rotX = -0.2 + state.mouseY * 0.18 + Math.sin(time * 0.0005) * 0.05;
      const rotY = 0.48 + state.mouseX * 0.32 + time * (reducedMotion ? 0.00008 : 0.00022);
      const scale = Math.min(state.width, state.height) < 620 ? 0.62 : 0.88;

      context.save();
      context.shadowColor = "rgba(18, 43, 68, 0.24)";
      context.shadowBlur = 24;
      drawOrbit(time, rotX, rotY, scale);
      drawDataRibbons(time, rotX, rotY, scale);
      drawReceiptStack(time, rotX, rotY, scale);
      drawSignalNodes(time, rotX, rotY, scale);
      context.restore();
      drawParticles(time, rotX, rotY, scale);

      window.requestAnimationFrame(draw);
    }

    function onPointerMove(event) {
      state.targetMouseX = (event.clientX / Math.max(1, state.width) - 0.5) * 2;
      state.targetMouseY = (event.clientY / Math.max(1, state.height) - 0.5) * 2;
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    resize();
    window.requestAnimationFrame(draw);

    return () => {
      state.active = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }

  function runEntry() {
    if (hasShownEntry()) {
      host.classList.add("entry-launch-finished");
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visibleMs = reducedMotion ? REDUCED_VISIBLE_MS : VISIBLE_MS;
    const exitMs = reducedMotion ? REDUCED_EXIT_MS : EXIT_MS;
    const overlay = buildOverlay();
    host.appendChild(overlay);
    host.classList.add("entry-launch-running");
    markEntryShown();

    const canvas = overlay.querySelector("[data-entry-launch-canvas]");
    const stopCanvas = canvas ? startCanvas(canvas, reducedMotion) : () => {};
    const progressBar = overlay.querySelector("[data-entry-launch-bar]");
    const statusText = overlay.querySelector("[data-entry-launch-status]");
    const countdown = overlay.querySelector("[data-entry-launch-countdown]");
    const skipButton = overlay.querySelector("[data-entry-launch-skip]");
    const startedAt = performance.now();
    let closing = false;
    let autoCloseTimer = 0;

    function closeOverlay() {
      if (closing) {
        return;
      }
      closing = true;
      window.clearTimeout(autoCloseTimer);
      overlay.classList.add("entry-launch--dissolve");
      host.classList.remove("entry-launch-running");
      host.classList.add("entry-launch-finished");
      window.setTimeout(() => {
        stopCanvas();
        overlay.remove();
      }, exitMs);
    }

    function tick() {
      const elapsed = performance.now() - startedAt;
      const progress = Math.min(1, elapsed / visibleMs);
      const remaining = Math.max(0, Math.ceil((visibleMs - elapsed) / 1000));

      if (progressBar) {
        progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
      }
      if (countdown) {
        countdown.textContent = String(remaining).padStart(2, "0");
      }
      if (statusText) {
        statusText.textContent = messages[Math.min(messages.length - 1, Math.floor(progress * messages.length))];
      }

      if (progress >= 1) {
        closeOverlay();
        return;
      }
      window.requestAnimationFrame(tick);
    }

    skipButton?.addEventListener("click", closeOverlay);
    autoCloseTimer = window.setTimeout(closeOverlay, visibleMs + 80);
    window.requestAnimationFrame(() => {
      overlay.classList.add("entry-launch--visible");
      tick();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runEntry, { once: true });
  } else {
    runEntry();
  }
})();
