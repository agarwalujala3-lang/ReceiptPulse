(function () {
  const authClient = window.ReceiptPulseAuth || null;
  const config = authClient?.normalizeConfig(window.RECEIPTPULSE_CONFIG?.auth || {}, {
    fallbackUrl: `${window.location.origin}${window.location.pathname}`,
  }) || null;

  const elements = {
    nameTargets: Array.from(document.querySelectorAll("[data-auth-name]")),
    manageWidgetsButton: document.querySelector("#manageWidgetsButton"),
    addWidgetButton: document.querySelector("#addWidgetButton"),
    signInButton: document.querySelector("#profileSignInButton"),
    switchButton: document.querySelector("#profileSwitchButton"),
    signOutButton: document.querySelector("#profileSignOutButton"),
    email: document.querySelector("#profileEmail"),
    sessionState: document.querySelector("#profileSessionState"),
    figureCanvases: Array.from(document.querySelectorAll("[data-mesh-figure]")),
    heroAction: document.querySelector("#profileHeroAction") || document.querySelector("#reportsHeroAction"),
  };

  let animationHandles = [];

  function setSignedOutUi() {
    elements.nameTargets.forEach((target) => {
      target.textContent = "Operator";
    });
    if (elements.email) {
      elements.email.textContent = "No account session active.";
    }
    if (elements.sessionState) {
      elements.sessionState.textContent = "Signed out";
    }
    if (elements.signInButton) {
      elements.signInButton.hidden = false;
    }
    if (elements.switchButton) {
      elements.switchButton.hidden = true;
    }
    if (elements.signOutButton) {
      elements.signOutButton.hidden = true;
    }
  }

  function setSignedInUi(user) {
    const fullName = String(user?.name || "").trim();
    const firstName = fullName ? fullName.split(/\s+/)[0] : "Operator";
    elements.nameTargets.forEach((target) => {
      target.textContent = firstName;
    });
    if (elements.email) {
      elements.email.textContent = user?.email || "Signed in workspace account";
    }
    if (elements.sessionState) {
      elements.sessionState.textContent = "Signed in";
    }
    if (elements.signInButton) {
      elements.signInButton.hidden = true;
    }
    if (elements.switchButton) {
      elements.switchButton.hidden = false;
    }
    if (elements.signOutButton) {
      elements.signOutButton.hidden = false;
    }
  }

  async function resolveSession() {
    if (!authClient || !config || !authClient.isConfigured(config)) {
      setSignedOutUi();
      return null;
    }

    let tokens = authClient.loadStoredTokens();
    if (!tokens) {
      setSignedOutUi();
      return null;
    }

    try {
      if (authClient.isTokenExpired(tokens) && tokens.refreshToken) {
        tokens = await authClient.refreshSession(config, tokens.refreshToken, tokens);
        authClient.persistTokens(tokens);
      }
    } catch (error) {
      authClient.clearTokens();
      setSignedOutUi();
      return null;
    }

    const user = authClient.buildUserFromTokens(tokens);
    if (!user?.id) {
      setSignedOutUi();
      return null;
    }
    setSignedInUi(user);
    return { tokens, user };
  }

  function bindActions() {
    elements.signInButton?.addEventListener("click", () => {
      window.location.href = "./index.html";
    });

    elements.switchButton?.addEventListener("click", () => {
      authClient?.clearTokens();
      window.location.href = "./index.html";
    });

    elements.signOutButton?.addEventListener("click", async () => {
      const tokens = authClient?.loadStoredTokens();
      try {
        if (tokens?.accessToken && config && authClient?.globalSignOut) {
          await authClient.globalSignOut(config, tokens.accessToken);
        }
      } catch (error) {
        console.warn("Sign out cleanup warning:", error);
      } finally {
        authClient?.clearTokens();
        window.location.href = "./index.html";
      }
    });

    elements.manageWidgetsButton?.addEventListener("click", () => {
      const panel = document.querySelector(".neuro-widget-grid");
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    elements.addWidgetButton?.addEventListener("click", () => {
      window.location.href = "./app.html#uploadLab";
    });

    elements.heroAction?.addEventListener("click", () => {
      window.location.href = "./app.html";
    });
  }

  function startMeshFigures() {
    if (!elements.figureCanvases.length) {
      return;
    }

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewportQuery = window.matchMedia("(max-width: 760px)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const states = [];

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const getMotionProfile = (index) => {
      const compact = viewportQuery.matches || coarsePointerQuery.matches;
      if (compact) {
        return {
          autoSpin: 0.2 + index * 0.035,
          dragYaw: 0.0061,
          dragPitch: 0.0051,
          inertiaYaw: 0.0061,
          inertiaPitch: 0.0049,
          keyStep: 0.09,
          keyStepFast: 0.14,
          driftAmp: 0.0007,
          damping: 5.45,
          velocityFloor: 0.00065,
        };
      }

      return {
        autoSpin: 0.29 + index * 0.04,
        dragYaw: 0.0074,
        dragPitch: 0.006,
        inertiaYaw: 0.0072,
        inertiaPitch: 0.0057,
        keyStep: 0.1,
        keyStepFast: 0.16,
        driftAmp: 0.00084,
        damping: 5.2,
        velocityFloor: 0.0007,
      };
    };

    const applyProfile = (state) => {
      state.profile = getMotionProfile(state.index);
      state.autoSpin = reduceMotionQuery.matches ? 0 : state.profile.autoSpin;
    };

    const shouldRun = (state) => !document.hidden && state.inView;

    const startStateLoop = (state, index) => {
      if (state.running || typeof state.loop !== "function") {
        return;
      }
      state.running = true;
      state.lastFrame = performance.now();
      state.frame = window.requestAnimationFrame(state.loop);
      animationHandles[index] = state.frame;
    };

    const stopStateLoop = (state, index) => {
      if (!state.running) {
        return;
      }
      window.cancelAnimationFrame(state.frame);
      state.running = false;
      state.frame = 0;
      animationHandles[index] = 0;
    };

    const syncAnimationState = () => {
      states.forEach((state, index) => {
        if (shouldRun(state)) {
          startStateLoop(state, index);
        } else {
          stopStateLoop(state, index);
        }
      });
    };

    const resizeCanvas = (canvas) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(280, Math.floor(rect.width * dpr));
      canvas.height = Math.max(220, Math.floor(rect.height * dpr));
    };

    const attachInteractions = (canvas, state) => {
      const stage = canvas.closest("[data-neo-figure-stage]");
      if (!canvas.hasAttribute("tabindex")) {
        canvas.setAttribute("tabindex", "0");
      }
      canvas.setAttribute(
        "aria-label",
        "Interactive 3D receipt mesh. Drag to rotate. Use arrow keys to adjust and Home to reset."
      );

      const resetRotation = () => {
        state.rotX = state.baseRotX;
        state.rotY = state.baseRotY;
        state.velocityX = 0;
        state.velocityY = 0;
      };

      const endDrag = (event) => {
        if (!state.dragging || event.pointerId !== state.pointerId) {
          return;
        }

        state.dragging = false;
        state.pointerId = null;
        canvas.classList.remove("is-dragging");
        stage?.classList.remove("is-dragging");

        if (typeof canvas.releasePointerCapture === "function") {
          try {
            canvas.releasePointerCapture(event.pointerId);
          } catch (error) {
            // Ignore pointer capture release failures.
          }
        }
      };

      canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }

        state.dragging = true;
        state.pointerId = event.pointerId;
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.startRotX = state.rotX;
        state.startRotY = state.rotY;
        state.velocityX = 0;
        state.velocityY = 0;
        state.lastMoveTime = performance.now();
        state.lastMoveX = event.clientX;
        state.lastMoveY = event.clientY;
        canvas.classList.add("is-dragging");
        stage?.classList.add("is-dragging");
        state.startLoop?.();

        if (typeof canvas.setPointerCapture === "function") {
          try {
            canvas.setPointerCapture(event.pointerId);
          } catch (error) {
            // Ignore pointer capture failures.
          }
        }
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!state.dragging || event.pointerId !== state.pointerId) {
          return;
        }

        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        state.rotY = state.startRotY + dx * state.profile.dragYaw;
        state.rotX = clamp(state.startRotX - dy * state.profile.dragPitch, -1.08, 1.08);

        const now = performance.now();
        const dtMs = Math.max(12, now - state.lastMoveTime);
        const moveX = event.clientX - state.lastMoveX;
        const moveY = event.clientY - state.lastMoveY;
        const velocityScale = 1000 / dtMs;
        state.velocityY = moveX * state.profile.inertiaYaw * velocityScale;
        state.velocityX = -moveY * state.profile.inertiaPitch * velocityScale;
        state.lastMoveTime = now;
        state.lastMoveX = event.clientX;
        state.lastMoveY = event.clientY;
      });

      canvas.addEventListener("pointerup", endDrag);
      canvas.addEventListener("pointercancel", endDrag);
      canvas.addEventListener("dblclick", resetRotation);

      canvas.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
          return;
        }

        event.preventDefault();
        const step = event.shiftKey ? state.profile.keyStepFast : state.profile.keyStep;

        if (event.key === "ArrowUp") {
          state.rotX = clamp(state.rotX - step, -1.08, 1.08);
        } else if (event.key === "ArrowDown") {
          state.rotX = clamp(state.rotX + step, -1.08, 1.08);
        } else if (event.key === "ArrowLeft") {
          state.rotY -= step;
        } else if (event.key === "ArrowRight") {
          state.rotY += step;
        } else if (event.key === "Home") {
          resetRotation();
        }

        state.velocityX = 0;
        state.velocityY = 0;
      });
    };

    const draw = (canvas, state, time) => {
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const dt = Math.min(34, Math.max(12, time - state.lastFrame));
      const dtSeconds = dt / 1000;
      state.lastFrame = time;

      if (!state.dragging) {
        state.rotY += state.autoSpin * dtSeconds;
        state.rotX = clamp(
          state.rotX + state.velocityX * dtSeconds + Math.sin(time * 0.00056 + state.phase) * state.profile.driftAmp,
          -1.08,
          1.08
        );
        state.rotY += state.velocityY * dtSeconds;

        const drag = Math.exp(-state.profile.damping * dtSeconds);
        state.velocityX *= drag;
        state.velocityY *= drag;
        if (Math.abs(state.velocityX) < state.profile.velocityFloor) {
          state.velocityX = 0;
        }
        if (Math.abs(state.velocityY) < state.profile.velocityFloor) {
          state.velocityY = 0;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(dpr, dpr);

      const centerX = width / 2;
      const centerY = height / 2 - 4;
      const radius = Math.min(width, height) * 0.235;
      const rotationY = state.rotY;
      const rotationX = state.rotX;
      const latitudeCount = 18;
      const longitudeCount = 22;
      const mesh = [];

      for (let lat = 0; lat <= latitudeCount; lat += 1) {
        const theta = (lat / latitudeCount) * Math.PI;
        const row = [];
        for (let lon = 0; lon <= longitudeCount; lon += 1) {
          const phi = (lon / longitudeCount) * Math.PI * 2;
          const wave =
            1
            + 0.16 * Math.sin(theta * 3.2 + time * 0.0017)
            + 0.12 * Math.cos(phi * 2.4 - time * 0.0012)
            + 0.06 * Math.sin((theta + phi) * 2.1 + time * 0.0011);

          let x = Math.sin(theta) * Math.cos(phi) * wave;
          let y = Math.cos(theta) * wave * 0.9;
          let z = Math.sin(theta) * Math.sin(phi) * wave;

          const rotatedX = x * Math.cos(rotationY) - z * Math.sin(rotationY);
          const rotatedZ = x * Math.sin(rotationY) + z * Math.cos(rotationY);
          const rotatedY = y * Math.cos(rotationX) - rotatedZ * Math.sin(rotationX);
          z = y * Math.sin(rotationX) + rotatedZ * Math.cos(rotationX);
          x = rotatedX;
          y = rotatedY;

          const perspective = 1 / (1 + z * 0.46);
          row.push({
            x: centerX + x * radius * perspective,
            y: centerY + y * radius * perspective,
            z,
          });
        }
        mesh.push(row);
      }

      const glow = context.createRadialGradient(centerX, centerY, radius * 0.18, centerX, centerY, radius * 1.32);
      glow.addColorStop(0, "rgba(119, 222, 255, 0.22)");
      glow.addColorStop(0.45, "rgba(111, 105, 255, 0.16)");
      glow.addColorStop(1, "rgba(9, 12, 28, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.34, 0, Math.PI * 2);
      context.fill();

      for (let pass = 0; pass < 2; pass += 1) {
        for (let lat = 0; lat < mesh.length; lat += 1) {
          const row = mesh[lat];
          for (let lon = 0; lon < row.length - 1; lon += 1) {
            const point = row[lon];
            const next = row[lon + 1];
            const depth = (point.z + next.z + 2) / 4;
            const alpha = pass === 0 ? 0.08 + depth * 0.16 : 0.18 + depth * 0.28;
            context.strokeStyle =
              lon % 2 === 0
                ? `rgba(118, 222, 255, ${alpha.toFixed(3)})`
                : `rgba(176, 122, 255, ${(alpha * 0.92).toFixed(3)})`;
            context.lineWidth = pass === 0 ? 3.4 : 1.25;
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(next.x, next.y);
            context.stroke();
          }
        }

        for (let lat = 0; lat < mesh.length - 1; lat += 1) {
          for (let lon = 0; lon < mesh[lat].length; lon += 1) {
            const point = mesh[lat][lon];
            const next = mesh[lat + 1][lon];
            const depth = (point.z + next.z + 2) / 4;
            const alpha = pass === 0 ? 0.06 + depth * 0.14 : 0.14 + depth * 0.24;
            context.strokeStyle =
              lat % 2 === 0
                ? `rgba(112, 192, 255, ${alpha.toFixed(3)})`
                : `rgba(195, 118, 255, ${(alpha * 0.9).toFixed(3)})`;
            context.lineWidth = pass === 0 ? 3 : 1;
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(next.x, next.y);
            context.stroke();
          }
        }
      }
    };

    const syncMotionPreference = () => {
      states.forEach((state) => {
        applyProfile(state);
      });
      syncAnimationState();
    };

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", syncMotionPreference);
    } else if (typeof reduceMotionQuery.addListener === "function") {
      reduceMotionQuery.addListener(syncMotionPreference);
    }

    if (typeof viewportQuery.addEventListener === "function") {
      viewportQuery.addEventListener("change", syncMotionPreference);
    } else if (typeof viewportQuery.addListener === "function") {
      viewportQuery.addListener(syncMotionPreference);
    }

    if (typeof coarsePointerQuery.addEventListener === "function") {
      coarsePointerQuery.addEventListener("change", syncMotionPreference);
    } else if (typeof coarsePointerQuery.addListener === "function") {
      coarsePointerQuery.addListener(syncMotionPreference);
    }

    const intersectionObserver =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                const target = entry.target;
                const state = states.find((candidate) => candidate.observeTarget === target);
                if (!state) {
                  return;
                }
                state.inView = Boolean(entry.isIntersecting);
              });
              syncAnimationState();
            },
            { threshold: 0.08 }
          )
        : null;

    elements.figureCanvases.forEach((canvas, index) => {
      const observeTarget = canvas.closest("[data-neo-figure-stage]") || canvas;
      const state = {
        index,
        baseRotX: -0.28 + index * 0.03,
        baseRotY: 0.62 + index * 0.18,
        rotX: -0.28 + index * 0.03,
        rotY: 0.62 + index * 0.18,
        velocityX: 0,
        velocityY: 0,
        dragging: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startRotX: -0.28 + index * 0.03,
        startRotY: 0.62 + index * 0.18,
        lastMoveTime: 0,
        lastMoveX: 0,
        lastMoveY: 0,
        lastFrame: performance.now(),
        inView: true,
        running: false,
        frame: 0,
        autoSpin: 0,
        profile: null,
        phase: Math.random() * Math.PI * 2,
        observeTarget,
        loop: null,
        startLoop: null,
      };
      applyProfile(state);
      states.push(state);

      resizeCanvas(canvas);
      attachInteractions(canvas, state);
      const loop = (time) => {
        draw(canvas, state, time + index * 380);
        if (state.running) {
          state.frame = window.requestAnimationFrame(loop);
          animationHandles[index] = state.frame;
        }
      };
      state.loop = loop;
      state.startLoop = () => startStateLoop(state, index);
      intersectionObserver?.observe(observeTarget);
    });

    window.addEventListener("resize", () => {
      elements.figureCanvases.forEach((canvas) => resizeCanvas(canvas));
    });
    document.addEventListener("visibilitychange", syncAnimationState);
    syncAnimationState();
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindActions();
    startMeshFigures();
    void resolveSession();
  });
})();
