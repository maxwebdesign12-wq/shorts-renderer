const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ---------- HEALTH CHECK ----------
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ---------- RENDER ENDPOINT ----------
app.post("/render", (req, res) => {
  const { audioUrl } = req.body;

  if (!audioUrl) {
    return res.status(400).json({ error: "audioUrl required" });
  }

  const output = `output-${Date.now()}.mp4`;

  // RESPOND IMMEDIATELY (IMPORTANT)
  res.status(202).json({
    message: "Render started",
    outputFile: output
  });

  // BACKGROUND RENDER
  const cmd = `
    ffmpeg -y \
    -i assets/bg.mp4 \
    -i "${audioUrl}" \
    -map 0:v:0 -map 1:a:0 \
    -shortest \
    -vf "scale=1080:1920,setsar=1" \
    -c:v libx264 -preset ultrafast -crf 23 \
    -c:a aac \
    ${output}
  `;

  exec(cmd, (err) => {
    if (err) {
      console.error("FFmpeg error:", err);
      return;
    }
    console.log("Render finished:", output);
  });
});

app.listen(PORT, () => {
  console.log("Renderer running on port", PORT);
});
