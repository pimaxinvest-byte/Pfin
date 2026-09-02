const DEFAULT_ADDRESS = {
  line: "Calle García de la Serna, 30, local",
  city: "Torremolinos",
  province: "Málaga",
  cp: "29620",
  country: "España",
  full: "Calle García de la Serna, 30, local, 29620 Torremolinos (Málaga)"
};

function pickForms(p) {
  const profile = p.profile || "retiree";
  const family = Number(p.family || 0);
  const days = Number(p.days || 0);
  const forms = [{ id: "EX-15", title: "NIE y certificados", why: "Identificación de extranjero ante Policía / Extranjería." }];
  if (profile === "retiree") {
    forms.push({ id: "EX-01", title: "Residencia temporal no lucrativa", why: "Jubilado / rentista sin actividad laboral en España." });
  } else if (profile === "nomad") {
    forms.push({ id: "EX-01", title: "Residencia (vía nómada a revisar)", why: "El visado nómada digital no usa un EX clásico de trabajo; el NIE/TIE sí." });
  } else if (profile === "worker") {
    forms.push({ id: "EX-03", title: "Residencia y trabajo", why: "Perfil laboral: no encaja no lucrativa." });
  }
  if (family > 0 && profile === "retiree") {
    forms.push({ id: "EX-02", title: "Reagrupación familiar", why: family + " familiar(es) a cargo." });
  }
  if (p.arraigo) forms.push({ id: "EX-10", title: "Arraigo / circunstancias excepcionales", why: "El cliente marcó arraigo." });
  if (days >= 90 || forms.some((f) => f.id === "EX-01" || f.id === "EX-03")) {
    forms.push({ id: "EX-17", title: "Tarjeta de Identidad de Extranjero (TIE)", why: "Tras concesión o toma de huellas." });
  }
  forms.push({ id: "790-052", title: "Tasa autorización de residencia", why: "Modelo 790 código 052." });
  forms.push({ id: "790-012", title: "Tasa TIE / certificados Policía", why: "Modelo 790 código 012." });
  forms.push({ id: "030", title: "Alta censal AEAT", why: "Domicilio fiscal en España." });
  return forms;
}

function person(p) {
  const addr = (p.address && String(p.address).trim()) || DEFAULT_ADDRESS.full;
  return {
    given: p.given || "",
    surnames: p.surnames || "",
    name: [p.given, p.surnames].filter(Boolean).join(" ").trim() || "—",
    passNo: p.passNo || p.passport_no || "",
    nationality: p.nationality || "CAN",
    sex: p.sex || "",
    dob: p.dob || "",
    expiry: p.expiry || "",
    email: p.email || "",
    address: addr,
    defaultedAddress: !p.address || !String(p.address).trim() || addr === DEFAULT_ADDRESS.full
  };
}

function sheet(code, title, fields, note) {
  const rows = Object.entries(fields).map(([k, v]) => `<tr><th>${k}</th><td>${v || "—"}</td></tr>`).join("");
  return `<article class="exsheet" data-ex="${code}"><header><p class="kicker">Ministerio · borrador Pimax Invest · ${code}</p><h2>${code} · ${title}</h2></header><table class="fees">${rows}</table><p class="note">${note}</p></article>`;
}

function renderForms(p) {
  const who = person(p);
  const forms = pickForms(p);
  const base = {
    Nombre: who.given, Apellidos: who.surnames, Pasaporte: who.passNo, Nacionalidad: who.nationality,
    Sexo: who.sex, "Fecha de nacimiento": who.dob, "Domicilio en España": who.address, Correo: who.email
  };
  const html = forms.map((f) => {
    if (f.id === "EX-15") return sheet(f.id, f.title, { ...base, "Tipo de solicitud": "Asignación de NIE", Motivo: "Interés económico / residencia" }, f.why);
    if (f.id === "EX-01") return sheet(f.id, f.title, { ...base, Tipo: "Residencia temporal no lucrativa", "Medios de vida": "Pensiones / rentas canadienses", "Actividad laboral en ES": "No" }, f.why);
    if (f.id === "EX-17") return sheet(f.id, f.title, { ...base, "Tipo de tarjeta": "Residencia temporal", Huellas: "Pendiente cita Policía" }, f.why);
    if (f.id === "EX-02") return sheet(f.id, f.title, { ...base, "Familiares a cargo": String(p.family || 0) }, f.why);
    if (f.id === "EX-03") return sheet(f.id, f.title, { ...base, Tipo: "Residencia y trabajo" }, f.why);
    if (f.id === "EX-10") return sheet(f.id, f.title, { ...base, Tipo: "Arraigo" }, f.why);
    if (f.id === "790-052" || f.id === "790-012") return sheet(f.id, f.title, { Sujeto: who.name, Domicilio: who.address, Modelo: f.id }, f.why);
    if (f.id === "030") return sheet(f.id, f.title, { ...base, Clave: "Alta en el censo", "Domicilio fiscal": who.address }, f.why);
    return sheet(f.id, f.title, base, f.why);
  }).join("");
  return { who, forms, html, defaultAddress: DEFAULT_ADDRESS };
}

module.exports = { DEFAULT_ADDRESS, pickForms, person, renderForms };
