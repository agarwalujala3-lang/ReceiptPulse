(() => {
  const VERSION = "20260403g";
  const EXTENSIONS = ["webp", "jpg", "jpeg", "png"];
  const root = document.documentElement;

  const assetBindings = [
    { selector: '[data-scene-asset="bg-dark"]', baseNames: ["bg-dark"] },
    { selector: '[data-scene-asset="bg-light"]', baseNames: ["bg-light"] },
    { selector: '[data-scene-asset="cast"]', baseNames: ["cast"] },
    { selector: '[data-scene-asset="portal"]', baseNames: ["portal", "cast"] },
    { selector: '[data-scene-asset="splash"]', baseNames: ["splash", "cast"] },
  ];

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(url);
      image.onerror = reject;
      image.src = url;
    });
  }

  async function resolveAsset(baseNames) {
    for (const baseName of baseNames) {
      for (const extension of EXTENSIONS) {
        const url = `./anime-assets/${baseName}.${extension}?v=${VERSION}`;
        try {
          await loadImage(url);
          return url;
        } catch (error) {
          // Try next extension.
        }
      }
    }

    return null;
  }

  function applyAsset(element, url) {
    if (!element || !url) {
      return;
    }

    element.style.setProperty("--scene-asset-url", `url("${url}")`);
    element.classList.add("is-ready");
  }

  async function bindAssets() {
    for (const binding of assetBindings) {
      const url = await resolveAsset(binding.baseNames);
      if (!url) {
        continue;
      }

      document.querySelectorAll(binding.selector).forEach((element) => {
        applyAsset(element, url);
      });

      if (binding.baseNames.includes("splash")) {
        root.style.setProperty("--slayer-splash-url", `url("${url}")`);
        root.classList.add("slayer-has-splash-asset");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAssets, { once: true });
  } else {
    bindAssets();
  }
})();
