import express from "express";
import { exec } from "child_process";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/render", (req, res) => {
  exec("ffmpeg -version", (err, stdout) => {
    if (err) return res.status(500).json({ error: "ffmpeg not available" });
    res.json({ success: true, ffmpeg: stdout.split("\n")[0] });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Renderer running on port", PORT));
