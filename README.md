# Flight Planner Offline

Separate clone of `orenba83/flight-planner` for air-gapped PCs. The original repo is unchanged.

Same browser UI (path, AOI, SNR, ellipse, ruler, save/load JSON). Map tiles and DTM are local.

## On a PC with internet (once)

```text
git clone https://github.com/orenba83/flight-planner-offline.git
cd flight-planner-offline
python prepare_data.py
```

This fills `vendor/leaflet/`, `srtm/` (Israel/Lebanon/Golan), and `tiles/` (OSM z6-11).

Copy the entire folder to a USB disk. Optionally add `flight-planner-config.json`.

## On the offline PC

Need only a normal Python 3 Windows installer on the USB. No pip packages to run the app.

```text
run_offline.bat
```

Open http://127.0.0.1:8765

Do not open index.html as a file.
