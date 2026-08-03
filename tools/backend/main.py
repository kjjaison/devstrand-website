"""
DevStrand Tools — PDF manipulation API
"""

from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader, PdfWriter

APP_ROOT = Path(__file__).resolve().parent.parent
FRONTEND = APP_ROOT / "frontend"
TMP = Path(os.environ.get("TOOLS_TMP", "/tmp/devstrand-tools"))
TMP.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "100"))
MAX_COMPRESS_MB = int(os.environ.get("MAX_COMPRESS_MB", str(MAX_UPLOAD_MB)))
MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_COMPRESS_BYTES = MAX_COMPRESS_MB * 1024 * 1024

app = FastAPI(title="DevStrand Tools", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-Original-Size",
        "X-Compressed-Size",
        "X-Compression-Level",
    ],
)


def _safe_name(name: str | None, fallback: str) -> str:
    base = Path(name or fallback).name
    return base.replace("..", "_")[:180] or fallback


def _check_size(upload: UploadFile, data: bytes, max_bytes: int | None = None, max_mb: int | None = None) -> None:
    limit = max_bytes if max_bytes is not None else MAX_BYTES
    label = max_mb if max_mb is not None else MAX_UPLOAD_MB
    if len(data) > limit:
        raise HTTPException(413, f"File too large. Max {label} MB.")


async def _read_upload(upload: UploadFile, max_bytes: int | None = None, max_mb: int | None = None) -> bytes:
    data = await upload.read()
    _check_size(upload, data, max_bytes=max_bytes, max_mb=max_mb)
    if not data:
        raise HTTPException(400, "Empty file.")
    return data


def _workdir() -> Path:
    path = TMP / uuid4().hex
    path.mkdir(parents=True, exist_ok=True)
    return path


def _libreoffice_convert(src: Path, out_dir: Path, target: str) -> Path:
    """Convert with LibreOffice headless. target e.g. pdf, docx."""
    cmd = [
        "soffice",
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--nofirststartwizard",
        "--convert-to",
        target,
        "--outdir",
        str(out_dir),
        str(src),
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
            env={**os.environ, "HOME": str(out_dir)},
        )
    except FileNotFoundError as exc:
        raise HTTPException(500, "LibreOffice is not installed in this container.") from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(504, "Conversion timed out.") from exc

    if result.returncode != 0:
        raise HTTPException(
            500,
            f"Conversion failed: {(result.stderr or result.stdout or 'unknown error')[:400]}",
        )

    outputs = list(out_dir.glob(f"{src.stem}.*"))
    outputs = [p for p in outputs if p.suffix.lower() != src.suffix.lower()]
    if not outputs:
        # LibreOffice sometimes keeps same stem with new ext
        candidates = [p for p in out_dir.iterdir() if p.is_file() and p != src]
        if not candidates:
            raise HTTPException(500, "Conversion produced no output.")
        return candidates[0]
    return outputs[0]


def _file_response(
    path: Path,
    download_name: str,
    media: str,
    extra_headers: dict[str, str] | None = None,
) -> FileResponse:
    return FileResponse(
        path,
        media_type=media,
        filename=download_name,
        background=None,
        headers=extra_headers or {},
    )


def _compress_with_ghostscript(src: Path, dst: Path, level: str) -> bool:
    """Return True if Ghostscript produced dst successfully."""
    if not shutil.which("gs"):
        return False

    # low = best quality / least shrink … maximum = smallest file
    pdfsettings = {
        "low": "/printer",
        "medium": "/ebook",
        "high": "/screen",
        "maximum": "/screen",
    }.get(level, "/ebook")

    cmd = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={pdfsettings}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
    ]
    if level == "maximum":
        cmd.extend(
            [
                "-dColorImageResolution=72",
                "-dGrayImageResolution=72",
                "-dMonoImageResolution=72",
                "-dDownsampleColorImages=true",
                "-dDownsampleGrayImages=true",
                "-dDownsampleMonoImages=true",
                "-dColorImageDownsampleType=/Bicubic",
                "-dGrayImageDownsampleType=/Bicubic",
            ]
        )
    elif level == "high":
        cmd.extend(
            [
                "-dColorImageResolution=100",
                "-dGrayImageResolution=100",
                "-dDownsampleColorImages=true",
                "-dDownsampleGrayImages=true",
            ]
        )

    cmd.extend([f"-sOutputFile={dst}", str(src)])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180, check=False)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0 and dst.exists() and dst.stat().st_size > 0


def _compress_with_pypdf(data: bytes, level: str) -> bytes:
    """Fallback compressor: content-stream deflate + object dedupe."""
    zlib_level = {"low": 6, "medium": 9, "high": 9, "maximum": 9}.get(level, 9)
    writer = PdfWriter(clone_from=io.BytesIO(data))
    for page in writer.pages:
        try:
            page.compress_content_streams(level=zlib_level)
        except Exception:
            try:
                page.compress_content_streams()
            except Exception:
                pass
    try:
        writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    except Exception:
        pass
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _compress_pdf(data: bytes, level: str, work: Path) -> tuple[Path, str]:
    """
    Compress PDF. Prefers Ghostscript when installed; falls back to pypdf.
    Returns (output_path, engine_name).
    """
    level = (level or "medium").lower().strip()
    if level not in {"low", "medium", "high", "maximum"}:
        level = "medium"

    src = work / "input.pdf"
    src.write_bytes(data)
    out = work / "compressed.pdf"

    if _compress_with_ghostscript(src, out, level):
        # If GS somehow grew the file, keep the smaller of GS vs light pypdf.
        gs_bytes = out.read_bytes()
        if len(gs_bytes) >= len(data) and level in {"low", "medium"}:
            light = _compress_with_pypdf(data, level)
            if len(light) < len(gs_bytes):
                out.write_bytes(light)
                return out, "pypdf"
        return out, "ghostscript"

    compressed = _compress_with_pypdf(data, level)
    # Never return a larger file than the original for stream-only compress.
    if len(compressed) >= len(data):
        out.write_bytes(data)
    else:
        out.write_bytes(compressed)
    return out, "pypdf"


@app.get("/api/health")
def health():
    has_lo = shutil.which("soffice") is not None
    has_gs = shutil.which("gs") is not None
    return {
        "ok": True,
        "libreoffice": has_lo,
        "ghostscript": has_gs,
        "max_upload_mb": MAX_UPLOAD_MB,
        "max_compress_mb": MAX_COMPRESS_MB,
    }


@app.post("/api/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Upload at least two PDF files.")
    writer = PdfWriter()
    work = _workdir()
    try:
        for f in files:
            data = await _read_upload(f)
            reader = PdfReader(io.BytesIO(data))
            for page in reader.pages:
                writer.add_page(page)
        out = work / "merged.pdf"
        with out.open("wb") as fh:
            writer.write(fh)
        return _file_response(out, "merged.pdf", "application/pdf")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Merge failed: {exc}") from exc


@app.post("/api/split")
async def split_pdf(
    file: UploadFile = File(...),
    mode: Literal["pages", "ranges"] = Form("pages"),
    ranges: str = Form(""),
):
    """
    mode=pages → one PDF per page (zip)
    mode=ranges → ranges like 1-3,5,7-9 → zip of parts
    """
    data = await _read_upload(file)
    work = _workdir()
    try:
        reader = PdfReader(io.BytesIO(data))
        n = len(reader.pages)
        if n == 0:
            raise HTTPException(400, "PDF has no pages.")

        zip_path = work / "split.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            if mode == "pages":
                for i in range(n):
                    w = PdfWriter()
                    w.add_page(reader.pages[i])
                    buf = io.BytesIO()
                    w.write(buf)
                    zf.writestr(f"page-{i + 1}.pdf", buf.getvalue())
            else:
                parts = _parse_ranges(ranges, n)
                for idx, page_indexes in enumerate(parts, start=1):
                    w = PdfWriter()
                    for pi in page_indexes:
                        w.add_page(reader.pages[pi])
                    buf = io.BytesIO()
                    w.write(buf)
                    label = f"{page_indexes[0] + 1}-{page_indexes[-1] + 1}"
                    zf.writestr(f"part-{idx}_{label}.pdf", buf.getvalue())

        return _file_response(zip_path, "split.zip", "application/zip")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Split failed: {exc}") from exc


def _parse_ranges(spec: str, page_count: int) -> list[list[int]]:
    if not spec.strip():
        raise HTTPException(400, "Provide ranges like 1-3,5,7-9")
    parts: list[list[int]] = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(chunk)
        if start < 1 or end > page_count or start > end:
            raise HTTPException(400, f"Invalid range {chunk} for {page_count} pages.")
        parts.append(list(range(start - 1, end)))
    if not parts:
        raise HTTPException(400, "No valid ranges.")
    return parts


@app.post("/api/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium"),
):
    data = await _read_upload(file, max_bytes=MAX_COMPRESS_BYTES, max_mb=MAX_COMPRESS_MB)
    work = _workdir()
    try:
        out, engine = _compress_pdf(data, level, work)
        original = len(data)
        compressed = out.stat().st_size
        return _file_response(
            out,
            "compressed.pdf",
            "application/pdf",
            extra_headers={
                "X-Original-Size": str(original),
                "X-Compressed-Size": str(compressed),
                "X-Compression-Level": (level or "medium").lower().strip(),
                "X-Compression-Engine": engine,
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Compress failed: {exc}") from exc


@app.post("/api/watermark")
async def watermark_pdf(
    file: UploadFile = File(...),
    text: str = Form("DEVSTRAND"),
    opacity: float = Form(0.25),
):
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.colors import Color

    data = await _read_upload(file)
    work = _workdir()
    try:
        reader = PdfReader(io.BytesIO(data))
        writer = PdfWriter()
        for page in reader.pages:
            box = page.mediabox
            width = float(box.width)
            height = float(box.height)
            packet = io.BytesIO()
            c = rl_canvas.Canvas(packet, pagesize=(width, height))
            c.setFillColor(Color(0.18, 0.2, 0.45, alpha=max(0.05, min(opacity, 0.6))))
            c.saveState()
            c.translate(width / 2, height / 2)
            c.rotate(45)
            c.setFont("Helvetica-Bold", max(24, min(width, height) / 12))
            c.drawCentredString(0, 0, text[:80])
            c.restoreState()
            c.save()
            packet.seek(0)
            watermark = PdfReader(packet).pages[0]
            page.merge_page(watermark)
            writer.add_page(page)
        out = work / "watermarked.pdf"
        with out.open("wb") as fh:
            writer.write(fh)
        return _file_response(out, "watermarked.pdf", "application/pdf")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Watermark failed: {exc}") from exc


@app.post("/api/edit")
async def edit_pdf(
    file: UploadFile = File(...),
    header_text: str = Form(""),
    footer_text: str = Form(""),
    rotate: int = Form(0),
):
    """Light edit: optional header/footer text and page rotation (0/90/180/270)."""
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.colors import HexColor

    data = await _read_upload(file)
    if rotate not in (0, 90, 180, 270):
        raise HTTPException(400, "rotate must be 0, 90, 180, or 270.")
    work = _workdir()
    try:
        reader = PdfReader(io.BytesIO(data))
        writer = PdfWriter()
        for page in reader.pages:
            if rotate:
                page.rotate(rotate)
            if header_text or footer_text:
                box = page.mediabox
                width = float(box.width)
                height = float(box.height)
                packet = io.BytesIO()
                c = rl_canvas.Canvas(packet, pagesize=(width, height))
                c.setFillColor(HexColor("#2e7dff"))
                c.setFont("Helvetica", 10)
                if header_text:
                    c.drawString(36, height - 28, header_text[:120])
                if footer_text:
                    c.drawString(36, 20, footer_text[:120])
                c.save()
                packet.seek(0)
                overlay = PdfReader(packet).pages[0]
                page.merge_page(overlay)
            writer.add_page(page)
        out = work / "edited.pdf"
        with out.open("wb") as fh:
            writer.write(fh)
        return _file_response(out, "edited.pdf", "application/pdf")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Edit failed: {exc}") from exc


@app.post("/api/pdf-to-jpg")
async def pdf_to_jpg(file: UploadFile = File(...), dpi: int = Form(150)):
    from pdf2image import convert_from_bytes

    data = await _read_upload(file)
    dpi = max(72, min(dpi, 200))
    work = _workdir()
    try:
        images = convert_from_bytes(data, dpi=dpi, fmt="jpeg")
        if not images:
            raise HTTPException(400, "No pages rendered.")
        zip_path = work / "pages.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, img in enumerate(images, start=1):
                buf = io.BytesIO()
                img.convert("RGB").save(buf, format="JPEG", quality=85)
                zf.writestr(f"page-{i}.jpg", buf.getvalue())
        return _file_response(zip_path, "pdf-pages.zip", "application/zip")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"PDF to JPG failed: {exc}") from exc


@app.post("/api/jpg-to-pdf")
async def jpg_to_pdf(files: list[UploadFile] = File(...)):
    from PIL import Image

    if not files:
        raise HTTPException(400, "Upload one or more images.")
    work = _workdir()
    try:
        images = []
        for f in files:
            data = await _read_upload(f)
            img = Image.open(io.BytesIO(data)).convert("RGB")
            images.append(img)
        out = work / "images.pdf"
        first, rest = images[0], images[1:]
        first.save(out, save_all=True, append_images=rest)
        return _file_response(out, "images.pdf", "application/pdf")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"JPG to PDF failed: {exc}") from exc


@app.post("/api/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    data = await _read_upload(file)
    work = _workdir()
    src = work / _safe_name(file.filename, "input.pdf")
    src.write_bytes(data)

    # Prefer LibreOffice when available; fallback to pdf2docx
    try:
        if shutil.which("soffice"):
            out = _libreoffice_convert(src, work, "docx")
            return _file_response(out, f"{src.stem}.docx",
                                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    except HTTPException:
        pass

    try:
        from pdf2docx import Converter

        out = work / f"{src.stem}.docx"
        cv = Converter(str(src))
        cv.convert(str(out))
        cv.close()
        return _file_response(
            out,
            out.name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as exc:
        raise HTTPException(400, f"PDF to Word failed: {exc}") from exc


@app.post("/api/word-to-pdf")
async def word_to_pdf(file: UploadFile = File(...)):
    data = await _read_upload(file)
    work = _workdir()
    name = _safe_name(file.filename, "document.docx")
    if not name.lower().endswith((".doc", ".docx", ".odt", ".rtf")):
        raise HTTPException(400, "Upload a Word document (.doc, .docx).")
    src = work / name
    src.write_bytes(data)
    out = _libreoffice_convert(src, work, "pdf")
    return _file_response(out, f"{src.stem}.pdf", "application/pdf")


@app.post("/api/excel-to-pdf")
async def excel_to_pdf(file: UploadFile = File(...)):
    data = await _read_upload(file)
    work = _workdir()
    name = _safe_name(file.filename, "sheet.xlsx")
    if not name.lower().endswith((".xls", ".xlsx", ".ods", ".csv")):
        raise HTTPException(400, "Upload an Excel file (.xls, .xlsx).")
    src = work / name
    src.write_bytes(data)
    out = _libreoffice_convert(src, work, "pdf")
    return _file_response(out, f"{src.stem}.pdf", "application/pdf")


@app.post("/api/pdf-to-excel")
async def pdf_to_excel(file: UploadFile = File(...)):
    """Best-effort table extract via LibreOffice calc export when possible."""
    data = await _read_upload(file)
    work = _workdir()
    src = work / _safe_name(file.filename, "input.pdf")
    src.write_bytes(data)
    # LibreOffice can export PDF → HTML/writer; for spreadsheet use csv via pdfplumber fallback
    try:
        import pdfplumber
        from openpyxl import Workbook

        wb = Workbook()
        wb.remove(wb.active)
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                ws = wb.create_sheet(f"Page {i}")
                tables = page.extract_tables() or []
                row_n = 1
                if not tables:
                    text = page.extract_text() or ""
                    for line in text.splitlines():
                        ws.cell(row=row_n, column=1, value=line)
                        row_n += 1
                else:
                    for table in tables:
                        for row in table:
                            for col, cell in enumerate(row or [], start=1):
                                ws.cell(row=row_n, column=col, value=cell)
                            row_n += 1
                        row_n += 1
        out = work / f"{src.stem}.xlsx"
        wb.save(out)
        return _file_response(
            out,
            out.name,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as exc:
        raise HTTPException(400, f"PDF to Excel failed: {exc}") from exc


@app.post("/api/pdf-to-powerpoint")
async def pdf_to_powerpoint(file: UploadFile = File(...)):
    """Convert each PDF page to an image slide (PPTX)."""
    from pdf2image import convert_from_bytes
    from pptx import Presentation
    from pptx.util import Emu

    data = await _read_upload(file)
    work = _workdir()
    try:
        images = convert_from_bytes(data, dpi=120, fmt="png")
        if not images:
            raise HTTPException(400, "No pages rendered.")
        prs = Presentation()
        blank = prs.slide_layouts[6]
        for img in images:
            slide = prs.slides.add_slide(blank)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            # Fit to slide
            slide_w = prs.slide_width
            slide_h = prs.slide_height
            slide.shapes.add_picture(buf, Emu(0), Emu(0), width=slide_w, height=slide_h)
        out = work / "slides.pptx"
        prs.save(out)
        return _file_response(
            out,
            "slides.pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"PDF to PowerPoint failed: {exc}") from exc


# Static frontend
if FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

    @app.get("/")
    def index():
        html = (FRONTEND / "index.html").read_text(encoding="utf-8")
        return HTMLResponse(html)

    @app.get("/robots.txt", response_class=PlainTextResponse)
    def robots_txt():
        path = FRONTEND / "robots.txt"
        return path.read_text(encoding="utf-8") if path.exists() else "User-agent: *\nAllow: /\n"

    @app.get("/sitemap.xml")
    def sitemap_xml():
        path = FRONTEND / "sitemap.xml"
        body = path.read_text(encoding="utf-8") if path.exists() else (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            "<url><loc>https://tools.devstrand.com/</loc></url></urlset>"
        )
        return Response(content=body, media_type="application/xml")
