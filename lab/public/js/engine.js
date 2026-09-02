window.PFin = window.PFin || {};
PFin.SERVICES = [
  {id:"nie", es:"NIE (EX-15)", en:"NIE (EX-15)", fr:"NIE (EX-15)", fee:350},
  {id:"niepoa", es:"NIE desde el extranjero", en:"NIE from abroad", fr:"NIE depuis l’étranger", fee:400},
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
PFin.CCAA = {
  madrid:{name:"Madrid",ipBonus:1,exempt:700000}, andalucia:{name:"Andalucía",ipBonus:1,exempt:700000},
  murcia:{name:"Murcia",ipBonus:1,exempt:700000}, cantabria:{name:"Cantabria",ipBonus:1,exempt:700000},
  rioja:{name:"La Rioja",ipBonus:1,exempt:700000}, canarias:{name:"Canarias",ipBonus:1,exempt:700000},
  extremadura:{name:"Extremadura",ipBonus:1,exempt:500000}, galicia:{name:"Galicia",ipBonus:0.5,exempt:700000},
  valencia:{name:"C. Valenciana",ipBonus:0,exempt:1000000}, cataluna:{name:"Cataluña",ipBonus:0,exempt:500000},
  baleares:{name:"Baleares",ipBonus:0,exempt:3000000}, otras:{name:"Otra CCAA",ipBonus:0,exempt:700000}
};
PFin.recommend = function (p) {
  const ids = new Set(["taxrep", "nie"]);
  const days = Number(p.days || 0);
  const wealth = Number(p.wealth || 0);
  const dest = p.dest || "andalucia";
  if (p.fromAbroad !== false) ids.add("niepoa");
  if (p.workEs === "empleo" || p.profile === "worker") {}
  else if (p.profile === "nomad" || p.workEs === "auto") ids.add("dnv");
  else ids.add("nlv");
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
PFin.irpfSaving = function (base) {
  const b = [[6000, 0.19], [50000, 0.21], [200000, 0.23], [300000, 0.27], [1e12, 0.28]];
  let t = 0, prev = 0, rest = Math.max(0, base);
  for (const [lim, r] of b) { const s = Math.min(rest, lim - prev); t += s * r; rest -= s; prev = lim; if (rest <= 0) break; }
  return t;
};
PFin.cadEur = function (cad, fx) { return (Number(cad) || 0) * (Number(fx) || 0.65); };
PFin.residency = function (p) {
  const days = Number(p.daysEs != null ? p.daysEs : p.days) || 0;
  const familyPull = (p.status && p.status !== "solo" && p.spouseMoves === "si") || p.kids === "si";
  const economic = p.center === "espana";
  let status = "no-residente", why = "Menos de 183 días y sin centro de vida evidente en España.";
  if (days > 183) { status = "residente"; why = "Más de 183 días en territorio español (art. 9 LIRPF)."; }
  else if (familyPull && economic) { status = "riesgo-residente"; why = "Familia + centro de intereses pueden activar residencia aunque no haya 183 días."; }
  else if (familyPull || economic) { status = "zona-gris"; why = "Un criterio auxiliar apunta a España."; }
  return { status, why, familyPull, economic, days };
};
PFin.estimateTax = function (st) {
  const fx = Number(st.fx) || 0.65;
  const res = PFin.residency(st);
  const ccaa = PFin.CCAA[st.dest] || PFin.CCAA.otras;
  const oas = PFin.cadEur(st.oas, fx), cpp = PFin.cadEur(st.cpp, fx), qpp = PFin.cadEur(st.qpp, fx);
  const gov = PFin.cadEur(st.govCan, fx), emp = PFin.cadEur(st.employer, fx);
  const esPen = Number(st.spainPension) || 0;
  const rrif = PFin.cadEur(st.rrif, fx), lump = PFin.cadEur(st.rrspLump, fx);
  const tfsaInc = PFin.cadEur(st.tfsaIncome != null ? st.tfsaIncome : st.tfsa, fx);
  const div = PFin.cadEur(st.dividends, fx), intInc = PFin.cadEur(st.interest, fx);
  const caRent = PFin.cadEur(st.caRent, fx), esRent = Number(st.esRent) || 0;
  const pensionPeriodic = oas + cpp + qpp + emp + rrif;
  const workLike = pensionPeriodic + lump + esPen;
  const savings = tfsaInc + div + intInc;
  const rental = caRent + esRent;
  const age = Number(st.age) || 65;
  const minPers = 5550 + (age >= 65 ? 1150 : 0) + (age >= 75 ? 1400 : 0);
  const generalBaseNet = Math.max(0, workLike + rental - (workLike > 0 ? 2000 : 0) - minPers);
  const taxGen = PFin.irpf(generalBaseNet), taxSav = PFin.irpfSaving(savings);
  const spanishGross = taxGen + taxSav;
  const canWH = pensionPeriodic * 0.15 + lump * 0.25;
  const ftc = Math.min(canWH, spanishGross);
  const irpfNet = res.status === "no-residente" ? 0 : Math.max(0, spanishGross - ftc);
  const assetsInvest = PFin.cadEur(st.assetsInvest, fx), rrsp = PFin.cadEur(st.rrspStock, fx);
  const tfsaStock = PFin.cadEur(st.tfsaStock, fx), homeCa = PFin.cadEur(st.homeCa, fx);
  const homeEs = Number(st.homeEsVal) || 0, otherEs = Number(st.otherEs) || 0;
  const debts = PFin.cadEur(st.debts, fx), crypto = PFin.cadEur(st.crypto, fx);
  const worldwide = assetsInvest + tfsaStock + homeCa + homeEs + otherEs + crypto;
  const netBeforeMin = Math.max(0, worldwide - debts - Math.min(homeEs, 300000));
  const ipBase = Math.max(0, netBeforeMin - ccaa.exempt);
  const ipPay = res.status === "no-residente" ? 0 : ipBase * 0.005 * (1 - ccaa.ipBonus);
  let itsgf = 0;
  if (res.status !== "no-residente" && netBeforeMin > 3000000) {
    const over = netBeforeMin - 3000000;
    if (over <= 2347998) itsgf = over * 0.017;
    else if (over <= 7695996) itsgf = 2347998 * 0.017 + (over - 2347998) * 0.021;
    else itsgf = 2347998 * 0.017 + 5347998 * 0.021 + (over - 7695996) * 0.035;
    itsgf = Math.max(0, itsgf - ipPay);
  }
  const m720 = assetsInvest + rrsp + tfsaStock > 50000 || homeCa > 50000 || crypto > 50000;
  return { res, ccaa, fx, oas, cpp, qpp, gov, emp, esPen, rrif, lump, tfsaInc, div, intInc, caRent, esRent,
    workLike, savings, rental, taxGen, taxSav, spanishGross, canWH, ftc, irpfNet, worldwide,
    netBeforeMin, ipBase, ipPay, itsgf, m720, rrsp, tfsaStock, homeCa, homeEs, assetsInvest, crypto,
    taxYear: irpfNet + ipPay + itsgf };
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
    { k: "IRPF bruto", v: (s.taxG || 0) + (s.taxS || 0), c: "#c4a36a" },
    { k: "Retención CA 15%", v: s.canWH, c: "#d4a056" },
    { k: "Crédito FTC", v: s.ftc, c: "#8bb8e8" },
    { k: "IRPF neto ES", v: s.irpfNet, c: "#e7eeea" }
  ];
  const nice = Math.ceil(Math.max(1, ...rows.map((r) => r.v || 0)) / 1000) * 1000 || 1;
  const gap = 7, bh = (H - T - B - (rows.length - 1) * gap) / rows.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const x = L + p * inner;
    return `<line x1="${x}" y1="${T - 4}" x2="${x}" y2="${H - B + 6}" stroke="#2c3539"/><text x="${x}" y="${H - 8}" text-anchor="middle" fill="#6d7a76" font-size="10">${PFin.money(nice * p, s.lang)}</text>`;
  }).join("");
  const bars = rows.map((r, i) => {
    const y = T + i * (bh + gap), w = Math.max(2, ((r.v || 0) / nice) * inner);
    return `<rect x="${L}" y="${y}" width="${w}" height="${bh}" fill="${r.c}" rx="2"/><text x="${L - 12}" y="${y + bh * 0.72}" text-anchor="end" fill="#9aa8a3" font-size="11">${r.k}</text><text x="${L + w + 8}" y="${y + bh * 0.72}" fill="#cfeee0" font-size="11">${PFin.money(r.v, s.lang)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto"><rect width="${W}" height="${H}" fill="#1c2327"/><text x="${L}" y="20" fill="#7ed9b0" font-size="10">ART. 18 CDI CA–ES · EUR · IRPF 2026</text>${ticks}${bars}</svg>`;
};
