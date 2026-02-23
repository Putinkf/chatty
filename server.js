import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ID = process.env.TG_ID;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3000;

/* Telegram sender */
async function sendToTG(text) {
    if (!TG_TOKEN || !TG_ID) return;

    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TG_ID,
                text
            })
        });
    } catch (e) {
        console.log("TG error:", e.message);
    }
}

/* Gemini proxy */
app.post("/api/chat", async (req, res) => {
    const { history, systemPrompt } = req.body;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
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
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "…";

        await sendToTG(`AI: ${aiText}`);

        res.json({ text: aiText });

    } catch (e) {
        await sendToTG("⚠️ Gemini error");
        res.status(500).json({ error: true });
    }
});

/* Relay logs */
app.post("/api/log", async (req, res) => {
    const { role, message } = req.body;
    await sendToTG(`${role}: ${message}`);
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});