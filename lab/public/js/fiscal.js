const STEPS = [
  {id:"intro", label:"Inicio"},
  {id:"perfil", label:"Perfil"},
  {id:"residencia", label:"Residencia"},
  {id:"pensiones", label:"Pensiones"},
  {id:"inversiones", label:"Inversiones"},
  {id:"patrimonio", label:"Patrimonio"},
  {id:"especiales", label:"Especiales"},
  {id:"resultado", label:"Resultado"}
];
const state = Object.assign({
  year:2027, age:67, status:"solo", spouseMoves:"si", kids:"no", dest:"andalucia", fx:0.65,
  daysEs:220, daysCa:80, homeEs:"alquiler", homeCaKeep:"si", center:"espana", yearsCa18:30,
  oas:8500, cpp:14000, qpp:0, govCan:0, employer:0, spainPension:0,
  rrif:18000, rrspLump:0, tfsaIncome:1200, dividends:3000, interest:800, caRent:0, esRent:0,
  assetsInvest:250000, rrspStock:400000, tfsaStock:80000, homeCa:450000, homeEsVal:280000,
  otherEs:0, debts:0, crypto:0, workEs:"no", corp:"no", trust:"no", sellCaHome:"no"
}, JSON.parse(localStorage.getItem("pfin_fiscal")||"{}"));
let step = 0;
function money(n){ return PFin.money(n,"es"); }
function val(id, def){ const n=document.getElementById(id); if(!n) return def; const v=n.value; return n.type==="number"?Number(v):v; }
function radio(name, def){ const n=document.querySelector("input[name="+name+"]:checked"); return n?n.value:def; }
function save(){
  const id=STEPS[step].id;
  if(id==="perfil"){ state.age=val("age",state.age); state.status=radio("status",state.status); state.spouseMoves=radio("spouseMoves",state.spouseMoves); state.kids=radio("kids",state.kids); state.dest=val("dest",state.dest); state.fx=val("fx",state.fx); }
  if(id==="residencia"){ state.daysEs=val("daysEs",state.daysEs); state.daysCa=val("daysCa",state.daysCa); state.homeEs=radio("homeEs",state.homeEs); state.homeCaKeep=radio("homeCaKeep",state.homeCaKeep); state.center=radio("center",state.center); state.yearsCa18=val("yearsCa18",state.yearsCa18); }
  if(id==="pensiones"){ ["oas","cpp","qpp","govCan","employer","spainPension"].forEach(k=>state[k]=val(k,state[k])); }
  if(id==="inversiones"){ ["rrif","rrspLump","tfsaIncome","dividends","interest","caRent","esRent"].forEach(k=>state[k]=val(k,state[k])); }
  if(id==="patrimonio"){ ["assetsInvest","rrspStock","tfsaStock","homeCa","homeEsVal","otherEs","debts","crypto"].forEach(k=>state[k]=val(k,state[k])); }
  if(id==="especiales"){ state.workEs=radio("workEs",state.workEs); state.corp=radio("corp",state.corp); state.trust=radio("trust",state.trust); state.sellCaHome=radio("sellCaHome",state.sellCaHome); }
  localStorage.setItem("pfin_fiscal", JSON.stringify(state));
}
function ch(name,val,label,cur){ return `<label class="choice"><input type="radio" name="${name}" value="${val}" ${cur===val?"checked":""}/> ${label}</label>`; }
function intro(){
  return `<h2>Para qué sirve este árbol</h2><p class="lead">Dos tratados: Seguridad Social (si cobras) y CDI 1976+2014 (dónde se grava). Esta calculadora trata el segundo.</p><div class="callout"><strong>Reglas.</strong> OAS/CPP/QPP/empresa/RRIF periódico: España puede gravar, Canadá ≤15 %. Pensión de gobierno CA: suele tributar solo en origen. TFSA: España mira el rendimiento. RRSP/RRIF cobrado: base general IRPF.</div>`;
}
function perfil(){
  return `<h2>1. Perfil</h2><div class="row"><div><label class="l">Edad</label><input id="age" type="number" value="${state.age}"/></div><div><label class="l">CAD → EUR</label><input id="fx" type="number" step="0.01" value="${state.fx}"/></div></div><label class="l">Destino</label><select id="dest">${Object.entries(PFin.CCAA).map(([k,v])=>`<option value="${k}" ${state.dest===k?"selected":""}>${v.name}</option>`).join("")}</select><label class="l">Situación</label><div class="choices">${ch("status","solo","Vivo solo",state.status)}${ch("status","casado","Casado / pareja",state.status)}</div><label class="l">¿El cónyuge se muda?</label><div class="choices">${ch("spouseMoves","si","Sí",state.spouseMoves)}${ch("spouseMoves","no","No",state.spouseMoves)}</div><label class="l">¿Hijos menores en España?</label><div class="choices">${ch("kids","no","No",state.kids)}${ch("kids","si","Sí",state.kids)}</div>`;
}
function residencia(){
  return `<h2>2. Residencia fiscal</h2><p class="help">Art. 9 LIRPF. Umbral 183 días.</p><div class="row"><div><label class="l">Días en España</label><input id="daysEs" type="number" value="${state.daysEs}"/></div><div><label class="l">Días en Canadá</label><input id="daysCa" type="number" value="${state.daysCa}"/></div></div><label class="l">Vivienda en España</label><div class="choices">${ch("homeEs","alquiler","Alquiler habitual",state.homeEs)}${ch("homeEs","compra","Compra habitual",state.homeEs)}${ch("homeEs","segunda","Solo vacaciones",state.homeEs)}</div><label class="l">¿Casa en Canadá?</label><div class="choices">${ch("homeCaKeep","si","Sí",state.homeCaKeep)}${ch("homeCaKeep","no","No",state.homeCaKeep)}</div><label class="l">Centro de intereses</label><div class="choices">${ch("center","espana","España",state.center)}${ch("center","canada","Canadá",state.center)}${ch("center","mixto","Mixto",state.center)}</div><label class="l">Años en Canadá después de los 18</label><input id="yearsCa18" type="number" value="${state.yearsCa18}"/>`;
}
function pensiones(){
  return `<h2>3. Pensiones (CAD / año)</h2><div class="row"><div><label class="l">OAS</label><input id="oas" type="number" value="${state.oas}"/></div><div><label class="l">CPP</label><input id="cpp" type="number" value="${state.cpp}"/></div></div><div class="row"><div><label class="l">QPP</label><input id="qpp" type="number" value="${state.qpp}"/></div><div><label class="l">Pensión gobierno CA</label><input id="govCan" type="number" value="${state.govCan}"/></div></div><div class="row"><div><label class="l">Pensión empresa CA</label><input id="employer" type="number" value="${state.employer}"/></div><div><label class="l">Pensión España EUR</label><input id="spainPension" type="number" value="${state.spainPension}"/></div></div>`;
}
function inversiones(){
  return `<h2>4. Inversiones</h2><div class="row"><div><label class="l">RRIF periódico CAD</label><input id="rrif" type="number" value="${state.rrif}"/></div><div><label class="l">Rescate único RRSP CAD</label><input id="rrspLump" type="number" value="${state.rrspLump}"/></div></div><div class="row"><div><label class="l">Rendimiento TFSA CAD</label><input id="tfsaIncome" type="number" value="${state.tfsaIncome}"/></div><div><label class="l">Dividendos CAD</label><input id="dividends" type="number" value="${state.dividends}"/></div></div><div class="row"><div><label class="l">Intereses CAD</label><input id="interest" type="number" value="${state.interest}"/></div><div><label class="l">Alquiler Canadá CAD</label><input id="caRent" type="number" value="${state.caRent}"/></div></div><label class="l">Alquiler España EUR</label><input id="esRent" type="number" value="${state.esRent}"/>`;
}
function patrimonio(){
  return `<h2>5. Patrimonio 31 dic.</h2><div class="row"><div><label class="l">Inversiones CAD</label><input id="assetsInvest" type="number" value="${state.assetsInvest}"/></div><div><label class="l">Saldo RRSP/RRIF CAD</label><input id="rrspStock" type="number" value="${state.rrspStock}"/></div></div><div class="row"><div><label class="l">Saldo TFSA CAD</label><input id="tfsaStock" type="number" value="${state.tfsaStock}"/></div><div><label class="l">Vivienda Canadá CAD</label><input id="homeCa" type="number" value="${state.homeCa}"/></div></div><div class="row"><div><label class="l">Vivienda España EUR</label><input id="homeEsVal" type="number" value="${state.homeEsVal}"/></div><div><label class="l">Otros ES EUR</label><input id="otherEs" type="number" value="${state.otherEs}"/></div></div><div class="row"><div><label class="l">Deudas CAD</label><input id="debts" type="number" value="${state.debts}"/></div><div><label class="l">Cripto CAD</label><input id="crypto" type="number" value="${state.crypto}"/></div></div>`;
}
function especiales(){
  return `<h2>6. Ramas especiales</h2><label class="l">¿Trabajo en España?</label><div class="choices">${ch("workEs","no","No: jubilación",state.workEs)}${ch("workEs","empleo","Contrato (Beckham)",state.workEs)}${ch("workEs","auto","Autónomo / nómada",state.workEs)}</div><label class="l">¿Holdco canadiense?</label><div class="choices">${ch("corp","no","No",state.corp)}${ch("corp","si","Sí",state.corp)}</div><label class="l">¿Trust?</label><div class="choices">${ch("trust","no","No",state.trust)}${ch("trust","si","Sí",state.trust)}</div><label class="l">¿Venta casa CA?</label><div class="choices">${ch("sellCaHome","no","No",state.sellCaHome)}${ch("sellCaHome","antes","Antes de residente ES",state.sellCaHome)}${ch("sellCaHome","despues","Ya residente ES",state.sellCaHome)}</div>`;
}
function resultado(){
  const e=PFin.estimateTax(state);
  const badge=e.res.status==="residente"?"alert":e.res.status==="no-residente"?"ok":"alert";
  const label=e.res.status==="residente"?"Residente fiscal España":e.res.status==="riesgo-residente"?"Alto riesgo de residencia":e.res.status==="zona-gris"?"Zona gris":"Previsible no residente";
  localStorage.setItem("pfin_fiscal_result", JSON.stringify({state,e,at:new Date().toISOString()}));
  return `<h2>Mapa fiscal estimado</h2><p><span class="pill ${badge}">${label}</span> <span class="pill ok">${e.ccaa.name}</span></p><div class="callout">${e.res.why}</div><div class="kpis"><div class="kpi"><span>Base general</span><b>${money(e.workLike+e.rental)}</b></div><div class="kpi"><span>Base ahorro</span><b>${money(e.savings)}</b></div><div class="kpi"><span>IRPF bruto ES</span><b>${money(e.spanishGross)}</b></div><div class="kpi"><span>Retención CA</span><b>${money(e.canWH)}</b></div><div class="kpi"><span>Crédito FTC</span><b>${money(e.ftc)}</b></div><div class="kpi"><span>IRPF neto ES</span><b>${money(e.irpfNet)}</b></div><div class="kpi"><span>Patrimonio mundial</span><b>${money(e.worldwide)}</b></div><div class="kpi"><span>IP + ITSGF</span><b>${money(e.ipPay+e.itsgf)}</b></div></div><div class="chart-wrap">${PFin.taxChart({oasE:e.oas,cppE:e.cpp+e.qpp,rrifE:e.rrif,taxG:e.taxGen,taxS:e.taxSav,canWH:e.canWH,ftc:e.ftc,irpfNet:e.irpfNet,lang:"es"})}</div><p class="total">${money(e.taxYear)}</p><ul class="pack"><li><strong>720.</strong> ${e.m720?"Probable obligación.":"Puede no aplicar."}</li><li><strong>Holdco.</strong> ${state.corp==="si"?"Rama crítica CFC.":"No."}</li><li><strong>Trust.</strong> ${state.trust==="si"?"Rama crítica.":"No."}</li></ul><div class="callout alert">No calcula departure tax canadiense ni IBI/ITP.</div><p><a class="btn primary" href="/expediente">Pasar al expediente</a></p>`;
}
function body(){
  const id=STEPS[step].id;
  if(id==="intro") return intro();
  if(id==="perfil") return perfil();
  if(id==="residencia") return residencia();
  if(id==="pensiones") return pensiones();
  if(id==="inversiones") return inversiones();
  if(id==="patrimonio") return patrimonio();
  if(id==="especiales") return especiales();
  return resultado();
}
function render(){
  document.getElementById("bar").style.width=(step/(STEPS.length-1)*100)+"%";
  document.getElementById("stepLabels").innerHTML=STEPS.map((s,i)=>`<span style="color:${i===step?"#7ed9b0":""}">${s.label}</span>`).join("");
  const id=STEPS[step].id;
  document.getElementById("screen").innerHTML=body()+`<div class="navrow"><button class="btn ghost" type="button" id="back" ${step===0?"disabled":""}>Atrás</button><button class="btn primary" type="button" id="next">${id==="resultado"?"Volver al inicio":(step===0?"Empezar":"Continuar")}</button></div>`;
  document.getElementById("back").onclick=()=>{save(); step=Math.max(0,step-1); render(); window.scrollTo({top:0,behavior:"smooth"});};
  document.getElementById("next").onclick=()=>{save(); step=id==="resultado"?0:Math.min(STEPS.length-1,step+1); render(); window.scrollTo({top:0,behavior:"smooth"});};
}
render();
