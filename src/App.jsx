import { useState, useMemo, useCallback } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
function parseNums(s) {
  const a = String(s).split(/[,\s\n]+/).map(x => parseFloat(x.trim())).filter(x => !isNaN(x));
  if (a.length < 2) throw new Error("Enter at least 2 numbers");
  return a;
}
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const y = 1 - p * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normalCDF(z) { return (1 + erf(z / Math.sqrt(2))) / 2; }

// ── calculator definitions ───────────────────────────────────────────────────
const CALCS = [
  // ── DESCRIPTIVE STATISTICS ──
  {
    id: "descriptive", cat: "Descriptive Statistics", name: "Descriptive Statistics",
    formula: "Mean = Σx/n   |   SD = √[Σ(x−x̄)²/(n−1)]   |   SEM = SD/√n   |   CV = (SD/Mean)×100",
    fields: [{ id: "data", label: "Dataset (comma or space separated)", type: "text", ph: "23, 25, 28, 30, 32, 35" }],
    calc(v) {
      const n = parseNums(v.data); n.sort((a, b) => a - b);
      const len = n.length, sum = n.reduce((s, x) => s + x, 0), mean = sum / len;
      const variance = n.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (len - 1);
      const sd = Math.sqrt(variance), sem = sd / Math.sqrt(len), cv = Math.abs(mean) > 0 ? (sd / Math.abs(mean)) * 100 : 0;
      const med = len % 2 === 0 ? (n[len / 2 - 1] + n[len / 2]) / 2 : n[Math.floor(len / 2)];
      const q1 = n[Math.ceil(len * 0.25) - 1] || n[0], q3 = n[Math.ceil(len * 0.75) - 1] || n[len - 1];
      const freq = {}; n.forEach(x => { const k = x.toFixed(2); freq[k] = (freq[k] || 0) + 1; });
      const maxF = Math.max(...Object.values(freq));
      const modes = Object.keys(freq).filter(k => freq[k] === maxF).map(Number);
      return { len, sum: +sum.toFixed(2), mean: +mean.toFixed(3), median: +med.toFixed(3), mode: modes.length === len ? "No mode" : modes.slice(0, 3).join(", "), sd: +sd.toFixed(3), variance: +variance.toFixed(3), sem: +sem.toFixed(3), cv: +cv.toFixed(1), min: n[0], max: n[len - 1], range: +(n[len - 1] - n[0]).toFixed(3), q1, q3, iqr: +(q3 - q1).toFixed(3) };
    },
    steps: (v, r) => [`n = ${r.len}   |   Σx = ${r.sum}   |   Mean = ${r.sum}/${r.len} = ${r.mean}`, `Variance = Σ(x−x̄)²/(n−1) = ${r.variance}   |   SD = √${r.variance} = ${r.sd}`, `SEM = SD/√n = ${r.sd}/√${r.len} = ${r.sem}`, `CV = (${r.sd}/${r.mean})×100 = ${r.cv}%`, `Median = ${r.median}   |   Mode = ${r.mode}`, `Q1 = ${r.q1}   |   Q3 = ${r.q3}   |   IQR = ${r.iqr}   |   Range = ${r.range}`],
    resultRows: r => [["n", r.len], ["Sum", r.sum], ["Mean", r.mean], ["Median", r.median], ["Mode", r.mode], ["SD", r.sd], ["Variance", r.variance], ["SEM", r.sem], ["CV%", r.cv + "%"], ["Min", r.min], ["Max", r.max], ["Range", r.range], ["Q1", r.q1], ["Q3", r.q3], ["IQR", r.iqr]],
  },
  {
    id: "zscore", cat: "Descriptive Statistics", name: "Z-Score & Percentile",
    formula: "Z = (X − μ) / σ   |   Percentile from standard normal CDF",
    fields: [{ id: "x", label: "Observed Value (X)", type: "number", ph: "75" }, { id: "mu", label: "Mean (μ)", type: "number", ph: "70" }, { id: "sigma", label: "SD (σ)", type: "number", ph: "10", min: 0.001 }],
    calc(v) { const z = (+v.x - +v.mu) / +v.sigma; const pct = normalCDF(z) * 100; return { z: +z.toFixed(4), pct: +pct.toFixed(2), above: +(100 - pct).toFixed(2) }; },
    steps: (v, r) => [`Z = (${v.x} − ${v.mu}) / ${v.sigma} = ${r.z}`, `P(X ≤ ${v.x}) = ${r.pct}%`, `P(X > ${v.x}) = ${r.above}%`, `Interpretation: ${Math.abs(r.z) <= 1 ? "Within ±1 SD (68.27% range)" : Math.abs(r.z) <= 2 ? "Within ±2 SD (95.45% range)" : "Beyond ±2 SD (<4.55%)"}`],
    resultRows: r => [["Z-Score", r.z], ["Percentile (below)", r.pct + "%"], ["Above this value", r.above + "%"]],
  },
  {
    id: "pct_change", cat: "Descriptive Statistics", name: "Percentage & Ratio",
    formula: "% Change = [(New − Old) / Old] × 100   |   Ratio = A / B   |   Proportion = x/n × 100",
    fields: [{ id: "old", label: "Old / Reference Value (A)", type: "number", ph: "100" }, { id: "new_v", label: "New / Comparison Value (B)", type: "number", ph: "125" }],
    calc(v) {
      const a = +v.old, b = +v.new_v;
      if (a === 0) throw new Error("Reference value cannot be 0");
      const ch = ((b - a) / a) * 100, ratio = b / a, prop = (b / (a + b)) * 100;
      return { change: +ch.toFixed(2), ratio: +ratio.toFixed(4), prop: +prop.toFixed(2), diff: +(b - a).toFixed(4) };
    },
    steps: (v, r) => [`Difference = ${v.new_v} − ${v.old} = ${r.diff}`, `% Change = (${r.diff} / ${v.old}) × 100 = ${r.change}%`, `Ratio = ${v.new_v} / ${v.old} = ${r.ratio}`, `Proportion of B in (A+B) = ${r.prop}%`],
    resultRows: r => [["% Change", r.change + "%"], ["Direction", r.change >= 0 ? "Increase ▲" : "Decrease ▼"], ["Ratio (B/A)", r.ratio], ["Proportion of B", r.prop + "%"]],
  },

  // ── INFERENTIAL STATISTICS ──
  {
    id: "ci", cat: "Inferential Statistics", name: "Confidence Interval",
    formula: "For mean: CI = x̄ ± Z × (SD/√n)   |   For proportion: CI = p ± Z × √(pq/n)",
    fields: [{ id: "val", label: "Mean or Proportion (if proportion use 0–1)", type: "number", ph: "0.35" }, { id: "sd", label: "SD (enter 0 if proportion)", type: "number", ph: "0", min: 0 }, { id: "n", label: "Sample Size (n)", type: "number", ph: "100", min: 1 }, { id: "conf", label: "Confidence Level %", type: "number", ph: "95", min: 80, max: 99.9 }],
    calc(v) {
      const zMap = { 90: 1.645, 95: 1.96, 99: 2.576 }; const z = zMap[Math.round(+v.conf)] || 1.96;
      const n = +v.n, val = +v.val, sd = +v.sd;
      if (sd === 0) {
        const p = val; if (p < 0 || p > 1) throw new Error("Proportion must be 0–1");
        const se = Math.sqrt((p * (1 - p)) / n), lo = Math.max(0, p - z * se), hi = Math.min(1, p + z * se);
        return { val: +(p * 100).toFixed(2) + "%", lo: +(lo * 100).toFixed(2) + "%", hi: +(hi * 100).toFixed(2) + "%", se: +(se * 100).toFixed(3) + "%", z, margin: +(z * se * 100).toFixed(2) + "%" };
      }
      const se = sd / Math.sqrt(n);
      return { val: +val.toFixed(3), lo: +(val - z * se).toFixed(3), hi: +(val + z * se).toFixed(3), se: +se.toFixed(4), z, margin: +(z * se).toFixed(4) };
    },
    steps: (v, r) => [`Z = ${r.z} for ${v.conf}% CI`, `SE = ${r.se}   |   Margin of error = Z × SE = ${r.margin}`, `${v.conf}% CI: (${r.lo}, ${r.hi})`],
    resultRows: r => [["Estimate", r.val], ["Standard Error", r.se], ["Margin of Error (±)", r.margin], ["Lower Limit", r.lo], ["Upper Limit", r.hi], ["Z used", r.z]],
  },
  {
    id: "ttest", cat: "Inferential Statistics", name: "One-Sample T-Test",
    formula: "t = (x̄ − μ₀) / (s / √n)   |   df = n − 1",
    fields: [{ id: "xbar", label: "Sample Mean (x̄)", type: "number", ph: "52.4" }, { id: "mu", label: "Hypothesized Mean (μ₀)", type: "number", ph: "50" }, { id: "sd", label: "Sample SD (s)", type: "number", ph: "8.5", min: 0.001 }, { id: "n", label: "Sample Size (n)", type: "number", ph: "30", min: 2 }],
    calc(v) {
      const x = +v.xbar, mu = +v.mu, sd = +v.sd, n = +v.n;
      const se = sd / Math.sqrt(n), t = (x - mu) / se, df = n - 1;
      const p = Math.abs(t) > 3.5 ? "<0.001" : Math.abs(t) > 2.9 ? "<0.01" : Math.abs(t) > 2.0 ? "<0.05" : ">0.05 (NS)";
      return { t: +t.toFixed(4), df, se: +se.toFixed(4), p, sig: Math.abs(t) > 2.0, ci_lo: +(x - 1.96 * se).toFixed(3), ci_hi: +(x + 1.96 * se).toFixed(3) };
    },
    steps: (v, r) => [`SE = ${v.sd}/√${v.n} = ${r.se}`, `t = (${v.xbar} − ${v.mu}) / ${r.se} = ${r.t}`, `df = ${v.n} − 1 = ${r.df}`, `p ${r.p} → ${r.sig ? "Significant (reject H₀)" : "Not significant (fail to reject H₀)"}`, `95% CI: (${r.ci_lo}, ${r.ci_hi})`],
    resultRows: r => [["t statistic", r.t], ["Degrees of freedom", r.df], ["SE", r.se], ["p-value", r.p], ["Decision", r.sig ? "Significant ✓" : "Not significant"], ["95% CI Lower", r.ci_lo], ["95% CI Upper", r.ci_hi]],
  },
  {
    id: "chisq", cat: "Inferential Statistics", name: "Chi-Square Test (2×2)",
    formula: "χ² = Σ(O − E)² / E   |   E = (Row total × Col total) / Grand total   |   df = (r−1)(c−1)",
    fields: [{ id: "a", label: "A — Exposed+ Disease+", type: "number", ph: "40", min: 0 }, { id: "b", label: "B — Exposed+ Disease−", type: "number", ph: "60", min: 0 }, { id: "c", label: "C — Exposed− Disease+", type: "number", ph: "20", min: 0 }, { id: "d", label: "D — Exposed− Disease−", type: "number", ph: "80", min: 0 }],
    calc(v) {
      const a = +v.a, b = +v.b, c = +v.c, d = +v.d, N = a + b + c + d;
      const r1 = a + b, r2 = c + d, c1 = a + c, c2 = b + d;
      const eA = (r1 * c1) / N, eB = (r1 * c2) / N, eC = (r2 * c1) / N, eD = (r2 * c2) / N;
      const chi2 = Math.pow(a - eA, 2) / eA + Math.pow(b - eB, 2) / eB + Math.pow(c - eC, 2) / eC + Math.pow(d - eD, 2) / eD;
      const chi2y = N > 40 ? chi2 : Math.pow(Math.abs(N * (a * d - b * c)) - N / 2, 2) / (r1 * r2 * c1 * c2);
      const p = chi2y > 10.83 ? "<0.001" : chi2y > 6.63 ? "<0.01" : chi2y > 3.84 ? "<0.05" : ">0.05 (NS)";
      const rr = (a / r1) / (c / r2), or = (a * d) / (b * c);
      return { chi2: +chi2.toFixed(4), chi2y: +chi2y.toFixed(4), p, sig: chi2y > 3.84, rr: +rr.toFixed(4), or: +or.toFixed(4), N, eA: +eA.toFixed(2), eB: +eB.toFixed(2), eC: +eC.toFixed(2), eD: +eD.toFixed(2) };
    },
    steps: (v, r) => [`N = ${r.N}   |   Expected: eA=${r.eA}, eB=${r.eB}, eC=${r.eC}, eD=${r.eD}`, `χ² = Σ(O−E)²/E = ${r.chi2}`, `Yates corrected χ² = ${r.chi2y}   |   df = 1`, `p ${r.p} → ${r.sig ? "Significant association" : "No significant association"}`, `RR = ${r.rr}   |   OR = ${r.or}`],
    resultRows: r => [["χ² (uncorrected)", r.chi2], ["χ² (Yates corrected)", r.chi2y], ["p-value", r.p], ["Significant?", r.sig ? "Yes ✓" : "No"], ["Relative Risk (RR)", r.rr], ["Odds Ratio (OR)", r.or]],
  },
  {
    id: "pearson", cat: "Inferential Statistics", name: "Pearson Correlation (r)",
    formula: "r = Σ[(x−x̄)(y−ȳ)] / √[Σ(x−x̄)² × Σ(y−ȳ)²]   |   r² = variance explained",
    fields: [{ id: "x", label: "X values (comma-separated)", type: "text", ph: "10, 20, 30, 40, 50" }, { id: "y", label: "Y values (comma-separated)", type: "text", ph: "12, 22, 28, 41, 53" }],
    calc(v) {
      const xA = parseNums(v.x), yA = parseNums(v.y);
      if (xA.length !== yA.length) throw new Error(`X has ${xA.length} values but Y has ${yA.length}`);
      const n = xA.length, mx = xA.reduce((s, x) => s + x, 0) / n, my = yA.reduce((s, y) => s + y, 0) / n;
      const num = xA.reduce((s, x, i) => s + (x - mx) * (yA[i] - my), 0);
      const den = Math.sqrt(xA.reduce((s, x) => s + Math.pow(x - mx, 2), 0) * yA.reduce((s, y) => s + Math.pow(y - my, 2), 0));
      const r = num / den, r2 = r * r, t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r2);
      const p = Math.abs(t) > 3.5 ? "<0.001" : Math.abs(t) > 2.9 ? "<0.01" : Math.abs(t) > 2.0 ? "<0.05" : ">0.05 (NS)";
      return { r: +r.toFixed(4), r2: +r2.toFixed(4), t: +t.toFixed(3), p, n, mx: +mx.toFixed(2), my: +my.toFixed(2) };
    },
    steps: (v, r) => [`n = ${r.n} pairs   |   x̄ = ${r.mx}   |   ȳ = ${r.my}`, `r = ${r.r}   |   r² = ${r.r2} (${(r.r2 * 100).toFixed(1)}% variance explained)`, `t = r√(n−2)/√(1−r²) = ${r.t}   |   p ${r.p}`, `Strength: ${Math.abs(r.r) > 0.8 ? "Strong" : Math.abs(r.r) > 0.5 ? "Moderate" : "Weak"} ${r.r > 0 ? "positive" : "negative"} correlation`],
    resultRows: r => [["Pearson r", r.r], ["r² (variance explained)", (r.r2 * 100).toFixed(1) + "%"], ["t statistic", r.t], ["p-value", r.p], ["n pairs", r.n]],
  },
  {
    id: "anova", cat: "Inferential Statistics", name: "One-Way ANOVA",
    formula: "F = MSB / MSW   |   MSB = SSB/(k−1)   |   MSW = SSW/(N−k)   |   SSB = Σnᵢ(x̄ᵢ−x̄)²",
    fields: [{ id: "g1", label: "Group 1 (comma-separated)", type: "text", ph: "12, 15, 14, 16" }, { id: "g2", label: "Group 2 (comma-separated)", type: "text", ph: "20, 22, 18, 24" }, { id: "g3", label: "Group 3 (comma-separated)", type: "text", ph: "30, 28, 32, 35" }],
    calc(v) {
      const parse = s => String(s).split(/[,\s]+/).map(x => parseFloat(x)).filter(x => !isNaN(x));
      const g1 = parse(v.g1), g2 = parse(v.g2), g3 = parse(v.g3);
      if (g1.length < 2 || g2.length < 2 || g3.length < 2) throw new Error("Each group needs ≥2 values");
      const all = [...g1, ...g2, ...g3], N = all.length, k = 3;
      const grand = all.reduce((s, x) => s + x, 0) / N;
      const m = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
      const m1 = m(g1), m2 = m(g2), m3 = m(g3);
      const SSB = g1.length * Math.pow(m1 - grand, 2) + g2.length * Math.pow(m2 - grand, 2) + g3.length * Math.pow(m3 - grand, 2);
      const SSW = [...g1.map(x => Math.pow(x - m1, 2)), ...g2.map(x => Math.pow(x - m2, 2)), ...g3.map(x => Math.pow(x - m3, 2))].reduce((s, x) => s + x, 0);
      const dfB = k - 1, dfW = N - k, MSB = SSB / dfB, MSW = SSW / dfW, F = MSB / MSW;
      const sig = F > 3.89;
      return { F: +F.toFixed(4), MSB: +MSB.toFixed(4), MSW: +MSW.toFixed(4), SSB: +SSB.toFixed(4), SSW: +SSW.toFixed(4), dfB, dfW, N, m1: +m1.toFixed(3), m2: +m2.toFixed(3), m3: +m3.toFixed(3), sig, p: sig ? "<0.05" : ">0.05" };
    },
    steps: (v, r) => [`Group means: G1=${r.m1}, G2=${r.m2}, G3=${r.m3}   |   Grand mean computed`, `SSB = ${r.SSB}   dfB = ${r.dfB}   MSB = ${r.MSB}`, `SSW = ${r.SSW}   dfW = ${r.dfW}   MSW = ${r.MSW}`, `F = MSB/MSW = ${r.MSB}/${r.MSW} = ${r.F}`, `F ${r.sig ? "> 3.89" : "< 3.89"} (critical, p<0.05) → p ${r.p} → ${r.sig ? "Significant — use post-hoc (Tukey)" : "Not significant"}`],
    resultRows: r => [["Group 1 Mean", r.m1], ["Group 2 Mean", r.m2], ["Group 3 Mean", r.m3], ["SSB", r.SSB], ["SSW", r.SSW], ["MSB", r.MSB], ["MSW", r.MSW], ["F statistic", r.F], ["p-value", r.p], ["Significant?", r.sig ? "Yes ✓" : "No"]],
  },
  {
    id: "samplesize", cat: "Inferential Statistics", name: "Sample Size (Survey)",
    formula: "n = Z² × p × q / d²   ×   DEFF   +   10% non-response",
    fields: [{ id: "p", label: "Expected Proportion (p) — use 0.5 if unknown", type: "number", ph: "0.5", min: 0.01, max: 0.99 }, { id: "d", label: "Precision (±d)", type: "number", ph: "0.05", min: 0.001 }, { id: "conf", label: "Confidence Level %", type: "number", ph: "95", min: 80, max: 99.9 }, { id: "deff", label: "Design Effect (DEFF) — 1 for SRS", type: "number", ph: "1", min: 1 }],
    calc(v) {
      const zMap = { 80: 1.282, 85: 1.440, 90: 1.645, 95: 1.96, 99: 2.576 };
      const Z = zMap[Math.round(+v.conf)] || 1.96, p = +v.p, q = 1 - p, d = +v.d, deff = +v.deff;
      const n_basic = Math.ceil((Z * Z * p * q) / (d * d)), n_deff = Math.ceil(n_basic * deff), n_final = Math.ceil(n_deff * 1.1);
      return { n_basic, n_deff, n_final, Z, p, q: +q.toFixed(3), d, deff };
    },
    steps: (v, r) => [`Z = ${r.Z} (${v.conf}% CI)   |   p = ${v.p}   q = ${r.q}   d = ${v.d}`, `Basic n = Z²pq/d² = ${r.Z}² × ${v.p} × ${r.q} / ${v.d}² = ${r.n_basic}`, `After DEFF (${v.deff}): n = ${r.n_deff}`, `+10% non-response: Final n = ${r.n_final}`],
    resultRows: r => [["Z value", r.Z], ["Basic n (Z²pq/d²)", r.n_basic], ["After DEFF", r.n_deff], ["Final n (+10% NR)", r.n_final]],
  },

  // ── EPIDEMIOLOGY RATES ──
  {
    id: "incidence", cat: "Epidemiology Rates", name: "Incidence Rate",
    formula: "Incidence Rate = (New Cases / Population at Risk) × Multiplier",
    fields: [{ id: "cases", label: "New Cases (numerator)", type: "number", ph: "50", min: 0 }, { id: "pop", label: "Population at Risk (denominator)", type: "number", ph: "100000", min: 1 }, { id: "mult", label: "Multiplier (1000 / 10000 / 100000)", type: "number", ph: "1000", min: 1 }, { id: "time", label: "Time Period (years, optional label)", type: "text", ph: "1 year" }],
    calc(v) {
      const rate = (+v.cases / +v.pop) * +v.mult;
      return { rate: +rate.toFixed(4), cases: +v.cases, pop: +v.pop, mult: +v.mult };
    },
    steps: (v, r) => [`Incidence Rate = (${v.cases} / ${v.pop}) × ${v.mult}`, `= ${r.rate} per ${v.mult} population`, `Time period: ${v.time || "stated period"}`, `Note: Incidence counts NEW cases only (measures RISK/velocity)`],
    resultRows: r => [["New Cases", r.cases], ["Population at Risk", r.pop], ["Multiplier", r.mult], ["Incidence Rate", `${r.rate} per ${r.mult}`]],
  },
  {
    id: "prevalence", cat: "Epidemiology Rates", name: "Prevalence Rate",
    formula: "Prevalence = (All Existing Cases / Total Population) × Multiplier",
    fields: [{ id: "cases", label: "All Existing Cases (old + new)", type: "number", ph: "500", min: 0 }, { id: "pop", label: "Total Population", type: "number", ph: "100000", min: 1 }, { id: "mult", label: "Multiplier", type: "number", ph: "1000", min: 1 }],
    calc(v) { const rate = (+v.cases / +v.pop) * +v.mult; return { rate: +rate.toFixed(4), cases: +v.cases, pop: +v.pop, mult: +v.mult }; },
    steps: (v, r) => [`Prevalence = (${v.cases} / ${v.pop}) × ${v.mult} = ${r.rate} per ${v.mult}`, `Prevalence includes ALL existing cases (old + new)`, `P = I × D (in steady state, where D = average disease duration)`],
    resultRows: r => [["All Existing Cases", r.cases], ["Total Population", r.pop], ["Multiplier", r.mult], ["Prevalence Rate", `${r.rate} per ${r.mult}`]],
  },
  {
    id: "attackrate", cat: "Epidemiology Rates", name: "Attack Rate & Secondary AR",
    formula: "AR = (Cases / Exposed) × 100   |   SAR = (Secondary Cases / HH Contacts) × 100",
    fields: [{ id: "cases", label: "Primary Cases (ill)", type: "number", ph: "25", min: 0 }, { id: "exposed", label: "Total Exposed", type: "number", ph: "100", min: 1 }, { id: "sec_cases", label: "Secondary Cases (household contacts ill)", type: "number", ph: "8", min: 0 }, { id: "contacts", label: "Household Contacts at Risk", type: "number", ph: "40", min: 1 }],
    calc(v) { return { ar: +(+v.cases / +v.exposed * 100).toFixed(2), sar: +(+v.sec_cases / +v.contacts * 100).toFixed(2) }; },
    steps: (v, r) => [`AR = (${v.cases} / ${v.exposed}) × 100 = ${r.ar}%`, `SAR = (${v.sec_cases} / ${v.contacts}) × 100 = ${r.sar}%`, `AR denominator = EXPOSED (not total population)`, `SAR measures household (person-to-person) transmission`],
    resultRows: r => [["Attack Rate (AR)", r.ar + "%"], ["Secondary Attack Rate (SAR)", r.sar + "%"]],
  },
  {
    id: "cfr", cat: "Epidemiology Rates", name: "Case Fatality Rate (CFR)",
    formula: "CFR = (Deaths / Total Cases) × 100   [NOT per population]",
    fields: [{ id: "deaths", label: "Deaths", type: "number", ph: "45", min: 0 }, { id: "cases", label: "Total Cases (diagnosed)", type: "number", ph: "500", min: 1 }],
    calc(v) { const cfr = (+v.deaths / +v.cases) * 100; return { cfr: +cfr.toFixed(3), survival: +(100 - cfr).toFixed(3) }; },
    steps: (v, r) => [`CFR = (${v.deaths} / ${v.cases}) × 100 = ${r.cfr}%`, `Survival Rate = 100 − ${r.cfr} = ${r.survival}%`, `CFR uses CASES (not population) as denominator`, `Mortality Rate uses POPULATION — different measure`],
    resultRows: r => [["Deaths", "input"], ["Total Cases", "input"], ["CFR", r.cfr + "%"], ["Survival Rate", r.survival + "%"]],
  },
  {
    id: "cdr", cat: "Epidemiology Rates", name: "Crude Death Rate (CDR)",
    formula: "CDR = (Total Deaths / Mid-year Population) × 1,000",
    fields: [{ id: "deaths", label: "Total Deaths (in period)", type: "number", ph: "7300", min: 0 }, { id: "pop", label: "Mid-year Population", type: "number", ph: "1000000", min: 1 }],
    calc(v) { const cdr = (+v.deaths / +v.pop) * 1000; return { cdr: +cdr.toFixed(3) }; },
    steps: (v, r) => [`CDR = (${v.deaths} / ${v.pop}) × 1,000 = ${r.cdr}`, `Use MID-YEAR population (not year-start or year-end)`, `India CDR: 27.4 (1951) → 7.3 (2020)`],
    resultRows: r => [["CDR", r.cdr + " per 1,000 population"]],
  },
  {
    id: "cbr", cat: "Epidemiology Rates", name: "Crude Birth Rate (CBR)",
    formula: "CBR = (Live Births / Mid-year Population) × 1,000",
    fields: [{ id: "births", label: "Live Births (in period)", type: "number", ph: "19500", min: 0 }, { id: "pop", label: "Mid-year Population", type: "number", ph: "1000000", min: 1 }],
    calc(v) { const cbr = (+v.births / +v.pop) * 1000; return { cbr: +cbr.toFixed(3), ngr: null }; },
    steps: (v, r) => [`CBR = (${v.births} / ${v.pop}) × 1,000 = ${r.cbr}`, `India CBR: 41.7 (1951) → 19.5 (2020)`, `Natural Growth Rate (NGR) = CBR − CDR`],
    resultRows: r => [["CBR", r.cbr + " per 1,000 population"]],
  },
  {
    id: "cause_death", cat: "Epidemiology Rates", name: "Cause-Specific Death Rate",
    formula: "CSDR = (Deaths from Cause X / Mid-year Population) × 100,000",
    fields: [{ id: "deaths", label: "Deaths from Specific Cause", type: "number", ph: "450", min: 0 }, { id: "pop", label: "Mid-year Population", type: "number", ph: "1000000", min: 1 }],
    calc(v) { const csdr = (+v.deaths / +v.pop) * 100000; return { csdr: +csdr.toFixed(3) }; },
    steps: (v, r) => [`CSDR = (${v.deaths} / ${v.pop}) × 100,000 = ${r.csdr}`, `Expressed per 100,000 population`, `Useful for comparing causes of death across populations`],
    resultRows: r => [["Cause-Specific Death Rate", r.csdr + " per 100,000"]],
  },
  {
    id: "pmr", cat: "Epidemiology Rates", name: "Proportional Mortality Rate (PMR)",
    formula: "PMR = (Deaths from Cause X / Total Deaths) × 100",
    fields: [{ id: "cause_deaths", label: "Deaths from Specific Cause", type: "number", ph: "450", min: 0 }, { id: "total_deaths", label: "Total Deaths (all causes)", type: "number", ph: "7300", min: 1 }],
    calc(v) { const pmr = (+v.cause_deaths / +v.total_deaths) * 100; return { pmr: +pmr.toFixed(2) }; },
    steps: (v, r) => [`PMR = (${v.cause_deaths} / ${v.total_deaths}) × 100 = ${r.pmr}%`, `PMR = proportion of all deaths due to this cause`, `Does NOT use population — uses total deaths as denominator`],
    resultRows: r => [["Proportional Mortality Rate", r.pmr + "%"]],
  },

  // ── RISK MEASURES ──
  {
    id: "rr_or", cat: "Risk Measures", name: "2×2 Table: RR, OR, AR, PAR, NNT",
    formula: "RR = (a/r₁)÷(c/r₂)   |   OR = (a×d)/(b×c)   |   AR = IR₁−IR₀   |   PAR = IR_pop−IR₀   |   NNT = 1/AR",
    fields: [{ id: "a", label: "A — Exposed+ & Disease+", type: "number", ph: "40", min: 0 }, { id: "b", label: "B — Exposed+ & Disease−", type: "number", ph: "60", min: 0 }, { id: "c", label: "C — Exposed− & Disease+", type: "number", ph: "20", min: 0 }, { id: "d", label: "D — Exposed− & Disease−", type: "number", ph: "80", min: 0 }],
    calc(v) {
      const a = +v.a, b = +v.b, c = +v.c, d = +v.d, N = a + b + c + d;
      const r1 = a + b, r2 = c + d;
      const IR1 = a / r1, IR0 = c / r2, IRpop = (a + c) / N;
      const rr = IR1 / IR0, or = (a * d) / (b * c), ar = IR1 - IR0;
      const arp = (ar / IR1) * 100, par = IRpop - IR0, parp = (par / IRpop) * 100;
      const nnt = Math.abs(ar) > 0 ? Math.ceil(1 / Math.abs(ar)) : 9999;
      return { rr: +rr.toFixed(4), or: +or.toFixed(4), ar: +ar.toFixed(4), arp: +arp.toFixed(2), par: +par.toFixed(4), parp: +parp.toFixed(2), nnt, IR1: +(IR1 * 100).toFixed(2), IR0: +(IR0 * 100).toFixed(2), N };
    },
    steps: (v, r) => [`IR(exposed) = ${v.a}/${+v.a + +v.b} = ${r.IR1}%   |   IR(unexposed) = ${v.c}/${+v.c + +v.d} = ${r.IR0}%`, `RR = ${r.IR1}% / ${r.IR0}% = ${r.rr}   |   OR = (${v.a}×${v.d})/(${v.b}×${v.c}) = ${r.or}`, `AR = ${r.IR1}% − ${r.IR0}% = ${+(r.ar * 100).toFixed(2)}%   |   AR% = ${r.arp}%`, `PAR = IR_pop − IR₀ = ${+(r.par * 100).toFixed(2)}%   |   PAR% = ${r.parp}%`, `NNT = 1/AR = ${r.nnt}`],
    resultRows: r => [["IR Exposed", r.IR1 + "%"], ["IR Unexposed", r.IR0 + "%"], ["Relative Risk (RR)", r.rr], ["Odds Ratio (OR)", r.or], ["Attributable Risk (AR)", (r.ar * 100).toFixed(2) + "%"], ["AR% (Attributable Fraction)", r.arp + "%"], ["PAR", (r.par * 100).toFixed(2) + "%"], ["PAR%", r.parp + "%"], ["NNT", r.nnt]],
  },
  {
    id: "nnt", cat: "Risk Measures", name: "NNT / NNH Calculator",
    formula: "ARR = CER − EER   |   NNT = 1/ARR   |   RRR = (CER−EER)/CER × 100",
    fields: [{ id: "cer", label: "Control Event Rate (CER) — 0 to 1", type: "number", ph: "0.20", min: 0, max: 1 }, { id: "eer", label: "Experimental/Treatment Event Rate (EER) — 0 to 1", type: "number", ph: "0.12", min: 0, max: 1 }],
    calc(v) {
      const cer = +v.cer, eer = +v.eer, arr = cer - eer;
      const rrr = cer > 0 ? (arr / cer) * 100 : 0, rr = cer > 0 ? eer / cer : 0;
      const nnt = arr !== 0 ? Math.ceil(Math.abs(1 / arr)) : 9999;
      return { arr: +arr.toFixed(4), arr_pct: +(arr * 100).toFixed(2), rrr: +rrr.toFixed(2), rr: +rr.toFixed(4), nnt, beneficial: arr > 0 };
    },
    steps: (v, r) => [`CER = ${(+v.cer * 100).toFixed(1)}%   |   EER = ${(+v.eer * 100).toFixed(1)}%`, `ARR = CER − EER = ${r.arr_pct}%   |   RR = EER/CER = ${r.rr}`, `RRR = (${r.arr_pct}% / ${(+v.cer * 100).toFixed(1)}%) × 100 = ${r.rrr}%`, `NNT = 1/ARR = 1/${r.arr_pct}% = ${r.nnt} patients`, `${r.beneficial ? "Beneficial (treatment reduces events)" : "HARMFUL — NNH = " + r.nnt}`],
    resultRows: r => [["ARR (Absolute Risk Reduction)", r.arr_pct + "%"], ["RRR (Relative Risk Reduction)", r.rrr + "%"], ["RR", r.rr], [r.beneficial ? "NNT" : "NNH (Number Needed to Harm)", r.nnt]],
  },
  {
    id: "rate_ratio", cat: "Risk Measures", name: "Rate Ratio & Rate Difference",
    formula: "Rate Ratio = Rate₁ / Rate₂   |   Rate Difference = Rate₁ − Rate₂",
    fields: [{ id: "r1", label: "Rate in Group 1 (Exposed)", type: "number", ph: "45", min: 0 }, { id: "r2", label: "Rate in Group 2 (Unexposed)", type: "number", ph: "15", min: 0.001 }],
    calc(v) { const rr = +v.r1 / +v.r2, rd = +v.r1 - +v.r2; return { rr: +rr.toFixed(4), rd: +rd.toFixed(4), pct: +((rr - 1) * 100).toFixed(2) }; },
    steps: (v, r) => [`Rate Ratio = ${v.r1} / ${v.r2} = ${r.rr}`, `Rate Difference = ${v.r1} − ${v.r2} = ${r.rd}`, r.rr > 1 ? `Exposed have ${r.pct}% HIGHER rate` : r.rr < 1 ? `Exposed have ${Math.abs(r.pct)}% LOWER rate (protective)` : "No rate difference"],
    resultRows: r => [["Rate Ratio", r.rr], ["Rate Difference", r.rd], ["% Difference", r.pct + "%"], ["Direction", r.rr > 1 ? "Risk factor ↑" : r.rr < 1 ? "Protective ↓" : "No difference"]],
  },

  // ── MATERNAL & CHILD HEALTH ──
  {
    id: "mmr", cat: "Maternal & Child Health", name: "Maternal Mortality Ratio (MMR)",
    formula: "MMR = (Maternal Deaths / Live Births) × 100,000",
    fields: [{ id: "deaths", label: "Maternal Deaths (within 42 days of pregnancy)", type: "number", ph: "450", min: 0 }, { id: "lb", label: "Live Births", type: "number", ph: "1000000", min: 1 }],
    calc(v) { const mmr = (+v.deaths / +v.lb) * 100000; return { mmr: +mmr.toFixed(2) }; },
    steps: (v, r) => [`MMR = (${v.deaths} / ${v.lb}) × 100,000 = ${r.mmr}`, `Multiplier = 100,000 (NOT 1,000 — common error)`, `India: 556 (1990) → 97 (2020) | SDG target <70 by 2030`],
    resultRows: r => [["MMR", r.mmr + " per 100,000 live births"], ["SDG Target", "<70"], ["India (2020)", "97"]],
  },
  {
    id: "imr", cat: "Maternal & Child Health", name: "Infant Mortality Rate (IMR)",
    formula: "IMR = (Infant Deaths <1yr / Live Births) × 1,000",
    fields: [{ id: "deaths", label: "Infant Deaths (under 1 year)", type: "number", ph: "28", min: 0 }, { id: "lb", label: "Live Births", type: "number", ph: "1000", min: 1 }],
    calc(v) { const imr = (+v.deaths / +v.lb) * 1000; return { imr: +imr.toFixed(3) }; },
    steps: (v, r) => [`IMR = (${v.deaths} / ${v.lb}) × 1,000 = ${r.imr}`, `Multiplier = 1,000 live births`, `IMR = BEST SINGLE INDICATOR of community health`, `India: 88 (1990) → 28 (2020) | SDG target <12 by 2030`],
    resultRows: r => [["IMR", r.imr + " per 1,000 live births"], ["SDG Target", "<12"], ["India (2020)", "28"]],
  },
  {
    id: "nmr", cat: "Maternal & Child Health", name: "Neonatal Mortality Rate (NMR)",
    formula: "NMR = (Neonatal Deaths 0–28d / Live Births) × 1,000",
    fields: [{ id: "deaths", label: "Neonatal Deaths (0–28 days)", type: "number", ph: "20", min: 0 }, { id: "lb", label: "Live Births", type: "number", ph: "1000", min: 1 }],
    calc(v) { const nmr = (+v.deaths / +v.lb) * 1000; return { nmr: +nmr.toFixed(3) }; },
    steps: (v, r) => [`NMR = (${v.deaths} / ${v.lb}) × 1,000 = ${r.nmr}`, `Neonatal period = 0–28 completed days`, `India NMR ~70% of IMR | India (2020): 20 per 1,000`],
    resultRows: r => [["NMR", r.nmr + " per 1,000 live births"], ["India (2020)", "20"]],
  },
  {
    id: "u5mr", cat: "Maternal & Child Health", name: "Under-5 Mortality Rate (U5MR)",
    formula: "U5MR = (Deaths <5yr / Live Births) × 1,000",
    fields: [{ id: "deaths", label: "Deaths under 5 years", type: "number", ph: "42", min: 0 }, { id: "lb", label: "Live Births", type: "number", ph: "1000", min: 1 }],
    calc(v) { const u5mr = (+v.deaths / +v.lb) * 1000; return { u5mr: +u5mr.toFixed(3) }; },
    steps: (v, r) => [`U5MR = (${v.deaths} / ${v.lb}) × 1,000 = ${r.u5mr}`, `India: 126 (1990) → 32 (2020) | SDG target <25 by 2030`],
    resultRows: r => [["U5MR", r.u5mr + " per 1,000 live births"], ["SDG Target", "<25"], ["India (2020)", "32"]],
  },
  {
    id: "perinatal", cat: "Maternal & Child Health", name: "Perinatal Mortality Rate (PMR)",
    formula: "PMR = (Stillbirths ≥28wk + Early NMR 0–7d) / (Live Births + Stillbirths) × 1,000",
    fields: [{ id: "stillbirths", label: "Stillbirths (≥28 weeks gestation)", type: "number", ph: "15", min: 0 }, { id: "enmr", label: "Early Neonatal Deaths (0–7 days)", type: "number", ph: "10", min: 0 }, { id: "lb", label: "Live Births", type: "number", ph: "1000", min: 1 }],
    calc(v) {
      const num = +v.stillbirths + +v.enmr, den = +v.lb + +v.stillbirths;
      const pmr = (num / den) * 1000;
      return { pmr: +pmr.toFixed(3) };
    },
    steps: (v, r) => [`Numerator = Stillbirths + Early NMR = ${v.stillbirths} + ${v.enmr} = ${+v.stillbirths + +v.enmr}`, `Denominator = Live Births + Stillbirths = ${v.lb} + ${v.stillbirths} = ${+v.lb + +v.stillbirths}`, `PMR = (${+v.stillbirths + +v.enmr} / ${+v.lb + +v.stillbirths}) × 1,000 = ${r.pmr}`],
    resultRows: r => [["Perinatal Mortality Rate", r.pmr + " per 1,000"]],
  },

  // ── FERTILITY RATES ──
  {
    id: "tfr", cat: "Fertility Rates", name: "Total Fertility Rate (TFR)",
    formula: "TFR = Σ(7 ASFRs) / 1,000 × 5   [sum of age-specific fertility rates × 5-year interval]",
    fields: [{ id: "f1", label: "ASFR 15–19 (per 1,000 women)", type: "number", ph: "25", min: 0 }, { id: "f2", label: "ASFR 20–24", type: "number", ph: "120", min: 0 }, { id: "f3", label: "ASFR 25–29", type: "number", ph: "110", min: 0 }, { id: "f4", label: "ASFR 30–34", type: "number", ph: "65", min: 0 }, { id: "f5", label: "ASFR 35–39", type: "number", ph: "25", min: 0 }, { id: "f6", label: "ASFR 40–44", type: "number", ph: "8", min: 0 }, { id: "f7", label: "ASFR 45–49", type: "number", ph: "2", min: 0 }],
    calc(v) {
      const sum = (+v.f1 || 0) + (+v.f2 || 0) + (+v.f3 || 0) + (+v.f4 || 0) + (+v.f5 || 0) + (+v.f6 || 0) + (+v.f7 || 0);
      const tfr = (sum / 1000) * 5;
      return { tfr: +tfr.toFixed(3), sum };
    },
    steps: (v, r) => [`Sum of 7 ASFRs = ${r.sum}`, `TFR = (${r.sum} / 1,000) × 5 = ${r.tfr}`, `Replacement level = 2.1 (NOT 2.0)`, `India (2020): 2.0 (below replacement!) | Bihar: 3.0 | Kerala: 1.8`],
    resultRows: r => [["Sum of ASFRs", r.sum], ["TFR", r.tfr + " children/woman"], ["Replacement Level", "2.1"], ["India (2020)", "2.0 ✓ (below replacement)"]],
  },
  {
    id: "gfr", cat: "Fertility Rates", name: "General Fertility Rate (GFR)",
    formula: "GFR = (Live Births / Women aged 15–49) × 1,000",
    fields: [{ id: "births", label: "Live Births", type: "number", ph: "19500", min: 0 }, { id: "women", label: "Women aged 15–49 (mid-year)", type: "number", ph: "250000", min: 1 }],
    calc(v) { const gfr = (+v.births / +v.women) * 1000; return { gfr: +gfr.toFixed(3) }; },
    steps: (v, r) => [`GFR = (${v.births} / ${v.women}) × 1,000 = ${r.gfr}`, `GFR uses WOMEN 15–49 (unlike CBR which uses total population)`, `More specific than CBR for fertility measurement`],
    resultRows: r => [["GFR", r.gfr + " per 1,000 women (15–49)"]],
  },
  {
    id: "asfr", cat: "Fertility Rates", name: "Age-Specific Fertility Rate (ASFR)",
    formula: "ASFR = (Births to Women in Age Group / Women in that Age Group) × 1,000",
    fields: [{ id: "births", label: "Live Births to women in age group", type: "number", ph: "3200", min: 0 }, { id: "women", label: "Women in that age group (mid-year)", type: "number", ph: "50000", min: 1 }, { id: "age", label: "Age group label", type: "text", ph: "20–24" }],
    calc(v) { const asfr = (+v.births / +v.women) * 1000; return { asfr: +asfr.toFixed(3) }; },
    steps: (v, r) => [`ASFR (${v.age}) = (${v.births} / ${v.women}) × 1,000 = ${r.asfr}`, `Expressed per 1,000 women in that age group`, `7 ASFRs (15–49, in 5-year groups) are summed to calculate TFR`],
    resultRows: r => [["ASFR", r.asfr + ` per 1,000 women (${v.age})`]],
  },

  // ── SCREENING TESTS ──
  {
    id: "sesp", cat: "Screening Tests", name: "Sensitivity, Specificity, PPV, NPV",
    formula: "Se = TP/(TP+FN)   |   Sp = TN/(TN+FP)   |   PPV = TP/(TP+FP)   |   NPV = TN/(TN+FN)   |   LR+ = Se/(1−Sp)",
    fields: [{ id: "tp", label: "True Positives (TP) — Disease+ & Test+", type: "number", ph: "90", min: 0 }, { id: "fn", label: "False Negatives (FN) — Disease+ & Test−", type: "number", ph: "10", min: 0 }, { id: "fp", label: "False Positives (FP) — Disease− & Test+", type: "number", ph: "15", min: 0 }, { id: "tn", label: "True Negatives (TN) — Disease− & Test−", type: "number", ph: "85", min: 0 }],
    calc(v) {
      const tp = +v.tp, fn = +v.fn, fp = +v.fp, tn = +v.tn;
      const se = (tp / (tp + fn)) * 100, sp = (tn / (tn + fp)) * 100;
      const ppv = (tp / (tp + fp)) * 100, npv = (tn / (tn + fn)) * 100;
      const acc = ((tp + tn) / (tp + fn + fp + tn)) * 100;
      const lrp = se / (100 - sp), lrn = (100 - se) / sp;
      const youden = (se + sp) / 100 - 1;
      return { se: +se.toFixed(2), sp: +sp.toFixed(2), ppv: +ppv.toFixed(2), npv: +npv.toFixed(2), acc: +acc.toFixed(2), lrp: +lrp.toFixed(3), lrn: +lrn.toFixed(3), youden: +youden.toFixed(3) };
    },
    steps: (v, r) => [`Se = TP/(TP+FN) = ${v.tp}/(${+v.tp + +v.fn}) = ${r.se}%`, `Sp = TN/(TN+FP) = ${v.tn}/(${+v.tn + +v.fp}) = ${r.sp}%`, `PPV = TP/(TP+FP) = ${v.tp}/(${+v.tp + +v.fp}) = ${r.ppv}%`, `NPV = TN/(TN+FN) = ${v.tn}/(${+v.tn + +v.fn}) = ${r.npv}%`, `LR+ = Se/(1−Sp) = ${r.lrp}   |   LR− = (1−Se)/Sp = ${r.lrn}`, `Youden's J = Se+Sp−1 = ${r.youden}   |   SNOUT: High Se→Negative rules Out | SPIN: High Sp→Positive rules In`],
    resultRows: r => [["Sensitivity (Se)", r.se + "%"], ["Specificity (Sp)", r.sp + "%"], ["PPV", r.ppv + "%"], ["NPV", r.npv + "%"], ["Accuracy", r.acc + "%"], ["LR+", r.lrp], ["LR−", r.lrn], ["Youden's Index", r.youden]],
  },

  // ── NUTRITION ──
  {
    id: "bmi", cat: "Nutrition & Anthropometry", name: "Body Mass Index (BMI)",
    formula: "BMI = Weight(kg) / [Height(m)]²   |   Asian cutoffs: OW ≥23, Obese ≥27.5",
    fields: [{ id: "wt", label: "Weight (kg)", type: "number", ph: "70", min: 1 }, { id: "ht", label: "Height (cm)", type: "number", ph: "170", min: 50 }],
    calc(v) { const bmi = +v.wt / Math.pow(+v.ht / 100, 2); const cat = bmi < 18.5 ? "Underweight" : bmi < 23 ? "Normal (Asian)" : bmi < 27.5 ? "Overweight (Asian)" : "Obese (Asian)"; return { bmi: +bmi.toFixed(2), cat }; },
    steps: (v, r) => [`Height = ${v.ht}cm = ${(+v.ht / 100).toFixed(2)}m   |   Height² = ${Math.pow(+v.ht / 100, 2).toFixed(4)}`, `BMI = ${v.wt} / ${Math.pow(+v.ht / 100, 2).toFixed(4)} = ${r.bmi} kg/m²`, `Asian classification: ${r.cat}`, `Asian cutoffs: <18.5 Underweight | 18.5–22.9 Normal | 23–27.4 Overweight | ≥27.5 Obese`],
    resultRows: r => [["BMI", r.bmi + " kg/m²"], ["Category (Asian)", r.cat]],
  },
  {
    id: "nutri_z", cat: "Nutrition & Anthropometry", name: "Nutritional Z-Score (SAM/MAM)",
    formula: "Z-Score = (Observed − WHO Median) / WHO SD",
    fields: [{ id: "obs", label: "Observed Value (weight/height)", type: "number", ph: "9.5" }, { id: "med", label: "WHO Reference Median", type: "number", ph: "11.5" }, { id: "sd", label: "WHO Standard Deviation", type: "number", ph: "1.2", min: 0.01 }],
    calc(v) {
      const z = (+v.obs - +v.med) / +v.sd;
      const cat = z >= -1 ? "Normal (≥−1 SD)" : z >= -2 ? "Mild undernutrition (−1 to −2 SD)" : z >= -3 ? "MAM (Moderate Acute Malnutrition) −2 to −3 SD" : "SAM (Severe Acute Malnutrition) <−3 SD";
      return { z: +z.toFixed(3), cat };
    },
    steps: (v, r) => [`Z = (${v.obs} − ${v.med}) / ${v.sd} = ${r.z}`, `Classification: ${r.cat}`, `SAM: <−3 SD or MUAC <11.5cm | MAM: −2 to −3 SD or MUAC 11.5–12.5cm`],
    resultRows: r => [["Z-Score", r.z], ["Classification", r.cat], ["MUAC SAM cutoff", "<11.5cm"], ["MUAC MAM cutoff", "11.5–12.5cm"]],
  },

  // ── HOSPITAL STATISTICS ──
  {
    id: "bor", cat: "Hospital Statistics", name: "Bed Occupancy Rate (BOR)",
    formula: "BOR = (Patient Days / [Available Beds × Days in Period]) × 100",
    fields: [{ id: "pd", label: "Patient Days (total)", type: "number", ph: "18000", min: 0 }, { id: "beds", label: "Available Beds", type: "number", ph: "100", min: 1 }, { id: "days", label: "Days in Period", type: "number", ph: "365", min: 1 }],
    calc(v) { const bor = (+v.pd / (+v.beds * +v.days)) * 100; return { bor: +bor.toFixed(2), cap: +v.beds * +v.days }; },
    steps: (v, r) => [`Max capacity = ${v.beds} beds × ${v.days} days = ${r.cap} bed-days`, `BOR = (${v.pd} / ${r.cap}) × 100 = ${r.bor}%`, `WHO Optimal: 75–85%   |   <70% = underutilized   |   >85% = overcrowded`],
    resultRows: r => [["BOR", r.bor + "%"], ["Optimal range", "75–85%"], ["Status", r.bor < 70 ? "Underutilized" : r.bor <= 85 ? "Optimal ✓" : "Overcrowded"]],
  },
  {
    id: "alos", cat: "Hospital Statistics", name: "Average Length of Stay (ALOS)",
    formula: "ALOS = Total Patient Days / Total Admissions   |   Bed Turnover = 365 / ALOS",
    fields: [{ id: "pd", label: "Total Patient Days", type: "number", ph: "18000", min: 0 }, { id: "admissions", label: "Total Admissions (discharges + deaths)", type: "number", ph: "2000", min: 1 }, { id: "beds", label: "Available Beds (for Bed Turnover)", type: "number", ph: "100", min: 1 }],
    calc(v) {
      const alos = +v.pd / +v.admissions, btr = +v.admissions / +v.beds;
      return { alos: +alos.toFixed(2), btr: +btr.toFixed(2) };
    },
    steps: (v, r) => [`ALOS = ${v.pd} / ${v.admissions} = ${r.alos} days`, `Bed Turnover Rate = ${v.admissions} / ${v.beds} = ${r.btr} per bed per year`],
    resultRows: r => [["ALOS", r.alos + " days"], ["Bed Turnover Rate", r.btr + " per bed/year"]],
  },

  // ── VACCINATION ──
  {
    id: "hit", cat: "Vaccines & Immunity", name: "Herd Immunity Threshold (HIT)",
    formula: "HIT = (1 − 1/R₀) × 100   |   Vaccine Coverage Needed = HIT / Vaccine Efficacy",
    fields: [{ id: "r0", label: "Basic Reproduction Number (R₀)", type: "number", ph: "4", min: 1.01 }, { id: "ve", label: "Vaccine Efficacy % (e.g. 95 for measles)", type: "number", ph: "95", min: 1, max: 100 }],
    calc(v) { const hit = (1 - 1 / +v.r0) * 100, cov = hit / (+v.ve / 100); return { hit: +hit.toFixed(2), cov: +cov.toFixed(2) }; },
    steps: (v, r) => [`HIT = (1 − 1/${v.r0}) × 100 = ${r.hit}%`, `Vaccine coverage needed = ${r.hit}% / ${v.ve}% efficacy = ${r.cov}%`, `Measles: R₀=12–18, HIT=93% | COVID: R₀=2–3, HIT=50–67% | Polio: R₀=5–7, HIT=80%`],
    resultRows: r => [["Herd Immunity Threshold", r.hit + "%"], ["Vaccine Coverage Needed", r.cov + "%"]],
  },
  {
    id: "vacc_cov", cat: "Vaccines & Immunity", name: "Vaccination Coverage",
    formula: "Coverage = (Vaccinated / Target Population) × 100",
    fields: [{ id: "vacc", label: "Children Vaccinated (dose)", type: "number", ph: "850", min: 0 }, { id: "target", label: "Target Population (eligible)", type: "number", ph: "1000", min: 1 }],
    calc(v) { const cov = (+v.vacc / +v.target) * 100; return { cov: +cov.toFixed(2), missed: +v.target - +v.vacc }; },
    steps: (v, r) => [`Coverage = (${v.vacc} / ${v.target}) × 100 = ${r.cov}%`, `Missed = ${r.missed} children (${+(100 - r.cov).toFixed(2)}%)`, `Targets: ≥90% national, ≥80% every district (WHO/NHM)`],
    resultRows: r => [["Vaccination Coverage", r.cov + "%"], ["Children Missed", r.missed], ["Status", r.cov >= 95 ? "Excellent ✓" : r.cov >= 90 ? "Good" : r.cov >= 80 ? "Borderline" : "Below target"]],
  },
  {
    id: "vacc_eff", cat: "Vaccines & Immunity", name: "Vaccine Efficacy (VE)",
    formula: "VE = (1 − RR) × 100   |   RR = Attack Rate Vaccinated / Attack Rate Unvaccinated",
    fields: [{ id: "arv", label: "Attack Rate in Vaccinated (%)", type: "number", ph: "2", min: 0, max: 100 }, { id: "aru", label: "Attack Rate in Unvaccinated (%)", type: "number", ph: "20", min: 0.01, max: 100 }],
    calc(v) { const rr = +v.arv / +v.aru, ve = (1 - rr) * 100; return { rr: +rr.toFixed(4), ve: +ve.toFixed(2) }; },
    steps: (v, r) => [`RR = AR(vaccinated) / AR(unvaccinated) = ${v.arv}% / ${v.aru}% = ${r.rr}`, `VE = (1 − ${r.rr}) × 100 = ${r.ve}%`, `VE = ${r.ve}%: vaccinated have ${r.ve}% lower risk of disease`],
    resultRows: r => [["Relative Risk (RR)", r.rr], ["Vaccine Efficacy (VE)", r.ve + "%"]],
  },
];

const CATEGORIES = [...new Set(CALCS.map(c => c.cat))];

// ── styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0a0f1e;--surf:#0f172a;--surf2:#1e293b;--surf3:rgba(255,255,255,0.03);
  --border:rgba(255,255,255,0.07);--border2:rgba(59,130,246,0.25);
  --text:#e2e8f0;--text2:#94a3b8;--text3:#475569;
  --blue:#3b82f6;--blue2:#2563eb;--green:#10b981;--red:#ef4444;--amber:#f59e0b;--purple:#8b5cf6;
  --r:10px;--rl:16px;
}
[data-theme=light]{
  --bg:#f1f5f9;--surf:#ffffff;--surf2:#f8fafc;--surf3:rgba(59,130,246,0.03);
  --border:rgba(0,0,0,0.07);--border2:rgba(59,130,246,0.2);
  --text:#0f172a;--text2:#334155;--text3:#94a3b8;
}
html,body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px;}
.app{display:flex;min-height:100vh;}
/* sidebar */
.sidebar{width:260px;background:var(--surf);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;bottom:0;left:0;z-index:100;overflow-y:auto;}
.sidebar-logo{padding:20px 18px 14px;border-bottom:1px solid var(--border);}
.sidebar-logo h1{font-size:20px;font-weight:800;letter-spacing:-0.5px;}
.sidebar-logo h1 span{color:var(--blue);}
.sidebar-logo p{font-size:11px;color:var(--text3);margin-top:2px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;}
.search-wrap{padding:12px 12px 10px;border-bottom:1px solid var(--border);}
.search-wrap input{width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border2);background:var(--surf2);color:var(--text);font-size:13px;outline:none;font-family:'Inter',sans-serif;}
.search-wrap input:focus{border-color:var(--blue);}
.nav-section{padding:10px 10px 4px;}
.nav-section-title{font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;padding:0 8px;margin-bottom:4px;}
.nav-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text2);transition:all 0.15s;border:none;background:none;width:100%;text-align:left;}
.nav-item:hover{background:var(--surf3);color:var(--text);}
.nav-item.active{background:rgba(59,130,246,0.1);color:var(--blue);border:1px solid rgba(59,130,246,0.15);}
.nav-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.nav-count{margin-left:auto;font-size:10px;background:var(--surf2);border-radius:20px;padding:1px 6px;color:var(--text3);}
/* main */
.main{margin-left:260px;flex:1;display:flex;flex-direction:column;}
.topbar{height:56px;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;gap:14px;background:var(--surf);position:sticky;top:0;z-index:50;}
.topbar h2{font-size:16px;font-weight:700;}
.theme-btn{margin-left:auto;padding:6px 12px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:12px;font-weight:600;}
.content{padding:24px;flex:1;}
/* home grid */
.home-banner{background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.05));border:1px solid var(--border2);border-radius:var(--rl);padding:28px;margin-bottom:24px;}
.home-banner h2{font-size:26px;font-weight:800;margin-bottom:8px;letter-spacing:-0.5px;}
.home-banner p{color:var(--text2);font-size:14px;line-height:1.7;}
.cat-section{margin-bottom:28px;}
.cat-title{font-size:13px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.cat-title::after{content:'';flex:1;height:1px;background:var(--border);}
.calc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
.calc-card{background:var(--surf);border:1px solid var(--border);border-radius:var(--r);padding:16px;cursor:pointer;transition:all 0.18s;position:relative;}
.calc-card:hover{border-color:var(--blue);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3);}
.calc-card-name{font-weight:700;font-size:14px;margin-bottom:5px;}
.calc-card-formula{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3);line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.calc-card-cat{position:absolute;top:12px;right:12px;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;}
/* calc detail */
.calc-detail{max-width:900px;}
.back-btn{display:inline-flex;align-items:center;gap:6px;margin-bottom:18px;padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;}
.back-btn:hover{color:var(--text);border-color:var(--border2);}
.formula-banner{background:linear-gradient(135deg,rgba(139,92,246,0.07),rgba(59,130,246,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:var(--r);padding:14px 18px;margin-bottom:20px;}
.formula-banner .label{font-size:10px;font-weight:700;color:var(--purple);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;}
.formula-banner .formula{font-family:'JetBrains Mono',monospace;font-size:13px;color:#c4b5fd;line-height:1.9;word-break:break-word;}
.calc-layout{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.panel{background:var(--surf);border:1px solid var(--border);border-radius:var(--rl);padding:20px;}
.panel-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:16px;}
.field{margin-bottom:14px;}
.field label{display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:5px;}
.field input,.field textarea{width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surf2);color:var(--text);font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border 0.15s;}
.field input:focus,.field textarea:focus{border-color:var(--blue);}
.field textarea{font-family:'JetBrains Mono',monospace;font-size:12px;min-height:72px;resize:vertical;}
.calc-btn{width:100%;padding:11px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;margin-top:4px;transition:opacity 0.15s;}
.calc-btn:hover{opacity:0.9;}
.error-box{background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;margin-top:12px;font-size:13px;color:#f87171;}
/* results */
.result-table{width:100%;border-collapse:collapse;}
.result-table tr{border-bottom:1px solid var(--border);}
.result-table tr:last-child{border-bottom:none;}
.result-table td{padding:9px 0;font-size:13px;}
.result-table td:first-child{color:var(--text2);font-weight:500;width:55%;}
.result-table td:last-child{font-weight:700;color:var(--text);font-family:'JetBrains Mono',monospace;}
.steps-section{margin-top:18px;}
.steps-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);margin-bottom:10px;}
.step-row{display:flex;gap:10px;padding:9px 12px;background:var(--surf3);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--blue);}
.step-num{width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--purple));color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.step-text{font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--text2);line-height:1.7;word-break:break-word;}
.empty-state{text-align:center;padding:48px 20px;color:var(--text3);}
.empty-state svg{margin:0 auto 12px;display:block;opacity:0.2;}
/* category colors */
.cat-desc{color:var(--blue)} .cat-infer{color:var(--purple)} .cat-epi{color:var(--green)}
.cat-risk{color:#f59e0b} .cat-mat{color:#ec4899} .cat-fert{color:#f43f5e}
.cat-screen{color:#06b6d4} .cat-nutri{color:#10b981} .cat-hosp{color:#f59e0b} .cat-vacc{color:#06b6d4}
@media(max-width:768px){
  .sidebar{transform:translateX(-100%);}.main{margin-left:0;}
  .calc-layout{grid-template-columns:1fr;}
  .calc-grid{grid-template-columns:1fr 1fr;}
}
`;

const CAT_COLORS = {
  "Descriptive Statistics": "#3b82f6",
  "Inferential Statistics": "#8b5cf6",
  "Epidemiology Rates": "#10b981",
  "Risk Measures": "#f59e0b",
  "Maternal & Child Health": "#ec4899",
  "Fertility Rates": "#f43f5e",
  "Screening Tests": "#06b6d4",
  "Nutrition & Anthropometry": "#10b981",
  "Hospital Statistics": "#f59e0b",
  "Vaccines & Immunity": "#06b6d4",
};

// ── components ───────────────────────────────────────────────────────────────
function CalcCard({ calc, onClick }) {
  const color = CAT_COLORS[calc.cat] || "#3b82f6";
  return (
    <div className="calc-card" onClick={onClick}>
      <div className="calc-card-name">{calc.name}</div>
      <div className="calc-card-formula">{calc.formula.split("|")[0].trim()}</div>
      <div className="calc-card-cat" style={{ background: `${color}18`, color }}>
        {calc.cat.split(" ")[0]}
      </div>
    </div>
  );
}

function CalcDetail({ calc, onBack }) {
  const [vals, setVals] = useState({});
  const [result, setResult] = useState(null);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState("");

  const set = (id, val) => setVals(p => ({ ...p, [id]: val }));

  const run = useCallback(() => {
    setError(""); setResult(null); setSteps([]);
    try {
      const r = calc.calc(vals);
      setResult(r);
      setSteps(calc.steps(vals, r));
    } catch (e) { setError(e.message); }
  }, [calc, vals]);

  const loadExample = useCallback(() => {
    const ex = {};
    calc.fields.forEach(f => { ex[f.id] = f.ph; });
    setVals(ex); setResult(null); setSteps([]); setError("");
  }, [calc]);

  const rows = result ? calc.resultRows(result) : [];

  return (
    <div className="calc-detail">
      <button className="back-btn" onClick={onBack}>← Back to Calculators</button>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{calc.name}</h2>
      <div className="formula-banner">
        <div className="label">Formula</div>
        <div className="formula">{calc.formula.split("|").map((p, i) => <div key={i}>{p.trim()}</div>)}</div>
      </div>
      <div className="calc-layout">
        <div className="panel">
          <div className="panel-title">Input Values</div>
          {calc.fields.map(f => (
            <div key={f.id} className="field">
              <label>{f.label}</label>
              {f.type === "text" ? (
                <textarea value={vals[f.id] || ""} onChange={e => set(f.id, e.target.value)} placeholder={f.ph} />
              ) : (
                <input type="number" value={vals[f.id] || ""} onChange={e => set(f.id, e.target.value)} placeholder={f.ph} min={f.min} max={f.max} step="any" />
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="calc-btn" onClick={run}>Calculate</button>
            <button className="calc-btn" onClick={loadExample} style={{ background: "var(--surf2)", border: "1px solid var(--border)", color: "var(--text2)", flex: "0 0 auto", width: "auto", padding: "11px 16px" }}>Example</button>
          </div>
          {error && <div className="error-box">⚠ {error}</div>}
        </div>

        <div className="panel">
          <div className="panel-title">Result</div>
          {result !== null ? (
            <>
              <table className="result-table">
                <tbody>
                  {rows.map(([label, val], i) => (
                    <tr key={i}><td>{label}</td><td>{val === "input" ? "—" : String(val)}</td></tr>
                  ))}
                </tbody>
              </table>
              {steps.length > 0 && (
                <div className="steps-section">
                  <div className="steps-title">Step-by-Step Working</div>
                  {steps.map((s, i) => (
                    <div key={i} className="step-row">
                      <div className="step-num">{i + 1}</div>
                      <div className="step-text">{s}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
              <div style={{ fontSize: 13 }}>Enter values and click <strong>Calculate</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Home({ onSelect, search }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return CALCS;
    const l = search.toLowerCase();
    return CALCS.filter(c => c.name.toLowerCase().includes(l) || c.cat.toLowerCase().includes(l) || c.formula.toLowerCase().includes(l));
  }, [search]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(c => { if (!g[c.cat]) g[c.cat] = []; g[c.cat].push(c); });
    return g;
  }, [filtered]);

  return (
    <div>
      {!search && (
        <div className="home-banner">
          <h2>Biostatistics Calculator</h2>
          <p>
            {CALCS.length} calculators covering descriptive statistics, epidemiology rates, risk measures, maternal &amp; child health, fertility, screening tests, nutrition, hospital statistics, and vaccines.
            Every calculator shows the full formula and step-by-step working.
          </p>
        </div>
      )}
      {Object.entries(grouped).map(([cat, calcs]) => (
        <div key={cat} className="cat-section">
          <div className="cat-title" style={{ color: CAT_COLORS[cat] || "var(--text3)" }}>
            {cat} <span style={{ fontSize: 11, opacity: 0.6 }}>({calcs.length})</span>
          </div>
          <div className="calc-grid">
            {calcs.map(c => <CalcCard key={c.id} calc={c} onClick={() => onSelect(c)} />)}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty-state" style={{ padding: "60px 20px" }}>No calculators match "{search}"</div>}
    </div>
  );
}

// ── app shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState("dark");
  const [activeCat, setActiveCat] = useState(null);
  const [selectedCalc, setSelectedCalc] = useState(null);
  const [search, setSearch] = useState("");

  const selectCalc = useCallback(c => { setSelectedCalc(c); setSearch(""); }, []);
  const goHome = useCallback(cat => { setSelectedCalc(null); setActiveCat(cat || null); setSearch(""); }, []);

  const visibleCalcs = useMemo(() => {
    if (search.trim()) return CALCS;
    if (!activeCat) return CALCS;
    return CALCS.filter(c => c.cat === activeCat);
  }, [activeCat, search]);

  return (
    <>
      <style>{CSS}</style>
      <div className="app" data-theme={theme}>
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>Bio<span>Stat</span></h1>
            <p>Calculator · {CALCS.length} Formulas</p>
          </div>
          <div className="search-wrap">
            <input placeholder="Search calculators…" value={search} onChange={e => { setSearch(e.target.value); setSelectedCalc(null); setActiveCat(null); }} />
          </div>
          <div className="nav-section">
            <div className="nav-section-title">All</div>
            <button className={`nav-item ${!activeCat && !selectedCalc ? "active" : ""}`} onClick={() => goHome(null)}>
              <span className="nav-dot" style={{ background: "var(--blue)" }} />
              All Calculators
              <span className="nav-count">{CALCS.length}</span>
            </button>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Categories</div>
            {CATEGORIES.map(cat => {
              const color = CAT_COLORS[cat] || "#3b82f6";
              const count = CALCS.filter(c => c.cat === cat).length;
              return (
                <button key={cat} className={`nav-item ${activeCat === cat && !selectedCalc ? "active" : ""}`} onClick={() => goHome(cat)}>
                  <span className="nav-dot" style={{ background: color }} />
                  <span style={{ flex: 1, textAlign: "left", fontSize: 12 }}>{cat}</span>
                  <span className="nav-count">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <h2>{selectedCalc ? selectedCalc.name : activeCat || "All Calculators"}</h2>
            {selectedCalc && <span style={{ fontSize: 12, color: "var(--text3)" }}>← {selectedCalc.cat}</span>}
            <button className="theme-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀ Light" : "🌙 Dark"}
            </button>
          </div>
          <div className="content">
            {selectedCalc ? (
              <CalcDetail calc={selectedCalc} onBack={() => setSelectedCalc(null)} />
            ) : (
              <Home
                onSelect={selectCalc}
                search={search}
                calcs={visibleCalcs}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
