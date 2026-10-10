(() => {
'use strict';

/* ===== Util & layar ===== */
const $ = s => document.querySelector(s);
const SCREENS = ['menu', 'diff', 'vs', 'join', 'lobby', 'game'];
let inGame = false, raf = 0;
const show = id => {
  SCREENS.forEach(s => $('#' + s).hidden = s !== id);
  $('#result').hidden = true;
  inGame = id === 'game';
  if (inGame && !raf) raf = requestAnimationFrame(frame);
};
let tt;
const toast = m => {
  const t = $('#toast'); t.textContent = m; t.hidden = false;
  clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 3200);
};

/* ===== Konstanta game ===== */
const W = 640, H = 360, LANE_Y0 = 108, LANE_H = 60, X0 = 48, X1 = 572;
const HOP_DUR = 0.36;      // detik per lompatan
const HOP_GOOD = 0.048;    // jarak jika tombol "∆" kiri-kanan bergantian
const HOP_BAD = 0.032;     // jarak jika menekan tombol yang sama berulang
const HOP_H = 22;          // tinggi lompatan (piksel)
const LV = {
  mudah:  { gap: 700, jit: 200, mis: 0.30 },
  sedang: { gap: 500, jit: 100, mis: 0.12 },
  sulit:  { gap: 400, jit: 40,  mis: 0.03 }
};
const COLORS = ['#d62828', '#1f6feb', '#f2b705', '#f5f5f5'];

/* ===== Sprite pixel (12x15, diperbesar 3x) ===== */
const SPR = [
  '....HHHH....',
  '...HHHHHH...',
  '...SSSSSS...',
  '...SESSES...',
  '...SSSSSS...',
  '....SSSS....',
  '..CCCCCCCC..',
  '.SCCCCCCCCS.',
  '.SDBBBBBBDS.',
  '..DBBBBBBD..',
  '..DBBBBBBD..',
  '..DBBBBBBD..',
  '..DBBBBBBD..',
  '..DBBBBBBD..',
  '...DDDDDD...'
];
function makeSprite(shirt) {
  const c = document.createElement('canvas'); c.width = 12; c.height = SPR.length;
  const g = c.getContext('2d');
  const pal = { H: '#3b2314', S: '#f1c27d', E: '#1a1a1a', C: shirt, B: '#c28f45', D: '#6e4a1e' };
  SPR.forEach((row, y) => [...row].forEach((ch, x) => {
    if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }
  }));
  return c;
}
const SP = COLORS.map(makeSprite);

/* ===== State ===== */
let mode = 'ai';           // 'ai' | 'host' | 'guest'
let phase = 'idle';        // idle | lobby | count | race | done
let players = [], mySlot = 0, curLv = 'sedang';
let countEnd = 0, raceAt = 0, finished = 0, firstAt = 0;
let peer = null, hostConn = null, conns = [null, null, null, null], roomCode = '';

const newPlayer = (slot, ai, cfg) => ({
  slot, ai, cfg, x: 0, dx: 0, hopT: -1, hopDist: 0, last: -1, buf: null, rank: 0, gone: false, wait: 600
});
const nameOf = p => mode === 'ai'
  ? (p.slot === 0 ? 'Kamu' : 'Bot ' + p.slot)
  : (p.slot === mySlot ? 'Kamu' : 'P' + (p.slot + 1));

/* ===== Simulasi ===== */
function hop(p, b) {
  if (p.rank || p.gone) return;
  if (p.hopT >= 0) { if (!p.ai) p.buf = b; return; }
  p.hopDist = p.last === b ? HOP_BAD : HOP_GOOD;
  p.last = b; p.hopT = 0; p.buf = null;
}

function step(dt) {
  for (const p of players) {
    if (p.rank || p.gone) continue;
    if (p.ai) {
      p.wait -= dt * 1000;
      if (p.wait <= 0 && p.hopT < 0) {
        const c = p.cfg;
        hop(p, Math.random() < c.mis ? Math.max(p.last, 0) : (p.last === 0 ? 1 : 0));
        p.wait = c.gap + (Math.random() * 2 - 1) * c.jit;
      }
    }
    if (p.hopT >= 0) {
      const d = Math.min(dt, HOP_DUR - p.hopT);
      p.x = Math.min(1, p.x + p.hopDist * d / HOP_DUR);
      p.hopT += dt;
      if (p.x >= 1) {
        p.rank = ++finished; p.hopT = -1;
        if (!firstAt) firstAt = performance.now();
      } else if (p.hopT >= HOP_DUR) {
        p.hopT = -1;
        if (p.buf !== null) { const b = p.buf; p.buf = null; hop(p, b); }
      }
    }
  }
}

const snap = () => players.map(p => [+p.x.toFixed(4), +p.hopT.toFixed(3), p.rank]);

function checkEnd() {
  if (phase !== 'race') return;
  if (firstAt && performance.now() - firstAt > 8000) {   // sisa pemain diberi peringkat sesuai posisi
    players.filter(p => !p.rank && !p.gone).sort((a, b) => b.x - a.x).forEach(p => p.rank = ++finished);
  }
  if (players.some(p => !p.rank && !p.gone)) return;
  phase = 'done';
  if (mode === 'host') { broadcast({ t: 's', p: snap() }); broadcast({ t: 'end' }); }
  showResult();
}

function begin() {
  finished = 0; firstAt = 0; phase = 'count';
  countEnd = performance.now() + 3000;
  show('game');
}

/* ===== Loop ===== */
let lastT = 0, sendT = 0;
function frame(now) {
  if (!inGame) { raf = 0; return; }
  const dt = Math.min((now - lastT) / 1000 || 0, 0.05); lastT = now;
  if (phase === 'count' && now >= countEnd) { phase = 'race'; raceAt = now; }
  if (phase === 'race' && mode !== 'guest') {
    step(dt);
    if (mode === 'host') {
      sendT += dt;
      if (sendT >= 0.033) { sendT = 0; broadcast({ t: 's', p: snap() }); }
    }
    checkEnd();
  }
  for (const p of players) {
    if (mode === 'guest') {
      p.dx += (p.x - p.dx) * 0.4;
      if (p.hopT >= 0) p.hopT = Math.min(p.hopT + dt, HOP_DUR);
    } else p.dx = p.x;
  }
  draw(now);
  raf = requestAnimationFrame(frame);
}

/* ===== Gambar ===== */
const cv = $('#cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const FONT = '"Press Start 2P", monospace';

function label(t, x, y, size, color) {
  ctx.font = size + 'px ' + FONT; ctx.fillStyle = '#1b2a49'; ctx.fillText(t, x + 1, y + 1);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}

function draw(now) {
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#7cc6f2'; ctx.fillRect(0, 0, W, LANE_Y0);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    const cx = ((now / 90 + i * 230) % (W + 120)) - 60;
    ctx.fillRect(cx, 44 + i * 12, 48, 10); ctx.fillRect(cx + 10, 38 + i * 12, 28, 8);
  }
  for (let i = 0; i < W / 24; i++) {            // bendera 17-an
    ctx.fillStyle = i % 2 ? '#fff' : '#d62828';
    ctx.beginPath(); ctx.moveTo(i * 24, 8); ctx.lineTo(i * 24 + 24, 8); ctx.lineTo(i * 24 + 12, 32); ctx.fill();
  }
  ctx.fillStyle = '#1b2a49'; ctx.fillRect(0, 6, W, 3);

  for (let i = 0; i < 4; i++) {
    const y = LANE_Y0 + i * LANE_H;
    ctx.fillStyle = i % 2 ? '#3f9b45' : '#4caf50'; ctx.fillRect(0, y, W, LANE_H);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, y, W, 2);
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(X0 - 4, LANE_Y0, 3, LANE_H * 4);
  for (let r = 0; r < 30; r++) {                 // garis finis kotak-kotak
    ctx.fillStyle = r % 2 ? '#fff' : '#1b2a49'; ctx.fillRect(X1, LANE_Y0 + r * 8, 8, 8);
    ctx.fillStyle = r % 2 ? '#1b2a49' : '#fff'; ctx.fillRect(X1 + 8, LANE_Y0 + r * 8, 8, 8);
  }

  for (const p of players) {
    const ly = LANE_Y0 + p.slot * LANE_H, gy = ly + LANE_H - 8;
    const h = p.hopT >= 0 ? Math.sin(Math.PI * Math.min(p.hopT / HOP_DUR, 1)) * HOP_H : 0;
    const x = X0 + p.dx * (X1 - X0) - 18;
    const sw = 30 - h * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 18 - sw / 2, gy - 3, sw, 5);
    ctx.globalAlpha = p.gone ? 0.35 : 1;
    ctx.drawImage(SP[p.slot], x, gy - 45 - h, 36, 45);
    ctx.globalAlpha = 1;
    label(nameOf(p), 3, ly + 12, 8, '#fff');
    if (p.rank) label('#' + p.rank, X1 + 24, ly + LANE_H / 2, 12, '#fff');
  }

  const big = t => { ctx.textAlign = 'center'; label(t, W / 2, 200, 40, '#fff'); ctx.textAlign = 'left'; };
  if (phase === 'count') big(Math.max(1, Math.ceil((countEnd - now) / 1000)));
  else if (phase === 'race' && now - raceAt < 700) big('MULAI!');
}

/* ===== Hasil ===== */
function showResult() {
  const sorted = [...players].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  $('#rank').innerHTML = sorted.map((p, i) =>
    `<li class="${nameOf(p) === 'Kamu' ? 'me' : ''}">${i + 1}. ${nameOf(p)}${p.gone ? ' (keluar)' : ''}</li>`).join('');
  const me = players.find(p => p.slot === mySlot);
  $('#resTitle').textContent = me && me.rank === 1 ? 'Kamu menang!' : 'Hasil lomba';
  const a = $('#again');
  a.hidden = mode === 'guest';
  a.textContent = mode === 'host' ? 'Kembali ke lobby' : 'Main lagi';
  $('#result').hidden = false;
}

/* ===== Input ===== */
function tap(b) {
  if (phase !== 'race') return;
  if (mode === 'guest') { if (hostConn && hostConn.open) hostConn.send({ t: 'hop', b }); return; }
  const me = players.find(p => p.slot === mySlot);
  if (me) hop(me, b);
}
[['#padL', 0], ['#padR', 1]].forEach(([s, b]) =>
  $(s).addEventListener('pointerdown', e => { e.preventDefault(); tap(b); }));
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (['arrowleft', 'a', 'z'].includes(k)) tap(0);
  else if (['arrowright', 'd', 'x'].includes(k)) tap(1);
});

/* ===== Multiplayer (PeerJS, host sebagai pengatur) ===== */
const PFX = 'bkr-';
const broadcast = m => conns.forEach(c => c && c.open && c.send(m));
const occ = () => [0, 1, 2, 3].filter(s => s === 0 || conns[s]);

function leaveNet() {
  mode = 'ai'; phase = 'idle';
  try { conns.forEach(c => c && c.close()); if (hostConn) hostConn.close(); if (peer) peer.destroy(); } catch (e) {}
  conns = [null, null, null, null]; hostConn = null; peer = null;
}

function renderLobby(list) {
  $('#roomCode').textContent = roomCode;
  $('#count').textContent = list.length + '/4 pemain';
  $('#plist').innerHTML = list.map(s =>
    `<li>${s === mySlot ? 'Kamu' : 'P' + (s + 1)}${s === 0 ? ' (host)' : ''}</li>`).join('');
  $('#btnStart').hidden = mode !== 'host';
  $('#btnStart').disabled = list.length < 2;
  $('#hint').textContent = mode !== 'host' ? 'Menunggu host memulai…'
    : list.length < 2 ? 'Bagikan kode ke teman, tunggu minimal 1 pemain.' : 'Siap! Tekan Mulai.';
}

function sendLobby() {
  const list = occ();
  renderLobby(list);
  broadcast({ t: 'lobby', occ: list });
}

function createRoom(tries = 0) {
  if (typeof Peer === 'undefined') return toast('PeerJS gagal dimuat. Cek koneksi internet.');
  const c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
  peer = new Peer(PFX + c);
  peer.on('open', () => {
    mode = 'host'; phase = 'lobby'; mySlot = 0; roomCode = c;
    show('lobby'); sendLobby();
  });
  peer.on('connection', onGuest);
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && tries < 4) { peer.destroy(); createRoom(tries + 1); }
    else { toast('Gagal membuat room (' + e.type + ')'); leaveNet(); show('vs'); }
  });
}

function onGuest(conn) {
  conn.on('open', () => {
    const slot = [1, 2, 3].find(s => !conns[s]);
    if (phase !== 'lobby' || !slot) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); return; }
    conns[slot] = conn;
    conn.on('data', m => { if (m && m.t === 'hop' && phase === 'race') {
      const p = players.find(q => q.slot === slot); if (p) hop(p, m.b === 1 ? 1 : 0);
    } });
    conn.on('close', () => {
      conns[slot] = null;
      if (phase === 'lobby') sendLobby();
      else { const p = players.find(q => q.slot === slot); if (p) p.gone = true; }
    });
    conn.send({ t: 'welcome', slot });
    sendLobby();
  });
}

function joinRoom(c) {
  if (typeof Peer === 'undefined') return toast('PeerJS gagal dimuat. Cek koneksi internet.');
  roomCode = c;
  peer = new Peer();
  peer.on('open', () => {
    hostConn = peer.connect(PFX + c, { reliable: true });
    hostConn.on('data', onHostMsg);
    hostConn.on('close', () => {
      if (mode === 'guest') { toast('Host keluar dari room.'); leaveNet(); show('menu'); }
    });
  });
  peer.on('error', e => {
    toast(e.type === 'peer-unavailable' ? 'Room tidak ditemukan.' : 'Koneksi gagal (' + e.type + ')');
    leaveNet(); show('join');
  });
}

function onHostMsg(m) {
  if (!m) return;
  if (m.t === 'full') { toast('Room penuh atau sudah mulai.'); leaveNet(); show('join'); }
  else if (m.t === 'welcome') { mySlot = m.slot; mode = 'guest'; phase = 'lobby'; show('lobby'); }
  else if (m.t === 'lobby') { phase = 'lobby'; renderLobby(m.occ); show('lobby'); }
  else if (m.t === 'start') { players = m.occ.map(s => newPlayer(s, false)); begin(); }
  else if (m.t === 's') m.p.forEach((a, i) => { const p = players[i]; if (p) { p.x = a[0]; p.hopT = a[1]; p.rank = a[2]; } });
  else if (m.t === 'end') { phase = 'done'; showResult(); }
}

/* ===== Tombol menu ===== */
function startAI(lv) {
  curLv = lv; mode = 'ai'; mySlot = 0;
  players = [0, 1, 2, 3].map(s => newPlayer(s, s > 0, LV[lv]));
  begin();
}

$('#btnAI').onclick = () => show('diff');
document.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => startAI(b.dataset.lv));
$('#diffBack').onclick = () => show('menu');
$('#btnVS').onclick = () => show('vs');
$('#vsBack').onclick = () => show('menu');
$('#btnCreate').onclick = () => createRoom();
$('#btnJoin').onclick = () => { $('#codeIn').value = ''; show('join'); };
$('#joinBack').onclick = () => show('vs');
$('#joinGo').onclick = () => {
  const c = $('#codeIn').value.trim().toUpperCase();
  if (c.length !== 4) return toast('Kode room terdiri dari 4 huruf/angka.');
  joinRoom(c);
};
$('#btnStart').onclick = () => {
  const list = occ(); if (list.length < 2) return;
  players = list.map(s => newPlayer(s, false));
  broadcast({ t: 'start', occ: list });
  begin();
};
$('#btnLeave').onclick = () => { leaveNet(); show('vs'); };
$('#again').onclick = () => {
  if (mode === 'host') { phase = 'lobby'; show('lobby'); sendLobby(); }
  else startAI(curLv);
};
$('#toMenu').onclick = () => { leaveNet(); show('menu'); };

show('menu');
})();
