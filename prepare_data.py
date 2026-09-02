#!/usr/bin/env python3
"""Download app UI, Leaflet, Israel-region SRTM3, and OSM tiles. Run once online."""
import math, os, time, zipfile, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
LAT0, LAT1 = 29.4, 34.7
LON0, LON1 = 34.2, 36.7
ZMIN, ZMAX = 6, 11

def get(url, dest):
    folder = os.path.dirname(dest)
    if folder:
        os.makedirs(folder, exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print("have", dest)
        return True
    req = urllib.request.Request(url, headers={"User-Agent": "flight-planner-offline/1.0 (personal offline cache)"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
            f.write(r.read())
        print("OK", dest)
        return True
    except Exception as e:
        print("FAIL", url, e)
        if os.path.exists(dest):
            os.remove(dest)
        return False

def deg2num(lat, lon, z):
    lat = max(-85.05, min(85.05, lat))
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return x, y

def download_leaflet():
    base = "https://unpkg.com/leaflet@1.9.4/dist"
    d = os.path.join(ROOT, "vendor", "leaflet")
    get(base + "/leaflet.js", os.path.join(d, "leaflet.js"))
    get(base + "/leaflet.css", os.path.join(d, "leaflet.css"))
    get(base + "/images/marker-icon.png", os.path.join(d, "images", "marker-icon.png"))
    get(base + "/images/marker-icon-2x.png", os.path.join(d, "images", "marker-icon-2x.png"))
    get(base + "/images/marker-shadow.png", os.path.join(d, "images", "marker-shadow.png"))

def download_srtm():
    dest_dir = os.path.join(ROOT, "srtm")
    os.makedirs(dest_dir, exist_ok=True)
    for lat in range(int(math.floor(LAT0)), int(math.floor(LAT1)) + 1):
        for lon in range(int(math.floor(LON0)), int(math.floor(LON1)) + 1):
            name = "N%02dE%03d" % (lat, lon)
            dest = os.path.join(dest_dir, name + ".hgt")
            if os.path.exists(dest) and os.path.getsize(dest) > 1000:
                print("have", dest)
                continue
            ok = False
            for folder in ("Africa", "Eurasia"):
                url = "https://terrain.ardupilot.org/SRTM3/%s/%s.hgt.zip" % (folder, name)
                zpath = dest + ".zip"
                if get(url, zpath):
                    try:
                        with zipfile.ZipFile(zpath) as zf:
                            for n in zf.namelist():
                                if n.lower().endswith(".hgt"):
                                    with zf.open(n) as src, open(dest, "wb") as out:
                                        out.write(src.read())
                                    ok = True
                                    break
                    except Exception as e:
                        print("unzip fail", name, e)
                    try:
                        os.remove(zpath)
                    except Exception:
                        pass
                if ok:
                    break
                time.sleep(0.2)
            if not ok:
                print("missing SRTM", name)

def download_tiles():
    tdir = os.path.join(ROOT, "tiles")
    os.makedirs(tdir, exist_ok=True)
    count = 0
    for z in range(ZMIN, ZMAX + 1):
        x0, y1 = deg2num(LAT0, LON0, z)
        x1, y0 = deg2num(LAT1, LON1, z)
        if x0 > x1: x0, x1 = x1, x0
        if y0 > y1: y0, y1 = y1, y0
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                dest = os.path.join(tdir, str(z), str(x), str(y) + ".png")
                url = "https://tile.openstreetmap.org/%d/%d/%d.png" % (z, x, y)
                if get(url, dest):
                    count += 1
                time.sleep(0.15)
    print("tiles downloaded/kept:", count)

def download_app():
    raw = "https://raw.githubusercontent.com/orenba83/flight-planner/master/docs/"
    get(raw + "flight-planner.js", os.path.join(ROOT, "flight-planner.js"))
    get(raw + "fix.js", os.path.join(ROOT, "fix.js"))
    idx = os.path.join(ROOT, "index.html")
    get(raw + "index.html", idx)
    if os.path.exists(idx):
        t = open(idx, encoding="utf-8").read()
        t = t.replace("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "vendor/leaflet/leaflet.css")
        t = t.replace("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "vendor/leaflet/leaflet.js")
        if "offline.js" not in t:
            t = t.replace('<script src="fix.js"></script>', '<script src="fix.js"></script>\n<script src="offline.js"></script>')
        open(idx, "w", encoding="utf-8").write(t)

if __name__ == "__main__":
    print("Preparing offline data into", ROOT)
    download_app()
    download_leaflet()
    download_srtm()
    print("Downloading OSM tiles z%d-%d. This takes a while." % (ZMIN, ZMAX))
    download_tiles()
    print("Done. Copy this folder to the offline PC and run run_offline.bat")
