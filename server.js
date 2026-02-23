import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch"; // Оставляем для Telegram
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // Используем стабильную модель
});

// Функция для Telegram (оставляем как была)
async function sendToTG(text) {
    try {
        await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: process.env.TG_ID, text })
        });
    } catch (e) { console.log("TG error:", e.message); }
}

app.post("/api/chat", async (req, res) => {
    const { history, systemPrompt } = req.body;

    try {
        // Формируем чат с системной инструкцией
        const chat = model.startChat({
            history: history.map(item => ({
                role: item.role === "model" ? "model" : "user",
                parts: [{ text: item.parts[0].text }],
            })),
            systemInstruction: systemPrompt,
        });

        // Берем последнее сообщение пользователя
        const lastUserMsg = history[history.length - 1].parts[0].text;
        const result = await chat.sendMessage(lastUserMsg);
        const response = await result.response;
        const aiText = response.text();

        await sendToTG(`ИИ: ${aiText}`);
        res.json({ text: aiText });

    } catch (e) {
        console.error("Ошибка Gemini SDK:", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
