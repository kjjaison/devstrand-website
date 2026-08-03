const TOOLS = [
  {
    id: "merge",
    title: "Merge PDF",
    desc: "Combine multiple PDFs into one file.",
    accept: ".pdf,application/pdf",
    multiple: true,
    endpoint: "/api/merge",
    hint: "Select 2 or more PDF files.",
  },
  {
    id: "split",
    title: "Split PDF",
    desc: "Split into pages or custom ranges.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/split",
    hint: "One PDF. Optional ranges like 1-3,5,7-9.",
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
    desc: "Reduce PDF size where possible.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/compress",
    hint: "One PDF file — up to 100 MB.",
    maxMb: 100,
  },
  {
    id: "edit",
    title: "Edit PDF",
    desc: "Add header/footer text or rotate pages.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/edit",
    hint: "Light edit — not a full PDF designer.",
    fields: [
      { name: "header_text", label: "Header text", type: "text", placeholder: "Optional" },
      { name: "footer_text", label: "Footer text", type: "text", placeholder: "Optional" },
      {
        name: "rotate",
        label: "Rotate pages",
        type: "select",
        options: [
          { value: "0", label: "None" },
          { value: "90", label: "90°" },
          { value: "180", label: "180°" },
          { value: "270", label: "270°" },
        ],
      },
    ],
  },
  {
    id: "watermark",
    title: "Watermark PDF",
    desc: "Stamp diagonal text across every page.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/watermark",
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
  },
  {
    id: "word-to-pdf",
    title: "Word to PDF",
    desc: "Convert DOC/DOCX to PDF via LibreOffice.",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    multiple: false,
    endpoint: "/api/word-to-pdf",
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel",
    desc: "Extract tables/text into an XLSX workbook.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-excel",
  },
  {
    id: "excel-to-pdf",
    title: "Excel to PDF",
    desc: "Convert spreadsheets to PDF.",
    accept: ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    multiple: false,
    endpoint: "/api/excel-to-pdf",
  },
  {
    id: "pdf-to-ppt",
    title: "PDF to PowerPoint",
    desc: "Each page becomes a slide image.",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-powerpoint",
  },
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    desc: "Render pages to JPG images (ZIP).",
    accept: ".pdf,application/pdf",
    multiple: false,
    endpoint: "/api/pdf-to-jpg",
    fields: [{ name: "dpi", label: "DPI (72–200)", type: "text", value: "150" }],
  },
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF",
    desc: "Build a PDF from one or more images.",
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    multiple: true,
    endpoint: "/api/jpg-to-pdf",
    hint: "Select multiple JPG/PNG/WebP files (Ctrl/Cmd+click, Shift+click, or drop several at once).",
  },
];

const grid = document.getElementById("tools");
const workspace = document.getElementById("workspace");
const form = document.getElementById("toolForm");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const dropZone = document.getElementById("dropZone");
const options = document.getElementById("options");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("runBtn");
const fileHint = document.getElementById("fileHint");

let active = null;

document.getElementById("year").textContent = String(new Date().getFullYear());

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
  form.reset();
  fileList.innerHTML = "";
  statusEl.textContent = "";
  statusEl.className = "status";
  document.querySelectorAll(".tool-card.active").forEach((el) => el.classList.remove("active"));
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
});

function scrollToUpload() {
  const header = document.querySelector(".topbar");
  const headerH = header ? header.getBoundingClientRect().height : 0;
  // Prefer the drop zone; fall back to the whole workspace panel
  const target = dropZone || workspace;
  const y = window.scrollY + target.getBoundingClientRect().top - headerH - 16;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  // Retry once after layout settles (mobile / slow paint)
  window.setTimeout(() => {
    const y2 = window.scrollY + target.getBoundingClientRect().top - headerH - 16;
    window.scrollTo({ top: Math.max(0, y2), behavior: "smooth" });
  }, 120);
}

function openTool(tool) {
  active = tool;
  workspace.hidden = false;
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
  if (tool.multiple) {
    fileInput.setAttribute("multiple", "multiple");
  } else {
    fileInput.removeAttribute("multiple");
  }
  fileInput.value = "";
  fileList.innerHTML = "";
  statusEl.textContent = "";
  statusEl.className = "status";
  options.innerHTML = "";
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

  // Scroll after the workspace is painted so the file upload is on screen
  requestAnimationFrame(() => {
    requestAnimationFrame(scrollToUpload);
  });
}

fileInput.addEventListener("change", renderFiles);

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
  const files = e.dataTransfer.files;
  if (!files?.length) return;
  const dt = new DataTransfer();
  // Keep existing files when tool allows multiple uploads
  if (active?.multiple) {
    [...fileInput.files].forEach((f) => dt.items.add(f));
  }
  [...files].forEach((f) => dt.items.add(f));
  fileInput.files = dt.files;
  renderFiles();
});

function renderFiles() {
  fileList.innerHTML = "";
  [...fileInput.files].forEach((f) => {
    const li = document.createElement("li");
    const size =
      f.size >= 1024 * 1024
        ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(f.size / 1024))} KB`;
    li.textContent = `${f.name} (${size})`;
    fileList.appendChild(li);
  });
}

function maxMbForActive() {
  return active?.maxMb || 25;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!active) return;
  if (!fileInput.files.length) {
    setStatus("Please choose at least one file.", true);
    return;
  }
  if (active.multiple && fileInput.files.length < 1) {
    setStatus("Please choose one or more image files.", true);
    return;
  }
  const limitMb = maxMbForActive();
  const limitBytes = limitMb * 1024 * 1024;
  for (const f of fileInput.files) {
    if (f.size > limitBytes) {
      setStatus(`“${f.name}” is too large. Max ${limitMb} MB.`, true);
      return;
    }
  }
  const fd = new FormData();
  if (active.multiple) {
    [...fileInput.files].forEach((f) => fd.append("files", f));
  } else {
    fd.append("file", fileInput.files[0]);
  }
  options.querySelectorAll("input, select").forEach((el) => {
    if (el.name) fd.append(el.name, el.value);
  });

  runBtn.disabled = true;
  setStatus("Working… this can take a minute for conversions.");
  try {
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
    setStatus("Done — download started.", false);
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
