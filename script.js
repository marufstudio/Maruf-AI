import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCCbcnPSvYmVbPPORgMS9iLQLSmikFMxC0",
    authDomain: "maruf-ai-e1f6a.firebaseapp.com",
    projectId: "maruf-ai-e1f6a",
    storageBucket: "maruf-ai-e1f6a.firebasestorage.app",
    messagingSenderId: "353433246844",
    appId: "1:353433246844:web:8de60be28bd0b323a2fdf9",
    measurementId: "G-M1TXCS5YSB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

window.openLoginModal = () => document.getElementById('login-modal').classList.remove('hidden');
window.closeLoginModal = () => document.getElementById('login-modal').classList.add('hidden');

window.loginWithGoogle = async () => {
    try {
        await signInWithPopup(auth, provider);
        closeLoginModal();
    } catch (error) {
        alert("Login Failed: " + error.message);
    }
};

window.logoutUser = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    const navBadge = document.getElementById('auth-nav-badge');
    const userInfo = document.getElementById('workspace-user-info');
    if (user) {
        navBadge.innerHTML = `<span class="text-xs text-white bg-blue-600/50 px-3 py-1.5 rounded-full border border-blue-400">👤 ${user.displayName.split(' ')[0]}</span> <button onclick="logoutUser()" class="text-xs text-red-300 hover:underline">Logout</button>`;
        userInfo.innerHTML = `<span class="text-xs text-blue-700 font-semibold">${user.email}</span> <button onclick="logoutUser()" class="text-xs text-red-500 ml-2 underline">Logout</button>`;
    } else {
        navBadge.innerHTML = `<button onclick="openLoginModal()" class="text-xs font-medium px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shadow-md">Sign In</button>`;
        userInfo.innerHTML = `<span class="text-xs text-slate-500">Guest Mode</span> <button onclick="openLoginModal()" class="text-xs font-medium px-4 py-2 rounded-full bg-blue-600 text-white">Login</button>`;
    }
});

// =========================================================================
// THREE.JS 3D HERO STAGE & ORB ENGINES
// =========================================================================
let heroDroneGroup, rearPropeller, neonCurveStrip, coreBoost = 1;
let orbOuterShell, orbInnerCore;

function buildDroneGeometry() {
    const group = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(1.3, 64, 64);
    bodyGeo.scale(2.35, 0.72, 0.88);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x080c12, metalness: 0.8, roughness: 0.1, clearcoat: 1.0 });
    group.add(new THREE.Mesh(bodyGeo, bodyMat));

    const curveGeo = new THREE.TorusGeometry(1.38, 0.042, 32, 120);
    curveGeo.scale(1.95, 0.52, 0.96);
    const curveMat = new THREE.MeshBasicMaterial({ color: 0x0077ff });
    neonCurveStrip = new THREE.Mesh(curveGeo, curveMat);
    neonCurveStrip.rotation.x = Math.PI / 2.15;
    neonCurveStrip.rotation.y = -0.16;
    neonCurveStrip.position.set(0.25, -0.05, 0);
    group.add(neonCurveStrip);
    return { group };
}

function initHero3D() {
    const container = document.getElementById('hero-3d-canvas');
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 1000);
    camera.position.set(0, 0.25, 7.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const mainDrone = buildDroneGeometry();
    heroDroneGroup = mainDrone.group;
    heroDroneGroup.rotation.z = -0.14;
    heroDroneGroup.rotation.y = -0.32;
    scene.add(heroDroneGroup);

    scene.add(new THREE.DirectionalLight(0xffffff, 3.0));
    scene.add(new THREE.AmbientLight(0x94a3b8, 1.4));

    function animateHero() {
        requestAnimationFrame(animateHero);
        heroDroneGroup.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    animateHero();
}

function initWorkspace3DOrb() {
    const container = document.getElementById('orb-3d-canvas');
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 3.1;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const innerGeo = new THREE.SphereGeometry(0.82, 64, 64);
    const innerMat = new THREE.MeshPhysicalMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, roughness: 0.1 });
    orbInnerCore = new THREE.Mesh(innerGeo, innerMat);
    scene.add(orbInnerCore);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    function animateOrb() {
        requestAnimationFrame(animateOrb);
        orbInnerCore.rotation.y += 0.01;
        renderer.render(scene, camera);
    }
    animateOrb();
}

window.addEventListener('DOMContentLoaded', () => {
    initHero3D();
    initWorkspace3DOrb();
});

// =========================================================================
// GEMINI API & CHAT LOGIC
// =========================================================================
let activeMode = 'chat';

window.setMode = function(m) {
    activeMode = (activeMode === m) ? 'chat' : m;
    const map = { 'chat': 'Smart Chat (Gemini)', 'imagine': '🖼️ Imagine (3D Image Engine)', 'search': '🌐 Web Search', 'agent': '⚡ Agent Automation' };
    document.getElementById('mode-label').innerText = map[activeMode];
    ['imagine', 'search', 'agent'].forEach(id => {
        const btn = document.getElementById('mode-' + id);
        if (id === activeMode) btn.classList.add('active');
        else btn.classList.remove('active');
    });
};

function appendMsg(userText, aiHtml) {
    const box = document.getElementById('chat-output');
    box.classList.remove('hidden');
    const div = document.createElement('div');
    div.className = "bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm space-y-2 shadow-sm";
    div.innerHTML = `<div class="font-semibold text-slate-900">You: <span class="font-normal text-slate-600">${userText}</span></div><div class="text-slate-700 border-t border-slate-200/70 pt-2">${aiHtml}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

window.executeCommand = async function() {
    const inp = document.getElementById('ai-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';

    if (activeMode === 'imagine' || text.toLowerCase().startsWith('imagine ')) {
        const clean = text.replace(/^imagine /i, '');
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(clean + ', futuristic 3d studio render, 8k')}?width=512&height=512&nologo=true`;
        appendMsg(text, `<span class="text-blue-600 font-semibold">3D Visual Engine:</span> Rendering "${clean}"<br><img src="${url}" class="mt-2 rounded-xl shadow-md border border-slate-200 max-w-xs" alt="AI Render">`);
        return;
    } else if (activeMode === 'search') {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
        appendMsg(text, `🌐 Opened web search results for: <b>${text}</b>`);
        return;
    } else if (activeMode === 'agent') {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'MarufAI_Task.txt'; a.click();
        appendMsg(text, `⚡ <b>Agent Task Complete:</b> Output downloaded as file.`);
        return;
    }

    appendMsg(text, `<span class="text-slate-400 italic">Maruf AI is thinking...</span>`);
    const chatBox = document.getElementById('chat-output');
    const replyDiv = chatBox.lastElementChild.querySelector('.border-t');

    try {
        const apiKey = "AQ.Ab8RN6KFdW84axmHeGAKuLM5q_BG_lCQoYFJ7wHJiy2op9cHtg"; 
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
        });

        const data = await response.json();
        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || "No response generated.";
        replyDiv.innerHTML = `🤖 <b>Maruf AI:</b> ${aiReply.replace(/\n/g, '<br>')}`;
    } catch (err) {
        replyDiv.innerHTML = `❌ Error connecting to Gemini API: ${err.message}`;
    }
};

window.clearChat = function() {
    const box = document.getElementById('chat-output');
    box.innerHTML = ''; box.classList.add('hidden');
};
