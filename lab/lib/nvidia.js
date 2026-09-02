const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
const BASE = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

function enabled() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

async function complete(prompt) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY missing");
  const res = await fetch(BASE + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "Eres el motor de expedientes de Pimax Invest S. Coop. (Málaga). Devuelves SOLO JSON válido. No inventes número de pasaporte ni fechas que no estén en el input. Si falta un dato, déjalo vacío."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2048,
      stream: false
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("nvidia " + res.status + " " + t.slice(0, 240));
  }
  const data = await res.json();
  const text = (((data.choices || [])[0] || {}).message || {}).content || "";
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error("nvidia_no_json");
  return JSON.parse(json[0]);
}

async function personalize(payload) {
  const prompt = `Normaliza este expediente de extranjería Canadá→España y personaliza la UI.
Input: ${JSON.stringify(payload)}
Devuelve JSON con claves:
greeting_es, greeting_en, greeting_fr,
given, surnames, nationality, passNo, sex, dob,
address_es (si viene vacío usa exactamente: "Calle García de la Serna, 30, local, 29620 Torremolinos (Málaga)"),
missing_fields (array),
ui_subtitle_es,
checklist (array corto de documentos que faltan).`;
  return complete(prompt);
}

module.exports = { enabled, complete, personalize };
