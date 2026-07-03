(function () {
  const scenes = Array.from(document.querySelectorAll("[data-auth-3d-scene]"));
  if (!scenes.length) {
    return;
  }

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const viewportQuery = window.matchMedia("(max-width: 760px)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const states = [];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getMotionProfile(index) {
    const compact = viewportQuery.matches || coarsePointerQuery.matches;
    if (compact) {
      return {
        autoSpinPerSecond: 4.2 + index * 0.5,
        dragYaw: 0.17,
        dragPitch: 0.145,
        inertiaYaw: 0.023,
        inertiaPitch: 0.019,
        keyStep: 4,
        keyStepFast: 6,
        driftAmplitude: 0.042,
        damping: 5.6,
        velocityFloor: 0.035,
      };
    }

    return {
      autoSpinPerSecond: 5.8 + index * 0.65,
      dragYaw: 0.2,
      dragPitch: 0.168,
      inertiaYaw: 0.027,
      inertiaPitch: 0.022,
      keyStep: 5,
      keyStepFast: 8,
      driftAmplitude: 0.052,
      damping: 5.4,
      velocityFloor: 0.04,
    };
  }

  function applyProfile(state) {
    state.profile = getMotionProfile(state.index);
    state.autoSpinPerSecond = motionQuery.matches ? 0 : state.profile.autoSpinPerSecond;
  }

  function setupScene(scene, index) {
    const world = scene.querySelector("[data-auth-3d-world]");
    if (!world) {
      return null;
    }

    const baseRotX = -15;
    const baseRotY = 18 + index * 8;
    const state = {
      scene,
      world,
      index,
      pointerId: null,
      dragging: false,
      startClientX: 0,
      startClientY: 0,
      startRotX: baseRotX,
      startRotY: baseRotY,
      rotX: baseRotX,
      rotY: baseRotY,
      velX: 0,
      velY: 0,
      lastMoveTime: 0,
      lastMoveX: 0,
      lastMoveY: 0,
      lastFrame: performance.now(),
      autoSpinPerSecond: 0,
      profile: null,
      phase: Math.random() * Math.PI * 2,
      frame: 0,
    };

    applyProfile(state);

    function render() {
      state.world.style.setProperty("--auth-3d-rot-x", state.rotX.toFixed(2) + "deg");
      state.world.style.setProperty("--auth-3d-rot-y", state.rotY.toFixed(2) + "deg");
    }

    function resetRotation() {
      state.rotX = baseRotX;
      state.rotY = baseRotY;
      state.velX = 0;
      state.velY = 0;
      render();
    }

    function updateInertia(event) {
      const now = performance.now();
      const dt = Math.max(12, now - state.lastMoveTime);
      const dx = event.clientX - state.lastMoveX;
      const dy = event.clientY - state.lastMoveY;
      const scale = 1000 / dt;
      state.velY = dx * state.profile.inertiaYaw * scale;
      state.velX = -dy * state.profile.inertiaPitch * scale;
      state.lastMoveTime = now;
      state.lastMoveX = event.clientX;
      state.lastMoveY = event.clientY;
    }

    function onPointerDown(event) {
      if (event.button !== 0) {
        return;
      }

      state.pointerId = event.pointerId;
      state.dragging = true;
      state.startClientX = event.clientX;
      state.startClientY = event.clientY;
      state.startRotX = state.rotX;
      state.startRotY = state.rotY;
      state.velX = 0;
      state.velY = 0;
      state.lastMoveTime = performance.now();
      state.lastMoveX = event.clientX;
      state.lastMoveY = event.clientY;
      scene.classList.add("is-dragging");

      if (typeof scene.setPointerCapture === "function") {
        try {
          scene.setPointerCapture(event.pointerId);
        } catch (error) {
          // Ignore pointer capture failures on unsupported environments.
        }
      }
    }

    function onPointerMove(event) {
      if (!state.dragging || event.pointerId !== state.pointerId) {
        return;
      }

      const dx = event.clientX - state.startClientX;
      const dy = event.clientY - state.startClientY;
      state.rotY = state.startRotY + dx * state.profile.dragYaw;
      state.rotX = clamp(state.startRotX - dy * state.profile.dragPitch, -38, 32);
      updateInertia(event);
      render();
    }

    function endDrag(event) {
      if (event.pointerId !== state.pointerId) {
        return;
      }

      state.dragging = false;
      scene.classList.remove("is-dragging");
      state.pointerId = null;

      if (typeof scene.releasePointerCapture === "function") {
        try {
          scene.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore release failures.
        }
      }
    }

    function onKeyDown(event) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const step = event.shiftKey ? state.profile.keyStepFast : state.profile.keyStep;

      if (event.key === "ArrowUp") {
        state.rotX = clamp(state.rotX - step, -38, 32);
      } else if (event.key === "ArrowDown") {
        state.rotX = clamp(state.rotX + step, -38, 32);
      } else if (event.key === "ArrowLeft") {
        state.rotY -= step;
      } else if (event.key === "ArrowRight") {
        state.rotY += step;
      } else if (event.key === "Home") {
        resetRotation();
      }

      state.velX = 0;
      state.velY = 0;
      render();
    }

    function animate(now) {
      const dt = Math.min(34, Math.max(12, now - state.lastFrame));
      const dtSeconds = dt / 1000;
      state.lastFrame = now;

      if (!state.dragging) {
        state.rotY += state.autoSpinPerSecond * dtSeconds;
        state.rotX = clamp(state.rotX + state.velX * dtSeconds, -38, 32);
        state.rotY += state.velY * dtSeconds;

        const drift = Math.sin(now * 0.00058 + state.phase) * state.profile.driftAmplitude;
        state.rotX = clamp(state.rotX + drift, -38, 32);

        const drag = Math.exp(-state.profile.damping * dtSeconds);
        state.velX *= drag;
        state.velY *= drag;

        if (Math.abs(state.velX) < state.profile.velocityFloor) {
          state.velX = 0;
        }
        if (Math.abs(state.velY) < state.profile.velocityFloor) {
          state.velY = 0;
        }
      }

      render();
      state.frame = window.requestAnimationFrame(animate);
    }

    scene.addEventListener("pointerdown", onPointerDown);
    scene.addEventListener("pointermove", onPointerMove);
    scene.addEventListener("pointerup", endDrag);
    scene.addEventListener("pointercancel", endDrag);
    scene.addEventListener("dblclick", resetRotation);
    scene.addEventListener("keydown", onKeyDown);

    render();
    state.frame = window.requestAnimationFrame(animate);
    return state;
  }

  scenes.forEach((scene, index) => {
    const state = setupScene(scene, index);
    if (state) {
      states.push(state);
    }
  });

  if (!states.length) {
    return;
  }

  function syncMotionPreference() {
    states.forEach((state) => {
      applyProfile(state);
    });
  }

  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", syncMotionPreference);
  } else if (typeof motionQuery.addListener === "function") {
    motionQuery.addListener(syncMotionPreference);
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
})();
