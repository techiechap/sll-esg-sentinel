import React, { useState } from "react";
import axios from "axios";
import {
  Leaf,
  Upload,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Search,
} from "lucide-react";

// --- Sub-Component: ResultCard ---
const ResultCard = ({ title, icon, children }) => (
  <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col h-full">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const Badge = ({ children, variant = "default" }) => {
  const base =
    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border";
  const styles =
    variant === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : variant === "ok"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`${base} ${styles}`}>{children}</span>;
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSnippet(snippet, keywords) {
  if (!snippet) return snippet;
  if (!keywords?.length) return snippet;

  // Highlight up to the first 6 keywords to avoid over-noising the UI
  const keys = keywords.slice(0, 6).map((k) => escapeRegExp(k));
  const re = new RegExp(`(${keys.join("|")})`, "ig");

  const parts = snippet.split(re);
  return parts.map((p, idx) => {
    const isMatch = keys.some((k) => new RegExp(`^${k}$`, "i").test(p));
    if (!isMatch) return <span key={idx}>{p}</span>;
    return (
      <mark
        key={idx}
        className="rounded px-1 py-0.5 bg-emerald-200/60 text-slate-900"
      >
        {p}
      </mark>
    );
  });
}

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [achievedTargets, setAchievedTargets] = useState({});
  
  // const API_BASE = "http://127.0.0.1:8000";
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/analyze-loan`, formData);
      setData(response.data);

      const initialStatus = {};
      (response.data?.sustainability_targets ?? []).forEach(
        (t) => (initialStatus[t] = false)
      );
      setAchievedTargets(initialStatus);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Backend not reachable. Ensure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const toggleTarget = (target) => {
    setAchievedTargets((prev) => ({ ...prev, [target]: !prev[target] }));
  };

  // ---- Ratchet helpers ----
  const getStepBps = () => Number(data?.ratchet_config?.step_bps ?? 2.5);

  const calculateImpactBps = () => {
    const met = Object.values(achievedTargets).filter(Boolean).length;
    const step = getStepBps();
    return Number((met * -step).toFixed(1));
  };

  const formatMoney = (n, currency = "USD") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };

  const calculateAnnualSavings = () => {
    const notional = Number(data?.pricing_assumptions?.notional ?? 500_000_000);
    const currency = data?.pricing_assumptions?.currency ?? "USD";
    const bps = calculateImpactBps();
    const rateDelta = Math.abs(bps) * 0.0001;
    const savings = notional * rateDelta;
    return { savings, currency, notional };
  };

  const pagesFailed = Number(data?.extraction_warnings?.pages_failed ?? 0);
  const pagesTotal = Number(data?.scoring?.pages_total ?? 0);
  const coveragePct = Number(data?.scoring?.coverage_pct ?? 0);
  const confidence = Number(data?.scoring?.confidence ?? 0);

  const matchedKeywords = data?.explainability?.matched_keywords ?? [];
  const evidence = data?.explainability?.evidence ?? [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="flex flex-col items-center mb-10 text-center">
          <div className="bg-emerald-600 p-3 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
            <Leaf className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            ESG Sentinel
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            LMA Edge  2026 • Intelligent Loan Compliance
          </p>

          {/* Badges row */}
          {data && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Badge variant={pagesFailed > 0 ? "warn" : "ok"}>
                {pagesFailed > 0 ? (
                  <>
                    <AlertTriangle size={14} />
                    Partial extraction (fonts)
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Full text extracted
                  </>
                )}
              </Badge>

              <Badge>
                <Search size={14} />
                Coverage: {coveragePct}%{pagesTotal ? ` (${pagesTotal} pages)` : ""}
              </Badge>

              <Badge>
                <ShieldCheck size={14} />
                Confidence: {confidence}/100
              </Badge>
            </div>
          )}
        </header>

        {/* Upload Section */}
        <section className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 mb-10 text-center max-w-2xl mx-auto">
          <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="text-emerald-600" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-800">
            Analyze Facility Agreement
          </h2>
          <p className="text-slate-500 mb-8">
            Upload an agreement to extract sustainability targets and simulate ratchets.
          </p>

          <div className="flex flex-col items-center gap-6">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer transition-all"
            />
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-100 transition-all"
            >
              {loading ? "Processing Document..." : "Run AI Analysis"}
            </button>
          </div>
        </section>

        {/* Results */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Targets */}
            <ResultCard
              title="Detected Sustainability Targets"
              icon={<ShieldCheck className="text-emerald-600" size={24} />}
            >
              <p className="text-xs text-slate-500 mb-3">
                Toggle targets to simulate annual ESG verification.
              </p>
              <div className="space-y-3 mt-2">
                {(data?.sustainability_targets ?? []).map((target, i) => (
                  <button
                    key={i}
                    onClick={() => toggleTarget(target)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
                      achievedTargets[target]
                        ? "border-emerald-500 bg-emerald-50 shadow-sm"
                        : "border-slate-100 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        achievedTargets[target]
                          ? "text-emerald-900"
                          : "text-slate-600"
                      }`}
                    >
                      {target}
                    </span>
                    {achievedTargets[target] ? (
                      <CheckCircle2 className="text-emerald-600" size={20} />
                    ) : (
                      <Circle
                        className="text-slate-300 group-hover:text-slate-400"
                        size={20}
                      />
                    )}
                  </button>
                ))}
              </div>
            </ResultCard>

            {/* Pricing */}
            <div className="bg-slate-900 p-10 rounded-3xl shadow-2xl text-white flex flex-col justify-center items-center text-center h-full border-4 border-slate-800">
              <Activity className="text-emerald-400 mb-6" size={48} />
              <p className="text-slate-400 uppercase tracking-widest text-xs font-black mb-4">
                Margin Ratchet Impact
              </p>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-7xl font-black text-white tracking-tighter">
                  {calculateImpactBps()}
                </span>
                <span className="text-3xl font-bold text-emerald-400 uppercase tracking-tighter">
                  bps
                </span>
              </div>

              <div className="h-px w-full bg-slate-800 my-6" />

              {(() => {
                const { savings, currency, notional } = calculateAnnualSavings();
                const met = Object.values(achievedTargets).filter(Boolean).length;
                const total = data?.sustainability_targets?.length ?? 0;

                return (
                  <p className="text-slate-300 text-base leading-relaxed">
                    Projected Savings:{" "}
                    <span className="text-emerald-400 font-bold">
                      {formatMoney(savings, currency)} / annum
                    </span>
                    <br />
                    <span className="text-xs text-slate-500 mt-2 block italic">
                      Based on {formatMoney(notional, currency)} notional • {met}/
                      {total} targets met • {getStepBps()} bps per target.
                    </span>
                  </p>
                );
              })()}
            </div>

            {/* Explainability */}
            <ResultCard
              title="Explainability Evidence"
              icon={<Search className="text-emerald-600" size={24} />}
            >
              <div className="flex flex-wrap gap-2 mb-4">
                {(matchedKeywords ?? []).slice(0, 10).map((k, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700"
                  >
                    {k}
                  </span>
                ))}
                {(matchedKeywords?.length ?? 0) > 10 && (
                  <span className="text-xs text-slate-500">
                    +{matchedKeywords.length - 10} more
                  </span>
                )}
              </div>

              {evidence?.length ? (
                <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
                  {evidence.map((ev, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-xs font-black text-slate-700">
                          Keyword:{" "}
                          <span className="text-emerald-700">{ev.keyword}</span>
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          Page {ev.page}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed">
                        {highlightSnippet(ev.snippet, [ev.keyword])}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No keyword evidence extracted (document may be scanned/image-based or
                  contains no ESG terms).
                </p>
              )}
            </ResultCard>
          </div>
        )}
      </div>
    </div>
  );
}
