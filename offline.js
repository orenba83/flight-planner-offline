(function(){
  const TILE_URL='tiles/{z}/{x}/{y}.png';
  const SRTM_DIR='srtm/';
  const hgtCache={};
  function pad(n,w){return String(Math.abs(n)).padStart(w,'0')}
  function tileName(lat,lng){
    const n=Math.floor(lat), e=Math.floor(lng);
    return (lat>=0?'N':'S')+pad(n,2)+(lng>=0?'E':'W')+pad(e,3);
  }
  map.eachLayer(function(layer){
    if(layer instanceof L.TileLayer) map.removeLayer(layer);
  });
  L.tileLayer(TILE_URL,{maxZoom:14,minZoom:5,attribution:'Local OSM tiles'}).addTo(map);
  async function loadHgt(name){
    if(hgtCache[name]!==undefined) return hgtCache[name];
    try{
      const res=await fetch(SRTM_DIR+name+'.hgt');
      if(!res.ok){hgtCache[name]=null;return null;}
      const buf=await res.arrayBuffer();
      const size=Math.round(Math.sqrt(buf.byteLength/2));
      hgtCache[name]={view:new DataView(buf),size:size};
      return hgtCache[name];
    }catch(e){hgtCache[name]=null;return null;}
  }
  function sampleHgt(tile,lat,lng){
    if(!tile) return 0;
    const n=Math.floor(lat), e=Math.floor(lng);
    const size=tile.size;
    const row=Math.max(0,Math.min(size-1,Math.round((1-(lat-n))*(size-1))));
    const col=Math.max(0,Math.min(size-1,Math.round((lng-e)*(size-1))));
    const v=tile.view.getInt16((row*size+col)*2,false);
    if(v<=-32768||v>9000) return 0;
    return v;
  }
  fetchElevations=async function(points){
    const need=[];
    for(const p of points){
      const k=p.lat.toFixed(4)+','+p.lng.toFixed(4);
      if(!(k in elevCache)) need.push(p);
    }
    const names={};
    for(const p of need) names[tileName(p.lat,p.lng)]=1;
    for(const name of Object.keys(names)) await loadHgt(name);
    let hits=0;
    for(const p of need){
      const tile=hgtCache[tileName(p.lat,p.lng)];
      elevCache[p.lat.toFixed(4)+','+p.lng.toFixed(4)]=sampleHgt(tile,p.lat,p.lng);
      if(tile) hits++;
    }
    if(!hits) throw new Error('No local SRTM tiles in /srtm. Run prepare_data.py first.');
    return 'Local SRTM';
  };
})();
