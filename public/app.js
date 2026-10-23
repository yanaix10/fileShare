// ============================================================================
// fileShare - Light Orange Theme & Basketball Hoop Uploader
// ============================================================================

const params = new URLSearchParams(window.location.search);
const action = params.get('action');
const sessionPin = params.get('pin');

let isAuthRequired = false;
let uploadedScore = 0;
let soundEnabled = true;
let isAudioContextReady = false;
let audioCtx = null;

// Track active file for shooting & uploading
let activeFile = null;
let activeFileName = "final_final_v7.pdf";
let lastGeneratedDownloadUrl = "";

// Check if server requires an auth key
async function checkAuthConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const config = await res.json();
            isAuthRequired = !!config.authRequired;
        }
    } catch (e) {}
}

// Prompt for auth key when needed
function getAuthKey(actionName) {
    if (!isAuthRequired) return '';
    const key = prompt(`Website is protected. Please enter the Auth Key to ${actionName}:`);
    return key ? key.trim() : null;
}

// Generate a random 4-character alphanumeric PIN
function generateClientPin() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let pin = '';
    for (let i = 0; i < 4; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

// ============================================================================
// Synthesized Web Audio API Sound Effects (Zero External Files Needed)
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
        // Metallic bonk / clank
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
        // Filtered white noise creates an ultra-realistic nylon net swish
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
        // Two harmonious bell notes: D5 & A5
        [587.33, 880].forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const startOffset = index * 0.07;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + startOffset);

            gain.gain.setValueAtTime(0.01, now + startOffset);
            gain.gain.linearRampToValueAtTime(0.25, now + startOffset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.35);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now + startOffset);
            osc.stop(now + startOffset + 0.35);
        });
    } catch (e) {}
}

// ============================================================================
// Confetti Celebration Particles
// ============================================================================
const confettiCanvas = document.getElementById('confettiCanvas');
let confettiCtx = null;
let confettiParticles = [];
let confettiAnimId = null;

if (confettiCanvas) {
    confettiCtx = confettiCanvas.getContext('2d');
}

function resizeCanvases() {
    const court = document.getElementById('courtStage');
    const traj = document.getElementById('trajectoryCanvas');
    if (!court) return;

    const rect = court.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height + 125; // Include hoop stage height

    if (traj) {
        traj.width = w;
        traj.height = h;
    }
    if (confettiCanvas) {
        confettiCanvas.width = w;
        confettiCanvas.height = h;
    }
}
window.addEventListener('resize', resizeCanvases);

function triggerConfetti(originX, originY) {
    if (!confettiCtx || !confettiCanvas) return;

    const colors = ['#f97316', '#ea580c', '#fb923c', '#fed7aa', '#ffffff', '#eab308', '#f43f5e'];
    confettiParticles = [];

    for (let i = 0; i < 36; i++) {
        const angle = (Math.PI / 18) * (i + Math.random() * 0.5) + Math.PI * 0.05;
        const speed = 2.5 + Math.random() * 5.5;
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

    function updateConfetti() {
        if (!confettiCtx) return;
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let activeCount = 0;

        for (let p of confettiParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rotSpeed;
            p.alpha -= 0.016;

            if (p.alpha > 0) {
                activeCount++;
                confettiCtx.save();
                confettiCtx.globalAlpha = Math.max(0, p.alpha);
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate(p.rotation);
                confettiCtx.fillStyle = p.color;
                confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                confettiCtx.restore();
            }
        }

        if (activeCount > 0) {
            confettiAnimId = requestAnimationFrame(updateConfetti);
        } else {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    updateConfetti();
}

// ============================================================================
// Scoreboard & Celebration Badge
// ============================================================================
function incrementScore() {
    uploadedScore++;
    const scoreEl = document.getElementById('uploadCount');
    const badge = document.getElementById('scoreboardBadge');
    if (scoreEl) scoreEl.textContent = uploadedScore;
    if (badge) {
        badge.classList.remove('pop');
        void badge.offsetWidth; // Force reflow
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

    // Trigger confetti from hoop center
    const court = document.getElementById('courtStage');
    if (court) {
        const cx = court.clientWidth / 2;
        const cy = 90; // Approx rim Y in canvas coordinate space
        triggerConfetti(cx, cy);
    }
}

// ============================================================================
// File Type Badge Helper
// ============================================================================
function getFileBadgeText(name) {
    if (!name) return "FILE";
    const ext = name.split('.').pop().toUpperCase();
    if (ext.length > 4) return ext.substring(0, 4);
    return ext || "FILE";
}

function updateFileCardDisplay(filename) {
    activeFileName = filename;
    const labelEl = document.getElementById('fileCardName');
    const badgeEl = document.getElementById('fileBadge');
    if (labelEl) labelEl.textContent = filename;
    if (badgeEl) badgeEl.textContent = getFileBadgeText(filename);
}

// ============================================================================
// Basketball Hoop Aim & Shooting Physics Engine
// ============================================================================
const draggableFile = document.getElementById('draggableFile');
const trajectoryCanvas = document.getElementById('trajectoryCanvas');
const courtStage = document.getElementById('courtStage');
const dropzoneOuter = document.getElementById('dropzoneOuter');

let isDragging = false;
let isShooting = false;
let dragStartX = 0;
let dragStartY = 0;
let fileRestX = 0;
let fileRestY = 0;
let currentDragX = 0;
let currentDragY = 0;

function calculateRestPosition() {
    if (!courtStage || !draggableFile) return;
    const courtRect = courtStage.getBoundingClientRect();
    fileRestX = courtRect.width / 2;
    fileRestY = courtRect.height - 50;
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
    const dt = 1.0;

    for (let t = 0; t < 28; t++) {
        points.push({ x: px, y: py });
        px += pvx * dt;
        py += pvy * dt;
        pvy += gravity * dt;
        if (py < 40) break; // Don't draw beyond top
    }

    // Draw glowing trajectory dots
    points.forEach((pt, i) => {
        if (i % 2 !== 0) return;
        const radius = Math.max(2, 4.5 - i * 0.1);
        const alpha = Math.max(0.2, 0.9 - i * 0.028);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

// Compute velocity vector from drag displacement
function computeLaunchVelocity(dx, dy) {
    // Intelligent drag mode:
    // If pulled down/back (slingshot style): vector is inverted (-dx, -dy)
    // If flicked/dragged up (flick style): vector is direct (dx, dy)
    let vx = 0;
    let vy = 0;

    if (dy > 0) {
        // Slingshot pull backwards
        vx = -dx * 0.12;
        vy = -dy * 0.15;
    } else {
        // Direct forward flick/aim
        vx = dx * 0.12;
        vy = dy * 0.15;
    }

    // Clamp launch velocities for a pleasant arc
    vx = Math.max(-10, Math.min(10, vx));
    vy = Math.min(-7, Math.max(-18, vy));

    return { vx, vy, gravity: 0.55 };
}

// Drag & Aim Event Handlers (Pointer Events support both Mouse & Touch)
if (draggableFile && courtStage) {
    draggableFile.addEventListener('pointerdown', (e) => {
        if (isShooting) return;
        initAudio();
        isDragging = true;
        draggableFile.classList.add('grabbing');
        draggableFile.setPointerCapture(e.pointerId);

        const courtRect = courtStage.getBoundingClientRect();
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

        // Visual drag offset with damping
        const displayDx = dx * 0.45;
        const displayDy = dy * 0.45;
        draggableFile.style.transform = `translate(${displayDx}px, ${displayDy}px) rotate(${dx * 0.08}deg)`;

        // Trajectory preview in canvas coordinates
        const canvasStartX = courtStage.clientWidth / 2 + displayDx;
        const canvasStartY = courtStage.clientHeight + 125 - 60 + displayDy;
        const { vx, vy, gravity } = computeLaunchVelocity(dx, dy);

        drawTrajectory(canvasStartX, canvasStartY, vx, vy, gravity);
    });

    const finishDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        clearTrajectory();

        const dist = Math.hypot(currentDragX, currentDragY);
        if (dist > 25) {
            // User aimed and released: shoot!
            const { vx, vy, gravity } = computeLaunchVelocity(currentDragX, currentDragY);
            executeShot(vx, vy, gravity);
        } else {
            // Tiny drag or click: reset gently
            resetFileToRest();
        }
    };

    draggableFile.addEventListener('pointerup', finishDrag);
    draggableFile.addEventListener('pointercancel', finishDrag);
}

// Execute Shot Animation & Physics
function executeShot(initVx, initVy, gravity, isGuaranteed = false) {
    if (isShooting || !courtStage || !draggableFile) return;
    isShooting = true;
    draggableFile.classList.add('shooting');
    clearTrajectory();
    playSwooshSound();

    const courtWidth = courtStage.clientWidth;
    const courtHeight = courtStage.clientHeight;

    // Start position relative to court center
    let posX = 0;
    let posY = 0;
    let vx = initVx;
    let vy = initVy;
    let rot = 0;
    let rotSpeed = vx * 1.8;

    // Coordinates of hoop elements (relative to court center)
    // Hoop center X = 0, Hoop Rim Y approx -155px
    const hoopY = -155;
    const rimLeft = -38;
    const rimRight = 38;

    let hasHitBackboard = false;
    let hasScored = false;
    let frame = 0;

    function physicsStep() {
        frame++;
        posX += vx;
        posY += vy;
        vy += gravity;
        rot += rotSpeed;

        // Check Backboard collision (around Y between -210 and -150)
        if (!hasHitBackboard && posY <= -160 && posY >= -220 && Math.abs(posX) <= 65) {
            hasHitBackboard = true;
            playRimSound();
            // Rebound off backboard down into the rim
            vx = -vx * 0.35 + (posX > 0 ? -1.5 : 1.5);
            vy = Math.abs(vy) * 0.45 + 1.8;
            rotSpeed = -rotSpeed * 0.5;
        }

        // Check Rim / Swish crossing downwards
        if (!hasScored && vy > 0 && posY >= hoopY && posY <= hoopY + 28 && posX >= rimLeft && posX <= rimRight) {
            hasScored = true;
            triggerSwishCelebration();
            // Slow down and drop straight through net
            vx = vx * 0.25;
            vy = 2.2;
            rotSpeed *= 0.3;
        }

        // Apply transform
        draggableFile.style.transform = `translate(${posX}px, ${posY}px) rotate(${rot}deg) scale(${hasScored ? 0.85 : 1})`;

        // End condition: passed through net or fell off screen
        if (hasScored && posY > hoopY + 60) {
            // Successful swish! Fade out and trigger real upload
            draggableFile.style.opacity = '0';
            setTimeout(() => {
                resetFileToRest();
                handleShotSuccessUpload();
            }, 300);
            return;
        }

        if (posY > 80 || posX < -courtWidth / 2 - 40 || posX > courtWidth / 2 + 40 || frame > 120) {
            // Missed shot: bounce softly and reset
            if (hasHitBackboard && !hasScored) {
                playRimSound();
            }
            setTimeout(() => {
                resetFileToRest();
            }, 250);
            return;
        }

        requestAnimationFrame(physicsStep);
    }

    requestAnimationFrame(physicsStep);
}

// Guaranteed Perfect Shot (for "Shoot! 🏀" button or 1-click execution)
function triggerAutoShot() {
    if (isShooting) return;
    initAudio();
    // High-arching swish shot
    const vx = 0.2;
    const vy = -12.4;
    const gravity = 0.48;
    executeShot(vx, vy, gravity, true);
}

const btnShoot = document.getElementById('btnShoot');
if (btnShoot) {
    btnShoot.addEventListener('click', triggerAutoShot);
}

// ============================================================================
// Native Drag & Drop from OS Desktop onto Hoop Dropzone
// ============================================================================
if (dropzoneOuter) {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzoneOuter.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneOuter.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzoneOuter.addEventListener(eventName, (e) => {
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
            // Auto shot on drop for instant delightful feedback!
            triggerAutoShot();
        }
    });
}

// PC File Input Handler
const pcFileInput = document.getElementById('pcFileInput');
if (pcFileInput) {
    pcFileInput.addEventListener('change', () => {
        if (pcFileInput.files && pcFileInput.files.length > 0) {
            activeFile = pcFileInput.files[0];
            updateFileCardDisplay(activeFile.name);
            const statusEl = document.getElementById('send-status');
            if (statusEl) statusEl.classList.add('hidden');
        }
    });
}

// Sound Toggle
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

// "Shoot Another File" button
const btnShootAnother = document.getElementById('btnShootAnother');
if (btnShootAnother) {
    btnShootAnother.addEventListener('click', () => {
        const resultPanel = document.getElementById('send-result-panel');
        if (resultPanel) resultPanel.classList.add('hidden');
        resetFileToRest();
        if (pcFileInput) pcFileInput.value = '';
        activeFile = null;
        updateFileCardDisplay("final_final_v7.pdf");
    });
}

// "Copy Link" button
const btnCopyDownloadLink = document.getElementById('btnCopyDownloadLink');
if (btnCopyDownloadLink) {
    btnCopyDownloadLink.addEventListener('click', async () => {
        if (!lastGeneratedDownloadUrl) return;
        try {
            await navigator.clipboard.writeText(lastGeneratedDownloadUrl);
            const originalText = btnCopyDownloadLink.textContent;
            btnCopyDownloadLink.textContent = '✅ Copied!';
            setTimeout(() => {
                btnCopyDownloadLink.textContent = originalText;
            }, 1800);
        } catch (e) {
            prompt('Download Link:', lastGeneratedDownloadUrl);
        }
    });
}

// ============================================================================
// Upload Execution & QR Generation (PC to Phone)
// ============================================================================
async function handleShotSuccessUpload() {
    let fileToUpload = activeFile;

    // If user shot without picking a file, create a realistic sample PDF blob
    if (!fileToUpload) {
        const sampleText = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 55>>stream\nBT /F1 24 Tf 100 700 Td (fileShare Basketball Swish Upload!) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000216 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n323\n%%EOF`;
        fileToUpload = new Blob([sampleText], { type: 'application/pdf' });
        fileToUpload.name = activeFileName || "final_final_v7.pdf";
    }

    const statusEl = document.getElementById('send-status');
    const resultPanel = document.getElementById('send-result-panel');
    const qrContainer = document.getElementById('send-qr');
    const pinLabel = document.getElementById('send-pin-label');

    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = `Uploading <strong>${fileToUpload.name}</strong> to server...`;
    }

    let authKey = '';
    if (isAuthRequired) {
        authKey = getAuthKey('upload this file');
        if (authKey === null || authKey === '') {
            if (statusEl) statusEl.innerText = "Upload cancelled: Auth key is required.";
            return;
        }
    }

    try {
        const headers = {
            'X-File-Name': encodeURIComponent(fileToUpload.name)
        };
        if (authKey) {
            headers['X-Auth-Key'] = authKey;
        }

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: headers,
            body: fileToUpload
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("Invalid Auth Key");
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const downloadUrl = `${window.location.origin}/?action=download&pin=${data.pin}`;
        lastGeneratedDownloadUrl = downloadUrl;

        if (statusEl) statusEl.classList.add('hidden');
        if (resultPanel) resultPanel.classList.remove('hidden');
        if (pinLabel) {
            pinLabel.innerHTML = `Scan with phone to download (PIN: <strong>${data.pin}</strong>)<br><small style="color: var(--text-muted);">Auto-deletes immediately after download or in 5 mins.</small>`;
        }

        if (qrContainer) {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: downloadUrl,
                width: 180,
                height: 180,
                colorDark: "#1c1917",
                colorLight: "#ffffff"
            });
        }
    } catch (err) {
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.innerText = "Upload failed: " + err.message;
        }
    }
}

// Fallback upload button for accessibility
async function uploadFromPC() {
    if (!activeFile && pcFileInput && pcFileInput.files.length > 0) {
        activeFile = pcFileInput.files[0];
    }
    triggerAutoShot();
}

// ============================================================================
// Desktop: Setup "Receive File" QR & Poll Server until Phone Uploads
// ============================================================================
function initDesktopReceive() {
    const receiveQrEl = document.getElementById('receive-qr');
    if (!receiveQrEl) return;

    const receivePin = generateClientPin();
    const mobileUploadUrl = `${window.location.origin}/?action=upload&pin=${receivePin}`;

    new QRCode(receiveQrEl, {
        text: mobileUploadUrl,
        width: 180,
        height: 180,
        colorDark: "#1c1917",
        colorLight: "#ffffff"
    });

    const statusEl = document.getElementById('receive-status');
    if (statusEl) {
        statusEl.innerHTML = `Session PIN: <strong>${receivePin}</strong><br><span style="color: var(--text-muted); font-size: 12px;">Waiting for phone upload...</span>`;
    }

    const pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/status/${receivePin}`);
            if (res.ok) {
                clearInterval(pollInterval);
                let filename = "Received file";
                try {
                    const data = await res.json();
                    if (data && data.filename) {
                        filename = data.filename;
                    }
                } catch (e) {}

                if (statusEl) {
                    statusEl.innerHTML = `
                        <div style="margin-top: 4px;">
                            <div style="font-weight: 700; color: var(--primary-dark); margin-bottom: 3px;">🎉 File ready from phone!</div>
                            <div style="font-size: 13px; color: var(--text-dark); word-break: break-all; margin-bottom: 10px;">${filename}</div>
                            <button id="btnDownloadReceive" class="btn-primary" style="margin-top: 4px;">Download File</button>
                        </div>
                    `;

                    const dlBtn = document.getElementById('btnDownloadReceive');
                    if (dlBtn) {
                        dlBtn.onclick = () => {
                            let authKey = '';
                            if (isAuthRequired) {
                                authKey = getAuthKey('download this file');
                                if (authKey === null || authKey === '') return;
                            }

                            const downloadUrl = `/api/download/${receivePin}${authKey ? `?auth=${encodeURIComponent(authKey)}` : ''}`;
                            window.location.href = downloadUrl;
                            dlBtn.disabled = true;
                            dlBtn.innerText = "Downloading...";
                            setTimeout(() => {
                                statusEl.innerHTML += `<div style="margin-top: 10px; font-size: 12.5px;"><a href="#" onclick="location.reload()" style="color: var(--primary-dark); font-weight: 600; text-decoration: underline;">Receive another file</a></div>`;
                            }, 1500);
                        };
                    }
                }
            }
        } catch (err) {
            // Network poll retry
        }
    }, 2000);
}

// ============================================================================
// Mobile: Upload selected file tied to the scanned Session PIN
// ============================================================================
const mobileFileInput = document.getElementById('mobileFileInput');
const mobileFileName = document.getElementById('mobileFileName');
if (mobileFileInput && mobileFileName) {
    mobileFileInput.addEventListener('change', () => {
        if (mobileFileInput.files && mobileFileInput.files.length > 0) {
            mobileFileName.textContent = mobileFileInput.files[0].name;
            mobileFileName.style.color = '#ea580c';
            mobileFileName.style.fontWeight = '600';
        } else {
            mobileFileName.textContent = 'No file chosen';
            mobileFileName.style.color = 'var(--text-muted)';
            mobileFileName.style.fontWeight = 'normal';
        }
    });
}

async function uploadFromMobile() {
    const fileInput = document.getElementById('mobileFileInput');
    const statusEl = document.getElementById('mobile-status');

    if (!fileInput || fileInput.files.length === 0) {
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.innerText = "Please select a file first.";
        }
        return;
    }

    let authKey = '';
    if (isAuthRequired) {
        authKey = getAuthKey('upload to computer');
        if (authKey === null || authKey === '') {
            if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.innerText = "Upload cancelled: Auth key is required.";
            }
            return;
        }
    }

    const file = fileInput.files[0];
    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.innerText = "Uploading to computer...";
    }

    try {
        const headers = {
            'X-File-Name': encodeURIComponent(file.name),
            'X-Session-Pin': sessionPin
        };
        if (authKey) {
            headers['X-Auth-Key'] = authKey;
        }

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: headers,
            body: file
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("Invalid Auth Key");
            throw new Error(`HTTP ${response.status}`);
        }

        if (statusEl) {
            statusEl.innerHTML = `<span style="color: var(--primary-dark); font-weight: 700;">✅ Upload complete!</span><br>Check your computer screen to download.`;
        }
    } catch (error) {
        if (statusEl) statusEl.innerText = "Upload failed: " + error.message;
    }
}

// ============================================================================
// Recipient / Mobile: Download file from link action
// ============================================================================
function downloadFromLink() {
    if (!sessionPin) return;
    const dlBtn = document.getElementById('btn-download-action');
    const statusEl = document.getElementById('download-status');

    let authKey = '';
    if (isAuthRequired) {
        authKey = getAuthKey('download this file');
        if (authKey === null || authKey === '') {
            if (statusEl) statusEl.innerText = "Download cancelled: Auth key is required.";
            return;
        }
    }

    const downloadUrl = `/api/download/${sessionPin}${authKey ? `?auth=${encodeURIComponent(authKey)}` : ''}`;
    window.location.href = downloadUrl;
    if (dlBtn) {
        dlBtn.disabled = true;
        dlBtn.innerText = "Downloading...";
    }
}

// ============================================================================
// Initialize App Views
// ============================================================================
async function initApp() {
    await checkAuthConfig();

    // 1. Mobile Upload View (?action=upload&pin=XXXX)
    if (action === 'upload' && sessionPin) {
        const desktopView = document.getElementById('desktop-view');
        const mobileUploadView = document.getElementById('mobile-upload-view');
        if (desktopView) desktopView.classList.add('hidden');
        if (mobileUploadView) {
            mobileUploadView.classList.remove('hidden');
            const pinLabel = document.getElementById('mobile-pin-label');
            if (pinLabel) pinLabel.innerHTML = `Session PIN: <strong>${sessionPin}</strong>`;
        }
    } 
    // 2. Mobile Download View (?action=download&pin=XXXX)
    else if (action === 'download' && sessionPin) {
        const desktopView = document.getElementById('desktop-view');
        const mobileDownloadView = document.getElementById('mobile-download-view');
        if (desktopView) desktopView.classList.add('hidden');
        if (mobileDownloadView) {
            mobileDownloadView.classList.remove('hidden');
            const pinLabel = document.getElementById('download-pin-label');
            if (pinLabel) pinLabel.innerHTML = `PIN: <strong>${sessionPin}</strong>`;
        }
    } 
    // 3. Desktop Mode
    else {
        initDesktopReceive();
        setTimeout(calculateRestPosition, 100);
        setTimeout(resizeCanvases, 100);
    }
}

// Start application
initApp();