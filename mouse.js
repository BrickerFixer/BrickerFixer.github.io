// ==========================================
// Tactile Cursor — stretch + squish + morph
// ==========================================

document.documentElement.style.cursor = "none";

const GRV = {
    white: [235, 219, 178],
    yellow: [250, 189, 47],
    blue: [131, 165, 152],
    green: [184, 187, 38],
    red: [251, 73, 52],
};

const cursor = document.createElement("div");
Object.assign(cursor.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "999999",
    left: "0",
    top: "0",
    willChange: "transform, width, height, border-radius, background",
    transformOrigin: "center center",
    opacity: "1",
});
document.body.appendChild(cursor);

const cursorDress = document.createElement("div");
Object.assign(cursorDress.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "1000000",
    left: "0",
    top: "0",
    width: "28px",
    height: "18px",
    opacity: "0",
    willChange: "transform, opacity",
    transformOrigin: "50% 10%",
});
cursorDress.innerHTML = `
    <div style="
        position:absolute;left:0;top:0;width:28px;height:18px;
        background:#d3869b;clip-path:polygon(22% 0,78% 0,100% 100%,0 100%);
        border-radius:3px;
    "></div>
`;
document.body.appendChild(cursorDress);

// ==========================================
// Audio
// ==========================================

const audioCtx = new AudioContext();
let tapeBuffer = null;
let tapeSource = null;
let tapeGain = null;

fetch("tape.ogg")
    .then(r => r.arrayBuffer())
    .then(d => audioCtx.decodeAudioData(d))
    .then(buf => { tapeBuffer = buf; });

function startTape() {
    if (!tapeBuffer || tapeSource) return;
    tapeSource = audioCtx.createBufferSource();
    tapeGain = audioCtx.createGain();
    tapeSource.buffer = tapeBuffer;
    tapeSource.loop = true;
    tapeSource.connect(tapeGain);
    tapeGain.connect(audioCtx.destination);
    tapeGain.gain.value = 0;
    tapeSource.playbackRate.value = 1;
    tapeSource.start();
}

document.addEventListener("pointerdown", () => {
    audioCtx.resume();
    startTape();
}, { once: true });

function playClickCutoff() {
    if (!tapeBuffer) return;

    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    const t = audioCtx.currentTime;

    src.buffer = tapeBuffer;
    src.playbackRate.value = 0.72 + Math.random() * 0.7;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200 + Math.random() * 1800, t);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.075);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.55 + Math.random() * 0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    src.start(0, Math.random() * tapeBuffer.duration, 0.1);
}

// ==========================================
// Helpers
// ==========================================

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
}

function lerpColor(a, b, t) {
    return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t)),
    ];
}

function rgbStr([r, g, b]) { return `rgb(${r},${g},${b})`; }

// ==========================================
// Mode Detection
// ==========================================

const MODE = { DEFAULT: 0, TEXT: 1, CONTROL: 2 };
let mode = MODE.DEFAULT;
let magnetTarget = null;
let caretSnap = null;

function isControlLike(el) {
    if (!el) return false;
    const tag = el.tagName;
    const role = el.getAttribute("role");
    return ["BUTTON", "A"].includes(tag) ||
        role === "button" ||
        el.classList.contains("chip");
}

function getCursorRole(el) {
    if (!el) return "default";
    if (el.dataset.cursorRole) return el.dataset.cursorRole;
    if (el.classList.contains("chip")) return "chip";
    if (isControlLike(el)) return "button";
    return "default";
}

function hasDirectText(el) {
    if (!el) return false;
    for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) return true;
    }
    return false;
}

function detectMode(mx, my) {
    const el = document.elementFromPoint(mx, my);

    if (isControlLike(el)) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const brRaw = parseFloat(style.borderRadius) || 8;
        mode = MODE.CONTROL;
        magnetTarget = {
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2,
            w: rect.width,
            h: rect.height,
            r: Math.min(brRaw, rect.height / 2),
            role: getCursorRole(el),
            element: el,
        };
        caretSnap = null;
        return;
    }

    magnetTarget = null;

    if (el && hasDirectText(el)) {
        mode = MODE.TEXT;
        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(mx, my);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(mx, my);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
            }
        }

        if (range) {
            const r = range.getBoundingClientRect();
            const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
            caretSnap = { x: r.left, h: lh };
        }
        return;
    }

    caretSnap = null;
    mode = MODE.DEFAULT;
}

// ==========================================
// Cursor State
// ==========================================

let mouseX = innerWidth / 2;
let mouseY = innerHeight / 2;
let rawVx = 0;
let rawVy = 0;
let rx = mouseX;
let ry = mouseY;
let rw = 16;
let rh = 16;
let rbr = 8;
let rAngle = 0;
let rColor = [...GRV.white];
let lastVx = 0;
let lastVy = 0;
let tapeEnergy = 0;
let isDown = false;
let squish = 0;
let clickFlash = 0;
let isHumiliated = false;

document.addEventListener("mousemove", e => {
    rawVx = e.clientX - mouseX;
    rawVy = e.clientY - mouseY;
    mouseX = e.clientX;
    mouseY = e.clientY;
    detectMode(mouseX, mouseY);
});

document.addEventListener("mousedown", () => {
    isDown = true;
    clickFlash = 1;
    playClickCutoff();
    if (tapeGain) {
        tapeGain.gain.cancelScheduledValues(audioCtx.currentTime);
        tapeGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
});

document.addEventListener("mouseup", () => {
    isDown = false;
});

document.addEventListener("cursor:dress-of-humiliation", () => {
    isHumiliated = true;
    clickFlash = 1;
});

// ==========================================
// Animation Loop
// ==========================================

const LERP_POS_DEFAULT = 0.18;
const LERP_POS_CONTROL = 0.11;
const LERP_POS_TEXT = 0.22;
const LERP_SHAPE = 0.13;
const LERP_COLOR = 0.14;

function animate() {
    const dx = mouseX - rx;
    const dy = mouseY - ry;
    const vx = dx;
    const vy = dy;
    const ax = vx - lastVx;
    const ay = vy - lastVy;
    const accel = Math.hypot(ax, ay);
    const speed = Math.hypot(vx, vy);
    const rawSpeed = Math.hypot(rawVx, rawVy);
    lastVx = vx;
    lastVy = vy;

    squish = lerp(squish, isDown ? 1 : 0, isDown ? 0.32 : 0.11);
    clickFlash = lerp(clickFlash, 0, 0.1);
    tapeEnergy += accel * 0.5;
    tapeEnergy *= 0.5;
    tapeEnergy = Math.min(tapeEnergy, 2);

    if (tapeGain && tapeSource && !isDown) {
        const tv = tapeEnergy * 0.35;
        const ts = 0.5 + tapeEnergy * 0.5;
        tapeGain.gain.value += (tv - tapeGain.gain.value) * 0.08;
        tapeSource.playbackRate.value += (ts - tapeSource.playbackRate.value) * 0.08;
    }

    let tx = mouseX;
    let ty = mouseY;
    let tw = 16;
    let th = 16;
    let tbr = 8;
    let tAngle = 0;
    let tColor = GRV.white;
    let posLerp = LERP_POS_DEFAULT;
    let defStretchX = 1;
    let defStretchY = 1;

    if (mode === MODE.CONTROL && magnetTarget) {
        const m = magnetTarget;
        const dist = Math.hypot(mouseX - m.cx, mouseY - m.cy);
        const zone = Math.max(m.w, m.h) * 1.05;
        const pull = Math.max(0, 1 - dist / zone);

        tx = lerp(mouseX, m.cx, pull * 0.82);
        ty = lerp(mouseY, m.cy, pull * 0.82);
        tw = lerp(16, m.w, pull);
        th = lerp(16, m.h, pull);
        tbr = lerp(8, m.r, pull);
        posLerp = LERP_POS_CONTROL;
        tColor = GRV.green;

        if (m.role === "chip") {
            tw = lerp(16, m.w * 0.92, pull);
            th = lerp(16, m.h * 0.72, pull);
            tColor = GRV.white;
        } else if (m.role === "forbidden") {
            tColor = GRV.red;
            tAngle = Math.sin(performance.now() * 0.018) * 0.15;
        }
    } else if (mode === MODE.TEXT && caretSnap) {
        tx = caretSnap.x;
        ty = mouseY;
        tw = 3;
        th = caretSnap.h * 0.9;
        tbr = 2;
        tAngle = 0;
        tColor = GRV.blue;
        posLerp = LERP_POS_TEXT;
    } else {
        const stretch = Math.min(speed * 0.02, 0.5);
        defStretchX = 1 + stretch;
        defStretchY = 1 - stretch * 0.5;
        tAngle = rawSpeed > 0.5 ? Math.atan2(rawVy, rawVx) : rAngle;
    }

    const sqX = 1 + squish * 0.35;
    const sqY = 1 - squish * 0.45;
    const displayColor = clickFlash > 0.05
        ? lerpColor(tColor, GRV.red, clickFlash * 0.6)
        : tColor;

    const speedBoost = Math.min(speed * 0.003, 0.06);
    rx = lerp(rx, tx, posLerp + speedBoost);
    ry = lerp(ry, ty, posLerp + speedBoost);
    rw = lerp(rw, tw, LERP_SHAPE);
    rh = lerp(rh, th, LERP_SHAPE);
    rbr = lerp(rbr, tbr, LERP_SHAPE);
    rAngle = lerpAngle(rAngle, tAngle, 0.38);
    rColor = lerpColor(rColor, displayColor, LERP_COLOR);

    cursor.style.width = `${rw}px`;
    cursor.style.height = `${rh}px`;
    cursor.style.borderRadius = `${rbr}px`;
    cursor.style.background = rgbStr(rColor);
    cursor.style.left = `${rx}px`;
    cursor.style.top = `${ry}px`;
    cursor.style.transform = `
        translate(-50%, -50%)
        rotate(${rAngle}rad)
        scale(${defStretchX * sqX}, ${defStretchY * sqY})
    `;

    cursorDress.style.left = `${rx}px`;
    cursorDress.style.top = `${ry}px`;
    cursorDress.style.opacity = isHumiliated ? "1" : "0";
    cursorDress.style.transform = `
        translate(-50%, 0)
        rotate(${Math.sin(performance.now() * 0.012) * 0.045}rad)
    `;

    requestAnimationFrame(animate);
}

animate();
