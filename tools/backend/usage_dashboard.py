"""Private usage dashboard for tools, image, and LiveTranslate.

Not linked from the public site. A valid USAGE_ADMIN_TOKEN is required
before any numbers are shown. Remote apps are read server-side so the
browser never sees their tokens.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import os
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from . import usage as usage_log

COOKIE = "ds_usage"
COOKIE_PATH = "/internal/usage"
SEAL = b"devstrand-usage-dashboard-v1"
_login_fails: dict[str, deque[float]] = defaultdict(deque)
FAIL_LIMIT = 8
FAIL_WINDOW = 900.0

_HEADERS = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
}


def _clean(raw: str | None) -> str:
    return (raw or "").strip().strip('"').strip("'")


def _env_token(name: str) -> str:
    return _clean(os.environ.get(name, "")) or usage_log.admin_token()


def _sources() -> list[dict[str, str]]:
    return [
        {
            "id": "image",
            "label": "Image editor",
            "url": _clean(os.environ.get("IMAGE_USAGE_URL", "")) or "https://image.devstrand.com",
            "token": _env_token("IMAGE_USAGE_TOKEN"),
        },
        {
            "id": "livetranslate",
            "label": "LiveTranslate",
            "url": _clean(os.environ.get("LIVETRANSLATE_USAGE_URL", "")) or "https://livetranslate.devstrand.com",
            "token": _env_token("LIVETRANSLATE_USAGE_TOKEN"),
        },
    ]


def _seal() -> str:
    token = usage_log.admin_token()
    return hmac.new(token.encode(), SEAL, hashlib.sha256).hexdigest()


def _authed(request) -> bool:
    if not usage_log.admin_token():
        return False
    given = request.cookies.get(COOKIE, "")
    expected = _seal()
    if len(given) != len(expected):
        return False
    return hmac.compare_digest(given, expected)


def _secure_cookie(request) -> bool:
    proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if proto == "https" or "https" in (request.headers.get("cf-visitor") or ""):
        return True
    return request.url.scheme == "https"


def _page(body: str, status: int = 200) -> HTMLResponse:
    return HTMLResponse(body, status_code=status, headers=_HEADERS)
    return HTMLResponse(body, status_code=status, headers=_HEADERS)


def _shell(title: str, inner: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <title>{html.escape(title)}</title>
  <style>
    :root {{ color-scheme: dark; --ink:#eef2ff; --muted:#9aa3c7; --line:rgba(238,242,255,.12); --panel:#12182b; --bad:#f0a3a8; --ok:#8fd0b5; }}
    * {{ box-sizing: border-box; }}
    body {{ margin:0; font:15px/1.5 ui-sans-serif, system-ui, sans-serif; color:var(--ink);
      background:#070a14 radial-gradient(ellipse 70% 40% at 10% 0%, rgba(77,159,255,.18), transparent 55%); }}
    main {{ width:min(1100px, calc(100% - 2rem)); margin:0 auto; padding:1.5rem 0 3rem; }}
    h1 {{ font-size:1.6rem; margin:0 0 .25rem; }}
    h2 {{ font-size:1.05rem; margin:0 0 .75rem; }}
    p {{ color:var(--muted); }}
    a {{ color:#9ec5ff; }}
    header {{ display:flex; justify-content:space-between; gap:1rem; align-items:flex-end; margin-bottom:1.25rem; }}
    form.login {{ width:min(420px, 100%); background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:1.25rem; }}
    label {{ display:block; margin:.8rem 0 .3rem; }}
    input {{ width:100%; padding:.65rem .75rem; border-radius:10px; border:1px solid var(--line); background:#0b1020; color:var(--ink); }}
    button {{ margin-top:.9rem; border:0; border-radius:999px; padding:.6rem 1rem; background:#3d7eff; color:white; font-weight:650; cursor:pointer; }}
    button.ghost {{ background:transparent; color:var(--muted); border:1px solid var(--line); margin:0; }}
    .err {{ color:var(--bad); }}
    .grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:.8rem; }}
    .card, .panel {{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:1rem; }}
    .stat {{ font-size:1.7rem; font-weight:700; }}
    table {{ width:100%; border-collapse:collapse; font-size:.86rem; }}
    th, td {{ text-align:left; padding:.45rem .4rem; border-bottom:1px solid var(--line); vertical-align:top; }}
    th {{ color:var(--muted); font-weight:600; }}
    .scroll {{ overflow:auto; }}
    .ok {{ color:var(--ok); }}
    .bad {{ color:var(--bad); }}
    .bars {{ display:flex; flex-direction:column; gap:.35rem; margin-top:.6rem; }}
    .bar {{ display:grid; grid-template-columns:6.5rem 1fr auto; gap:.5rem; align-items:center; color:var(--muted); font-size:.8rem; }}
    .bar span {{ height:.45rem; border-radius:99px; background:#3d7eff; display:block; }}
    details {{ margin-top:.2rem; }}
    summary {{ cursor:pointer; color:#9ec5ff; }}
    .section {{ margin-top:1.25rem; }}
  </style>
</head>
<body><main>{inner}</main></body>
</html>"""


def _login_html(error: str = "") -> str:
    note = f'<p class="err">{html.escape(error)}</p>' if error else ""
    inner = f"""
    <h1>Usage</h1>
    <p>Private. This page is not part of the public site.</p>
    <form class="login" method="post" action="/internal/usage/login" autocomplete="off">
      {note}
      <label for="token">Admin token</label>
      <input id="token" name="token" type="password" autocomplete="off" spellcheck="false" required />
      <button type="submit">Open dashboard</button>
    </form>"""
    return _shell("Usage", inner)


def _limited(ip: str) -> bool:
    now = time.time()
    hits = _login_fails[ip]
    while hits and now - hits[0] > FAIL_WINDOW:
        hits.popleft()
    return len(hits) >= FAIL_LIMIT


def _mark_fail(ip: str) -> None:
    _login_fails[ip].append(time.time())


def _fetch_remote(url: str, token: str) -> dict[str, Any]:
    if not token:
        return {"ok": False, "error": "No usage token configured for this app."}
    target = url.rstrip("/") + "/api/admin/usage?limit=80"
    req = urllib.request.Request(
        target,
        headers={"X-Usage-Token": token, "Accept": "application/json", "User-Agent": "devstrand-usage-dashboard"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            body = json.loads(exc.read().decode("utf-8"))
            detail = str(body.get("error") or "")[:180]
        except Exception:
            detail = ""
        return {"ok": False, "error": detail or f"HTTP {exc.code}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:180]}
    if not isinstance(data, dict):
        return {"ok": False, "error": "Unexpected response."}
    data["ok"] = True
    return data


def _local_summary() -> dict[str, Any]:
    events = usage_log.iter_events()
    summary = usage_log.summarize(events)
    summary["recent"] = events[-80:]
    summary["ok"] = True
    return summary


def _load() -> list[dict[str, Any]]:
    local = {
        "id": "tools",
        "label": "PDF tools",
        "summary": _local_summary(),
    }
    remotes = _sources()
    with ThreadPoolExecutor(max_workers=max(1, len(remotes))) as pool:
        fetched = list(pool.map(lambda src: _fetch_remote(src["url"], src["token"]), remotes))
    panels = [local]
    for src, summary in zip(remotes, fetched):
        panels.append({"id": src["id"], "label": src["label"], "summary": summary})
    return panels


def _esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def _count_table(title: str, counts: dict[str, Any] | None, limit: int = 8) -> str:
    rows = sorted((counts or {}).items(), key=lambda item: (-int(item[1] or 0), str(item[0])))[:limit]
    if not rows:
        return f"<h2>{_esc(title)}</h2><p>No events yet.</p>"
    body = "".join(f"<tr><td>{_esc(key)}</td><td>{int(value or 0)}</td></tr>" for key, value in rows)
    return f"<h2>{_esc(title)}</h2><table><tbody>{body}</tbody></table>"


def _bars(counts: dict[str, Any] | None) -> str:
    rows = sorted((counts or {}).items())[-14:]
    if not rows:
        return ""
    peak = max(int(value or 0) for _, value in rows) or 1
    parts = []
    for day, value in rows:
        width = max(4, round(100 * int(value or 0) / peak))
        parts.append(
            f'<div class="bar"><div>{_esc(day[5:] if len(day) >= 10 else day)}</div>'
            f'<span style="width:{width}%"></span><div>{int(value or 0)}</div></div>'
        )
    return '<div class="bars">' + "".join(parts) + "</div>"


def _event_rows(app_label: str, events: list[dict[str, Any]]) -> str:
    rows = []
    for event in events:
        status = event.get("status")
        status_class = "ok" if isinstance(status, int) and 200 <= status < 400 else "bad" if status else ""
        files = event.get("files") if isinstance(event.get("files"), list) else []
        file_bits = []
        for item in files[:8]:
            if isinstance(item, dict):
                file_bits.append(f"{_esc(item.get('name') or 'file')} ({int(item.get('size') or 0)} B)")
        extra_keys = [
            key
            for key in event
            if key
            not in {
                "ts",
                "epoch",
                "app",
                "event",
                "tool",
                "path",
                "method",
                "ip",
                "country",
                "user_agent",
                "status",
                "duration_ms",
                "files",
                "file_count",
                "total_bytes",
            }
        ]
        extra = "".join(f"<div>{_esc(key)}: {_esc(event.get(key))}</div>" for key in extra_keys)
        detail = (
            f"<div>IP {_esc(event.get('ip'))}</div>"
            f"<div>{_esc(event.get('method'))} {_esc(event.get('path'))}</div>"
            f"<div>{_esc((event.get('user_agent') or '')[:180])}</div>"
            + (f"<div>Files: {', '.join(file_bits)}</div>" if file_bits else "")
            + extra
        )
        when = _esc(str(event.get("ts") or "").replace("T", " ")[:19])
        rows.append(
            "<tr>"
            f"<td>{when}</td>"
            f"<td>{_esc(app_label)}</td>"
            f"<td>{_esc(event.get('tool'))}</td>"
            f"<td>{_esc(event.get('event'))}</td>"
            f"<td>{_esc(event.get('country'))}</td>"
            f'<td class="{status_class}">{_esc(status if status is not None else "")}</td>'
            f"<td>{_esc(event.get('duration_ms') if event.get('duration_ms') is not None else '')}</td>"
            f"<td><details><summary>Details</summary>{detail}</details></td>"
            "</tr>"
        )
    return "".join(rows)


def _dashboard_html(panels: list[dict[str, Any]]) -> str:
    cards = []
    latest: list[tuple[str, dict[str, Any]]] = []
    merged_days: dict[str, int] = defaultdict(int)
    for panel in panels:
        summary = panel["summary"] if isinstance(panel.get("summary"), dict) else {}
        ok = bool(summary.get("ok"))
        if ok:
            for event in summary.get("recent") or []:
                if isinstance(event, dict):
                    latest.append((str(panel["label"]), event))
            for day, count in (summary.get("by_day") or {}).items():
                merged_days[str(day)] += int(count or 0)
            body = (
                f'<div class="stat">{int(summary.get("total_events") or 0)}</div>'
                f'<p>{int(summary.get("tool_runs_ok") or 0)} ok · {int(summary.get("tool_runs_error") or 0)} errors</p>'
                f'{_count_table("Tools", summary.get("by_tool"))}'
                f'{_count_table("Countries", summary.get("by_country"), 5)}'
            )
        else:
            body = f'<p class="err">{_esc(summary.get("error") or "Unavailable")}</p>'
        cards.append(f'<section class="card"><h2>{_esc(panel["label"])}</h2>{body}</section>')

    latest.sort(key=lambda item: str(item[1].get("ts") or ""), reverse=True)
    table_rows = _event_rows_multi(latest[:40])
    inner = f"""
    <header>
      <div>
        <h1>Usage</h1>
        <p>PDF tools, image editor, and LiveTranslate. Not shown on the public site.</p>
      </div>
      <form method="post" action="/internal/usage/logout">
        <button class="ghost" type="submit">Sign out</button>
      </form>
    </header>
    <div class="grid">{''.join(cards)}</div>
    <section class="panel section">
      <h2>Events by day</h2>
      {_bars(merged_days) or '<p>No events yet.</p>'}
    </section>
    <section class="panel section scroll">
      <h2>Latest</h2>
      <table>
        <thead><tr><th>Time (UTC)</th><th>App</th><th>Tool</th><th>Event</th><th>Country</th><th>Status</th><th>ms</th><th></th></tr></thead>
        <tbody>{table_rows or '<tr><td colspan="8">No events yet.</td></tr>'}</tbody>
      </table>
    </section>"""
    return _shell("Usage", inner)


def _event_rows_multi(items: list[tuple[str, dict[str, Any]]]) -> str:
    return "".join(_event_rows(label, [event]) for label, event in items)


def register_usage_dashboard(app) -> None:
    @app.get("/internal/usage", response_class=HTMLResponse)
    def usage_page(request: Request):
        if not usage_log.admin_token():
            return _page(_login_html("Set USAGE_ADMIN_TOKEN on the tools server, then recreate the container."), 503)
        if not _authed(request):
            return _page(_login_html())
        return _page(_dashboard_html(_load()))

    @app.post("/internal/usage/login")
    def usage_login(request: Request, token: str = Form("")):
        expected = usage_log.admin_token()
        if not expected:
            return _page(_login_html("Set USAGE_ADMIN_TOKEN on the tools server, then recreate the container."), 503)
        ip = usage_log.client_ip(request)
        if _limited(ip):
            return _page(_login_html("Too many attempts. Try again later."), 429)
        provided = _clean(token)
        if not provided or len(provided) != len(expected) or not hmac.compare_digest(provided, expected):
            _mark_fail(ip)
            return _page(_login_html("That token is not valid."), 401)
        response = RedirectResponse("/internal/usage", status_code=303, headers=_HEADERS)
        response.set_cookie(
            COOKIE,
            _seal(),
            httponly=True,
            secure=_secure_cookie(request),
            samesite="strict",
            max_age=60 * 60 * 12,
            path=COOKIE_PATH,
        )
        return response

    @app.post("/internal/usage/logout")
    def usage_logout():
        response = RedirectResponse("/internal/usage", status_code=303, headers=_HEADERS)
        response.delete_cookie(COOKIE, path=COOKIE_PATH)
        return response
