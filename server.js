import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 10000;

// ---------- helpers ----------
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts });
    let stderr = "";

    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", (err) => reject(err));
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${cmd} failed with code ${code}`));
    });
  });
}

async function downloadToFile(url, outPath) {
  // curl is simplest on Render images
  await run("curl", ["-L", url, "-o", outPath]);
}

function safeExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// ---------- routes ----------
app.get("/", (_req, res) => res.status(200).send("OK - shorts-renderer is running"));
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * POST /render
 * Body JSON:
 * {
 *   "audioUrl": "https://.../voice.mp3",
 *   "backgroundUrl": "https://.../bg.mp4"   // optional (if you want remote bg later)
 * }
 *
 * Default background: assets/bg.mp4
 *
 * Returns: MP4 binary
 */
app.post("/render", async (req, res) => {
  const audioUrl = String(req.body?.audioUrl ?? "").trim();
  const backgroundUrl = String(req.body?.backgroundUrl ?? "").trim();

  if (!audioUrl) {
    return res.status(400).json({ error: "audioUrl is required (direct .mp3 URL)" });
  }

  // Default background in repo
  const localBgPath = path.join(process.cwd(), "assets", "bg.mp4");
  const useLocalBg = safeExists(localBgPath);

  if (!useLocalBg && !backgroundUrl) {
    return res.status(500).json({
      error: "Missing background. Put a video at assets/bg.mp4 OR pass backgroundUrl."
    });
  }

  const id = crypto.randomUUID();
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "render-"));
  const audioPath = path.join(tmpDir, `audio-${id}.mp3`);
  const bgPath = path.join(tmpDir, `bg-${id}.mp4`);
  const outPath = path.join(tmpDir, `out-${id}.mp4`);

  try {
    // Download audio
    await downloadToFile(audioUrl, audioPath);

    // Background: local assets/bg.mp4 OR remote backgroundUrl
    if (useLocalBg) {
      await fs.promises.copyFile(localBgPath, bgPath);
    } else {
      await downloadToFile(backgroundUrl, bgPath);
    }

    // Render: loop bg, add audio, crop to 9:16, output MP4
    // Notes:
    // -stream_loop -1 loops bg forever
    // -shortest ends at audio end
    // scale+crop forces 1080x1920
    await run("ffmpeg", [
      "-y",
      "-stream_loop", "-1",
      "-i", bgPath,
      "-i", audioPath,
      "-shortest",
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "192k",
      outPath
    ]);

    // Return MP4 directly (n8n can capture as binary)
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="short-${id}.mp4"`);

    const stream = fs.createReadStream(outPath);
    stream.on("error", (e) => {
      console.error("stream error:", e);
      res.status(500).end();
    });
    stream.pipe(res);
  } catch (e) {
    console.error("render failed:", e);
    res.status(500).json({ error: e?.message || "render failed" });
  } finally {
    // Cleanup
    try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`Renderer running on port ${PORT}`);
});
