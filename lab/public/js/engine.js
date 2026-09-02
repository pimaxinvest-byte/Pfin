window.PFin = window.PFin || {};
PFin.SERVICES = [
  {id:"nie", es:"NIE (EX-15)", en:"NIE (EX-15)", fr:"NIE (EX-15)", fee:350},
  {id:"niepoa", es:"NIE desde el extranjero", en:"NIE from abroad", fr:"NIE depuis l\u2019étranger", fee:400},
  {id:"padron", es:"Empadronamiento", en:"Padron", fr:"Empadronamiento", fee:160},
  {id:"tie", es:"TIE / huellas", en:"TIE", fr:"TIE", fee:200},
  {id:"nlv", es:"Residencia no lucrativa", en:"Non-lucrative residence", fr:"Résidence non lucrative", fee:1595},
  {id:"nlvfam", es:"Familiar no lucrativa", en:"NLV family member", fr:"Membre famille NLV", fee:400},
  {id:"dnv", es:"Visado nómada digital", en:"Digital nomad visa", fr:"Visa nomade digital", fee:1195},
  {id:"arraigo", es:"Arraigo", en:"Arraigo", fr:"Arraigo", fee:800},
  {id:"taxrep", es:"Informe fiscal Canadá–España", en:"Canada–Spain tax report", fr:"Rapport fiscal", fee:1090},
  {id:"m100", es:"Modelo 100 IRPF", en:"Form 100", fr:"Modèle 100", fee:465},
  {id:"m720", es:"Modelo 720", en:"Form 720", fr:"Modèle 720", fee:350},
  {id:"m714", es:"Patrimonio / ITSGF", en:"Wealth tax", fr:"Patrimoine", fee:530},
  {id:"trad", es:"Traducción jurada", en:"Sworn translation", fr:"Traduction assermentée", fee:80},
  {id:"apos", es:"Apostilla", en:"Apostille", fr:"Apostille", fee:140}
];
PFin.recommend = function (p) {
  const ids = new Set(["taxrep", "nie"]);
  const days = Number(p.days || 0);
  const wealth = Number(p.wealth || 0);
  const dest = p.dest || "andalucia";
  if (p.fromAbroad !== false) ids.add("niepoa");
  if (p.profile !== "worker" && p.profile !== "nomad") ids.add("nlv");
  if (p.profile === "nomad") ids.add("dnv");
  if (days >= 90 || ids.has("nlv") || ids.has("dnv")) { ids.add("padron"); ids.add("tie"); ids.add("trad"); ids.add("apos"); }
  if (days > 183) ids.add("m100");
  if (wealth >= 50000) ids.add("m720");
  if (wealth >= 700000 && dest !== "andalucia" && dest !== "madrid") ids.add("m714");
  if (Number(p.family || 0) > 0 && ids.has("nlv")) ids.add("nlvfam");
  if (p.arraigo) ids.add("arraigo");
  return PFin.SERVICES.filter((s) => ids.has(s.id));
};
PFin.irpf = function (base) {
  const b = [[12450, 0.19], [20200, 0.24], [35200, 0.3], [60000, 0.37], [300000, 0.45], [1e12, 0.47]];
  let t = 0, prev = 0, rest = Math.max(0, base);
  for (const [lim, r] of b) { const s = Math.min(rest, lim - prev); t += s * r; rest -= s; prev = lim; if (rest <= 0) break; }
  return t;
};
PFin.money = function (n, lang) {
  const loc = lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "es-ES";
  return new Intl.NumberFormat(loc, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
};
PFin.snapshot = function (input, lang) {
  const fx = Number(input.fx) || 0.65;
  const oas = Number(input.oas) || 0, cpp = Number(input.cpp) || 0, rrif = Number(input.rrif) || 0, tfsa = Number(input.tfsa) || 0;
  const pack = PFin.recommend(input);
  const feesNet = pack.reduce((a, s) => a + s.fee, 0);
  const iva = feesNet * 0.21;
  const tasas = (pack.some((s) => s.id === "nie") ? 9.84 : 0) + (pack.some((s) => s.id === "nlv") ? 10.94 : 0) + (pack.some((s) => s.id === "tie") ? 16.08 : 0);
  const oasE = oas * fx, cppE = cpp * fx, rrifE = rrif * fx, tfsaE = tfsa * fx;
  const general = oasE + cppE + rrifE;
  const age = Number(input.age) || 65;
  const taxG = PFin.irpf(Math.max(0, general - 2000 - (5550 + (age >= 65 ? 1150 : 0))));
  const taxS = tfsaE * 0.19;
  const canWH = general * 0.15;
  const ftc = Math.min(canWH, taxG + taxS);
  const irpfNet = Math.max(0, taxG + taxS - ftc);
  return { oasE, cppE, rrifE, general, days: Number(input.days) || 0, resident: Number(input.days) > 183, taxG, taxS, canWH, ftc, irpfNet, pack, feesNet, iva, tasas, total: feesNet + iva + tasas, lang: lang || "es" };
};
PFin.taxChart = function (s) {
  const W = 760, H = 300, L = 186, R = 88, T = 36, B = 28, inner = W - L - R;
  const rows = [
    { k: "OAS", v: s.oasE, c: "#3f7a68" },
    { k: "CPP / QPP", v: s.cppE, c: "#5ea88c" },
    { k: "RRIF / RRSP", v: s.rrifE, c: "#7ed9b0" },
    { k: "IRPF bruto", v: s.taxG + s.taxS, c: "#c4a36a" },
    { k: "Retención CA 15%", v: s.canWH, c: "#d4a056" },
    { k: "Crédito FTC", v: s.ftc, c: "#8bb8e8" },
    { k: "IRPF neto ES", v: s.irpfNet, c: "#e7eeea" }
  ];
  const nice = Math.ceil(Math.max(1, ...rows.map((r) => r.v)) / 1000) * 1000 || 1;
  const gap = 7, bh = (H - T - B - (rows.length - 1) * gap) / rows.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const x = L + p * inner;
    return `<line x1="${x}" y1="${T - 4}" x2="${x}" y2="${H - B + 6}" stroke="#2c3539"/><text x="${x}" y="${H - 8}" text-anchor="middle" fill="#6d7a76" font-size="10">${PFin.money(nice * p, s.lang)}</text>`;
  }).join("");
  const bars = rows.map((r, i) => {
    const y = T + i * (bh + gap), w = Math.max(2, (r.v / nice) * inner);
    return `<rect x="${L}" y="${y}" width="${w}" height="${bh}" fill="${r.c}" rx="2"/><text x="${L - 12}" y="${y + bh * 0.72}" text-anchor="end" fill="#9aa8a3" font-size="11">${r.k}</text><text x="${L + w + 8}" y="${y + bh * 0.72}" fill="#cfeee0" font-size="11">${PFin.money(r.v, s.lang)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto"><rect width="${W}" height="${H}" fill="#1c2327"/><text x="${L}" y="20" fill="#7ed9b0" font-size="10">ART. 18 CDI CA–ES · EUR · IRPF 2026</text>${ticks}${bars}</svg>`;
};
