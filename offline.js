(function(){
  function useLocalTiles(){
    map.eachLayer(function(layer){
      if(layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    L.tileLayer('/tiles/{z}/{x}/{y}.png',{maxZoom:18,minZoom:2,attribution:'Imported map'}).addTo(map);
  }
  useLocalTiles();
  const box=document.createElement('div');
  box.id='importMapBox';
  box.innerHTML='<button type="button" id="importMapBtn">Import map</button>'
    +'<div id="importMapPanel" style="display:none">'
    +'<label>Format</label>'
    +'<select id="mapType"><option value="mbtiles">MBTiles (.mbtiles)</option><option value="xyz">XYZ folder (z/x/y.png)</option></select>'
    +'<label>Full path on this PC</label>'
    +'<input id="mapPath" type="text" placeholder="D:\\maps\\israel.mbtiles">'
    +'<button type="button" id="mapApply">Load</button>'
    +'<div class="hint" id="mapStatus">Map stays on disk. Only the path is saved.</div>'
    +'</div>';
  document.body.appendChild(box);
  const css=document.createElement('style');
  css.textContent='#importMapBox{position:fixed;left:12px;bottom:16px;z-index:1000;width:230px}'
    +'#importMapBtn{width:100%;border:0;border-radius:12px;padding:10px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer}'
    +'#importMapPanel{margin-top:8px;background:#121a2b;border:1px solid #2a364c;border-radius:12px;padding:10px;color:#e8eef7;font-size:12px}'
    +'#importMapPanel input,#importMapPanel select{width:100%;margin:4px 0 8px;padding:7px;border-radius:8px;border:1px solid #2a364c;background:#0d1524;color:#e8eef7}'
    +'#mapApply{width:100%;border:0;border-radius:8px;padding:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}'
    +'#importMapPanel .hint{color:#93a0b5;margin-top:6px}';
  document.head.appendChild(css);
  const panel=document.getElementById('importMapPanel');
  document.getElementById('importMapBtn').onclick=function(){panel.style.display=panel.style.display==='none'?'block':'none'};
  async function refreshMapInfo(){
    try{
      const r=await fetch('/api/map'); const j=await r.json();
      if(j&&j.map&&j.map.path){
        document.getElementById('mapPath').value=j.map.path;
        document.getElementById('mapType').value=j.map.type==='mbtiles'?'mbtiles':'xyz';
        document.getElementById('mapStatus').textContent='Loaded: '+j.map.type+' · '+j.map.path;
      }
    }catch(e){}
  }
  document.getElementById('mapApply').onclick=async function(){
    const path=document.getElementById('mapPath').value.trim();
    const type=document.getElementById('mapType').value;
    const st=document.getElementById('mapStatus');
    if(!path){st.textContent='Enter a full path';return;}
    try{
      const r=await fetch('/api/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,path:path})});
      const j=await r.json();
      if(!j.ok){st.textContent=j.error||'Failed';return;}
      st.textContent='Loaded: '+j.map.path;
      useLocalTiles(); map.invalidateSize();
    }catch(e){st.textContent='Start with run_offline.bat so the server can open the file.';}
  };
  refreshMapInfo();
  const hgtCache={};
  function pad(n,w){return String(Math.abs(n)).padStart(w,'0')}
  function tileName(lat,lng){const n=Math.floor(lat),e=Math.floor(lng);return (lat>=0?'N':'S')+pad(n,2)+(lng>=0?'E':'W')+pad(e,3)}
  async function loadHgt(name){
    if(hgtCache[name]!==undefined) return hgtCache[name];
    try{
      const res=await fetch('srtm/'+name+'.hgt');
      if(!res.ok){hgtCache[name]=null;return null;}
      const buf=await res.arrayBuffer();
      hgtCache[name]={view:new DataView(buf),size:Math.round(Math.sqrt(buf.byteLength/2))};
      return hgtCache[name];
    }catch(e){hgtCache[name]=null;return null;}
  }
  function sampleHgt(tile,lat,lng){
    if(!tile) return 0;
    const n=Math.floor(lat),e=Math.floor(lng),size=tile.size;
    const row=Math.max(0,Math.min(size-1,Math.round((1-(lat-n))*(size-1))));
    const col=Math.max(0,Math.min(size-1,Math.round((lng-e)*(size-1))));
    const v=tile.view.getInt16((row*size+col)*2,false);
    return (v<=-32768||v>9000)?0:v;
  }
  fetchElevations=async function(points){
    const need=points.filter(p=>!(p.lat.toFixed(4)+','+p.lng.toFixed(4) in elevCache));
    const names={}; need.forEach(function(p){names[tileName(p.lat,p.lng)]=1});
    for(const name of Object.keys(names)) await loadHgt(name);
    let hits=0;
    for(const p of need){
      const tile=hgtCache[tileName(p.lat,p.lng)];
      elevCache[p.lat.toFixed(4)+','+p.lng.toFixed(4)]=sampleHgt(tile,p.lat,p.lng);
      if(tile) hits++;
    }
    if(!hits) throw new Error('No local SRTM in /srtm');
    return 'Local SRTM';
  };
})();
