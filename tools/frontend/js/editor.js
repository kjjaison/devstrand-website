/**
 * Interactive PDF editor — edit existing text (detecting font/color), add/move/remove
 * text & images, add/remove pages, zoom. Export via pdf-lib.
 */
(function (global) {
  "use strict";

  function uid() {
    return `ov-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeHex(hex) {
    if (!hex) return "#111111";
    let h = String(hex).trim();
    if (!h.startsWith("#")) h = `#${h}`;
    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return "#111111";
    return h.toLowerCase();
  }

  function hexToRgb01(hex) {
    const h = normalizeHex(hex).replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255 || 0,
      g: parseInt(h.slice(2, 4), 16) / 255 || 0,
      b: parseInt(h.slice(4, 6), 16) / 255 || 0,
    };
  }

  function toHexColor(r, g, b) {
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function loadHtmlImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image."));
      img.src = src;
    });
  }

  function stampSvgMarkup(id, color = "#111111") {
    const ink = normalizeHex(color);
    if (id === "tick") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <circle cx="128" cy="128" r="118" fill="#ffffff" stroke="${ink}" stroke-width="14"/>
        <path d="M72 130 L112 170 L188 86" fill="none" stroke="${ink}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
    if (id === "cross") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <circle cx="128" cy="128" r="118" fill="#ffffff" stroke="${ink}" stroke-width="14"/>
        <path d="M88 88 L168 168 M168 88 L88 168" fill="none" stroke="${ink}" stroke-width="22" stroke-linecap="round"/>
      </svg>`;
    }
    if (id === "circle") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <circle cx="128" cy="128" r="96" fill="none" stroke="${ink}" stroke-width="28"/>
      </svg>`;
    }
    if (id === "star") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <polygon points="128,28 155,98 230,98 170,142 192,214 128,170 64,214 86,142 26,98 101,98" fill="${ink}" stroke="${ink}" stroke-width="8" stroke-linejoin="round"/>
      </svg>`;
    }
    return "";
  }

  async function rasterizeSvgToPng(svgText, name) {
    const svgUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
    try {
      const img = await loadHtmlImage(svgUrl);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create stamp image.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const url = URL.createObjectURL(blob);
      return { bytes, url, name, type: "image/png", naturalW: 256, naturalH: 256 };
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function canvasToPngPayload(canvas, name) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not encode cropped image.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const url = URL.createObjectURL(blob);
    return { bytes, url, name, type: "image/png", naturalW: canvas.width, naturalH: canvas.height };
  }

  /** Built-in pdf-lib fonts + local TTF files under /static/fonts. */
  const FONT_CATALOG = [
    { id: "Helvetica", label: "Helvetica", group: "Standard", standard: "Helvetica", family: "Helvetica, Arial, sans-serif", weight: "400", style: "normal", match: [/helvetica/] },
    { id: "HelveticaBold", label: "Helvetica Bold", group: "Standard", standard: "HelveticaBold", family: "Helvetica, Arial, sans-serif", weight: "700", style: "normal", match: [/helvetica.*bold|arial.*bold|arial.?mt.?bold/] },
    { id: "HelveticaOblique", label: "Helvetica Oblique", group: "Standard", standard: "HelveticaOblique", family: "Helvetica, Arial, sans-serif", weight: "400", style: "italic", match: [/helvetica.*(oblique|italic)/] },
    { id: "HelveticaBoldOblique", label: "Helvetica Bold Oblique", group: "Standard", standard: "HelveticaBoldOblique", family: "Helvetica, Arial, sans-serif", weight: "700", style: "italic", match: [] },
    { id: "TimesRoman", label: "Times", group: "Standard", standard: "TimesRoman", family: '"Times New Roman", Times, serif', weight: "400", style: "normal", match: [/\btimes\b(?!.*bold)(?!.*italic)/] },
    { id: "TimesBold", label: "Times Bold", group: "Standard", standard: "TimesBold", family: '"Times New Roman", Times, serif', weight: "700", style: "normal", match: [/\btimes\b.*bold/] },
    { id: "TimesItalic", label: "Times Italic", group: "Standard", standard: "TimesItalic", family: '"Times New Roman", Times, serif', weight: "400", style: "italic", match: [/\btimes\b.*italic/] },
    { id: "TimesBoldItalic", label: "Times Bold Italic", group: "Standard", standard: "TimesBoldItalic", family: '"Times New Roman", Times, serif', weight: "700", style: "italic", match: [] },
    { id: "Courier", label: "Courier", group: "Standard", standard: "Courier", family: '"Courier New", Courier, monospace', weight: "400", style: "normal", match: [/\bcourier\b(?!.*bold)/] },
    { id: "CourierBold", label: "Courier Bold", group: "Standard", standard: "CourierBold", family: '"Courier New", Courier, monospace', weight: "700", style: "normal", match: [/\bcourier\b.*bold/] },
    { id: "CourierOblique", label: "Courier Oblique", group: "Standard", standard: "CourierOblique", family: '"Courier New", Courier, monospace', weight: "400", style: "italic", match: [] },
    { id: "CourierBoldOblique", label: "Courier Bold Oblique", group: "Standard", standard: "CourierBoldOblique", family: '"Courier New", Courier, monospace', weight: "700", style: "italic", match: [] },

    { id: "Roboto", label: "Roboto", group: "Sans", file: "Roboto-Regular.ttf", family: '"Roboto", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/\broboto\b(?!.*mono)(?!.*bold)(?!.*italic)/] },
    { id: "RobotoBold", label: "Roboto Bold", group: "Sans", file: "Roboto-Bold.ttf", family: '"Roboto", Helvetica, Arial, sans-serif', weight: "700", style: "normal", match: [/\broboto\b.*bold(?!.*italic)/] },
    { id: "RobotoItalic", label: "Roboto Italic", group: "Sans", file: "Roboto-Italic.ttf", family: '"Roboto", Helvetica, Arial, sans-serif', weight: "400", style: "italic", match: [/\broboto\b.*italic/] },
    { id: "OpenSans", label: "Open Sans", group: "Sans", file: "OpenSans-Regular.ttf", family: '"Open Sans", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/open.?sans(?!.*bold)(?!.*italic)/] },
    { id: "OpenSansBold", label: "Open Sans Bold", group: "Sans", file: "OpenSans-Bold.ttf", family: '"Open Sans", Helvetica, Arial, sans-serif', weight: "700", style: "normal", match: [/open.?sans.*bold/] },
    { id: "OpenSansItalic", label: "Open Sans Italic", group: "Sans", file: "OpenSans-Italic.ttf", family: '"Open Sans", Helvetica, Arial, sans-serif', weight: "400", style: "italic", match: [/open.?sans.*italic/] },
    { id: "Lato", label: "Lato", group: "Sans", file: "Lato-Regular.ttf", family: '"Lato", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/\blato\b(?!.*bold)/] },
    { id: "LatoBold", label: "Lato Bold", group: "Sans", file: "Lato-Bold.ttf", family: '"Lato", Helvetica, Arial, sans-serif', weight: "700", style: "normal", match: [/\blato\b.*bold/] },
    { id: "Montserrat", label: "Montserrat", group: "Sans", file: "Montserrat-Regular.ttf", family: '"Montserrat", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/montserrat(?!.*bold)/] },
    { id: "MontserratBold", label: "Montserrat Bold", group: "Sans", file: "Montserrat-Bold.ttf", family: '"Montserrat", Helvetica, Arial, sans-serif', weight: "700", style: "normal", match: [/montserrat.*bold/] },
    { id: "Poppins", label: "Poppins", group: "Sans", file: "Poppins-Regular.ttf", family: '"Poppins", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/poppins(?!.*bold)/] },
    { id: "PoppinsBold", label: "Poppins Bold", group: "Sans", file: "Poppins-Bold.ttf", family: '"Poppins", Helvetica, Arial, sans-serif', weight: "700", style: "normal", match: [/poppins.*bold/] },
    { id: "SourceSans3", label: "Source Sans 3", group: "Sans", file: "SourceSans3-Regular.ttf", family: '"Source Sans 3", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/source.?sans/] },
    { id: "Ubuntu", label: "Ubuntu", group: "Sans", file: "Ubuntu-Regular.ttf", family: '"Ubuntu", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/\bubuntu\b/] },
    { id: "PTSans", label: "PT Sans", group: "Sans", file: "PTSans-Regular.ttf", family: '"PT Sans", Helvetica, Arial, sans-serif', weight: "400", style: "normal", match: [/pt.?sans|verdana|tahoma|geneva/] },

    { id: "PTSerif", label: "PT Serif", group: "Serif", file: "PTSerif-Regular.ttf", family: '"PT Serif", Times, serif', weight: "400", style: "normal", match: [/pt.?serif|\bgeorgia\b|garamond|cambria|palatino|baskerville/] },

    { id: "RobotoMono", label: "Roboto Mono", group: "Mono", file: "RobotoMono-Regular.ttf", family: '"Roboto Mono", Consolas, monospace', weight: "400", style: "normal", match: [/roboto.?mono|consolas|menlo|monaco|monaco/] },
    { id: "SourceCodePro", label: "Source Code Pro", group: "Mono", file: "SourceCodePro-Regular.ttf", family: '"Source Code Pro", Consolas, monospace', weight: "400", style: "normal", match: [/source.?code|inconsolata|fira.?code/] },

    { id: "ComicNeue", label: "Comic Neue", group: "Display", file: "ComicNeue-Regular.ttf", family: '"Comic Neue", "Comic Sans MS", cursive', weight: "400", style: "normal", match: [/comic/] },
  ];

  const FONT_BY_ID = Object.fromEntries(FONT_CATALOG.map((f) => [f.id, f]));
  const fontBytesCache = {};

  function ensureEditorFontFaces() {
    if (document.getElementById("editor-font-faces")) return;
    const style = document.createElement("style");
    style.id = "editor-font-faces";
    style.textContent = FONT_CATALOG.filter((f) => f.file)
      .map((f) => {
        const family = f.family.split(",")[0].trim().replace(/"/g, "");
        return `@font-face{font-family:"${family}";src:url("/static/fonts/${f.file}") format("truetype");font-weight:${f.weight};font-style:${f.style};font-display:swap;}`;
      })
      .join("\n");
    document.head.appendChild(style);
  }

  /** Map PDF font names to catalog ids (closest match). */
  function mapFontNameToCatalog(name) {
    const n = String(name || "")
      .toLowerCase()
      .replace(/[+_,-]/g, " ");
    const bold = /\b(bold|black|heavy|demibold|semibold|bd|boldmt)\b/.test(n);
    const italic = /\b(italic|oblique|it|italicmt)\b/.test(n);

    for (const font of FONT_CATALOG) {
      if ((font.match || []).some((re) => re.test(n))) return font.id;
    }

    if (/\barial\b|\bms sans\b|\bcalibri\b|\bsegoe\b|\bnoto sans\b/.test(n)) {
      if (bold && italic) return "HelveticaBoldOblique";
      if (bold) return "RobotoBold";
      if (italic) return "RobotoItalic";
      return "Roboto";
    }
    if (/\bgeorgia\b|\btimes\b|\bserif\b/.test(n) && !/\bsans\b/.test(n)) {
      if (bold && italic) return "TimesBoldItalic";
      if (bold) return "TimesBold";
      if (italic) return "TimesItalic";
      return "PTSerif";
    }
    if (/\bmono\b|\bcourier\b|\bconsolas\b/.test(n)) {
      return bold ? "CourierBold" : "RobotoMono";
    }
    if (bold && italic) return "HelveticaBoldOblique";
    if (bold) return "HelveticaBold";
    if (italic) return "HelveticaOblique";
    return "Helvetica";
  }

  function fontCss(fontId) {
    const f = FONT_BY_ID[fontId] || FONT_BY_ID.Helvetica;
    return { family: f.family, weight: f.weight, style: f.style };
  }

  function getFontDef(fontId) {
    return FONT_BY_ID[fontId] || FONT_BY_ID.Helvetica;
  }

  async function loadFontFileBytes(file) {
    if (!fontBytesCache[file]) {
      const res = await fetch(`/static/fonts/${file}`);
      if (!res.ok) throw new Error(`Could not load font ${file}`);
      fontBytesCache[file] = await res.arrayBuffer();
    }
    return fontBytesCache[file];
  }

  /** Sample dominant non-background ink color from the rendered page canvas. */
  function sampleColorFromCanvas(canvas, x, y, w, h) {
    if (!canvas) return "#111111";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#111111";
    const left = Math.max(0, Math.floor(x + Math.max(w, 4) * 0.08));
    const top = Math.max(0, Math.floor(y + Math.max(h, 4) * 0.15));
    const width = Math.max(1, Math.min(Math.floor(Math.max(w, 4) * 0.84) || 4, canvas.width - left));
    const height = Math.max(1, Math.min(Math.floor(Math.max(h, 4) * 0.7) || 4, canvas.height - top));
    let data;
    try {
      data = ctx.getImageData(left, top, width, height).data;
    } catch (_) {
      return "#111111";
    }

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 140) continue;
      if (r > 235 && g > 235 && b > 235) continue;
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      const prev = buckets.get(key);
      if (prev) {
        prev.count += 1;
        prev.r += r;
        prev.g += g;
        prev.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
    if (!buckets.size) return "#111111";
    let best = null;
    for (const v of buckets.values()) {
      if (!best || v.count > best.count) best = v;
    }
    return toHexColor(best.r / best.count, best.g / best.count, best.b / best.count);
  }

  class InteractivePdfEditor {
    constructor(root) {
      this.root = root;
      this.pdfBytes = null;
      this.pdfDoc = null;
      this.pageCount = 0;
      this.pageIndex = 0;
      this.scale = 1.6;
      this.minScale = 0.5;
      this.maxScale = 3.5;
      this.mode = "select";
      this.overlays = {};
      this.pageText = {};
      this.selectedId = null;
      this.editingId = null;
      this.pendingImage = null;
      this.drag = null;
      this.renderToken = 0;
      this._syncingToolbar = false;
      this._editSnapshot = null;
      this.undoStack = [];
      this.redoStack = [];
      this._historyLocked = false;
      this._dragHistoryPushed = false;
      this._styleHistoryPushed = false;
      this.cropSession = null;
      this.stampColor = "#111111";
      this.selectedStampId = null;

      this.thumbsEl = root.querySelector("[data-editor-thumbs]");
      this.stageEl = root.querySelector("[data-editor-stage]");
      this.stageWrap = root.querySelector("[data-editor-stage-wrap]") || root.querySelector(".editor-stage-wrap");
      this.canvas = root.querySelector("[data-editor-canvas]");
      this.layer = root.querySelector("[data-editor-layer]");
      this.statusEl = root.querySelector("[data-editor-status]");
      this.fontSizeInput = root.querySelector("[data-editor-font-size]");
      this.fontFamilyInput = root.querySelector("[data-editor-font-family]");
      this.colorInput = root.querySelector("[data-editor-color]");
      this.imageInput = root.querySelector("[data-editor-image]");
      this.imageWidthInput = root.querySelector("[data-editor-image-width]");
      this.imageSizeWrap = root.querySelector("[data-editor-image-size-wrap]");
      this.stampsEl = root.querySelector("[data-editor-stamps]");
      this.stampCustomColor = root.querySelector("[data-editor-stamp-custom-color]");
      this.zoomLabel = root.querySelector("[data-editor-zoom-label]");
      this.cropModal = root.querySelector("[data-editor-crop-modal]");
      this.cropStage = root.querySelector("[data-editor-crop-stage]");
      this.cropImg = root.querySelector("[data-editor-crop-img]");
      this.cropBox = root.querySelector("[data-editor-crop-box]");

      ensureEditorFontFaces();
      this._populateFontSelect();
      this._applyStampColorToUi();
      this._bindToolbar();
      this._bindStage();
      this._bindCropUi();
    }

    _setStampsPanelVisible(show) {
      if (!this.stampsEl) return;
      this.stampsEl.hidden = !show;
      this.stampsEl.classList.toggle("is-open", !!show);
      if (!show) {
        this.selectedStampId = null;
        this.root.querySelectorAll("[data-editor-stamp]").forEach((b) => b.classList.remove("active"));
      }
    }

    _leaveImagePicker() {
      if (this.mode === "image") {
        this.mode = "select";
        this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-editor-mode") === "select");
        });
      }
      this.pendingImage = null;
      this._setStampsPanelVisible(false);
    }

    _applyStampColorToUi() {
      const color = normalizeHex(this.stampColor || "#111111");
      this.root.style.setProperty("--stamp-ink", color);
      this.root.querySelectorAll("[data-editor-stamp]").forEach((btn) => {
        btn.style.setProperty("--stamp-ink", color);
        btn.style.color = color;
      });
      if (this.stampCustomColor) this.stampCustomColor.value = color;
      this.root.querySelectorAll("[data-editor-stamp-color]").forEach((btn) => {
        const swatch = normalizeHex(btn.getAttribute("data-editor-stamp-color"));
        btn.classList.toggle("active", swatch === color);
      });
    }

    async _setStampColor(color, { refreshPending = true } = {}) {
      this.stampColor = normalizeHex(color);
      this._applyStampColorToUi();
      if (refreshPending && this.selectedStampId && this.mode === "image") {
        await this._prepareStamp(this.selectedStampId);
      }
    }

    async _prepareStamp(stampId) {
      const svg = stampSvgMarkup(stampId, this.stampColor);
      if (!svg) return;
      this.pendingImage = await rasterizeSvgToPng(svg, `stamp-${stampId}.png`);
      this.selectedStampId = stampId;
      this.mode = "image";
      this._setStampsPanelVisible(true);
      this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-editor-mode") === "image");
      });
      this.root.querySelectorAll("[data-editor-stamp]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-editor-stamp") === stampId);
      });
      this._setStatus(`Stamp ready (${stampId}). Click the page to place it. Drag corners to resize.`);
    }

    _populateFontSelect() {
      const select = this.fontFamilyInput;
      if (!select) return;
      const current = select.value || "Helvetica";
      select.innerHTML = "";
      const groups = {};
      FONT_CATALOG.forEach((font) => {
        if (!groups[font.group]) groups[font.group] = [];
        groups[font.group].push(font);
      });
      Object.keys(groups).forEach((groupName) => {
        const og = document.createElement("optgroup");
        og.label = groupName;
        groups[groupName].forEach((font) => {
          const opt = document.createElement("option");
          opt.value = font.id;
          opt.textContent = font.label;
          og.appendChild(opt);
        });
        select.appendChild(og);
      });
      if (FONT_BY_ID[current]) select.value = current;
      else select.value = "Helvetica";
    }

    _cloneOverlays(source) {
      const out = {};
      Object.keys(source || {}).forEach((key) => {
        out[key] = (source[key] || []).map((ov) => ({
          ...ov,
          imageBytes: ov.imageBytes,
        }));
      });
      return out;
    }

    _clonePageText(source) {
      const out = {};
      Object.keys(source || {}).forEach((key) => {
        out[key] = (source[key] || []).map((ov) => ({ ...ov }));
      });
      return out;
    }

    _snapshotState() {
      return {
        overlays: this._cloneOverlays(this.overlays),
        pageText: this._clonePageText(this.pageText),
        pageIndex: this.pageIndex,
        selectedId: this.selectedId,
        scale: this.scale,
        pdfBytes: this.pdfBytes,
        pageCount: this.pageCount,
      };
    }

    _pushHistory() {
      if (this._historyLocked || this.root.hidden) return;
      this.undoStack.push(this._snapshotState());
      if (this.undoStack.length > 40) this.undoStack.shift();
      this.redoStack = [];
    }

    async _restoreState(snap) {
      if (!snap) return;
      this._historyLocked = true;
      try {
        this.overlays = this._cloneOverlays(snap.overlays);
        this.pageText = this._clonePageText(snap.pageText);
        this.selectedId = snap.selectedId;
        this.editingId = null;
        this._editSnapshot = null;
        const pdfChanged = snap.pdfBytes && snap.pdfBytes !== this.pdfBytes;
        this.pdfBytes = snap.pdfBytes;
        this.scale = snap.scale || this.scale;
        if (pdfChanged) {
          this.pdfDoc = await pdfjsLib.getDocument({ data: this.pdfBytes.slice(0) }).promise;
          this.pageCount = this.pdfDoc.numPages;
          this.pageIndex = Math.min(snap.pageIndex || 0, this.pageCount - 1);
          await this._renderThumbs();
          await this.renderPage(this.pageIndex, { keepSelection: true });
        } else {
          this.pageIndex = snap.pageIndex || 0;
          await this.renderPage(this.pageIndex, { keepSelection: true });
        }
        if (this.selectedId) {
          const selected = this._findItem(this.selectedId);
          this._syncToolbarFromItem(selected);
          this._syncImageSizeToolbar(selected);
        } else {
          this._syncImageSizeToolbar(null);
        }
        this._updateZoomLabel();
      } finally {
        this._historyLocked = false;
      }
    }

    async undo() {
      if (this.editingId) this._commitInlineEdit();
      if (!this.undoStack.length) {
        this._setStatus("Nothing to undo.", true);
        return;
      }
      this.redoStack.push(this._snapshotState());
      const prev = this.undoStack.pop();
      await this._restoreState(prev);
      this._setStatus("Undone (Ctrl+Z). Ctrl+Y to redo.");
    }

    async redo() {
      if (this.editingId) this._commitInlineEdit();
      if (!this.redoStack.length) {
        this._setStatus("Nothing to redo.", true);
        return;
      }
      this.undoStack.push(this._snapshotState());
      const next = this.redoStack.pop();
      await this._restoreState(next);
      this._setStatus("Redone.");
    }

    _bindToolbar() {
      this.root.querySelectorAll("[data-editor-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._commitInlineEdit();
          this.mode = btn.getAttribute("data-editor-mode");
          this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });
          const imageMode = this.mode === "image";
          this._setStampsPanelVisible(imageMode);
          if (!imageMode) this.pendingImage = null;
          this._setStatus(
            this.mode === "text"
              ? "Click the page to place text. Double-click any text to edit it."
              : imageMode
                ? "Pick a stamp or Upload image, then click the page to place it."
                : "Select text to inspect font/color. Double-click to edit. Ctrl+Z undoes."
          );
        });
      });

      // Any other toolbar control (not Add image) closes the stamp panel.
      this.root.querySelector(".editor-toolbar")?.addEventListener("click", (e) => {
        if (e.target.closest('[data-editor-mode="image"]')) return;
        if (e.target.closest("[data-editor-mode]")) return; // text/select already hide above
        if (this.stampsEl && !this.stampsEl.hidden) this._leaveImagePicker();
      });

      this.root.querySelector("[data-editor-delete]")?.addEventListener("click", () => this.deleteSelected());
      this.root.querySelector("[data-editor-clear-page]")?.addEventListener("click", () => this.clearPage());
      this.root.querySelector("[data-editor-zoom-in]")?.addEventListener("click", () => this.zoomBy(0.2));
      this.root.querySelector("[data-editor-zoom-out]")?.addEventListener("click", () => this.zoomBy(-0.2));
      this.root.querySelector("[data-editor-zoom-fit]")?.addEventListener("click", () => this.zoomFit());
      this.root.querySelector("[data-editor-add-page]")?.addEventListener("click", () => this.addBlankPageAfter());
      this.root.querySelector("[data-editor-duplicate-page]")?.addEventListener("click", () => this.duplicateCurrentPage());
      this.root.querySelector("[data-editor-remove-page]")?.addEventListener("click", () => this.removeCurrentPage());
      this.root.querySelector("[data-editor-edit-text]")?.addEventListener("click", () => this.editSelectedText());
      this.root.querySelector("[data-editor-undo]")?.addEventListener("click", () => this.undo());
      this.root.querySelector("[data-editor-redo]")?.addEventListener("click", () => this.redo());
      this.root.querySelector("[data-editor-crop-image]")?.addEventListener("click", () => this.openCropSelected());
      this.root.querySelector("[data-editor-upload-image]")?.addEventListener("click", () => {
        this.mode = "image";
        this.selectedStampId = null;
        this._setStampsPanelVisible(true);
        this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-editor-mode") === "image");
        });
        this.root.querySelectorAll("[data-editor-stamp]").forEach((b) => b.classList.remove("active"));
        this.imageInput?.click();
      });

      this.root.querySelectorAll("[data-editor-stamp-color]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._setStampColor(btn.getAttribute("data-editor-stamp-color"));
        });
      });
      this.stampCustomColor?.addEventListener("input", () => {
        this._setStampColor(this.stampCustomColor.value);
      });
      this.stampCustomColor?.addEventListener("change", () => {
        this._setStampColor(this.stampCustomColor.value);
      });

      this.root.querySelectorAll("[data-editor-stamp]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const stampId = btn.getAttribute("data-editor-stamp");
          try {
            await this._prepareStamp(stampId);
          } catch (err) {
            this._setStatus(err.message || String(err), true);
          }
        });
      });

      const onStyleChange = () => this._applyToolbarStyleToSelected();
      this.fontSizeInput?.addEventListener("input", onStyleChange);
      this.fontSizeInput?.addEventListener("change", () => {
        this._styleHistoryPushed = false;
        onStyleChange();
      });
      this.fontFamilyInput?.addEventListener("change", () => {
        this._styleHistoryPushed = false;
        onStyleChange();
      });
      this.colorInput?.addEventListener("input", onStyleChange);
      this.colorInput?.addEventListener("change", () => {
        this._styleHistoryPushed = false;
        onStyleChange();
      });

      this.imageWidthInput?.addEventListener("change", () => this._applyImageWidthFromToolbar());
      this.imageWidthInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this._applyImageWidthFromToolbar();
        }
      });

      this.imageInput?.addEventListener("change", async () => {
        const file = this.imageInput.files?.[0];
        if (!file) return;
        try {
          const url = URL.createObjectURL(file);
          const img = await loadHtmlImage(url);
          URL.revokeObjectURL(url);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          canvas.getContext("2d").drawImage(img, 0, 0);
          this.pendingImage = await canvasToPngPayload(canvas, file.name.replace(/\.\w+$/, "") + ".png");
          this.selectedStampId = null;
          this.mode = "image";
          this._setStampsPanelVisible(true);
          this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
            b.classList.toggle("active", b.getAttribute("data-editor-mode") === "image");
          });
          this.root.querySelectorAll("[data-editor-stamp]").forEach((b) => b.classList.remove("active"));
          this._setStatus("Click the page to place the image. Drag corners to resize, or use Crop image.");
        } catch (err) {
          this._setStatus(err.message || String(err), true);
        }
        this.imageInput.value = "";
      });

      document.addEventListener("keydown", (e) => {
        if (this.root.hidden) return;
        if (this.cropSession && e.key === "Escape") {
          e.preventDefault();
          this.closeCropModal();
          return;
        }
        if (this.editingId || e.target?.isContentEditable) {
          if (e.key === "Escape") {
            e.preventDefault();
            this._cancelInlineEdit();
          }
          // Let the browser handle Ctrl+Z inside contenteditable text.
          return;
        }
        const tag = (e.target && e.target.tagName) || "";
        const outsideEditor = !this.root.contains(e.target);
        const outsideTyping =
          outsideEditor && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
          if (outsideTyping) return;
          e.preventDefault();
          this.undo();
          return;
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          ((e.key === "y" || e.key === "Y") || (e.shiftKey && (e.key === "z" || e.key === "Z")))
        ) {
          if (outsideTyping) return;
          e.preventDefault();
          this.redo();
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && this.selectedId) {
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
          e.preventDefault();
          this.deleteSelected();
        }
        if ((e.key === "Enter" || e.key === "F2") && this.selectedId) {
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
          const item = this._findItem(this.selectedId);
          if (item && (item.type === "text" || item.type === "native")) {
            e.preventDefault();
            this._startInlineEdit(this.selectedId);
          }
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
          e.preventDefault();
          this.zoomBy(0.2);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "-") {
          e.preventDefault();
          this.zoomBy(-0.2);
        }
      });
    }

    _bindStage() {
      this.layer.addEventListener("click", (e) => this._onLayerClick(e));
      this.layer.addEventListener("dblclick", (e) => this._onLayerDblClick(e));
      this.layer.addEventListener("pointerdown", (e) => this._onPointerDown(e));
      window.addEventListener("pointermove", (e) => this._onPointerMove(e));
      window.addEventListener("pointerup", () => this._onPointerUp());
    }

    _fontLabel(key) {
      return FONT_BY_ID[key]?.label || key || "Helvetica";
    }

    _syncToolbarFromItem(item) {
      if (!item || (item.type !== "text" && item.type !== "native")) return;
      this._syncingToolbar = true;
      if (this.fontSizeInput) this.fontSizeInput.value = String(Math.max(8, Math.round(item.fontSize || 12)));
      if (this.colorInput) this.colorInput.value = normalizeHex(item.color || "#111111");
      if (this.fontFamilyInput) {
        const key = item.fontFamily || "Helvetica";
        if (FONT_BY_ID[key]) this.fontFamilyInput.value = key;
        else {
          const mapped = mapFontNameToCatalog(key);
          this.fontFamilyInput.value = mapped;
          item.fontFamily = mapped;
        }
      }
      this._syncingToolbar = false;
    }

    _applyStyleToElement(el, item) {
      if (!el || !item) return;
      const css = fontCss(item.fontFamily);
      el.style.fontSize = `${item.fontSize}px`;
      el.style.color = item.color || "#111";
      el.style.fontFamily = css.family;
      el.style.fontWeight = css.weight;
      el.style.fontStyle = css.style;
    }

    _applyToolbarStyleToSelected() {
      if (this._syncingToolbar) return;
      const item = this._findItem(this.selectedId);
      if (!item || (item.type !== "text" && item.type !== "native")) return;

      if (!this._styleHistoryPushed) {
        this._pushHistory();
        this._styleHistoryPushed = true;
      }
      const size = Number(this.fontSizeInput?.value);
      if (size > 0) item.fontSize = size;
      if (this.colorInput?.value) item.color = normalizeHex(this.colorInput.value);
      if (this.fontFamilyInput?.value) item.fontFamily = this.fontFamilyInput.value;

      let needsFullPaint = false;
      if (item.type === "native" && !item.edited) {
        item.edited = true;
        item.coverW = Math.max(item.w || 0, (item.originalText || "").length * (item.fontSize || 12) * 0.55);
        item.coverH = Math.max(item.h || item.fontSize || 12, (item.fontSize || 12) * 1.1);
        needsFullPaint = true;
      } else if (item.type === "native") {
        item.edited = true;
      }

      if (needsFullPaint || this.editingId !== item.id) {
        this._paintOverlays();
        if (this.editingId === item.id) {
          const el = this.layer.querySelector(`.editor-overlay[data-id="${item.id}"]`);
          if (el) {
            el.classList.add("is-editing");
            el.contentEditable = "true";
            this._applyStyleToElement(el, item);
            el.focus();
          }
        }
        return;
      }

      const el = this.layer.querySelector(`.editor-overlay[data-id="${item.id}"]`);
      if (el) this._applyStyleToElement(el, item);
    }

    _applyImageWidthFromToolbar() {
      const item = this._findItem(this.selectedId);
      if (!item || item.type !== "image") return;
      const nextW = Number(this.imageWidthInput?.value);
      if (!(nextW > 0)) return;
      const ratio =
        item.h && item.w
          ? item.h / item.w
          : item.naturalH && item.naturalW
            ? item.naturalH / item.naturalW
            : 0.75;
      this._pushHistory();
      item.w = Math.max(16, Math.min(nextW, this.canvas.width));
      item.h = Math.max(16, item.w * ratio);
      this._paintOverlays();
      this._setStatus(`Image sized to ${Math.round(item.w)}×${Math.round(item.h)}px.`);
    }

    _syncImageSizeToolbar(item) {
      const show = !!(item && item.type === "image");
      if (this.imageSizeWrap) this.imageSizeWrap.hidden = !show;
      if (show && this.imageWidthInput) {
        this.imageWidthInput.value = String(Math.round(item.w || 160));
      }
    }

    _selectItem(id) {
      this.selectedId = id || null;
      const item = id ? this._findItem(id) : null;
      this._syncImageSizeToolbar(item);
      if (item && (item.type === "text" || item.type === "native")) {
        this._syncToolbarFromItem(item);
        this._setStatus(
          `Selected: ${this._fontLabel(item.fontFamily)} · ${Math.round(item.fontSize || 12)}px · ${normalizeHex(item.color)}. Double-click to edit.`
        );
      } else if (item && item.type === "image") {
        this._setStampsPanelVisible(true);
        this._setStatus(
          `Image selected (${Math.round(item.w)}×${Math.round(item.h)}px). Drag to move, corners to resize, or Crop image.`
        );
      } else if (this.mode !== "image") {
        this._setStampsPanelVisible(false);
      }
      this._paintOverlays();
    }

    _updateZoomLabel() {
      if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;
    }

    _allItems(pageIndex = this.pageIndex) {
      return [...(this.pageText[pageIndex] || []), ...(this.overlays[pageIndex] || [])];
    }

    _findItem(id, pageIndex = this.pageIndex) {
      return this._allItems(pageIndex).find((o) => o.id === id) || null;
    }

    async load(arrayBuffer, { keepOverlays = false, pageIndex = 0, keepHistory = false } = {}) {
      if (!global.pdfjsLib) throw new Error("PDF.js not loaded yet.");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      this.pdfBytes = arrayBuffer.slice(0);
      this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      this.pageCount = this.pdfDoc.numPages;
      this.pageIndex = Math.min(Math.max(0, pageIndex), this.pageCount - 1);
      this.pageText = {};
      this.editingId = null;
      this._editSnapshot = null;
      if (!keepOverlays) {
        this.overlays = {};
        for (let i = 0; i < this.pageCount; i++) this.overlays[i] = [];
      } else {
        for (let i = 0; i < this.pageCount; i++) {
          if (!this.overlays[i]) this.overlays[i] = [];
        }
      }
      this.selectedId = null;
      this.root.hidden = false;
      if (!keepHistory) {
        this.undoStack = [];
        this.redoStack = [];
      }
      this._updateZoomLabel();
      await this._renderThumbs();
      await this.renderPage(this.pageIndex);
      if (!keepOverlays) await this.zoomFit();
      this._setStatus("Click text to see its font & color. Double-click to edit. Ctrl+Z undoes changes.");
    }

    reset() {
      this.pdfBytes = null;
      this.pdfDoc = null;
      this.pageCount = 0;
      this.overlays = {};
      this.pageText = {};
      this.selectedId = null;
      this.editingId = null;
      this._editSnapshot = null;
      this.undoStack = [];
      this.redoStack = [];
      this.pendingImage = null;
      this.selectedStampId = null;
      this.closeCropModal();
      this._syncImageSizeToolbar(null);
      this._setStampsPanelVisible(false);
      this.scale = 1.6;
      this.thumbsEl.innerHTML = "";
      this.layer.innerHTML = "";
      const ctx = this.canvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._updateZoomLabel();
      this.root.hidden = true;
    }

    async zoomBy(delta) {
      const next = Math.min(this.maxScale, Math.max(this.minScale, this.scale + delta));
      if (Math.abs(next - this.scale) < 0.001) return;
      await this._setScale(next);
    }

    async zoomFit() {
      if (!this.pdfDoc || !this.stageWrap) return;
      const page = await this.pdfDoc.getPage(this.pageIndex + 1);
      const base = page.getViewport({ scale: 1 });
      const avail = Math.max(320, this.stageWrap.clientWidth - 48);
      const next = Math.min(this.maxScale, Math.max(this.minScale, avail / base.width));
      await this._setScale(next);
    }

    _scaleItems(items, ratio) {
      (items || []).forEach((ov) => {
        ov.x *= ratio;
        ov.y *= ratio;
        if (ov.w) ov.w *= ratio;
        if (ov.h) ov.h *= ratio;
        if (ov.fontSize) ov.fontSize *= ratio;
        if (ov.coverX != null) {
          ov.coverX *= ratio;
          ov.coverY *= ratio;
          ov.coverW *= ratio;
          ov.coverH *= ratio;
        }
      });
    }

    async _setScale(next) {
      this._commitInlineEdit();
      const ratio = next / this.scale;
      Object.keys(this.overlays).forEach((key) => this._scaleItems(this.overlays[key], ratio));
      Object.keys(this.pageText).forEach((key) => this._scaleItems(this.pageText[key], ratio));
      this.scale = next;
      this._updateZoomLabel();
      await this.renderPage(this.pageIndex);
    }

    async _reloadFromBytes(bytes, pageIndex) {
      const overlays = this.overlays;
      await this.load(bytes, { keepOverlays: true, pageIndex, keepHistory: true });
      this.overlays = overlays;
      for (let i = 0; i < this.pageCount; i++) {
        if (!this.overlays[i]) this.overlays[i] = [];
      }
      this.pageText = {};
      await this._renderThumbs();
      await this.renderPage(this.pageIndex);
    }

    _remapOverlaysAfterInsert(atIndex) {
      const rebuilt = {};
      const keys = Object.keys(this.overlays).map(Number);
      const max = keys.length ? Math.max(...keys, atIndex) : atIndex;
      for (let i = 0; i <= max + 1; i++) {
        if (i < atIndex) rebuilt[i] = this.overlays[i] || [];
        else if (i === atIndex) rebuilt[i] = [];
        else rebuilt[i] = this.overlays[i - 1] || [];
      }
      this.overlays = rebuilt;
    }

    _remapOverlaysAfterRemove(removedIndex) {
      const rebuilt = {};
      Object.keys(this.overlays)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((i) => {
          if (i < removedIndex) rebuilt[i] = this.overlays[i] || [];
          else if (i > removedIndex) rebuilt[i - 1] = this.overlays[i] || [];
        });
      this.overlays = rebuilt;
    }

    async addBlankPageAfter() {
      if (!global.PDFLib || !this.pdfBytes) return;
      this._pushHistory();
      try {
        const { PDFDocument } = PDFLib;
        const src = await PDFDocument.load(this.pdfBytes.slice(0));
        const out = await PDFDocument.create();
        const insertAt = this.pageIndex + 1;
        const cur = src.getPage(this.pageIndex);
        const { width, height } = cur.getSize();
        for (let i = 0; i < src.getPageCount(); i++) {
          if (i === insertAt) out.addPage([width, height]);
          const [copied] = await out.copyPages(src, [i]);
          out.addPage(copied);
        }
        if (insertAt >= src.getPageCount()) out.addPage([width, height]);
        const bytes = await out.save();
        this._remapOverlaysAfterInsert(insertAt);
        await this._reloadFromBytes(bytes, insertAt);
        this._setStatus(`Blank page added as page ${insertAt + 1}.`);
      } catch (err) {
        this._setStatus(err.message || String(err), true);
      }
    }

    async duplicateCurrentPage() {
      if (!global.PDFLib || !this.pdfBytes) return;
      this._pushHistory();
      try {
        const { PDFDocument } = PDFLib;
        const src = await PDFDocument.load(this.pdfBytes.slice(0));
        const out = await PDFDocument.create();
        const insertAt = this.pageIndex + 1;
        for (let i = 0; i < src.getPageCount(); i++) {
          const [copied] = await out.copyPages(src, [i]);
          out.addPage(copied);
          if (i === this.pageIndex) {
            const [dup] = await out.copyPages(src, [i]);
            out.addPage(dup);
          }
        }
        const bytes = await out.save();
        const copyOverlays = (this.overlays[this.pageIndex] || []).map((ov) => ({
          ...ov,
          id: uid(),
          imageBytes: ov.imageBytes,
        }));
        this._remapOverlaysAfterInsert(insertAt);
        this.overlays[insertAt] = copyOverlays;
        await this._reloadFromBytes(bytes, insertAt);
        this._setStatus(`Page duplicated as page ${insertAt + 1}.`);
      } catch (err) {
        this._setStatus(err.message || String(err), true);
      }
    }

    async removeCurrentPage() {
      if (!this.pdfBytes || this.pageCount <= 1) {
        this._setStatus("Cannot remove the only page.", true);
        return;
      }
      if (!window.confirm(`Remove page ${this.pageIndex + 1}?`)) return;
      this._pushHistory();
      try {
        const { PDFDocument } = PDFLib;
        const src = await PDFDocument.load(this.pdfBytes.slice(0));
        const out = await PDFDocument.create();
        const removeAt = this.pageIndex;
        for (let i = 0; i < src.getPageCount(); i++) {
          if (i === removeAt) continue;
          const [copied] = await out.copyPages(src, [i]);
          out.addPage(copied);
        }
        const bytes = await out.save();
        this._remapOverlaysAfterRemove(removeAt);
        const nextIndex = Math.min(removeAt, out.getPageCount() - 1);
        await this._reloadFromBytes(bytes, nextIndex);
        this._setStatus("Page removed.");
      } catch (err) {
        this._setStatus(err.message || String(err), true);
      }
    }

    async _renderThumbs() {
      this.thumbsEl.innerHTML = "";
      for (let i = 0; i < this.pageCount; i++) {
        const page = await this.pdfDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.22 });
        const c = document.createElement("canvas");
        c.width = viewport.width;
        c.height = viewport.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport }).promise;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "editor-thumb" + (i === this.pageIndex ? " active" : "");
        btn.dataset.page = String(i);
        btn.innerHTML = `<img alt="Page ${i + 1}" /><span>Page ${i + 1}</span>`;
        btn.querySelector("img").src = c.toDataURL("image/jpeg", 0.7);
        btn.addEventListener("click", () => this.renderPage(i));
        this.thumbsEl.appendChild(btn);
      }
    }

    async _extractNativeText(pageIndex) {
      const page = await this.pdfDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: this.scale });
      const content = await page.getTextContent();
      const styles = content.styles || {};
      const prevByKey = {};
      (this.pageText[pageIndex] || []).forEach((it) => {
        if (it.key) prevByKey[it.key] = it;
      });

      const items = [];
      for (const item of content.items) {
        const str = item.str;
        if (!str || !String(str).trim()) continue;

        const m = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.max(6, Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]) || 12);
        const scaleX = Math.hypot(m[0], m[1]) || 1;
        const itemScale = Math.hypot(item.transform[0], item.transform[1]) || 1;
        const w = Math.max(fontSize * 0.4, (item.width || str.length * 0.5) * (scaleX / itemScale));
        const h = fontSize * 1.15;
        const x = m[4];
        const y = m[5] - fontSize * 0.85;
        const key = `${item.transform[4].toFixed(2)}_${item.transform[5].toFixed(2)}_${str}`;
        const prev = prevByKey[key];

        const style = styles[item.fontName] || {};
        const detectedFont = mapFontNameToCatalog(`${style.fontFamily || ""} ${item.fontName || ""}`);
        const detectedColor = sampleColorFromCanvas(this.canvas, x, y, w, h);

        items.push({
          id: prev?.id || uid(),
          type: "native",
          key,
          originalText: str,
          text: prev && prev.edited ? prev.text : str,
          x: prev && prev.edited && prev.moved ? prev.x : x,
          y: prev && prev.edited && prev.moved ? prev.y : y,
          w: prev && prev.edited && prev.moved ? prev.w : w,
          h: prev && prev.edited && prev.moved ? prev.h : h,
          fontSize: prev && prev.edited ? prev.fontSize : fontSize,
          fontFamily: prev && prev.edited ? prev.fontFamily : detectedFont,
          color: prev && prev.edited ? prev.color : detectedColor,
          sourceFont: style.fontFamily || item.fontName || "",
          coverX: prev?.coverX ?? x,
          coverY: prev?.coverY ?? y,
          coverW: prev?.coverW ?? Math.max(w, fontSize * str.length * 0.55),
          coverH: prev?.coverH ?? h,
          edited: !!(prev && prev.edited),
          deleted: !!(prev && prev.deleted),
          moved: !!(prev && prev.moved),
        });
      }
      this.pageText[pageIndex] = items;
    }

    async renderPage(index, { keepSelection = false } = {}) {
      this._commitInlineEdit();
      const token = ++this.renderToken;
      this.pageIndex = index;
      if (!keepSelection) this.selectedId = null;
      this.thumbsEl.querySelectorAll(".editor-thumb").forEach((el) => {
        el.classList.toggle("active", Number(el.dataset.page) === index);
      });
      const page = await this.pdfDoc.getPage(index + 1);
      if (token !== this.renderToken) return;
      const viewport = page.getViewport({ scale: this.scale });
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      this.stageEl.style.width = `${viewport.width}px`;
      this.stageEl.style.height = `${viewport.height}px`;
      await page.render({ canvasContext: this.canvas.getContext("2d"), viewport }).promise;
      if (token !== this.renderToken) return;
      if (!this.pageText[index]) {
        await this._extractNativeText(index);
        if (token !== this.renderToken) return;
      }
      this._paintOverlays();
    }

    _pageOverlays() {
      if (!this.overlays[this.pageIndex]) this.overlays[this.pageIndex] = [];
      return this.overlays[this.pageIndex];
    }

    _paintOverlays() {
      this.layer.innerHTML = "";
      this.layer.style.width = `${this.canvas.width}px`;
      this.layer.style.height = `${this.canvas.height}px`;

      const paintOne = (ov) => {
        if (ov.type === "native" && ov.deleted) {
          const cover = document.createElement("div");
          cover.className = "editor-native-cover";
          cover.style.left = `${ov.coverX ?? ov.x}px`;
          cover.style.top = `${ov.coverY ?? ov.y}px`;
          cover.style.width = `${Math.max(ov.coverW || ov.w || 0, (ov.originalText || "").length * (ov.fontSize || 12) * 0.55)}px`;
          cover.style.height = `${Math.max(ov.coverH || ov.h || ov.fontSize || 12, (ov.fontSize || 12) * 1.1)}px`;
          this.layer.appendChild(cover);
          return;
        }
        if (ov.type === "native" && ov.edited) {
          const cover = document.createElement("div");
          cover.className = "editor-native-cover";
          cover.style.left = `${ov.coverX ?? ov.x}px`;
          cover.style.top = `${ov.coverY ?? ov.y}px`;
          cover.style.width = `${Math.max(ov.coverW || ov.w || 0, (ov.originalText || "").length * (ov.fontSize || 12) * 0.55)}px`;
          cover.style.height = `${Math.max(ov.coverH || ov.h || ov.fontSize || 12, (ov.fontSize || 12) * 1.1)}px`;
          this.layer.appendChild(cover);
        }
        const el = document.createElement("div");
        el.className = "editor-overlay" + (ov.id === this.selectedId ? " selected" : "");
        el.dataset.id = ov.id;
        el.style.left = `${ov.x}px`;
        el.style.top = `${ov.y}px`;

        if (ov.type === "text" || ov.type === "native") {
          el.classList.add("is-text");
          if (ov.type === "native") {
            el.classList.add("is-native");
            if (ov.edited) el.classList.add("is-edited");
          }
          this._applyStyleToElement(el, ov);
          if (ov.type === "native" && !ov.edited) {
            el.style.minWidth = `${Math.max(ov.w || 0, 8)}px`;
            el.style.minHeight = `${Math.max(ov.h || 0, 8)}px`;
            el.classList.add("is-native-ghost");
          }
          if (ov.type === "native" && ov.edited) {
            el.style.background = "#fff";
          }
          el.textContent = ov.text;
          const src = ov.sourceFont ? ` (${ov.sourceFont})` : "";
          el.title =
            ov.type === "native"
              ? `Double-click to edit · ${this._fontLabel(ov.fontFamily)}${src} · ${normalizeHex(ov.color)}`
              : "Double-click to edit";
        } else {
          el.classList.add("is-image");
          el.style.width = `${ov.w}px`;
          el.style.height = `${ov.h}px`;
          const img = document.createElement("img");
          img.src = ov.imageUrl;
          img.alt = "";
          img.draggable = false;
          el.appendChild(img);
          if (ov.id === this.selectedId) {
            ["nw", "ne", "sw", "se"].forEach((corner) => {
              const handle = document.createElement("span");
              handle.className = `editor-resize-handle ${corner}`;
              handle.dataset.resize = corner;
              el.appendChild(handle);
            });
          }
        }
        this.layer.appendChild(el);
      };

      (this.pageText[this.pageIndex] || []).forEach(paintOne);
      this._pageOverlays().forEach(paintOne);
    }

    _onLayerDblClick(e) {
      const hit = e.target.closest(".editor-overlay");
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      const item = this._findItem(hit.dataset.id);
      if (!item || (item.type !== "text" && item.type !== "native")) return;
      this._selectItem(item.id);
      this._startInlineEdit(item.id);
    }

    editSelectedText() {
      if (!this.selectedId) {
        this._setStatus("Select text first, or double-click it.", true);
        return;
      }
      const item = this._findItem(this.selectedId);
      if (!item || (item.type !== "text" && item.type !== "native")) {
        this._setStatus("Selected item is not editable text.", true);
        return;
      }
      this._startInlineEdit(item.id);
    }

    _startInlineEdit(id) {
      this._commitInlineEdit();
      const item = this._findItem(id);
      if (!item || (item.type !== "text" && item.type !== "native")) return;
      this.selectedId = id;
      this.editingId = id;
      this.mode = "select";
      this.selectedStampId = null;
      this._setStampsPanelVisible(false);
      this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-editor-mode") === "select");
      });
      this._syncToolbarFromItem(item);
      this._paintOverlays();
      let el = this.layer.querySelector(`.editor-overlay[data-id="${id}"]`);
      if (!el) return;

      this._editSnapshot = {
        text: item.text,
        edited: item.edited,
        deleted: item.deleted,
        color: item.color,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
      };

      if (item.type === "native" && !item.edited) {
        item.edited = true;
        if (!item.coverW) {
          item.coverW = Math.max(item.w || 0, (item.originalText || "").length * (item.fontSize || 12) * 0.55);
          item.coverH = Math.max(item.h || item.fontSize || 12, (item.fontSize || 12) * 1.1);
        }
        this._paintOverlays();
        el = this.layer.querySelector(`.editor-overlay[data-id="${id}"]`);
        if (!el) return;
      }

      el.classList.remove("is-native-ghost");
      el.classList.add("is-editing");
      this._applyStyleToElement(el, item);
      el.contentEditable = "true";
      el.spellcheck = true;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const onBlur = () => {
        el.removeEventListener("blur", onBlur);
        el.removeEventListener("keydown", onKey);
        this._commitInlineEdit();
      };
      const onKey = (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          el.blur();
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          this._cancelInlineEdit();
        }
        ev.stopPropagation();
      };
      el.addEventListener("blur", onBlur);
      el.addEventListener("keydown", onKey);
      this._setStatus(
        `Editing with ${this._fontLabel(item.fontFamily)} · ${Math.round(item.fontSize)}px · ${normalizeHex(item.color)}. Change Font/Size/Color anytime.`
      );
    }

    _commitInlineEdit() {
      if (!this.editingId) return;
      const id = this.editingId;
      const el = this.layer.querySelector(`.editor-overlay[data-id="${id}"]`);
      const item = this._findItem(id);
      this.editingId = null;
      this._editSnapshot = null;
      if (!item || !el) {
        this._paintOverlays();
        return;
      }
      const next = (el.innerText || "").replace(/\u00a0/g, " ");
      if (next === item.text) {
        this._paintOverlays();
        return;
      }
      this._pushHistory();
      item.text = next;
      if (item.type === "native") item.edited = true;
      this._setStatus(
        item.type === "native"
          ? next.trim()
            ? "Existing text updated (same font/color unless you changed them). Run to save."
            : "Text cleared (will be covered on export)."
          : "Text updated."
      );
      this._paintOverlays();
    }

    _cancelInlineEdit() {
      if (!this.editingId) return;
      const id = this.editingId;
      const item = this._findItem(id);
      const snap = this._editSnapshot;
      this.editingId = null;
      this._editSnapshot = null;
      if (item && snap) {
        item.text = snap.text;
        item.edited = snap.edited;
        item.deleted = snap.deleted;
        item.color = snap.color;
        item.fontSize = snap.fontSize;
        item.fontFamily = snap.fontFamily;
      }
      this._paintOverlays();
      this._setStatus("Edit cancelled.");
    }

    _onLayerClick(e) {
      if (this.editingId) return;
      const rect = this.layer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = e.target.closest(".editor-overlay");

      if (this.mode === "select") {
        this._selectItem(hit ? hit.dataset.id : null);
        return;
      }

      if (hit) {
        this._selectItem(hit.dataset.id);
        return;
      }

      if (this.mode === "text") {
        const text = window.prompt("Text to add:", "DevStrand");
        if (!text) return;
        const fontSize = Number(this.fontSizeInput?.value || 18);
        const color = normalizeHex(this.colorInput?.value || "#111111");
        const fontFamily = this.fontFamilyInput?.value || "Helvetica";
        const id = uid();
        this._pushHistory();
        this._pageOverlays().push({
          id,
          type: "text",
          x,
          y,
          text,
          fontSize,
          color,
          fontFamily,
        });
        this.mode = "select";
        this.selectedStampId = null;
        this._setStampsPanelVisible(false);
        this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-editor-mode") === "select");
        });
        this._selectItem(id);
        this._setStatus("Text added. Change Font/Size/Color in the toolbar, or double-click to edit.");
        return;
      }

      if (this.mode === "image") {
        if (!this.pendingImage) {
          this._setStatus("Pick a stamp or click Upload image first.", true);
          return;
        }
        const maxW = Math.min(160, this.canvas.width * 0.35);
        const natW = this.pendingImage.naturalW || 0;
        const natH = this.pendingImage.naturalH || 0;
        const aspect = natW && natH ? natH / natW : 1;
        this._pushHistory();
        const placed = {
          id: uid(),
          type: "image",
          x,
          y,
          w: maxW,
          h: maxW * aspect,
          imageUrl: this.pendingImage.url,
          imageBytes: this.pendingImage.bytes,
          imageType: this.pendingImage.type || "image/png",
          naturalW: natW || maxW,
          naturalH: natH || maxW * aspect,
        };
        this._pageOverlays().push(placed);
        if (!natW || !natH) {
          const img = new Image();
          img.onload = () => {
            placed.naturalW = img.width;
            placed.naturalH = img.height;
            placed.h = placed.w * (img.height / img.width);
            this._syncImageSizeToolbar(placed);
            this._paintOverlays();
          };
          img.src = this.pendingImage.url;
        }
        this.pendingImage = null;
        this.selectedStampId = null;
        this.mode = "select";
        this._setStampsPanelVisible(false);
        this.root.querySelectorAll("[data-editor-mode]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-editor-mode") === "select");
        });
        this.root.querySelectorAll("[data-editor-stamp]").forEach((b) => b.classList.remove("active"));
        this._selectItem(placed.id);
        this._setStatus("Image added. Drag corners to resize, Crop image to trim, Ctrl+Z to undo.");
      }
    }

    _onPointerDown(e) {
      if (this.editingId || this.cropSession) return;
      const resizeHandle = e.target.closest("[data-resize]");
      const hit = e.target.closest(".editor-overlay");
      if (!hit || this.mode !== "select") return;
      e.preventDefault();
      this._selectItem(hit.dataset.id);
      const ov = this._findItem(this.selectedId);
      if (!ov) return;
      this._dragHistoryPushed = false;
      if (resizeHandle && ov.type === "image") {
        this.drag = {
          kind: "resize",
          corner: resizeHandle.getAttribute("data-resize"),
          id: ov.id,
          startX: e.clientX,
          startY: e.clientY,
          origX: ov.x,
          origY: ov.y,
          origW: ov.w,
          origH: ov.h,
        };
      } else {
        this.drag = {
          kind: "move",
          id: ov.id,
          startX: e.clientX,
          startY: e.clientY,
          origX: ov.x,
          origY: ov.y,
        };
      }
      hit.setPointerCapture?.(e.pointerId);
    }

    _onPointerMove(e) {
      if (!this.drag || this.editingId) return;
      const ov = this._findItem(this.drag.id);
      if (!ov) return;
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      if (!this._dragHistoryPushed && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        this._pushHistory();
        this._dragHistoryPushed = true;
      }

      if (this.drag.kind === "resize" && ov.type === "image") {
        const minSize = 16;
        const keepAspect = !e.shiftKey;
        const aspect = this.drag.origH / Math.max(1, this.drag.origW);
        const corner = this.drag.corner;
        let x = this.drag.origX;
        let y = this.drag.origY;
        let w = this.drag.origW;
        let h = this.drag.origH;

        if (corner === "se") {
          w = this.drag.origW + dx;
          h = keepAspect ? w * aspect : this.drag.origH + dy;
        } else if (corner === "sw") {
          w = this.drag.origW - dx;
          h = keepAspect ? w * aspect : this.drag.origH + dy;
          x = this.drag.origX + this.drag.origW - w;
        } else if (corner === "ne") {
          w = this.drag.origW + dx;
          h = keepAspect ? w * aspect : this.drag.origH - dy;
          y = this.drag.origY + this.drag.origH - h;
        } else if (corner === "nw") {
          w = this.drag.origW - dx;
          h = keepAspect ? w * aspect : this.drag.origH - dy;
          x = this.drag.origX + this.drag.origW - w;
          y = this.drag.origY + this.drag.origH - h;
        }

        if (w < minSize) {
          w = minSize;
          if (corner.includes("w")) x = this.drag.origX + this.drag.origW - minSize;
          if (keepAspect) {
            h = w * aspect;
            if (corner.includes("n")) y = this.drag.origY + this.drag.origH - h;
          }
        }
        if (h < minSize) {
          h = minSize;
          if (corner.includes("n")) y = this.drag.origY + this.drag.origH - minSize;
          if (keepAspect) {
            w = h / aspect;
            if (corner.includes("w")) x = this.drag.origX + this.drag.origW - w;
          }
        }

        ov.x = Math.max(0, x);
        ov.y = Math.max(0, y);
        ov.w = w;
        ov.h = h;
        if (this.imageWidthInput) this.imageWidthInput.value = String(Math.round(ov.w));
        this._paintOverlays();
        return;
      }

      ov.x = Math.max(0, this.drag.origX + dx);
      ov.y = Math.max(0, this.drag.origY + dy);
      if (ov.type === "native") {
        ov.edited = true;
        ov.moved = true;
      }
      this._paintOverlays();
    }

    _onPointerUp() {
      this.drag = null;
      this._dragHistoryPushed = false;
    }

    deleteSelected() {
      this._commitInlineEdit();
      if (!this.selectedId) {
        this._setStatus("Select an item first.", true);
        return;
      }
      const item = this._findItem(this.selectedId);
      if (!item) return;

      this._pushHistory();
      if (item.type === "native") {
        item.text = "";
        item.edited = true;
        item.deleted = true;
        this.selectedId = null;
        this._paintOverlays();
        this._setStatus("Existing text marked for removal (covered on export).");
        return;
      }

      this.overlays[this.pageIndex] = this._pageOverlays().filter((o) => o.id !== this.selectedId);
      this.selectedId = null;
      this._syncImageSizeToolbar(null);
      this._paintOverlays();
      this._setStatus("Item removed.");
    }

    clearPage() {
      this._commitInlineEdit();
      this._pushHistory();
      this.overlays[this.pageIndex] = [];
      this.pageText[this.pageIndex] = undefined;
      this.selectedId = null;
      this._syncImageSizeToolbar(null);
      this._extractNativeText(this.pageIndex).then(() => {
        this._paintOverlays();
        this._setStatus("Cleared added overlays and reset text edits on this page.");
      });
    }

    _bindCropUi() {
      this.root.querySelector("[data-editor-crop-cancel]")?.addEventListener("click", () => this.closeCropModal());
      this.root.querySelector("[data-editor-crop-apply]")?.addEventListener("click", () => this.applyCrop());
      this.cropModal?.addEventListener("click", (e) => {
        if (e.target === this.cropModal) this.closeCropModal();
      });

      const onDown = (e) => {
        if (!this.cropSession || !this.cropBox) return;
        const handle = e.target.closest("[data-crop-handle]");
        const onBox = e.target.closest("[data-editor-crop-box]");
        if (!handle && !onBox) return;
        e.preventDefault();
        const rect = this.cropBox.getBoundingClientRect();
        this.cropSession.drag = {
          kind: handle ? "resize" : "move",
          corner: handle?.getAttribute("data-crop-handle") || null,
          startX: e.clientX,
          startY: e.clientY,
          orig: { ...this.cropSession.box },
          boxW: rect.width,
          boxH: rect.height,
        };
      };
      const onMove = (e) => {
        const session = this.cropSession;
        if (!session?.drag) return;
        const img = this.cropImg;
        if (!img) return;
        const dispW = img.clientWidth;
        const dispH = img.clientHeight;
        if (!dispW || !dispH) return;
        const scaleX = session.naturalW / dispW;
        const scaleY = session.naturalH / dispH;
        const dx = (e.clientX - session.drag.startX) * scaleX;
        const dy = (e.clientY - session.drag.startY) * scaleY;
        let { x, y, w, h } = session.drag.orig;
        const min = 8;

        if (session.drag.kind === "move") {
          x = Math.max(0, Math.min(session.naturalW - w, x + dx));
          y = Math.max(0, Math.min(session.naturalH - h, y + dy));
        } else {
          const c = session.drag.corner;
          if (c.includes("e")) w = session.drag.orig.w + dx;
          if (c.includes("s")) h = session.drag.orig.h + dy;
          if (c.includes("w")) {
            w = session.drag.orig.w - dx;
            x = session.drag.orig.x + dx;
          }
          if (c.includes("n")) {
            h = session.drag.orig.h - dy;
            y = session.drag.orig.y + dy;
          }
          if (w < min) {
            if (c.includes("w")) x = session.drag.orig.x + session.drag.orig.w - min;
            w = min;
          }
          if (h < min) {
            if (c.includes("n")) y = session.drag.orig.y + session.drag.orig.h - min;
            h = min;
          }
          if (x < 0) {
            w += x;
            x = 0;
          }
          if (y < 0) {
            h += y;
            y = 0;
          }
          if (x + w > session.naturalW) w = session.naturalW - x;
          if (y + h > session.naturalH) h = session.naturalH - y;
        }
        session.box = { x, y, w, h };
        this._paintCropBox();
      };
      const onUp = () => {
        if (this.cropSession) this.cropSession.drag = null;
      };
      this.cropStage?.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    _paintCropBox() {
      if (!this.cropSession || !this.cropBox || !this.cropImg) return;
      const { box, naturalW, naturalH } = this.cropSession;
      const dispW = this.cropImg.clientWidth;
      const dispH = this.cropImg.clientHeight;
      if (!dispW || !dispH) return;
      const sx = dispW / naturalW;
      const sy = dispH / naturalH;
      this.cropBox.style.left = `${box.x * sx}px`;
      this.cropBox.style.top = `${box.y * sy}px`;
      this.cropBox.style.width = `${box.w * sx}px`;
      this.cropBox.style.height = `${box.h * sy}px`;
    }

    async openCropSelected() {
      const item = this._findItem(this.selectedId);
      if (!item || item.type !== "image") {
        this._setStatus("Select an image first, then click Crop image.", true);
        return;
      }
      try {
        const img = await loadHtmlImage(item.imageUrl);
        const naturalW = img.naturalWidth || item.naturalW || Math.round(item.w);
        const naturalH = img.naturalHeight || item.naturalH || Math.round(item.h);
        this.cropSession = {
          id: item.id,
          naturalW,
          naturalH,
          box: {
            x: Math.round(naturalW * 0.1),
            y: Math.round(naturalH * 0.1),
            w: Math.round(naturalW * 0.8),
            h: Math.round(naturalH * 0.8),
          },
          drag: null,
        };
        if (this.cropImg) {
          this.cropImg.onload = () => this._paintCropBox();
          this.cropImg.src = item.imageUrl;
        }
        if (this.cropModal) this.cropModal.hidden = false;
        requestAnimationFrame(() => this._paintCropBox());
        this._setStatus("Adjust the crop box, then Apply crop.");
      } catch (err) {
        this._setStatus(err.message || String(err), true);
      }
    }

    closeCropModal() {
      this.cropSession = null;
      if (this.cropModal) this.cropModal.hidden = true;
      if (this.cropImg) this.cropImg.removeAttribute("src");
    }

    async applyCrop() {
      const session = this.cropSession;
      if (!session) return;
      const item = this._findItem(session.id);
      if (!item || item.type !== "image") {
        this.closeCropModal();
        return;
      }
      try {
        const src = await loadHtmlImage(item.imageUrl);
        const { x, y, w, h } = session.box;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w));
        canvas.height = Math.max(1, Math.round(h));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(src, x, y, w, h, 0, 0, canvas.width, canvas.height);
        const payload = await canvasToPngPayload(canvas, "cropped.png");
        this._pushHistory();
        const prevW = item.w;
        item.imageUrl = payload.url;
        item.imageBytes = payload.bytes;
        item.imageType = "image/png";
        item.naturalW = payload.naturalW;
        item.naturalH = payload.naturalH;
        item.w = prevW;
        item.h = prevW * (payload.naturalH / Math.max(1, payload.naturalW));
        this.closeCropModal();
        this._syncImageSizeToolbar(item);
        this._paintOverlays();
        this._setStatus("Image cropped. Ctrl+Z to undo.");
      } catch (err) {
        this._setStatus(err.message || String(err), true);
      }
    }

    async exportPdfFile(filename = "edited.pdf") {
      this._commitInlineEdit();
      if (!global.PDFLib) throw new Error("pdf-lib not loaded yet.");
      if (!this.pdfBytes) throw new Error("No PDF loaded.");
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const doc = await PDFDocument.load(this.pdfBytes.slice(0));
      if (global.fontkit) doc.registerFontkit(global.fontkit);
      const fontCache = {};

      const embedFont = async (key) => {
        if (fontCache[key]) return fontCache[key];
        const def = getFontDef(key);
        try {
          if (def.file) {
            if (!global.fontkit) throw new Error("fontkit missing");
            const bytes = await loadFontFileBytes(def.file);
            fontCache[key] = await doc.embedFont(bytes, { subset: true });
          } else {
            const std = def.standard && StandardFonts[def.standard] ? def.standard : "Helvetica";
            fontCache[key] = await doc.embedFont(StandardFonts[std]);
          }
        } catch (_) {
          fontCache[key] = await doc.embedFont(StandardFonts.Helvetica);
        }
        return fontCache[key];
      };

      for (let i = 0; i < this.pageCount; i++) {
        const page = doc.getPage(i);
        const { width: pw, height: ph } = page.getSize();
        const pdfPage = await this.pdfDoc.getPage(i + 1);
        const vp = pdfPage.getViewport({ scale: this.scale });
        const sx = pw / vp.width;
        const sy = ph / vp.height;

        if (!this.pageText[i]) await this._extractNativeText(i);

        for (const ov of this.pageText[i] || []) {
          if (!ov.edited) continue;
          const coverW = Math.max(
            ov.coverW || ov.w || 0,
            (ov.originalText || "").length * (ov.fontSize || 12) * 0.55
          );
          const coverH = Math.max(ov.coverH || ov.h || ov.fontSize || 12, (ov.fontSize || 12) * 1.1);
          page.drawRectangle({
            x: Math.max(0, (ov.coverX ?? ov.x) * sx - 1),
            y: Math.max(0, ph - ((ov.coverY ?? ov.y) + coverH) * sy - 1),
            width: coverW * sx + 2,
            height: coverH * sy + 2,
            color: rgb(1, 1, 1),
            borderWidth: 0,
          });
          if (ov.deleted || !(ov.text || "").trim()) continue;
          const font = await embedFont(ov.fontFamily);
          const size = ov.fontSize * sx;
          const { r, g, b } = hexToRgb01(ov.color);
          page.drawText(ov.text || "", {
            x: Math.max(0, ov.x * sx),
            y: Math.max(0, ph - ov.y * sy - size),
            size,
            font,
            color: rgb(r, g, b),
          });
        }

        for (const ov of this.overlays[i] || []) {
          if (ov.type === "text") {
            const font = await embedFont(ov.fontFamily);
            const size = ov.fontSize * sx;
            const { r, g, b } = hexToRgb01(ov.color);
            page.drawText(ov.text || "", {
              x: Math.max(0, ov.x * sx),
              y: Math.max(0, ph - ov.y * sy - size),
              size,
              font,
              color: rgb(r, g, b),
            });
          } else if (ov.type === "image" && ov.imageBytes) {
            let embedded;
            const t = (ov.imageType || "").toLowerCase();
            if (t.includes("png")) embedded = await doc.embedPng(ov.imageBytes);
            else embedded = await doc.embedJpg(ov.imageBytes);
            const w = ov.w * sx;
            const h = ov.h * sy;
            page.drawImage(embedded, {
              x: Math.max(0, ov.x * sx),
              y: Math.max(0, ph - ov.y * sy - h),
              width: w,
              height: h,
            });
          }
        }
      }

      const bytes = await doc.save();
      return new File([bytes], filename, { type: "application/pdf" });
    }

    _setStatus(msg, isError) {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      this.statusEl.classList.toggle("error", !!isError);
    }
  }

  global.InteractivePdfEditor = InteractivePdfEditor;
})(window);
