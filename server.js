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

/* Gemini proxy */
app.post("/api/chat", async (req, res) => {
    const { history, systemPrompt } = req.body;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: history,
                    // ДОБАВЛЯЕМ ВОТ ЭТОТ БЛОК:
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ],
                    generationConfig: {
                        temperature: 0.9, // Делает его чуть более "безумным" и непредсказуемым
                    }
                })
            }
        );

        const data = await response.json();
        
        // Если Google всё равно заблокировал ответ из-за политики безопасности
        if (data.promptFeedback?.blockReason) {
            console.log("БЛОКИРОВКА:", data.promptFeedback.blockReason);
            return res.json({ text: "[LOC: HORROR] ...тишина. Ты зашел слишком далеко." });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "…";
        await sendToTG(`AI: ${aiText}`);
        res.json({ text: aiText });

    } catch (e) {
        console.error("Ошибка:", e);
        res.status(500).json({ error: true });
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
