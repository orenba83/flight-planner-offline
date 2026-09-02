(function(){
  let liveLayer=null, sketchLayer=null;
  const Sketch=L.GridLayer.extend({
    createTile:function(coords){
      const t=document.createElement('canvas');
      const s=this.getTileSize();
      t.width=s.x; t.height=s.y;
      const g=t.getContext('2d');
      g.fillStyle='#cfe0c6'; g.fillRect(0,0,s.x,s.y);
      const nw=this._map.unproject([coords.x*s.x, coords.y*s.y], coords.z);
      const se=this._map.unproject([(coords.x+1)*s.x,(coords.y+1)*s.y], coords.z);
      const self=this;
      function xy(lat,lng){const p=self._map.project([lat,lng], coords.z);return [p.x-coords.x*s.x, p.y-coords.y*s.y];}
      g.fillStyle='#9bbf8a'; g.beginPath();
      [[33.3,34.9],[33.1,35.6],[32.7,35.1],[32.2,35.4],[31.6,35.4],[31.2,35.3],[30.9,35.4],[29.6,34.9],[31.5,34.4],[32.2,34.6],[32.8,34.9],[33.3,34.9]].forEach(function(pt,i){const q=xy(pt[0],pt[1]); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});
      g.closePath(); g.fill();
      g.fillStyle='#b7d4ea'; g.beginPath();
      [[33.2,34.2],[32.0,34.3],[31.0,34.2],[32.2,35.0],[33.4,35.2]].forEach(function(pt,i){const q=xy(pt[0],pt[1]); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});
      g.fill();
      g.strokeStyle='rgba(40,60,40,.35)'; g.lineWidth=1;
      const step=coords.z>=9?0.25:coords.z>=7?0.5:1;
      for(let lat=Math.floor(se.lat);lat<=Math.ceil(nw.lat);lat+=step){const a=xy(lat,nw.lng),b=xy(lat,se.lng);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
      for(let lon=Math.floor(nw.lng);lon<=Math.ceil(se.lng);lon+=step){const a=xy(nw.lat,lon),b=xy(se.lat,lon);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
      g.fillStyle='rgba(30,40,30,.55)'; g.font='11px sans-serif'; g.fillText('Sketch · flat world',8,16);
      return t;
    }
  });
  function showSketch(){
    if(liveLayer){map.removeLayer(liveLayer);liveLayer=null;}
    if(!sketchLayer) sketchLayer=new Sketch({maxZoom:18,minZoom:4});
    if(!map.hasLayer(sketchLayer)) sketchLayer.addTo(map);
  }
  function showReal(){
    if(sketchLayer) map.removeLayer(sketchLayer);
    map.eachLayer(function(layer){if(layer instanceof L.TileLayer) map.removeLayer(layer);});
    liveLayer=L.tileLayer('/tiles/{z}/{x}/{y}.png',{maxZoom:18,minZoom:2,attribution:'Imported map'});
    liveLayer.addTo(map);
  }
  map.eachLayer(function(layer){if(layer instanceof L.TileLayer) map.removeLayer(layer);});
  showSketch();
  const box=document.createElement('div');
  box.id='importMapBox';
  box.innerHTML='<button type="button" id="importMapBtn">Import map</button><div id="importMapPanel" style="display:none"><label>Format</label><select id="mapType"><option value="mbtiles">MBTiles (.mbtiles)</option><option value="xyz">XYZ folder (z/x/y.png)</option></select><label>Full path on this PC</label><input id="mapPath" type="text" placeholder="D:\\maps\\israel.mbtiles"><button type="button" id="mapApply">Load real map</button><button type="button" id="mapSketch" style="margin-top:6px;background:#475569">Back to sketch / flat</button><div class="hint" id="mapStatus">No real map. Sketch background + flat terrain (0 m).</div></div>';
  document.body.appendChild(box);
  const css=document.createElement('style');
  css.textContent='#importMapBox{position:fixed;left:12px;bottom:16px;z-index:1000;width:230px}#importMapBtn{width:100%;border:0;border-radius:12px;padding:10px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer}#importMapPanel{margin-top:8px;background:#121a2b;border:1px solid #2a364c;border-radius:12px;padding:10px;color:#e8eef7;font-size:12px}#importMapPanel input,#importMapPanel select{width:100%;margin:4px 0 8px;padding:7px;border-radius:8px;border:1px solid #2a364c;background:#0d1524;color:#e8eef7}#mapApply,#mapSketch{width:100%;border:0;border-radius:8px;padding:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}#importMapPanel .hint{color:#93a0b5;margin-top:6px}';
  document.head.appendChild(css);
  const panel=document.getElementById('importMapPanel');
  document.getElementById('importMapBtn').onclick=function(){panel.style.display=panel.style.display==='none'?'block':'none'};
  document.getElementById('mapSketch').onclick=function(){showSketch();document.getElementById('mapStatus').textContent='Sketch + flat terrain. Analysis works without DTM.';};
  document.getElementById('mapApply').onclick=async function(){
    const path=document.getElementById('mapPath').value.trim();
    const type=document.getElementById('mapType').value;
    const st=document.getElementById('mapStatus');
    if(!path){st.textContent='Enter a full path';return;}
    try{
      const r=await fetch('/api/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,path:path})});
      const j=await r.json();
      if(!j.ok){st.textContent=j.error||'Failed';return;}
      st.textContent='Real map: '+j.map.path; showReal(); map.invalidateSize();
    }catch(e){st.textContent='Start with run_offline.bat to load a file from disk.';}
  };
  const _params=params;
  params=function(){const p=_params(); p.useDtm=false; return p;};
  fetchElevations=async function(points){
    for(const p of points){const k=p.lat.toFixed(4)+','+p.lng.toFixed(4); if(!(k in elevCache)) elevCache[k]=0;}
    return 'Flat (no DTM)';
  };
  const _build=buildDem;
  buildDem=async function(bounds,nx,ny){
    try{ await _build(bounds,nx,ny); }
    catch(e){
      const minLat=bounds.getSouth(),maxLat=bounds.getNorth(),minLng=bounds.getWest(),maxLng=bounds.getEast();
      dem={minLat:minLat,minLng:minLng,dLat:(maxLat-minLat)/Math.max(1,ny-1),dLng:(maxLng-minLng)/Math.max(1,nx-1),nx:nx,ny:ny,data:new Float32Array(nx*ny)};
      demStats={min:0,max:0,mean:0}; dtmSource='Flat';
    }
  };
})();
