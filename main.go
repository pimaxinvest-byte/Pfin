package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"
)

// ─── Yahoo Finance types ───────────────────────────────────────

type YFResponse struct {
	QuoteResponse struct {
		Result []YFQuote `json:"result"`
	} `json:"quoteResponse"`
}

type YFQuote struct {
	Symbol                     string  `json:"symbol"`
	ShortName                  string  `json:"shortName"`
	RegularMarketPrice         float64 `json:"regularMarketPrice"`
	RegularMarketChange        float64 `json:"regularMarketChange"`
	RegularMarketChangePercent float64 `json:"regularMarketChangePercent"`
	MarketCap                  float64 `json:"marketCap"`
	RegularMarketVolume        float64 `json:"regularMarketVolume"`
	FiftyTwoWeekHigh           float64 `json:"fiftyTwoWeekHigh"`
	FiftyTwoWeekLow            float64 `json:"fiftyTwoWeekLow"`
	RegularMarketOpen          float64 `json:"regularMarketOpen"`
	RegularMarketDayHigh       float64 `json:"regularMarketDayHigh"`
	RegularMarketDayLow        float64 `json:"regularMarketDayLow"`
	AverageDailyVolume3Month   float64 `json:"averageDailyVolume3Month"`
	TrailingPE                 float64 `json:"trailingPE"`
	ForwardPE                  float64 `json:"forwardPE"`
	DividendYield              float64 `json:"dividendYield"`
	MarketState                string  `json:"marketState"`
}

// ─── Tickers ───────────────────────────────────────────────────

var top5Symbols  = []string{"NU", "T", "CCL", "SAN", "VG"}
var indexSymbols = []string{"^GSPC", "^IXIC", "^DJI", "^VIX", "^RUT", "GC=F", "CL=F"}

// ─── Fetch from Yahoo Finance ──────────────────────────────────

func fetchQuotes(symbols []string) ([]YFQuote, error) {
	joined := ""
	for i, s := range symbols {
		if i > 0 {
			joined += "%2C"
		}
		joined += s
	}
	url := "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + joined +
		"&fields=symbol,shortName,regularMarketPrice,regularMarketChange," +
		"regularMarketChangePercent,marketCap,regularMarketVolume," +
		"fiftyTwoWeekHigh,fiftyTwoWeekLow,regularMarketOpen," +
		"regularMarketDayHigh,regularMarketDayLow,averageDailyVolume3Month," +
		"trailingPE,forwardPE,dividendYield,marketState"

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result YFResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	return result.QuoteResponse.Result, nil
}

// ─── API handler ──────────────────────────────────────────────

func apiHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	top5, err1    := fetchQuotes(top5Symbols)
	indices, err2 := fetchQuotes(indexSymbols)

	if err1 != nil || err2 != nil {
		w.WriteHeader(500)
		fmt.Fprintf(w, `{"error":"fetch failed"}`)
		return
	}

	type Payload struct {
		Top5      []YFQuote `json:"top5"`
		Indices   []YFQuote `json:"indices"`
		Timestamp string    `json:"timestamp"`
	}

	json.NewEncoder(w).Encode(Payload{
		Top5:      top5,
		Indices:   indices,
		Timestamp: time.Now().Format("Mon 02 Jan 2006 — 15:04:05 MST"),
	})
}

// ─── HTML handler ─────────────────────────────────────────────

func htmlHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(dashboardHTML))
}

// ─── Main ─────────────────────────────────────────────────────

func main() {
	port := "8080"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	http.HandleFunc("/", htmlHandler)
	http.HandleFunc("/api/data", apiHandler)

	url := "http://localhost:" + port
	fmt.Println("╔══════════════════════════════════════════════╗")
	fmt.Println("║   Pietro's Finance Hub — PFin  LIVE          ║")
	fmt.Printf( "║   %-42s ║\n", url)
	fmt.Println("║   Ctrl+C to stop                             ║")
	fmt.Println("╚══════════════════════════════════════════════╝")

	isCloud := os.Getenv("RAILWAY_ENVIRONMENT") != "" ||
		os.Getenv("RENDER") != "" ||
		os.Getenv("FLY_APP_NAME") != "" ||
		os.Getenv("NO_BROWSER") == "1"

	if !isCloud {
		go func() {
			time.Sleep(600 * time.Millisecond)
			switch runtime.GOOS {
			case "windows":
				exec.Command("cmd", "/c", "start", url).Run()
			case "darwin":
				exec.Command("open", url).Run()
			default:
				exec.Command("xdg-open", url).Run()
			}
		}()
	}

	http.ListenAndServe(":"+port, nil)
}

// ─── Embedded Dashboard HTML ──────────────────────────────────

const dashboardHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pietro's Finance Hub — PFin | Live</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#060d18;--bg2:#0c1a2e;--bg3:#112040;
    --gold:#C9A84C;--gold2:#e8c96b;
    --green:#22c55e;--red:#ef4444;
    --blue:#3b82f6;--purple:#a78bfa;
    --text:#e2e8f0;--muted:#64748b;--border:#1e3a5f;
    --card:#0e1f36;--card2:#122440;
  }
  html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:14px}

  .app{display:flex;flex-direction:column;min-height:100vh}

  /* ── HEADER ── */
  header{background:var(--bg2);border-bottom:1px solid var(--border);padding:10px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;gap:12px}
  .brand{display:flex;flex-direction:column;line-height:1.15}
  .brand-name{font-size:17px;font-weight:800;color:var(--gold);letter-spacing:-0.5px}
  .brand-name em{color:#fff;font-style:normal;font-weight:400;font-size:13px;margin-left:6px;opacity:.6}
  .brand-sub{font-size:9.5px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:1px}
  .header-center{display:flex;align-items:center;gap:10px}
  .live-badge{display:flex;align-items:center;gap:6px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;color:var(--green)}
  .live-dot{width:6px;height:6px;background:var(--green);border-radius:50%;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .header-right{display:flex;align-items:center;gap:10px}
  .timestamp{font-size:10.5px;color:var(--muted);font-family:'JetBrains Mono',monospace}

  /* ── LANGUAGE SWITCHER ── */
  .lang-switcher{display:flex;gap:4px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:3px}
  .lang-btn{background:none;border:none;border-radius:5px;padding:4px 9px;font-size:12px;font-weight:600;cursor:pointer;color:var(--muted);transition:all .2s;letter-spacing:.3px}
  .lang-btn:hover{color:var(--text)}
  .lang-btn.active{background:var(--gold);color:#000 !important;font-weight:700}
  .refresh-btn{background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;padding:5px 12px;cursor:pointer;transition:all .2s}
  .refresh-btn:hover{border-color:var(--gold);color:var(--gold)}

  /* ── TICKER TAPE ── */
  .tape{background:var(--bg3);border-bottom:1px solid var(--border);padding:6px 0;overflow:hidden;white-space:nowrap}
  .tape-inner{display:inline-flex;gap:28px;animation:scroll 30s linear infinite}
  .tape-inner:hover{animation-play-state:paused}
  @keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  .tape-item{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-family:'JetBrains Mono',monospace}
  .tape-sym{font-weight:700;color:var(--gold)}
  .tape-price{color:var(--text)}
  .tape-chg.up{color:var(--green)}.tape-chg.dn{color:var(--red)}

  /* ── MAIN ── */
  main{flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:18px}

  /* ── INDICES ── */
  .indices{display:grid;grid-template-columns:repeat(7,1fr);gap:9px}
  .idx-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:11px 13px;transition:border-color .2s}
  .idx-card:hover{border-color:var(--gold)}
  .idx-name{font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
  .idx-price{font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace;margin-bottom:1px}
  .idx-chg{font-size:11px;font-weight:600;font-family:'JetBrains Mono',monospace}
  .up{color:var(--green)}.dn{color:var(--red)}.flat{color:var(--muted)}

  /* ── GRID ── */
  .main-grid{display:grid;grid-template-columns:1fr 330px;gap:18px;flex:1}
  .section-title{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:11px;display:flex;align-items:center;gap:8px}
  .section-title::after{content:'';flex:1;height:1px;background:var(--border)}
  .card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}

  /* ── TABLE ── */
  table{width:100%;border-collapse:collapse}
  thead tr{background:var(--bg3)}
  th{padding:9px 14px;text-align:right;font-size:10px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
  th:first-child{text-align:left}
  tbody tr{border-top:1px solid var(--border);transition:background .15s;cursor:default}
  tbody tr:hover{background:var(--card2)}
  td{padding:12px 14px;text-align:right;font-size:13px}
  td:first-child{text-align:left}
  .td-sym{font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--gold);font-size:14px}
  .td-name{font-size:10.5px;color:var(--muted);margin-top:2px}
  .td-price{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:14px}
  .td-chg{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:13px}
  .td-cap{font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace}
  .td-pe{font-size:12px;font-family:'JetBrains Mono',monospace}
  .td-div{font-size:12px;color:var(--purple);font-family:'JetBrains Mono',monospace}
  .range-bar{width:76px;height:6px;background:var(--bg3);border-radius:3px;position:relative;margin:0 auto}
  .range-fill{position:absolute;height:100%;background:var(--blue);border-radius:3px}
  .range-labels{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:2px;font-family:'JetBrains Mono',monospace}

  /* ── SIDEBAR ── */
  .sidebar{display:flex;flex-direction:column;gap:14px}
  .mover-item{padding:11px 13px;border-top:1px solid var(--border);display:flex;align-items:flex-start;gap:9px}
  .mover-item:first-of-type{border-top:none}
  .mover-num{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px}
  .mover-text{font-size:11px;line-height:1.55;color:var(--text)}
  .mover-text strong{color:var(--gold)}
  .mover-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;margin-top:4px}
  .tag-macro{background:rgba(59,130,246,.2);color:#93c5fd}
  .tag-geo{background:rgba(239,68,68,.2);color:#fca5a5}
  .tag-sector{background:rgba(167,139,250,.2);color:#c4b5fd}
  .tag-fed{background:rgba(201,168,76,.2);color:var(--gold)}
  .context-box{padding:13px;background:var(--bg3);border-radius:8px;font-size:11px;line-height:1.7;color:var(--muted)}
  .context-box strong{color:var(--text)}

  /* ── FOOTER ── */
  footer{background:var(--bg2);border-top:1px solid var(--border);padding:9px 24px;font-size:10px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}
  .footer-brand{color:var(--gold);font-weight:700}

  /* ── STATES ── */
  .loading{text-align:center;padding:50px;color:var(--muted);font-size:13px}
  .spinner{width:22px;height:22px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 10px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .error-msg{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:12px 16px;font-size:12px;color:#fca5a5;text-align:center;margin:12px}
</style>
</head>
<body>
<div class="app">

<!-- HEADER -->
<header>
  <div class="brand">
    <div class="brand-name">PFin <em>Pietro's Finance Hub</em></div>
    <div class="brand-sub" data-i18n="subtitle">Live Market Dashboard</div>
  </div>

  <div class="header-center">
    <div class="live-badge"><div class="live-dot"></div><span data-i18n="live">LIVE</span></div>
    <div class="lang-switcher">
      <button class="lang-btn active" onclick="setLang('es')">🇪🇸 ES</button>
      <button class="lang-btn" onclick="setLang('en')">🇬🇧 EN</button>
      <button class="lang-btn" onclick="setLang('it')">🇮🇹 IT</button>
    </div>
  </div>

  <div class="header-right">
    <div class="timestamp" id="ts">—</div>
    <button class="refresh-btn" onclick="loadData()" data-i18n="refresh">⟳ Actualizar</button>
  </div>
</header>

<!-- TICKER TAPE -->
<div class="tape"><div class="tape-inner" id="tape">
  <span class="tape-item"><span class="tape-sym">PFin</span><span class="tape-price">Connecting…</span></span>
</div></div>

<!-- MAIN -->
<main>
  <div class="indices" id="indices">
    <div class="idx-card"><div class="idx-name" data-i18n="loading">Cargando…</div></div>
  </div>

  <div class="main-grid">
    <!-- TOP 5 -->
    <div>
      <div class="section-title" id="top5-title">⭐ Top 5 Strong Buy</div>
      <div class="card" id="top5-container">
        <div class="loading"><div class="spinner"></div><span data-i18n="loading">Cargando…</span></div>
      </div>
    </div>

    <!-- SIDEBAR -->
    <div class="sidebar">
      <div>
        <div class="section-title" id="movers-title">🔥 Market Movers</div>
        <div class="card" id="movers-container"></div>
      </div>
      <div>
        <div class="section-title" id="context-title">📊 Contexto</div>
        <div class="context-box" id="context-box"></div>
      </div>
    </div>
  </div>
</main>

<footer>
  <span data-i18n="footerLeft">Fuente: Yahoo Finance · Auto-refresh 60s · Analyst Rating ≤ 1.5</span>
  <span><span class="footer-brand">Pietro's Finance Hub — PFin</span> &nbsp;·&nbsp; <span data-i18n="footerRight">Solo informativo</span></span>
</footer>

</div><!-- /.app -->

<script>
// ══════════════════════════════════════════════════════════════
//  i18n — translations
// ══════════════════════════════════════════════════════════════
const T = {
  es: {
    subtitle:    'Live Market Dashboard',
    live:        'EN VIVO',
    refresh:     '⟳ Actualizar',
    loading:     'Cargando…',
    top5title:   '⭐ Top 5 Strong Buy — Consenso Analistas',
    moversTitle: '🔥 Market Movers — Últimas 72h',
    contextTitle:'📊 Contexto del Mercado',
    footerLeft:  'Fuente: Yahoo Finance · Auto-refresh 60s · Analyst Rating ≤ 1.5 (Strong Buy)',
    footerRight: 'Solo informativo, no constituye asesoramiento de inversión',
    colStock:    'Stock', colPrice:'Precio', colDay:'Día %',
    colCap:'Mkt Cap', colPE:'P/E', colDiv:'Div Yield', colRange:'Rango 52S',
    idxNames: {'^GSPC':'S&P 500','^IXIC':'NASDAQ','^DJI':'DOW','^VIX':'VIX','GC=F':'Oro','CL=F':'Petróleo','^RUT':'Russell 2K'},
    movers:[
      {n:'1',c:'rgba(239,68,68,.2)',nc:'#f87171',
       title:'CPI Abril +3.8% YoY',
       text:'La mayor sorpresa inflacionaria desde mayo 2023. El yield del 10Y subió a 4.46%. Probabilidad de subida de la Fed en 2026: <strong>45%</strong>.',
       tag:'MACRO',tc:'tag-macro'},
      {n:'2',c:'rgba(239,68,68,.2)',nc:'#f87171',
       title:'Guerra Irán — Petróleo $120+',
       text:'Brent +50% desde el inicio del conflicto. Estrecho de Ormuz bajo presión. Riesgo de stagflación en aumento.',
       tag:'GEOPOLÍTICA',tc:'tag-geo'},
      {n:'3',c:'rgba(201,168,76,.2)',nc:'#C9A84C',
       title:'Warsh confirmado Presidente de la Fed',
       text:'54-45 en el Senado. Reducción del balance ($6.7T) prevista. El Treasury a 30 años superó el 5%.',
       tag:'FED',tc:'tag-fed'},
      {n:'4',c:'rgba(59,130,246,.2)',nc:'#93c5fd',
       title:'Cumbre Trump-Xi sin acuerdos',
       text:'Sector tech bajo presión. NVDA -4.4%, Intel -6%, Micron -6.6%. Incertidumbre sobre aranceles de julio.',
       tag:'GEOPOLÍTICA',tc:'tag-geo'},
      {n:'5',c:'rgba(167,139,250,.2)',nc:'#c4b5fd',
       title:'Retail ETF -6% semanal',
       text:'4ª caída consecutiva. Peor semana desde oct-2025. Señales de debilidad del consumidor.',
       tag:'SECTORIAL',tc:'tag-sector'},
    ],
    context:'El S&P 500 opera bajo presión por <strong>inflación persistente y yields al alza</strong>. La Fed de Warsh prioriza combatir la inflación sobre el crecimiento. <strong>Energy y Financials</strong> lideran en el año. Tech y Consumer Discretionary bajo presión. El mercado descuenta <strong>sin recortes en 2026</strong>. FCF yield medio del Top 5 superior al <strong>8%</strong> — valor relativo atractivo en un entorno de tipos altos.',
  },
  en: {
    subtitle:    'Live Market Dashboard',
    live:        'LIVE',
    refresh:     '⟳ Refresh',
    loading:     'Loading…',
    top5title:   '⭐ Top 5 Strong Buy — Analyst Consensus',
    moversTitle: '🔥 Market Movers — Last 72h',
    contextTitle:'📊 Market Context',
    footerLeft:  'Source: Yahoo Finance · Auto-refresh 60s · Analyst Rating ≤ 1.5 (Strong Buy)',
    footerRight: 'For informational purposes only, not investment advice',
    colStock:    'Stock', colPrice:'Price', colDay:'Day %',
    colCap:'Mkt Cap', colPE:'P/E', colDiv:'Div Yield', colRange:'52W Range',
    idxNames: {'^GSPC':'S&P 500','^IXIC':'NASDAQ','^DJI':'DOW','^VIX':'VIX','GC=F':'Gold','CL=F':'Oil WTI','^RUT':'Russell 2K'},
    movers:[
      {n:'1',c:'rgba(239,68,68,.2)',nc:'#f87171',
       title:'April CPI +3.8% YoY',
       text:'Biggest inflation surprise since May 2023. 10Y Treasury yield jumped to 4.46%. Probability of a Fed rate hike in 2026: <strong>45%</strong>.',
       tag:'MACRO',tc:'tag-macro'},
      {n:'2',c:'rgba(239,68,68,.2)',nc:'#f87171',
       title:'Iran War — Oil at $120+',
       text:'Brent crude +50% since conflict began. Strait of Hormuz under pressure. Stagflation risk rising globally.',
       tag:'GEOPOLITICS',tc:'tag-geo'},
      {n:'3',c:'rgba(201,168,76,.2)',nc:'#C9A84C',
       title:'Warsh Confirmed as Fed Chair',
       text:'54-45 Senate vote. Balance sheet reduction ($6.7T) expected. 30-year Treasury yield broke above 5%.',
       tag:'FED',tc:'tag-fed'},
      {n:'4',c:'rgba(59,130,246,.2)',nc:'#93c5fd',
       title:'Trump-Xi Summit — No Deal',
       text:'Tech sector under pressure. NVDA -4.4%, Intel -6%, Micron -6.6%. July tariff uncertainty remains.',
       tag:'GEOPOLITICS',tc:'tag-geo'},
      {n:'5',c:'rgba(167,139,250,.2)',nc:'#c4b5fd',
       title:'Retail ETF -6% Weekly',
       text:'4th consecutive weekly decline. Worst week since Oct-2025. Consumer spending signals weakening.',
       tag:'SECTOR',tc:'tag-sector'},
    ],
    context:'The S&P 500 is under pressure from <strong>persistent inflation and rising yields</strong>. The Warsh Fed prioritizes fighting inflation over growth. <strong>Energy and Financials</strong> lead year-to-date. Tech and Consumer Discretionary are under pressure. Markets are pricing in <strong>zero rate cuts in 2026</strong>. Average FCF yield of the Top 5 exceeds <strong>8%</strong> — compelling relative value in a high-rate environment.',
  },
  it: {
    subtitle:    'Dashboard Mercati in Tempo Reale',
    live:        'IN DIRETTA',
    refresh:     '⟳ Aggiorna',
    loading:     'Caricamento…',
    top5title:   '⭐ Top 5 Forte Acquisto — Consenso Analisti',
    moversTitle: '🔥 Market Movers — Ultime 72 ore',
    contextTitle:'📊 Contesto di Mercato',
    footerLeft:  'Fonte: Yahoo Finance · Aggiornamento auto 60s · Rating Analisti ≤ 1.5 (Forte Acquisto)',
    footerRight: 'Solo a scopo informativo, non costituisce consulenza finanziaria',
    colStock:    'Titolo', colPrice:'Prezzo', colDay:'Giorno %',
    colCap:'Cap. Mercato', colPE:'P/E', colDiv:'Rend. Div.', colRange:'Intervallo 52S',
    idxNames: {'^GSPC':'S&P 500','^IXIC':'NASDAQ','^DJI':'DOW','^VIX':'VIX','GC=F':'Oro','CL=F':'Petrolio WTI','^RUT':'Russell 2K'},
    movers:[
      {n:'1',c:'rgba(239,68,68,.2)',nc:'#f87171',
       title:'CPI Aprile +3.8% su base annua',
       text:'La sorpresa inflazionistica più grande da maggio 2023. Il rendimento del Treasury decennale è salito al 4.46%. Probabilità di un rialzo Fed nel 2026: <strong>45%</strong>.',
       tag:'MACRO',tc:'tag-macro'},
      {n:'2',c:'rgba(239,68,68,.2)',nc:'#f87171',
       title:'Guerra Iran — Petrolio a $120+',
       text:'Il Brent ha guadagnato il +50% dall\'inizio del conflitto. Lo Stretto di Hormuz sotto pressione. Rischio di stagflazione in aumento.',
       tag:'GEOPOLITICA',tc:'tag-geo'},
      {n:'3',c:'rgba(201,168,76,.2)',nc:'#C9A84C',
       title:'Warsh confermato Presidente della Fed',
       text:'54-45 al Senato. Prevista riduzione del bilancio ($6.7T). Il Treasury a 30 anni ha superato il 5%.',
       tag:'FED',tc:'tag-fed'},
      {n:'4',c:'rgba(59,130,246,.2)',nc:'#93c5fd',
       title:'Vertice Trump-Xi senza accordi',
       text:'Settore tech sotto pressione. NVDA -4.4%, Intel -6%, Micron -6.6%. Incertezza sui dazi di luglio.',
       tag:'GEOPOLITICA',tc:'tag-geo'},
      {n:'5',c:'rgba(167,139,250,.2)',nc:'#c4b5fd',
       title:'ETF Retail -6% settimanale',
       text:'4° calo settimanale consecutivo. Peggior settimana da ottobre 2025. Segnali di debolezza dei consumi.',
       tag:'SETTORIALE',tc:'tag-sector'},
    ],
    context:'L\'S&P 500 è sotto pressione a causa di <strong>inflazione persistente e rendimenti in rialzo</strong>. La Fed di Warsh dà priorità alla lotta all\'inflazione rispetto alla crescita. <strong>Energia e Finanziari</strong> guidano da inizio anno. Tech e Consumer Discretionary sotto pressione. I mercati prezzano <strong>zero tagli dei tassi nel 2026</strong>. Il FCF yield medio del Top 5 supera l\'<strong>8%</strong> — valore relativo interessante in un contesto di tassi elevati.',
  }
};

// ══════════════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════════════
let currentLang = localStorage.getItem('pfin-lang') || 'es';
let lastData = null;

// ══════════════════════════════════════════════════════════════
//  Language switching
// ══════════════════════════════════════════════════════════════
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('pfin-lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.toLowerCase().includes(lang));
  });
  applyTranslations();
  if (lastData) {
    renderIndices(lastData.indices);
    renderTop5(lastData.top5);
  }
  renderMovers();
  renderContext();
}

function applyTranslations() {
  const t = T[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  document.getElementById('top5-title').textContent   = t.top5title;
  document.getElementById('movers-title').textContent  = t.moversTitle;
  document.getElementById('context-title').textContent = t.contextTitle;
  document.querySelector('[data-i18n="footerLeft"]').textContent  = t.footerLeft;
  document.querySelector('[data-i18n="footerRight"]').textContent = t.footerRight;
  document.querySelector('[data-i18n="subtitle"]').textContent    = t.subtitle;
  document.querySelector('[data-i18n="refresh"]').textContent     = t.refresh;
  document.querySelector('[data-i18n="live"]').textContent        = t.live;
  document.title = "Pietro's Finance Hub — PFin | " + t.live;
}

// ══════════════════════════════════════════════════════════════
//  Market Movers (static content, translated)
// ══════════════════════════════════════════════════════════════
function renderMovers() {
  const movers = T[currentLang].movers;
  document.getElementById('movers-container').innerHTML = movers.map(m =>
    '<div class="mover-item">'
    + '<div class="mover-num" style="background:'+m.c+';color:'+m.nc+';">'+m.n+'</div>'
    + '<div class="mover-text"><strong>'+m.title+'</strong><br>'+m.text
    + '<br><span class="mover-tag '+m.tc+'">'+m.tag+'</span></div>'
    + '</div>'
  ).join('');
}

function renderContext() {
  document.getElementById('context-box').innerHTML = T[currentLang].context;
}

// ══════════════════════════════════════════════════════════════
//  Data helpers
// ══════════════════════════════════════════════════════════════
function fmt(n,d=2){if(!n&&n!==0)return '—';return n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtCap(n){if(!n)return '—';if(n>=1e12)return '$'+(n/1e12).toFixed(1)+'T';if(n>=1e9)return '$'+(n/1e9).toFixed(0)+'B';return '$'+(n/1e6).toFixed(0)+'M'}
function cls(n){return n>0?'up':n<0?'dn':'flat'}
function arrow(n){return n>0?'▲':n<0?'▼':''}

// ══════════════════════════════════════════════════════════════
//  Render functions
// ══════════════════════════════════════════════════════════════
function renderIndices(data) {
  const names = T[currentLang].idxNames;
  if (!data||!data.length) return;
  document.getElementById('indices').innerHTML = data.map(q => {
    const pct = q.regularMarketChangePercent;
    const c   = cls(pct);
    const sign= pct>0?'+':'';
    return '<div class="idx-card">'
      +'<div class="idx-name">'+(names[q.symbol]||q.symbol)+'</div>'
      +'<div class="idx-price '+c+'">'+fmt(q.regularMarketPrice)+'</div>'
      +'<div class="idx-chg '+c+'">'+arrow(pct)+sign+fmt(pct,2)+'%</div>'
    +'</div>';
  }).join('');
}

function renderTop5(data) {
  if (!data||!data.length) {
    document.getElementById('top5-container').innerHTML='<div class="loading">'+T[currentLang].loading+'</div>';return;
  }
  const t = T[currentLang];
  const rows = data.map((q,i) => {
    const pct  = q.regularMarketChangePercent;
    const c    = cls(pct);
    const sign = pct>0?'+':'';
    const lo=q.fiftyTwoWeekLow, hi=q.fiftyTwoWeekHigh, cur=q.regularMarketPrice;
    const pct52 = hi>lo ? ((cur-lo)/(hi-lo)*100).toFixed(0) : 50;
    const divY  = q.dividendYield ? ((q.dividendYield)*100).toFixed(2)+'%' : '—';
    const pe    = q.forwardPE ? fmt(q.forwardPE,1)+'x' : (q.trailingPE ? fmt(q.trailingPE,1)+'x' : '—');
    return '<tr>'
      +'<td><div class="td-sym">'+(i+1)+'. '+q.symbol+'</div>'
      +'<div class="td-name">'+(q.shortName||'').substring(0,22)+'</div></td>'
      +'<td class="td-price">$'+fmt(q.regularMarketPrice)+'</td>'
      +'<td class="td-chg '+c+'">'+arrow(pct)+sign+fmt(pct,2)+'%</td>'
      +'<td class="td-cap">'+fmtCap(q.marketCap)+'</td>'
      +'<td class="td-pe">'+pe+'</td>'
      +'<td class="td-div">'+divY+'</td>'
      +'<td><div class="range-bar"><div class="range-fill" style="width:'+pct52+'%"></div></div>'
      +'<div class="range-labels"><span>$'+fmt(lo,0)+'</span><span>$'+fmt(hi,0)+'</span></div></td>'
    +'</tr>';
  }).join('');

  document.getElementById('top5-container').innerHTML =
    '<table><thead><tr>'
    +'<th>'+t.colStock+'</th><th>'+t.colPrice+'</th><th>'+t.colDay+'</th>'
    +'<th>'+t.colCap+'</th><th>'+t.colPE+'</th><th>'+t.colDiv+'</th>'
    +'<th style="text-align:center">'+t.colRange+'</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>';
}

function renderTape(data) {
  if (!data||!data.length) return;
  const items = data.map(q => {
    const pct = q.regularMarketChangePercent;
    const c   = cls(pct);
    const sign= pct>0?'+':'';
    return '<span class="tape-item">'
      +'<span class="tape-sym">'+q.symbol+'</span>'
      +'<span class="tape-price">$'+fmt(q.regularMarketPrice)+'</span>'
      +'<span class="tape-chg '+c+'">'+arrow(pct)+sign+fmt(pct,2)+'%</span>'
    +'</span>';
  }).join('');
  const tape = document.getElementById('tape');
  tape.innerHTML = items + items; // duplicate for seamless loop
}

// ══════════════════════════════════════════════════════════════
//  Data fetch
// ══════════════════════════════════════════════════════════════
async function loadData() {
  try {
    const r = await fetch('/api/data');
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    lastData = d;
    renderIndices(d.indices);
    renderTop5(d.top5);
    renderTape([...d.indices, ...d.top5]);
    document.getElementById('ts').textContent = d.timestamp;
  } catch(e) {
    document.getElementById('top5-container').innerHTML =
      '<div class="error-msg">⚠️ '+e.message+'<br><small>Retrying in 30s…</small></div>';
  }
}

// ══════════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════════
setLang(currentLang);
loadData();
setInterval(loadData, 60000);
</script>
</body>
</html>`
