import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Твой index.html должен лежать в папке public

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function sendToTG(text) {
    if (!process.env.TG_TOKEN || !process.env.TG_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: process.env.TG_ID, text })
        });
    } catch (e) { console.error("TG Error:", e.message); }
}

app.post("/api/chat", async (req, res) => {
    try {
        const { history, systemPrompt } = req.body;
        
        const chat = model.startChat({
            history: history.slice(0, -1).map(h => ({
                role: h.role === "model" ? "model" : "user",
                parts: [{ text: h.parts[0].text }]
            })),
            systemInstruction: systemPrompt
        });

        const lastMessage = history[history.length - 1].parts[0].text;
        const result = await chat.sendMessage(lastMessage);
        const aiText = result.response.text();

        await sendToTG(`ИИ ответил: ${aiText}`);
        res.json({ text: aiText });
    } catch (e) {
        console.error("Gemini Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/log", async (req, res) => {
    const { role, message } = req.body;
    await sendToTG(`${role}: ${message}`);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
