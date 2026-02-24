const viewport = document.getElementById("viewport");
const chatWindow = document.getElementById("chat-window");
const input = document.getElementById("user-input");
const statusLabel = document.getElementById("chat-status");
const sendBtn = document.getElementById("send-btn");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const chatName = document.getElementById("chat-name");

const sndGlitch = document.getElementById("snd-glitch");
const sndScream = document.getElementById("snd-scream");
const jumpscare = document.getElementById("jumpscare");

let history = [];
let sessionStart = Date.now();
let isBusy = false;

const charColors = {
    "Дима": "#52d373",
    "Наблюдатель": "#ff5252",
    "Елена": "#e170ff",
    "System": "#ffaa00"
};

// Активация звуков после клика (требование браузеров)
document.addEventListener('click', function initAudio() {
    sndGlitch.play().then(() => { sndGlitch.pause(); });
    sndScream.play().then(() => { sndScream.pause(); });
    document.removeEventListener('click', initAudio);
}, { once: true });

function getMinutes() { return Math.floor((Date.now() - sessionStart) / 60000); }
function getPhase() {
    const mins = getMinutes();
    if (mins < 10) return "NORMAL";
    if (mins < 20) return "ANXIOUS";
    return "HORROR";
}

function triggerJumpscare() {
    if (sndScream) { sndScream.currentTime = 0; sndScream.play().catch(()=>{}); }
    jumpscare.classList.add("jump-active");
    setTimeout(() => jumpscare.classList.remove("jump-active"), 1000);
}

function updateUI(loc) {
    viewport.className = "";
    if(loc === "NORMAL") viewport.style.backgroundImage = "url('https://i.pinimg.com/736x/91/da/1d/91da1d736657fa11b9b529a0a6ac84b7.jpg')";
    if(loc === "ANXIOUS") {
        viewport.style.backgroundImage = "url('https://i.imgur.com/LgYGoln.jpeg')";
        viewport.classList.add("vignette");
    }
    if(loc === "HORROR") {
        viewport.style.backgroundImage = "url('https://i.pinimg.com/736x/91/b4/90/91b4905cb4f5be4895c61de9f26808c5.jpg')";
        viewport.classList.add("horror-glitch");
    }
}

function addMsg(text, type, senderName = "", imgUrl = null) {
    const wrapper = document.createElement("div");
    wrapper.className = `msg-wrapper ${type === 'msg-in' ? 'left' : 'right'}`;

    if (type === 'msg-in' && senderName) {
        const nameDiv = document.createElement("div");
        nameDiv.className = "sender-name";
        nameDiv.innerText = senderName;
        nameDiv.style.color = charColors[senderName] || "#4ea4f5";
        wrapper.appendChild(nameDiv);
    }

    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;

    if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl; img.className = "msg-img";
        div.appendChild(img);
    }

    wrapper.appendChild(div);
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
    const text = input.value.trim();
    if (!text || isBusy) return;
    input.value = "";
    addMsg(text, "msg-out");
    history.push({ role: "user", parts: [{ text }] });
    fetch("/api/log", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({role: "USER", message: text}) });
    await sendToAPI();
}

async function sendToAPI() {
    isBusy = true; sendBtn.disabled = true; attachBtn.disabled = true;
    statusLabel.innerText = "печатает...";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                history: history.slice(-15), 
                phase: getPhase(),
                minutesElapsed: getMinutes()
            })
        });

        const data = await response.json();
        const aiRaw = data.text;
        history.push({ role: "model", parts: [{ text: aiRaw }] });

        const charMatch = aiRaw.match(/\[CHAR:\s*(.*?)\]/i);
        const fearMatch = aiRaw.match(/\[FEAR:\s*(\d+)\]/i);
        const renameMatch = aiRaw.match(/\[COMMAND:\s*RENAME\s*(.*?)\]/i);
        const clearMatch = aiRaw.match(/\[COMMAND:\s*CLEAR\]/i);
        const locMatch = aiRaw.match(/\[LOC:\s*(.*?)\]/i);

        if (clearMatch) chatWindow.innerHTML = "";
        if (renameMatch) chatName.innerText = renameMatch[1];
        if (locMatch) updateUI(locMatch[1].toUpperCase());
        if (fearMatch && parseInt(fearMatch[1]) >= 9) triggerJumpscare();
        else if (sndGlitch) { sndGlitch.currentTime = 0; sndGlitch.play().catch(()=>{}); }

        const currentSender = charMatch ? charMatch[1] : "Наблюдатель";
        const cleanText = aiRaw.replace(/\[.*?\]/g, "").trim();

        setTimeout(() => {
            if(cleanText) addMsg(cleanText, "msg-in", currentSender);
            statusLabel.innerText = "в сети";
            isBusy = false; sendBtn.disabled = false; attachBtn.disabled = false;
        }, 1500);

    } catch (e) {
        statusLabel.innerText = "ошибка";
        isBusy = false; sendBtn.disabled = false; attachBtn.disabled = false;
    }
}

// Кнопка фото
attachBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addMsg("Отправил фото", "msg-out", "", url);
    history.push({ role: "user", parts: [{ text: "Я отправил фото своей комнаты (обряд начат)." }] });
    sendToAPI();
};

sendBtn.onclick = sendMessage;
input.onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
updateUI("NORMAL");
