"use client";
 
import React, { useState, useEffect } from "react";
import { Briefcase, DollarSign, Globe2, Mail, Loader2, Stamp, ChevronRight, RotateCcw, Lock } from "lucide-react";
 
export default function Page() {
  const [stage, setStage] = useState("form"); // form | loading | result | error | paywall | limited
  const [email, setEmail] = useState("");
  const [skills, setSkills] = useState("");
  const [budget, setBudget] = useState("");
  const [country, setCountry] = useState("");
  const [data, setData] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [activeTab, setActiveTab] = useState("ideas");
  const [ref, setRef] = useState(null);
 
  // Capture ?ref=CODE from the URL (e.g. a creator's tracked link) once on
  // load, so it can be forwarded to checkout without needing any browser
  // storage — it just lives in this page's state for the session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ref");
    if (r) setRef(r);
  }, []);
 
  const canSubmit = email.trim() && skills.trim() && budget.trim() && country.trim();
 
  async function generate() {
    setStage("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, skills, budget, country }),
      });
      const json = await res.json();
 
      if (res.status === 402) {
        const url = ref ? `${json.checkoutUrl}&ref=${encodeURIComponent(ref)}` : json.checkoutUrl;
        setCheckoutUrl(url);
        setStage("paywall");
        return;
      }
      if (res.status === 429) {
        setErrMsg(json.message || "You've hit today's limit. Try again later.");
        setStage("limited");
        return;
      }
      if (!res.ok) {
        setErrMsg(json.message || "Something went wrong.");
        setStage("error");
        return;
      }
 
      setData(json.data);
      setActiveTab("ideas");
      setStage("result");
    } catch (e) {
      setErrMsg("Network error. Please try again.");
      setStage("error");
    }
  }
 
  function reset() {
    setStage("form");
    setData(null);
    setSkills("");
    setBudget("");
    setCountry("");
  }
 
  return (
    <div style={{ minHeight: "100vh", padding: 0 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "2px solid var(--ink)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Stamp size={18} color="#1b2430" />
          </div>
          <div>
            <div className="fraunces" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
              Venture Compass
            </div>
            <div className="inter" style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(27,36,48,0.6)", marginTop: 2 }}>
              YOUR SKILLS, YOUR BUDGET, YOUR BUSINESS PLAN
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(27,36,48,0.13)", margin: "24px 0 40px" }} />
 
        {stage === "form" && (
          <div>
            <p className="inter" style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(27,36,48,0.8)", marginBottom: 36 }}>
              Tell us your skills, your budget, and your country. We'll compile a personalized dossier: three
              tailored business ideas, an itemized cost sheet, a marketing plan, and a profit estimate.
            </p>
 
            <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 40 }}>
              <Field
                icon={<Mail size={16} color="#08744a" />}
                label="Your email"
                placeholder="you@example.com"
                value={email}
                onChange={setEmail}
                type="email"
              />
              <Field
                icon={<Briefcase size={16} color="#08744a" />}
                label="Your skills or experience"
                placeholder="e.g. tailoring, phone repair, cooking, sales"
                value={skills}
                onChange={setSkills}
              />
              <Field
                icon={<DollarSign size={16} color="#08744a" />}
                label="Starting budget"
                placeholder="e.g. $500, ₦150,000, €300, no budget yet"
                value={budget}
                onChange={setBudget}
              />
              <Field
                icon={<Globe2 size={16} color="#08744a" />}
                label="Country"
                placeholder="e.g. Nigeria, United States, Philippines"
                value={country}
                onChange={setCountry}
              />
            </div>
 
            <button className="submit-btn" disabled={!canSubmit} onClick={generate}>
              Compile My Plan <ChevronRight size={16} />
            </button>
          </div>
        )}
 
        {stage === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", gap: 16 }}>
            <Loader2 className="spin" size={28} color="#1b2430" />
            <div className="inter" style={{ fontSize: 14, color: "rgba(27,36,48,0.6)" }}>Compiling your plan...</div>
          </div>
        )}
 
        {stage === "paywall" && (
          <div style={{ padding: "40px 0" }}>
            <div className="card" style={{ borderLeft: "4px solid #c9a227", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Lock size={18} color="#1b2430" />
                <span className="fraunces" style={{ fontSize: 19, fontWeight: 600 }}>Subscribe to continue</span>
              </div>
              <p className="inter" style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(27,36,48,0.85)" }}>
                Generating your plan takes an active subscription. Subscribe once and generate as many business
                dossiers as you need.
              </p>
            </div>
            <a href={checkoutUrl} className="submit-btn" style={{ textDecoration: "none" }}>
              Subscribe Now <ChevronRight size={16} />
            </a>
          </div>
        )}
 
        {stage === "limited" && (
          <div style={{ padding: "40px 0" }}>
            <p className="inter" style={{ color: "#b33a3a", marginBottom: 20 }}>{errMsg}</p>
            <button className="submit-btn ghost-btn" onClick={reset}>Back</button>
          </div>
        )}
 
        {stage === "error" && (
          <div style={{ padding: "40px 0" }}>
            <p className="inter" style={{ color: "#b33a3a", marginBottom: 20 }}>{errMsg}</p>
            <button className="submit-btn" onClick={generate}>Try Again</button>
          </div>
        )}
 
        {stage === "result" && data && (
          <div>
            <div style={{ display: "flex", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
              {["ideas", "costs", "marketing", "profit"].map((t) => (
                <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                  {t === "ideas" ? "Ideas" : t === "costs" ? "Startup Costs" : t === "marketing" ? "Marketing Plan" : "Profit Estimate"}
                </button>
              ))}
            </div>
 
            {activeTab === "ideas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {data.ideas.map((idea, i) => (
                  <div key={i} className="card" style={{ borderLeft: `4px solid ${i === 0 ? "#c9a227" : "#08744a"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div className="fraunces" style={{ fontSize: 19, fontWeight: 600 }}>{idea.name}</div>
                      {i === 0 && (
                        <span className="mono" style={{ fontSize: 10, color: "#c9a227", letterSpacing: "0.05em" }}>
                          TOP MATCH
                        </span>
                      )}
                    </div>
                    <p className="inter" style={{ fontSize: 14, lineHeight: 1.6, margin: "8px 0", color: "rgba(27,36,48,0.85)" }}>
                      {idea.pitch}
                    </p>
                    <p className="inter" style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(27,36,48,0.55)", fontStyle: "italic" }}>
                      {idea.whyFit}
                    </p>
                  </div>
                ))}
              </div>
            )}
 
            {activeTab === "costs" && (
              <div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {data.startupCosts.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(27,36,48,0.1)" }}>
                        <td className="inter" style={{ padding: "12px 4px", fontSize: 14 }}>{row.item}</td>
                        <td className="mono" style={{ padding: "12px 4px", fontSize: 14, textAlign: "right" }}>{row.estCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 4px 0", borderTop: "2px solid var(--ink)" }}>
                  <span className="inter" style={{ fontWeight: 600, fontSize: 14 }}>Total Estimate</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 16 }}>{data.totalCostEstimate}</span>
                </div>
              </div>
            )}
 
            {activeTab === "marketing" && (
              <div>
                <p className="inter" style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>{data.marketingPlan.positioning}</p>
                <div className="inter" style={{ fontSize: 12, letterSpacing: "0.06em", color: "rgba(27,36,48,0.55)", marginBottom: 10, textTransform: "uppercase" }}>
                  Channels
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {data.marketingPlan.channels.map((c, i) => (
                    <div key={i} className="inter" style={{ display: "flex", gap: 12, fontSize: 14 }}>
                      <span style={{ fontWeight: 600, minWidth: 130 }}>{c.channel}</span>
                      <span style={{ color: "rgba(27,36,48,0.8)" }}>{c.tactic}</span>
                    </div>
                  ))}
                </div>
                <div className="inter" style={{ fontSize: 12, letterSpacing: "0.06em", color: "rgba(27,36,48,0.55)", marginBottom: 10, textTransform: "uppercase" }}>
                  First 90 Days
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.marketingPlan.firstNinetyDays.map((m, i) => (
                    <div key={i} className="inter" style={{ fontSize: 14, display: "flex", gap: 10 }}>
                      <span className="mono" style={{ color: "#b33a3a" }}>{String(i + 1).padStart(2, "0")}</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
 
            {activeTab === "profit" && (
              <div>
                <div className="dossier-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  <Stat label="Monthly Revenue (Low)" value={data.profitEstimate.monthlyRevenueLow} />
                  <Stat label="Monthly Revenue (High)" value={data.profitEstimate.monthlyRevenueHigh} />
                  <Stat label="Monthly Costs" value={data.profitEstimate.monthlyCosts} />
                  <Stat label="Break-even" value={data.profitEstimate.breakEvenTimeframe} />
                </div>
                <p className="inter" style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(27,36,48,0.55)", fontStyle: "italic" }}>
                  Assumptions: {data.profitEstimate.assumptions}
                </p>
              </div>
            )}
 
            <div style={{ marginTop: 40 }}>
              <button className="submit-btn ghost-btn" onClick={reset}>
                <RotateCcw size={14} /> New Dossier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
 
function Field({ icon, label, placeholder, value, onChange, type = "text" }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {icon}
        <label className="inter" style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(27,36,48,0.6)" }}>
          {label}
        </label>
      </div>
      <input className="field-input" type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
 
function Stat({ label, value }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div className="inter" style={{ fontSize: 11, letterSpacing: "0.06em", color: "rgba(27,36,48,0.55)", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
