import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Чтобы фотки пролезали
app.use(express.static("public"));

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ID = process.env.TG_ID;
const GEMINI_KEY = process.env.GEMINI_KEY;

async function sendToTG(text) {
    if (!TG_TOKEN || !TG_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TG_ID, text })
        });
    } catch (e) { console.log("TG error:", e.message); }
}

app.post("/api/chat", async (req, res) => {
    const { history, systemPrompt } = req.body;

    try {
        // Мы используем ТВОЙ рабочий URL и ТВОЙ метод из локалки
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`,
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

        const data = await response.json();

        // Если Google выдал ошибку, прокидываем её для дебага
        if (data.error) {
            console.error("ГЕМИНИ ГОВОРИТ:", data.error);
            return res.status(400).json(data.error);
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "…";
        await sendToTG(`AI: ${aiText}`);
        res.json({ text: aiText });

    } catch (e) {
        console.error("Ошибка сервера:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/log", async (req, res) => {
    const { role, message } = req.body;
    await sendToTG(`${role}: ${message}`);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер взлетает на порту ${PORT}`);
});
