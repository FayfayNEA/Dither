// user-presets.js
// Must load between presets.js and sketch.js.
//
// Phase 1 (runs immediately): injects saved user presets into DITHER_PRESETS
// so that populatePresets() in sketch.js naturally includes them.
//
// Phase 2 (DOMContentLoaded): wires the ★ Save button UI.

(function () {
  const STORAGE_KEY = "fither_user_presets";

  function loadFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveToStorage(presets) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (_) {
      // Storage full or unavailable — fail silently.
    }
  }

  // ── Phase 1: inject persisted presets before setup() runs ─────────────────

  const saved = loadFromStorage();
  for (const entry of saved) {
    if (entry.key && entry.renderStyle) {
      DITHER_PRESETS[entry.key] = Object.assign({}, entry, {
        label: "\u2605 " + entry.label,
      });
    }
  }

  // ── Phase 2: wire the save-preset UI after DOM is ready ───────────────────

  document.addEventListener("DOMContentLoaded", function () {
    const saveBtn     = document.getElementById("savePresetBtn");
    const nameWrap    = document.getElementById("saveNameWrap");
    const nameInput   = document.getElementById("saveNameInput");
    const confirmBtn  = document.getElementById("saveNameConfirm");
    const cancelBtn   = document.getElementById("saveNameCancel");

    function showNameInput() {
      nameInput.value = window.aiSuggestedName || "";
      nameWrap.hidden = false;
      nameInput.focus();
      nameInput.select();
    }

    function hideNameInput() {
      nameWrap.hidden = true;
      nameInput.value = "";
    }

    function saveCurrentPreset(rawLabel) {
      const label = rawLabel.trim();
      if (!label) return;

      // readCfg() reads all current slider values and resolves renderStyle
      // (including lastNonCustomRenderStyle when preset is "custom").
      const cfg = readCfg();
      const key = "user_" + Date.now();

      const presetObj = {
        key,
        label,
        renderStyle:       cfg.renderStyle,
        gridCount:         cfg.gridCount,
        minRadius:         cfg.minRadius,
        maxRadius:         cfg.maxRadius,
        bridgeScale:       cfg.bridgeScale,
        bridgeWaist:       cfg.bridgeWaist,
        maxConnectDist:    cfg.maxConnectDist,
        toneDiffLimit:     cfg.toneDiffLimit,
        gradientThreshold: cfg.gradientThreshold,
        edgeTaper:         cfg.edgeTaper,
        maxBright:         cfg.maxBright,
        maxLinksPerDot:    cfg.maxLinksPerDot,
        contrast:          cfg.contrast,
        quantizeLevels:    cfg.quantizeLevels,
        stippleJitter:     cfg.stippleJitter,
        halftoneGamma:     cfg.halftoneGamma,
        edgeMag:           cfg.edgeMag,
        threshold:         cfg.threshold,
        dotJitter:         cfg.dotJitter,
        bridgeCurve:       cfg.bridgeCurve,
      };

      // Add to live DITHER_PRESETS with ★ prefix.
      DITHER_PRESETS[key] = Object.assign({}, presetObj, {
        label: "\u2605 " + label,
      });

      // Insert option into the dropdown in sorted order.
      const sel = document.getElementById("presetSelect");
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = "\u2605 " + label;

      let inserted = false;
      for (let i = 1; i < sel.options.length; i++) {
        if (sel.options[i].textContent.localeCompare(opt.textContent) > 0) {
          sel.insertBefore(opt, sel.options[i]);
          inserted = true;
          break;
        }
      }
      if (!inserted) sel.appendChild(opt);
      sel.value = key;

      // Persist (without ★ so reload re-applies it cleanly).
      const existing = loadFromStorage();
      existing.push(presetObj);
      saveToStorage(existing);

      window.aiSuggestedName = null;
      hideNameInput();
    }

    saveBtn.addEventListener("click", function () {
      if (nameWrap.hidden) {
        showNameInput();
      } else {
        hideNameInput();
      }
    });

    confirmBtn.addEventListener("click", function () {
      saveCurrentPreset(nameInput.value);
    });

    cancelBtn.addEventListener("click", hideNameInput);

    nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") saveCurrentPreset(nameInput.value);
      if (e.key === "Escape") hideNameInput();
    });
  });
})();
