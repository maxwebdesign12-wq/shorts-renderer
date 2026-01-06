import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 10000;

app.post("/render", async (req, res) => {
  const audioUrl = req.body.audioUrl;

  if (!audioUrl) {
    return res.status(400).json({ error: "audioUrl missing" });
  }

  const output = `output-${Date.now()}.mp4`;

  const cmd = `
    ffmpeg -y \
    -i assets/bg.mp4 \
    -i ${audioUrl} \
    -map 0:v:0 -map 1:a:0 \
    -shortest \
    -vf "scale=1080:1920,setsar=1" \
    -c:v libx264 -preset ultrafast -crf 23 \
    -c:a aac \
    ${output}
  `;

  exec(cmd, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "render failed" });
    }

    res.json({
      success: true,
      file: output
    });
  });
});

app.listen(PORT, () => {
  console.log("Renderer running on port", PORT);
});
