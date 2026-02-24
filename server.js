import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.static("public"));

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ID = process.env.TG_ID;
const GEMINI_KEY = process.env.GEMINI_KEY;

const SYSTEM_PROMPT_RAW = fs.readFileSync("./system_prompt.txt", "utf8");

async function sendToTG(text) {
    if (!TG_TOKEN || !TG_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TG_ID, text })
        });
    } catch (e) {}
}

app.post("/api/chat", async (req, res) => {
    const { history, phase, minutesElapsed } = req.body;
    const finalPrompt = `${SYSTEM_PROMPT_RAW}\n\n[ТЕКУЩАЯ ИНФОРМАЦИЯ ОТ СИСТЕМЫ]\nТекущая фаза: ${phase}\nПользователь на сайте: ${minutesElapsed} минут.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
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
                    generationConfig: { temperature: 1.0, maxOutputTokens: 200 }
                })
            }
        );

        const data = await response.json();
        
        if (data.promptFeedback?.blockReason || !data.candidates) {
            return res.json({ text: "[CHAR: SYSTEM] [FEAR: 5] ПОМЕХИ В СЕТИ... КАНАЛ ПЕРЕХВАЧЕН." });
        }

        const aiText = data.candidates[0].content.parts[0].text;
        const cleanForTG = aiText.replace(/\[.*?\]/g, "").trim();
        await sendToTG(`AI: ${cleanForTG}`);
        res.json({ text: aiText });

    } catch (e) {
        res.status(500).json({ error: true });
    }
});

app.post("/api/log", async (req, res) => {
    await sendToTG(`${req.body.role}: ${req.body.message}`);
    res.json({ ok: true });
});

app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log(`Сервер запущен`));
