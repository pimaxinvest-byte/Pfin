const express = require("express");
const path = require("path");
const db = require("./db");
const nvidia = require("./lib/nvidia");
const exforms = require("./lib/ex-forms");

const app = express();
const PORT = process.env.PORT || 3000;
const PIN = process.env.AGENCY_PIN || "pimax2026";

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

function agencyOk(req) {
  const pin = req.get("x-agency-pin") || (req.body && req.body.pin) || "";
  return pin && pin === PIN;
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, service: "pfin-lab", db: db.enabled(), ai: nvidia.enabled() });
});

app.post("/api/dossier", async (req, res) => {
  const body = req.body || {};
  const pack = exforms.renderForms(body);
  let ai = null;
  let aiError = null;
  if (nvidia.enabled()) {
    try {
      ai = await nvidia.personalize({
        given: body.given,
        surnames: body.surnames,
        nationality: body.nationality,
        passNo: body.passNo || body.passport_no,
        sex: body.sex,
        dob: body.dob,
        mrz: body.mrz,
        profile: body.profile,
        family: body.family,
        address: body.address
      });
    } catch (err) {
      aiError = err.message;
    }
  }
  res.json({ ok: true, ai: Boolean(ai), aiError, defaultAddress: pack.defaultAddress, who: pack.who, forms: pack.forms, html: pack.html, personalize: ai });
});

app.post("/api/agency/unlock", (req, res) => {
  if (!agencyOk(req)) return res.status(401).json({ ok: false });
  res.json({ ok: true, db: db.enabled() });
});

app.post("/api/cases", async (req, res) => {
  try {
    if (!db.enabled()) return res.status(503).json({ ok: false, error: "database_offline" });
    const saved = await db.upsertCase(req.body || {});
    res.json({ ok: true, ...saved });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/cases/:q", async (req, res) => {
  try {
    if (!db.enabled()) return res.status(503).json({ ok: false, error: "database_offline" });
    const found = await db.getCase(req.params.q);
    if (!found) return res.status(404).json({ ok: false });
    const pub = {
      ref: found.case.ref, email: found.case.email, given: found.case.given_name, surnames: found.case.surnames,
      nationality: found.case.nationality, passNo: found.case.passport_no, dest: found.case.dest_ccaa,
      days: found.case.days_es, total: found.case.total_eur, irpfNet: found.case.irpf_net_eur,
      services: found.services.map((s) => ({ id: s.id, es: s.name_es, en: s.name_en, fr: s.name_fr })),
      documents: found.documents.map((d) => ({ kind: d.kind, filename: d.filename }))
    };
    res.json({ ok: true, case: pub });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/agency/cases", async (req, res) => {
  if (!agencyOk(req)) return res.status(401).json({ ok: false });
  try {
    if (!db.enabled()) return res.status(503).json({ ok: false, error: "database_offline" });
    res.json({ ok: true, cases: await db.listCases(80) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/agency/catalog", async (req, res) => {
  if (!agencyOk(req)) return res.status(401).json({ ok: false });
  try {
    if (!db.enabled()) return res.status(503).json({ ok: false, error: "database_offline" });
    res.json({ ok: true, catalog: await db.catalog() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/agencia", (_req, res) => res.sendFile(path.join(__dirname, "public", "agencia.html")));
app.get("/expediente", (_req, res) => res.sendFile(path.join(__dirname, "public", "expediente.html")));
app.get("/fiscal", (_req, res) => res.sendFile(path.join(__dirname, "public", "fiscal.html")));

async function boot() {
  if (db.enabled()) {
    try { console.log("postgres migrate", await db.migrate()); }
    catch (err) { console.error("postgres migrate failed", err.message); }
  } else {
    console.log("DATABASE_URL missing — API persistente desactivada");
  }
  app.listen(PORT, "0.0.0.0", () => console.log("pfin-lab listening on " + PORT));
}
boot();
