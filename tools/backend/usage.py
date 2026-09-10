"""
Usage analytics — append-only JSONL events for tool runs, shares, emails, downloads.

Privacy: stores IP, country, filenames, sizes — not file contents.
Disable with USAGE_LOG_ENABLED=false. Protect /api/admin/usage with USAGE_ADMIN_TOKEN.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Request

USAGE_LOG_ENABLED = os.environ.get("USAGE_LOG_ENABLED", "true").strip().lower() in {
    "1",
    "true",
    "yes",
}
USAGE_DIR = Path(os.environ.get("USAGE_LOG_DIR", os.environ.get("TOOLS_TMP", "/tmp/devstrand-tools"))) / "usage"
USAGE_LOG_PATH = USAGE_DIR / "events.jsonl"

_lock = threading.Lock()


def usage_enabled() -> bool:
    return os.environ.get("USAGE_LOG_ENABLED", "true").strip().lower() in {"1", "true", "yes"}


def admin_token() -> str:
    """Read token at call time so .env / compose updates apply after recreate."""
    raw = os.environ.get("USAGE_ADMIN_TOKEN", "") or ""
    return raw.strip().strip('"').strip("'")


# Back-compat for older imports / health checks
USAGE_ADMIN_TOKEN = admin_token()

# Map API path → tool id for analysis
PATH_TO_TOOL = {
    "/api/merge": "merge",
    "/api/split": "split",
    "/api/compress": "compress",
    "/api/edit": "edit",
    "/api/ocr": "ocr",
    "/api/esign": "esign",
    "/api/watermark": "watermark",
    "/api/pdf-to-word": "pdf-to-word",
    "/api/word-to-pdf": "word-to-pdf",
    "/api/pdf-to-excel": "pdf-to-excel",
    "/api/excel-to-pdf": "excel-to-pdf",
    "/api/pdf-to-powerpoint": "pdf-to-powerpoint",
    "/api/pdf-to-jpg": "pdf-to-jpg",
    "/api/jpg-to-pdf": "jpg-to-pdf",
    "/api/share": "share",
    "/api/email-result": "email",
}


def client_ip(request: Request) -> str:
    forwarded = (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-real-ip")
        or request.headers.get("x-forwarded-for")
    )
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def client_country(request: Request) -> str:
    """Cloudflare sets CF-IPCountry when traffic comes through the tunnel/proxy."""
    code = (request.headers.get("cf-ipcountry") or request.headers.get("CF-IPCountry") or "").strip().upper()
    if not code or code in {"XX", "T1"}:  # unknown / Tor
        return code or "XX"
    return code


def _parse_files_header(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    out: list[dict[str, Any]] = []
    if not isinstance(data, list):
        return out
    for item in data[:40]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("filename") or "")[:180]
        try:
            size = int(item.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        if name or size:
            out.append({"name": name, "size": max(0, size)})
    return out


def log_event(event: dict[str, Any]) -> None:
    if not usage_enabled():
        return
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "epoch": time.time(),
        **event,
    }
    line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    try:
        USAGE_DIR.mkdir(parents=True, exist_ok=True)
        with _lock:
            with USAGE_LOG_PATH.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
    except OSError:
        # Never break tool requests because of analytics I/O
        pass


def log_from_request(
    request: Request,
    *,
    event: str,
    tool: str | None = None,
    status: int | None = None,
    duration_ms: int | None = None,
    files: list[dict[str, Any]] | None = None,
    shared: bool | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    header_tool = (request.headers.get("x-devstrand-tool") or "").strip()
    path = request.url.path
    resolved_tool = tool or header_tool or PATH_TO_TOOL.get(path) or path.rsplit("/", 1)[-1]
    file_list = files if files is not None else _parse_files_header(request.headers.get("x-devstrand-files"))
    total_bytes = sum(int(f.get("size") or 0) for f in file_list)
    payload: dict[str, Any] = {
        "event": event,
        "tool": resolved_tool,
        "path": path,
        "method": request.method,
        "ip": client_ip(request),
        "country": client_country(request),
        "user_agent": (request.headers.get("user-agent") or "")[:240],
        "files": file_list,
        "file_count": len(file_list),
        "total_bytes": total_bytes,
    }
    if status is not None:
        payload["status"] = status
    if duration_ms is not None:
        payload["duration_ms"] = duration_ms
    if shared is not None:
        payload["shared"] = shared
    if extra:
        payload.update(extra)
    log_event(payload)


def iter_events(limit: int | None = None) -> list[dict[str, Any]]:
    if not USAGE_LOG_PATH.exists():
        return []
    rows: list[dict[str, Any]] = []
    try:
        with USAGE_LOG_PATH.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError:
        return []
    if limit is not None and limit > 0:
        return rows[-limit:]
    return rows


def summarize(events: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    rows = events if events is not None else iter_events()
    by_tool: Counter[str] = Counter()
    by_country: Counter[str] = Counter()
    by_day: Counter[str] = Counter()
    by_event: Counter[str] = Counter()
    share_creates = 0
    share_downloads = 0
    emails = 0
    tool_ok = 0
    tool_err = 0
    bytes_in = 0

    for row in rows:
        ev = str(row.get("event") or "unknown")
        by_event[ev] += 1
        tool = str(row.get("tool") or "unknown")
        country = str(row.get("country") or "XX")
        by_country[country] += 1
        ts = str(row.get("ts") or "")
        day = ts[:10] if len(ts) >= 10 else "unknown"
        by_day[day] += 1

        if ev == "tool_run":
            by_tool[tool] += 1
            status = int(row.get("status") or 0)
            if 200 <= status < 400:
                tool_ok += 1
            elif status:
                tool_err += 1
            bytes_in += int(row.get("total_bytes") or 0)
        elif ev == "share_create":
            share_creates += 1
        elif ev == "share_download":
            share_downloads += 1
        elif ev == "email_send":
            emails += 1

    # Shares attributed to originating tool when present
    shares_by_tool: Counter[str] = Counter()
    for row in rows:
        if row.get("event") == "share_create":
            shares_by_tool[str(row.get("tool") or "unknown")] += 1

    return {
        "ok": True,
        "enabled": usage_enabled(),
        "admin_token_configured": bool(admin_token()),
        "log_path": str(USAGE_LOG_PATH),
        "total_events": len(rows),
        "tool_runs_ok": tool_ok,
        "tool_runs_error": tool_err,
        "share_creates": share_creates,
        "share_downloads": share_downloads,
        "emails": emails,
        "bytes_uploaded_reported": bytes_in,
        "by_tool": dict(by_tool.most_common()),
        "shares_by_tool": dict(shares_by_tool.most_common()),
        "by_country": dict(by_country.most_common()),
        "by_day": dict(sorted(by_day.items())),
        "by_event": dict(by_event.most_common()),
        "recent": rows[-50:],
    }
