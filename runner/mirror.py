"""Mirror a published single-page site (HTML + JS/CSS + assets referenced from them) into a local folder.

Usage: python3 runner/mirror.py https://example.replit.app sites/<brief>--<tool>
"""
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ASSET = re.compile(r"""["'(]((?:\.{0,2}/)?[A-Za-z0-9_\-./]+\.(?:js|mjs|css|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|json|txt))(?:\?[^"')\s]*)?["')]""")


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "webgen-bench-mirror/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def main() -> None:
    base, out = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
    host = urllib.parse.urlparse(base).netloc
    out.mkdir(parents=True, exist_ok=False)
    queue, seen = ["index.html"], set()
    while queue:
        path = queue.pop(0).lstrip("/")
        if path in seen or ".." in path or not path:
            continue
        seen.add(path)
        try:
            body = fetch(urllib.parse.urljoin(base, path))
        except Exception as error:  # missing optional assets are reported, not fatal
            print(f"skip {path}: {error}")
            continue
        target = out / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        if re.search(r"\.(html|js|mjs|css)$", path):
            text = body.decode("utf-8", "replace")
            for match in ASSET.finditer(text):
                ref = match.group(1)
                if ref.startswith("http") or "node_modules" in ref:
                    continue
                resolved = urllib.parse.urlparse(urllib.parse.urljoin(urllib.parse.urljoin(base, path), ref))
                if resolved.netloc == host:
                    queue.append(resolved.path)
    print(f"mirrored {len(seen)} paths into {out}")


if __name__ == "__main__":
    main()
