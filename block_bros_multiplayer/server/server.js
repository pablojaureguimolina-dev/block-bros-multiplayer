
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req,res) => {
  res.writeHead(200, {'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});
  res.end(JSON.stringify({name:'BLOCK BROS multiplayer server',status:'ok',players:players.size}));
});
const wss = new WebSocketServer({server});
const players = new Map();
const changedBlocks = new Map();

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}
function broadcast(data, except=null) {
  const encoded=JSON.stringify(data);
  for (const ws of wss.clients) if(ws!==except && ws.readyState===1) ws.send(encoded);
}
function safeName(s){return String(s||'Jugador').replace(/[<>\\u0000-\\u001f]/g,'').slice(0,16)||'Jugador';}

wss.on('connection', ws => {
  const id=crypto.randomUUID();
  ws.playerId=id;
  ws.on('message', raw => {
    if (raw.length > 12000) return;
    let m; try { m=JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m.type!=='string') return;
    if (m.type==='join') {
      const p={id,name:safeName(m.name),x:num(m.x),y:num(m.y,5),z:num(m.z,9),yaw:num(m.yaw)};
      players.set(id,p);
      send(ws,{type:'welcome',id,players:[...players.values()].filter(x=>x.id!==id),blocks:[...changedBlocks.values()]});
      broadcast({type:'player-joined',player:p},ws);
    } else if (m.type==='move') {
      const p=players.get(id); if(!p)return;
      p.x=clamp(num(m.x),-100,100);p.y=clamp(num(m.y,5),-20,100);p.z=clamp(num(m.z),-100,100);p.yaw=clamp(num(m.yaw),-100,100);
      broadcast({type:'player-moved',player:p},ws);
    } else if (m.type==='block-change') {
      const x=integer(m.x),y=integer(m.y),z=integer(m.z);
      if (x===null||y===null||z===null||Math.abs(x)>64||Math.abs(y)>64||Math.abs(z)>64) return;
      const key=`${x},${y},${z}`;
      if(m.action==='remove'){
        const b={action:'remove',x,y,z};changedBlocks.set(key,b);
        broadcast({type:'block-change',action:'remove',x,y,z},ws);
      } else if(m.action==='add' && ['grass','dirt','stone','wood','planks','leaves','sand','brick'].includes(m.blockType)){
        const b={action:'add',x,y,z,blockType:m.blockType};changedBlocks.set(key,b);
        broadcast({type:'block-change',action:'add',x,y,z,blockType:m.blockType},ws);
      }
    }
  });
  ws.on('close',()=>{
    players.delete(id);
    broadcast({type:'player-left',id});
  });
});
function num(v, fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function integer(v){const n=Number(v);return Number.isFinite(n)?Math.round(n):null;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
server.listen(PORT,'0.0.0.0',()=>console.log(`BLOCK BROS server listening on ${PORT}`));
