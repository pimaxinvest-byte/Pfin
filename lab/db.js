const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const url = process.env.DATABASE_URL || "";
let pool = null;
function enabled(){ return Boolean(url); }
function getPool(){
  if(!url) return null;
  if(!pool){
    pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
      max: 8
    });
  }
  return pool;
}
async function migrate(){
  const p = getPool();
  if(!p) return { ok:false, reason:"no DATABASE_URL" };
  const sql = fs.readFileSync(path.join(__dirname, "db", "schema.sql"), "utf8");
  await p.query(sql);
  return { ok:true };
}
async function upsertCase(body){
  const p = getPool();
  if(!p) throw new Error("database_offline");
  const email = String(body.email||"").trim().toLowerCase();
  if(!email.includes("@")) throw new Error("email_required");
  const client = await p.connect();
  try{
    await client.query("BEGIN");
    const c = await client.query(
      `INSERT INTO clients (email, phone, given_name, surnames, nationality, passport_no, origin_country)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET
         phone=COALESCE(EXCLUDED.phone, clients.phone),
         given_name=COALESCE(EXCLUDED.given_name, clients.given_name),
         surnames=COALESCE(EXCLUDED.surnames, clients.surnames),
         nationality=COALESCE(EXCLUDED.nationality, clients.nationality),
         passport_no=COALESCE(EXCLUDED.passport_no, clients.passport_no)
       RETURNING id`,
      [email, body.phone||null, body.given||null, body.surnames||null, body.nationality||null, body.passNo||null, body.originCountry||null]
    );
    const clientId = c.rows[0].id;
    let ref = String(body.ref||"").trim();
    if(!ref) ref = "PQF-"+new Date().getFullYear()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
    const snap = body.snap || {};
    const existing = await client.query("SELECT id FROM cases WHERE ref=$1", [ref]);
    const vals = [clientId, ref, body.lang||"es", body.profile||"retiree", body.dest||"andalucia",
      Number(body.days||0), body.fromAbroad!==false, Number(body.family||0),
      body.age!=null?Number(body.age):null, Number(body.fx||0.65),
      Number(body.oas||0), Number(body.cpp||0), Number(body.rrif||0), Number(body.tfsa||0),
      Number(body.wealth||0), Boolean(snap.resident), snap.irpfNet||null, snap.canWH||null,
      snap.ftc||null, snap.feesNet||null, snap.iva||null, snap.tasas||null, snap.total||null, JSON.stringify(snap)];
    let caseId;
    if(existing.rowCount){
      caseId = existing.rows[0].id;
      await client.query(`UPDATE cases SET client_id=$1, lang=$3, profile=$4, dest_ccaa=$5, days_es=$6, from_abroad=$7,
        family_count=$8, age=$9, fx_cad_eur=$10, oas_cad=$11, cpp_cad=$12, rrif_cad=$13, tfsa_cad=$14, wealth_eur=$15,
        resident_est=$16, irpf_net_eur=$17, can_wh_eur=$18, ftc_eur=$19, fees_net_eur=$20, iva_eur=$21, tasas_eur=$22,
        total_eur=$23, snapshot=$24::jsonb, status='quoted' WHERE id=$25`, vals.concat([caseId]));
      await client.query("DELETE FROM case_services WHERE case_id=$1", [caseId]);
    } else {
      const ins = await client.query(`INSERT INTO cases (client_id, ref, lang, profile, dest_ccaa, days_es, from_abroad,
        family_count, age, fx_cad_eur, oas_cad, cpp_cad, rrif_cad, tfsa_cad, wealth_eur, resident_est,
        irpf_net_eur, can_wh_eur, ftc_eur, fees_net_eur, iva_eur, tasas_eur, total_eur, snapshot, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,'quoted') RETURNING id`, vals);
      caseId = ins.rows[0].id;
    }
    for (const s of (snap.pack||[])) {
      await client.query(`INSERT INTO case_services (case_id, service_id, recommended, fee_eur) VALUES ($1,$2,true,$3) ON CONFLICT DO NOTHING`, [caseId, s.id, s.fee]);
    }
    if(snap.total!=null){
      const ver = await client.query("SELECT COALESCE(MAX(version),0)+1 AS v FROM quotes WHERE case_id=$1", [caseId]);
      await client.query(`INSERT INTO quotes (case_id, version, fees_net_eur, iva_eur, tasas_eur, total_eur, lines) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [caseId, ver.rows[0].v, snap.feesNet||0, snap.iva||0, snap.tasas||0, snap.total||0, JSON.stringify(snap.pack||[])]);
    }
    await client.query("COMMIT");
    return { ref, caseId, clientId };
  } catch(err){
    await client.query("ROLLBACK"); throw err;
  } finally { client.release(); }
}
async function getCase(q){
  const p = getPool(); if(!p) throw new Error("database_offline");
  const r = await p.query(`SELECT cs.*, cl.email, cl.given_name, cl.surnames, cl.nationality, cl.passport_no, cl.phone
    FROM cases cs JOIN clients cl ON cl.id=cs.client_id
    WHERE cs.ref=$1 OR lower(cl.email)=lower($1) ORDER BY cs.updated_at DESC LIMIT 1`, [String(q||"").trim()]);
  if(!r.rowCount) return null;
  const svcs = await p.query(`SELECT s.id, s.name_es, s.name_en, s.name_fr, cs.fee_eur FROM case_services cs JOIN service_catalog s ON s.id=cs.service_id WHERE cs.case_id=$1`, [r.rows[0].id]);
  const docs = await p.query("SELECT id, kind, filename, created_at FROM documents WHERE case_id=$1", [r.rows[0].id]);
  return { case: r.rows[0], services: svcs.rows, documents: docs.rows };
}
async function listCases(limit){
  const p = getPool(); if(!p) throw new Error("database_offline");
  const r = await p.query(`SELECT cs.ref, cs.status, cs.total_eur, cs.fees_net_eur, cs.iva_eur, cs.dest_ccaa, cs.updated_at, cl.email, cl.given_name, cl.surnames
    FROM cases cs JOIN clients cl ON cl.id=cs.client_id ORDER BY cs.updated_at DESC LIMIT $1`, [limit||50]);
  return r.rows;
}
async function catalog(){
  const p = getPool(); if(!p) throw new Error("database_offline");
  const r = await p.query("SELECT id, name_es, name_en, name_fr, fee_eur, official_tasa FROM service_catalog WHERE active ORDER BY sort_order");
  return r.rows;
}
module.exports = { enabled, getPool, migrate, upsertCase, getCase, listCases, catalog };
