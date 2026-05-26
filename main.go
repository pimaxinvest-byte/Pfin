package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// StockData — reused by JS renderTop5 (field names must stay stable)
type StockData struct {
	Symbol                     string  `json:"symbol"`
	ShortName                  string  `json:"shortName"`
	RegularMarketPrice         float64 `json:"regularMarketPrice"`
	RegularMarketChangePercent float64 `json:"regularMarketChangePercent"`
	MarketCap                  float64 `json:"marketCap"`
	FiftyTwoWeekHigh           float64 `json:"fiftyTwoWeekHigh"`
	FiftyTwoWeekLow            float64 `json:"fiftyTwoWeekLow"`
	TrailingPE                 float64 `json:"trailingPE"`
	DividendYield              float64 `json:"dividendYield"`
}

type IndexQuote struct {
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	ChangePct float64 `json:"changePct"`
}

// ─── TradingView Scanner types ────────────────────────────────

type TVStock struct {
	Ticker string  `json:"ticker"`
	Price  float64 `json:"price"`
	Change float64 `json:"change"`
	Rec    float64 `json:"rec"`   // Recommend.All (1D)
	Rec5m  float64 `json:"rec5m"` // Recommend.All (5min)
	RSI    float64 `json:"rsi"`
	RSI5m  float64 `json:"rsi5m"`
	MACD   float64 `json:"macd"`
	BBU    float64 `json:"bbU"`
	BBL    float64 `json:"bbL"`
	EMA50  float64 `json:"ema50"`
	EMA200 float64 `json:"ema200"`
	VWAP   float64 `json:"vwap"`
	Vol    float64 `json:"vol"`
	H52    float64 `json:"h52"`
	L52    float64 `json:"l52"`
}

// ─── Symbols ───────────────────────────────────────────────────

// TradingView Scanner symbols for global indices (works from any IP)
var tvIdxDefs = []struct{ sym, name string }{
	{"SP:SPX", "S&P 500"}, {"DJ:DJI", "Dow Jones"}, {"NASDAQ:NDX", "NASDAQ 100"},
	{"CBOE:VIX", "VIX"}, {"TVC:RUT", "Russell 2K"}, {"BME:IBC", "IBEX 35"},
	{"TVC:GOLD", "Oro / Gold"}, {"NYMEX:CL1!", "WTI Crude"},
}

var ibexTVTickers = []string{
	"BME:CABK", "BME:MTS", "BME:ACX", "BME:MRL", "BME:SAB",
	"BME:IDR", "BME:SAN", "BME:IAG", "BME:BKT", "BME:BBVA",
	"BME:FER", "BME:ENG", "BME:SCYR", "BME:COL", "BME:LOG",
	"BME:ANA", "BME:MAP", "BME:MEL", "BME:NTGY", "BME:SLR",
	"BME:ACS", "BME:IBE", "BME:ANE", "BME:TEF", "BME:ITX",
	"BME:ELE", "BME:AENA", "BME:CLNX", "BME:REP", "BME:AMS",
	"BME:RED", "BME:GRF", "BME:ROVI", "BME:FDR", "BME:PUIG",
}

var tvColumns = []string{
	"name", "close", "change",
	"Recommend.All", "Recommend.All|5",
	"RSI", "RSI|5",
	"MACD.macd", "BB.upper", "BB.lower",
	"EMA50", "EMA200", "VWAP",
	"volume", "High.All", "Low.All",
}

// ─── HTTP clients ──────────────────────────────────────────────

var tvCl = &http.Client{Timeout: 12 * time.Second}

// ─── TradingView helpers ────────────────────────────────────────

func tvHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://www.tradingview.com")
	req.Header.Set("Referer", "https://www.tradingview.com/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
}

func toF(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}

func toS(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// ─── TradingView Top 5 US Strong Buy ──────────────────────────
// Queries america/scan for the 5 highest-rated Strong Buy US stocks.
// Replaces hardcoded Finnhub list with live screener data.

func fetchTop5FromTV() []StockData {
	reqBody := map[string]interface{}{
		"filter": []map[string]interface{}{
			{"left": "Recommend.All", "operation": "greater", "right": 0.5},
			{"left": "market_cap_basic", "operation": "greater", "right": 2e9},
			{"left": "close", "operation": "greater", "right": 5},
			{"left": "volume", "operation": "greater", "right": 200000},
		},
		"sort":  map[string]interface{}{"sortBy": "Recommend.All", "sortOrder": "desc"},
		"range": []int{0, 5},
		"columns": []string{
			"description", "close", "change",
			"Recommend.All",
			"market_cap_basic",
			"price_earnings_ttm",
			"dividends_yield_current",
			"price_52_week_high", "price_52_week_low",
		},
	}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://scanner.tradingview.com/america/scan", bytes.NewReader(body))
	tvHeaders(req)

	resp, err := tvCl.Do(req)
	if err != nil {
		fmt.Printf("[TV top5] %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			S string        `json:"s"`
			D []interface{} `json:"d"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("[TV top5] decode: %v\n", err)
		return nil
	}

	out := make([]StockData, 0, 5)
	for _, item := range result.Data {
		if len(out) >= 5 {
			break
		}
		d := item.D
		if len(d) < 9 {
			continue
		}
		price := toF(d[1])
		if price == 0 {
			continue
		}
		sym := item.S
		if idx := strings.Index(sym, ":"); idx >= 0 {
			sym = sym[idx+1:]
		}
		out = append(out, StockData{
			Symbol:                     sym,
			ShortName:                  toS(d[0]),
			RegularMarketPrice:         price,
			RegularMarketChangePercent: toF(d[2]),
			MarketCap:                  toF(d[4]),
			TrailingPE:                 toF(d[5]),
			DividendYield:              toF(d[6]) / 100, // TV gives %, JS expects decimal
			FiftyTwoWeekHigh:           toF(d[7]),
			FiftyTwoWeekLow:            toF(d[8]),
		})
	}
	fmt.Printf("[TV top5] %d stocks\n", len(out))
	return out
}

// ─── TradingView Scanner — Global Indices ──────────────────────
// Uses TV Scanner (same as IBEX). Works from any cloud IP.
// Replaces Stooq which blocks Railway datacenter IPs.

func fetchIndicesFromTV() []IndexQuote {
	syms := make([]string, len(tvIdxDefs))
	nameMap := map[string]string{}
	for i, d := range tvIdxDefs {
		syms[i] = d.sym
		nameMap[d.sym] = d.name
	}
	reqBody := map[string]interface{}{
		"symbols": map[string]interface{}{
			"tickers": syms,
			"query":   map[string]interface{}{"types": []string{}},
		},
		"columns": []string{"name", "close", "change"},
	}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://scanner.tradingview.com/global/scan", bytes.NewReader(body))
	tvHeaders(req)

	resp, err := tvCl.Do(req)
	if err != nil {
		fmt.Printf("[TV idx] %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			S string        `json:"s"`
			D []interface{} `json:"d"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("[TV idx] decode: %v\n", err)
		return nil
	}

	var out []IndexQuote
	for _, item := range result.Data {
		d := item.D
		if len(d) < 3 {
			continue
		}
		price := toF(d[1])
		if price == 0 {
			continue
		}
		name := nameMap[item.S]
		if name == "" {
			name = item.S
		}
		out = append(out, IndexQuote{
			Symbol:    item.S,
			Name:      name,
			Price:     price,
			ChangePct: toF(d[2]),
		})
	}
	// Preserve original order
	ordered := make([]IndexQuote, 0, len(tvIdxDefs))
	qmap := map[string]IndexQuote{}
	for _, q := range out {
		qmap[q.Symbol] = q
	}
	for _, d := range tvIdxDefs {
		if q, ok := qmap[d.sym]; ok {
			ordered = append(ordered, q)
		}
	}
	fmt.Printf("[TV idx] %d/%d fetched\n", len(ordered), len(tvIdxDefs))
	return ordered
}

// ─── TradingView Scanner ────────────────────────────────────────
// Live IBEX 35 data: price, change, RSI, MACD, BB, EMA, recommendation.
// Works from any IP (Railway, cloud) — public scanner used by TV web app.

func fetchIbexFromTV() []TVStock {
	reqBody := map[string]interface{}{
		"symbols": map[string]interface{}{
			"tickers": ibexTVTickers,
			"query":   map[string]interface{}{"types": []string{}},
		},
		"columns": tvColumns,
	}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://scanner.tradingview.com/spain/scan", bytes.NewReader(body))
	tvHeaders(req)

	resp, err := tvCl.Do(req)
	if err != nil {
		fmt.Printf("[TV] %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			S string        `json:"s"`
			D []interface{} `json:"d"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("[TV] decode: %v\n", err)
		return nil
	}

	out := make([]TVStock, 0, len(result.Data))
	for _, item := range result.Data {
		d := item.D
		if len(d) < 16 {
			continue
		}
		price := toF(d[1])
		if price == 0 {
			continue
		}
		out = append(out, TVStock{
			Ticker: strings.TrimPrefix(item.S, "BME:"),
			Price:  price,
			Change: toF(d[2]),
			Rec:    toF(d[3]),
			Rec5m:  toF(d[4]),
			RSI:    toF(d[5]),
			RSI5m:  toF(d[6]),
			MACD:   toF(d[7]),
			BBU:    toF(d[8]),
			BBL:    toF(d[9]),
			EMA50:  toF(d[10]),
			EMA200: toF(d[11]),
			VWAP:   toF(d[12]),
			Vol:    toF(d[13]),
			H52:    toF(d[14]),
			L52:    toF(d[15]),
		})
	}
	fmt.Printf("[TV] %d IBEX stocks\n", len(out))
	return out
}

// ─── Handlers ──────────────────────────────────────────────────

func apiHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	var top5 []StockData
	var indices []IndexQuote
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); top5 = fetchTop5FromTV() }()
	go func() { defer wg.Done(); indices = fetchIndicesFromTV() }()
	wg.Wait()
	if indices == nil {
		indices = []IndexQuote{}
	}
	type P struct {
		Top5      []StockData  `json:"top5"`
		Indices   []IndexQuote `json:"indices"`
		Timestamp string       `json:"timestamp"`
	}
	json.NewEncoder(w).Encode(P{top5, indices, time.Now().UTC().Format("Mon 02 Jan 2006 — 15:04:05 UTC")})
}

func ibexHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	stocks := fetchIbexFromTV()
	if stocks == nil {
		stocks = []TVStock{}
	}
	type P struct {
		Stocks    []TVStock `json:"stocks"`
		Timestamp string    `json:"timestamp"`
	}
	json.NewEncoder(w).Encode(P{stocks, time.Now().UTC().Format("Mon 02 Jan 2006 — 15:04:05 UTC")})
}

func htmlHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(dashboardHTML))
}

// ─── Main ──────────────────────────────────────────────────────

func main() {
	port := "8080"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}
	http.HandleFunc("/", htmlHandler)
	http.HandleFunc("/api/data", apiHandler)
	http.HandleFunc("/api/ibex", ibexHandler)
	u := "http://localhost:" + port
	fmt.Println("╔══════════════════════════════════════╗")
	fmt.Println("║  Pietro Quantum Finance — PQF        ║")
	fmt.Printf("║  %-36s ║\n", u)
	fmt.Println("╚══════════════════════════════════════╝")
	isCloud := os.Getenv("RAILWAY_ENVIRONMENT") != "" || os.Getenv("RENDER") != "" ||
		os.Getenv("FLY_APP_NAME") != "" || os.Getenv("NO_BROWSER") == "1"
	if !isCloud {
		go func() {
			time.Sleep(600 * time.Millisecond)
			switch runtime.GOOS {
			case "windows":
				exec.Command("cmd", "/c", "start", u).Run()
			case "darwin":
				exec.Command("open", u).Run()
			default:
				exec.Command("xdg-open", u).Run()
			}
		}()
	}
	http.ListenAndServe(":"+port, nil)
}

// ─── Dashboard HTML ────────────────────────────────────────────

const dashboardHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pietro Quantum Finance — PQF</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#040a07;--bg2:#071210;--bg3:#0d1c10;--bg4:#162518;
  --pqf:#2b7a35;--pqf2:#3a9a45;--pqf3:#1a5225;--pqf-glow:rgba(43,122,53,.18);
  --gold:#C9A84C;--gold2:#e8c96b;
  --green:#3fb950;--red:#ef4444;--blue:#3b82f6;--purple:#a78bfa;
  --text:#e2e8f0;--muted:#64748b;--border:#1a3a1e;
  --card:#0a180d;--card2:#0f2012;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:13px}

/* HEADER */
header{background:var(--bg2);border-bottom:1px solid var(--border);padding:9px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100}
.logo-wrap{display:flex;align-items:center;gap:10px;flex-shrink:0}
.pqf-seal{flex-shrink:0}
.brand-text{display:flex;flex-direction:column;line-height:1.2}
.brand-name{font-size:15px;font-weight:800;color:var(--pqf2);letter-spacing:-.3px}
.brand-sub{font-size:9px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase}
.tab-nav{display:flex;gap:2px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:3px;margin-left:8px}
.tab-btn{background:none;border:none;border-radius:5px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;color:var(--muted);transition:all .2s;letter-spacing:.3px}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{background:var(--pqf3);color:var(--pqf2);border:1px solid var(--pqf)}
.hdr-right{display:flex;align-items:center;gap:8px;margin-left:auto}
.live-badge{display:flex;align-items:center;gap:5px;background:var(--pqf-glow);border:1px solid rgba(43,122,53,.35);border-radius:20px;padding:4px 10px;font-size:10px;font-weight:700;color:var(--green)}
.live-dot{width:5px;height:5px;background:var(--green);border-radius:50%;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.lang-sw{display:flex;gap:3px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:2px}
.lang-btn{background:none;border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--muted);transition:all .2s}
.lang-btn.active{background:var(--gold);color:#000;font-weight:700}
.ts{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;white-space:nowrap}
.refresh-btn{background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:10px;padding:5px 10px;cursor:pointer;transition:.2s}
.refresh-btn:hover{border-color:var(--pqf);color:var(--pqf2)}

/* TAPE */
.tape{background:var(--bg3);border-bottom:1px solid var(--border);padding:5px 0;overflow:hidden;white-space:nowrap}
.tape-inner{display:inline-flex;gap:24px;animation:scroll 32s linear infinite}
.tape-inner:hover{animation-play-state:paused}
@keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.tape-item{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-family:'JetBrains Mono',monospace}
.tape-sym{font-weight:700;color:var(--pqf2)}
.tape-chg.up{color:var(--green)}.tape-chg.dn{color:var(--red)}

/* TAB CONTENT */
.tab-content{display:none}
.tab-content.active{display:block}

/* INDICES */
.idx-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;padding:14px 20px;background:var(--bg2);border-bottom:1px solid var(--border)}
.idx-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;transition:border-color .2s}
.idx-card:hover{border-color:var(--pqf)}
.idx-name{font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.idx-price{font-size:15px;font-weight:700;font-family:'JetBrains Mono',monospace}
.idx-chg{font-size:10px;font-weight:600;font-family:'JetBrains Mono',monospace;margin-top:1px}
.up{color:var(--green)}.dn{color:var(--red)}.flat{color:var(--muted)}

/* MAIN LAYOUT */
main{padding:16px 20px;display:flex;flex-direction:column;gap:16px}
.sec-title{font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.4px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.sec-title::after{content:'';flex:1;height:1px;background:var(--border)}
.main-grid{display:grid;grid-template-columns:1fr 320px;gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}

/* TABLE */
table{width:100%;border-collapse:collapse}
thead tr{background:var(--bg3)}
th{padding:8px 12px;text-align:right;font-size:9.5px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
th:first-child{text-align:left}
tbody tr{border-top:1px solid var(--border);transition:background .15s}
tbody tr:hover{background:var(--card2)}
td{padding:11px 12px;text-align:right;font-size:12.5px}
td:first-child{text-align:left}
.td-sym{font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--pqf2);font-size:13px}
.td-name{font-size:9.5px;color:var(--muted);margin-top:1px}
.td-price{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:13px}
.td-chg{font-family:'JetBrains Mono',monospace;font-weight:600}
.td-cap,.td-pe{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace}
.td-div{font-size:11px;color:var(--purple);font-family:'JetBrains Mono',monospace}
.range-bar{width:72px;height:5px;background:var(--bg3);border-radius:3px;position:relative;margin:0 auto}
.range-fill{position:absolute;height:100%;background:var(--pqf);border-radius:3px}
.range-labels{display:flex;justify-content:space-between;font-size:8.5px;color:var(--muted);margin-top:2px;font-family:'JetBrains Mono',monospace}

/* SIDEBAR */
.mover-item{padding:10px 12px;border-top:1px solid var(--border);display:flex;align-items:flex-start;gap:8px}
.mover-item:first-of-type{border-top:none}
.mover-num{width:19px;height:19px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:1px}
.mover-text{font-size:10.5px;line-height:1.55;color:var(--text)}
.mover-text strong{color:var(--gold)}
.mover-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-top:3px}
.tag-macro{background:rgba(59,130,246,.2);color:#93c5fd}
.tag-geo{background:rgba(239,68,68,.2);color:#fca5a5}
.tag-sector{background:rgba(167,139,250,.2);color:#c4b5fd}
.tag-fed{background:rgba(201,168,76,.2);color:var(--gold)}
.context-box{padding:12px;background:var(--bg3);border-radius:7px;font-size:10.5px;line-height:1.7;color:var(--muted)}
.context-box strong{color:var(--text)}

/* ── IBEX TAB ── */
.ibex-wrap{padding:16px 20px;display:flex;flex-direction:column;gap:14px}
.ibex-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}
.hz-bar{display:flex;gap:2px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:3px}
.hz-btn{background:none;border:none;border-radius:5px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;color:var(--muted);transition:.2s}
.hz-btn.active{background:var(--bg4);color:var(--pqf2);border:1px solid var(--pqf)}
.ibex-note{font-size:10px;color:var(--muted);font-style:italic}
.kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px}
.kpi-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
.kpi-val{font-size:20px;font-weight:800;line-height:1}
.kpi-sub{font-size:9px;color:var(--muted);margin-top:2px}
.sentiment{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px}
.sent-lbl{font-size:10px;color:var(--muted);margin-bottom:7px}
.sent-track{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;margin-bottom:6px}
.sent-track div{border-radius:2px;transition:width .4s}
.sent-info{display:flex;justify-content:space-between;font-size:10px;font-weight:600}
.filter-bar{display:flex;gap:6px;flex-wrap:wrap}
.ftab{padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--muted);cursor:pointer;font-size:10.5px;font-weight:600;transition:.15s}
.ftab:hover{color:var(--text)}
.ftab.on{background:var(--bg4);color:var(--text);border-color:var(--pqf)}
.ftab.g.on{background:rgba(63,185,80,.12);color:var(--green);border-color:rgba(63,185,80,.4)}
.ftab.r.on{background:rgba(239,68,68,.12);color:var(--red);border-color:rgba(239,68,68,.4)}
.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.scard{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:border-color .2s}
.scard:hover{border-color:var(--pqf)}
.scard.cg{border-left:3px solid var(--green)}
.scard.cr{border-left:3px solid var(--red)}
.scard.cn{border-left:3px solid var(--muted)}
.sc-head{padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-start}
.sc-ticker{font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--pqf2);font-size:14px}
.sc-name{font-size:9px;color:var(--muted);margin-top:2px}
.sc-price{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;text-align:right}
.sc-chg{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;display:block;text-align:right;margin-top:2px}
.sc-sigbar{padding:6px 12px;display:flex;align-items:center;gap:8px}
.sc-sigbar.cg{background:rgba(63,185,80,.08)}
.sc-sigbar.cr{background:rgba(239,68,68,.08)}
.sc-sigbar.cn{background:var(--bg3)}
.sc-siglbl{font-size:10px;font-weight:700;min-width:80px;white-space:nowrap}
.sc-bar{flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden}
.sc-fill{height:100%;border-radius:2px;transition:width .4s}
.cg .sc-fill{background:var(--green)}
.cr .sc-fill{background:var(--red)}
.cn .sc-fill{background:var(--muted)}
.sc-score{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--muted);min-width:40px;text-align:right}
.sc-inds{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid var(--border)}
.ind{padding:7px 10px;border-right:1px solid var(--border)}
.ind:nth-child(3n){border-right:none}
.ind-l{font-size:8.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px}
.ind-v{font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace}
.ind-s{font-size:8.5px;color:var(--muted)}
.sc-tags{padding:6px 10px;display:flex;flex-wrap:wrap;gap:4px;border-top:1px solid var(--border)}
.tag{font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px}
.tg{background:rgba(63,185,80,.15);color:var(--green)}
.tr{background:rgba(239,68,68,.15);color:var(--red)}
.ty{background:rgba(210,153,34,.15);color:var(--gold)}
.tp{background:rgba(167,139,250,.15);color:var(--purple)}
.to{background:rgba(255,166,87,.15);color:#ffa657}
.sc-tvlink{display:block;padding:7px 12px;font-size:10px;color:var(--pqf2);text-decoration:none;border-top:1px solid var(--border);transition:.15s}
.sc-tvlink:hover{background:var(--bg3)}
.ibex-table-wrap{overflow-x:auto}
.ibex-table-wrap table thead tr{background:var(--bg3)}
.ibex-table-wrap table td,.ibex-table-wrap table th{padding:8px 10px;white-space:nowrap}
.dt{font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px}

/* FOOTER */
footer{background:var(--bg2);border-top:1px solid var(--border);padding:8px 20px;font-size:9.5px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}
.footer-brand{color:var(--pqf2);font-weight:700}

/* STATES */
.loading{text-align:center;padding:40px;color:var(--muted);font-size:12px}
.spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--pqf);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px}
@keyframes spin{to{transform:rotate(360deg)}}
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:7px;padding:10px 14px;font-size:11px;color:#fca5a5;text-align:center;margin:10px}
@media(max-width:768px){
  .idx-strip{grid-template-columns:repeat(4,1fr)}
  .main-grid{grid-template-columns:1fr}
  .kpi-row{grid-template-columns:repeat(3,1fr)}
}
</style>
</head>
<body>

<header>
  <div class="logo-wrap">
    <svg class="pqf-seal" width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="47" fill="none" stroke="#2b7a35" stroke-width="2" stroke-dasharray="2.5 3.5"/>
      <circle cx="50" cy="50" r="39" fill="none" stroke="#2b7a35" stroke-width="1.5"/>
      <text x="19" y="58" font-family="Georgia,serif" font-size="14" fill="#2b7a35">⚜</text>
      <text x="67" y="58" font-family="Georgia,serif" font-size="14" fill="#2b7a35">⚜</text>
      <text x="50" y="63" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="28" font-weight="bold" fill="#2b7a35" letter-spacing="-1">PQF</text>
    </svg>
    <div class="brand-text">
      <div class="brand-name">Pietro Quantum Finance</div>
      <div class="brand-sub" data-i18n="subtitle">Live Market Intelligence</div>
    </div>
  </div>

  <div class="tab-nav">
    <button class="tab-btn active" onclick="setTab('global')" id="tab-btn-global">🌍 Global</button>
    <button class="tab-btn" onclick="setTab('ibex')" id="tab-btn-ibex">📊 IBEX 35</button>
  </div>

  <div class="hdr-right">
    <div class="live-badge"><div class="live-dot"></div><span data-i18n="live">LIVE</span></div>
    <div class="lang-sw">
      <button class="lang-btn active" onclick="setLang('es')">🇪🇸 ES</button>
      <button class="lang-btn" onclick="setLang('en')">🇬🇧 EN</button>
      <button class="lang-btn" onclick="setLang('it')">🇮🇹 IT</button>
    </div>
    <div class="ts" id="ts">—</div>
    <button class="refresh-btn" onclick="refreshAll()" data-i18n="refresh">⟳ Refresh</button>
  </div>
</header>

<!-- TICKER TAPE -->
<div class="tape" id="tape-wrap"><div class="tape-inner" id="tape">
  <span class="tape-item"><span class="tape-sym">PQF</span><span>Connecting…</span></span>
</div></div>

<!-- ══ GLOBAL TAB ══ -->
<div class="tab-content active" id="tab-global">
  <div class="idx-strip" id="indices">
    <div class="idx-card"><div class="idx-name" data-i18n="loading">Loading…</div></div>
  </div>
  <main>
    <div class="main-grid">
      <div>
        <div class="sec-title" id="top5-title">⭐ Top 5 Strong Buy</div>
        <div class="card" id="top5-container">
          <div class="loading"><div class="spinner"></div><span data-i18n="loading">Loading…</span></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <div class="sec-title" id="movers-title">🔥 Market Movers</div>
          <div class="card" id="movers-container"></div>
        </div>
        <div>
          <div class="sec-title" id="context-title">📊 Context</div>
          <div class="context-box" id="context-box"></div>
        </div>
      </div>
    </div>
  </main>
</div>

<!-- ══ IBEX 35 TAB ══ -->
<div class="tab-content" id="tab-ibex">
  <div class="ibex-wrap">
    <div class="ibex-header">
      <div>
        <div class="sec-title" style="margin-bottom:2px">📊 IBEX 35 Signals · TradingView</div>
        <div class="ibex-note" id="ibex-note">Señales: 25 May 2026 · Cargando precios…</div>
      </div>
      <div class="hz-bar">
        <button class="hz-btn active" onclick="setHz('5m',this)">⚡ Scalping 5min</button>
        <button class="hz-btn" onclick="setHz('2m',this)">📅 2 Meses</button>
      </div>
    </div>
    <div class="kpi-row" id="ibex-kpi"></div>
    <div class="sentiment" id="ibex-sent"></div>
    <div class="filter-bar" id="ibex-filters"></div>
    <div class="cards-grid" id="ibex-cards"></div>
    <div>
      <div class="sec-title">📋 35 Componentes</div>
      <div class="ibex-table-wrap"><table><thead id="ibex-thead"></thead><tbody id="ibex-tbody"></tbody></table></div>
    </div>
  </div>
</div>

<footer>
  <span data-i18n="footerLeft">Datos: TradingView Scanner · Auto-refresh 60s</span>
  <span><span class="footer-brand">Pietro Quantum Finance — PQF</span> &nbsp;·&nbsp; <span data-i18n="footerRight">Solo informativo</span></span>
</footer>

<script>
// ══ i18n ══════════════════════════════════════════════════════
const T = {
  es:{subtitle:'Live Market Intelligence',live:'EN VIVO',refresh:'⟳ Actualizar',loading:'Cargando…',
    top5title:'⭐ Top 5 Strong Buy — Consenso Analistas',moversTitle:'🔥 Market Movers — 72h',
    contextTitle:'📊 Contexto de Mercado',
    footerLeft:'Fuente: TradingView Scanner · Auto-refresh 60s',footerRight:'Solo informativo',
    colStock:'Stock',colPrice:'Precio',colDay:'Día %',colCap:'Mkt Cap',colPE:'P/E',colDiv:'Div',colRange:'Rango 52S',
    movers:[
      {n:'1',c:'rgba(239,68,68,.2)',nc:'#f87171',title:'CPI Abril +3.8% YoY',
       text:'Mayor sorpresa inflacionaria desde mayo 2023. Yield del 10Y a 4.46%. Prob. subida Fed 2026: <strong>45%</strong>.',tag:'MACRO',tc:'tag-macro'},
      {n:'2',c:'rgba(239,68,68,.2)',nc:'#f87171',title:'Guerra Irán — Petróleo $120+',
       text:'Brent +50% desde inicio del conflicto. Estrecho de Ormuz bajo presión. Riesgo stagflación.',tag:'GEO',tc:'tag-geo'},
      {n:'3',c:'rgba(201,168,76,.2)',nc:'#C9A84C',title:'Warsh confirmado Presidente Fed',
       text:'54-45 en Senado. Balance ($6.7T) a reducir. Treasury 30Y superó el 5%.',tag:'FED',tc:'tag-fed'},
      {n:'4',c:'rgba(59,130,246,.2)',nc:'#93c5fd',title:'Cumbre Trump-Xi sin acuerdos',
       text:'Tech bajo presión. NVDA -4.4%, Intel -6%, Micron -6.6%. Incertidumbre aranceles julio.',tag:'GEO',tc:'tag-geo'},
      {n:'5',c:'rgba(167,139,250,.2)',nc:'#c4b5fd',title:'Retail ETF -6% semanal',
       text:'4ª caída consecutiva. Peor semana desde oct-2025. Señales de debilidad del consumidor.',tag:'SECTORIAL',tc:'tag-sector'},
    ],
    context:'El S&P 500 opera bajo presión por <strong>inflación persistente y yields al alza</strong>. La Fed de Warsh prioriza inflación sobre crecimiento. <strong>Energy y Financials</strong> lideran en el año. Tech y Consumer Discretionary bajo presión. Mercado descuenta <strong>sin recortes en 2026</strong>.',
  },
  en:{subtitle:'Live Market Intelligence',live:'LIVE',refresh:'⟳ Refresh',loading:'Loading…',
    top5title:'⭐ Top 5 Strong Buy — Analyst Consensus',moversTitle:'🔥 Market Movers — 72h',
    contextTitle:'📊 Market Context',
    footerLeft:'Source: TradingView Scanner · Auto-refresh 60s',footerRight:'For informational purposes only',
    colStock:'Stock',colPrice:'Price',colDay:'Day %',colCap:'Mkt Cap',colPE:'P/E',colDiv:'Div',colRange:'52W Range',
    movers:[
      {n:'1',c:'rgba(239,68,68,.2)',nc:'#f87171',title:'April CPI +3.8% YoY',
       text:'Biggest inflation surprise since May 2023. 10Y yield at 4.46%. Fed hike probability 2026: <strong>45%</strong>.',tag:'MACRO',tc:'tag-macro'},
      {n:'2',c:'rgba(239,68,68,.2)',nc:'#f87171',title:'Iran War — Oil at $120+',
       text:'Brent +50% since conflict began. Strait of Hormuz under pressure. Stagflation risk rising.',tag:'GEO',tc:'tag-geo'},
      {n:'3',c:'rgba(201,168,76,.2)',nc:'#C9A84C',title:'Warsh confirmed Fed Chair',
       text:'54-45 Senate vote. Balance sheet ($6.7T) reduction expected. 30Y Treasury broke above 5%.',tag:'FED',tc:'tag-fed'},
      {n:'4',c:'rgba(59,130,246,.2)',nc:'#93c5fd',title:'Trump-Xi Summit — No Deal',
       text:'Tech under pressure. NVDA -4.4%, Intel -6%, Micron -6.6%. July tariff uncertainty.',tag:'GEO',tc:'tag-geo'},
      {n:'5',c:'rgba(167,139,250,.2)',nc:'#c4b5fd',title:'Retail ETF -6% Weekly',
       text:'4th consecutive weekly decline. Worst week since Oct-2025. Consumer spending weakening.',tag:'SECTOR',tc:'tag-sector'},
    ],
    context:'S&P 500 under pressure from <strong>persistent inflation and rising yields</strong>. Warsh Fed prioritizes inflation over growth. <strong>Energy and Financials</strong> lead year-to-date. Tech and Consumer Discretionary under pressure. Markets price in <strong>zero rate cuts in 2026</strong>.',
  },
  it:{subtitle:'Mercati Finanziari in Diretta',live:'IN DIRETTA',refresh:'⟳ Aggiorna',loading:'Caricamento…',
    top5title:'⭐ Top 5 Forte Acquisto — Consenso Analisti',moversTitle:'🔥 Market Movers — 72h',
    contextTitle:'📊 Contesto di Mercato',
    footerLeft:'Fonte: TradingView Scanner · Aggiornamento auto 60s',footerRight:'Solo a scopo informativo',
    colStock:'Titolo',colPrice:'Prezzo',colDay:'Giorno %',colCap:'Cap. Merc.',colPE:'P/E',colDiv:'Div',colRange:'Intervallo 52S',
    movers:[
      {n:'1',c:'rgba(239,68,68,.2)',nc:'#f87171',title:'CPI Aprile +3.8% annuo',
       text:'La sorpresa inflazionistica più grande da maggio 2023. Rendimento Treasury 10Y al 4.46%. Probabilità rialzo Fed 2026: <strong>45%</strong>.',tag:'MACRO',tc:'tag-macro'},
      {n:'2',c:'rgba(239,68,68,.2)',nc:'#f87171',title:'Guerra Iran — Petrolio $120+',
       text:'Brent +50% dall\'inizio del conflitto. Stretto di Hormuz sotto pressione. Rischio stagflazione.',tag:'GEO',tc:'tag-geo'},
      {n:'3',c:'rgba(201,168,76,.2)',nc:'#C9A84C',title:'Warsh confermato Presidente Fed',
       text:'54-45 al Senato. Riduzione bilancio ($6.7T) prevista. Treasury 30Y superato il 5%.',tag:'FED',tc:'tag-fed'},
      {n:'4',c:'rgba(59,130,246,.2)',nc:'#93c5fd',title:'Vertice Trump-Xi senza accordi',
       text:'Tech sotto pressione. NVDA -4.4%, Intel -6%, Micron -6.6%. Incertezza dazi luglio.',tag:'GEO',tc:'tag-geo'},
      {n:'5',c:'rgba(167,139,250,.2)',nc:'#c4b5fd',title:'ETF Retail -6% settimanale',
       text:'4° calo settimanale consecutivo. Peggior settimana da ottobre 2025. Segnali di debolezza.',tag:'SETTORIALE',tc:'tag-sector'},
    ],
    context:'L\'S&P 500 sotto pressione per <strong>inflazione persistente e rendimenti in rialzo</strong>. Fed di Warsh prioritizza lotta all\'inflazione. <strong>Energia e Finanziari</strong> guidano da inizio anno. Tech e Consumer Discretionary sotto pressione. I mercati prezzano <strong>zero tagli nel 2026</strong>.',
  }
};

let currentLang = localStorage.getItem('pqf-lang') || 'es';
let lastData = null;

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('pqf-lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(lang)));
  applyT();
  if (lastData) { renderIndices(lastData.indices); renderTop5(lastData.top5); }
  renderMovers(); renderContext();
}

function applyT() {
  const t = T[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => { if (t[el.dataset.i18n]) el.textContent = t[el.dataset.i18n]; });
  document.getElementById('top5-title').textContent   = t.top5title;
  document.getElementById('movers-title').textContent  = t.moversTitle;
  document.getElementById('context-title').textContent = t.contextTitle;
}

// ══ Tab switching ═════════════════════════════════════════════
function setTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-btn-' + tab).classList.add('active');
  if (tab === 'ibex') loadIbex();
}

// ══ Formatters ════════════════════════════════════════════════
function fmt(n, d=2) { if (!n && n !== 0) return '—'; return n.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}); }
function fmtCap(n) { if (!n) return '—'; if (n>=1e12) return '$'+(n/1e12).toFixed(1)+'T'; if (n>=1e9) return '$'+(n/1e9).toFixed(0)+'B'; return '$'+(n/1e6).toFixed(0)+'M'; }
function fmtIdx(sym, p) {
  const usd = ['XAUUSD','CL.F'];
  const prefix = usd.includes(sym) ? '$' : '';
  if (p >= 10000) return prefix + p.toLocaleString('en-US', {maximumFractionDigits:0});
  if (p >= 1000)  return prefix + p.toLocaleString('en-US', {maximumFractionDigits:2});
  if (p >= 10)    return prefix + fmt(p, 2);
  return prefix + fmt(p, 3);
}
function cls(n) { return n > 0 ? 'up' : n < 0 ? 'dn' : 'flat'; }
function arrow(n) { return n > 0 ? '▲' : n < 0 ? '▼' : ''; }

// ══ Render indices (real values from TradingView Scanner) ═════
function renderIndices(data) {
  if (!data || !data.length) {
    document.getElementById('indices').innerHTML = '<div class="idx-card"><div class="idx-name" style="color:var(--muted)">Índices no disponibles</div></div>';
    return;
  }
  document.getElementById('indices').innerHTML = data.map(q => {
    const c = cls(q.changePct);
    const sign = q.changePct > 0 ? '+' : '';
    return '<div class="idx-card">'
      + '<div class="idx-name">' + (q.name || q.symbol) + '</div>'
      + '<div class="idx-price ' + c + '">' + fmtIdx(q.symbol, q.price) + '</div>'
      + '<div class="idx-chg ' + c + '">' + arrow(q.changePct) + sign + fmt(q.changePct, 2) + '%</div>'
      + '</div>';
  }).join('');
}

// ══ Render Top 5 ══════════════════════════════════════════════
function renderTop5(data) {
  if (!data || !data.length) {
    document.getElementById('top5-container').innerHTML = '<div class="loading"><div class="spinner"></div>' + T[currentLang].loading + '</div>';
    return;
  }
  const t = T[currentLang];
  const rows = data.map((q, i) => {
    const pct = q.regularMarketChangePercent;
    const c = cls(pct);
    const sign = pct > 0 ? '+' : '';
    const lo = q.fiftyTwoWeekLow, hi = q.fiftyTwoWeekHigh, cur = q.regularMarketPrice;
    const pct52 = hi > lo ? ((cur - lo) / (hi - lo) * 100).toFixed(0) : 50;
    const divY = q.dividendYield ? (q.dividendYield * 100).toFixed(2) + '%' : '—';
    const pe = q.trailingPE ? fmt(q.trailingPE, 1) + 'x' : '—';
    return '<tr><td><div class="td-sym">' + (i+1) + '. ' + q.symbol + '</div>'
      + '<div class="td-name">' + (q.shortName || '').substring(0, 22) + '</div></td>'
      + '<td class="td-price">$' + fmt(q.regularMarketPrice) + '</td>'
      + '<td class="td-chg ' + c + '">' + arrow(pct) + sign + fmt(pct, 2) + '%</td>'
      + '<td class="td-cap">' + fmtCap(q.marketCap) + '</td>'
      + '<td class="td-pe">' + pe + '</td>'
      + '<td class="td-div">' + divY + '</td>'
      + '<td><div class="range-bar"><div class="range-fill" style="width:' + pct52 + '%"></div></div>'
      + '<div class="range-labels"><span>$' + fmt(lo, 0) + '</span><span>$' + fmt(hi, 0) + '</span></div></td></tr>';
  }).join('');
  document.getElementById('top5-container').innerHTML =
    '<table><thead><tr><th>' + t.colStock + '</th><th>' + t.colPrice + '</th><th>' + t.colDay + '</th>'
    + '<th>' + t.colCap + '</th><th>' + t.colPE + '</th><th>' + t.colDiv + '</th>'
    + '<th style="text-align:center">' + t.colRange + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function renderTape(data) {
  if (!data || !data.length) return;
  const mkItem = q => {
    const pct = q.regularMarketChangePercent || q.changePct || 0;
    const c = cls(pct);
    const sign = pct > 0 ? '+' : '';
    const price = q.regularMarketPrice ? '$' + fmt(q.regularMarketPrice) : fmtIdx(q.symbol, q.price || 0);
    return '<span class="tape-item"><span class="tape-sym">' + (q.symbol||q.Symbol) + '</span>'
      + '<span>' + price + '</span>'
      + '<span class="tape-chg ' + c + '">' + arrow(pct) + sign + fmt(pct, 2) + '%</span></span>';
  };
  const items = data.map(mkItem).join('');
  document.getElementById('tape').innerHTML = items + items;
}

function renderMovers() {
  const movers = T[currentLang].movers;
  document.getElementById('movers-container').innerHTML = movers.map(m =>
    '<div class="mover-item"><div class="mover-num" style="background:' + m.c + ';color:' + m.nc + ';">' + m.n + '</div>'
    + '<div class="mover-text"><strong>' + m.title + '</strong><br>' + m.text
    + '<br><span class="mover-tag ' + m.tc + '">' + m.tag + '</span></div></div>'
  ).join('');
}

function renderContext() {
  document.getElementById('context-box').innerHTML = T[currentLang].context;
}

// ══ Load global data ══════════════════════════════════════════
async function loadGlobal() {
  try {
    const r = await fetch('/api/data');
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    lastData = d;
    renderIndices(d.indices);
    renderTop5(d.top5);
    const tapeData = [...(d.indices||[]).map(q => ({...q, regularMarketChangePercent: q.changePct, regularMarketPrice: q.price})),
                      ...(d.top5||[])];
    renderTape(tapeData);
    document.getElementById('ts').textContent = d.timestamp;
  } catch(e) {
    document.getElementById('top5-container').innerHTML = '<div class="err">⚠️ ' + e.message + '</div>';
  }
}

function refreshAll() { loadGlobal(); if (ibexLoaded) loadIbex(); }

// ══ IBEX 35 DATA (TradingView signals — 25 May 2026) ══════════
let ibexHz = '5m', ibexFilter = 'ALL', ibexLive = {}, ibexLoaded = false;

// Convert TV Recommend.All score (-1..1) → signal label
function recToSig(v) {
  if (v >= 0.5)  return 'STRONG BUY';
  if (v >= 0.1)  return 'BUY';
  if (v > -0.1)  return 'NEUTRAL';
  if (v > -0.5)  return 'SELL';
  return 'STRONG SELL';
}

const IBEX = [{"ticker":"CABK","name":"CaixaBank SA","sym":"CABK","price":11.67,"sig5m":"STRONG BUY","rec5m":0.558,"rsi5m":71.2,"macdH5m":0.00239,"vwap":11.61,"bbU":11.673,"bbL":11.582,"chg5m":0.13,"vol_ratio":9.62,"vol_anom":true,"div5m":"confirmed_bull","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":71.8,"sig1w":"STRONG BUY","rec1w":0.603,"rsi1w":67.1,"sig1m":"STRONG BUY","rec1m":0.552,"sig2m":"STRONG BUY","conv2m":0.579,"chg1d":2.1,"perf1m":12.3,"perf3m":7.4,"rs1m":10.2,"rs3m":2.5,"h52":11.68,"l52":7.204,"pos52w":100,"ema50d":10.73,"ema200":9.79,"target2m":11.68,"stop2m":10.85,"upside":0.1,"rr":0.0},
{"ticker":"MTS","name":"ArcelorMittal SA","sym":"MTS","price":57.9,"sig5m":"BUY","rec5m":0.467,"rsi5m":60.6,"macdH5m":-0.01181,"vwap":57.839,"bbU":57.977,"bbL":57.727,"chg5m":0.1,"vol_ratio":3.54,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.512,"rsi1d":65.0,"sig1w":"STRONG BUY","rec1w":0.603,"rsi1w":69.2,"sig1m":"STRONG BUY","rec1m":0.603,"sig2m":"STRONG BUY","conv2m":0.576,"chg1d":2.12,"perf1m":13.6,"perf3m":2.4,"rs1m":11.5,"rs3m":-2.4,"h52":58.4,"l52":25.78,"pos52w":98,"ema50d":50.999,"ema200":42.75,"target2m":58.4,"stop2m":53.85,"upside":0.9,"rr":0.1},
{"ticker":"ACX","name":"Acerinox SA","sym":"ACX","price":15.41,"sig5m":"SELL","rec5m":-0.112,"rsi5m":49.1,"macdH5m":-0.00119,"vwap":15.437,"bbU":15.441,"bbL":15.385,"chg5m":-0.06,"vol_ratio":8.61,"vol_anom":true,"div5m":"pullback","sig1d":"STRONG BUY","rec1d":0.603,"rsi1d":68.0,"sig1w":"STRONG BUY","rec1w":0.536,"rsi1w":71.5,"sig1m":"STRONG BUY","rec1m":0.558,"sig2m":"STRONG BUY","conv2m":0.561,"chg1d":1.05,"perf1m":16.7,"perf3m":15.7,"rs1m":14.7,"rs3m":10.8,"h52":15.54,"l52":9.925,"pos52w":98,"ema50d":13.773,"ema200":12.503,"target2m":15.54,"stop2m":14.33,"upside":0.8,"rr":0.1},
{"ticker":"SAB","name":"Banco de Sabadell SA","sym":"SAB","price":3.471,"sig5m":"BUY","rec5m":0.467,"rsi5m":62.0,"macdH5m":-0.00029,"vwap":3.461,"bbU":3.476,"bbL":3.461,"chg5m":0.03,"vol_ratio":1.33,"vol_anom":false,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":65.5,"sig1w":"STRONG BUY","rec1w":0.558,"rsi1w":60.0,"sig1m":"BUY","rec1m":0.376,"sig2m":"STRONG BUY","conv2m":0.521,"chg1d":2.15,"perf1m":9.7,"perf3m":4.2,"rs1m":7.6,"rs3m":-0.6,"h52":3.484,"l52":2.632,"pos52w":98,"ema50d":3.254,"ema200":3.138,"target2m":3.48,"stop2m":3.23,"upside":0.3,"rr":0.0},
{"ticker":"SAN","name":"Banco Santander SA","sym":"SAN","price":10.69,"sig5m":"BUY","rec5m":0.445,"rsi5m":63.8,"macdH5m":-0.00059,"vwap":10.659,"bbU":10.705,"bbL":10.651,"chg5m":0.02,"vol_ratio":5.83,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.603,"rsi1d":58.3,"sig1w":"BUY","rec1w":0.467,"rsi1w":58.8,"sig1m":"STRONG BUY","rec1m":0.512,"sig2m":"STRONG BUY","conv2m":0.517,"chg1d":2.51,"perf1m":4.9,"perf3m":-1.5,"rs1m":2.8,"rs3m":-6.3,"h52":11.26,"l52":6.79,"pos52w":87,"ema50d":10.278,"ema200":9.419,"target2m":11.26,"stop2m":9.97,"upside":5.3,"rr":0.8},
{"ticker":"IAG","name":"Intl Consolidated Airlines","sym":"IAG","price":4.742,"sig5m":"BUY","rec5m":0.445,"rsi5m":60.0,"macdH5m":-0.00106,"vwap":4.751,"bbU":4.754,"bbL":4.737,"chg5m":-0.02,"vol_ratio":0.6,"vol_anom":false,"div5m":"","sig1d":"BUY","rec1d":0.467,"rsi1d":59.8,"sig1w":"STRONG BUY","rec1w":0.558,"rsi1w":55.9,"sig1m":"BUY","rec1m":0.462,"sig2m":"STRONG BUY","conv2m":0.511,"chg1d":3.22,"perf1m":8.4,"perf3m":-3.9,"rs1m":6.4,"rs3m":-8.8,"h52":5.3,"l52":3.533,"pos52w":68,"ema50d":4.46,"ema200":4.401,"target2m":5.3,"stop2m":4.41,"upside":11.8,"rr":1.7},
{"ticker":"BBVA","name":"Banco Bilbao Vizcaya","sym":"BBVA","price":19.87,"sig5m":"BUY","rec5m":0.445,"rsi5m":58.4,"macdH5m":-0.0062,"vwap":19.815,"bbU":19.904,"bbL":19.846,"chg5m":0.05,"vol_ratio":2.49,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":61.3,"sig1w":"BUY","rec1w":0.467,"rsi1w":58.1,"sig1m":"BUY","rec1m":0.467,"sig2m":"BUY","conv2m":0.494,"chg1d":2.98,"perf1m":7.8,"perf3m":-0.6,"rs1m":5.7,"rs3m":-5.4,"h52":22.33,"l52":12.515,"pos52w":75,"ema50d":19.03,"ema200":17.953,"target2m":21.15,"stop2m":18.48,"upside":6.4,"rr":0.9},
{"ticker":"IDR","name":"Indra Sistemas SA","sym":"IDR","price":53.5,"sig5m":"NEUTRAL","rec5m":-0.091,"rsi5m":51.6,"macdH5m":-0.01641,"vwap":53.3,"bbU":53.522,"bbL":53.37,"chg5m":-0.07,"vol_ratio":77.94,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":57.1,"sig1w":"BUY","rec1w":0.467,"rsi1w":54.6,"sig1m":"STRONG BUY","rec1m":0.603,"sig2m":"STRONG BUY","conv2m":0.521,"chg1d":1.56,"perf1m":3.9,"perf3m":2.1,"rs1m":1.8,"rs3m":-2.8,"h52":66.15,"l52":32.34,"pos52w":63,"ema50d":51.786,"ema200":47.343,"target2m":66.15,"stop2m":50.23,"upside":23.6,"rr":3.9},
{"ticker":"BKT","name":"Bankinter SA","sym":"BKT","price":14.315,"sig5m":"BUY","rec5m":0.467,"rsi5m":68.1,"macdH5m":-0.00164,"vwap":14.251,"bbU":14.32,"bbL":14.259,"chg5m":0,"vol_ratio":2.46,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":58.2,"sig1w":"BUY","rec1w":0.467,"rsi1w":55.5,"sig1m":"STRONG BUY","rec1m":0.512,"sig2m":"STRONG BUY","conv2m":0.503,"chg1d":2.1,"perf1m":1.6,"perf3m":-0.9,"rs1m":-0.5,"rs3m":-5.8,"h52":15.07,"l52":10.815,"pos52w":82,"ema50d":13.978,"ema200":13.329,"target2m":15.07,"stop2m":13.56,"upside":5.3,"rr":1.0},
{"ticker":"FER","name":"Ferrovial NV","sym":"FER","price":59.72,"sig5m":"BUY","rec5m":0.355,"rsi5m":78.3,"macdH5m":0.00247,"vwap":59.326,"bbU":59.859,"bbL":59.385,"chg5m":0,"vol_ratio":3.71,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":55.6,"sig1w":"BUY","rec1w":0.467,"rsi1w":56.9,"sig1m":"BUY","rec1m":0.445,"sig2m":"BUY","conv2m":0.49,"chg1d":2.16,"perf1m":0.5,"perf3m":-3.0,"rs1m":-1.5,"rs3m":-7.8,"h52":63.54,"l52":43.31,"pos52w":81,"ema50d":58.409,"ema200":54.951,"target2m":63.54,"stop2m":56.66,"upside":6.4,"rr":1.2},
{"ticker":"IBE","name":"Iberdrola SA","sym":"IBE","price":19.705,"sig5m":"SELL","rec5m":-0.2,"rsi5m":43.1,"macdH5m":-0.00455,"vwap":19.729,"bbU":19.769,"bbL":19.713,"chg5m":-0.05,"vol_ratio":6.25,"vol_anom":true,"div5m":"pullback","sig1d":"BUY","rec1d":0.288,"rsi1d":51.1,"sig1w":"BUY","rec1w":0.4,"rsi1w":57.3,"sig1m":"BUY","rec1m":0.4,"sig2m":"BUY","conv2m":0.366,"chg1d":0.66,"perf1m":-1.2,"perf3m":-1.3,"rs1m":-3.3,"rs3m":-6.2,"h52":20.6,"l52":15.095,"pos52w":84,"ema50d":19.638,"ema200":18.349,"target2m":20.6,"stop2m":19.05,"upside":4.5,"rr":1.4},
{"ticker":"ITX","name":"Industria de Diseno Textil","sym":"ITX","price":51.62,"sig5m":"NEUTRAL","rec5m":-0.045,"rsi5m":49.1,"macdH5m":-0.01736,"vwap":51.584,"bbU":51.789,"bbL":51.667,"chg5m":-0.04,"vol_ratio":3.86,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.358,"rsi1d":53.3,"sig1w":"BUY","rec1w":0.112,"rsi1w":49.3,"sig1m":"BUY","rec1m":0.4,"sig2m":"BUY","conv2m":0.243,"chg1d":1.65,"perf1m":-2.2,"perf3m":-10.1,"rs1m":-4.2,"rs3m":-14.9,"h52":58.28,"l52":40.8,"pos52w":62,"ema50d":51.624,"ema200":51.15,"target2m":58.28,"stop2m":50.08,"upside":12.9,"rr":4.3},
{"ticker":"REP","name":"Repsol SA","sym":"REP","price":21.82,"sig5m":"BUY","rec5m":0.112,"rsi5m":51.0,"macdH5m":0.0063,"vwap":21.73,"bbU":21.827,"bbL":21.747,"chg5m":-0.05,"vol_ratio":24.59,"vol_anom":true,"div5m":"bounce","sig1d":"SELL","rec1d":-0.224,"rsi1d":46.1,"sig1w":"BUY","rec1w":0.242,"rsi1w":59.0,"sig1m":"BUY","rec1m":0.264,"sig2m":"BUY","conv2m":0.107,"chg1d":-1.98,"perf1m":2.6,"perf3m":17.6,"rs1m":0.5,"rs3m":12.8,"h52":24.9,"l52":11.655,"pos52w":77,"ema50d":21.763,"ema200":18.285,"target2m":24.9,"stop2m":21.11,"upside":14.1,"rr":4.3},
{"ticker":"TEF","name":"Telefonica SA","sym":"TEF","price":4.058,"sig5m":"SELL","rec5m":-0.355,"rsi5m":42.9,"macdH5m":-0.00015,"vwap":4.066,"bbU":4.069,"bbL":4.058,"chg5m":0.02,"vol_ratio":35.74,"vol_anom":true,"div5m":"pullback","sig1d":"BUY","rec1d":0.445,"rsi1d":60.9,"sig1w":"BUY","rec1w":0.288,"rsi1w":60.0,"sig1m":"SELL","rec1m":-0.133,"sig2m":"BUY","conv2m":0.251,"chg1d":-0.27,"perf1m":5.3,"perf3m":12.7,"rs1m":3.2,"rs3m":7.9,"h52":4.893,"l52":3.236,"pos52w":50,"ema50d":3.851,"ema200":3.888,"target2m":4.28,"stop2m":3.77,"upside":5.5,"rr":0.8},
{"ticker":"ANA","name":"Acciona SA","sym":"ANA","price":257.0,"sig5m":"BUY","rec5m":0.355,"rsi5m":59.4,"macdH5m":-0.03335,"vwap":257.114,"bbU":257.432,"bbL":256.408,"chg5m":0,"vol_ratio":20.0,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.376,"rsi1d":57.5,"sig1w":"BUY","rec1w":0.491,"rsi1w":69.6,"sig1m":"BUY","rec1m":0.445,"sig2m":"BUY","conv2m":0.447,"chg1d":1.02,"perf1m":7.1,"perf3m":30.5,"rs1m":5.0,"rs3m":25.6,"h52":267.8,"l52":134.5,"pos52w":92,"ema50d":238.834,"ema200":201.288,"target2m":267.8,"stop2m":239.01,"upside":4.2,"rr":0.6},
{"ticker":"ELE","name":"Endesa SA","sym":"ELE","price":36.51,"sig5m":"BUY","rec5m":0.309,"rsi5m":57.3,"macdH5m":-0.00366,"vwap":36.448,"bbU":36.529,"bbL":36.48,"chg5m":0,"vol_ratio":2.92,"vol_anom":true,"div5m":"","sig1d":"NEUTRAL","rec1d":-0.045,"rsi1d":47.3,"sig1w":"BUY","rec1w":0.4,"rsi1w":61.1,"sig1m":"BUY","rec1m":0.218,"sig2m":"BUY","conv2m":0.23,"chg1d":0.88,"perf1m":-5.0,"perf3m":10.7,"rs1m":-7.1,"rs3m":5.9,"h52":38.73,"l52":23.76,"pos52w":85,"ema50d":36.247,"ema200":32.175,"target2m":38.73,"stop2m":35.16,"upside":6.1,"rr":1.6},
{"ticker":"AENA","name":"Aena SME SA","sym":"AENA","price":24.56,"sig5m":"STRONG BUY","rec5m":0.512,"rsi5m":62.8,"macdH5m":-0.00985,"vwap":24.46,"bbU":24.639,"bbL":24.507,"chg5m":0.08,"vol_ratio":0.22,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.224,"rsi1d":54.9,"sig1w":"BUY","rec1w":0.112,"rsi1w":49.1,"sig1m":"BUY","rec1m":0.385,"sig2m":"BUY","conv2m":0.2,"chg1d":3.19,"perf1m":0.2,"perf3m":-10.9,"rs1m":-1.8,"rs3m":-15.8,"h52":28.86,"l52":21.96,"pos52w":38,"ema50d":24.585,"ema200":24.434,"target2m":28.6,"stop2m":23.85,"upside":16.4,"rr":5.7},
{"ticker":"MAP","name":"Mapfre SA","sym":"MAP","price":4.202,"sig5m":"STRONG BUY","rec5m":0.536,"rsi5m":63.9,"macdH5m":0.00057,"vwap":4.196,"bbU":4.205,"bbL":4.192,"chg5m":0.14,"vol_ratio":3.24,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.355,"rsi1d":54.9,"sig1w":"BUY","rec1w":0.491,"rsi1w":58.4,"sig1m":"BUY","rec1m":0.467,"sig2m":"BUY","conv2m":0.445,"chg1d":1.01,"perf1m":2.3,"perf3m":4.7,"rs1m":0.3,"rs3m":-0.2,"h52":4.332,"l52":3.254,"pos52w":88,"ema50d":4.089,"ema200":3.876,"target2m":4.33,"stop2m":3.97,"upside":3.0,"rr":0.5},
{"ticker":"NTGY","name":"Naturgy Energy Group SA","sym":"NTGY","price":29.56,"sig5m":"SELL","rec5m":-0.47,"rsi5m":40.4,"macdH5m":-0.00237,"vwap":29.622,"bbU":29.641,"bbL":29.521,"chg5m":-0.07,"vol_ratio":0.71,"vol_anom":false,"div5m":"pullback","sig1d":"BUY","rec1d":0.264,"rsi1d":78.7,"sig1w":"BUY","rec1w":0.376,"rsi1w":67.8,"sig1m":"STRONG BUY","rec1m":0.603,"sig2m":"BUY","conv2m":0.388,"chg1d":-0.47,"perf1m":7.3,"perf3m":14.5,"rs1m":5.3,"rs3m":9.6,"h52":29.9,"l52":24.3,"pos52w":94,"ema50d":27.035,"ema200":26.298,"target2m":29.9,"stop2m":27.49,"upside":1.2,"rr":0.2},
{"ticker":"ACS","name":"ACS Actividades de Construccion","sym":"ACS","price":125.5,"sig5m":"NEUTRAL","rec5m":-0.024,"rsi5m":49.6,"macdH5m":-0.03443,"vwap":125.359,"bbU":125.927,"bbL":125.263,"chg5m":-0.08,"vol_ratio":3.89,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.112,"rsi1d":49.5,"sig1w":"BUY","rec1w":0.491,"rsi1w":68.0,"sig1m":"BUY","rec1m":0.445,"sig2m":"BUY","conv2m":0.368,"chg1d":1.54,"perf1m":2.4,"perf3m":18.3,"rs1m":0.4,"rs3m":13.4,"h52":141.2,"l52":54.65,"pos52w":82,"ema50d":120.601,"ema200":95.731,"target2m":141.2,"stop2m":116.98,"upside":12.5,"rr":1.8},
{"ticker":"ANE","name":"Acciona Energias Renovables","sym":"ANE","price":23.96,"sig5m":"STRONG BUY","rec5m":0.512,"rsi5m":61.3,"macdH5m":-0.00549,"vwap":23.928,"bbU":24.043,"bbL":23.867,"chg5m":0.08,"vol_ratio":1.83,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.421,"rsi1d":59.9,"sig1w":"BUY","rec1w":0.312,"rsi1w":63.3,"sig1m":"BUY","rec1m":0.318,"sig2m":"BUY","conv2m":0.346,"chg1d":1.27,"perf1m":5.6,"perf3m":11.9,"rs1m":3.6,"rs3m":7.0,"h52":25.64,"l52":17.81,"pos52w":79,"ema50d":22.485,"ema200":21.844,"target2m":25.64,"stop2m":22.28,"upside":7.0,"rr":1.0},
{"ticker":"ENG","name":"Enagas SA","sym":"ENG","price":17.26,"sig5m":"BUY","rec5m":0.403,"rsi5m":53.2,"macdH5m":0.00025,"vwap":17.252,"bbU":17.281,"bbL":17.213,"chg5m":0,"vol_ratio":1.52,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.4,"rsi1d":64.8,"sig1w":"STRONG BUY","rec1w":0.603,"rsi1w":66.3,"sig1m":"BUY","rec1m":0.336,"sig2m":"BUY","conv2m":0.489,"chg1d":0.41,"perf1m":0.6,"perf3m":14.3,"rs1m":-1.4,"rs3m":9.5,"h52":17.38,"l52":13.0,"pos52w":97,"ema50d":16.416,"ema200":14.922,"target2m":17.38,"stop2m":16.05,"upside":0.7,"rr":0.1},
{"ticker":"MRL","name":"MERLIN Properties SOCIMI","sym":"MRL","price":15.18,"sig5m":"BUY","rec5m":0.467,"rsi5m":63.4,"macdH5m":-0.00838,"vwap":15.125,"bbU":15.209,"bbL":15.147,"chg5m":0.07,"vol_ratio":0.02,"vol_anom":true,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":59.0,"sig1w":"STRONG BUY","rec1w":0.603,"rsi1w":64.3,"sig1m":"BUY","rec1m":0.462,"sig2m":"STRONG BUY","conv2m":0.561,"chg1d":2.15,"perf1m":0.9,"perf3m":9.4,"rs1m":-1.2,"rs3m":4.5,"h52":15.45,"l52":10.53,"pos52w":95,"ema50d":14.533,"ema200":13.341,"target2m":15.45,"stop2m":14.12,"upside":1.8,"rr":0.3},
{"ticker":"COL","name":"Colonial SFL SOCIMI SA","sym":"COL","price":5.67,"sig5m":"BUY","rec5m":0.421,"rsi5m":63.2,"macdH5m":-0.00291,"vwap":5.649,"bbU":5.677,"bbL":5.662,"chg5m":0.09,"vol_ratio":0.81,"vol_anom":false,"div5m":"","sig1d":"STRONG BUY","rec1d":0.558,"rsi1d":65.7,"sig1w":"STRONG BUY","rec1w":0.536,"rsi1w":58.3,"sig1m":"NEUTRAL","rec1m":0.091,"sig2m":"BUY","conv2m":0.454,"chg1d":1.7,"perf1m":4.1,"perf3m":5.2,"rs1m":2.1,"rs3m":0.3,"h52":6.34,"l52":4.836,"pos52w":55,"ema50d":5.396,"ema200":5.406,"target2m":6.06,"stop2m":5.27,"upside":6.9,"rr":1.0},
{"ticker":"LOG","name":"Logista Integral SA","sym":"LOG","price":33.48,"sig5m":"BUY","rec5m":0.309,"rsi5m":54.0,"macdH5m":-0.00482,"vwap":33.469,"bbU":33.526,"bbL":33.414,"chg5m":0.06,"vol_ratio":0.26,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.4,"rsi1d":63.6,"sig1w":"BUY","rec1w":0.467,"rsi1w":60.2,"sig1m":"BUY","rec1m":0.476,"sig2m":"BUY","conv2m":0.448,"chg1d":0.54,"perf1m":2.2,"perf3m":4.0,"rs1m":0.1,"rs3m":-0.9,"h52":34.48,"l52":26.84,"pos52w":87,"ema50d":32.387,"ema200":30.889,"target2m":34.48,"stop2m":31.42,"upside":3.0,"rr":0.5},
{"ticker":"MEL","name":"Melia Hotels International","sym":"MEL","price":11.62,"sig5m":"SELL","rec5m":-0.203,"rsi5m":44.5,"macdH5m":-0.01509,"vwap":11.652,"bbU":11.717,"bbL":11.596,"chg5m":-0.26,"vol_ratio":49.5,"vol_anom":true,"div5m":"pullback","sig1d":"BUY","rec1d":0.4,"rsi1d":60.1,"sig1w":"BUY","rec1w":0.4,"rsi1w":75.5,"sig1m":"BUY","rec1m":0.462,"sig2m":"BUY","conv2m":0.412,"chg1d":1.4,"perf1m":3.7,"perf3m":46.0,"rs1m":1.6,"rs3m":41.1,"h52":12.1,"l52":6.64,"pos52w":91,"ema50d":10.638,"ema200":8.789,"target2m":12.1,"stop2m":10.81,"upside":4.1,"rr":0.6},
{"ticker":"SLR","name":"Solaria Energia SA","sym":"SLR","price":24.47,"sig5m":"BUY","rec5m":0.421,"rsi5m":60.6,"macdH5m":-0.00115,"vwap":24.408,"bbU":24.506,"bbL":24.385,"chg5m":0.04,"vol_ratio":13.12,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.376,"rsi1d":54.4,"sig1w":"BUY","rec1w":0.376,"rsi1w":68.3,"sig1m":"BUY","rec1m":0.4,"sig2m":"BUY","conv2m":0.381,"chg1d":1.33,"perf1m":-5.3,"perf3m":28.1,"rs1m":-7.4,"rs3m":23.3,"h52":25.85,"l52":6.588,"pos52w":93,"ema50d":23.236,"ema200":18.535,"target2m":25.85,"stop2m":22.76,"upside":5.6,"rr":0.8},
{"ticker":"SCYR","name":"Sacyr SA","sym":"SCYR","price":4.668,"sig5m":"BUY","rec5m":0.176,"rsi5m":64.0,"macdH5m":-0.0016,"vwap":4.639,"bbU":4.681,"bbL":4.647,"chg5m":-0.13,"vol_ratio":27700.0,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.445,"rsi1d":53.5,"sig1w":"STRONG BUY","rec1w":0.558,"rsi1w":61.9,"sig1m":"BUY","rec1m":0.294,"sig2m":"BUY","conv2m":0.471,"chg1d":3.09,"perf1m":-1.0,"perf3m":4.2,"rs1m":-3.1,"rs3m":-0.7,"h52":4.936,"l52":3.404,"pos52w":83,"ema50d":4.531,"ema200":4.109,"target2m":4.94,"stop2m":4.4,"upside":5.8,"rr":1.0},
{"ticker":"AMS","name":"Amadeus IT Group SA","sym":"AMS","price":52.88,"sig5m":"BUY","rec5m":0.467,"rsi5m":58.7,"macdH5m":-0.01956,"vwap":52.601,"bbU":53.041,"bbL":52.707,"chg5m":0,"vol_ratio":101.18,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.291,"rsi1d":58.0,"sig1w":"NEUTRAL","rec1w":-0.088,"rsi1w":45.9,"sig1m":"SELL","rec1m":-0.176,"sig2m":"NEUTRAL","conv2m":0.008,"chg1d":2.76,"perf1m":6.8,"perf3m":11.9,"rs1m":4.7,"rs3m":7.1,"h52":75.38,"l52":46.21,"pos52w":23,"ema50d":51.395,"ema200":57.67,"target2m":53.94,"stop2m":51.29,"upside":2.0,"rr":0.7},
{"ticker":"CLNX","name":"Cellnex Telecom SA","sym":"CLNX","price":29.05,"sig5m":"NEUTRAL","rec5m":-0.091,"rsi5m":51.2,"macdH5m":-0.00694,"vwap":29.005,"bbU":29.096,"bbL":28.998,"chg5m":-0.07,"vol_ratio":12.14,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.445,"rsi1d":54.5,"sig1w":"BUY","rec1w":0.224,"rsi1w":52.4,"sig1m":"SELL","rec1m":-0.339,"sig2m":"BUY","conv2m":0.178,"chg1d":1.25,"perf1m":2.0,"perf3m":-5.1,"rs1m":-0.1,"rs3m":-9.9,"h52":34.53,"l52":24.72,"pos52w":44,"ema50d":28.582,"ema200":28.863,"target2m":34.53,"stop2m":27.72,"upside":18.9,"rr":4.1},
{"ticker":"RED","name":"Redeia Corporacion SA","sym":"RED","price":15.04,"sig5m":"NEUTRAL","rec5m":-0.07,"rsi5m":49.9,"macdH5m":-0.00097,"vwap":15.042,"bbU":15.049,"bbL":15.014,"chg5m":0.07,"vol_ratio":9.09,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.291,"rsi1d":58.1,"sig1w":"NEUTRAL","rec1w":-0.088,"rsi1w":48.2,"sig1m":"SELL","rec1m":-0.197,"sig2m":"NEUTRAL","conv2m":0.004,"chg1d":0.6,"perf1m":0.6,"perf3m":-6.7,"rs1m":-1.5,"rs3m":-11.6,"h52":18.68,"l52":14.15,"pos52w":20,"ema50d":14.878,"ema200":15.495,"target2m":15.34,"stop2m":14.59,"upside":2.0,"rr":0.7},
{"ticker":"GRF","name":"Grifols SA Class A","sym":"GRF","price":9.644,"sig5m":"NEUTRAL","rec5m":0.045,"rsi5m":51.2,"macdH5m":-0.00328,"vwap":9.631,"bbU":9.664,"bbL":9.646,"chg5m":-0.02,"vol_ratio":0.32,"vol_anom":true,"div5m":"","sig1d":"BUY","rec1d":0.133,"rsi1d":61.7,"sig1w":"SELL","rec1w":-0.176,"rsi1w":46.9,"sig1m":"SELL","rec1m":-0.491,"sig2m":"SELL","conv2m":-0.146,"chg1d":1.86,"perf1m":7.8,"perf3m":-11.5,"rs1m":5.7,"rs3m":-16.4,"h52":13.7,"l52":8.432,"pos52w":23,"ema50d":9.353,"ema200":10.163,"target2m":8.43,"stop2m":9.63,"upside":-12.6,"rr":86.8},
{"ticker":"ROVI","name":"Laboratorios Farmaceuticos Rovi","sym":"ROVI","price":59.95,"sig5m":"BUY","rec5m":0.288,"rsi5m":53.4,"macdH5m":-0.02004,"vwap":59.877,"bbU":60.154,"bbL":59.691,"chg5m":0,"vol_ratio":3.87,"vol_anom":true,"div5m":"bounce","sig1d":"SELL","rec1d":-0.288,"rsi1d":24.3,"sig1w":"SELL","rec1w":-0.242,"rsi1w":36.6,"sig1m":"SELL","rec1m":-0.179,"sig2m":"SELL","conv2m":-0.243,"chg1d":1.52,"perf1m":-28.8,"perf3m":-22.6,"rs1m":-30.9,"rs3m":-27.4,"h52":86.7,"l52":51.65,"pos52w":24,"ema50d":71.657,"ema200":69.057,"target2m":51.65,"stop2m":64.15,"upside":-13.8,"rr":2.0},
{"ticker":"FDR","name":"Fluidra SA","sym":"FDR","price":19.26,"sig5m":"NEUTRAL","rec5m":0,"rsi5m":50.5,"macdH5m":-0.01343,"vwap":19.259,"bbU":19.346,"bbL":19.258,"chg5m":-0.05,"vol_ratio":1.5,"vol_anom":false,"div5m":"","sig1d":"SELL","rec1d":-0.109,"rsi1d":45.3,"sig1w":"SELL","rec1w":-0.4,"rsi1w":38.8,"sig1m":"SELL","rec1m":-0.224,"sig2m":"SELL","conv2m":-0.278,"chg1d":2.07,"perf1m":-7.7,"perf3m":-20.5,"rs1m":-9.7,"rs3m":-25.3,"h52":26.22,"l52":18.17,"pos52w":14,"ema50d":20.237,"ema200":22.071,"target2m":18.17,"stop2m":20.61,"upside":-5.7,"rr":0.8},
{"ticker":"PUIG","name":"Puig Brands SA Class B","sym":"PUIG","price":15.18,"sig5m":"SELL","rec5m":-0.379,"rsi5m":42.0,"macdH5m":-0.00045,"vwap":15.313,"bbU":15.288,"bbL":15.123,"chg5m":-0.07,"vol_ratio":1.23,"vol_anom":false,"div5m":"","sig1d":"STRONG SELL","rec1d":-0.512,"rsi1d":27.5,"sig1w":"STRONG SELL","rec1w":-0.552,"rsi1w":42.2,"sig1m":"STRONG SELL","rec1m":-0.571,"sig2m":"STRONG SELL","conv2m":-0.544,"chg1d":-0.59,"perf1m":-17.0,"perf3m":-7.4,"rs1m":-19.1,"rs3m":-12.2,"h52":18.89,"l52":13.11,"pos52w":36,"ema50d":17.065,"ema200":16.463,"target2m":13.28,"stop2m":16.24,"upside":-12.5,"rr":1.8}];

// ══ IBEX helpers ══════════════════════════════════════════════
function g(v, def=0) { return (v !== null && v !== undefined && !isNaN(v)) ? v : def; }
function sigClass(s) { return s.includes('BUY') ? 'cg' : s.includes('SELL') ? 'cr' : 'cn'; }
function sigLabel(s) {
  return s==='STRONG BUY'?'💚 STRONG BUY':s==='BUY'?'🟢 BUY':s==='NEUTRAL'?'⚪ NEUTRAL':s==='SELL'?'🔴 SELL':'🔴🔴 STR SELL';
}
function rsiCol(r) { return r>=70?'var(--gold)':r<=30?'var(--blue)':'var(--text)'; }
function chgCls(c) { return c>0?'up':c<0?'dn':'flat'; }
function getSig(r) {
  const lv = ibexLive[r.ticker];
  if (lv) return ibexHz==='5m' ? recToSig(lv.rec5m) : recToSig(lv.rec);
  return ibexHz==='5m' ? r.sig5m : r.sig2m;
}
function getRec(r) {
  const lv = ibexLive[r.ticker];
  if (lv) return ibexHz==='5m' ? lv.rec5m : lv.rec;
  return ibexHz==='5m' ? g(r.rec5m) : g(r.conv2m);
}
function getRsi(r) {
  const lv = ibexLive[r.ticker];
  if (lv) return ibexHz==='5m' ? (lv.rsi5m||lv.rsi) : lv.rsi;
  return ibexHz==='5m' ? g(r.rsi5m) : g(r.rsi1w);
}
function getMacd(r) {
  const lv = ibexLive[r.ticker];
  return lv ? lv.macd : g(r.macdH5m);
}
function getChg(r) { return ibexHz==='5m' ? g(r.chg5m) : g(r.chg1d); }
function livePrice(r) { return ibexLive[r.ticker] ? ibexLive[r.ticker].price : r.price; }
function liveChg(r)   { return ibexLive[r.ticker] ? ibexLive[r.ticker].change : getChg(r); }

function setHz(hz, el) {
  ibexHz = hz;
  ibexFilter = 'ALL';
  document.querySelectorAll('.hz-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  buildIbexAll();
}

async function loadIbex() {
  ibexLoaded = true;
  try {
    const r = await fetch('/api/ibex');
    const d = await r.json();
    if (d.stocks && d.stocks.length > 0) {
      ibexLive = {};
      d.stocks.forEach(s => { ibexLive[s.ticker] = s; });
      document.getElementById('ibex-note').textContent =
        '🟢 Live · TradingView Scanner · ' + d.stocks.length + ' stocks · ' + (d.timestamp||'');
    } else {
      document.getElementById('ibex-note').textContent =
        'Señales + precios: 📅 estáticos (25 May 2026)';
    }
  } catch(e) {
    document.getElementById('ibex-note').textContent = 'TV Scanner no disponible · datos estáticos';
  }
  buildIbexAll();
}

function getFiltered() {
  let rows = [...IBEX].sort((a,b) => getRec(b) - getRec(a));
  if (ibexFilter==='ALL')  return rows.filter(r => !getSig(r).includes('NEUTRAL') && getSig(r)!=='N/A');
  if (ibexFilter==='SB')   return rows.filter(r => getSig(r)==='STRONG BUY');
  if (ibexFilter==='BUY')  return rows.filter(r => getSig(r)==='BUY');
  if (ibexFilter==='SELL') return rows.filter(r => getSig(r).includes('SELL'));
  if (ibexFilter==='DIV')  return rows.filter(r => r.div5m);
  if (ibexFilter==='VOL')  return rows.filter(r => r.vol_anom);
  return rows;
}

function buildIbexKPI() {
  const sb=IBEX.filter(r=>getSig(r)==='STRONG BUY').length;
  const b =IBEX.filter(r=>getSig(r)==='BUY').length;
  const n =IBEX.filter(r=>getSig(r)==='NEUTRAL').length;
  const s =IBEX.filter(r=>getSig(r).includes('SELL')).length;
  const top=[...IBEX].sort((a,b)=>getRec(b)-getRec(a)).slice(0,3).map(r=>r.ticker).join(' · ');
  const bot=[...IBEX].sort((a,b)=>getRec(a)-getRec(b)).slice(0,3).map(r=>r.ticker).join(' · ');
  document.getElementById('ibex-kpi').innerHTML=
    '<div class="kpi"><div class="kpi-lbl">Strong BUY</div><div class="kpi-val" style="color:var(--green)">'+sb+'</div><div class="kpi-sub">señales fuertes</div></div>'
    +'<div class="kpi"><div class="kpi-lbl">BUY</div><div class="kpi-val" style="color:var(--blue)">'+b+'</div><div class="kpi-sub">alcistas</div></div>'
    +'<div class="kpi"><div class="kpi-lbl">NEUTRAL</div><div class="kpi-val" style="color:var(--muted)">'+n+'</div><div class="kpi-sub">sin dirección</div></div>'
    +'<div class="kpi"><div class="kpi-lbl">SELL</div><div class="kpi-val" style="color:var(--red)">'+s+'</div><div class="kpi-sub">bajistas</div></div>'
    +'<div class="kpi"><div class="kpi-lbl">Top Long</div><div class="kpi-val" style="font-size:10px;color:var(--green)">'+top+'</div><div class="kpi-sub">mayor score</div></div>'
    +'<div class="kpi"><div class="kpi-lbl">Top Short</div><div class="kpi-val" style="font-size:10px;color:var(--red)">'+bot+'</div><div class="kpi-sub">menor score</div></div>';
}

function buildIbexSentiment() {
  const tot=IBEX.length;
  const bulls=IBEX.filter(r=>getSig(r).includes('BUY')).length;
  const bears=IBEX.filter(r=>getSig(r).includes('SELL')).length;
  const neuts=tot-bulls-bears;
  const pB=(bulls/tot*100).toFixed(0),pN=(neuts/tot*100).toFixed(0),pS=(bears/tot*100).toFixed(0);
  const mood=bulls>bears*1.5?'Alcista 📈':bears>bulls*1.5?'Bajista 📉':'Mixto ↔️';
  document.getElementById('ibex-sent').innerHTML=
    '<div class="sent-lbl">Sentimiento IBEX 35 · '+(ibexHz==='5m'?'5min':'2 Meses')+' · <strong style="color:var(--text)">'+mood+'</strong></div>'
    +'<div class="sent-track"><div style="width:'+pB+'%;background:var(--green)"></div><div style="width:'+pN+'%;background:var(--bg4)"></div><div style="width:'+pS+'%;background:var(--red)"></div></div>'
    +'<div class="sent-info"><span style="color:var(--green)">▲ Bulls '+pB+'% ('+bulls+')</span><span style="color:var(--muted)">◆ Neutral '+pN+'% ('+neuts+')</span><span style="color:var(--red)">▼ Bears '+pS+'% ('+bears+')</span></div>';
}

function buildIbexFilters() {
  const sb=IBEX.filter(r=>getSig(r)==='STRONG BUY').length;
  const b=IBEX.filter(r=>getSig(r)==='BUY').length;
  const s=IBEX.filter(r=>getSig(r).includes('SELL')).length;
  const divs=IBEX.filter(r=>r.div5m).length;
  const vols=IBEX.filter(r=>r.vol_anom).length;
  let html='<button class="ftab on" onclick="setIbexFilter(\'ALL\',this)">Todas ('+IBEX.length+')</button>'
    +'<button class="ftab" onclick="setIbexFilter(\'SB\',this)">💚 STR BUY ('+sb+')</button>'
    +'<button class="ftab" onclick="setIbexFilter(\'BUY\',this)">🟢 BUY ('+b+')</button>'
    +'<button class="ftab" onclick="setIbexFilter(\'SELL\',this)">🔴 SELL ('+s+')</button>'
    +'<button class="ftab" onclick="setIbexFilter(\'DIV\',this)">⇅ Divergencias ('+divs+')</button>'
    +'<button class="ftab" onclick="setIbexFilter(\'VOL\',this)">⚡ Vol. Anomalía ('+vols+')</button>';
  document.getElementById('ibex-filters').innerHTML=html;
}

function setIbexFilter(f, btn) {
  ibexFilter=f;
  document.querySelectorAll('#ibex-filters .ftab').forEach(b=>b.classList.remove('on','g','r'));
  btn.classList.add('on');
  buildIbexCards(getFiltered());
}

function buildIbexCards(rows) {
  document.getElementById('ibex-cards').innerHTML = rows.map(r => {
    const sig=getSig(r), sc=sigClass(sig), rec=getRec(r), rsi=getRsi(r);
    const price=livePrice(r), chg=liveChg(r);
    const str=Math.min(Math.round(Math.abs(rec)*100),95);
    const hasLive=!!ibexLive[r.ticker];
    const tags=[];
    if(sig==='STRONG BUY') tags.push('<span class="tag tg">💚 STRONG BUY</span>');
    else if(sig==='BUY')   tags.push('<span class="tag tg">🟢 BUY</span>');
    else if(sig==='SELL')  tags.push('<span class="tag tr">🔴 SELL</span>');
    else if(sig==='STRONG SELL') tags.push('<span class="tag tr">🔴🔴 STR SELL</span>');
    if(rsi>=70) tags.push('<span class="tag ty">⚠ RSI '+rsi+' OB</span>');
    if(rsi<=30) tags.push('<span class="tag ty">⚠ RSI '+rsi+' OS</span>');
    if(r.div5m==='confirmed_bull') tags.push('<span class="tag tg">✅ Conf ▲</span>');
    if(r.div5m==='pullback') tags.push('<span class="tag tp">↓ Pullback</span>');
    if(r.vol_anom&&r.vol_ratio>1.5) tags.push('<span class="tag to">⚡ Vol x'+r.vol_ratio+'</span>');
    if(hasLive) tags.push('<span class="tag tg" style="font-size:8px">🟢 LIVE</span>');
    const tvInt=ibexHz==='5m'?'5':'W';
    return '<div class="scard '+sc+'">'
      +'<div class="sc-head"><div><div class="sc-ticker">'+r.ticker+'</div><div class="sc-name">'+r.name.substring(0,24)+'</div></div>'
      +'<div><div class="sc-price">€'+price.toFixed(3)+'</div><span class="sc-chg '+(chg>0?'up':chg<0?'dn':'flat')+'">'+(chg>0?'▲+':'▼')+chg.toFixed(2)+'%</span></div></div>'
      +'<div class="sc-sigbar '+sc+'"><span class="sc-siglbl">'+sigLabel(sig)+'</span>'
      +'<div class="sc-bar"><div class="sc-fill" style="width:'+str+'%"></div></div>'
      +'<span class="sc-score">TV:'+(rec>0?'+':'')+rec.toFixed(2)+'</span></div>'
      +'<div class="sc-inds">'
      +'<div class="ind"><div class="ind-l">RSI</div><div class="ind-v" style="color:'+rsiCol(rsi)+'">'+rsi+'</div><div class="ind-s">'+(rsi>=70?'OB':rsi<=30?'OS':'OK')+'</div></div>'
      +(()=>{const m=getMacd(r);return'<div class="ind"><div class="ind-l">MACD</div><div class="ind-v" style="color:'+(m>0?'var(--green)':'var(--red)')+'">'+( m>0?'▲':'▼')+'</div><div class="ind-s">'+m.toFixed(4)+'</div></div>';})()
      +(()=>{const lv=ibexLive[r.ticker];const rec1d=lv?lv.rec:g(r.rec1d);const sig1d=lv?recToSig(lv.rec):(r.sig1d||'');return'<div class="ind"><div class="ind-l">Señal 1D</div><div class="ind-v" style="font-size:9px;color:'+(rec1d>0.1?'var(--green)':rec1d<-0.1?'var(--red)':'var(--muted)')+'">'+sig1d+'</div><div class="ind-s">'+rec1d.toFixed(2)+'</div></div>';})()

      +'</div>'
      +'<div class="sc-tags">'+tags.join('')+'</div>'
      +'<a class="sc-tvlink" href="https://www.tradingview.com/chart/?symbol=BME%3A'+r.sym+'&interval='+tvInt+'" target="_blank">📊 TradingView '+(ibexHz==='5m'?'5min':'Semanal')+' →</a>'
      +'</div>';
  }).join('') || '<div style="padding:20px;color:var(--muted);text-align:center">Sin señales con este filtro</div>';
}

function buildIbexTable() {
  const sorted=[...IBEX].sort((a,b)=>getRec(b)-getRec(a));
  document.getElementById('ibex-thead').innerHTML='<tr><th>Ticker</th><th>Precio</th><th>Día %</th><th>Señal</th><th>Score TV</th><th>RSI</th><th>1M%</th><th>3M%</th><th>Objetivo</th><th>Potencial</th><th>R:R</th><th>TV</th></tr>';
  document.getElementById('ibex-tbody').innerHTML=sorted.map(r=>{
    const sig=getSig(r), rec=getRec(r), rsi=getRsi(r);
    const price=livePrice(r), chg=liveChg(r);
    const sigStyle=sig.includes('BUY')?'background:rgba(63,185,80,.12);color:var(--green)':sig.includes('SELL')?'background:rgba(239,68,68,.12);color:var(--red)':'background:var(--bg3);color:var(--muted)';
    const uC=r.upside>0?'var(--green)':'var(--red)';
    return '<tr>'
      +'<td style="font-weight:800;color:var(--pqf2)">'+r.ticker+'</td>'
      +'<td style="font-family:monospace">€'+price.toFixed(3)+(ibexLive[r.ticker]?' 🟢':'')+'</td>'
      +'<td class="'+(chg>0?'up':chg<0?'dn':'flat')+'" style="font-family:monospace">'+(chg>0?'+':'')+chg.toFixed(2)+'%</td>'
      +'<td><span class="dt" style="'+sigStyle+'">'+sig+'</span></td>'
      +'<td style="font-weight:700;color:'+(rec>0.1?'var(--green)':rec<-0.1?'var(--red)':'var(--muted)')+'">'+rec.toFixed(3)+'</td>'
      +'<td style="color:'+rsiCol(rsi)+'">'+rsi+'</td>'
      +'<td style="color:'+(r.perf1m>0?'var(--green)':'var(--red)')+'">'+(r.perf1m>0?'+':'')+r.perf1m+'%</td>'
      +'<td style="color:'+(r.perf3m>0?'var(--green)':'var(--red)')+'">'+(r.perf3m>0?'+':'')+r.perf3m+'%</td>'
      +'<td style="font-family:monospace">€'+r.target2m+'</td>'
      +'<td style="color:'+uC+'">'+(r.upside>0?'+':'')+r.upside+'%</td>'
      +'<td style="color:var(--purple)">'+r.rr+'x</td>'
      +'<td><a href="https://www.tradingview.com/chart/?symbol=BME%3A'+r.sym+'&interval='+(ibexHz==='5m'?'5':'W')+'" target="_blank" style="color:var(--pqf2);font-size:10px">TV→</a></td>'
      +'</tr>';
  }).join('');
}

function buildIbexAll() { buildIbexKPI(); buildIbexSentiment(); buildIbexFilters(); buildIbexCards(getFiltered()); buildIbexTable(); }

// ══ Init ═════════════════════════════════════════════════════
setLang(currentLang);
renderMovers();
renderContext();
loadGlobal();
setInterval(() => { loadGlobal(); if (ibexLoaded) loadIbex(); }, 60000);
</script>
</body>
</html>`
