package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sort"
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

// ─── Weekly Recommendations — Recomendado por Pietro ──────────
// Static data updated manually every Monday 23:59 CET.
// Live prices fetched from TV Scanner on each /api/weekly call.

// ─── Weekly data structs ────────────────────────────────────────

type WeeklyStock struct {
	TVSym     string  `json:"-"`
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name"`
	Rationale string  `json:"rationale"`
	Price     float64 `json:"price"`
	Change    float64 `json:"change"`
	Rec       float64 `json:"rec"`
}

// QualityStock — one row of the Quality-at-a-Discount screen.
// Static metrics (ROIC/FCF/etc.) updated by Pietro each Monday via web research.
// OffHigh is computed live from TV Scanner 52W high vs current price.
type QualityStock struct {
	TVSym     string  `json:"-"`
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name"`
	ROIC      float64 `json:"roic"`      // % TTM;  -999 = INSUFFICIENT DATA
	FCFMargin float64 `json:"fcfMargin"` // % TTM;  -999 = N/A
	NdEbitda  float64 `json:"ndEbitda"`  // x ratio; negative = net cash; -999 = N/A
	RevGrowth float64 `json:"revGrowth"` // % YoY;  -999 = N/A
	FwdLtTtl  bool    `json:"fwdLtTtl"`  // Fwd P/E < Trailing P/E (improving outlook)
	OffHigh   float64 `json:"offHigh"`   // % below 52W high — computed live
	Score     int     `json:"score"`
	Tier      string  `json:"tier"`
	Thesis    string  `json:"thesis"`
	Price     float64 `json:"price"`  // live
	Change    float64 `json:"change"` // live
	Rec       float64 `json:"rec"`    // live
	H52       float64 `json:"h52"`    // live
}

type WeeklyMeta struct {
	Theme      string `json:"theme"`
	ThemeEmoji string `json:"themeEmoji"`
	DateRange  string `json:"dateRange"`
	UpdatedAt  string `json:"updatedAt"`
}

// ══ UPDATE EVERY MONDAY 23:59 CET ══════════════════════════════
// Data vintage: Q1 2025 (TTM). Verify/refresh each Monday via web.

var wkMeta = WeeklyMeta{
	Theme:      "AI Infrastructure",
	ThemeEmoji: "🤖",
	DateRange:  "26 May – 1 Jun 2026",
	UpdatedAt:  "Lun 26 May 2026 · 23:59 CET",
}

// GROWTH: top 5 from TradingView screener by Recommend.All — high momentum
var wkGrowth = []WeeklyStock{
	{TVSym: "NASDAQ:NVDA", Symbol: "NVDA", Name: "NVIDIA Corporation", Rationale: "Monopolio GPU para entrenamiento e inferencia IA — ecosistema CUDA sin rival"},
	{TVSym: "NASDAQ:AVGO", Symbol: "AVGO", Name: "Broadcom Inc.", Rationale: "ASICs custom para hyperscalers (Google/Meta) + switches Tomahawk 5"},
	{TVSym: "NYSE:ANET", Symbol: "ANET", Name: "Arista Networks", Rationale: "Switches EX9 800G — único merchant silicon para clusters IA >1.000 GPUs"},
	{TVSym: "NASDAQ:MRVL", Symbol: "MRVL", Name: "Marvell Technology", Rationale: "Interconnect custom en Google TPU v5, AWS Trainium2 y Microsoft Maia"},
	{TVSym: "NASDAQ:MU", Symbol: "MU", Name: "Micron Technology", Rationale: "Memoria HBM3E — cuello de botella crítico, Nvidia paga prima de suministro"},
}

// QUALITY: 25-stock AI Infrastructure universe scored by Quality-at-a-Discount
// Top 5 non-growth stocks by score → VALUE picks (computed in weeklyHandler)
// ROIC/FCF/ND-EBITDA/RevGrowth: TTM Q1 2025 — refresh each Monday
var wkQuality = []QualityStock{
	// ── Score 100 (4 quality + 2 discount) ──
	{TVSym: "NASDAQ:LRCX", Symbol: "LRCX", Name: "Lam Research Corp.", ROIC: 42, FCFMargin: 26, NdEbitda: -0.8, RevGrowth: 16, FwdLtTtl: true, Thesis: "Deposición líder de mercado; gasto en fabs front-end en China robusto pese a controles de exportación"},
	{TVSym: "NASDAQ:KLAC", Symbol: "KLAC", Name: "KLA Corporation", ROIC: 39, FCFMargin: 28, NdEbitda: -0.5, RevGrowth: 12, FwdLtTtl: true, Thesis: "Monopolio de process control — cada nuevo nodo de fab requiere 2× más pasos de inspección"},
	{TVSym: "NASDAQ:NTAP", Symbol: "NTAP", Name: "NetApp Inc.", ROIC: 32, FCFMargin: 22, NdEbitda: 1.1, RevGrowth: 6, FwdLtTtl: true, Thesis: "StorageGRID es el S3 object store por defecto en los data lakes híbridos de IA empresarial"},
	{TVSym: "NASDAQ:QCOM", Symbol: "QCOM", Name: "Qualcomm Inc.", ROIC: 30, FCFMargin: 24, NdEbitda: 0.3, RevGrowth: 9, FwdLtTtl: true, Thesis: "Snapdragon X Elite captura 30%+ del mercado premium laptop; ciclo de renovación móvil IA comenzando"},
	{TVSym: "NASDAQ:STX", Symbol: "STX", Name: "Seagate Technology", ROIC: 22, FCFMargin: 18, NdEbitda: 1.8, RevGrowth: 14, FwdLtTtl: true, Thesis: "HDDs nearline 28TB HAMR — capa de almacenamiento más barata para datasets de entrenamiento IA"},
	// ── Score 90 ──
	{TVSym: "NASDAQ:AMAT", Symbol: "AMAT", Name: "Applied Materials Inc.", ROIC: 25, FCFMargin: 22, NdEbitda: -0.4, RevGrowth: 7, FwdLtTtl: true, Thesis: "Transición gate-all-around añade +$1B de gasto incremental en equipos por cada nuevo nodo de fab"},
	{TVSym: "NYSE:DELL", Symbol: "DELL", Name: "Dell Technologies", ROIC: 28, FCFMargin: 5, NdEbitda: 0.9, RevGrowth: 9, FwdLtTtl: true, Thesis: "Único distribuidor autorizado de DGX H100/H200 para enterprise — backlog de 3-4 meses"},
	{TVSym: "NYSE:VRT", Symbol: "VRT", Name: "Vertiv Holdings", ROIC: 32, FCFMargin: 8, NdEbitda: 1.3, RevGrowth: 21, FwdLtTtl: true, Thesis: "Patentes de liquid cooling generan contratos de servicio de 5 años — no hay alternativa viable para racks >100kW"},
	// ── Score 80 (quality full, sin descuento) ──
	{TVSym: "NASDAQ:NVDA", Symbol: "NVDA", Name: "NVIDIA Corporation", ROIC: 155, FCFMargin: 57, NdEbitda: -3.2, RevGrowth: 122, FwdLtTtl: false, Thesis: "Coste de cambio = 5-7 años de reentrenamiento para 4M desarrolladores CUDA"},
	{TVSym: "NYSE:ANET", Symbol: "ANET", Name: "Arista Networks", ROIC: 35, FCFMargin: 32, NdEbitda: -2.1, RevGrowth: 22, FwdLtTtl: false, Thesis: "EX9 800G — único switch merchant silicon que pasa la velocidad requerida para clusters GPU >1.000 nodos"},
	{TVSym: "NASDAQ:ARM", Symbol: "ARM", Name: "Arm Holdings", ROIC: 31, FCFMargin: 38, NdEbitda: -1.5, RevGrowth: 25, FwdLtTtl: false, Thesis: "Las extensiones ISA para IA multiplican la tasa de royalties ×3 desde 2022 — royalties sobre cada chip IA"},
	// ── Score 80 (ROIC bajo pero descuento fuerte) ──
	{TVSym: "NASDAQ:AMD", Symbol: "AMD", Name: "Advanced Micro Devices", ROIC: 8, FCFMargin: 12, NdEbitda: -0.3, RevGrowth: 14, FwdLtTtl: true, Thesis: "MI300X en producción en Microsoft/Meta/Oracle; EPYC Turin gana 1/3 de renovaciones CPU en hyperscalers"},
	{TVSym: "NASDAQ:ADI", Symbol: "ADI", Name: "Analog Devices Inc.", ROIC: 15, FCFMargin: 28, NdEbitda: 1.2, RevGrowth: -7, FwdLtTtl: true, Thesis: "Bus A2B es el estándar de audio en cada coche premium — márgenes brutos 90%+, sin competencia real"},
	{TVSym: "NASDAQ:ON", Symbol: "ON", Name: "ON Semiconductor", ROIC: 22, FCFMargin: 15, NdEbitda: 0.4, RevGrowth: -8, FwdLtTtl: true, Thesis: "Módulos SiC en cada tren de tracción EV; migración 400V→800V duplica el contenido por vehículo"},
	{TVSym: "NASDAQ:MPWR", Symbol: "MPWR", Name: "Monolithic Power Systems", ROIC: 24, FCFMargin: 18, NdEbitda: -0.8, RevGrowth: -3, FwdLtTtl: true, Thesis: "Solución QsBox de MPWR va en cada módulo Nvidia Grace Hopper — coste de cambio cero para OEMs"},
	{TVSym: "NASDAQ:MRVL", Symbol: "MRVL", Name: "Marvell Technology", ROIC: 7, FCFMargin: 18, NdEbitda: 1.4, RevGrowth: 6, FwdLtTtl: true, Thesis: "Google TPU v5, AWS Trainium2 y Microsoft Maia usan el interconnect custom de Marvell"},
	// ── Score 70 (STRONG) ──
	{TVSym: "NASDAQ:TXN", Symbol: "TXN", Name: "Texas Instruments Inc.", ROIC: 28, FCFMargin: 22, NdEbitda: 1.0, RevGrowth: -5, FwdLtTtl: true, Thesis: "Contenido analógico por EV se duplica; utilización de fabs 300mm en mínimo histórico — apalancamiento al girar ciclo"},
	{TVSym: "NASDAQ:SMCI", Symbol: "SMCI", Name: "Super Micro Computer", ROIC: 15, FCFMargin: -10, NdEbitda: 0.8, RevGrowth: 110, FwdLtTtl: true, Thesis: "Racks liquid-cooled en 30 días vs 90 de Dell/HPE — único vendor con liquid-to-air a escala de rack"},
	// ── Score 50–60 (WATCH) ──
	{TVSym: "NASDAQ:AVGO", Symbol: "AVGO", Name: "Broadcom Inc.", ROIC: 18, FCFMargin: 48, NdEbitda: 2.8, RevGrowth: 51, FwdLtTtl: false, Thesis: "Tomahawk 5 en cada ToR de hyperscaler; envíos de XPU custom a Google/Meta se triplican en 2025"},
	{TVSym: "NYSE:HPE", Symbol: "HPE", Name: "Hewlett Packard Enterprise", ROIC: 8, FCFMargin: 4, NdEbitda: 1.4, RevGrowth: 3, FwdLtTtl: true, Thesis: "Cray EX4000 gana cada contrato de laboratorio nacional US — único supercomputador con networking propio"},
	{TVSym: "NYSE:IBM", Symbol: "IBM", Name: "IBM Corporation", ROIC: 8, FCFMargin: 15, NdEbitda: 2.2, RevGrowth: 2, FwdLtTtl: true, Thesis: "watsonx.governance es la única plataforma de riesgo de IA certificada para EU AI Act — moat regulatorio"},
	{TVSym: "NASDAQ:CDW", Symbol: "CDW", Name: "CDW Corporation", ROIC: 35, FCFMargin: 4, NdEbitda: 2.1, RevGrowth: -2, FwdLtTtl: true, Thesis: "Mayor VAR de EEUU; 15% attach rate en venta hardware IA enterprise sin riesgo de inventario"},
	{TVSym: "NASDAQ:WDC", Symbol: "WDC", Name: "Western Digital Corp.", ROIC: 8, FCFMargin: -5, NdEbitda: 2.5, RevGrowth: 12, FwdLtTtl: true, Thesis: "UFS 4.0 NAND es el estándar en el diseño de referencia Qualcomm AI Phone — +40% contenido de memoria"},
	// ── Score 20 (AVOID) ──
	{TVSym: "NASDAQ:INTC", Symbol: "INTC", Name: "Intel Corporation", ROIC: -5, FCFMargin: -8, NdEbitda: 3.5, RevGrowth: -3, FwdLtTtl: true, Thesis: "Gaudi 3 tiene mejor MFU que H100 en fine-tuning pero carece de ecosistema — problema de gallina y huevo"},
}

// ─── Deep Thesis Cards — Top 3 by Conviction Score ────────────

type CardSection struct {
	Content string `json:"content"`
	Source  string `json:"source"`
}

type DeepCard struct {
	Symbol string      `json:"symbol"`
	Name   string      `json:"name"`
	Score  int         `json:"score"`
	Tier   string      `json:"tier"`
	Moat   CardSection `json:"moat"`
	Draw   CardSection `json:"draw"`
	Cat    CardSection `json:"cat"`
	Exit   CardSection `json:"exit"`
}

// ── UPDATE WEEKLY — verify all data via web before publishing ──
var wkDeepCards = []DeepCard{
	{
		Symbol: "LRCX", Name: "Lam Research Corp.", Score: 100, Tier: "BEST",
		Moat: CardSection{
			Content: "Lam holds ~54% global conductor-etch market share and is sole-source qualified for multi-patterning etch at TSMC, Micron, Samsung and SK Hynix. Re-qualification at a competing tool costs $30–50 M and 12–18 months per recipe — no fab initiates mid-ramp. 3D NAND geometry is structurally additive: each additional vertical wordline layer (current: 232+ WL) automatically adds one Lam etch step, compounding equipment demand with NAND density roadmaps.",
			Source:  "Lam Research 10-K FY2024 pp. 7-9 (market position); VLSI Research Etch Equipment Market Share Report 2024; Micron Q2 FY2025 earnings call (Feb 2025) — sole-source qualification comment",
		},
		Draw: CardSection{
			Content: "NAND capex collapsed ~60% in 2023 as Samsung, Kioxia and SK Hynix absorbed oversupply from the 2021-22 crypto/pandemic surge. BIS export control expansion (Oct 17, 2023) created headline risk for ~26% of Lam revenue sourced in China. EV/EBITDA compressed from 20× to 12× on cycle fears even as customer backlogs held firm — classic equipment sentiment overshoot.",
			Source:  "BIS Interim Final Rule Oct 17 2023; Lam 10-K FY2024 p. 22 (China 26% of revenue); Gartner WFE Forecast Q4 2023 (−33% NAND capex)",
		},
		Cat: CardSection{
			Content: "HBM3E requires ~3× more etch steps per die vs conventional DRAM — every Nvidia Blackwell GPU shipped consumes Lam etch capacity at Micron/SK Hynix. Micron guided HBM capex +100% for FY2025 (Feb 2025 call). CoWoS advanced packaging substrate etch is a new TAM Lam is winning vs AMAT. NAND cycle trough confirmed: Samsung and SK Hynix both guided WFE spending higher for H2 2025.",
			Source:  "Micron Q2 FY2025 earnings (Feb 26 2025); SK Hynix Q4 2024 earnings (Jan 2025, WFE guidance); Lam Investor Day 2024 — CoWoS etch opportunity, slide 34",
		},
		Exit: CardSection{
			Content: "IF BIS expands controls to cover 28-nm logic equipment (capturing China front-end revenue), China drops from 26% to <10% of sales — thesis breaks on revenue cliff. IF gross margin falls below 45% for two consecutive quarters (current: 47-48%), competitive pressure from AMAT/Tokyo Electron is eroding moat. TECHNICAL: Weekly close below $70 (200-week MA + prior consolidation base) invalidates recovery structure.",
			Source:  "Lam 10-K FY2024 p. 41 (gross margin history); BIS Advanced Computing Rule (Oct 2023) — potential expansion scope; TradingView LRCX weekly chart",
		},
	},
	{
		Symbol: "KLAC", Name: "KLA Corporation", Score: 100, Tier: "BEST",
		Moat: CardSection{
			Content: "KLA holds >50% global wafer inspection and metrology market share — tools that sit in the critical yield path of every fab. No wafer ships without passing a KLA inspection gate. The Enlight/Lumion software ecosystem integrates 10+ years of customer yield models, making competitive switching equivalent to rebuilding institutional memory. Every new litho node tightens the defect budget: inspection intensity increased 4× from 14nm to 3nm, and will accelerate at 2nm gate-all-around. Service contracts (40%+ of revenue) carry near-100% gross margins.",
			Source:  "KLA 10-K FY2024 pp. 6-8 (market position, service revenue 41%); VLSI Research Process Control Market Share 2024; KLA Investor Day 2023, slide 18 (inspection intensity by node)",
		},
		Draw: CardSection{
			Content: "Logic semiconductor capex paused industry-wide in 2023 as hyperscalers digested overbuilding and IDMs (Intel, Samsung) delayed fab ramps. KLA de-rated ~30% from its 2024 peak ($650→$455) on fears that leading-edge node transitions would slow. Intel 18A yield challenges (flagged in Q2 2024 earnings) provided a specific narrative for underperformance vs. the broader semi equipment sector.",
			Source:  "KLA stock data Bloomberg; Intel Q3 2024 earnings call (18A yield update, Sep 2024); SEMI World Fab Forecast Q1 2024 (logic capex revision −18%)",
		},
		Cat: CardSection{
			Content: "TSMC N2 (2nm GAA) entering high-volume manufacturing H2 2025 is the single most inspection-intensive node transition in TSMC's history — defect budget requires ~4.5× more inspection tools vs N3. Samsung 2nm GAA adds a second vector. HBM stacked-die manufacturing is defect-sensitive: each additional die layer requires a full inspection pass, expanding KLA's DRAM TAM. KLA guided double-digit revenue growth on Jan 2025 earnings call.",
			Source:  "TSMC Q4 2024 earnings (N2 ramp H2 2025 confirmed); KLA Q2 FY2025 earnings Jan 29 2025 (double-digit growth guidance); Applied Materials Q1 FY2025 (2nm inspection commentary)",
		},
		Exit: CardSection{
			Content: "IF TSMC or Samsung announce a 6-12 month deferral of 2nm HVM (capex cut announcement) — inspection tool orders fall into a 12-18 month drought with no offset. IF service gross margin falls below 85% (currently 88%) for two consecutive quarters, a new inspection competitor (Onto Innovation, Hitachi) is gaining traction. TECHNICAL: $450 is the prior breakout base; a weekly close below on >150% of 30-day average volume invalidates the bull case.",
			Source:  "KLA 10-K FY2024 p. 45 (service segment gross margin); Onto Innovation Q4 2024 (competitive commentary); TradingView KLAC weekly chart",
		},
	},
	{
		Symbol: "QCOM", Name: "Qualcomm Inc.", Score: 100, Tier: "BEST",
		Moat: CardSection{
			Content: "Qualcomm has two structurally separate moats: (1) QTL patent licensing — $X billion/year in royalties from every 5G device shipped globally, carrying 70%+ operating margins with near-zero incremental cost. (2) Snapdragon X Elite silicon — first ARM PC chip matching Apple M3 on Cinebench R24 multi-core while drawing 20W less than Intel Core Ultra. Design wins shipped in Q3 2024: HP OmniBook X, Dell XPS 13 9345, Lenovo Yoga Slim 7x — Microsoft requires 40 TOPS NPU for Copilot+ certification, a bar only Snapdragon X clears on Windows.",
			Source:  "Qualcomm 10-K FY2024 p. 10 (QTL description, 70% segment margin); Qualcomm Snapdragon X Elite benchmarks whitepaper Aug 2023; PCMag Snapdragon X Elite review Jun 2024; Microsoft Copilot+ PC spec requirements May 2024",
		},
		Draw: CardSection{
			Content: "Bloomberg reported (Sep 2023, Mark Gurman) Apple is developing an in-house 5G modem targeting iPhone 17 (Sep 2025). Apple represents ~$6-8B of Qualcomm chip revenue. The stock de-rated 25%+ from its 2024 high as the market priced in near-total Apple modem loss. Concurrently, smartphone unit recovery in China underperformed consensus in H1 2024 (IDC: +4% vs +8% expected), removing a near-term volume catalyst.",
			Source:  "Bloomberg Mark Gurman 'Apple 5G Modem' Sep 2023; Qualcomm Q4 FY2024 earnings call (Apple exposure, management comment); IDC Smartphone Tracker Q2 2024",
		},
		Cat: CardSection{
			Content: "Three independent re-rating vectors in 12 months: (1) AI PC: Snapdragon X design pipeline targets 50M+ Copilot+ PCs by end FY2025 — each unit is incremental vs iPhone-modem revenue. (2) Automotive: Design wins at BMW, Mercedes, GM put QCT auto revenue on track for $4B FY2026 (from $1.7B FY2024 — 2.3× in two years). (3) Apple modem delay: The Information (Q1 2025) reported Apple's in-house modem yields poorly on TSMC N3 — each quarter of delay is ~$375M in preserved Qualcomm revenue.",
			Source:  "Qualcomm Investor Day Sep 2023 slide 22 (automotive $4B target); Microsoft AI PC shipment forecast Jan 2025; The Information 'Apple modem yield challenges' Q1 2025; Qualcomm Q4 FY2024 (auto run rate commentary)",
		},
		Exit: CardSection{
			Content: "IF Apple's in-house 5G modem ships in iPhone 17 (Sep 2025) AND achieves >80% yield at TSMC N3 scale — Qualcomm loses ~$6B in chip revenue within 24 months with limited cost reduction (fabless). IF Snapdragon X PC design win pipeline stalls below 15M units shipped FY2025, the PC TAM narrative fails to compensate for modem loss. TECHNICAL: $140 is the 2024 breakout consolidation level; weekly close below with downward earnings revision invalidates the thesis.",
			Source:  "Author risk framework; Qualcomm 10-Q Q4 FY2024 (Apple revenue concentration risk); IDC PC shipment tracker 2025 forecast; TradingView QCOM weekly chart",
		},
	},
}

func calcQualityScore(s *QualityStock) int {
	sc := 0
	if s.ROIC > -900 && s.ROIC >= 15 {
		sc += 20
	}
	if s.FCFMargin > -900 && s.FCFMargin > 0 {
		sc += 20
	}
	if s.NdEbitda > -900 && s.NdEbitda < 2 {
		sc += 20
	}
	if s.RevGrowth > -900 && s.RevGrowth > 0 {
		sc += 20
	}
	if s.OffHigh >= 15 {
		sc += 10
	}
	if s.FwdLtTtl {
		sc += 10
	}
	return sc
}

func tierLabel(score int) string {
	switch {
	case score >= 80:
		return "BEST"
	case score >= 65:
		return "STRONG"
	case score >= 50:
		return "WATCH"
	default:
		return "AVOID"
	}
}

func weeklyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	// Collect tickers: growth (5) + quality universe (25, some overlap)
	tickerSet := map[string]string{} // sym → TVSym
	for _, s := range wkGrowth {
		tickerSet[s.Symbol] = s.TVSym
	}
	for _, s := range wkQuality {
		tickerSet[s.Symbol] = s.TVSym
	}
	tickers := make([]string, 0, len(tickerSet))
	for _, tv := range tickerSet {
		tickers = append(tickers, tv)
	}

	// Fetch live: price, change, rec, 52W high
	reqBody := map[string]interface{}{
		"symbols": map[string]interface{}{
			"tickers": tickers,
			"query":   map[string]interface{}{"types": []string{}},
		},
		"columns": []string{"close", "change", "Recommend.All", "price_52_week_high"},
	}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://scanner.tradingview.com/america/scan", bytes.NewReader(body))
	tvHeaders(req)

	type liveVal struct{ price, change, rec, h52 float64 }
	lm := map[string]liveVal{}
	if resp, err := tvCl.Do(req); err == nil {
		defer resp.Body.Close()
		var res struct {
			Data []struct {
				S string        `json:"s"`
				D []interface{} `json:"d"`
			} `json:"data"`
		}
		if json.NewDecoder(resp.Body).Decode(&res) == nil {
			for _, item := range res.Data {
				if len(item.D) >= 4 {
					sym := item.S
					if idx := strings.Index(sym, ":"); idx >= 0 {
						sym = sym[idx+1:]
					}
					lm[sym] = liveVal{toF(item.D[0]), toF(item.D[1]), toF(item.D[2]), toF(item.D[3])}
				}
			}
		}
	}

	// Fill growth picks with live data
	growth := make([]WeeklyStock, len(wkGrowth))
	for i, s := range wkGrowth {
		growth[i] = s
		if lv, ok := lm[s.Symbol]; ok {
			growth[i].Price = lv.price
			growth[i].Change = lv.change
			growth[i].Rec = lv.rec
		}
	}

	// Score quality universe with live %offHigh
	quality := make([]QualityStock, len(wkQuality))
	for i, s := range wkQuality {
		quality[i] = s
		if lv, ok := lm[s.Symbol]; ok {
			quality[i].Price = lv.price
			quality[i].Change = lv.change
			quality[i].Rec = lv.rec
			quality[i].H52 = lv.h52
			if lv.h52 > 0 {
				quality[i].OffHigh = (lv.h52 - lv.price) / lv.h52 * 100
			}
		}
		quality[i].Score = calcQualityScore(&quality[i])
		quality[i].Tier = tierLabel(quality[i].Score)
	}

	// Sort quality by Score desc (insertion sort, small n)
	for i := 1; i < len(quality); i++ {
		for j := i; j > 0 && quality[j].Score > quality[j-1].Score; j-- {
			quality[j], quality[j-1] = quality[j-1], quality[j]
		}
	}

	// Derive VALUE top-5: highest-scored stocks not in wkGrowth
	growthSet := map[string]bool{}
	for _, s := range wkGrowth {
		growthSet[s.Symbol] = true
	}
	var value []WeeklyStock
	for _, s := range quality {
		if !growthSet[s.Symbol] && len(value) < 5 {
			value = append(value, WeeklyStock{
				Symbol:    s.Symbol,
				Name:      s.Name,
				Rationale: s.Thesis,
				Price:     s.Price,
				Change:    s.Change,
				Rec:       s.Rec,
			})
		}
	}

	type Resp struct {
		Meta      WeeklyMeta     `json:"meta"`
		Growth    []WeeklyStock  `json:"growth"`
		Value     []WeeklyStock  `json:"value"`
		Quality   []QualityStock `json:"quality"`
		DeepCards []DeepCard     `json:"deepCards"`
		Timestamp string         `json:"timestamp"`
	}
	json.NewEncoder(w).Encode(Resp{
		Meta:      wkMeta,
		Growth:    growth,
		Value:     value,
		Quality:   quality,
		DeepCards: wkDeepCards,
		Timestamp: time.Now().UTC().Format("Mon 02 Jan 2006 — 15:04:05 UTC"),
	})
	fmt.Printf("[weekly] growth=%d value=%d quality=%d deep=%d\n", len(growth), len(value), len(quality), len(wkDeepCards))
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

// ─── Stock Analyzer — /api/analyze?ticker=AAPL ─────────────────
// Accepts "AAPL" or "NASDAQ:AAPL" or "BME:SAN".
// Tries multiple exchange prefixes when no prefix given.

var analyzeExchanges = []string{
	"NASDAQ", "NYSE", "BME", "EPA", "XETR", "BIT", "LSE",
	"AMS", "TVC", "CBOE", "NYMEX", "FX", "CRYPTO",
}

var analyzeColumns = []string{
	"description",            // 0
	"close",                  // 1
	"change",                 // 2
	"volume",                 // 3
	"Recommend.All",          // 4  1D overall
	"Recommend.All|5",        // 5  5min overall
	"Recommend.MA",           // 6  MA subscore
	"Recommend.Other",        // 7  oscillator subscore
	"RSI",                    // 8
	"RSI|5",                  // 9
	"MACD.macd",              // 10
	"MACD.signal",            // 11
	"BB.upper",               // 12
	"BB.lower",               // 13
	"BB.basis",               // 14
	"EMA50",                  // 15
	"EMA200",                 // 16
	"VWAP",                   // 17
	"price_52_week_high",     // 18
	"price_52_week_low",      // 19
	"market_cap_basic",       // 20
	"price_earnings_ttm",     // 21
	"dividends_yield_current", // 22
	"high",                   // 23  day high
	"low",                    // 24  day low
}

type AnalysisResult struct {
	TVSym    string  `json:"tvSym"`
	Symbol   string  `json:"symbol"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Change   float64 `json:"change"`
	Volume   float64 `json:"volume"`
	Rec1D    float64 `json:"rec1d"`
	Rec5m    float64 `json:"rec5m"`
	RecMA    float64 `json:"recMA"`
	RecOsc   float64 `json:"recOsc"`
	RSI      float64 `json:"rsi"`
	RSI5m    float64 `json:"rsi5m"`
	MACD     float64 `json:"macd"`
	MACDSig  float64 `json:"macdSig"`
	BBU      float64 `json:"bbu"`
	BBL      float64 `json:"bbl"`
	BBB      float64 `json:"bbb"`
	EMA50    float64 `json:"ema50"`
	EMA200   float64 `json:"ema200"`
	VWAP     float64 `json:"vwap"`
	H52      float64 `json:"h52"`
	L52      float64 `json:"l52"`
	MktCap   float64 `json:"mktCap"`
	PE       float64 `json:"pe"`
	DivYield float64 `json:"divYield"`
	DayHigh  float64 `json:"dayHigh"`
	DayLow   float64 `json:"dayLow"`
	OffHigh  float64 `json:"offHigh"`
	Sig1D    string  `json:"sig1d"`
	Sig5m    string  `json:"sig5m"`
	TrendEMA string  `json:"trendEMA"`
	Timestamp string `json:"timestamp"`
}

func recLabel(v float64) string {
	switch {
	case v >= 0.5:
		return "STRONG BUY"
	case v >= 0.1:
		return "BUY"
	case v > -0.1:
		return "NEUTRAL"
	case v > -0.5:
		return "SELL"
	default:
		return "STRONG SELL"
	}
}

func tvScanSingle(tickers []string) (string, []interface{}) {
	reqBody := map[string]interface{}{
		"symbols": map[string]interface{}{
			"tickers": tickers,
			"query":   map[string]interface{}{"types": []string{}},
		},
		"columns": analyzeColumns,
	}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://scanner.tradingview.com/global/scan", bytes.NewReader(body))
	tvHeaders(req)
	resp, err := tvCl.Do(req)
	if err != nil {
		return "", nil
	}
	defer resp.Body.Close()
	var result struct {
		Data []struct {
			S string        `json:"s"`
			D []interface{} `json:"d"`
		} `json:"data"`
	}
	if json.NewDecoder(resp.Body).Decode(&result) != nil {
		return "", nil
	}
	for _, item := range result.Data {
		if len(item.D) >= 25 && toF(item.D[1]) > 0 {
			return item.S, item.D
		}
	}
	return "", nil
}

func analyzeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	raw := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("ticker")))
	if raw == "" {
		w.WriteHeader(400)
		fmt.Fprint(w, `{"error":"ticker required"}`)
		return
	}

	// Build candidate list
	var candidates []string
	if strings.Contains(raw, ":") {
		candidates = []string{raw}
	} else {
		for _, ex := range analyzeExchanges {
			candidates = append(candidates, ex+":"+raw)
		}
	}

	tvSym, d := tvScanSingle(candidates)
	if d == nil {
		w.WriteHeader(404)
		fmt.Fprintf(w, `{"error":"ticker %q not found — try EXCHANGE:TICKER format","tried":%d}`, raw, len(candidates))
		return
	}

	sym := tvSym
	if idx := strings.Index(sym, ":"); idx >= 0 {
		sym = sym[idx+1:]
	}

	price := toF(d[1])
	h52 := toF(d[18])
	var offHigh float64
	if h52 > 0 {
		offHigh = (h52 - price) / h52 * 100
	}

	ema50, ema200 := toF(d[15]), toF(d[16])
	trend := "NEUTRAL"
	if price > ema50 && ema50 > ema200 {
		trend = "UPTREND"
	} else if price < ema50 && ema50 < ema200 {
		trend = "DOWNTREND"
	}

	json.NewEncoder(w).Encode(AnalysisResult{
		TVSym: tvSym, Symbol: sym, Name: toS(d[0]),
		Price: price, Change: toF(d[2]), Volume: toF(d[3]),
		Rec1D: toF(d[4]), Rec5m: toF(d[5]), RecMA: toF(d[6]), RecOsc: toF(d[7]),
		RSI: toF(d[8]), RSI5m: toF(d[9]),
		MACD: toF(d[10]), MACDSig: toF(d[11]),
		BBU: toF(d[12]), BBL: toF(d[13]), BBB: toF(d[14]),
		EMA50: ema50, EMA200: ema200, VWAP: toF(d[17]),
		H52: h52, L52: toF(d[19]),
		MktCap: toF(d[20]), PE: toF(d[21]), DivYield: toF(d[22]) / 100,
		DayHigh: toF(d[23]), DayLow: toF(d[24]),
		OffHigh: offHigh,
		Sig1D: recLabel(toF(d[4])), Sig5m: recLabel(toF(d[5])),
		TrendEMA: trend,
		Timestamp: time.Now().UTC().Format("Mon 02 Jan 2006 — 15:04:05 UTC"),
	})
	fmt.Printf("[analyze] %s %s $%.2f\n", tvSym, recLabel(toF(d[4])), price)
}

// ─── Noticias Expansión — RSS ──────────────────────────────────

type rssRawItem struct {
	Title      string   `xml:"title"`
	Link       string   `xml:"link"`
	PubDate    string   `xml:"pubDate"`
	Categories []string `xml:"category"` // multiple <category> tags
	GUID       string   `xml:"guid"`
	Desc       string   `xml:"description"`
	MediaDesc  string   `xml:"http://search.yahoo.com/mrss/ description"`
	MediaSect  string   `xml:"http://search.yahoo.com/mrss/ title"`
	Creator    string   `xml:"http://purl.org/dc/elements/1.1/ creator"`
}

// bestCategory picks the most meaningful category from the list.
// Expansión often has "Artículos AUTHOR" as a category — skip those.
func bestCategory(cats []string) string {
	for _, c := range cats {
		if !strings.HasPrefix(c, "Artículos ") && c != "" {
			return c
		}
	}
	if len(cats) > 0 { return cats[0] }
	return ""
}

type NoticiaItem struct {
	Title    string `json:"title"`
	Link     string `json:"link"`
	Section  string `json:"section"`
	Summary  string `json:"summary"`
	Author   string `json:"author"`
	RelTime  string `json:"relTime"`
	PubDate  string `json:"pubDate"`
}

// Strips basic HTML tags (no import needed)
func stripHTML(s string) string {
	var b strings.Builder
	in := false
	for _, r := range s {
		if r == '<' { in = true; continue }
		if r == '>' { in = false; continue }
		if !in { b.WriteRune(r) }
	}
	return strings.TrimSpace(b.String())
}

func relTimeES(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "ahora mismo"
	case d < time.Hour:
		m := int(d.Minutes())
		if m == 1 { return "hace 1 min" }
		return fmt.Sprintf("hace %d min", m)
	case d < 24*time.Hour:
		h := int(d.Hours())
		if h == 1 { return "hace 1 hora" }
		return fmt.Sprintf("hace %d horas", h)
	default:
		days := int(d.Hours() / 24)
		if days == 1 { return "hace 1 día" }
		return fmt.Sprintf("hace %d días", days)
	}
}

func titleCaseES(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		if len(w) == 0 { continue }
		r := []rune(w)
		r[0] = []rune(strings.ToUpper(string(r[0])))[0]
		words[i] = string(r)
	}
	return strings.Join(words, " ")
}

var expansionRSSFeeds = []struct{ url, label string }{
	{"https://e00-expansion.uecdn.es/rss/portada.xml",  "Portada"},
	{"https://e00-expansion.uecdn.es/rss/mercados.xml", "Mercados"},
	{"https://e00-expansion.uecdn.es/rss/empresas.xml", "Empresas"},
	{"https://e00-expansion.uecdn.es/rss/economia.xml", "Economía"},
}

// parseExpansionRSS uses token-based XML parsing to correctly distinguish
// <title> (article headline) from <media:title> (section label). Go's
// struct-tag-based decoder matches both to xml:"title", causing overwrites.
func parseExpansionRSS(dec *xml.Decoder) ([]rssRawItem, error) {
	const mediaNS = "http://search.yahoo.com/mrss/"
	const dcNS    = "http://purl.org/dc/elements/1.1/"

	var items []rssRawItem
	var cur *rssRawItem      // non-nil while inside <item>
	var field *string        // points to current text-accumulation target
	var depth int            // nesting depth inside <item>

	for {
		tok, err := dec.Token()
		if err != nil {
			break // io.EOF or real error — either way stop
		}
		switch t := tok.(type) {
		case xml.StartElement:
			ns, local := t.Name.Space, t.Name.Local
			if cur == nil {
				if local == "item" {
					items = append(items, rssRawItem{})
					cur = &items[len(items)-1]
					depth = 0
				}
				continue
			}
			depth++
			field = nil // reset; set below if recognised
			switch {
			case ns == "" || ns == "rss": // no-namespace elements
				switch local {
				case "title":       field = &cur.Title
				case "link":        field = &cur.Link
				case "pubDate":     field = &cur.PubDate
				case "description": field = &cur.Desc
				case "guid":        field = &cur.GUID
				case "category":
					cur.Categories = append(cur.Categories, "")
					field = &cur.Categories[len(cur.Categories)-1]
				}
			case ns == mediaNS:
				switch local {
				case "description": field = &cur.MediaDesc
				case "title":       field = &cur.MediaSect
				}
			case ns == dcNS:
				if local == "creator" { field = &cur.Creator }
			}

		case xml.EndElement:
			if cur == nil { continue }
			if t.Name.Local == "item" && depth == 0 {
				cur = nil
			} else {
				depth--
			}
			field = nil

		case xml.CharData:
			if field != nil {
				*field += string(t) // accumulate (CDATA may split)
			}
		}
	}
	return items, nil
}

func fetchExpansionFeed(url string) ([]rssRawItem, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; PQF/1.1)")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml")
	resp, err := tvCl.Do(req)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	return parseExpansionRSS(xml.NewDecoder(resp.Body))
}

// RFC1123Z layout used by Expansión: "Mon, 02 Jan 2006 15:04:05 -0700"
const rssTimeLayout = "Mon, 02 Jan 2006 15:04:05 -0700"

func noticiasHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	type itemWithTime struct {
		item NoticiaItem
		t    time.Time
	}

	seen := map[string]bool{}
	var collected []itemWithTime

	for _, feed := range expansionRSSFeeds {
		items, err := fetchExpansionFeed(feed.url)
		if err != nil {
			fmt.Printf("[noticias] %s: %v\n", feed.label, err)
			continue
		}
		for _, raw := range items {
			key := raw.GUID
			if key == "" { key = raw.Link }
			if seen[key] { continue }
			seen[key] = true

			// section label: media:title (uppercase) → best category → feed label
			section := raw.MediaSect
			if section == "" { section = bestCategory(raw.Categories) }
			if section == "" { section = feed.label }
			// Title-case the section (media:title comes as all-caps e.g. "ENERGÍA")
			section = titleCaseES(strings.ToLower(section))

			// summary — prefer media:description (plain text), fall back to strip HTML
			summary := raw.MediaDesc
			if summary == "" { summary = stripHTML(raw.Desc) }
			if len(summary) > 220 { summary = summary[:220] + "…" }

			// parse pubDate for sorting
			t, _ := time.Parse(rssTimeLayout, strings.TrimSpace(raw.PubDate))

			collected = append(collected, itemWithTime{
				item: NoticiaItem{
					Title:   strings.TrimSpace(raw.Title),
					Link:    strings.TrimSpace(raw.Link),
					Section: section,
					Summary: summary,
					Author:  raw.Creator,
					PubDate: raw.PubDate,
				},
				t: t,
			})
		}
	}

	// Sort newest first
	sort.Slice(collected, func(i, j int) bool {
		return collected[i].t.After(collected[j].t)
	})

	// Fill relative times and cap at 40 items
	max := 40
	if len(collected) < max { max = len(collected) }
	out := make([]NoticiaItem, max)
	for i := 0; i < max; i++ {
		out[i] = collected[i].item
		out[i].RelTime = relTimeES(collected[i].t)
	}

	type Resp struct {
		Items     []NoticiaItem `json:"items"`
		Timestamp string        `json:"timestamp"`
		Count     int           `json:"count"`
	}
	json.NewEncoder(w).Encode(Resp{
		Items:     out,
		Timestamp: time.Now().UTC().Format("Mon 02 Jan 2006 — 15:04:05 UTC"),
		Count:     len(out),
	})
	fmt.Printf("[noticias] %d items servidos\n", len(out))
}

// ─── Pietro Auto — Dynamic Weekly Recommendations ────────────
// Step 1: detect theme from Expansión RSS news keyword analysis
// Step 2: TV Scanner universe → Quality-at-a-Discount screen (score /100)
// Step 3: deep thesis cards for top 3 (MOAT · DRAWDOWN · CATALYST · EXIT)
// Cache refreshes every Monday 23:59 CET automatically.

// pietroThemeDef — Sectors uses TradingView Scanner's actual sector strings.
// TV Scanner sector values differ from GICS: "Electronic Technology", "Technology Services", etc.
type pietroThemeDef struct {
	Num        int
	Label      string
	Emoji      string
	Sectors    []string // TV Scanner sector values (in_range filter)
	Industries []string // keywords for local industry matching (lowercase contains)
	Keywords   []string // Spanish/English news keywords for theme detection
}

var pietroThemes = []pietroThemeDef{
	// TV Scanner sectors: "Electronic Technology" (semis, hardware), "Technology Services" (software, internet)
	{1, "AI Infrastructure", "🤖",
		[]string{"Electronic Technology", "Technology Services"},
		[]string{}, // all industries in these sectors
		[]string{"nvidia", "inteligencia artificial", " ia ", "gpu", "chip", "semiconductor", "data center", "cloud", "nube", "amd", "computación"}},
	{2, "Semiconductors", "⚡",
		[]string{"Electronic Technology"},
		[]string{"semiconductor"},
		[]string{"semiconductor", "tsmc", "obleas", "foundry", "nodo tecnológico", "litografía"}},
	{3, "Cybersecurity", "🔐",
		[]string{"Technology Services"},
		[]string{"software", "internet", "services"},
		[]string{"ciberseguridad", "hacker", "ciberataque", "ransomware", "brecha", "seguridad digital"}},
	{4, "GLP-1 / Obesity", "💊",
		[]string{"Health Technology"},
		[]string{"pharma", "biotech", "drug", "health"},
		[]string{"obesidad", "glp-1", "diabetes", "eli lilly", "novo nordisk", "ozempic", "wegovy", "farmacéutica"}},
	{5, "Defense", "🛡️",
		[]string{"Electronic Technology"},
		[]string{"aerospace", "defense"},
		[]string{"defensa", "armas", "armamento", "militar", "otan", "nato", "conflicto", "guerra", "misil"}},
	{6, "Credit Networks", "💳",
		[]string{"Finance"},
		[]string{"credit", "financial", "payment"},
		[]string{"visa", "mastercard", "pagos", "fintech", "pago digital", "transacción", "american express"}},
	{7, "Software at Discount", "💻",
		[]string{"Technology Services"},
		[]string{}, // all software/tech services
		[]string{"software", "saas", "microsoft", "salesforce", "sap", "oracle", "enterprise"}},
	{8, "Re-shoring Industrials", "🏭",
		[]string{"Producer Manufacturing", "Process Industries"},
		[]string{},
		[]string{"manufactura", "relocalización", "reshoring", "nearshoring", "infraestructura", "caterpillar"}},
}

type PietroAutoStock struct {
	Ticker    string  `json:"ticker"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Change    float64 `json:"change"`
	MktCapB   float64 `json:"mktCapB"`
	Sector    string  `json:"sector"`
	Industry  string  `json:"industry"`
	Rec       float64 `json:"rec"`
	ROE       float64 `json:"roe"`       // proxy for ROIC; -999 = N/A
	FCF       float64 `json:"fcf"`       // raw value; >0 = pass
	NdEB      float64 `json:"ndEB"`      // net debt / EBITDA; -999 = N/A
	RevGrowth float64 `json:"revGrowth"` // % YoY; -999 = N/A
	OffHigh   float64 `json:"offHigh"`   // % below 52w high
	TrailPE   float64 `json:"trailPE"`
	FwdPE     float64 `json:"fwdPE"`
	Score     int     `json:"score"`
	Tier      string  `json:"tier"`
	PassROIC  bool    `json:"passROIC"`
	PassFCF   bool    `json:"passFCF"`
	PassDebt  bool    `json:"passDebt"`
	PassRev   bool    `json:"passRev"`
	PassDisc  bool    `json:"passDisc"`
	PassPE    bool    `json:"passPE"`
	Thesis    string  `json:"thesis"`
}

type PietroAutoResult struct {
	ThemeNum   int               `json:"themeNum"`
	ThemeLabel string            `json:"themeLabel"`
	ThemeEmoji string            `json:"themeEmoji"`
	WeekLabel  string            `json:"weekLabel"`
	DateRange  string            `json:"dateRange"`
	UpdatedAt  string            `json:"updatedAt"`
	NextUpdate string            `json:"nextUpdate"`
	Growth     []PietroAutoStock `json:"growth"`
	Value      []PietroAutoStock `json:"value"`
	Universe   []PietroAutoStock `json:"universe"`
	Cards      []DeepCard        `json:"cards"` // reuse existing DeepCard/CardSection types
	Source     string            `json:"source"`
	Timestamp  string            `json:"timestamp"`
}

var (
	pietroAutoMu     sync.Mutex
	pietroAutoCached *PietroAutoResult
	pietroAutoAt     time.Time
)

func pietroNeedsRefresh() bool {
	if pietroAutoCached == nil {
		return true
	}
	loc, err := time.LoadLocation("Europe/Madrid")
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	wd := int(now.Weekday()) // 0=Sun 1=Mon…
	daysToLastMon := wd - 1
	if daysToLastMon < 0 {
		daysToLastMon = 6
	}
	lastMon := now.AddDate(0, 0, -daysToLastMon)
	cutoff := time.Date(lastMon.Year(), lastMon.Month(), lastMon.Day(), 23, 59, 0, 0, loc)
	if cutoff.After(now) {
		cutoff = cutoff.AddDate(0, 0, -7)
	}
	return pietroAutoAt.Before(cutoff)
}

func detectPietroTheme() pietroThemeDef {
	seen := map[string]bool{}
	var allText string
	for _, feed := range expansionRSSFeeds {
		items, err := fetchExpansionFeed(feed.url)
		if err != nil {
			continue
		}
		for _, it := range items {
			key := it.GUID
			if key == "" {
				key = it.Link
			}
			if seen[key] {
				continue
			}
			seen[key] = true
			allText += strings.ToLower(it.Title) + " " + strings.ToLower(stripHTML(it.Desc)) + " "
		}
	}
	if allText == "" {
		return pietroThemes[0]
	}
	scores := make([]int, len(pietroThemes))
	for i, th := range pietroThemes {
		for _, kw := range th.Keywords {
			scores[i] += strings.Count(allText, kw)
		}
	}
	bestScore, bestIdx := 0, 0
	for i, s := range scores {
		if s > bestScore {
			bestScore = s
			bestIdx = i
		}
	}
	if bestScore == 0 {
		return pietroThemes[0]
	}
	return pietroThemes[bestIdx]
}

func matchesThemeIndustry(industry string, theme pietroThemeDef) bool {
	if len(theme.Industries) == 0 {
		return true
	}
	ind := strings.ToLower(industry)
	for _, pat := range theme.Industries {
		if strings.Contains(ind, strings.ToLower(pat)) {
			return true
		}
	}
	return false
}

var pietroScanCols = []string{
	"description",              // 0  company name
	"close",                    // 1  price
	"change",                   // 2  % change
	"market_cap_basic",         // 3  market cap
	"sector",                   // 4  sector label
	"industry",                 // 5  industry label
	"return_on_equity",         // 6  ROE (proxy for ROIC)
	"free_cash_flow",           // 7  FCF (sign matters)
	"net_debt",                 // 8  net debt
	"ebitda",                   // 9  EBITDA TTM
	"earnings_per_share_diluted_yoy_growth_ttm", // 10 EPS growth YoY (proxy for rev growth)
	"price_52_week_high",       // 11 52-week high
	"price_earnings_ttm",       // 12 trailing P/E
	"Recommend.All",            // 13 TV signal
}

func tvScanPietroUniverse(theme pietroThemeDef) []PietroAutoStock {
	filters := []map[string]interface{}{
		{"left": "market_cap_basic", "operation": "greater", "right": 10e9},
		{"left": "exchange", "operation": "in_range", "right": []string{"NASDAQ", "NYSE"}},
		{"left": "type", "operation": "equal", "right": "stock"},
		{"left": "close", "operation": "greater", "right": 1},
	}
	if len(theme.Sectors) > 0 {
		filters = append(filters, map[string]interface{}{
			"left": "sector", "operation": "in_range", "right": theme.Sectors,
		})
	}
	reqBody := map[string]interface{}{
		"filter":  filters,
		"columns": pietroScanCols,
		"sort":    map[string]interface{}{"sortBy": "market_cap_basic", "sortOrder": "desc"},
		"range":   []int{0, 60},
	}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://scanner.tradingview.com/america/scan", bytes.NewReader(body))
	tvHeaders(req)
	resp, err := tvCl.Do(req)
	if err != nil {
		fmt.Printf("[pietro] scan error: %v\n", err)
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
		fmt.Printf("[pietro] decode: %v\n", err)
		return nil
	}

	var stocks []PietroAutoStock
	for _, item := range result.Data {
		d := item.D
		if len(d) < 14 {
			continue
		}
		price := toF(d[1])
		if price <= 0 {
			continue
		}
		industry := toS(d[5])
		if !matchesThemeIndustry(industry, theme) {
			continue
		}
		sym := item.S
		if idx := strings.Index(sym, ":"); idx >= 0 {
			sym = sym[idx+1:]
		}

		roe := toF(d[6])
		if roe == 0 {
			roe = -999
		}
		fcf := toF(d[7])
		netDebt := toF(d[8])
		ebitda := toF(d[9])
		revGrowth := toF(d[10])
		if revGrowth == 0 {
			revGrowth = -999
		}
		h52 := toF(d[11])
		trailPE := toF(d[12])

		var ndEB float64 = -999
		if ebitda != 0 {
			ndEB = netDebt / ebitda
		}
		var offHigh float64
		if h52 > 0 {
			offHigh = (h52 - price) / h52 * 100
		}

		// Forward P/E gate: not available from TV Scanner filter scan
		// Kept as false; can be enabled if a valid fwd-EPS column is found
		passPE := false

		passROIC := roe > -900 && roe >= 15
		passFCF := fcf > 0
		passDebt := ndEB > -900 && ndEB < 2
		passRev := revGrowth > -900 && revGrowth > 0
		passDisc := offHigh >= 15

		score := 0
		if passROIC {
			score += 20
		}
		if passFCF {
			score += 20
		}
		if passDebt {
			score += 20
		}
		if passRev {
			score += 20
		}
		if passDisc {
			score += 10
		}

		st := PietroAutoStock{
			Ticker: sym, Name: toS(d[0]),
			Price: price, Change: toF(d[2]),
			MktCapB: toF(d[3]) / 1e9,
			Sector: toS(d[4]), Industry: industry, Rec: toF(d[13]),
			ROE: roe, FCF: fcf, NdEB: ndEB, RevGrowth: revGrowth,
			OffHigh: offHigh, TrailPE: trailPE,
			Score: score, Tier: tierLabel(score),
			PassROIC: passROIC, PassFCF: passFCF,
			PassDebt: passDebt, PassRev: passRev,
			PassDisc: passDisc, PassPE: passPE,
		}
		st.Thesis = autoThesisPietro(st)
		stocks = append(stocks, st)
		if len(stocks) >= 25 {
			break
		}
	}
	fmt.Printf("[pietro] theme=%s universe=%d stocks\n", theme.Label, len(stocks))
	return stocks
}

func industryRolePietro(industry, sector string) string {
	ind := strings.ToLower(industry)
	switch {
	case strings.Contains(ind, "semiconductor") && !strings.Contains(ind, "equipment"):
		return "Fab. semiconductores"
	case strings.Contains(ind, "semiconductor equipment"):
		return "Equipos fab. chips"
	case strings.Contains(ind, "software"):
		return "Software empresarial"
	case strings.Contains(ind, "information technology"):
		return "Servicios IT"
	case strings.Contains(ind, "communication equipment"):
		return "Redes y telecomunicación"
	case strings.Contains(ind, "computer hardware"):
		return "Hardware informático"
	case strings.Contains(ind, "aerospace") || strings.Contains(ind, "defense"):
		return "Contratista de defensa"
	case strings.Contains(ind, "biotechnology"):
		return "Biotecnología"
	case strings.Contains(ind, "drug"):
		return "Lab. farmacéutico"
	case strings.Contains(ind, "credit"):
		return "Red de pagos"
	case strings.Contains(ind, "industrial machinery"):
		return "Maquinaria industrial"
	case strings.Contains(ind, "electrical equipment"):
		return "Equipos eléctricos"
	default:
		if sector != "" {
			return sector
		}
		return industry
	}
}

func autoThesisPietro(s PietroAutoStock) string {
	role := industryRolePietro(s.Industry, s.Sector)
	var parts []string
	if s.PassROIC && s.ROE > 0 {
		parts = append(parts, fmt.Sprintf("ROE %.0f%%", s.ROE))
	}
	if s.PassFCF {
		parts = append(parts, "FCF+")
	}
	if s.PassDebt && s.NdEB > -900 {
		if s.NdEB < 0 {
			parts = append(parts, "caja neta")
		} else {
			parts = append(parts, fmt.Sprintf("ND/EBITDA %.1fx", s.NdEB))
		}
	}
	if s.PassRev && s.RevGrowth > 0 {
		parts = append(parts, fmt.Sprintf("rev +%.0f%%", s.RevGrowth))
	}
	if s.PassDisc {
		parts = append(parts, fmt.Sprintf("-%.0f%% vs max52s", s.OffHigh))
	}
	if len(parts) == 0 {
		return role
	}
	return role + " · " + strings.Join(parts, ", ")
}

func buildPietroDeepCard(s PietroAutoStock, themeLabel string) DeepCard {
	dateStr := time.Now().Format("02 Jan 2006")
	src := "TradingView Scanner · " + dateStr

	// THE MOAT
	moatTxt := industryRolePietro(s.Industry, s.Sector) + "."
	if s.PassROIC && s.ROE >= 20 {
		moatTxt += fmt.Sprintf(" ROE del %.0f%% indica ventaja competitiva estructural — rendimientos muy superiores al coste de capital.", s.ROE)
	} else if s.PassROIC {
		moatTxt += fmt.Sprintf(" ROE del %.0f%% supera el umbral de calidad (15%%) — poder de fijación de precios confirmado.", s.ROE)
	}
	if s.PassFCF && s.FCF > 0 {
		moatTxt += " Generación de caja libre positiva confirma pricing power sostenido."
	}
	if s.PassDebt && s.NdEB < 0 {
		moatTxt += " Balance en posición de caja neta — máxima flexibilidad para M&A o recompras."
	} else if s.PassDebt && s.NdEB > -900 {
		moatTxt += fmt.Sprintf(" Deuda/EBITDA %.1fx — nivel conservador, sin riesgo financiero a corto plazo.", s.NdEB)
	}

	// THE DRAWDOWN
	var drawTxt string
	if s.OffHigh < 3 {
		drawTxt = fmt.Sprintf("%s cotiza cerca de máximos de 52 semanas (%.1f%% desde max). Sin drawdown significativo — valoración exigente, usar stops ajustados.", s.Ticker, s.OffHigh)
	} else {
		high52 := s.Price * 100 / (100 - s.OffHigh)
		drawTxt = fmt.Sprintf("%s acumula una corrección del %.0f%% desde sus máximos anuales ($%.2f → $%.2f actual).", s.Ticker, s.OffHigh, high52, s.Price)
		if !s.PassRev && s.RevGrowth > -900 && s.RevGrowth < 0 {
			drawTxt += fmt.Sprintf(" Los ingresos mostraron contracción (%.0f%% a/a), generando revisión a la baja del consenso.", s.RevGrowth)
		}
		if s.TrailPE > 30 {
			drawTxt += fmt.Sprintf(" El múltiplo P/E de %.0fx sigue elevado para el sector, lo que mantiene el sesgo cauteloso.", s.TrailPE)
		}
		if !s.PassROIC && s.ROE > -900 {
			drawTxt += " La compresión de márgenes situó el ROE por debajo del umbral de calidad del 15%%."
		}
	}

	// THE CATALYST
	catTxt := ""
	if s.PassRev && s.RevGrowth > 10 {
		catTxt += fmt.Sprintf("Crecimiento de ingresos del %.0f%% a/a — si se mantiene, el consenso podría revisar al alza el BPA en los próximos 2 trimestres. ", s.RevGrowth)
	}
	if s.PassPE && s.FwdPE > 0 && s.TrailPE > 0 {
		catTxt += fmt.Sprintf("P/E forward (%.0fx) < P/E TTM (%.0fx) — el mercado anticipa aceleración de beneficios que puede comprimir el múltiplo. ", s.FwdPE, s.TrailPE)
	}
	if s.PassDisc {
		catTxt += fmt.Sprintf("Con %.0f%% de descuento sobre máximos, cualquier revisión positiva de guidance o sorpresa macro favorable puede desencadenar un fuerte rebote técnico. ", s.OffHigh)
	}
	catTxt += fmt.Sprintf("Como componente clave del sector '%s', %s está posicionado en la tesis temática detectada esta semana via análisis de noticias financieras.", themeLabel, s.Ticker)

	// THE EXIT
	exitTxt := ""
	if s.PassROIC && s.ROE > -900 {
		exitTxt += fmt.Sprintf("FUNDAMENTAL: Si el ROE cae por debajo del 15%% en dos trimestres consecutivos (actual: %.0f%%), la tesis de calidad queda invalidada — reducir posición. ", s.ROE)
	} else {
		exitTxt += "FUNDAMENTAL: Si los márgenes no mejoran en el próximo trimestre de resultados, la tesis de recuperación falla — salir de la posición. "
	}
	if s.NdEB > -900 && s.NdEB > 0 {
		exitTxt += fmt.Sprintf("Si Deuda/EBITDA supera 3x en dos reportes seguidos (actual: %.1fx), la carga financiera amenaza el FCF libre. ", s.NdEB)
	}
	stopPrice := s.Price * 0.85
	exitTxt += fmt.Sprintf("TECNICO: Cierre semanal por debajo de $%.2f (−15%% desde $%.2f actual) activa stop de protección de capital.", stopPrice, s.Price)

	return DeepCard{
		Symbol: s.Ticker, Name: s.Name, Score: s.Score, Tier: s.Tier,
		Moat: CardSection{Content: moatTxt, Source: src},
		Draw: CardSection{Content: drawTxt, Source: src},
		Cat:  CardSection{Content: catTxt, Source: src},
		Exit: CardSection{Content: exitTxt, Source: src},
	}
}

func monthES(m time.Month) string {
	switch m {
	case time.January:
		return "Ene"
	case time.February:
		return "Feb"
	case time.March:
		return "Mar"
	case time.April:
		return "Abr"
	case time.May:
		return "May"
	case time.June:
		return "Jun"
	case time.July:
		return "Jul"
	case time.August:
		return "Ago"
	case time.September:
		return "Sep"
	case time.October:
		return "Oct"
	case time.November:
		return "Nov"
	case time.December:
		return "Dic"
	}
	return m.String()
}

func buildPietroData() PietroAutoResult {
	theme := detectPietroTheme()
	universe := tvScanPietroUniverse(theme)

	// Deduplicate: same company listed as multiple share classes (e.g. GOOGL + GOOG, META ClassA + B)
	// Keep the one with the larger market cap.
	normaliseCoName := func(name string) string {
		s := strings.ToLower(strings.TrimSpace(name))
		// Strip share-class suffixes: "class a", "class b", "class c", etc.
		for _, sfx := range []string{" class a", " class b", " class c", " class x", " class y", " class i", " class ii"} {
			s = strings.TrimSuffix(s, sfx)
		}
		// Strip common corporate suffixes
		for _, sfx := range []string{" inc.", " inc", " corp.", " corp", " ltd.", " ltd", " llc", " plc", " co.", " co"} {
			s = strings.TrimSuffix(s, sfx)
		}
		return strings.TrimSpace(s)
	}
	seenCoName := map[string]bool{}
	var deduped []PietroAutoStock
	// Sort by mktcap desc first so we keep the primary/larger share class
	sort.Slice(universe, func(i, j int) bool { return universe[i].MktCapB > universe[j].MktCapB })
	for _, st := range universe {
		key := normaliseCoName(st.Name)
		if key == "" {
			key = strings.ToLower(st.Ticker)
		}
		if !seenCoName[key] {
			seenCoName[key] = true
			deduped = append(deduped, st)
		}
	}
	universe = deduped

	sort.Slice(universe, func(i, j int) bool {
		if universe[i].Score != universe[j].Score {
			return universe[i].Score > universe[j].Score
		}
		return universe[i].MktCapB > universe[j].MktCapB
	})

	// Growth: top 5 by Quality-at-a-Discount score
	var growth []PietroAutoStock
	for _, s := range universe {
		if len(growth) >= 5 {
			break
		}
		growth = append(growth, s)
	}

	// Value: next 5 (not already in Growth)
	growthSet := map[string]bool{}
	for _, g := range growth {
		growthSet[g.Ticker] = true
	}
	var value []PietroAutoStock
	for _, s := range universe {
		if len(value) >= 5 {
			break
		}
		if !growthSet[s.Ticker] {
			value = append(value, s)
		}
	}

	// Deep thesis cards for top 3
	var cards []DeepCard
	for i, s := range universe {
		if i >= 3 {
			break
		}
		cards = append(cards, buildPietroDeepCard(s, theme.Label))
	}

	// Date labels
	loc, err := time.LoadLocation("Europe/Madrid")
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	wd := int(now.Weekday())
	daysToMon := wd - 1
	if daysToMon < 0 {
		daysToMon = 6
	}
	monday := now.AddDate(0, 0, -daysToMon)
	sunday := monday.AddDate(0, 0, 6)
	dateRange := fmt.Sprintf("%d %s – %d %s %d",
		monday.Day(), monthES(monday.Month()),
		sunday.Day(), monthES(sunday.Month()), now.Year())
	nextMon := monday.AddDate(0, 0, 7)
	updatedAt := fmt.Sprintf("Lun %d %s %d · 23:59 CET", monday.Day(), monthES(monday.Month()), monday.Year())
	nextUpdate := fmt.Sprintf("Lun %d %s %d · 23:59 CET", nextMon.Day(), monthES(nextMon.Month()), nextMon.Year())

	return PietroAutoResult{
		ThemeNum: theme.Num, ThemeLabel: theme.Label, ThemeEmoji: theme.Emoji,
		WeekLabel: "Semana " + dateRange, DateRange: dateRange,
		UpdatedAt: updatedAt, NextUpdate: nextUpdate,
		Growth: growth, Value: value, Universe: universe, Cards: cards,
		Source:    "TradingView Scanner · Análisis RSS Expansión",
		Timestamp: time.Now().UTC().Format("Mon 02 Jan 2006 — 15:04:05 UTC"),
	}
}

func pietroAutoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	pietroAutoMu.Lock()
	needsRefresh := pietroNeedsRefresh()
	pietroAutoMu.Unlock()

	if needsRefresh {
		data := buildPietroData()
		pietroAutoMu.Lock()
		pietroAutoCached = &data
		pietroAutoAt = time.Now()
		pietroAutoMu.Unlock()
	}

	pietroAutoMu.Lock()
	out := pietroAutoCached
	pietroAutoMu.Unlock()

	if out == nil {
		w.WriteHeader(503)
		fmt.Fprint(w, `{"error":"Pietro data building — retry in 5s"}`)
		return
	}
	json.NewEncoder(w).Encode(out)
	fmt.Printf("[pietro] served theme=%s universe=%d cards=%d\n", out.ThemeLabel, len(out.Universe), len(out.Cards))
}

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
	http.HandleFunc("/api/weekly", weeklyHandler)
	http.HandleFunc("/api/analyze", analyzeHandler)
	http.HandleFunc("/api/noticias", noticiasHandler)
	http.HandleFunc("/api/pietro", pietroAutoHandler)
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
/* ── WEEKLY RECOMMENDATIONS ── */
.pietro-section{background:linear-gradient(135deg,#071210 0%,#0a1a0e 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:20px 24px 16px}
.pietro-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.pietro-title{font-size:15px;font-weight:700;color:var(--pqf2);letter-spacing:.3px}
.pietro-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.theme-badge{background:var(--pqf3);color:var(--pqf2);border:1px solid var(--pqf);border-radius:12px;font-size:11px;font-weight:600;padding:3px 10px}
.date-badge{color:var(--muted);font-size:11px;font-family:'JetBrains Mono',monospace}
.update-badge{color:#555;font-size:10px;font-family:'JetBrains Mono',monospace}
.pietro-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.pietro-cols{grid-template-columns:1fr}}
.col-hdr{font-size:11px;font-weight:700;letter-spacing:.8px;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid}
.col-hdr.growth{color:#4ade80;border-color:#4ade8040}
.col-hdr.value{color:var(--gold);border-color:#f5c84240}
.wk-cards{display:flex;flex-direction:column;gap:7px}
.wk-card{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:10px 12px;transition:.2s}
.wk-card:hover{border-color:var(--pqf)}
.wk-card.wk-growth{border-left:3px solid #4ade80}
.wk-card.wk-value{border-left:3px solid var(--gold)}
.wk-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.wk-sym{font-size:13px;font-weight:700;color:#e8f5e9;font-family:'JetBrains Mono',monospace}
.wk-rec-badge{font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;margin-left:6px;vertical-align:middle}
.wk-price-row{font-size:12px;font-weight:600;color:#ccc;font-family:'JetBrains Mono',monospace}
.wk-name{font-size:10px;color:var(--muted);margin-bottom:4px}
.wk-why{font-size:10px;color:#8eac92;line-height:1.4}
.weekly-foot{margin-top:10px;font-size:9px;color:#444;font-family:'JetBrains Mono',monospace;text-align:right}
/* ── QUALITY TABLE ── */
.qtable{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}
.qtable th{color:var(--muted);font-weight:600;text-align:left;padding:4px 6px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:9px;letter-spacing:.4px}
.qtable th.r,.qtable td.r{text-align:right}
.qtable td{padding:4px 6px;border-bottom:1px solid #111;vertical-align:middle}
.qtable tr:hover td{background:#0d1c10}
.qtable tr.q-best td:first-child{border-left:2px solid #4ade80}
.qtable tr.q-strong td:first-child{border-left:2px solid var(--gold)}
.qtable tr.q-watch td:first-child{border-left:2px solid #888}
.qtable tr.q-avoid td:first-child{border-left:2px solid #ef4444}
.q-sym{font-weight:700;font-family:'JetBrains Mono',monospace;font-size:11px;color:#e8f5e9}
.q-name{font-size:9px;color:var(--muted)}
.q-score{font-weight:700;font-family:'JetBrains Mono',monospace}
.q-tier{font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;white-space:nowrap}
.q-tier.BEST{background:#14532d;color:#4ade80}
.q-tier.STRONG{background:#713f12;color:#fbbf24}
.q-tier.WATCH{background:#1e293b;color:#94a3b8}
.q-tier.AVOID{background:#450a0a;color:#f87171}
.q-ok{color:#4ade80}.q-bad{color:#ef4444}.q-na{color:#444}
.q-thesis{font-size:9px;color:#6b8c6e;max-width:220px}
.value-picks-hdr{font-size:10px;font-weight:700;color:var(--gold);margin:12px 0 6px;letter-spacing:.4px}
.qt-note{font-size:9px;color:#444;margin-bottom:6px;font-family:'JetBrains Mono',monospace}
/* ── DEEP THESIS CARDS ── */
.deep-section-wrap{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
.deep-section-title{font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.5px;margin-bottom:10px}
.deep-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}
.deep-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;border-top:3px solid var(--gold)}
.deep-card-hdr{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.deep-sym-lg{font-size:15px;font-weight:800;color:#e8f5e9;font-family:'JetBrains Mono',monospace}
.deep-name-sm{font-size:9px;color:var(--muted);margin-top:2px}
.deep-score-badge{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gold);font-weight:700}
.deep-block{margin-bottom:10px}
.deep-block-lbl{font-size:9px;font-weight:800;letter-spacing:.9px;margin-bottom:3px;display:flex;align-items:center;gap:5px}
.lbl-moat{color:#4ade80}.lbl-draw{color:#f87171}.lbl-cat{color:#60a5fa}.lbl-exit{color:#fbbf24}
.deep-block-body{font-size:10px;color:#8eac92;line-height:1.55}
.deep-src{font-size:8px;color:#3d5c40;margin-top:3px;font-style:italic;line-height:1.4}

/* ── NOTICIAS EXPANSIÓN ── */
.news-wrap{padding:16px 20px;display:flex;flex-direction:column;gap:14px}
.news-top-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.news-source{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px}
.news-source strong{color:#e34a4a;font-size:12px}
.news-ts{font-size:10px;color:#444;font-family:'JetBrains Mono',monospace}
.news-filters{display:flex;gap:5px;flex-wrap:wrap}
.nf-btn{background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:10px;font-weight:700;padding:4px 11px;cursor:pointer;transition:.15s;letter-spacing:.2px}
.nf-btn:hover{color:var(--text)}
.nf-btn.on{background:var(--bg4);color:var(--text);border-color:var(--pqf)}
/* news grid */
.news-grid{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}
@media(max-width:900px){.news-grid{grid-template-columns:1fr}}
/* main feed */
.news-feed{display:flex;flex-direction:column;gap:0}
.news-card{display:flex;gap:12px;padding:13px 2px;border-bottom:1px solid var(--border);transition:background .15s;cursor:pointer;text-decoration:none;color:inherit}
.news-card:hover{background:var(--card)}
.news-card:last-child{border-bottom:none}
.news-card-main{flex:1;min-width:0}
.news-badge{display:inline-block;font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:3px;letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px}
.news-headline{font-size:13.5px;font-weight:700;line-height:1.45;color:var(--text);margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.news-card:hover .news-headline{color:var(--pqf2)}
.news-summary{font-size:11px;color:var(--muted);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:5px}
.news-meta{font-size:9.5px;color:#444;display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace}
.news-author{color:#555}
.news-reltime{color:var(--pqf);font-weight:600}
/* hero cards (top 2) */
.news-heroes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
@media(max-width:700px){.news-heroes{grid-template-columns:1fr}}
.news-hero{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit;transition:.2s;border-top:3px solid #e34a4a}
.news-hero:hover{border-color:var(--pqf2);background:var(--card2)}
.news-hero .news-headline{font-size:15px;-webkit-line-clamp:3}
.news-hero .news-summary{-webkit-line-clamp:3}
/* sidebar */
.news-sidebar{display:flex;flex-direction:column;gap:10px}
.news-sidebar-card{background:var(--card);border:1px solid var(--border);border-radius:9px;padding:12px}
.news-sidebar-title{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.news-sidebar-title::after{content:'';flex:1;height:1px;background:var(--border)}
.nsb-item{padding:7px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:flex-start}
.nsb-item:last-child{border-bottom:none;padding-bottom:0}
.nsb-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;margin-top:5px}
.nsb-txt{font-size:11px;color:var(--text);line-height:1.4;font-weight:500}
.nsb-meta{font-size:9px;color:#444;font-family:'JetBrains Mono',monospace;margin-top:2px}
.news-sec-stat{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)}
.news-sec-stat:last-child{border-bottom:none}
.news-sec-name{font-size:10px;font-weight:600}
.news-sec-count{font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--muted)}
.news-empty{text-align:center;padding:40px;color:var(--muted);font-size:12px}

/* ── PIETRO AUTO TAB ── */
.p-auto-wrap{padding:16px 20px}
.p-auto-top{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.p-auto-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.p-auto-title{font-size:15px;font-weight:700;color:var(--pqf2);letter-spacing:.3px}
.p-theme-badge{background:var(--pqf3);border:1px solid var(--pqf);border-radius:14px;font-size:12px;font-weight:700;padding:4px 14px;color:var(--pqf2)}
.p-auto-meta{font-size:10px;color:var(--muted);display:flex;flex-direction:column;gap:3px;align-items:flex-end;text-align:right}
.p-source-note{font-size:9px;color:#444;font-family:'JetBrains Mono',monospace}

/* ── STOCK ANALYZER ── */
.an-bar{display:flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:2px 2px 2px 8px;transition:border-color .2s}
.an-bar:focus-within{border-color:var(--pqf)}
.an-input{background:none;border:none;outline:none;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;width:90px;text-transform:uppercase;letter-spacing:.5px}
.an-input::placeholder{color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0}
.an-btn{background:var(--pqf3);border:1px solid var(--pqf);color:var(--pqf2);border-radius:5px;font-size:10px;font-weight:700;padding:4px 9px;cursor:pointer;transition:.2s;white-space:nowrap}
.an-btn:hover{background:var(--pqf);color:#fff}
.an-btn:disabled{opacity:.5;cursor:wait}
/* modal overlay */
.an-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:900;align-items:center;justify-content:center;backdrop-filter:blur(3px)}
.an-overlay.open{display:flex}
.an-box{background:var(--bg2);border:1px solid var(--pqf);border-radius:14px;width:min(96vw,780px);max-height:90vh;overflow-y:auto;box-shadow:0 0 48px rgba(43,122,53,.25)}
.an-hdr{padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border);background:linear-gradient(135deg,var(--bg2) 0%,var(--bg3) 100%)}
.an-sym{font-size:22px;font-weight:800;color:var(--pqf2);font-family:'JetBrains Mono',monospace}
.an-name{font-size:11px;color:var(--muted);margin-top:2px}
.an-price-block{text-align:right}
.an-price{font-size:22px;font-weight:700;font-family:'JetBrains Mono',monospace}
.an-chg{font-size:12px;font-weight:600;font-family:'JetBrains Mono',monospace;display:block;margin-top:1px}
.an-close{background:var(--bg4);border:1px solid var(--border);color:var(--muted);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:.2s;flex-shrink:0;margin-left:10px}
.an-close:hover{border-color:var(--red);color:var(--red)}
.an-body{padding:16px 20px;display:flex;flex-direction:column;gap:14px}
/* signal row */
.an-sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.an-sig-card{background:var(--card);border:1px solid var(--border);border-radius:9px;padding:11px 14px}
.an-sig-label{font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px}
.an-sig-val{font-size:13px;font-weight:800;font-family:'JetBrains Mono',monospace}
.an-sig-sub{font-size:9px;color:var(--muted);margin-top:2px}
.an-sig-bar{height:4px;background:var(--bg4);border-radius:2px;margin-top:6px;overflow:hidden}
.an-sig-fill{height:100%;border-radius:2px;transition:width .4s}
/* metrics grid */
.an-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
@media(max-width:600px){.an-sig-row{grid-template-columns:1fr 1fr}.an-metrics{grid-template-columns:repeat(2,1fr)}}
.an-metric{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:9px 12px}
.an-metric-l{font-size:8.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.an-metric-v{font-size:13px;font-weight:700;font-family:'JetBrains Mono',monospace}
/* section title inside modal */
.an-sec{font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:6px;margin-bottom:6px}
.an-sec::after{content:'';flex:1;height:1px;background:var(--border)}
/* range bar */
.an-range{display:flex;flex-direction:column;gap:4px}
.an-range-bar{height:6px;background:var(--bg4);border-radius:3px;position:relative}
.an-range-cur{position:absolute;top:-3px;width:3px;height:12px;background:var(--pqf2);border-radius:2px;transform:translateX(-50%);transition:left .4s}
.an-range-labels{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);font-family:'JetBrains Mono',monospace}
.an-ts{font-size:9px;color:#333;font-family:'JetBrains Mono',monospace;text-align:center;margin-top:4px}
/* trend badge */
.an-trend{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:12px;margin-left:8px;vertical-align:middle}
.trend-up{background:rgba(63,185,80,.15);color:var(--green);border:1px solid rgba(63,185,80,.3)}
.trend-dn{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3)}
.trend-nn{background:var(--bg4);color:var(--muted);border:1px solid var(--border)}
/* error state */
.an-err{padding:30px;text-align:center;color:#fca5a5;font-size:12px}
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
    <button class="tab-btn" onclick="setTab('noticias')" id="tab-btn-noticias">📰 Expansión</button>
    <button class="tab-btn" onclick="setTab('pietro')" id="tab-btn-pietro">⭐ Pietro</button>
  </div>

  <div class="hdr-right">
    <div class="live-badge"><div class="live-dot"></div><span data-i18n="live">LIVE</span></div>
    <div class="lang-sw">
      <button class="lang-btn active" onclick="setLang('es')">🇪🇸 ES</button>
      <button class="lang-btn" onclick="setLang('en')">🇬🇧 EN</button>
      <button class="lang-btn" onclick="setLang('it')">🇮🇹 IT</button>
    </div>
    <div class="ts" id="ts">—</div>
    <div class="an-bar" title="Analizar cualquier acción — escribe el ticker y pulsa Analizar">
      <input class="an-input" id="an-ticker" placeholder="AAPL, SAN, NVDA…" maxlength="20"
        onkeydown="if(event.key==='Enter'){analyzeStock()}"
        oninput="this.value=this.value.toUpperCase()">
      <button class="an-btn" id="an-btn" onclick="analyzeStock()">🔍 Analizar</button>
    </div>
    <button class="refresh-btn" onclick="refreshAll()" data-i18n="refresh">⟳ Refresh</button>
  </div>
</header>

<!-- ══ ANALYZE MODAL ══ -->
<div class="an-overlay" id="an-overlay" onclick="if(event.target===this)closeAnalyzeModal()">
  <div class="an-box" id="an-box">
    <div class="loading" style="padding:50px"><div class="spinner"></div>Buscando…</div>
  </div>
</div>

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

  <!-- ══ RECOMENDADO POR PIETRO ══ -->
  <div class="pietro-section">
    <div class="pietro-header">
      <div class="pietro-title">⭐ Recomendado por Pietro · Selección Semanal</div>
      <div class="pietro-meta">
        <span class="theme-badge" id="weekly-theme">🤖 AI Infrastructure</span>
        <span class="date-badge" id="weekly-dates">Semana 26 May – 1 Jun 2026</span>
        <span class="update-badge">📅 Actualización: lunes 23:59 CET</span>
      </div>
    </div>
    <div class="pietro-cols">
      <div>
        <div class="col-hdr growth">📈 GROWTH — Alta convicción, alta velocidad</div>
        <div class="wk-cards" id="weekly-growth">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
      <div style="overflow:hidden">
        <div class="col-hdr value">💎 VALUE — Quality at a Discount Screen</div>
        <div class="qt-note">Universo: 25 tickers AI Infrastructure · Score /100 · %High: precio live</div>
        <div class="value-picks-hdr" id="value-picks-label">⭐ Top 5 Selección VALUE</div>
        <div class="wk-cards" id="weekly-value">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div style="margin-top:12px;overflow-x:auto">
          <table class="qtable" id="quality-table">
            <thead><tr>
              <th>Rk</th><th>Ticker</th>
              <th class="r">ROIC%</th><th class="r">FCF%</th>
              <th class="r">ND/EBITDA</th><th class="r">RevGr%</th>
              <th class="r">%Máx52</th><th class="r">Score</th>
              <th>Tier</th><th>Thesis</th>
            </tr></thead>
            <tbody id="quality-tbody"><tr><td colspan="10" style="text-align:center;color:var(--muted);padding:12px">Cargando…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- Deep thesis cards -->
    <div class="deep-section-wrap">
      <div class="deep-section-title">📋 Deep Thesis — Top 3 por Conviction Score · LRCX · KLAC · QCOM</div>
      <div class="deep-grid" id="deep-cards">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
    <div class="weekly-foot" id="weekly-ts">Cargando…</div>
  </div>
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

<!-- ══ NOTICIAS EXPANSIÓN TAB ══ -->
<div class="tab-content" id="tab-noticias">
  <div class="news-wrap">
    <div class="news-top-bar">
      <div class="news-source">
        <strong>Expansión</strong>
        <span>— Noticias financieras en tiempo real</span>
        <span class="live-badge" style="font-size:9px;padding:3px 8px"><div class="live-dot"></div>RSS Live</span>
      </div>
      <div class="news-ts" id="news-ts">Cargando…</div>
    </div>
    <div class="news-filters" id="news-filters">
      <button class="nf-btn on" onclick="setNewsFilter('ALL',this)">Todas</button>
    </div>
    <div class="loading" id="news-loading"><div class="spinner"></div>Cargando noticias…</div>
    <div id="news-content" style="display:none">
      <div class="news-heroes" id="news-heroes"></div>
      <div class="news-grid">
        <div>
          <div class="sec-title" style="margin-bottom:8px">📋 Últimas noticias</div>
          <div class="news-feed" id="news-feed"></div>
        </div>
        <div class="news-sidebar">
          <div class="news-sidebar-card">
            <div class="news-sidebar-title">🔥 Más recientes</div>
            <div id="news-latest"></div>
          </div>
          <div class="news-sidebar-card">
            <div class="news-sidebar-title">📂 Por sección</div>
            <div id="news-sections"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══ PIETRO AUTO TAB ══ -->
<div class="tab-content" id="tab-pietro">
  <div class="p-auto-wrap">
    <div class="p-auto-top">
      <div class="p-auto-header">
        <div class="p-auto-title">⭐ Recomendado por Pietro · Selección Semanal Dinámica</div>
        <span class="p-theme-badge" id="p-theme-badge">🤖 Detectando tema…</span>
        <span class="date-badge" id="p-dates">—</span>
      </div>
      <div class="p-auto-meta">
        <span id="p-update">📅 Actualización: lunes 23:59 CET</span>
        <span class="p-source-note" id="p-source">Fuente: TradingView Scanner · RSS Expansión</span>
      </div>
    </div>
    <div id="p-loading" class="loading"><div class="spinner"></div>Analizando noticias y ejecutando Quality at a Discount screen…</div>
    <div id="p-content" style="display:none">
      <!-- Growth + Value columns -->
      <div class="pietro-cols">
        <div>
          <div class="col-hdr growth">📈 GROWTH — Quality at a Discount · Top 5 por Score</div>
          <div class="wk-cards" id="p-growth-cards"></div>
        </div>
        <div>
          <div class="col-hdr value">💎 VALUE — Siguientes posiciones por Score · Top 5</div>
          <div class="wk-cards" id="p-value-cards"></div>
        </div>
      </div>
      <!-- Full universe quality table -->
      <div style="margin-top:16px">
        <div class="sec-title" style="margin-bottom:4px">📊 Universo — Quality at a Discount Screen · <span id="p-universe-count">—</span> stocks · Tema: <span id="p-theme-label">—</span></div>
        <div class="qt-note" id="p-qt-note">Tema detectado via análisis RSS Expansión · Score /100 · ROE%= proxy ROIC · %Máx52s = precio live</div>
        <div style="overflow-x:auto;margin-top:6px">
          <table class="qtable" id="p-qtable">
            <thead><tr>
              <th>Rk</th><th>Ticker</th>
              <th class="r">ROE%</th><th class="r">FCF</th>
              <th class="r">ND/EBITDA</th><th class="r">RevGr%</th>
              <th class="r">%Mxs52</th><th class="r">Score</th>
              <th>Tier</th><th>Thesis</th>
            </tr></thead>
            <tbody id="p-qtbody"><tr><td colspan="10" style="text-align:center;color:var(--muted);padding:12px">Cargando…</td></tr></tbody>
          </table>
        </div>
      </div>
      <!-- Deep Thesis Cards — Top 3 -->
      <div class="deep-section-wrap">
        <div class="deep-section-title" id="p-deep-title">📋 Deep Thesis — Top 3 por Conviction Score</div>
        <div class="deep-grid" id="p-deep-cards"></div>
      </div>
      <div class="weekly-foot" id="p-ts">—</div>
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
  if (tab === 'noticias') loadNoticias();
  if (tab === 'pietro') loadPietro();
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

function refreshAll() { loadGlobal(); loadWeekly(); if (ibexLoaded) loadIbex(); }

// ══ Weekly Recommendations ════════════════════════════════════
async function loadWeekly() {
  try {
    const r = await fetch('/api/weekly');
    const d = await r.json();
    renderWeekly(d);
  } catch(e) {}
}

function renderWeekly(d) {
  if (!d) return;
  const m = d.meta;
  document.getElementById('weekly-theme').textContent = m.themeEmoji + ' ' + m.theme;
  document.getElementById('weekly-dates').textContent = 'Semana ' + m.dateRange;
  document.getElementById('weekly-ts').textContent =
    '🟢 Live · TradingView Scanner · ' + (d.timestamp||'') + ' · Actualizado: ' + m.updatedAt;
  renderWeeklyCards('weekly-growth', d.growth, 'growth');
  renderWeeklyCards('weekly-value',  d.value,  'value');
  if (d.quality)    renderQualityTable(d.quality);
  if (d.deepCards)  renderDeepCards(d.deepCards);
}

function renderDeepCards(cards) {
  const el = document.getElementById('deep-cards');
  if (!el || !cards || !cards.length) return;
  function blk(icon, lbl, cls, s) {
    if (!s) return '';
    return '<div class="deep-block">'
      + '<div class="deep-block-lbl ' + cls + '">' + icon + ' ' + lbl + '</div>'
      + '<div class="deep-block-body">' + s.content + '</div>'
      + (s.source ? '<div class="deep-src">📎 ' + s.source + '</div>' : '')
      + '</div>';
  }
  el.innerHTML = cards.map(c =>
    '<div class="deep-card">'
    + '<div class="deep-card-hdr">'
    + '<div><div class="deep-sym-lg">' + c.symbol + '</div><div class="deep-name-sm">' + (c.name||'') + '</div></div>'
    + '<div class="deep-score-badge">' + c.score + '/100 &nbsp;<span class="q-tier ' + c.tier + '" style="font-size:8px">' + c.tier + '</span></div>'
    + '</div>'
    + blk('🏰','EL MOAT','lbl-moat', c.moat)
    + blk('📉','EL DRAWDOWN','lbl-draw', c.draw)
    + blk('⚡','EL CATALIZADOR','lbl-cat', c.cat)
    + blk('🚪','LA SALIDA','lbl-exit', c.exit)
    + '</div>'
  ).join('');
}

function renderQualityTable(rows) {
  const tbody = document.getElementById('quality-tbody');
  if (!tbody || !rows || !rows.length) return;
  const fmtQ = (v, good) => {
    if (v <= -900) return '<span class="q-na">N/D</span>';
    const cls = good(v) ? 'q-ok' : 'q-bad';
    return '<span class="' + cls + '">' + fmt(v, 1) + '</span>';
  };
  const fmtNd = v => {
    if (v <= -900) return '<span class="q-na">N/D</span>';
    if (v < 0) return '<span class="q-ok">caja</span>';
    return '<span class="' + (v < 2 ? 'q-ok' : 'q-bad') + '">' + fmt(v,1) + 'x</span>';
  };
  tbody.innerHTML = rows.map((s, i) => {
    const tr = 'q-' + (s.tier||'watch').toLowerCase();
    const offH = s.offHigh > 0 ? '<span class="' + (s.offHigh >= 15 ? 'q-ok' : 'q-bad') + '">-' + fmt(s.offHigh,1) + '%</span>' : '<span class="q-na">—</span>';
    const flt = s.fwdLtTtl ? '<span class="q-ok">✓</span>' : '<span class="q-bad">✗</span>';
    const priceStr = s.price ? ' <span style="font-size:9px;color:#888">$' + fmt(s.price) + '</span>' : '';
    return '<tr class="' + tr + '">'
      + '<td style="color:#555;font-size:9px">' + (i+1) + '</td>'
      + '<td><div class="q-sym">' + s.symbol + priceStr + '</div><div class="q-name">' + (s.name||'').substring(0,22) + '</div></td>'
      + '<td class="r">' + fmtQ(s.roic, v => v >= 15) + '</td>'
      + '<td class="r">' + fmtQ(s.fcfMargin, v => v > 0) + '</td>'
      + '<td class="r">' + fmtNd(s.ndEbitda) + '</td>'
      + '<td class="r">' + fmtQ(s.revGrowth, v => v > 0) + ' ' + flt + '</td>'
      + '<td class="r">' + offH + '</td>'
      + '<td class="r q-score" style="color:' + (s.score>=80?'#4ade80':s.score>=65?'#fbbf24':s.score>=50?'#94a3b8':'#f87171') + '">' + s.score + '</td>'
      + '<td><span class="q-tier ' + (s.tier||'AVOID') + '">' + (s.tier||'?') + '</span></td>'
      + '<td class="q-thesis">' + (s.thesis||'').substring(0,80) + '</td>'
      + '</tr>';
  }).join('');
}

function renderWeeklyCards(id, stocks, type) {
  const el = document.getElementById(id);
  if (!el || !stocks) return;
  el.innerHTML = stocks.map(s => {
    const pct = s.change || 0;
    const c = pct >= 0 ? 'up' : 'dn';
    const sign = pct > 0 ? '+' : '';
    const priceStr = s.price ? '$' + fmt(s.price) : '—';
    const chgStr = s.price ? ' <span class="' + c + '">' + arrow(pct) + sign + fmt(pct,2) + '%</span>' : '';
    const sig = s.rec ? recToSig(s.rec) : '';
    const cls = sig ? sigClass(sig) : '';
    const recHtml = sig ? ' <span class="sig-badge ' + cls + '" style="font-size:9px;padding:1px 4px">' + sig + '</span>' : '';
    return '<div class="wk-card wk-' + type + '">'
      + '<div class="wk-top">'
      + '<div><span class="wk-sym">' + s.symbol + '</span>' + recHtml + '</div>'
      + '<div class="wk-price-row">' + priceStr + chgStr + '</div>'
      + '</div>'
      + '<div class="wk-name">' + s.name + '</div>'
      + '<div class="wk-why">💡 ' + s.rationale + '</div>'
      + '</div>';
  }).join('');
}

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

// ══ Noticias Expansión ════════════════════════════════════════
let noticiasLoaded = false;
let noticiasData = [];
let newsFilter = 'ALL';

function secColor(sec) {
  const s = (sec || '').toUpperCase();
  if (s.includes('MERCADO') || s.includes('BOLSA') || s.includes('EURIBOR') || s.includes('CRONICA') || s.includes('CRÓNICA')) return {color:'#3b82f6', bg:'rgba(59,130,246,.15)'};
  if (s.includes('EMPRESA')) return {color:'var(--pqf2)', bg:'rgba(43,122,53,.15)'};
  if (s.includes('ECONOM')) return {color:'var(--gold)', bg:'rgba(201,168,76,.15)'};
  if (s.includes('ENERG')) return {color:'#f97316', bg:'rgba(249,115,22,.15)'};
  if (s.includes('BANCA') || s.includes('DIRECT')) return {color:'var(--purple)', bg:'rgba(167,139,250,.15)'};
  if (s.includes('FINANCIAL') || s.includes('FT')) return {color:'#f43f5e', bg:'rgba(244,63,94,.15)'};
  if (s.includes('TECNO') || s.includes('DIGITAL')) return {color:'#06b6d4', bg:'rgba(6,182,212,.15)'};
  if (s.includes('FISCAL') || s.includes('NORMA')) return {color:'#eab308', bg:'rgba(234,179,8,.15)'};
  if (s.includes('AHORRO') || s.includes('PENSIÓN') || s.includes('FONDOS')) return {color:'#14b8a6', bg:'rgba(20,184,166,.15)'};
  if (s.includes('INMOBIL') || s.includes('VIVIENDA')) return {color:'#a78bfa', bg:'rgba(167,139,250,.15)'};
  return {color:'var(--muted)', bg:'var(--bg4)'};
}

function newsBadge(sec) {
  const c = secColor(sec);
  return '<span class="news-badge" style="color:' + c.color + ';background:' + c.bg + '">' + (sec || '').toUpperCase().substring(0,18) + '</span>';
}

function newsCardHTML(item) {
  return '<a class="news-card" href="' + item.link + '" target="_blank">'
    + '<div class="news-card-main">'
    + newsBadge(item.section)
    + '<div class="news-headline">' + item.title + '</div>'
    + (item.summary ? '<div class="news-summary">' + item.summary + '</div>' : '')
    + '<div class="news-meta">'
    + (item.author ? '<span class="news-author">' + item.author + '</span><span style="color:#333">·</span>' : '')
    + '<span class="news-reltime">' + (item.relTime||'') + '</span>'
    + '</div></div></a>';
}

function newsHeroHTML(item) {
  return '<a class="news-hero" href="' + item.link + '" target="_blank">'
    + newsBadge(item.section)
    + '<div class="news-headline">' + item.title + '</div>'
    + (item.summary ? '<div class="news-summary">' + item.summary + '</div>' : '')
    + '<div class="news-meta">'
    + (item.author ? '<span class="news-author">' + item.author + '</span><span style="color:#333">·</span>' : '')
    + '<span class="news-reltime">' + (item.relTime||'') + '</span>'
    + '</div></a>';
}

function setNewsFilter(f, btn) {
  newsFilter = f;
  document.querySelectorAll('.nf-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderNewsFeed();
}

function renderNewsFeed() {
  const items = newsFilter === 'ALL' ? noticiasData
    : noticiasData.filter(n => (n.section||'').toUpperCase().includes(newsFilter.toUpperCase()));

  // Heroes: top 2
  document.getElementById('news-heroes').innerHTML = items.slice(0,2).map(newsHeroHTML).join('');

  // Feed: rest
  const rest = items.slice(2);
  document.getElementById('news-feed').innerHTML = rest.length
    ? rest.map(newsCardHTML).join('')
    : '<div class="news-empty">Sin noticias en esta categoría</div>';
}

function renderNoticias(d) {
  noticiasData = d.items || [];
  document.getElementById('news-ts').textContent = 'Actualizado: ' + (d.timestamp||'');
  document.getElementById('news-loading').style.display = 'none';
  document.getElementById('news-content').style.display = '';

  // Build filter buttons from sections
  const secCounts = {};
  noticiasData.forEach(n => {
    const s = n.section || 'Otras';
    secCounts[s] = (secCounts[s] || 0) + 1;
  });
  // Group into top categories
  const cats = [
    {label:'Mercados', key:'MERCADO'},
    {label:'Empresas', key:'EMPRESA'},
    {label:'Economía', key:'ECONOM'},
    {label:'Energía',  key:'ENERG'},
    {label:'Fiscal',   key:'FISCAL'},
    {label:'FT',       key:'FINANCIAL'},
    {label:'Ahorro',   key:'AHORRO'},
  ];
  const filtersEl = document.getElementById('news-filters');
  filtersEl.innerHTML = '<button class="nf-btn on" onclick="setNewsFilter(\'ALL\',this)">Todas (' + noticiasData.length + ')</button>'
    + cats.map(cat => {
        const cnt = noticiasData.filter(n => (n.section||'').toUpperCase().includes(cat.key)).length;
        if (!cnt) return '';
        return '<button class="nf-btn" onclick="setNewsFilter(\'' + cat.key + '\',this)">' + cat.label + ' (' + cnt + ')</button>';
      }).join('');

  // Sidebar: latest 5
  const latest = noticiasData.slice(0,6);
  document.getElementById('news-latest').innerHTML = latest.map(n => {
    const c = secColor(n.section);
    return '<div class="nsb-item">'
      + '<div class="nsb-dot" style="background:' + c.color + ';margin-top:4px"></div>'
      + '<div><div class="nsb-txt">' + n.title.substring(0,70) + (n.title.length>70?'…':'') + '</div>'
      + '<div class="nsb-meta">' + (n.section||'') + ' · ' + (n.relTime||'') + '</div></div></div>';
  }).join('');

  // Sidebar: sections breakdown
  const topSecs = Object.entries(secCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  document.getElementById('news-sections').innerHTML = topSecs.map(([sec, cnt]) => {
    const c = secColor(sec);
    return '<div class="news-sec-stat">'
      + '<span class="news-sec-name" style="color:' + c.color + '">' + sec + '</span>'
      + '<span class="news-sec-count">' + cnt + '</span></div>';
  }).join('');

  renderNewsFeed();
}

async function loadNoticias() {
  noticiasLoaded = true;
  try {
    const r = await fetch('/api/noticias');
    const d = await r.json();
    renderNoticias(d);
  } catch(e) {
    document.getElementById('news-loading').innerHTML = '<div class="err">⚠️ Error cargando noticias: ' + e.message + '</div>';
  }
}

// ══ Stock Analyzer ════════════════════════════════════════════
async function analyzeStock() {
  const raw = document.getElementById('an-ticker').value.trim();
  if (!raw) { document.getElementById('an-ticker').focus(); return; }
  const btn = document.getElementById('an-btn');
  btn.disabled = true; btn.textContent = '…';
  openAnalyzeModal('<div class="loading" style="padding:60px"><div class="spinner"></div>Buscando ' + raw.toUpperCase() + '…</div>');
  try {
    const r = await fetch('/api/analyze?ticker=' + encodeURIComponent(raw));
    const d = await r.json();
    if (d.error) { openAnalyzeModal('<div class="an-err">⚠️ ' + d.error + '<br><br><small>Prueba con formato EXCHANGE:TICKER (ej: BME:SAN, NASDAQ:AAPL)</small></div>'); }
    else          { openAnalyzeModal(renderAnalysis(d)); }
  } catch(e) {
    openAnalyzeModal('<div class="an-err">⚠️ Error de red: ' + e.message + '</div>');
  } finally {
    btn.disabled = false; btn.textContent = '🔍 Analizar';
  }
}

function openAnalyzeModal(html) {
  document.getElementById('an-box').innerHTML = html;
  document.getElementById('an-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAnalyzeModal() {
  document.getElementById('an-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAnalyzeModal(); });

function renderAnalysis(d) {
  // Signal color helpers
  function sigCss(sig) {
    if (sig==='STRONG BUY')  return {color:'var(--green)',  bg:'rgba(63,185,80,.12)',  fill:'var(--green)'};
    if (sig==='BUY')         return {color:'#60a5fa',       bg:'rgba(59,130,246,.10)', fill:'#60a5fa'};
    if (sig==='NEUTRAL')     return {color:'var(--muted)',  bg:'var(--bg4)',           fill:'var(--muted)'};
    if (sig==='SELL')        return {color:'var(--red)',    bg:'rgba(239,68,68,.10)', fill:'var(--red)'};
    return                          {color:'#f87171',       bg:'rgba(239,68,68,.18)', fill:'#f87171'};
  }
  function sigFill(rec) { return Math.min(Math.round(Math.abs(rec)*100), 97); }
  function sigEmoji(sig) {
    if (sig==='STRONG BUY')  return '💚';
    if (sig==='BUY')         return '🟢';
    if (sig==='NEUTRAL')     return '⚪';
    if (sig==='SELL')        return '🔴';
    return '🔴🔴';
  }

  const pChg  = d.change || 0;
  const chgCl = pChg >= 0 ? 'up' : 'dn';
  const chgSign = pChg > 0 ? '+' : '';

  // Price prefix — crude heuristic: if symbol contains no common US-only clue, show €
  const fmtPrice = p => {
    if (!p) return '—';
    return '$' + fmt(p);
  };

  // signals
  const s1 = sigCss(d.sig1d), s5 = sigCss(d.sig5m);
  const trendCl = d.trendEMA==='UPTREND' ? 'trend-up' : d.trendEMA==='DOWNTREND' ? 'trend-dn' : 'trend-nn';
  const trendTxt = d.trendEMA==='UPTREND' ? '📈 UPTREND' : d.trendEMA==='DOWNTREND' ? '📉 DOWNTREND' : '↔ LATERAL';

  // 52W range pct
  const lo = d.l52, hi = d.h52, cur = d.price;
  const pct52 = (hi > lo) ? ((cur - lo) / (hi - lo) * 100).toFixed(0) : 50;

  function sigCard(label, sig, rec, rsi, sub) {
    const c = sigCss(sig);
    return '<div class="an-sig-card" style="border-color:' + c.color + '33;background:' + c.bg + '">'
      + '<div class="an-sig-label">' + label + '</div>'
      + '<div class="an-sig-val" style="color:' + c.color + '">' + sigEmoji(sig) + ' ' + sig + '</div>'
      + '<div class="an-sig-sub">TV Score: ' + (rec > 0 ? '+' : '') + fmt(rec, 3) + (sub ? ' · ' + sub : '') + '</div>'
      + '<div class="an-sig-bar"><div class="an-sig-fill" style="width:' + sigFill(rec) + '%;background:' + c.fill + '"></div></div>'
      + '</div>';
  }

  function metric(label, val, color) {
    return '<div class="an-metric">'
      + '<div class="an-metric-l">' + label + '</div>'
      + '<div class="an-metric-v"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div>'
      + '</div>';
  }

  const rsiColor = d.rsi >= 70 ? 'var(--gold)' : d.rsi <= 30 ? 'var(--blue)' : 'var(--text)';
  const rsiLabel = d.rsi >= 70 ? ' OB' : d.rsi <= 30 ? ' OS' : '';
  const macdColor = d.macd > 0 ? 'var(--green)' : 'var(--red)';
  const bbWidthPct = d.bbu > 0 ? ((d.price - d.bbl) / (d.bbu - d.bbl) * 100).toFixed(0) : 50;

  const tvUrl = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(d.tvSym);
  const crossLabel = d.ema50 > d.ema200
    ? '<span style="color:var(--green)">Golden</span>'
    : '<span style="color:var(--red)">Death</span>';
  const maLabel = d.recMA > 0 ? 'var(--green)' : d.recMA < 0 ? 'var(--red)' : 'var(--muted)';
  const oscLabel = d.recOsc > 0 ? 'var(--green)' : d.recOsc < 0 ? 'var(--red)' : 'var(--muted)';
  const volStr = d.volume >= 1e6 ? (d.volume/1e6).toFixed(1)+'M'
               : d.volume >= 1e3 ? (d.volume/1e3).toFixed(0)+'K'
               : fmt(d.volume,0);
  const capStr = d.mktCap >= 1e12 ? '$'+(d.mktCap/1e12).toFixed(2)+'T'
               : d.mktCap >= 1e9  ? '$'+(d.mktCap/1e9).toFixed(0)+'B'
               : d.mktCap         ? '$'+(d.mktCap/1e6).toFixed(0)+'M' : '—';
  const offColor = d.offHigh >= 15 ? 'var(--green)' : 'var(--muted)';

  return '<div class="an-hdr">'
    + '<div>'
    + '<div class="an-sym">' + d.symbol + ' <span class="an-trend ' + trendCl + '">' + trendTxt + '</span></div>'
    + '<div class="an-name">' + (d.name||'—') + ' &nbsp;&middot;&nbsp; <span style="font-family:monospace;font-size:10px;color:#555">' + d.tvSym + '</span></div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div class="an-price-block"><div class="an-price">' + fmtPrice(d.price) + '</div>'
    + '<span class="an-chg ' + chgCl + '">' + arrow(pChg) + chgSign + fmt(pChg,2) + '%</span></div>'
    + '<button class="an-close" onclick="closeAnalyzeModal()" title="Cerrar">X</button>'
    + '</div></div>'
    + '<div class="an-body">'
    // signals row
    + '<div><div class="an-sec">Senales TradingView</div><div class="an-sig-row">'
    + sigCard('Senal 1D', d.sig1d, d.rec1d, d.rsi, 'RSI ' + fmt(d.rsi,1) + rsiLabel)
    + sigCard('Senal 5min', d.sig5m, d.rec5m, d.rsi5m, 'RSI5 ' + fmt(d.rsi5m,1))
    + '<div class="an-sig-card">'
    + '<div class="an-sig-label">Subscores 1D</div>'
    + '<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">'
    + '<div style="display:flex;justify-content:space-between;font-size:10px">'
    + '<span style="color:var(--muted)">Medias Moviles</span>'
    + '<span style="font-family:monospace;font-weight:700;color:' + maLabel + '">' + fmt(d.recMA,3) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px">'
    + '<span style="color:var(--muted)">Osciladores</span>'
    + '<span style="font-family:monospace;font-weight:700;color:' + oscLabel + '">' + fmt(d.recOsc,3) + '</span></div>'
    + '<div style="margin-top:4px;font-size:9px;color:#555">EMA50 vs EMA200: ' + crossLabel + ' Cross</div>'
    + '</div></div>'
    + '</div></div>'
    // technicals
    + '<div><div class="an-sec">Indicadores Tecnicos</div><div class="an-metrics">'
    + metric('RSI (1D)', fmt(d.rsi,1) + rsiLabel, rsiColor)
    + metric('RSI (5min)', fmt(d.rsi5m,1), d.rsi5m>=70?'var(--gold)':d.rsi5m<=30?'var(--blue)':'var(--text)')
    + metric('MACD', (d.macd>0?'+ ':'- ') + fmt(Math.abs(d.macd),4), macdColor)
    + metric('MACD Signal', fmt(d.macdSig,4), d.macdSig>0?'var(--green)':'var(--red)')
    + metric('EMA 50', '$'+fmt(d.ema50), d.price>d.ema50?'var(--green)':'var(--red)')
    + metric('EMA 200', '$'+fmt(d.ema200), d.price>d.ema200?'var(--green)':'var(--red)')
    + metric('VWAP', '$'+fmt(d.vwap), d.price>d.vwap?'var(--green)':'var(--red)')
    + metric('BB posicion', bbWidthPct+'%', Number(bbWidthPct)>75?'var(--red)':Number(bbWidthPct)<25?'var(--blue)':'var(--green)')
    + '</div></div>'
    // 52W range
    + '<div><div class="an-sec">Rango 52 Semanas &middot; ' + fmt(d.offHigh,1) + '% bajo maximo</div>'
    + '<div class="an-range">'
    + '<div class="an-range-bar"><div class="an-range-cur" style="left:' + pct52 + '%"></div></div>'
    + '<div class="an-range-labels">'
    + '<span>Min $' + fmt(d.l52) + '</span>'
    + '<span style="color:' + offColor + '">-' + fmt(d.offHigh,1) + '% del max</span>'
    + '<span>Max $' + fmt(d.h52) + '</span>'
    + '</div></div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<div class="an-metric" style="flex:1"><div class="an-metric-l">Dia Alto</div><div class="an-metric-v">$' + fmt(d.dayHigh) + '</div></div>'
    + '<div class="an-metric" style="flex:1"><div class="an-metric-l">Dia Bajo</div><div class="an-metric-v">$' + fmt(d.dayLow) + '</div></div>'
    + '<div class="an-metric" style="flex:1"><div class="an-metric-l">Volumen</div><div class="an-metric-v">' + volStr + '</div></div>'
    + '</div></div>'
    // fundamentals
    + '<div><div class="an-sec">Fundamentales</div><div class="an-metrics">'
    + metric('Mkt Cap', capStr)
    + metric('P/E (TTM)', d.pe ? fmt(d.pe,1)+'x' : '—')
    + metric('Div. Yield', d.divYield ? fmt(d.divYield*100,2)+'%' : '—', d.divYield>0?'var(--purple)':'')
    + metric('BB Upper', '$'+fmt(d.bbu))
    + metric('BB Lower', '$'+fmt(d.bbl))
    + metric('BB Basis', '$'+fmt(d.bbb))
    + '</div></div>'
    // TV link
    + '<div style="text-align:center;margin-top:4px">'
    + '<a href="' + tvUrl + '" target="_blank" style="display:inline-block;padding:9px 22px;background:var(--pqf3);border:1px solid var(--pqf);color:var(--pqf2);border-radius:8px;text-decoration:none;font-size:11px;font-weight:700;transition:.2s" onmouseover="this.style.background=\'var(--pqf)\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'var(--pqf3)\';this.style.color=\'var(--pqf2)\'">'
    + 'Ver en TradingView &rarr;</a></div>'
    + '<div class="an-ts">TradingView Scanner &middot; ' + d.timestamp + '</div>'
    + '</div>';
}

// ══ Pietro Auto Tab ═══════════════════════════════════════════
let pietroLoaded = false;

async function loadPietro() {
  const loadEl = document.getElementById('p-loading');
  const contEl = document.getElementById('p-content');
  if (loadEl) { loadEl.style.display = ''; loadEl.innerHTML = '<div class="spinner"></div>Analizando noticias y ejecutando screen…'; }
  if (contEl) contEl.style.display = 'none';
  try {
    const r = await fetch('/api/pietro');
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    renderPietroAuto(d);
    pietroLoaded = true;
  } catch(e) {
    if (loadEl) loadEl.innerHTML = '<div class="err">⚠️ ' + e.message + ' — El server puede estar generando los datos (primera carga ~10s), recarga en breve.</div>';
  }
}

function renderPietroAuto(d) {
  const loadEl = document.getElementById('p-loading');
  const contEl = document.getElementById('p-content');
  // Header meta
  document.getElementById('p-theme-badge').textContent = d.themeEmoji + ' ' + d.themeLabel;
  document.getElementById('p-dates').textContent = d.weekLabel;
  document.getElementById('p-update').textContent = '📅 Actualizado: ' + d.updatedAt + ' · Próximo: ' + d.nextUpdate;
  document.getElementById('p-source').textContent = 'Fuente: ' + (d.source||'TradingView Scanner');
  document.getElementById('p-universe-count').textContent = (d.universe||[]).length;
  document.getElementById('p-theme-label').textContent = d.themeLabel;
  document.getElementById('p-qt-note').textContent =
    'Tema "' + d.themeLabel + '" — detectado via RSS Expansion · Score/100 · ROE%=proxy ROIC · ' + d.updatedAt;
  document.getElementById('p-ts').textContent =
    '🟢 Live · TradingView Scanner · ' + d.timestamp + ' · Tema: ' + d.themeLabel;
  const topTkrs = (d.universe||[]).slice(0,3).map(s => s.ticker).join(' · ');
  if (topTkrs) document.getElementById('p-deep-title').textContent = '📋 Deep Thesis — Top 3 · ' + topTkrs;
  // Render sections
  renderPietroCards('p-growth-cards', d.growth || [], 'growth');
  renderPietroCards('p-value-cards',  d.value  || [], 'value');
  renderPietroTable(d.universe || []);
  renderPietroDeepCards(d.cards || []);
  // Show
  if (loadEl) loadEl.style.display = 'none';
  if (contEl) contEl.style.display = '';
}

function renderPietroCards(id, stocks, type) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!stocks || !stocks.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px">Sin datos para este tema — el screen no encontro stocks con Score suficiente.</div>';
    return;
  }
  el.innerHTML = stocks.map(s => {
    const pct = s.change || 0;
    const c   = pct >= 0 ? 'up' : 'dn';
    const sgn = pct > 0 ? '+' : '';
    const prStr = s.price ? '$' + fmt(s.price) : '—';
    const chStr = s.price ? ' <span class="' + c + '">' + arrow(pct) + sgn + fmt(pct,2) + '%</span>' : '';
    const sig   = s.rec ? recToSig(s.rec) : '';
    const sigCl = sig ? sigClass(sig) : '';
    const recH  = sig ? ' <span class="sig-badge ' + sigCl + '" style="font-size:9px;padding:1px 4px">' + sig + '</span>' : '';
    const scCol = s.score>=80?'#4ade80':s.score>=65?'#fbbf24':s.score>=50?'#94a3b8':'#f87171';
    return '<div class="wk-card wk-' + type + '">'
      + '<div class="wk-top">'
      + '<div><span class="wk-sym">' + s.ticker + '</span>' + recH + '</div>'
      + '<div class="wk-price-row">' + prStr + chStr
      + ' <span style="font-size:9px;font-weight:700;color:' + scCol + ';margin-left:4px">' + s.score + '/100</span></div>'
      + '</div>'
      + '<div class="wk-name">' + (s.name||'').substring(0,32) + '</div>'
      + '<div class="wk-why">💡 ' + (s.thesis||s.industry||'') + '</div>'
      + '</div>';
  }).join('');
}

function renderPietroTable(rows) {
  const tbody = document.getElementById('p-qtbody');
  if (!tbody || !rows.length) return;
  const fQ = (v, good) => {
    if (v <= -900) return '<span class="q-na">N/D</span>';
    return '<span class="' + (good(v) ? 'q-ok' : 'q-bad') + '">' + fmt(v,1) + '</span>';
  };
  const fND = v => {
    if (v <= -900) return '<span class="q-na">N/D</span>';
    if (v < 0) return '<span class="q-ok">caja</span>';
    return '<span class="' + (v<2?'q-ok':'q-bad') + '">' + fmt(v,1) + 'x</span>';
  };
  tbody.innerHTML = rows.map((s,i) => {
    const tr   = 'q-' + (s.tier||'watch').toLowerCase();
    const offH = s.offHigh>0
      ? '<span class="' + (s.offHigh>=15?'q-ok':'q-bad') + '">-' + fmt(s.offHigh,1) + '%</span>'
      : '<span class="q-na">—</span>';
    const peFl = s.passPE ? '<span class="q-ok">✓</span>' : '<span class="q-bad">✗</span>';
    const ps   = s.price ? ' <span style="font-size:9px;color:#888">$' + fmt(s.price) + '</span>' : '';
    const scCol = s.score>=80?'#4ade80':s.score>=65?'#fbbf24':s.score>=50?'#94a3b8':'#f87171';
    const fcfH  = s.fcf>0 ? '<span class="q-ok">+</span>' : s.fcf<0 ? '<span class="q-bad">−</span>' : '<span class="q-na">—</span>';
    return '<tr class="' + tr + '">'
      + '<td style="color:#555;font-size:9px">' + (i+1) + '</td>'
      + '<td><div class="q-sym">' + s.ticker + ps + '</div><div class="q-name">' + (s.name||'').substring(0,22) + '</div></td>'
      + '<td class="r">' + fQ(s.roe, v=>v>=15) + '</td>'
      + '<td class="r">' + fcfH + '</td>'
      + '<td class="r">' + fND(s.ndEB) + '</td>'
      + '<td class="r">' + fQ(s.revGrowth, v=>v>0) + ' ' + peFl + '</td>'
      + '<td class="r">' + offH + '</td>'
      + '<td class="r q-score" style="color:' + scCol + '">' + s.score + '</td>'
      + '<td><span class="q-tier ' + (s.tier||'AVOID') + '">' + (s.tier||'?') + '</span></td>'
      + '<td class="q-thesis">' + (s.thesis||'').substring(0,80) + '</td>'
      + '</tr>';
  }).join('');
}

function renderPietroDeepCards(cards) {
  const el = document.getElementById('p-deep-cards');
  if (!el) return;
  if (!cards || !cards.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px">Sin datos de thesis — se necesitan al menos 3 stocks en el universo.</div>';
    return;
  }
  function blk(icon, lbl, cls, s) {
    if (!s) return '';
    return '<div class="deep-block">'
      + '<div class="deep-block-lbl ' + cls + '">' + icon + ' ' + lbl + '</div>'
      + '<div class="deep-block-body">' + s.content + '</div>'
      + (s.source ? '<div class="deep-src">📎 ' + s.source + '</div>' : '')
      + '</div>';
  }
  el.innerHTML = cards.map(c =>
    '<div class="deep-card">'
    + '<div class="deep-card-hdr">'
    + '<div><div class="deep-sym-lg">' + c.symbol + '</div><div class="deep-name-sm">' + (c.name||'') + '</div></div>'
    + '<div class="deep-score-badge">' + c.score + '/100 &nbsp;<span class="q-tier ' + c.tier + '" style="font-size:8px">' + c.tier + '</span></div>'
    + '</div>'
    + blk('🏰','EL MOAT','lbl-moat', c.moat)
    + blk('📉','EL DRAWDOWN','lbl-draw', c.draw)
    + blk('⚡','EL CATALIZADOR','lbl-cat', c.cat)
    + blk('🚪','LA SALIDA','lbl-exit', c.exit)
    + '</div>'
  ).join('');
}

// ══ Init ═════════════════════════════════════════════════════
setLang(currentLang);
renderMovers();
renderContext();
loadGlobal();
loadWeekly();
let _refreshTick = 0;
setInterval(() => {
  loadGlobal(); loadWeekly();
  if (ibexLoaded) loadIbex();
  _refreshTick++;
  if (noticiasLoaded && _refreshTick % 5 === 0) loadNoticias(); // refresh news every ~5 min
  if (pietroLoaded && _refreshTick % 60 === 0) loadPietro();   // refresh Pietro every ~60 min
}, 60000);
</script>
</body>
</html>`
