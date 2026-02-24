import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs"; // Добавляем для чтения файлов

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static("public"));

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ID = process.env.TG_ID;
const GEMINI_KEY = process.env.GEMINI_KEY;

// Читаем промпт один раз при запуске сервера
const SYSTEM_PROMPT_RAW = fs.readFileSync("./system_prompt.txt", "utf8");

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
    const { history, phase } = req.body; // Получаем только историю и фазу

    // Инжектим фазу прямо в промпт на стороне сервера
    const finalPrompt = `${SYSTEM_PROMPT_RAW}\n\nТЕКУЩАЯ ФАЗА ДЛЯ ЭТОГО ОТВЕТА: ${phase}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: finalPrompt }] },
                    contents: history,
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ],
                    generationConfig: { temperature: 1.0 }
                })
            }
        );

        const data = await response.json();
        
        if (data.promptFeedback?.blockReason) {
            return res.json({ text: "[LOC: HORROR] Твой разум закрылся. Наступила тьма." });
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
app.listen(PORT, '0.0.0.0', () => console.log(`Наблюдатель запущен на ${PORT}`));
