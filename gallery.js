/** Static assets + user exports (IndexedDB). Thumbnails + lightbox slideshow. */
(function () {
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="gallery.js"]');
  const baseDir =
    scriptEl && scriptEl.src
      ? new URL(".", scriptEl.src).href
      : new URL("./", window.location.href).href;

  const GALLERY_DIR = "assets/";
  const DB_NAME = "fither-gallery-v1";
  const STORE = "exports";
  const MAX_USER_EXPORTS = 48;

  const STATIC_IMAGES = [
    "Vector2.png",
    "blob_dither_output.png",
    "contrast_based_dither.png",
    "five_zone_dither.png",
    "grid_connected_dither.png",
    "grid_dither_no_bright_connections.png",
    "grid_dither_refined.png",
    "large_blob_dither_output.png",
    "organic_circular_dither.png",
    "organic_dither_28x28.png",
    "organic_dither_28x28_dark_only_connections.png",
    "organic_dither_28x28_larger_darkdots.png",
    "organic_dither_28x28_max4connections.png",
    "organic_dither_blob_field.png",
    "organic_dither_dark_links.png",
    "organic_dither_dark_links21.png",
    "organic_dither_field_final.png",
    "organic_dither_final.png",
    "organic_dither_spacing.png",
    "organic_dot_field.png",
    "organic_dot_field_adaptive.png",
    "organic_dot_field_adaptive21.png",
    "organic_flow_dots.png",
    "organic_grid_connections.png",
    "organic_grid_gradient.png",
    "organic_natural_connections.png",
    "selective_blob_dither_output.png",
    "sparse_blob_dither_output.png",
    "threshold_dither.png",
  ].map((f) => GALLERY_DIR + f);

  function resolveSrc(filename) {
    try {
      return new URL(filename.replace(/^\.\//, ""), baseDir).href;
    } catch {
      return filename;
    }
  }

  function labelFromPath(path) {
    const name = path.includes("/") ? path.split("/").pop() : path;
    return (name || path).replace(/\.[^.]+$/, "").replace(/_/g, " ");
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  let dbPromise = null;
  function getDb() {
    if (!dbPromise) dbPromise = openDb();
    return dbPromise;
  }

  async function loadUserExports() {
    try {
      const db = await getDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    } catch {
      return [];
    }
  }

  async function putUserExport(record) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteUserExport(id) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function trimExports(userRows) {
    if (userRows.length <= MAX_USER_EXPORTS) return;
    const sorted = [...userRows].sort((a, b) => a.createdAt - b.createdAt);
    const drop = sorted.slice(0, userRows.length - MAX_USER_EXPORTS);
    for (const row of drop) {
      await deleteUserExport(row.id);
    }
  }

  /** @type {{ kind: 'static', path: string } | { kind: 'user', id: number, blob: Blob, label: string, createdAt: number }[]} */
  let slides = [];
  let thumbObjectUrls = [];
  let lightboxObjectUrl = null;

  function revokeThumbUrls() {
    for (const u of thumbObjectUrls) {
      try {
        URL.revokeObjectURL(u);
      } catch (_) {}
    }
    thumbObjectUrls = [];
  }

  function revokeLightboxUrl() {
    if (lightboxObjectUrl) {
      try {
        URL.revokeObjectURL(lightboxObjectUrl);
      } catch (_) {}
      lightboxObjectUrl = null;
    }
  }

  function buildSlides(userRows) {
    const sorted = [...userRows].sort((a, b) => b.createdAt - a.createdAt);
    const userSlides = sorted.map((r) => ({
      kind: "user",
      id: r.id,
      blob: r.blob,
      label: r.label || "Export",
      createdAt: r.createdAt,
    }));
    const staticSlides = STATIC_IMAGES.map((path) => ({ kind: "static", path }));
    return [...userSlides, ...staticSlides];
  }

  const mount = document.getElementById("galleryGrid");
  if (!mount) return;

  let currentIndex = 0;
  let lastFocus = null;

  const lb = document.createElement("div");
  lb.id = "galleryLightbox";
  lb.className = "gallery-lightbox";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Gallery slideshow");

  lb.innerHTML = [
    '<div class="gallery-lightbox-inner">',
    '  <button type="button" class="gallery-lightbox-backdrop" aria-label="Close gallery"></button>',
    '  <div class="gallery-lightbox-panel">',
    '    <button type="button" class="gallery-lightbox-close" aria-label="Close">Close</button>',
    '    <div class="gallery-lightbox-body">',
    '      <button type="button" class="gallery-lightbox-arrow gallery-lightbox-prev" aria-label="Previous image">',
    '        <span aria-hidden="true">←</span>',
    "      </button>",
    '      <div class="gallery-lightbox-stage">',
    '        <img class="gallery-lightbox-img" alt="" />',
    '        <p class="gallery-lightbox-caption"></p>',
    '        <p class="gallery-lightbox-counter"></p>',
    "      </div>",
    '      <button type="button" class="gallery-lightbox-arrow gallery-lightbox-next" aria-label="Next image">',
    '        <span aria-hidden="true">→</span>',
    "      </button>",
    "    </div>",
    "  </div>",
    "</div>",
  ].join("");

  document.body.appendChild(lb);

  const backdrop = lb.querySelector(".gallery-lightbox-backdrop");
  const closeBtn = lb.querySelector(".gallery-lightbox-close");
  const prevBtn = lb.querySelector(".gallery-lightbox-prev");
  const nextBtn = lb.querySelector(".gallery-lightbox-next");
  const imgEl = lb.querySelector(".gallery-lightbox-img");
  const capEl = lb.querySelector(".gallery-lightbox-caption");
  const countEl = lb.querySelector(".gallery-lightbox-counter");

  function slideCaption(slide) {
    if (slide.kind === "static") return labelFromPath(slide.path);
    return slide.label;
  }

  function updateSlide() {
    const n = slides.length;
    if (n === 0) return;
    currentIndex = ((currentIndex % n) + n) % n;
    const slide = slides[currentIndex];
    revokeLightboxUrl();
    if (slide.kind === "static") {
      imgEl.src = resolveSrc(slide.path);
    } else {
      lightboxObjectUrl = URL.createObjectURL(slide.blob);
      imgEl.src = lightboxObjectUrl;
    }
    imgEl.alt = slideCaption(slide);
    capEl.textContent = slideCaption(slide);
    countEl.textContent = `${currentIndex + 1} / ${n}`;
  }

  function openLightbox(index) {
    if (slides.length === 0) return;
    currentIndex = index;
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.classList.add("gallery-lightbox-open");
    updateSlide();
    closeBtn.focus();
  }

  function closeLightbox() {
    lb.hidden = true;
    document.body.classList.remove("gallery-lightbox-open");
    revokeLightboxUrl();
    imgEl.removeAttribute("src");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function step(delta) {
    currentIndex += delta;
    updateSlide();
  }

  closeBtn.addEventListener("click", closeLightbox);
  backdrop.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));

  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  });

  function renderGrid() {
    revokeThumbUrls();
    mount.textContent = "";
    const frag = document.createDocumentFragment();
    slides.forEach((slide, index) => {
      const fig = document.createElement("figure");
      fig.className = "gallery-item";
      if (slide.kind === "user") fig.classList.add("gallery-item--yours");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gallery-thumb";
      btn.setAttribute(
        "aria-label",
        "Open slideshow at: " + slideCaption(slide)
      );

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (slide.kind === "static") {
        img.src = resolveSrc(slide.path);
      } else {
        const u = URL.createObjectURL(slide.blob);
        thumbObjectUrls.push(u);
        img.src = u;
      }

      const cap = document.createElement("figcaption");
      if (slide.kind === "user") {
        cap.textContent = slide.label;
      } else {
        cap.textContent = labelFromPath(slide.path);
      }

      btn.appendChild(img);
      btn.addEventListener("click", () => openLightbox(index));

      fig.appendChild(btn);
      fig.appendChild(cap);
      frag.appendChild(fig);
    });
    mount.appendChild(frag);
  }

  async function refreshGallery() {
    const userRows = await loadUserExports();
    slides = buildSlides(userRows);
    renderGrid();
  }

  window.fitherGalleryAddExport = async function (blob, label) {
    if (!blob || blob.size === 0) return;
    try {
      const id = Date.now();
      const createdAt = id;
      await putUserExport({ id, blob, label: label || "Your export", createdAt });
      const all = await loadUserExports();
      await trimExports(all);
      await refreshGallery();
    } catch (e) {
      console.warn("fither: could not save export to gallery", e);
    }
  };

  getDb()
    .then(() => refreshGallery())
    .catch(() => {
      slides = buildSlides([]);
      renderGrid();
    });
})();
