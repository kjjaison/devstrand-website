const TOOLS = [
  {
    id: "merge",
    title: "Merge PDF",
    desc: "Combine multiple PDFs into one file.",
    keywords: "merge combine join unite concatenate pdf",
    accept: ".pdf,application/pdf",
    multiple: true,
    endpoint: "/api/merge",
    hint: "Select 2 or more PDF files, then drag to set merge order.",
    reorder: "files",
  },
  {
    id: "split",
    title: "Split PDF",
    desc: "Split into pages or custom ranges.",
    keywords: "split extract pages ranges separate",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/split",
    hint: "One PDF. Drag pages to reorder before split (optional).",
    reorder: "pages",
    fields: [
      {
        name: "mode",
        label: "Mode",
        type: "select",
        options: [
          { value: "pages", label: "One file per page" },
          { value: "ranges", label: "Custom ranges" },
        ],
      },
      { name: "ranges", label: "Ranges (if custom)", type: "text", placeholder: "1-3,5,7-9" },
    ],
  },
  {
    id: "compress",
    title: "Compress PDF",
    desc: "Reduce PDF size with low → maximum compression levels.",
    keywords: "compress reduce shrink size optimize smaller",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/compress",
    hint: "One PDF — up to 100 MB. Pick a compression level, then Run.",
    reorder: "pages",
    fields: [
      {
        name: "level",
        label: "Compression level",
        type: "select",
        options: [
          { value: "low", label: "Low — best quality, lightest shrink" },
          { value: "medium", label: "Medium — balanced (default)" },
          { value: "high", label: "High — smaller file" },
          { value: "maximum", label: "Maximum — smallest file" },
        ],
      },
    ],
  },
  {
    id: "edit",
    title: "Edit PDF",
    desc: "Interactive editor — add or remove text and images on pages.",
    keywords: "edit text image annotate modify change",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/edit",
    hint: "Upload a PDF, then edit on the large canvas — zoom, add/remove pages, text, and images.",
    reorder: false,
    interactiveEdit: true,
  },
  {
    id: "ocr",
    title: "OCR PDF",
    desc: "Make scanned PDFs searchable with optical character recognition.",
    keywords: "ocr scan searchable text recognition tesseract",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/ocr",
    hint: "Upload a scanned or image-based PDF. OCR may take a minute on large files.",
    reorder: "pages",
    fields: [
      {
        name: "language",
        label: "OCR language",
        type: "select",
        options: [
          { value: "eng", label: "English" },
          { value: "eng+osd", label: "English + orientation detection" },
        ],
      },
    ],
  },
  {
    id: "esign",
    title: "E-sign PDF",
    desc: "Type, draw, or upload a signature and stamp it onto your PDF.",
    keywords: "esign e-sign sign signature typed name draw stamp",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/esign",
    hint: "Type your name to pick a generated signature style, or draw / upload one. Then choose pages and position.",
    reorder: "pages",
    signaturePad: true,
    fields: [
      {
        name: "pages",
        label: "Pages",
        type: "text",
        value: "all",
        placeholder: "all or 1,3,5-7",
      },
      {
        name: "position",
        label: "Position",
        type: "select",
        options: [
          { value: "bottom-right", label: "Bottom right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-center", label: "Bottom center" },
          { value: "center", label: "Center" },
        ],
      },
      { name: "signer_name", label: "Signer name (optional)", type: "text", value: "", placeholder: "Jane Doe" },
      { name: "sig_width", label: "Signature width (pt)", type: "text", value: "160" },
    ],
  },
  {
    id: "watermark",
    title: "Watermark PDF",
    desc: "Stamp diagonal text across every page.",
    keywords: "watermark stamp confidential draft brand",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/watermark",
    reorder: "pages",
    fields: [
      { name: "text", label: "Watermark text", type: "text", value: "DEVSTRAND" },
      { name: "opacity", label: "Opacity (0.1–0.6)", type: "text", value: "0.25" },
    ],
  },
  {
    id: "pdf-to-word",
    title: "PDF to Word",
    desc: "Convert PDF to DOCX (best-effort layout).",
    keywords: "pdf word docx convert export",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-word",
    reorder: "pages",
  },
  {
    id: "word-to-pdf",
    title: "Word to PDF",
    desc: "Convert DOC/DOCX to PDF via LibreOffice.",
    keywords: "word doc docx to pdf convert",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    multiple: false,
    endpoint: "/api/word-to-pdf",
    reorder: false,
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel",
    desc: "Extract tables/text into an XLSX workbook.",
    keywords: "pdf excel xlsx spreadsheet tables extract",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-excel",
    reorder: "pages",
  },
  {
    id: "excel-to-pdf",
    title: "Excel to PDF",
    desc: "Convert spreadsheets to PDF.",
    keywords: "excel xls xlsx csv to pdf convert",
    accept: ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    multiple: false,
    endpoint: "/api/excel-to-pdf",
    reorder: false,
  },
  {
    id: "pdf-to-ppt",
    title: "PDF to PowerPoint",
    desc: "Each page becomes a slide image.",
    keywords: "pdf powerpoint pptx slides convert",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-powerpoint",
    reorder: "pages",
  },
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    desc: "Render pages to JPG images (ZIP).",
    keywords: "pdf jpg jpeg image export render",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-jpg",
    reorder: "pages",
    fields: [{ name: "dpi", label: "DPI (72–200)", type: "text", value: "150" }],
  },
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF",
    desc: "Build a PDF from one or more images.",
    keywords: "jpg jpeg png webp image to pdf photos",
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    multiple: true,
    endpoint: "/api/jpg-to-pdf",
    hint: "Select multiple images, then drag thumbnails to set page order.",
    reorder: "files",
  },
];

const grid = document.getElementById("tools");
const workspace = document.getElementById("workspace");
const form = document.getElementById("toolForm");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const options = document.getElementById("options");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("runBtn");
const fileHint = document.getElementById("fileHint");
const sortPanel = document.getElementById("sortPanel");
const sortGallery = document.getElementById("sortGallery");
const sortHint = document.getElementById("sortHint");
const sortCanvas = document.getElementById("sortCanvas");
const sortImagePreview = document.getElementById("sortImagePreview");
const sortEmpty = document.getElementById("sortEmpty");
const sortStageWrap = document.getElementById("sortStageWrap");
const sortZoomLabel = document.getElementById("sortZoomLabel");
const pdfEditorRoot = document.getElementById("pdfEditor");
const emailPanel = document.getElementById("emailPanel");
const emailTo = document.getElementById("emailTo");
const emailBtn = document.getElementById("emailBtn");
const emailStatus = document.getElementById("emailStatus");
const emailHint = document.getElementById("emailHint");
const deliveryPanel = document.getElementById("deliveryPanel");
const shareBtn = document.getElementById("shareBtn");
const shareTtl = document.getElementById("shareTtl");
const shareStatus = document.getElementById("shareStatus");
const shareResult = document.getElementById("shareResult");
const shareUrl = document.getElementById("shareUrl");
const shareCopyBtn = document.getElementById("shareCopyBtn");

let active = null;
/** @type {{ id: string, kind: 'file'|'page', file?: File, pageIndex?: number, label: string, previewUrl?: string, pdfBytes?: ArrayBuffer }[]} */
let queue = [];
let sourcePdfBytes = null;
let dragId = null;
let previewToken = 0;
let pdfEditor = null;
let selectedQueueId = null;
let sortScale = 1.4;
let sortPreviewToken = 0;
/** @type {{ blob: Blob, name: string } | null} */
let lastResult = null;
let emailEnabled = false;
let emailMaxMb = 20;
let shareMaxMb = 50;
/** @type {HTMLCanvasElement | null} */
let sigCanvas = null;
let sigDrawing = false;
/** @type {File | null} */
let sigUploadFile = null;
/** @type {'draw' | 'type' | 'upload'} */
let sigMode = "type";
/** @type {HTMLCanvasElement | null} */
let sigTypedSelected = null;
/** @type {HTMLElement | null} */
let sigPadRoot = null;

const SIG_TYPE_STYLES = [
  { id: "dancing", label: "Script", font: '"Dancing Script", cursive', size: 64, color: "#111111" },
  { id: "vibes", label: "Elegant", font: '"Great Vibes", cursive', size: 68, color: "#111111" },
  { id: "allura", label: "Flourish", font: "Allura, cursive", size: 72, color: "#1a1a1a" },
  { id: "satisfy", label: "Casual", font: "Satisfy, cursive", size: 60, color: "#111111" },
  { id: "sacramento", label: "Light", font: "Sacramento, cursive", size: 70, color: "#222222" },
  { id: "pacifico", label: "Bold", font: "Pacifico, cursive", size: 52, color: "#111111" },
  { id: "homemade", label: "Hand", font: '"Homemade Apple", cursive', size: 42, color: "#1a1a1a" },
  { id: "caveat", label: "Marker", font: "Caveat, cursive", size: 64, color: "#111111" },
];

function getPdfEditor() {
  if (!pdfEditor && window.InteractivePdfEditor && pdfEditorRoot) {
    pdfEditor = new InteractivePdfEditor(pdfEditorRoot);
  }
  return pdfEditor;
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

fetch("/api/health")
  .then((r) => r.json())
  .then((data) => {
    emailEnabled = Boolean(data.email_enabled);
    emailMaxMb = Number(data.email_max_mb) || 20;
    shareMaxMb = Number(data.share_max_mb) || 50;
    if (emailHint && emailEnabled) {
      emailHint.textContent = `Download still starts as usual. Optionally email a copy (max ${emailMaxMb} MB for email).`;
    }
    syncEmailControls();
  })
  .catch(() => {
    emailEnabled = false;
    syncEmailControls();
  });

function syncEmailControls() {
  if (emailPanel) emailPanel.hidden = !emailEnabled;
  if (!emailBtn) return;
  const hasResult = Boolean(lastResult?.blob);
  emailBtn.disabled = !emailEnabled || !hasResult;
  if (!emailEnabled) {
    emailBtn.title = "";
  } else if (!hasResult) {
    emailBtn.title = "Run a tool first to create a file";
  } else {
    emailBtn.title = "";
  }
  if (shareBtn) shareBtn.disabled = !hasResult;
}

function showDeliveryPanel(blob, name) {
  lastResult = { blob, name };
  if (deliveryPanel) deliveryPanel.hidden = false;
  if (emailStatus) {
    emailStatus.textContent = "";
    emailStatus.className = "status";
  }
  if (shareStatus) {
    shareStatus.textContent = "";
    shareStatus.className = "status";
  }
  if (shareResult) shareResult.hidden = true;
  if (shareUrl) shareUrl.value = "";
  syncEmailControls();
}

function hideDeliveryPanel() {
  lastResult = null;
  if (deliveryPanel) deliveryPanel.hidden = true;
  if (emailStatus) {
    emailStatus.textContent = "";
    emailStatus.className = "status";
  }
  if (shareStatus) {
    shareStatus.textContent = "";
    shareStatus.className = "status";
  }
  if (shareResult) shareResult.hidden = true;
  syncEmailControls();
}

function setEmailStatus(text, isError) {
  if (!emailStatus) return;
  emailStatus.textContent = text;
  emailStatus.className = "status" + (isError ? " error" : text ? " ok" : "");
}

function setShareStatus(text, isError) {
  if (!shareStatus) return;
  shareStatus.textContent = text;
  shareStatus.className = "status" + (isError ? " error" : text ? " ok" : "");
}

async function sendResultEmail() {
  if (!lastResult?.blob) {
    setEmailStatus("Run a tool first, then email the result.", true);
    return;
  }
  if (!emailEnabled) {
    setEmailStatus("Email is not configured on this server.", true);
    return;
  }
  const to = (emailTo?.value || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    setEmailStatus("Enter a valid email address.", true);
    return;
  }
  if (lastResult.blob.size > emailMaxMb * 1024 * 1024) {
    setEmailStatus(`File is over ${emailMaxMb} MB — email providers usually reject it. Use a share link instead.`, true);
    return;
  }

  emailBtn.disabled = true;
  setEmailStatus("Sending…");
  try {
    const fd = new FormData();
    fd.append("file", lastResult.blob, lastResult.name);
    fd.append("to_email", to);
    fd.append("tool_name", active?.title || "DevStrand Tools");
    const res = await fetch("/api/email-result", { method: "POST", body: fd });
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const data = await res.json();
        msg = data.detail || msg;
        if (Array.isArray(msg)) msg = msg.map((m) => m.msg || JSON.stringify(m)).join("; ");
      } catch (_) {
        msg = await res.text();
      }
      throw new Error(msg || "Email failed");
    }
    setEmailStatus(`Sent to ${to}.`, false);
  } catch (err) {
    setEmailStatus(err.message || String(err), true);
  } finally {
    syncEmailControls();
  }
}

async function createShareLink() {
  if (!lastResult?.blob) {
    setShareStatus("Run a tool first, then create a link.", true);
    return;
  }
  if (lastResult.blob.size > shareMaxMb * 1024 * 1024) {
    setShareStatus(`File is over ${shareMaxMb} MB — too large to share. Download instead.`, true);
    return;
  }
  const minutes = Number(shareTtl?.value || 60);
  shareBtn.disabled = true;
  setShareStatus("Creating link…");
  try {
    const fd = new FormData();
    fd.append("file", lastResult.blob, lastResult.name);
    fd.append("expires_minutes", String(minutes));
    const res = await fetch("/api/share", { method: "POST", body: fd });
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const data = await res.json();
        msg = data.detail || msg;
        if (Array.isArray(msg)) msg = msg.map((m) => m.msg || JSON.stringify(m)).join("; ");
      } catch (_) {
        msg = await res.text();
      }
      throw new Error(msg || "Share failed");
    }
    const data = await res.json();
    const absolute = new URL(data.url, window.location.origin).href;
    if (shareUrl) shareUrl.value = absolute;
    if (shareResult) shareResult.hidden = false;
    setShareStatus(`Link ready — expires in ${data.expires_minutes} minutes. File deleted after that.`, false);
  } catch (err) {
    setShareStatus(err.message || String(err), true);
  } finally {
    syncEmailControls();
  }
}

if (emailBtn) emailBtn.addEventListener("click", () => sendResultEmail());
if (shareBtn) shareBtn.addEventListener("click", () => createShareLink());
if (shareCopyBtn) {
  shareCopyBtn.addEventListener("click", async () => {
    const value = shareUrl?.value || "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setShareStatus("Link copied.", false);
    } catch (_) {
      shareUrl.select();
      setShareStatus("Select the link and copy it manually.", true);
    }
  });
}
if (emailTo) {
  emailTo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendResultEmail();
    }
  });
}

function clearSignaturePad() {
  sigUploadFile = null;
  sigTypedSelected = null;
  if (sigPadRoot) {
    sigPadRoot.querySelectorAll("[data-sig-style].selected").forEach((el) => el.classList.remove("selected"));
  }
  if (!sigCanvas) return;
  const ctx = sigCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function setSigMode(mode) {
  sigMode = mode;
  if (!sigPadRoot) return;
  sigPadRoot.querySelectorAll("[data-sig-mode-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-sig-mode-btn") === mode);
  });
  sigPadRoot.querySelectorAll("[data-sig-pane]").forEach((pane) => {
    pane.hidden = pane.getAttribute("data-sig-pane") !== mode;
  });
  if (mode !== "upload") sigUploadFile = null;
  if (mode !== "type") sigTypedSelected = null;
}

function renderTypedSignatures(name) {
  const grid = sigPadRoot?.querySelector("[data-sig-style-grid]");
  if (!grid) return;
  const text = (name || "").trim();
  grid.innerHTML = "";
  sigTypedSelected = null;

  if (!text) {
    grid.innerHTML = `<p class="hint">Type your name above to generate signature styles.</p>`;
    return;
  }

  SIG_TYPE_STYLES.forEach((style, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sig-style";
    btn.dataset.sigStyle = style.id;
    btn.setAttribute("aria-label", `${style.label} signature style`);

    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = style.color;
    ctx.font = `600 ${style.size}px ${style.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Slight italic slant for a more natural signature look
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.transform(1, 0, -0.12, 1, 0, 0);
    let fontSize = style.size;
    ctx.font = `600 ${fontSize}px ${style.font}`;
    while (fontSize > 28 && ctx.measureText(text).width > canvas.width - 36) {
      fontSize -= 2;
      ctx.font = `600 ${fontSize}px ${style.font}`;
    }
    ctx.fillText(text, 0, 4);
    ctx.restore();

    const label = document.createElement("span");
    label.textContent = style.label;
    btn.appendChild(canvas);
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      grid.querySelectorAll(".sig-style.selected").forEach((el) => el.classList.remove("selected"));
      btn.classList.add("selected");
      sigTypedSelected = canvas;
      sigUploadFile = null;
      // Mirror into optional printed name under the stamp
      const signerInput = options.querySelector('input[name="signer_name"]');
      if (signerInput && !signerInput.value.trim()) signerInput.value = text;
    });

    grid.appendChild(btn);
    if (index === 0) {
      btn.classList.add("selected");
      sigTypedSelected = canvas;
    }
  });
}

async function ensureSigFonts() {
  if (!document.fonts?.load) return;
  await Promise.allSettled(
    SIG_TYPE_STYLES.map((s) => document.fonts.load(`600 48px ${s.font}`))
  );
}

function setupSignaturePad(root) {
  sigPadRoot = root;
  sigCanvas = root.querySelector("[data-sig-canvas]");
  const clearBtn = root.querySelector("[data-sig-clear]");
  const uploadInput = root.querySelector("[data-sig-upload]");
  const typeInput = root.querySelector("[data-sig-type-name]");
  const generateBtn = root.querySelector("[data-sig-generate]");

  root.querySelectorAll("[data-sig-mode-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setSigMode(btn.getAttribute("data-sig-mode-btn") || "type"));
  });

  if (sigCanvas) {
    const ctx = sigCanvas.getContext("2d");
    clearSignaturePad();

    const pos = (e) => {
      const rect = sigCanvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return {
        x: ((src.clientX - rect.left) / rect.width) * sigCanvas.width,
        y: ((src.clientY - rect.top) / rect.height) * sigCanvas.height,
      };
    };

    const start = (e) => {
      e.preventDefault();
      setSigMode("draw");
      sigUploadFile = null;
      sigTypedSelected = null;
      sigDrawing = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e) => {
      if (!sigDrawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = () => {
      sigDrawing = false;
    };

    sigCanvas.addEventListener("mousedown", start);
    sigCanvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    sigCanvas.addEventListener("touchstart", start, { passive: false });
    sigCanvas.addEventListener("touchmove", move, { passive: false });
    sigCanvas.addEventListener("touchend", end);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearSignaturePad();
      if (typeInput) renderTypedSignatures(typeInput.value);
    });
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files?.[0];
      if (!file) return;
      setSigMode("upload");
      sigUploadFile = file;
      sigTypedSelected = null;
      const preview = root.querySelector("[data-sig-upload-preview]");
      if (preview) {
        preview.hidden = false;
        preview.src = URL.createObjectURL(file);
      }
    });
  }

  const runGenerate = async () => {
    const name = (typeInput?.value || "").trim();
    if (!name) {
      renderTypedSignatures("");
      return;
    }
    setSigMode("type");
    await ensureSigFonts();
    renderTypedSignatures(name);
    const signerInput = options.querySelector('input[name="signer_name"]');
    if (signerInput && !signerInput.value.trim()) signerInput.value = name;
  };

  if (generateBtn) generateBtn.addEventListener("click", () => runGenerate());
  if (typeInput) {
    typeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runGenerate();
      }
    });
    // Debounced live preview while typing
    let timer = null;
    typeInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => runGenerate(), 350);
    });
  }

  setSigMode("type");
  ensureSigFonts().then(() => {
    if (typeInput?.value.trim()) renderTypedSignatures(typeInput.value);
    else renderTypedSignatures("");
  });
}

function canvasHasInk(canvas) {
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250) return true;
  }
  return false;
}

function signatureBlob() {
  return new Promise((resolve, reject) => {
    if (sigMode === "upload" && sigUploadFile) {
      resolve(sigUploadFile);
      return;
    }
    if (sigMode === "type") {
      if (!sigTypedSelected || !canvasHasInk(sigTypedSelected)) {
        reject(new Error("Type your name and select a signature style."));
        return;
      }
      sigTypedSelected.toBlob((blob) => {
        if (!blob) reject(new Error("Could not capture typed signature."));
        else resolve(new File([blob], "signature.png", { type: "image/png" }));
      }, "image/png");
      return;
    }
    if (!sigCanvas || !canvasHasInk(sigCanvas)) {
      reject(new Error("Draw, type, or upload a signature first."));
      return;
    }
    sigCanvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not capture signature."));
      else resolve(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  });
}

function ensurePdfJs() {
  if (!window.pdfjsLib) throw new Error("PDF preview library is still loading. Try again in a moment.");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
}

function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

function updateCompressSizeInfo(originalBytes, compressedBytes) {
  const el = document.getElementById("compressSizeInfo");
  if (!el) return;
  const current = el.querySelector("[data-size-current]");
  const result = el.querySelector("[data-size-result]");
  if (current) {
    current.textContent =
      originalBytes != null
        ? `Current size: ${formatBytes(originalBytes)}`
        : "Upload a PDF to see the current size.";
  }
  if (!result) return;
  if (compressedBytes == null || originalBytes == null) {
    result.hidden = true;
    result.textContent = "";
    return;
  }
  const saved = Math.max(0, originalBytes - compressedBytes);
  const pct = originalBytes > 0 ? Math.round((saved / originalBytes) * 100) : 0;
  result.hidden = false;
  if (compressedBytes >= originalBytes) {
    result.textContent = `After compress: ${formatBytes(compressedBytes)} (little or no further reduction at this level)`;
  } else {
    result.textContent = `After compress: ${formatBytes(compressedBytes)} — saved ${formatBytes(saved)} (${pct}% smaller)`;
  }
}

function queueOriginalBytes() {
  if (active?.id !== "compress") return null;
  if (sourcePdfBytes) return sourcePdfBytes.byteLength;
  const file = queue[0]?.file;
  return file ? file.size : null;
}

TOOLS.forEach((tool) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tool-card";
  btn.dataset.toolId = tool.id;
  btn.innerHTML = `<h3>${tool.title}</h3><p>${tool.desc}</p>`;
  btn.addEventListener("click", () => openTool(tool));
  grid.appendChild(btn);
});

function showAllTools() {
  workspace.hidden = true;
  active = null;
  clearQueue();
  form.reset();
  hideDeliveryPanel();
  statusEl.textContent = "";
  statusEl.className = "status";
  document.querySelectorAll(".tool-card.active").forEach((el) => el.classList.remove("active"));
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

const backBtn = document.getElementById("backBtn");
if (backBtn) backBtn.addEventListener("click", () => showAllTools());

/* ——— Hamburger dropdown ——— */
const menuToggle = document.getElementById("menuToggle");
const menuBackdrop = document.getElementById("menuBackdrop");
const menuDropdown = document.getElementById("menuDropdown");
const menuList = document.getElementById("menuList");
const menuToolList = document.getElementById("menuToolList");
let menuOpen = false;

function renderMenuTools() {
  if (!menuToolList) return;
  menuToolList.innerHTML = "";
  TOOLS.forEach((tool) => {
    const li = document.createElement("li");
    li.setAttribute("role", "none");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dropdown-item";
    btn.setAttribute("role", "menuitem");
    btn.dataset.toolId = tool.id;
    if (active?.id === tool.id) btn.classList.add("active");
    btn.textContent = tool.title;
    li.appendChild(btn);
    menuToolList.appendChild(li);
  });
}

function openToolsMenu() {
  if (!menuDropdown || !menuList) {
    console.warn("Menu elements missing", { menuDropdown, menuList });
    return;
  }
  menuOpen = true;
  menuDropdown.classList.add("is-open");
  menuList.setAttribute("aria-hidden", "false");
  if (menuBackdrop) menuBackdrop.classList.add("is-visible");
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");
  renderMenuTools();
}

function closeToolsMenu() {
  menuOpen = false;
  if (menuDropdown) menuDropdown.classList.remove("is-open");
  if (menuList) menuList.setAttribute("aria-hidden", "true");
  if (menuBackdrop) menuBackdrop.classList.remove("is-visible");
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

function toggleToolsMenu(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (menuOpen) closeToolsMenu();
  else openToolsMenu();
}

if (menuToggle) {
  menuToggle.addEventListener("click", toggleToolsMenu);
} else {
  console.warn("menuToggle not found");
}

if (menuBackdrop) {
  menuBackdrop.addEventListener("click", () => closeToolsMenu());
}

if (menuDropdown) {
  menuDropdown.addEventListener("click", (e) => {
    const home = e.target.closest('[data-menu-action="home"]');
    if (home) {
      e.preventDefault();
      closeToolsMenu();
      showAllTools();
      return;
    }
    const item = e.target.closest(".dropdown-item[data-tool-id]");
    if (item) {
      e.preventDefault();
      const tool = TOOLS.find((t) => t.id === item.dataset.toolId);
      closeToolsMenu();
      if (tool) openTool(tool);
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuOpen) closeToolsMenu();
});

function scrollToUpload() {
  const header = document.querySelector(".topbar");
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const target =
    pdfEditorRoot && !pdfEditorRoot.hidden
      ? pdfEditorRoot
      : sortPanel && !sortPanel.hidden
        ? sortPanel
        : dropZone;
  const y = window.scrollY + target.getBoundingClientRect().top - headerH - 16;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  window.setTimeout(() => {
    const y2 = window.scrollY + target.getBoundingClientRect().top - headerH - 16;
    window.scrollTo({ top: Math.max(0, y2), behavior: "smooth" });
  }, 120);
}

function clearQueue() {
  previewToken += 1;
  sortPreviewToken += 1;
  queue.forEach((item) => {
    if (item.previewUrl && item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
  });
  queue = [];
  sourcePdfBytes = null;
  selectedQueueId = null;
  sortGallery.innerHTML = "";
  sortPanel.hidden = true;
  clearSortStage();
  try {
    getPdfEditor()?.reset();
  } catch (_) {
    if (pdfEditorRoot) pdfEditorRoot.hidden = true;
  }
}

function openTool(tool) {
  active = tool;
  workspace.hidden = false;
  clearQueue();
  document.querySelectorAll(".tool-card.active").forEach((el) => el.classList.remove("active"));
  const activeCard = document.querySelector(`.tool-card[data-tool-id="${tool.id}"]`);
  if (activeCard) activeCard.classList.add("active");

  document.getElementById("wsTitle").textContent = tool.title;
  document.getElementById("wsDesc").textContent = tool.desc;
  fileHint.textContent = tool.hint || "Choose file(s) to continue.";
  const dropTitle = document.getElementById("dropTitle");
  if (dropTitle) {
    dropTitle.textContent = tool.multiple ? "Drop one or more files here" : "Drop a file here";
  }
  fileInput.accept = tool.accept;
  fileInput.multiple = !!tool.multiple;
  if (tool.multiple) fileInput.setAttribute("multiple", "multiple");
  else fileInput.removeAttribute("multiple");
  fileInput.value = "";
  statusEl.textContent = "";
  statusEl.className = "status";
  hideDeliveryPanel();
  options.innerHTML = "";
  if (tool.id === "compress") {
    const report = document.createElement("div");
    report.id = "compressSizeInfo";
    report.className = "size-report";
    report.innerHTML =
      "<strong>File size</strong><span data-size-current>Upload a PDF to see the current size.</span><span data-size-result hidden></span>";
    options.appendChild(report);
  }
  if (tool.signaturePad) {
    const pad = document.createElement("div");
    pad.className = "sig-pad";
    pad.innerHTML = `
      <strong>Signature</strong>
      <div class="sig-mode-tabs" role="tablist" aria-label="Signature method">
        <button type="button" class="editor-btn active" data-sig-mode-btn="type">Type name</button>
        <button type="button" class="editor-btn" data-sig-mode-btn="draw">Draw</button>
        <button type="button" class="editor-btn" data-sig-mode-btn="upload">Upload</button>
      </div>

      <div data-sig-pane="type">
        <p class="hint">Type your name — we’ll generate several signature styles. Click one to select it.</p>
        <div class="sig-type-row">
          <label class="sr-only" for="sigTypeName">Name to sign</label>
          <input type="text" id="sigTypeName" data-sig-type-name placeholder="Jane Doe" autocomplete="name" maxlength="60" />
          <button type="button" class="editor-btn" data-sig-generate>Generate</button>
        </div>
        <div class="sig-style-grid" data-sig-style-grid></div>
      </div>

      <div data-sig-pane="draw" hidden>
        <p class="hint">Draw with your mouse or finger.</p>
        <canvas data-sig-canvas width="560" height="180" aria-label="Signature pad"></canvas>
        <div class="sig-actions">
          <button type="button" class="editor-btn" data-sig-clear>Clear</button>
        </div>
      </div>

      <div data-sig-pane="upload" hidden>
        <p class="hint">Upload a PNG or JPG of your signature (transparent background works best).</p>
        <div class="sig-actions">
          <label class="editor-btn sig-upload-label">Choose image
            <input type="file" data-sig-upload accept="image/png,image/jpeg,image/jpg,image/webp" hidden />
          </label>
        </div>
        <img data-sig-upload-preview class="sig-upload-preview" alt="Uploaded signature preview" hidden />
      </div>`;
    options.appendChild(pad);
    setupSignaturePad(pad);
  }
  (tool.fields || []).forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      input.name = field.name;
      field.options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (field.name === "level" && opt.value === "medium") o.selected = true;
        if (field.name === "position" && opt.value === "bottom-right") o.selected = true;
        if (field.name === "language" && opt.value === "eng") o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.name = field.name;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.value != null) input.value = field.value;
    }
    label.appendChild(input);
    options.appendChild(label);
  });

  requestAnimationFrame(() => requestAnimationFrame(scrollToUpload));
}

fileInput.addEventListener("change", () => {
  ingestFiles([...fileInput.files], { append: !!active?.multiple });
});

["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag");
  });
});
["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag");
  });
});
dropZone.addEventListener("drop", (e) => {
  const files = [...(e.dataTransfer.files || [])];
  if (!files.length) return;
  ingestFiles(files, { append: !!active?.multiple });
});

async function ingestFiles(files, { append }) {
  if (!active || !files.length) return;
  const limitMb = active.maxMb || 100;
  const limitBytes = limitMb * 1024 * 1024;
  for (const f of files) {
    if (f.size > limitBytes) {
      setStatus(`“${f.name}” is too large. Max ${limitMb} MB.`, true);
      return;
    }
  }

  setStatus("Building previews…");
  try {
    if (!append) clearQueue();

    if (active.interactiveEdit) {
      const file = files[0];
      queue = [{ id: "edit-src", kind: "file", file, label: file.name }];
      const editor = getPdfEditor();
      if (!editor) throw new Error("Editor is still loading. Try again in a moment.");
      await editor.load(await file.arrayBuffer());
      sortPanel.hidden = true;
      setStatus("Editor ready — add text or images, then click Run to download.", false);
      requestAnimationFrame(scrollToUpload);
      return;
    }

    if (active.reorder === "pages") {
      await buildPageQueue(files[0]);
    } else if (active.reorder === "files") {
      const start = append ? queue.length : 0;
      const incoming = append ? files : files;
      for (let i = 0; i < incoming.length; i++) {
        const file = incoming[i];
        const item = {
          id: `${Date.now()}-${start + i}-${Math.random().toString(16).slice(2)}`,
          kind: "file",
          file,
          label: file.name,
        };
        if (file.type.startsWith("image/")) {
          item.previewUrl = URL.createObjectURL(file);
        } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          item.pdfBytes = await file.arrayBuffer();
          item.previewUrl = await renderPdfPagePreview(item.pdfBytes, 0);
        }
        queue.push(item);
      }
      renderGallery();
      if (queue.length) selectQueueItem(queue[0].id);
    } else {
      // No visual reorder — keep a simple single/multi file queue for submit
      queue = files.map((file, i) => ({
        id: `plain-${i}`,
        kind: "file",
        file,
        label: file.name,
      }));
      sortPanel.hidden = true;
      sortGallery.innerHTML = "";
      setStatus(`${files.length} file(s) ready.`, false);
      return;
    }
    setStatus(`${queue.length} item(s) ready — drag to rearrange.`, false);
    if (active.id === "compress") {
      updateCompressSizeInfo(queueOriginalBytes(), null);
    }
    requestAnimationFrame(scrollToUpload);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function buildPageQueue(file) {
  ensurePdfJs();
  const token = ++previewToken;
  const bytes = await file.arrayBuffer();
  sourcePdfBytes = bytes.slice(0);
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const items = [];
  for (let i = 0; i < pdf.numPages; i++) {
    if (token !== previewToken) return;
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    items.push({
      id: `page-${i}-${token}`,
      kind: "page",
      pageIndex: i,
      label: `Page ${i + 1}`,
      previewUrl: canvas.toDataURL("image/jpeg", 0.72),
      file,
    });
  }
  if (token !== previewToken) return;
  queue = items;
  sortHint.textContent = "Drag pages to rearrange. Click a page for a large zoomable preview.";
  renderGallery();
  if (queue.length) selectQueueItem(queue[0].id);
}

async function renderPdfPagePreview(arrayBuffer, pageIndex) {
  ensurePdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 0.35 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.72);
}

function renderGallery() {
  sortGallery.innerHTML = "";
  if (!queue.length || !active?.reorder) {
    sortPanel.hidden = true;
    selectedQueueId = null;
    clearSortStage();
    return;
  }
  sortPanel.hidden = false;
  sortHint.textContent =
    active.reorder === "pages"
      ? "Drag pages to rearrange. Click for a large preview — use zoom controls."
      : "Drag files to set order. Click for a large preview — use zoom controls.";
  updateSortZoomLabel();

  queue.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "sort-card" + (item.id === selectedQueueId ? " selected" : "");
    card.draggable = true;
    card.dataset.id = item.id;

    const thumb = document.createElement("div");
    thumb.className = "sort-thumb";
    if (item.previewUrl) {
      const img = document.createElement("img");
      img.src = item.previewUrl;
      img.alt = item.label;
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = `<span class="sort-fallback">${escapeHtml(item.label.slice(0, 18))}</span>`;
    }

    const meta = document.createElement("div");
    meta.className = "sort-meta";
    meta.innerHTML = `<span class="sort-num">${index + 1}</span><span class="sort-label" title="${escapeAttr(item.label)}">${escapeHtml(item.label)}</span>`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "sort-remove";
    remove.setAttribute("aria-label", `Remove ${item.label}`);
    remove.textContent = "×";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeQueueItem(item.id);
    });

    card.append(thumb, meta, remove);
    card.addEventListener("click", () => selectQueueItem(item.id));
    wireCardDrag(card);
    sortGallery.appendChild(card);
  });

  if (!selectedQueueId || !queue.some((q) => q.id === selectedQueueId)) {
    if (queue[0]) {
      selectQueueItem(queue[0].id).then(() => sortZoomFit());
    }
  }
}

function clearSortStage() {
  if (sortCanvas) {
    const ctx = sortCanvas.getContext("2d");
    ctx && ctx.clearRect(0, 0, sortCanvas.width, sortCanvas.height);
    sortCanvas.hidden = true;
  }
  if (sortImagePreview) {
    sortImagePreview.hidden = true;
    sortImagePreview.removeAttribute("src");
  }
  if (sortEmpty) sortEmpty.hidden = false;
}

function updateSortZoomLabel() {
  if (sortZoomLabel) sortZoomLabel.textContent = `${Math.round(sortScale * 100)}%`;
}

async function selectQueueItem(id) {
  selectedQueueId = id;
  sortGallery.querySelectorAll(".sort-card").forEach((el) => {
    el.classList.toggle("selected", el.dataset.id === id);
  });
  const item = queue.find((q) => q.id === id);
  if (!item) {
    clearSortStage();
    return;
  }
  await renderSortPreview(item);
}

async function renderSortPreview(item) {
  const token = ++sortPreviewToken;
  clearSortStage();
  if (sortEmpty) sortEmpty.hidden = true;

  try {
    if (item.kind === "page" || (item.file && (item.pdfBytes || item.file.type === "application/pdf" || item.file.name.toLowerCase().endsWith(".pdf")))) {
      ensurePdfJs();
      const bytes = item.kind === "page" ? sourcePdfBytes : item.pdfBytes || (await item.file.arrayBuffer());
      if (!item.pdfBytes && item.file && item.kind !== "page") item.pdfBytes = bytes;
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const pageIndex = item.kind === "page" ? item.pageIndex : 0;
      const page = await pdf.getPage(pageIndex + 1);
      if (token !== sortPreviewToken) return;
      const viewport = page.getViewport({ scale: sortScale });
      sortCanvas.hidden = false;
      sortCanvas.width = viewport.width;
      sortCanvas.height = viewport.height;
      await page.render({ canvasContext: sortCanvas.getContext("2d"), viewport }).promise;
    } else if (item.file && item.file.type.startsWith("image/")) {
      const url = item.previewUrl || URL.createObjectURL(item.file);
      if (!item.previewUrl) item.previewUrl = url;
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (token !== sortPreviewToken) return resolve();
          sortCanvas.hidden = false;
          const w = Math.max(1, Math.round(img.width * sortScale));
          const h = Math.max(1, Math.round(img.height * sortScale));
          sortCanvas.width = w;
          sortCanvas.height = h;
          sortCanvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
    } else {
      if (sortEmpty) {
        sortEmpty.hidden = false;
        sortEmpty.textContent = `Preview not available for ${item.label}`;
      }
    }
  } catch (err) {
    if (sortEmpty) {
      sortEmpty.hidden = false;
      sortEmpty.textContent = err.message || "Preview failed";
    }
  }
}

function setSortScale(next) {
  sortScale = Math.min(3.5, Math.max(0.4, next));
  updateSortZoomLabel();
  const item = queue.find((q) => q.id === selectedQueueId);
  if (item) renderSortPreview(item);
}

async function sortZoomFit() {
  const item = queue.find((q) => q.id === selectedQueueId);
  if (!item || !sortStageWrap) return;
  try {
    let baseW = 800;
    if (item.kind === "page" || item.pdfBytes || item.file?.type === "application/pdf") {
      ensurePdfJs();
      const bytes = item.kind === "page" ? sourcePdfBytes : item.pdfBytes || (await item.file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const page = await pdf.getPage((item.pageIndex || 0) + 1);
      baseW = page.getViewport({ scale: 1 }).width;
    } else if (item.previewUrl) {
      baseW = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.width || 800);
        img.onerror = () => resolve(800);
        img.src = item.previewUrl;
      });
    }
    const avail = Math.max(320, sortStageWrap.clientWidth - 48);
    setSortScale(avail / baseW);
  } catch (_) {
    setSortScale(1.4);
  }
}

document.getElementById("sortZoomIn")?.addEventListener("click", () => setSortScale(sortScale + 0.2));
document.getElementById("sortZoomOut")?.addEventListener("click", () => setSortScale(sortScale - 0.2));
document.getElementById("sortZoomFit")?.addEventListener("click", () => sortZoomFit());

function wireCardDrag(card) {
  card.addEventListener("dragstart", (e) => {
    dragId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    dragId = null;
    sortGallery.querySelectorAll(".sort-card.over").forEach((el) => el.classList.remove("over"));
  });
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    card.classList.add("over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("over"));
  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("over");
    const fromId = e.dataTransfer.getData("text/plain") || dragId;
    const toId = card.dataset.id;
    if (!fromId || fromId === toId) return;
    const from = queue.findIndex((q) => q.id === fromId);
    const to = queue.findIndex((q) => q.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    renderGallery();
  });
}

function removeQueueItem(id) {
  const item = queue.find((q) => q.id === id);
  if (item?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
  queue = queue.filter((q) => q.id !== id);
  if (selectedQueueId === id) selectedQueueId = queue[0]?.id || null;
  renderGallery();
  if (selectedQueueId) selectQueueItem(selectedQueueId);
  else clearSortStage();
  setStatus(queue.length ? `${queue.length} item(s) ready.` : "Add files to continue.", !queue.length);
}

async function buildOrderedPdfFile() {
  if (!window.PDFLib) throw new Error("PDF library is still loading. Try again in a moment.");
  const { PDFDocument } = PDFLib;
  if (active.reorder === "pages") {
    if (!sourcePdfBytes || !queue.length) throw new Error("No PDF pages loaded.");
    const src = await PDFDocument.load(sourcePdfBytes.slice(0));
    const out = await PDFDocument.create();
    const indices = queue.map((q) => q.pageIndex);
    const copied = await out.copyPages(src, indices);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    return new File([bytes], queue[0].file?.name || "reordered.pdf", { type: "application/pdf" });
  }
  return null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!active) return;

  if (!queue.length) {
    setStatus("Please choose at least one file.", true);
    return;
  }
  if (active.id === "merge" && queue.length < 2) {
    setStatus("Upload at least two PDFs to merge.", true);
    return;
  }

  runBtn.disabled = true;
  setStatus("Working… this can take a minute for conversions.");
  try {
    // Interactive Edit PDF — export in the browser and download directly
    if (active.interactiveEdit) {
      const editor = getPdfEditor();
      if (!editor || !editor.pdfBytes) throw new Error("Load a PDF in the editor first.");
      const base = (queue[0]?.file?.name || "document").replace(/\.pdf$/i, "");
      const edited = await editor.exportPdfFile(`${base}-edited.pdf`);
      downloadBlob(edited, edited.name);
      showDeliveryPanel(edited, edited.name);
      setStatus(
        emailEnabled
          ? "Done — edited PDF download started. You can email or share a temporary link below."
          : "Done — edited PDF download started. You can share a temporary link below.",
        false
      );
      return;
    }

    const fd = new FormData();
    if (active.reorder === "pages") {
      const ordered = await buildOrderedPdfFile();
      fd.append("file", ordered);
    } else if (active.multiple || active.reorder === "files") {
      queue.forEach((item) => {
        if (item.file) fd.append("files", item.file);
      });
    } else {
      fd.append("file", queue[0].file);
    }

    options.querySelectorAll("input, select").forEach((el) => {
      if (el.name) fd.append(el.name, el.value);
    });

    if (active.signaturePad) {
      const sig = await signatureBlob();
      fd.append("signature", sig, sig.name || "signature.png");
    }

    const res = await fetch(active.endpoint, { method: "POST", body: fd });
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const data = await res.json();
        msg = data.detail || msg;
        if (Array.isArray(msg)) msg = msg.map((m) => m.msg || JSON.stringify(m)).join("; ");
      } catch (_) {
        msg = await res.text();
      }
      throw new Error(msg || "Request failed");
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(cd);
    const name = match?.[1] || guessName(active.id, blob.type);
    downloadBlob(blob, name);
    showDeliveryPanel(blob, name);

    if (active.id === "compress") {
      const original = Number(res.headers.get("X-Original-Size")) || queueOriginalBytes() || 0;
      const compressed = Number(res.headers.get("X-Compressed-Size")) || blob.size;
      updateCompressSizeInfo(original, compressed);
      const saved = Math.max(0, original - compressed);
      const pct = original > 0 ? Math.round((saved / original) * 100) : 0;
      if (compressed >= original) {
        setStatus(
          `Done — ${formatBytes(original)} → ${formatBytes(compressed)}. Try a higher compression level for a smaller file.`,
          false
        );
      } else {
        setStatus(
          `Done — ${formatBytes(original)} → ${formatBytes(compressed)} (${pct}% smaller). Download started.`,
          false
        );
      }
    } else {
      setStatus(
        emailEnabled
          ? "Done — download started. You can email or share a temporary link below."
          : "Done — download started. You can share a temporary link below.",
        false
      );
    }
  } catch (err) {
    setStatus(err.message || String(err), true);
  } finally {
    runBtn.disabled = false;
  }
});

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.className = "status" + (isError ? " error" : text ? " ok" : "");
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function guessName(id, type) {
  if (type.includes("zip")) return `${id}.zip`;
  if (type.includes("word")) return `${id}.docx`;
  if (type.includes("sheet")) return `${id}.xlsx`;
  if (type.includes("presentation")) return `${id}.pptx`;
  return `${id}.pdf`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
