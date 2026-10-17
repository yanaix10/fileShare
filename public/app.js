const params = new URLSearchParams(window.location.search);
const action = params.get('action');
const sessionPin = params.get('pin');

// Authentication key handling (inherited from URL or localStorage)
let currentAuthKey = params.get('auth') || localStorage.getItem('fileShare_auth') || '';
if (params.get('auth')) {
    localStorage.setItem('fileShare_auth', params.get('auth'));
}

// Generate a random 4-character alphanumeric PIN on the client
function generateClientPin() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let pin = '';
    for (let i = 0; i < 4; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

// Check if server requires authentication
async function initApp() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const config = await res.json();
            if (config.authRequired && !currentAuthKey) {
                const entered = prompt("This server is protected with an Access Key. Please enter the Access Key (AUTH_KEY):");
                if (entered) {
                    currentAuthKey = entered.trim();
                    localStorage.setItem('fileShare_auth', currentAuthKey);
                }
            }
        }
    } catch (e) {
        // Continue if config check fails
    }

    // 1. Check if opened on Mobile via QR scan (?action=upload&pin=XXXX)
    if (action === 'upload' && sessionPin) {
        document.getElementById('desktop-view').classList.add('hidden');
        document.getElementById('mobile-upload-view').classList.remove('hidden');
        document.getElementById('mobile-pin-label').innerText = `Session PIN: ${sessionPin}`;
    } else {
        // 2. Initialize Desktop Mode
        initDesktopReceive();
    }
}

initApp();

// Update file name labels when a file is chosen
const pcFileInput = document.getElementById('pcFileInput');
const pcFileName = document.getElementById('pcFileName');
if (pcFileInput && pcFileName) {
    pcFileInput.addEventListener('change', () => {
        const qrContainer = document.getElementById('send-qr');
        const statusEl = document.getElementById('send-status');
        if (qrContainer) {
            qrContainer.classList.add('hidden');
            qrContainer.innerHTML = '';
        }
        if (statusEl) {
            statusEl.innerText = '';
        }
        if (pcFileInput.files && pcFileInput.files.length > 0) {
            pcFileName.textContent = pcFileInput.files[0].name;
            pcFileName.style.color = '#ffffff';
            pcFileName.style.fontWeight = '600';
        } else {
            pcFileName.textContent = 'No file chosen';
            pcFileName.style.color = '#bbf7d0';
            pcFileName.style.fontWeight = 'normal';
        }
    });
}

const mobileFileInput = document.getElementById('mobileFileInput');
const mobileFileName = document.getElementById('mobileFileName');
if (mobileFileInput && mobileFileName) {
    mobileFileInput.addEventListener('change', () => {
        if (mobileFileInput.files && mobileFileInput.files.length > 0) {
            mobileFileName.textContent = mobileFileInput.files[0].name;
            mobileFileName.style.color = '#ffffff';
            mobileFileName.style.fontWeight = '600';
        } else {
            mobileFileName.textContent = 'No file chosen';
            mobileFileName.style.color = '#bbf7d0';
            mobileFileName.style.fontWeight = 'normal';
        }
    });
}

// Desktop: Setup "Receive File" QR & poll server until phone uploads the file
function initDesktopReceive() {
    const receivePin = generateClientPin();
    const authQuery = currentAuthKey ? `&auth=${encodeURIComponent(currentAuthKey)}` : '';
    const mobileUploadUrl = `${window.location.origin}/?action=upload&pin=${receivePin}${authQuery}`;
    
    new QRCode(document.getElementById('receive-qr'), {
        text: mobileUploadUrl,
        width: 180,
        height: 180
    });

    const statusEl = document.getElementById('receive-status');
    statusEl.innerHTML = `Session PIN: <strong>${receivePin}</strong><br>Waiting for phone upload...`;

    const pollInterval = setInterval(async () => {
        try {
            const statusUrl = `/api/status/${receivePin}${currentAuthKey ? `?auth=${encodeURIComponent(currentAuthKey)}` : ''}`;
            const res = await fetch(statusUrl, {
                headers: currentAuthKey ? { 'X-Auth-Key': currentAuthKey } : {}
            });
            if (res.ok) {
                clearInterval(pollInterval);
                let filename = "Received file";
                try {
                    const data = await res.json();
                    if (data && data.filename) {
                        filename = data.filename;
                    }
                } catch (e) {}

                statusEl.innerHTML = `
                    <div style="margin-top: 10px;">
                        <div style="font-weight: 600; color: #ffffff; margin-bottom: 3px;">File ready from phone:</div>
                        <div style="font-size: 13px; color: #d1fae5; word-break: break-all; margin-bottom: 10px;">${filename}</div>
                        <button id="btnDownloadReceive" style="background-color: #ffffff; color: #14532d; padding: 8px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; border: 1px solid #ffffff;">Download File</button>
                    </div>
                `;

                const dlBtn = document.getElementById('btnDownloadReceive');
                if (dlBtn) {
                    dlBtn.onclick = () => {
                        const downloadUrl = `/api/download/${receivePin}${currentAuthKey ? `?auth=${encodeURIComponent(currentAuthKey)}` : ''}`;
                        window.location.href = downloadUrl;
                        dlBtn.disabled = true;
                        dlBtn.innerText = "Downloading...";
                        setTimeout(() => {
                            statusEl.innerHTML += `<div style="margin-top: 8px; font-size: 12px;"><a href="#" onclick="location.reload()" style="color: #86efac; text-decoration: underline;">Receive another file</a></div>`;
                        }, 1500);
                    };
                }
            }
        } catch (err) {
            // Ignore network hiccups while polling
        }
    }, 2000);
}

// Desktop: Upload a file from PC and generate a download QR code for the phone
async function uploadFromPC() {
    const fileInput = document.getElementById('pcFileInput');
    const statusEl = document.getElementById('send-status');
    const qrContainer = document.getElementById('send-qr');

    if (fileInput.files.length === 0) {
        statusEl.innerText = "Please select a file first.";
        qrContainer.classList.add('hidden');
        return;
    }

    const file = fileInput.files[0];
    statusEl.innerText = "Uploading to server...";
    qrContainer.innerHTML = "";
    qrContainer.classList.add('hidden');

    try {
        const headers = {
            'X-File-Name': encodeURIComponent(file.name)
        };
        if (currentAuthKey) {
            headers['X-Auth-Key'] = currentAuthKey;
        }

        const uploadUrl = `/api/upload${currentAuthKey ? `?auth=${encodeURIComponent(currentAuthKey)}` : ''}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: headers,
            body: file
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("Unauthorized: Invalid access key. Check AUTH_KEY.");
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const authParam = currentAuthKey ? `?auth=${encodeURIComponent(currentAuthKey)}` : '';
        const downloadUrl = `${window.location.origin}/api/download/${data.pin}${authParam}`;

        qrContainer.classList.remove('hidden');
        new QRCode(qrContainer, {
            text: downloadUrl,
            width: 180,
            height: 180
        });

        statusEl.innerHTML = `Scan with phone to download (PIN: <strong>${data.pin}</strong>)<br>Auto-deletes in 5 minutes.`;
    } catch (error) {
        qrContainer.classList.add('hidden');
        statusEl.innerText = "Upload failed: " + error.message;
    }
}

// Mobile: Upload selected file tied to the scanned Session PIN
async function uploadFromMobile() {
    const fileInput = document.getElementById('mobileFileInput');
    const statusEl = document.getElementById('mobile-status');

    if (fileInput.files.length === 0) {
        statusEl.innerText = "Please select a file first.";
        return;
    }

    const file = fileInput.files[0];
    statusEl.innerText = "Uploading to computer...";

    try {
        const headers = {
            'X-File-Name': encodeURIComponent(file.name),
            'X-Session-Pin': sessionPin
        };
        if (currentAuthKey) {
            headers['X-Auth-Key'] = currentAuthKey;
        }

        const uploadUrl = `/api/upload${currentAuthKey ? `?auth=${encodeURIComponent(currentAuthKey)}` : ''}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: headers,
            body: file
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("Unauthorized: Invalid access key.");
            }
            throw new Error(`HTTP ${response.status}`);
        }

        statusEl.innerText = "Upload complete! Check your computer screen.";
    } catch (error) {
        statusEl.innerText = "Upload failed: " + error.message;
    }
}