// ============================================================================
// fileShare - Clean, Non-Repetitive UI & Wireless Phone Bridge
// ============================================================================

const urlParams = new URLSearchParams(window.location.search);
const action = urlParams.get('action');
const sessionPin = urlParams.get('pin') ? urlParams.get('pin').toUpperCase() : '';

let isAuthRequired = false;
let uploadedScore = 0;
let soundEnabled = true;
let isAudioContextReady = false;
let audioCtx = null;

// Send mode state
let activeFile = null;
let activeFileName = "final_final_v7.pdf";
let currentSendPin = "";
let currentSendUrl = "";

// Receive mode state
let currentReceiveSessionPin = "";
let receivePollInterval = null;

// ============================================================================
// App Mode Switcher (Send vs Receive)
// ============================================================================
function switchAppMode(mode) {
    const tabSend = document.getElementById('tabSend');
    const tabReceive = document.getElementById('tabReceive');
    const viewSend = document.getElementById('viewSend');
    const viewReceive = document.getElementById('viewReceive');

    if (!tabSend || !tabReceive || !viewSend || !viewReceive) return;

    if (mode === 'send') {
        tabSend.classList.add('active');
        tabReceive.classList.remove('active');
        viewSend.classList.remove('hidden');
        viewReceive.classList.add('hidden');
        setTimeout(calculateRestPosition, 50);
        setTimeout(resizeCanvases, 50);
    } else {
        tabReceive.classList.add('active');
        tabSend.classList.remove('active');
        viewReceive.classList.remove('hidden');
        viewSend.classList.add('hidden');
        initReceiveMode();
    }
}

// Check server auth config
async function checkAuthConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const config = await res.json();
            isAuthRequired = !!config.authRequired;
        }
    } catch (e) {}
}

function getAuthKey(actionName) {
    if (!isAuthRequired) return '';
    const key = prompt(`Website is protected. Please enter the Auth Key to ${actionName}:`);
    return key ? key.trim() : null;
}

function generatePin() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let pin = '';
    for (let i = 0; i < 4; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

// ============================================================================
// Synthesized Web Audio API Sound Effects
// ============================================================================
function initAudio() {
    if (isAudioContextReady && audioCtx) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            isAudioContextReady = true;
        }
    } catch (e) {}
}

function playSwooshSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.22);
    } catch (e) {}
}

function playRimSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
    } catch (e) {}
}

function playSwishSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const now = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * 0.25;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.24);
        filter.Q.setValueAtTime(3.0, now);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start(now);
        noise.stop(now + 0.25);
    } catch (e) {}
}

function playScoreChime() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const now = audioCtx.currentTime;
        [587.33, 880].forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const offset = idx * 0.07;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + offset);

            gain.gain.setValueAtTime(0.01, now + offset);
            gain.gain.linearRampToValueAtTime(0.25, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now + offset);
            osc.stop(now + offset + 0.35);
        });
    } catch (e) {}
}

// ============================================================================
// Confetti & Celebration
// ============================================================================
const confettiCanvas = document.getElementById('confettiCanvas');
let confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimId = null;

function resizeCanvases() {
    const court = document.getElementById('courtStage');
    const traj = document.getElementById('trajectoryCanvas');
    if (!court) return;

    const w = court.clientWidth;
    const h = court.clientHeight + 125;

    if (traj) { traj.width = w; traj.height = h; }
    if (confettiCanvas) { confettiCanvas.width = w; confettiCanvas.height = h; }
}
window.addEventListener('resize', resizeCanvases);

function triggerConfetti(originX, originY) {
    if (!confettiCtx || !confettiCanvas) return;
    const colors = ['#f97316', '#ea580c', '#fb923c', '#fed7aa', '#ffffff', '#eab308'];
    confettiParticles = [];

    for (let i = 0; i < 32; i++) {
        const angle = (Math.PI / 16) * i + Math.random() * 0.4;
        const speed = 2.5 + Math.random() * 5.0;
        confettiParticles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
            vy: -Math.abs(Math.sin(angle)) * speed - 1.5,
            size: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.2,
            alpha: 1,
            gravity: 0.16
        });
    }

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

    function update() {
        if (!confettiCtx) return;
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let active = 0;

        for (let p of confettiParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rotSpeed;
            p.alpha -= 0.016;

            if (p.alpha > 0) {
                active++;
                confettiCtx.save();
                confettiCtx.globalAlpha = Math.max(0, p.alpha);
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate(p.rotation);
                confettiCtx.fillStyle = p.color;
                confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                confettiCtx.restore();
            }
        }

        if (active > 0) confettiAnimId = requestAnimationFrame(update);
        else confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    update();
}

function incrementScore() {
    uploadedScore++;
    const scoreEl = document.getElementById('uploadCount');
    const badge = document.getElementById('scoreboardBadge');
    if (scoreEl) scoreEl.textContent = uploadedScore;
    if (badge) {
        badge.classList.remove('pop');
        void badge.offsetWidth;
        badge.classList.add('pop');
        setTimeout(() => badge.classList.remove('pop'), 600);
    }
}

function triggerSwishCelebration() {
    const net = document.getElementById('netContainer');
    const text = document.getElementById('swishText');
    const rim = document.getElementById('rimContainer');

    if (net) {
        net.classList.remove('swish');
        void net.offsetWidth;
        net.classList.add('swish');
        setTimeout(() => net.classList.remove('swish'), 600);
    }
    if (rim) {
        rim.classList.remove('rim-hit');
        void rim.offsetWidth;
        rim.classList.add('rim-hit');
        setTimeout(() => rim.classList.remove('rim-hit'), 300);
    }
    if (text) {
        text.classList.remove('show');
        void text.offsetWidth;
        text.classList.add('show');
        setTimeout(() => text.classList.remove('show'), 900);
    }

    playSwishSound();
    playScoreChime();
    incrementScore();

    const court = document.getElementById('courtStage');
    if (court) {
        triggerConfetti(court.clientWidth / 2, 90);
    }
}

// ============================================================================
// File Type Badge Helper
// ============================================================================
function getFileBadgeText(name) {
    if (!name) return "FILE";
    const ext = name.split('.').pop().toUpperCase();
    return ext.length > 4 ? ext.substring(0, 4) : (ext || "FILE");
}

function updateFileCardDisplay(filename) {
    activeFileName = filename;
    const labelEl = document.getElementById('fileCardName');
    const badgeEl = document.getElementById('fileBadge');
    if (labelEl) labelEl.textContent = filename;
    if (badgeEl) badgeEl.textContent = getFileBadgeText(filename);
}

// ============================================================================
// Basketball Hoop Shooting Physics Engine
// ============================================================================
const draggableFile = document.getElementById('draggableFile');
const trajectoryCanvas = document.getElementById('trajectoryCanvas');
const courtStage = document.getElementById('courtStage');
const dropzoneOuter = document.getElementById('dropzoneOuter');

let isDragging = false;
let isShooting = false;
let dragStartX = 0;
let dragStartY = 0;
let currentDragX = 0;
let currentDragY = 0;

function calculateRestPosition() {
    resetFileToRest();
}

function resetFileToRest() {
    if (!draggableFile) return;
    draggableFile.classList.remove('grabbing', 'shooting');
    draggableFile.style.transform = `translate(0px, 0px) rotate(0deg) scale(1)`;
    draggableFile.style.opacity = '1';
    isShooting = false;
    clearTrajectory();
}

function clearTrajectory() {
    if (!trajectoryCanvas) return;
    const ctx = trajectoryCanvas.getContext('2d');
    ctx.clearRect(0, 0, trajectoryCanvas.width, trajectoryCanvas.height);
}

function drawTrajectory(startX, startY, vx, vy, gravity) {
    if (!trajectoryCanvas) return;
    const ctx = trajectoryCanvas.getContext('2d');
    ctx.clearRect(0, 0, trajectoryCanvas.width, trajectoryCanvas.height);

    const points = [];
    let px = startX;
    let py = startY;
    let pvx = vx;
    let pvy = vy;

    for (let t = 0; t < 26; t++) {
        points.push({ x: px, y: py });
        px += pvx;
        py += pvy;
        pvy += gravity;
        if (py < 40) break;
    }

    points.forEach((pt, i) => {
        if (i % 2 !== 0) return;
        const radius = Math.max(2, 4.5 - i * 0.1);
        const alpha = Math.max(0.2, 0.9 - i * 0.03);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function computeLaunchVelocity(dx, dy) {
    let vx = 0;
    let vy = 0;
    if (dy > 0) {
        vx = -dx * 0.12;
        vy = -dy * 0.15;
    } else {
        vx = dx * 0.12;
        vy = dy * 0.15;
    }
    vx = Math.max(-10, Math.min(10, vx));
    vy = Math.min(-7, Math.max(-18, vy));
    return { vx, vy, gravity: 0.55 };
}

if (draggableFile && courtStage) {
    draggableFile.addEventListener('pointerdown', (e) => {
        if (isShooting) return;
        initAudio();
        isDragging = true;
        draggableFile.classList.add('grabbing');
        draggableFile.setPointerCapture(e.pointerId);

        dragStartX = e.clientX;
        dragStartY = e.clientY;
        currentDragX = 0;
        currentDragY = 0;
        resizeCanvases();
    });

    draggableFile.addEventListener('pointermove', (e) => {
        if (!isDragging || isShooting) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        currentDragX = dx;
        currentDragY = dy;

        const displayDx = dx * 0.45;
        const displayDy = dy * 0.45;
        draggableFile.style.transform = `translate(${displayDx}px, ${displayDy}px) rotate(${dx * 0.08}deg)`;

        const canvasStartX = courtStage.clientWidth / 2 + displayDx;
        const canvasStartY = courtStage.clientHeight + 125 - 60 + displayDy;
        const { vx, vy, gravity } = computeLaunchVelocity(dx, dy);

        drawTrajectory(canvasStartX, canvasStartY, vx, vy, gravity);
    });

    const finishDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        clearTrajectory();

        const dist = Math.hypot(currentDragX, currentDragY);
        if (dist > 25) {
            const { vx, vy, gravity } = computeLaunchVelocity(currentDragX, currentDragY);
            executeShot(vx, vy, gravity);
        } else {
            resetFileToRest();
        }
    };

    draggableFile.addEventListener('pointerup', finishDrag);
    draggableFile.addEventListener('pointercancel', finishDrag);
}

function executeShot(initVx, initVy, gravity) {
    if (isShooting || !courtStage || !draggableFile) return;
    isShooting = true;
    draggableFile.classList.add('shooting');
    clearTrajectory();
    playSwooshSound();

    const courtWidth = courtStage.clientWidth;
    let posX = 0;
    let posY = 0;
    let vx = initVx;
    let vy = initVy;
    let rot = 0;
    let rotSpeed = vx * 1.8;

    const hoopY = -155;
    const rimLeft = -38;
    const rimRight = 38;

    let hasHitBackboard = false;
    let hasScored = false;
    let frame = 0;

    function step() {
        frame++;
        posX += vx;
        posY += vy;
        vy += gravity;
        rot += rotSpeed;

        if (!hasHitBackboard && posY <= -160 && posY >= -220 && Math.abs(posX) <= 65) {
            hasHitBackboard = true;
            playRimSound();
            vx = -vx * 0.35 + (posX > 0 ? -1.5 : 1.5);
            vy = Math.abs(vy) * 0.45 + 1.8;
            rotSpeed = -rotSpeed * 0.5;
        }

        if (!hasScored && vy > 0 && posY >= hoopY && posY <= hoopY + 28 && posX >= rimLeft && posX <= rimRight) {
            hasScored = true;
            triggerSwishCelebration();
            vx = vx * 0.25;
            vy = 2.2;
            rotSpeed *= 0.3;
        }

        draggableFile.style.transform = `translate(${posX}px, ${posY}px) rotate(${rot}deg) scale(${hasScored ? 0.85 : 1})`;

        if (hasScored && posY > hoopY + 60) {
            draggableFile.style.opacity = '0';
            setTimeout(() => {
                resetFileToRest();
                handleShotUploadComplete();
            }, 300);
            return;
        }

        if (posY > 80 || posX < -courtWidth / 2 - 40 || posX > courtWidth / 2 + 40 || frame > 120) {
            if (hasHitBackboard && !hasScored) playRimSound();
            setTimeout(resetFileToRest, 250);
            return;
        }

        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function triggerAutoShot() {
    if (isShooting) return;
    initAudio();
    executeShot(0.2, -12.4, 0.48);
}

const btnShoot = document.getElementById('btnShoot');
if (btnShoot) btnShoot.addEventListener('click', triggerAutoShot);

// Native OS Drag and Drop
if (dropzoneOuter) {
    ['dragenter', 'dragover'].forEach(name => {
        dropzoneOuter.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneOuter.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzoneOuter.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneOuter.classList.remove('dragover');
        });
    });

    dropzoneOuter.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
            const file = dt.files[0];
            activeFile = file;
            updateFileCardDisplay(file.name);
            triggerAutoShot();
        }
    });
}

// PC File Input
const pcFileInput = document.getElementById('pcFileInput');
if (pcFileInput) {
    pcFileInput.addEventListener('change', () => {
        if (pcFileInput.files && pcFileInput.files.length > 0) {
            activeFile = pcFileInput.files[0];
            updateFileCardDisplay(activeFile.name);
        }
    });
}

// Sound toggle
const btnSoundToggle = document.getElementById('btnSoundToggle');
if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (soundEnabled) {
            btnSoundToggle.classList.add('active');
            btnSoundToggle.textContent = '🔊 Sound';
            initAudio();
            playRimSound();
        } else {
            btnSoundToggle.classList.remove('active');
            btnSoundToggle.textContent = '🔇 Muted';
        }
    });
}

// ============================================================================
// Upload Execution & Displaying the Concise Share Card
// ============================================================================
async function handleShotUploadComplete() {
    let fileToUpload = activeFile;
    if (!fileToUpload) {
        const sampleText = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 55>>stream\nBT /F1 24 Tf 100 700 Td (fileShare Ephemeral File Transfer) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000216 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n323\n%%EOF`;
        fileToUpload = new Blob([sampleText], { type: 'application/pdf' });
        fileToUpload.name = activeFileName || "final_final_v7.pdf";
    }

    const sendStatus = document.getElementById('sendStatus');
    const transferReadyCard = document.getElementById('transferReadyCard');
    const courtWrapper = document.getElementById('courtInteractiveWrapper');
    const transferFileName = document.getElementById('transferFileName');
    const sendQrCode = document.getElementById('sendQrCode');
    const pinBoxes = document.getElementById('pinDisplayBoxes');

    if (sendStatus) {
        sendStatus.classList.remove('hidden');
        sendStatus.innerHTML = `Uploading <strong>${fileToUpload.name}</strong>...`;
    }

    let authKey = '';
    if (isAuthRequired) {
        authKey = getAuthKey('upload this file');
        if (authKey === null || authKey === '') {
            if (sendStatus) sendStatus.innerText = "Upload cancelled: Auth key required.";
            return;
        }
    }

    try {
        const headers = { 'X-File-Name': encodeURIComponent(fileToUpload.name) };
        if (authKey) headers['X-Auth-Key'] = authKey;

        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: headers,
            body: fileToUpload
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error("Invalid Auth Key");
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        currentSendPin = data.pin.toUpperCase();
        currentSendUrl = `${window.location.origin}/?action=download&pin=${currentSendPin}`;

        if (sendStatus) sendStatus.classList.add('hidden');
        if (courtWrapper) courtWrapper.classList.add('hidden');
        if (transferReadyCard) transferReadyCard.classList.remove('hidden');
        if (transferFileName) transferFileName.textContent = fileToUpload.name;

        // Render 4-char PIN boxes
        if (pinBoxes) {
            pinBoxes.innerHTML = currentSendPin.split('').map(ch => `<div class="pin-char-box">${ch}</div>`).join('');
        }

        // Render QR Code
        if (sendQrCode) {
            sendQrCode.innerHTML = '';
            new QRCode(sendQrCode, {
                text: currentSendUrl,
                width: 164,
                height: 164,
                colorDark: "#1c1917",
                colorLight: "#ffffff"
            });
        }
    } catch (err) {
        if (sendStatus) {
            sendStatus.classList.remove('hidden');
            sendStatus.innerText = "Upload failed: " + err.message;
        }
    }
}

// "Shoot Another File" button
const btnShootAnother = document.getElementById('btnShootAnother');
if (btnShootAnother) {
    btnShootAnother.addEventListener('click', () => {
        const transferReadyCard = document.getElementById('transferReadyCard');
        const courtWrapper = document.getElementById('courtInteractiveWrapper');
        if (transferReadyCard) transferReadyCard.classList.add('hidden');
        if (courtWrapper) courtWrapper.classList.remove('hidden');

        activeFile = null;
        if (pcFileInput) pcFileInput.value = '';
        updateFileCardDisplay("final_final_v7.pdf");
        resetFileToRest();
        setTimeout(resizeCanvases, 50);
    });
}

// Copy PIN & Copy Link
const btnCopyPin = document.getElementById('btnCopyPin');
if (btnCopyPin) {
    btnCopyPin.addEventListener('click', async () => {
        if (!currentSendPin) return;
        try {
            await navigator.clipboard.writeText(currentSendPin);
            btnCopyPin.textContent = '✅ Copied!';
            setTimeout(() => { btnCopyPin.textContent = '📋 Copy PIN'; }, 1800);
        } catch (e) {
            prompt('PIN Code:', currentSendPin);
        }
    });
}

const btnCopyLink = document.getElementById('btnCopyLink');
if (btnCopyLink) {
    btnCopyLink.addEventListener('click', async () => {
        if (!currentSendUrl) return;
        try {
            await navigator.clipboard.writeText(currentSendUrl);
            btnCopyLink.textContent = '✅ Copied!';
            setTimeout(() => { btnCopyLink.textContent = '🔗 Copy Link'; }, 1800);
        } catch (e) {
            prompt('Download Link:', currentSendUrl);
        }
    });
}

// ============================================================================
// RECEIVE MODE (Direct PIN or Phone Bridge)
// ============================================================================
function initReceiveMode() {
    if (receivePollInterval) clearInterval(receivePollInterval);

    // Generate unique 4-character session PIN for this screen (Laptop B)
    currentReceiveSessionPin = generatePin();

    const pinText = document.getElementById('screenBridgePinText');
    const qrContainer = document.getElementById('screenReceiveQr');
    const liveStatus = document.getElementById('bridgeLiveStatus');
    const actionWrap = document.getElementById('bridgeDownloadAction');

    if (pinText) pinText.textContent = currentReceiveSessionPin;
    if (liveStatus) liveStatus.textContent = "Listening for phone upload or beam...";
    if (actionWrap) actionWrap.classList.add('hidden');

    // Phone scans this QR if it wants to upload directly from phone to this computer
    const receiveUrl = `${window.location.origin}/?action=upload&pin=${currentReceiveSessionPin}`;
    if (qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: receiveUrl,
            width: 164,
            height: 164,
            colorDark: "#1c1917",
            colorLight: "#ffffff"
        });
    }

    // Poll status for incoming beam from phone or upload
    receivePollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/status/${currentReceiveSessionPin}`);
            if (res.ok) {
                clearInterval(receivePollInterval);
                const data = await res.json();
                const filename = data.filename || "file.dat";

                if (liveStatus) {
                    liveStatus.innerHTML = `<strong>🎉 File Ready:</strong> ${filename}`;
                }
                if (actionWrap) {
                    actionWrap.classList.remove('hidden');
                }

                // Auto-trigger download for seamless hands-free transfer
                triggerDownloadByPin(currentReceiveSessionPin);
            }
        } catch (e) {}
    }, 2000);
}

// Direct PIN Download input
const btnDownloadByPin = document.getElementById('btnDownloadByPin');
const receivePinInput = document.getElementById('receivePinInput');
const receivePinStatus = document.getElementById('receivePinStatus');

async function handleDirectPinDownload() {
    if (!receivePinInput) return;
    const pin = receivePinInput.value.trim().toUpperCase();

    if (pin.length !== 4) {
        if (receivePinStatus) {
            receivePinStatus.classList.remove('hidden');
            receivePinStatus.innerText = "Please enter a valid 4-character PIN.";
        }
        return;
    }

    if (receivePinStatus) {
        receivePinStatus.classList.remove('hidden');
        receivePinStatus.innerText = `Checking PIN ${pin}...`;
    }

    try {
        const res = await fetch(`/api/status/${pin}`);
        if (!res.ok) {
            if (receivePinStatus) receivePinStatus.innerText = `PIN "${pin}" not found or expired.`;
            return;
        }

        const data = await res.json();
        if (receivePinStatus) {
            receivePinStatus.innerHTML = `Found <strong>${data.filename || "file"}</strong>! Downloading...`;
        }
        triggerDownloadByPin(pin);
    } catch (e) {
        if (receivePinStatus) receivePinStatus.innerText = "Network error checking PIN.";
    }
}

if (btnDownloadByPin) btnDownloadByPin.addEventListener('click', handleDirectPinDownload);
if (receivePinInput) {
    receivePinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleDirectPinDownload();
    });
}

function triggerDownloadByPin(pin) {
    let authKey = '';
    if (isAuthRequired) {
        authKey = getAuthKey('download this file');
        if (authKey === null || authKey === '') return;
    }
    const dlUrl = `/api/download/${pin}${authKey ? `?auth=${encodeURIComponent(authKey)}` : ''}`;
    window.location.href = dlUrl;
}

const btnBridgeDownload = document.getElementById('btnBridgeDownload');
if (btnBridgeDownload) {
    btnBridgeDownload.addEventListener('click', () => {
        if (currentReceiveSessionPin) triggerDownloadByPin(currentReceiveSessionPin);
    });
}

// ============================================================================
// MOBILE HUB (When Phone Scans QR from Laptop A: Download or Beam to Laptop B)
// ============================================================================
async function initMobileHub() {
    const mainModeSwitcher = document.getElementById('mainModeSwitcher');
    const viewSend = document.getElementById('viewSend');
    const viewReceive = document.getElementById('viewReceive');
    const viewMobileHub = document.getElementById('viewMobileHub');

    if (mainModeSwitcher) mainModeSwitcher.classList.add('hidden');
    if (viewSend) viewSend.classList.add('hidden');
    if (viewReceive) viewReceive.classList.add('hidden');
    if (viewMobileHub) viewMobileHub.classList.remove('hidden');

    const fileNameEl = document.getElementById('mobileFileName');
    const pinTagEl = document.getElementById('mobilePinTag');
    if (pinTagEl) pinTagEl.textContent = `PIN: ${sessionPin}`;

    try {
        const res = await fetch(`/api/status/${sessionPin}`);
        if (res.ok) {
            const data = await res.json();
            if (fileNameEl) fileNameEl.textContent = data.filename || "Shared File";
        } else {
            if (fileNameEl) fileNameEl.textContent = "File not found or expired";
        }
    } catch (e) {
        if (fileNameEl) fileNameEl.textContent = "Shared File";
    }

    // Button 1: Download to this phone
    const btnMobileDownload = document.getElementById('btnMobileDownload');
    if (btnMobileDownload) {
        btnMobileDownload.onclick = () => {
            triggerDownloadByPin(sessionPin);
        };
    }

    // Button 2: Beam to Laptop B
    const btnRelayToLaptop = document.getElementById('btnRelayToLaptop');
    const relayTargetInput = document.getElementById('relayTargetPinInput');
    const relayStatus = document.getElementById('relayStatus');

    if (btnRelayToLaptop && relayTargetInput) {
        btnRelayToLaptop.onclick = async () => {
            const targetPin = relayTargetInput.value.trim().toUpperCase();
            if (targetPin.length !== 4) {
                if (relayStatus) {
                    relayStatus.classList.remove('hidden');
                    relayStatus.innerText = "Enter the 4-digit Bridge Code from Laptop B.";
                }
                return;
            }

            if (relayStatus) {
                relayStatus.classList.remove('hidden');
                relayStatus.innerText = `Beaming file to screen ${targetPin}...`;
            }

            try {
                let authKey = '';
                if (isAuthRequired) {
                    authKey = getAuthKey('beam this file');
                    if (!authKey) return;
                }

                const relayUrl = `/api/relay?from=${sessionPin}&to=${targetPin}${authKey ? `&auth=${encodeURIComponent(authKey)}` : ''}`;
                const res = await fetch(relayUrl);

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt || `HTTP ${res.status}`);
                }

                if (relayStatus) {
                    relayStatus.innerHTML = `<span style="color: var(--primary-dark); font-weight: 700;">✅ Success!</span><br>File beamed to Laptop (${targetPin}). Check that screen!`;
                }
                btnRelayToLaptop.disabled = true;
                btnRelayToLaptop.textContent = "✅ Beamed!";
            } catch (err) {
                if (relayStatus) {
                    relayStatus.innerText = "Beam failed: " + err.message;
                }
            }
        };
    }
}

// ============================================================================
// MOBILE DIRECT UPLOAD (When Phone Scans Laptop B's QR to Upload)
// ============================================================================
function initMobileUpload() {
    const mainModeSwitcher = document.getElementById('mainModeSwitcher');
    const viewSend = document.getElementById('viewSend');
    const viewReceive = document.getElementById('viewReceive');
    const viewMobileUpload = document.getElementById('viewMobileUpload');

    if (mainModeSwitcher) mainModeSwitcher.classList.add('hidden');
    if (viewSend) viewSend.classList.add('hidden');
    if (viewReceive) viewReceive.classList.add('hidden');
    if (viewMobileUpload) viewMobileUpload.classList.remove('hidden');

    const pinLabel = document.getElementById('mobileUploadPinLabel');
    if (pinLabel) pinLabel.innerHTML = `Connected to Screen: <strong>${sessionPin}</strong>`;

    const fileInput = document.getElementById('mobileDirectFileInput');
    const chosenName = document.getElementById('mobileChosenFileName');
    if (fileInput && chosenName) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                chosenName.textContent = fileInput.files[0].name;
                chosenName.style.color = '#ea580c';
                chosenName.style.fontWeight = '600';
            } else {
                chosenName.textContent = "No file chosen";
                chosenName.style.color = 'var(--text-muted)';
            }
        });
    }

    const btnUpload = document.getElementById('btnMobileDirectUpload');
    const statusEl = document.getElementById('mobileDirectStatus');

    if (btnUpload) {
        btnUpload.onclick = async () => {
            if (!fileInput || fileInput.files.length === 0) {
                if (statusEl) {
                    statusEl.classList.remove('hidden');
                    statusEl.innerText = "Please choose a file first.";
                }
                return;
            }

            let authKey = '';
            if (isAuthRequired) {
                authKey = getAuthKey('upload to computer');
                if (!authKey) return;
            }

            const file = fileInput.files[0];
            if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.innerText = "Uploading to computer screen...";
            }

            try {
                const headers = {
                    'X-File-Name': encodeURIComponent(file.name),
                    'X-Session-Pin': sessionPin
                };
                if (authKey) headers['X-Auth-Key'] = authKey;

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: headers,
                    body: file
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                if (statusEl) {
                    statusEl.innerHTML = `<span style="color: var(--primary-dark); font-weight: 700;">✅ Upload Complete!</span><br>Check your computer screen to download.`;
                }
                btnUpload.disabled = true;
                btnUpload.textContent = "Uploaded!";
            } catch (err) {
                if (statusEl) statusEl.innerText = "Upload failed: " + err.message;
            }
        };
    }
}

// ============================================================================
// Initialize App
// ============================================================================
async function initApp() {
    await checkAuthConfig();

    // 1. Mobile Download & Bridge Relay (?action=download&pin=XXXX)
    if (action === 'download' && sessionPin) {
        initMobileHub();
    }
    // 2. Mobile Direct Upload to Laptop (?action=upload&pin=XXXX)
    else if (action === 'upload' && sessionPin) {
        initMobileUpload();
    }
    // 3. Desktop Mode (Default: Send File with Basketball Hoop)
    else {
        switchAppMode('send');
    }
}

initApp();