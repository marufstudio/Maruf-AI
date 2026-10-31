/* Maruf AI / MarufVision — home -> login -> protected chat */
'use strict';

const firebaseConfig = {
  apiKey: "AIzaSyCCbcnPSvYmVbPPORgMS9iLQLSmikFMxC0",
  authDomain: "maruf-ai-e1f6a.firebaseapp.com",
  projectId: "maruf-ai-e1f6a",
  storageBucket: "maruf-ai-e1f6a.firebasestorage.app",
  messagingSenderId: "353433246844",
  appId: "1:353433246844:web:8de60be28bd0b323a2fdf9",
  measurementId: "G-M1TXCS5YSB"
};
const apiKey = "AQ.Ab8RN6KFdW84axmHeGAKuLM5q_BG_lCQoYFJ7wHJiy2op9cHtg";
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { mode: 'chat', busy: false, history: [], user: null, authReady: false, energy: 0, pulse: 0, view: 'home' };

/* ---------- Router with auth guard ---------- */
function show(view) {
  state.view = view;
  ['home', 'login', 'app'].forEach((v) => $('view-' + v).classList.toggle('hidden', v !== view));
  window.scrollTo(0, 0);
  dispatchEvent(new Event('resize'));
  if (view === 'app') $('input').focus();
}
function route() {
  if (!state.authReady) return; // wait until Firebase knows who the user is
  const h = location.hash;
  if (h === '#app' || h === '#login') {
    if (state.user) { if (h !== '#app') location.replace('#app'); show('app'); }
    else { if (h !== '#login') location.replace('#login'); show('login'); }
  } else show('home');
}
addEventListener('hashchange', route);
document.querySelectorAll('.free-chat-btn').forEach((b) => b.addEventListener('click', () => { location.hash = state.user ? '#app' : '#login'; }));
$('back-home').addEventListener('click', () => { location.hash = ''; });

/* ---------- Auth ---------- */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
auth.onAuthStateChanged((user) => {
  const wasOut = !state.user;
  state.user = user;
  state.authReady = true;
  if (user) {
    $('user-name').textContent = user.displayName || 'Signed in';
    $('user-email').textContent = user.email || '';
    if (wasOut && state.view === 'login') location.hash = '#app';
    if (!$('chat').children.length) addMsg('ai', `Hi ${esc((user.displayName || '').split(' ')[0] || 'there')}, I'm Maruf AI. Pick a tool and ask me anything.`);
  } else {
    state.history = []; $('chat').innerHTML = '';
  }
  route();
});
$('google-btn').addEventListener('click', async () => {
  $('login-error').textContent = '';
  try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
  catch (e) {
    if (e.code === 'auth/popup-closed-by-user') return;
    $('login-error').textContent = e.code === 'auth/unauthorized-domain'
      ? 'This domain is not authorized. Add it in Firebase Console > Authentication > Settings > Authorized domains.'
      : `Sign-in failed (${e.code || e.message}). Try again.`;
  }
});
const logout = async () => { await auth.signOut(); location.hash = ''; };
$('logout-btn').addEventListener('click', logout);
$('logout-btn-m').addEventListener('click', logout);

/* ---------- Chat ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function md(s) {
  return esc(s)
    .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, '<pre class="bg-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 rounded px-1">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
function addMsg(role, html) {
  const d = document.createElement('div');
  d.className = role === 'user' ? 'flex justify-end' : 'flex';
  d.innerHTML = `<div class="${role === 'user' ? 'bubble-user' : 'bubble-ai'} max-w-[88%] sm:max-w-[75%] px-4 py-3 text-sm break-words">${html}</div>`;
  $('chat').appendChild(d);
  $('chat').scrollTop = $('chat').scrollHeight;
  return d.firstChild;
}
const typing = () => addMsg('ai', '<span class="dots"><span></span><span></span><span></span></span>');

const HINTS = {
  chat: 'Smart Chat: live answers from Gemini',
  imagine: 'Imagine: describe an image to generate',
  search: 'Search the Web: opens Google in a new tab',
  agent: 'Agent Mode: saves your task as a text file'
};
function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.tool').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === m)));
  $('mode-select').value = m;
  $('mode-hint').textContent = HINTS[m];
}
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('mode-select').addEventListener('change', (e) => setMode(e.target.value));
setMode('chat');

async function callGemini() {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: state.history })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const t = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      if (t) return t;
      throw new Error(data.promptFeedback?.blockReason ? 'The request was blocked by safety filters.' : 'Empty response.');
    }
    lastErr = data.error?.message || `HTTP ${res.status}`;
    if (res.status !== 404) break;
  }
  throw new Error(lastErr);
}

async function send() {
  const text = $('input').value.trim();
  if (!text || state.busy || !state.user) return;
  $('input').value = ''; $('input').style.height = 'auto';
  addMsg('user', esc(text));
  state.busy = true; state.energy = 1;
  try {
    if (state.mode === 'chat') {
      state.history.push({ role: 'user', parts: [{ text }] });
      const t = typing();
      try {
        const reply = await callGemini();
        state.history.push({ role: 'model', parts: [{ text: reply }] });
        t.innerHTML = md(reply);
      } catch (e) { state.history.pop(); t.innerHTML = `Couldn't get a reply: ${esc(e.message)}`; }
    } else if (state.mode === 'imagine') {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(text + ', 3D render, ultra detailed, HD')}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
      const b = addMsg('ai', '<span class="dots"><span></span><span></span><span></span></span> Generating image');
      const img = new Image(); img.alt = text; img.className = 'rounded-xl w-full max-w-sm mt-2';
      img.onload = () => { b.innerHTML = 'Here is your image.<br>'; b.appendChild(img); $('chat').scrollTop = $('chat').scrollHeight; };
      img.onerror = () => { b.textContent = "The image couldn't be generated. Try a different description."; };
      img.src = url;
    } else if (state.mode === 'search') {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank', 'noopener');
      addMsg('ai', `Opened Google results for <strong>${esc(text)}</strong> in a new tab.`);
    } else {
      const body = `Maruf AI Agent Task\nCreated: ${new Date().toISOString()}\nUser: ${state.user.email}\n\nTask:\n${text}\n`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
      a.download = `maruf-agent-task-${Date.now()}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      addMsg('ai', 'Task saved as a text file and downloaded.');
    }
  } finally { state.busy = false; state.energy = 0; }
}
$('send').addEventListener('click', send);
$('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
$('input').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; });

/* ---------- 3D: hero hardware core ---------- */
function initHero() {
  const canvas = $('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100); cam.position.set(0, 1.1, 8);
  scene.add(new THREE.AmbientLight(0x303050, 1.2));
  const l1 = new THREE.PointLight(0x8fd3ff, 2.2, 30); l1.position.set(-5, 3, 4);
  const l2 = new THREE.PointLight(0x7c5cff, 2.4, 30); l2.position.set(5, 2, 3);
  const l3 = new THREE.PointLight(0xffffff, 1.1, 30); l3.position.set(0, 6, -3);
  scene.add(l1, l2, l3);

  const core = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x1a1b28, metalness: 0.95, roughness: 0.2 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x8fd3ff }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 48), new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.9 }));
  const rings = [1.9, 2.3, 2.7].map((r, i) => {
    const c = i === 1 ? 0x7c5cff : 0x8fd3ff;
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 16, 120), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.3 }));
    t.rotation.set(Math.PI / 2 + i * 0.5, i * 0.7, 0); return t;
  });
  const vent = new THREE.MeshBasicMaterial({ color: 0x8fd3ff });
  for (let i = -2; i <= 2; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.02), vent); v.position.set(0, i * 0.3, 1.21);
    const v2 = v.clone(); v2.position.z = -1.21; core.add(v, v2);
  }
  core.add(body, edges, glow, ...rings); scene.add(core);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x08080f, metalness: 1, roughness: 0.18 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.3; scene.add(floor);
  const grid = new THREE.GridHelper(28, 56, 0x7c5cff, 0x1c1a40); grid.position.y = -2.29; grid.material.transparent = true; grid.material.opacity = 0.3; scene.add(grid);

  let drag = false, px = 0, py = 0, vx = 0.004, moved = 0;
  canvas.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; py = e.clientY; moved = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    vx = dx * 0.006; core.rotation.y += vx; core.rotation.x = Math.max(-1.1, Math.min(1.1, core.rotation.x + dy * 0.006));
  });
  canvas.addEventListener('pointerup', () => { drag = false; if (moved < 6) state.pulse = 1; });

  const wm = $('watermark'); let mx = 0, my = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.position.z = w < 640 ? 11 : 8; cam.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (state.view !== 'home') return;
    const t = clock.getElapsedTime();
    if (!drag) { core.rotation.y += vx; vx += (0.003 - vx) * 0.02; core.rotation.x *= 0.98; }
    if (!reduceMotion) core.position.y = Math.sin(t * 1.2) * 0.18 + 0.2;
    state.pulse *= 0.93; core.scale.setScalar(1 + state.pulse * 0.18);
    glow.material.opacity = 0.65 + Math.sin(t * 3) * 0.2 + state.pulse * 0.3;
    glow.scale.setScalar(1 + Math.sin(t * 3) * 0.04 + state.pulse * 0.4);
    rings.forEach((r, i) => { r.rotation.z += 0.004 * (i + 1) * (i % 2 ? -1 : 1); });
    l1.position.x = -5 + mx * 4; l2.position.x = 5 + mx * 4;
    wm.style.transform = `translate(calc(-50% + ${mx * -50}px), calc(-50% + ${my * -24}px))`;
    renderer.render(scene, cam);
  })();
}

/* ---------- 3D: crystal orb (login + chat header) ---------- */
function initOrb(canvas, viewName, reactive) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50); cam.position.z = 5;
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const a = new THREE.PointLight(0x8fd3ff, 2, 20); a.position.set(3, 2, 4);
  const b = new THREE.PointLight(0x7c5cff, 2, 20); b.position.set(-3, -2, 3);
  scene.add(a, b);
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshPhysicalMaterial({ color: 0xc9b8ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.6, flatShading: true }));
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, wireframe: true, transparent: true, opacity: 0.35 }));
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x7c5cff, emissiveIntensity: 1.2 }));
  const orb = new THREE.Group(); orb.add(crystal, wire, inner); scene.add(orb);
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  let e = 0; const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (state.view !== viewName) return;
    const t = clock.getElapsedTime();
    e += ((reactive ? state.energy : 0) - e) * 0.06;
    orb.rotation.y += 0.005 + e * 0.04; orb.rotation.x = Math.sin(t * 0.5) * 0.2;
    orb.position.y = reduceMotion ? 0 : Math.sin(t * 1.4) * 0.08;
    inner.rotation.y -= 0.02 + e * 0.1; inner.rotation.x += 0.015;
    crystal.scale.setScalar(1 + e * 0.1 + Math.sin(t * 6) * 0.03 * e);
    renderer.render(scene, cam);
  })();
}

try { initHero(); initOrb($('login-orb'), 'login', false); initOrb($('app-orb'), 'app', true); }
catch (err) { console.error('WebGL unavailable', err); }
