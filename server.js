import express from "express";

const app = express();
app.use(express.json({ limit: "10mb" }));

// ✅ health check
app.get("/", (req, res) => res.send("OK - shorts-renderer is running"));
app.get("/health", (req, res) => res.json({ ok: true }));

// ✅ placeholder render endpoint (we’ll add FFmpeg next)
app.post("/render", async (req, res) => {
  const { script, audio_url, background_url } = req.body || {};
  return res.json({
    ok: true,
    received: { script, audio_url, background_url },
    next: "FFmpeg render comes next"
  });
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Renderer running on port ${port}`));
