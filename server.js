import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors"; // Добавили импорт CORS

dotenv.config();

const app = express();

// Подключаем CORS, чтобы фронтенд мог без проблем общаться с бэкендом
app.use(cors()); 
app.use(express.json());
// Указываем, что фронтенд лежит в папке public
app.use(express.static("public")); 

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ID = process.env.TG_ID;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3000;

/* Telegram sender */
async function sendToTG(text) {
    if (!TG_TOKEN || !TG_ID) {
        console.log("TG credentials missing!");
        return;
    }

    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TG_ID,
                text: text
            })
        });
    } catch (e) {
        console.error("TG error:", e.message);
    }
}

/* Gemini proxy */
app.post("/api/chat", async (req, res) => {
    const { history, systemPrompt } = req.body;

    try {
        // ИСПРАВЛЕНО: Используем правильное имя модели (gemini-1.5-flash или gemini-2.0-flash)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: history
                })
            }
        );

        if (!response.ok) {
            const errBody = await response.text();
            console.error("Gemini API Error:", errBody);
            throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "…";

        await sendToTG(`ИИ ответил: ${aiText}`);

        res.json({ text: aiText });

    } catch (e) {
        console.error("Server catch block error:", e);
        await sendToTG("⚠️ Ошибка связи с Gemini");
        res.status(500).json({ error: true, details: e.message });
    }
});

/* Relay logs */
app.post("/api/log", async (req, res) => {
    const { role, message } = req.body;
    await sendToTG(`${role} пишет: ${message}`);
    res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
