#!/usr/bin/env python3
"""Local server: static files + imported map (MBTiles or XYZ folder). Stdlib only."""
import json, os, sqlite3, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(ROOT, "map-source.json")
os.chdir(ROOT)

def load_cfg():
    if os.path.exists(CFG):
        try:
            return json.load(open(CFG, encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_cfg(data):
    json.dump(data, open(CFG, "w", encoding="utf-8"), indent=2)

def tms_y(z, y):
    return (1 << int(z)) - 1 - int(y)

def tile_from_mbtiles(path, z, x, y):
    if not path or not os.path.isfile(path):
        return None, None
    con = sqlite3.connect("file:%s?mode=ro" % path.replace("\\", "/"), uri=True)
    try:
        cur = con.cursor()
        for row in (tms_y(z, y), y):
            cur.execute(
                "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=? LIMIT 1",
                (int(z), int(x), int(row)),
            )
            hit = cur.fetchone()
            if hit and hit[0]:
                blob = hit[0]
                mime = "image/jpeg" if blob[:2] == b"\xff\xd8" else "image/png"
                return blob, mime
        return None, None
    finally:
        con.close()

def tile_from_xyz(folder, z, x, y):
    if not folder or not os.path.isdir(folder):
        return None, None
    for name in ("%s/%s/%s.png" % (z, x, y), "%s/%s/%s.jpg" % (z, x, y), "%s/%s/%s.jpeg" % (z, x, y), "%s/%s/%s.webp" % (z, x, y)):
        p = os.path.join(folder, name.replace("/", os.sep))
        if os.path.isfile(p):
            ext = os.path.splitext(p)[1].lower()
            mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(ext, "image/png")
            return open(p, "rb").read(), mime
    return None, None

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))
    def _json(self, code, obj):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/map":
            self._json(200, {"ok": True, "map": load_cfg()})
            return
        if u.path.startswith("/tiles/"):
            parts = u.path.strip("/").split("/")
            if len(parts) == 4:
                _, zs, xs, ys = parts
                ys = ys.split(".")[0]
                try:
                    z, x, y = int(zs), int(xs), int(ys)
                except ValueError:
                    self.send_error(400); return
                cfg = load_cfg()
                kind = (cfg.get("type") or "").lower()
                path = cfg.get("path") or ""
                data = mime = None
                if kind == "mbtiles":
                    data, mime = tile_from_mbtiles(path, z, x, y)
                elif kind in ("xyz", "folder"):
                    data, mime = tile_from_xyz(path, z, x, y)
                if data:
                    self.send_response(200)
                    self.send_header("Content-Type", mime)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                self.send_response(404); self.end_headers(); return
        return SimpleHTTPRequestHandler.do_GET(self)
    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/api/map":
            self.send_error(404); return
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode("utf-8") if n else "{}"
        try:
            req = json.loads(body)
        except Exception:
            self._json(400, {"ok": False, "error": "bad json"}); return
        kind = (req.get("type") or "").lower()
        path = (req.get("path") or "").strip().strip('"')
        if kind not in ("mbtiles", "xyz", "folder"):
            self._json(400, {"ok": False, "error": "type must be mbtiles or xyz"}); return
        if not path or not os.path.exists(path):
            self._json(400, {"ok": False, "error": "path not found: " + path}); return
        if kind == "mbtiles" and not os.path.isfile(path):
            self._json(400, {"ok": False, "error": "mbtiles must be a file"}); return
        if kind in ("xyz", "folder") and not os.path.isdir(path):
            self._json(400, {"ok": False, "error": "xyz must be a folder"}); return
        cfg = {"type": "mbtiles" if kind == "mbtiles" else "xyz", "path": os.path.abspath(path)}
        save_cfg(cfg)
        self._json(200, {"ok": True, "map": cfg})

if __name__ == "__main__":
    port = 8765
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    print("Open http://127.0.0.1:%d" % port)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
