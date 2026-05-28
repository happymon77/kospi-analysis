const KRW = new Intl.NumberFormat("ko-KR");

// 소수점 끝자리 0 제거. "8.00" -> "8", "8.50" -> "8.5", "8.51" -> "8.51"
const trimZero = (s) => (/\./.test(s) ? s.replace(/0+$/, "").replace(/\.$/, "") : s);

const fmtBigKRW = (v) => {
  // 입력 단위: 백만원
  if (v == null) return "—";
  const won = v * 1_000_000;
  if (won >= 1e12) return trimZero((won / 1e12).toFixed(2)) + "조";
  if (won >= 1e8)  return trimZero((won / 1e8).toFixed(1)) + "억";
  return KRW.format(Math.round(won));
};
const fmtIndex = (v) => (v == null ? "—" : trimZero(v.toFixed(2)));
const fmtPct   = (v) => (v == null ? "—" : trimZero(v.toFixed(2)) + "%");
// 입력 단위: 억원
const fmtEok = (v) => {
  if (v == null) return "—";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 10000) return sign + trimZero((a / 10000).toFixed(2)) + "조";
  return sign + KRW.format(Math.round(a)) + "억";
};

const pctDelta = (cur, prev) => {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
};
const arrow = (d) => {
  if (d == null) return { sym: "—", cls: "flat" };
  if (d > 0)     return { sym: "▲ " + trimZero(d.toFixed(2)) + "%", cls: "up" };
  if (d < 0)     return { sym: "▼ " + trimZero(Math.abs(d).toFixed(2)) + "%", cls: "down" };
  return { sym: "0%", cls: "flat" };
};

function makeChart(canvasId, labels, data, color, yFmt) {
  const ctx = document.getElementById(canvasId);
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => (yFmt ? yFmt(ctx.parsed.y) : ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            callback: function (val, idx) {
              const total = this.chart.data.labels.length;
              const step = Math.max(1, Math.floor(total / 6));
              // 첫날, 마지막날 반드시 표시 + 중간 간격
              if (idx === 0 || idx === total - 1 || idx % step === 0) {
                return this.chart.data.labels[idx];
              }
              return "";
            },
            maxRotation: 0,
            minRotation: 0,
          },
          grid: { display: false },
        },
        y: {
          ticks: { callback: (v) => (yFmt ? yFmt(v) : v) },
          grid: { color: "#f1f5f9" },
        },
      },
    },
  });
}

async function init() {
  const res = await fetch("assets/data.json");
  const j = await res.json();
  const rows = j.rows;
  const labels = rows.map((r) => r.date.slice(5)); // MM-DD

  document.getElementById("period").textContent =
    `${j.range.start} ~ ${j.range.end} (${rows.length} 거래일)`;
  document.getElementById("updated").textContent =
    `최종 데이터: ${j.range.end}`;

  // FreeSIS는 지표마다 발행 시점이 달라 가장 최근 행에 일부 필드가 null일 수 있음.
  // KPI 카드는 각 지표의 마지막 두 non-null 값을 사용해 항상 의미있는 수치를 표시.
  const lastTwo = (key) => {
    const out = [];
    for (let i = rows.length - 1; i >= 0 && out.length < 2; i--) {
      if (rows[i][key] != null) out.push(rows[i][key]);
    }
    return { last: out[0] ?? null, prev: out[1] ?? null };
  };
  const kpi = (key, fmt, label) => {
    const { last, prev } = lastTwo(key);
    return { label, val: fmt(last), delta: pctDelta(last, prev) };
  };

  const cards = [
    kpi("KOSPI지수",   fmtIndex,  "KOSPI 지수"),
    kpi("투자자예탁금", fmtBigKRW, "고객예탁금"),
    kpi("거래대금",    fmtBigKRW, "거래대금"),
    kpi("신용잔고",    fmtBigKRW, "신용잔고"),
    kpi("대차잔고",    fmtBigKRW, "대차잔고"),
  ];

  const kpiHtml = cards.map((c) => {
    const a = arrow(c.delta);
    return `
      <div class="kpi bg-white rounded-2xl shadow-sm p-4">
        <div class="text-xs text-slate-500">${c.label}</div>
        <div class="text-2xl font-bold mt-1">${c.val}</div>
        <div class="text-xs mt-1 ${a.cls}">${a.sym} <span class="text-slate-400">(전일대비)</span></div>
      </div>`;
  }).join("");
  document.getElementById("kpis").innerHTML = kpiHtml;

  // 상관관계 차트들
  buildCorrelation(rows);
  buildKospiCorr(rows);

  makeChart("ch_kospi",        labels, rows.map((r) => r["KOSPI지수"]),       "#0ea5e9", fmtIndex);
  makeChart("ch_deposit",      labels, rows.map((r) => r["투자자예탁금"]),    "#10b981", fmtBigKRW);
  makeChart("ch_value",        labels, rows.map((r) => r["거래대금"]),        "#f59e0b", fmtBigKRW);
  makeChart("ch_credit",       labels, rows.map((r) => r["신용잔고"]),        "#ef4444", fmtBigKRW);
  makeChart("ch_lending",      labels, rows.map((r) => r["대차잔고"]),        "#8b5cf6", fmtBigKRW);
  makeChart("ch_deriv",        labels, rows.map((r) => r["파생예수금"]),      "#14b8a6", fmtBigKRW);
  makeChart("ch_rp",           labels, rows.map((r) => r["RP매도잔고"]),      "#6366f1", fmtBigKRW);
  makeChart("ch_collateral",   labels, rows.map((r) => r["증권담보융자"]),    "#94a3b8", fmtBigKRW);
  makeChart("ch_credit_ratio", labels, rows.map((r) => r["신용_시총비율_pct"]), "#dc2626", fmtPct);
  makeChart("ch_foreign_net",  labels, rows.map((r) => r["외국인_순매수_억"]),  "#0891b2", fmtEok);
  makeChart("ch_foreign",      labels, rows.map((r) => r["외국인_비중_pct"]),   "#0891b2", fmtPct);

  buildFiveFactorAnalysis(rows);
}

// === 예탁금 vs 거래대금 ===
let dualChart = null;
let ratioChart = null;
let corrRows = null;

function shiftSeries(value, lag) {
  if (lag <= 0) return value.slice();
  return [...Array(lag).fill(null), ...value.slice(0, -lag)];
}

function computeRatio(deposit, valueShifted) {
  return valueShifted.map((v, i) => {
    const d = deposit[i];
    if (v == null || d == null || d === 0) return null;
    return (v / d) * 100;
  });
}

function updateLag(lag) {
  if (!dualChart || !ratioChart || !corrRows) return;
  const deposit = corrRows.map((r) => r["투자자예탁금"]);
  const value   = corrRows.map((r) => r["거래대금"]);
  const shifted = shiftSeries(value, lag);
  const ratio   = computeRatio(deposit, shifted);

  // 이중축
  dualChart.data.datasets[1].data = shifted;
  dualChart.data.datasets[1].label = `거래대금 (D+${lag})`;
  dualChart.options.scales.y2.title.text = `거래대금 (D+${lag})`;
  dualChart.update();

  // ratio
  ratioChart.data.datasets[0].data = ratio;
  ratioChart.data.datasets[0].label = `거래대금(D+${lag}) / 예탁금 (%)`;
  ratioChart.update();

  document.getElementById("dual_title").textContent =
    `이중축 시계열 (예탁금 vs 거래대금 · D+${lag})`;
  document.getElementById("ratio_title").textContent =
    `거래대금(D+${lag}) / 예탁금 (%) — 자금 회전율`;

  document.querySelectorAll(".lag-btn").forEach((b) => {
    b.classList.toggle("active", parseInt(b.dataset.lag, 10) === lag);
  });
}

function buildCorrelation(rows) {
  corrRows = rows;
  const labels = rows.map((r) => r.date.slice(5));
  const deposit = rows.map((r) => r["투자자예탁금"]);
  const value   = rows.map((r) => r["거래대금"]);

  const initialLag = 2;
  const valueShifted = shiftSeries(value, initialLag);
  const ratio = computeRatio(deposit, valueShifted);

  // 이중축 라인
  dualChart = new Chart(document.getElementById("ch_dual"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "예탁금",
          data: deposit,
          borderColor: "#10b981",
          backgroundColor: "#10b98120",
          borderWidth: 2, pointRadius: 0, tension: 0.2, yAxisID: "y",
        },
        {
          label: `거래대금 (D+${initialLag})`,
          data: valueShifted,
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderWidth: 2, pointRadius: 0, tension: 0.2, yAxisID: "y2",
          borderDash: [4, 3],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtBigKRW(c.parsed.y)}` } },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            callback: function (val, idx) {
              const total = this.chart.data.labels.length;
              const step = Math.max(1, Math.floor(total / 6));
              if (idx === 0 || idx === total - 1 || idx % step === 0) return this.chart.data.labels[idx];
              return "";
            },
            maxRotation: 0, minRotation: 0,
          },
          grid: { display: false },
        },
        y:  { position: "left",  ticks: { callback: fmtBigKRW }, grid: { color: "#f1f5f9" }, title: { display: true, text: "예탁금" } },
        y2: { position: "right", ticks: { callback: fmtBigKRW }, grid: { display: false },   title: { display: true, text: `거래대금 (D+${initialLag})` } },
      },
    },
  });

  // ratio 차트
  ratioChart = new Chart(document.getElementById("ch_ratio"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `거래대금(D+${initialLag}) / 예탁금 (%)`,
        data: ratio,
        borderColor: "#a855f7",
        backgroundColor: "#a855f720",
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
        tension: 0.2, fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.parsed.y == null ? "—" : c.parsed.y.toFixed(2) + "%" } },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            callback: function (val, idx) {
              const total = this.chart.data.labels.length;
              const step = Math.max(1, Math.floor(total / 6));
              if (idx === 0 || idx === total - 1 || idx % step === 0) return this.chart.data.labels[idx];
              return "";
            },
            maxRotation: 0, minRotation: 0,
          },
          grid: { display: false },
        },
        y: { ticks: { callback: (v) => trimZero(Number(v).toFixed(2)) + "%" }, grid: { color: "#f1f5f9" } },
      },
    },
  });

  // 초기 제목/active 동기화
  document.getElementById("dual_title").textContent =
    `이중축 시계열 (예탁금 vs 거래대금 · D+${initialLag})`;
  document.getElementById("ratio_title").textContent =
    `거래대금(D+${initialLag}) / 예탁금 (%) — 자금 회전율`;
  document.querySelectorAll(".lag-btn").forEach((b) => {
    b.classList.toggle("active", parseInt(b.dataset.lag, 10) === initialLag);
    b.addEventListener("click", () => updateLag(parseInt(b.dataset.lag, 10)));
  });
}

// === KOSPI ↔ 예탁금 상관관계 (구간별) ===
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx  += (xs[i] - mx) ** 2;
    dy  += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

function diffSeries(arr) {
  const out = [];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}

function rollingPearson(xs, ys, win) {
  const out = new Array(xs.length).fill(null);
  for (let i = win - 1; i < xs.length; i++) {
    out[i] = pearson(xs.slice(i - win + 1, i + 1), ys.slice(i - win + 1, i + 1));
  }
  return out;
}

const PHASES = [
  { name: "전체",     start: "2026-01-02", end: "2026-05-26",
    meaning: "추세만 같이 우상향, 일별 변화는 거의 무관" },
  { name: "1차 상승", start: "2026-01-02", end: "2026-02-27",
    meaning: "지수 오른 날엔 예탁금 빠짐 — 매수 결제로 자금 유출" },
  { name: "조정",     start: "2026-03-02", end: "2026-03-31",
    meaning: "지수 하락 시 예탁금 증가 — 대기성 자금화 (전형적 조정장)" },
  { name: "2차 상승", start: "2026-04-01", end: "2026-05-26",
    meaning: "r·Δr 둘 다 양수 — 신규 자금 유입이 지수 견인" },
];

function rClass(r) {
  if (r == null) return "text-slate-400";
  const a = Math.abs(r);
  if (r < 0) return "font-bold text-blue-600";
  if (a >= 0.7) return "font-bold text-red-600";
  if (a >= 0.4) return "text-orange-600";
  return "text-slate-500";
}

const fmtR = (v) => (v == null ? "—" : v.toFixed(3));

function buildKospiCorr(rows) {
  // 구간 표
  const tbody = document.getElementById("phase_tbody");
  tbody.innerHTML = PHASES.map((ph) => {
    const subset = rows.filter((r) => r.date >= ph.start && r.date <= ph.end);
    const xs = subset.map((r) => r["KOSPI지수"]);
    const ys = subset.map((r) => r["투자자예탁금"]);
    const r = pearson(xs, ys);
    const dr = pearson(diffSeries(xs), diffSeries(ys));
    return `<tr>
      <td class="border px-3 py-2 font-medium">${ph.name}</td>
      <td class="border px-3 py-2 text-xs text-slate-500">${ph.start.slice(5)} ~ ${ph.end.slice(5)}</td>
      <td class="border px-3 py-2 text-right ${rClass(r)}">${fmtR(r)}</td>
      <td class="border px-3 py-2 text-right ${rClass(dr)}">${fmtR(dr)}</td>
      <td class="border px-3 py-2 text-right text-slate-500">${subset.length}</td>
      <td class="border px-3 py-2 text-xs text-slate-600">${ph.meaning}</td>
    </tr>`;
  }).join("");

  // 30일 롤링 r 차트
  const labels = rows.map((r) => r.date.slice(5));
  const xs = rows.map((r) => r["KOSPI지수"]);
  const ys = rows.map((r) => r["투자자예탁금"]);
  const rollR  = rollingPearson(xs, ys, 30);

  // Δr: 차분된 배열은 길이 N-1이므로 앞에 null 한 칸 패딩
  const dxs = diffSeries(xs);
  const dys = diffSeries(ys);
  const rollDr = [null, ...rollingPearson(dxs, dys, 30)];

  new Chart(document.getElementById("ch_rolling"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "r (원본)",
          data: rollR,
          borderColor: "#0ea5e9",
          backgroundColor: "#0ea5e920",
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          tension: 0.2, fill: false,
        },
        {
          label: "Δr (일별 변화량)",
          data: rollDr,
          borderColor: "#a855f7",
          backgroundColor: "transparent",
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          tension: 0.2, fill: false,
          borderDash: [4, 3],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtR(c.parsed.y)}` } },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            callback: function (val, idx) {
              const total = this.chart.data.labels.length;
              const step = Math.max(1, Math.floor(total / 6));
              if (idx === 0 || idx === total - 1 || idx % step === 0) return this.chart.data.labels[idx];
              return "";
            },
            maxRotation: 0, minRotation: 0,
          },
          grid: { display: false },
        },
        y: {
          min: -1, max: 1,
          ticks: { callback: (v) => trimZero(Number(v).toFixed(2)) },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? "#94a3b8" : "#f1f5f9"),
            lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1),
          },
        },
      },
    },
  });
}

// === 5대 자금/신용 지표 × KOSPI 통합 분석 ===
const FIVE_ITEMS = [
  { label: "예탁금",       col: "투자자예탁금" },
  { label: "파생예수금",   col: "파생예수금" },
  { label: "RP매도잔고",   col: "RP매도잔고" },
  { label: "신용거래융자", col: "신용잔고" },
  { label: "증권담보융자", col: "증권담보융자" },
];

function pearsonPaired(xs, ys) {
  const a = [], b = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i], y = ys[i];
    if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) continue;
    a.push(x); b.push(y);
  }
  return pearson(a, b);
}

function miniLineSvg(values, w = 80, h = 24, color = "#0ea5e9") {
  const vals = values.filter((v) => v != null && !Number.isNaN(v));
  if (vals.length < 2) return "";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return `<svg width="${w}" height="${h}" class="inline-block ml-2 align-middle" style="overflow:visible">
    <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function buildFiveFactorAnalysis(rows) {
  // === 표 A. 정적 r (전체 + 4구간) ===
  const staticTbody = document.getElementById("five_static_tbody");
  const PHASE_COLORS = {
    "전체":     "#475569",
    "1차 상승": "#10b981",
    "조정":     "#ef4444",
    "2차 상승": "#0ea5e9",
  };
  const staticRows = [];
  PHASES.forEach((ph) => {
    const subset = rows.filter((r) => r.date >= ph.start && r.date <= ph.end);
    const sxs = subset.map((r) => r["KOSPI지수"]);
    const sdxs = diffSeries(sxs);
    const rCells = [], drCells = [];
    FIVE_ITEMS.forEach((it) => {
      const ys = subset.map((r) => r[it.col]);
      const dys = diffSeries(ys);
      rCells.push(pearsonPaired(sxs, ys));
      drCells.push(pearsonPaired(sdxs, dys));
    });
    const period = `${ph.start.slice(5)} ~ ${ph.end.slice(5)}`;
    const spark = miniLineSvg(sxs, 80, 24, PHASE_COLORS[ph.name] || "#0ea5e9");
    staticRows.push(`
      <tr>
        <td class="border px-3 py-2 font-medium align-middle" rowspan="2">
          <div class="flex items-center gap-2">
            <div>
              ${ph.name}
              <div class="text-xs font-normal text-slate-500">${period}</div>
            </div>
            ${spark}
          </div>
        </td>
        <td class="border px-3 py-2 text-xs text-slate-500">r</td>
        ${rCells.map((v) => `<td class="border px-3 py-2 text-right ${rClass(v)}">${fmtR(v)}</td>`).join("")}
      </tr>
      <tr>
        <td class="border px-3 py-2 text-xs text-slate-500">Δr</td>
        ${drCells.map((v) => `<td class="border px-3 py-2 text-right ${rClass(v)}">${fmtR(v)}</td>`).join("")}
      </tr>
    `);
  });
  staticTbody.innerHTML = staticRows.join("");
}

init().catch((e) => {
  document.body.innerHTML = `<div class="p-8 text-red-600">로드 실패: ${e}</div>`;
});
