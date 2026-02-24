const viewport = document.getElementById("viewport");
const chatWindow = document.getElementById("chat-window");
const input = document.getElementById("user-input");
const statusLabel = document.getElementById("chat-status");
const sendBtn = document.getElementById("send-btn");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const chatName = document.getElementById("chat-name");
const chatAvatar = document.getElementById("chat-avatar");

const sndGlitch = document.getElementById("snd-glitch");
const sndScream = document.getElementById("snd-scream");
const jumpscare = document.getElementById("jumpscare");

let history = [];
let sessionStart = Date.now();
let isBusy = false;

function getMinutes() { return Math.floor((Date.now() - sessionStart) / 60000); }
function getPhase() {
    const mins = getMinutes();
    if (mins < 10) return "NORMAL";
    if (mins < 20) return "ANXIOUS";
    return "HORROR";
}

function triggerJumpscare() {
    sndScream.currentTime = 0; sndScream.play();
    jumpscare.classList.add("jump-active");
    setTimeout(() => jumpscare.classList.remove("jump-active"), 800);
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

function setCharacter(name) {
    if (!name || name === chatName.innerText) return;
    sndGlitch.play().catch(()=>{});
    chatName.innerText = name;
    chatAvatar.innerText = name.includes("Админ") ? "⚙️" : name.includes("Елена") ? "🩸" : "👁️";
}

function addMsg(text, type, senderName = "Система", imgUrl = null) {
    const messageWrapper = document.createElement("div");
    messageWrapper.className = `msg-wrapper ${type === 'msg-in' ? 'left' : 'right'}`;

    // Имя отправителя над сообщением (только для входящих)
    if (type === 'msg-in') {
        const nameLabel = document.createElement("div");
        nameLabel.className = "sender-name";
        nameLabel.innerText = senderName;
        messageWrapper.appendChild(nameLabel);
    }

    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;

    if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl; img.className = "msg-img";
        div.appendChild(img);
    }

    messageWrapper.appendChild(div);
    chatWindow.appendChild(messageWrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendToAPI() {
    isBusy = true; sendBtn.disabled = true;
    statusLabel.innerText = "печатает...";

    try {
        const response = await fetch("/api/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                history: history.slice(-15), 
                phase: getPhase(),
                minutesElapsed: getMinutes()
            })
        });

        const data = await response.json();
        const aiRaw = data.text;
        history.push({ role: "model", parts: [{ text: aiRaw }] });

        // ПАРСИНГ
        const charMatch = aiRaw.match(/\[CHAR:\s*(.*?)\]/i);
        const locMatch = aiRaw.match(/\[LOC:\s*(.*?)\]/i);
        const fearMatch = aiRaw.match(/\[FEAR:\s*(\d+)\]/i);
        const renameMatch = aiRaw.match(/\[COMMAND:\s*RENAME\s*(.*?)\]/i);
        const clearMatch = aiRaw.match(/\[COMMAND:\s*CLEAR\]/i);

        if (clearMatch) chatWindow.innerHTML = "";
        if (renameMatch) chatName.innerText = renameMatch[1];
        if (locMatch) updateUI(locMatch[1].toUpperCase());
        
        const currentSender = charMatch ? charMatch[1] : "Неизвестный";
        if (fearMatch && parseInt(fearMatch[1]) >= 9) triggerJumpscare();

        const cleanText = aiRaw.replace(/\[.*?\]/g, "").trim();

        setTimeout(() => {
            if(cleanText) addMsg(cleanText, "msg-in", currentSender);
            statusLabel.innerText = "в сети";
            isBusy = false; sendBtn.disabled = false;
        }, 1500);

    } catch (e) {
        statusLabel.innerText = "ошибка";
        isBusy = false; sendBtn.disabled = false;
    }
}

sendBtn.onclick = sendMessage;
input.onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
updateUI("NORMAL");
