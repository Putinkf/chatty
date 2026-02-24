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

function addMsg(text, type, imgUrl = null) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl; img.className = "msg-img";
        div.appendChild(img);
    }
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Конвертация картинки в Base64 (и сжатие, чтобы не убить сервер)
async function fileToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(",")[1]); // Берем только данные
        reader.readAsDataURL(file);
    });
}

attachBtn.onclick = () => fileInput.click();
fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    
    // Показываем фото в чате
    const objUrl = URL.createObjectURL(file);
    addMsg("Фото отправлено", "msg-out", objUrl);
    
    const base64Data = await fileToBase64(file);
    const mime = file.type;
    
    // Формируем кусок для Gemini
    const imagePart = { inlineData: { data: base64Data, mimeType: mime } };
    history.push({ role: "user", parts: [{ text: "Я отправил фото комнаты." }, imagePart] });
    
    fileInput.value = ""; // сброс
    sendToAPI();
};

async function sendMessage() {
    const text = input.value.trim();
    if (!text || isBusy) return;

    input.value = "";
    addMsg(text, "msg-out");
    history.push({ role: "user", parts: [{ text }] });
    fetch("/api/log", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({role: "USER", message: text})});
    
    sendToAPI();
}

async function sendToAPI() {
    isBusy = true; sendBtn.disabled = true; attachBtn.disabled = true;
    statusLabel.innerText = "печатает...";

    try {
        const response = await fetch("/api/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                history: history.slice(-12), 
                phase: getPhase(),
                minutesElapsed: getMinutes()
            })
        });

        const data = await response.json();
        const aiRaw = data.text;
        history.push({ role: "model", parts: [{ text: aiRaw }] });

        // ПАРСИНГ ТЕГОВ
        const charMatch = aiRaw.match(/\[CHAR:\s*(.*?)\]/i);
        const locMatch = aiRaw.match(/\[LOC:\s*(NORMAL|ANXIOUS|HORROR)\]/i);
        const fearMatch = aiRaw.match(/\[FEAR:\s*(\d+)\]/i);
        const clearMatch = aiRaw.match(/\[COMMAND:\s*CLEAR\]/i);

        if (clearMatch) chatWindow.innerHTML = "";
        if (locMatch) updateUI(locMatch[1].toUpperCase());
        if (charMatch) setCharacter(charMatch[1]);
        
        // ШКАЛА СТРАХА -> СКРИМЕР
        if (fearMatch) {
            const fearLevel = parseInt(fearMatch[1]);
            if (fearLevel >= 9) triggerJumpscare();
        }

        // Чистим текст для пользователя (удаляем все в квадратных скобках)
        const cleanText = aiRaw.replace(/\[.*?\]/g, "").trim();

        setTimeout(() => {
            if(cleanText) addMsg(cleanText, "msg-in");
            statusLabel.innerText = "в сети";
            isBusy = false; sendBtn.disabled = false; attachBtn.disabled = false;
        }, Math.min(2000, cleanText.length * 30));

    } catch (e) {
        statusLabel.innerText = "связь потеряна...";
        isBusy = false; sendBtn.disabled = false; attachBtn.disabled = false;
    }
}

sendBtn.onclick = sendMessage;
input.onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };
updateUI("NORMAL");
