#!/bin/sh
cd "$(dirname "$0")"
echo Open http://127.0.0.1:8765
python3 -m http.server 8765
