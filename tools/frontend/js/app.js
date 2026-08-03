const TOOLS = [
  {
    id: "merge",
    title: "Merge PDF",
    desc: "Combine multiple PDFs into one file.",
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
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/edit",
    hint: "Upload a PDF, then edit on the large canvas — zoom, add/remove pages, text, and images.",
    reorder: false,
    interactiveEdit: true,
  },
  {
    id: "watermark",
    title: "Watermark PDF",
    desc: "Stamp diagonal text across every page.",
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
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-word",
    reorder: "pages",
  },
  {
    id: "word-to-pdf",
    title: "Word to PDF",
    desc: "Convert DOC/DOCX to PDF via LibreOffice.",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    multiple: false,
    endpoint: "/api/word-to-pdf",
    reorder: false,
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel",
    desc: "Extract tables/text into an XLSX workbook.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-excel",
    reorder: "pages",
  },
  {
    id: "excel-to-pdf",
    title: "Excel to PDF",
    desc: "Convert spreadsheets to PDF.",
    accept: ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    multiple: false,
    endpoint: "/api/excel-to-pdf",
    reorder: false,
  },
  {
    id: "pdf-to-ppt",
    title: "PDF to PowerPoint",
    desc: "Each page becomes a slide image.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-powerpoint",
    reorder: "pages",
  },
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    desc: "Render pages to JPG images (ZIP).",
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

function getPdfEditor() {
  if (!pdfEditor && window.InteractivePdfEditor && pdfEditorRoot) {
    pdfEditor = new InteractivePdfEditor(pdfEditorRoot);
  }
  return pdfEditor;
}

document.getElementById("year").textContent = String(new Date().getFullYear());

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

document.getElementById("backBtn").addEventListener("click", () => {
  workspace.hidden = true;
  active = null;
  clearQueue();
  form.reset();
  statusEl.textContent = "";
  statusEl.className = "status";
  document.querySelectorAll(".tool-card.active").forEach((el) => el.classList.remove("active"));
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
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
  options.innerHTML = "";
  if (tool.id === "compress") {
    const report = document.createElement("div");
    report.id = "compressSizeInfo";
    report.className = "size-report";
    report.innerHTML =
      "<strong>File size</strong><span data-size-current>Upload a PDF to see the current size.</span><span data-size-result hidden></span>";
    options.appendChild(report);
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
      setStatus("Done — edited PDF download started.", false);
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
      setStatus("Done — download started.", false);
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
