const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PIN = process.env.AGENCY_PIN || "pimax2026";

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pfin-lab" });
});

app.post("/api/agency/unlock", (req, res) => {
  const pin = String((req.body && req.body.pin) || "");
  if (pin && pin === PIN) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.get("/agencia", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "agencia.html"));
});

app.get("/expediente", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "expediente.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("pfin-lab listening on " + PORT);
});
