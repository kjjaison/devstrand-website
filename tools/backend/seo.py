"""SEO metadata for crawlable PDF tool URLs."""

from __future__ import annotations

import re

TOOL_SEO: dict[str, dict[str, str]] = {
    "merge": {
        "title": "Merge PDF — combine PDF files free online",
        "description": "Merge and combine multiple PDF files into one document. Free, no signup, ephemeral processing on DevStrand Tools.",
    },
    "split": {
        "title": "Split PDF — extract pages or ranges free online",
        "description": "Split a PDF into separate pages or custom ranges. Free online PDF splitter from DevStrand Tools.",
    },
    "organize": {
        "title": "Organize PDF — reorder or delete pages online",
        "description": "Reorder or remove PDF pages in your browser, then download. Free Organize PDF tool from DevStrand.",
    },
    "compress": {
        "title": "Compress PDF — reduce PDF file size free",
        "description": "Compress PDF files online with low to maximum compression. Free, private processing on DevStrand Tools.",
    },
    "rotate": {
        "title": "Rotate PDF — turn pages 90°, 180°, or 270°",
        "description": "Rotate every PDF page clockwise. Free online Rotate PDF tool from DevStrand Tools.",
    },
    "page-numbers": {
        "title": "Add page numbers to PDF free online",
        "description": "Stamp page numbers on every PDF page. Choose position and format. Free on DevStrand Tools.",
    },
    "edit": {
        "title": "Edit PDF — add text, images, and stamps free",
        "description": "Edit PDF text, add images and stamps, crop, and undo. Free interactive PDF editor from DevStrand.",
    },
    "ocr": {
        "title": "OCR PDF and documents — searchable PDF free",
        "description": "OCR scanned PDFs, images, Word, Excel, and PowerPoint into a searchable PDF. Free on DevStrand Tools.",
    },
    "esign": {
        "title": "E-sign PDF — sign documents free online",
        "description": "Type, draw, or upload a signature and stamp it on your PDF. Free e-sign tool from DevStrand Tools.",
    },
    "watermark": {
        "title": "Watermark PDF — stamp text on every page",
        "description": "Add a diagonal text watermark across every PDF page. Free Watermark PDF tool from DevStrand.",
    },
    "unlock": {
        "title": "Unlock PDF — remove password protection",
        "description": "Unlock a password-protected PDF by entering the password. Free Unlock PDF tool from DevStrand Tools.",
    },
    "protect": {
        "title": "Protect PDF — add a password free online",
        "description": "Add password protection so a PDF cannot be opened without it. Free Protect PDF from DevStrand Tools.",
    },
    "pdf-to-word": {
        "title": "PDF to Word — convert PDF to DOCX free",
        "description": "Convert PDF to editable Word DOCX online. Free PDF to Word converter from DevStrand Tools.",
    },
    "word-to-pdf": {
        "title": "Word to PDF — convert DOC/DOCX free",
        "description": "Convert Word documents to PDF online via LibreOffice. Free Word to PDF from DevStrand Tools.",
    },
    "pdf-to-excel": {
        "title": "PDF to Excel — extract tables to XLSX",
        "description": "Convert PDF tables and text into an Excel workbook. Free PDF to Excel from DevStrand Tools.",
    },
    "excel-to-pdf": {
        "title": "Excel to PDF — convert spreadsheets free",
        "description": "Convert Excel spreadsheets to PDF online. Free Excel to PDF converter from DevStrand Tools.",
    },
    "pdf-to-ppt": {
        "title": "PDF to PowerPoint — pages to slides free",
        "description": "Convert each PDF page into a PowerPoint slide. Free PDF to PPT from DevStrand Tools.",
    },
    "pdf-to-jpg": {
        "title": "PDF to JPG — convert PDF pages to images",
        "description": "Export PDF pages as JPG images (ZIP). Free PDF to JPG converter from DevStrand Tools.",
    },
    "jpg-to-pdf": {
        "title": "JPG to PDF — convert images to PDF free",
        "description": "Build a PDF from one or more JPG, PNG, or WebP images. Free JPG to PDF from DevStrand Tools.",
    },
}


def _esc(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def inject_tool_seo(html: str, tool_id: str, base_url: str) -> str:
    meta = TOOL_SEO.get(tool_id)
    if not meta:
        return html
    title = _esc(meta["title"])
    description = _esc(meta["description"])
    canonical = f"{base_url.rstrip('/')}/{tool_id}"
    out = html
    out = re.sub(r"<title>.*?</title>", f"<title>{title} | DevStrand Tools</title>", out, count=1, flags=re.I | re.S)
    out = re.sub(
        r'(<meta\s+name="description"\s+content=")[^"]*(")',
        rf"\1{description}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(
        r'(<link\s+rel="canonical"\s+href=")[^"]*(")',
        rf"\1{canonical}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(
        r'(<meta\s+property="og:title"\s+content=")[^"]*(")',
        rf"\1{title}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(
        r'(<meta\s+property="og:description"\s+content=")[^"]*(")',
        rf"\1{description}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(
        r'(<meta\s+property="og:url"\s+content=")[^"]*(")',
        rf"\1{canonical}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(
        r'(<meta\s+name="twitter:title"\s+content=")[^"]*(")',
        rf"\1{title}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(
        r'(<meta\s+name="twitter:description"\s+content=")[^"]*(")',
        rf"\1{description}\2",
        out,
        count=1,
        flags=re.I,
    )
    out = re.sub(r"<body(\s[^>]*)?>", rf'<body\1 data-open-tool="{tool_id}">', out, count=1, flags=re.I)
    return out


def build_sitemap(base_url: str = "https://tools.devstrand.com") -> str:
    base = base_url.rstrip("/")
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        f"  <url><loc>{base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>",
    ]
    popular = {"merge", "compress", "edit", "pdf-to-jpg", "jpg-to-pdf", "esign", "ocr", "organize"}
    for tool_id in TOOL_SEO:
        priority = "0.9" if tool_id in popular else "0.8"
        lines.append(
            f"  <url><loc>{base}/{tool_id}</loc><changefreq>weekly</changefreq><priority>{priority}</priority></url>"
        )
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"
