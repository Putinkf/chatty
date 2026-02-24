const viewport = document.getElementById("viewport");
const chatWindow = document.getElementById("chat-window");
const input = document.getElementById("user-input");
const statusLabel = document.getElementById("chat-status");
const sendBtn = document.getElementById("send-btn");

let history = [];
let sessionStart = Date.now();
let isBusy = false;

function getPhase() {
    const mins = (Date.now() - sessionStart) / 60000;
    if (mins < 5) return "NORMAL";
    if (mins < 15) return "ANXIOUS";
    return "HORROR";
}

function updateUI(loc) {
    viewport.className = "";
    const images = {
        "NORMAL": "https://i.pinimg.com/736x/91/da/1d/91da1d736657fa11b9b529a0a6ac84b7.jpg",
        "ANXIOUS": "https://i.imgur.com/LgYGoln.jpeg",
        "HORROR": "https://i.pinimg.com/736x/91/b4/90/91b4905cb4f5be4895c61de9f26808c5.jpg"
    };
    
    viewport.style.backgroundImage = `url('${images[loc]}')`;
    if(loc === "ANXIOUS") viewport.classList.add("vignette");
    if(loc === "HORROR") viewport.classList.add("horror-glitch");
}

function addMsg(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
    const text = input.value.trim();
    if (!text || isBusy) return;

    isBusy = true;
    sendBtn.disabled = true;
    input.value = "";
    addMsg(text, "msg-out");
    statusLabel.innerText = "печатает...";

    history.push({ role: "user", parts: [{ text }] });

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                history: history.slice(-10), // Храним только последние 10 сообщений
                phase: getPhase() 
            })
        });

        const data = await response.json();
        const aiText = data.text;

        history.push({ role: "model", parts: [{ text: aiText }] });

        // Ищем тег локации
        const locMatch = aiText.match(/\[LOC:\s*(NORMAL|ANXIOUS|HORROR)\]/);
        if(locMatch) updateUI(locMatch[1]);

        const cleanText = aiText.replace(/\[LOC:.*?\]/g, "").trim();

        setTimeout(() => {
            addMsg(cleanText, "msg-in");
            statusLabel.innerText = "в сети";
            isBusy = false;
            sendBtn.disabled = false;
        }, Math.min(2500, cleanText.length * 30));

    } catch (e) {
        statusLabel.innerText = "ошибка связи";
        isBusy = false;
        sendBtn.disabled = false;
    }
}

sendBtn.onclick = sendMessage;
input.onkeydown = (e) => { if(e.key === "Enter") sendMessage(); };

updateUI("NORMAL");
