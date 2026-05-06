import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── CONSTANTS ──────────────────────────────────────────────────────
const STAGES = [
  { id: 1, title: "The Process", subtitle: "Understand the flow" },
  { id: 2, title: "The Reality", subtitle: "Explore source systems" },
  { id: 3, title: "The Event Log", subtitle: "Learn the 3 pillars" },
  { id: 4, title: "The Transformation", subtitle: "Write the ETL" },
  { id: 5, title: "The KPIs", subtitle: "Code the metrics" },
  { id: 6, title: "Quality Check", subtitle: "Break things" },
  { id: 7, title: "The Detective", subtitle: "Find the bugs" },
  { id: 8, title: "The Dashboard", subtitle: "The reveal" },
];

const CORRECT_ORDER = ["Create PO", "Approve PO", "Receive Goods", "Record Invoice", "Process Payment"];

const TOOLTIPS = {
  process_build: "In real projects, even agreeing on the process steps can take weeks. Different departments often have completely different ideas of what the process looks like.",
  source_erp: "ERP systems like SAP store data across hundreds of tables. Finding the right one is like looking for a needle in a haystack — except the haystack has 80,000 tables.",
  source_excel: "You'd be surprised how often critical process data lives in someone's personal Excel file. One client had their entire approval workflow tracked in a spreadsheet named 'Copy of Copy of Final_v3.xlsx'.",
  source_email: "Email-based approvals are a data engineer's nightmare. The timestamp exists, the activity exists, but extracting structured data from free-text emails requires serious creativity.",
  wrong_field: "Picking the wrong field is one of the most common mistakes. It might look right in a sample of 10 rows, but break completely when you scale to 100,000 cases.",
  case_id_wrong: "On one project, we accidentally used the invoice number instead of the PO number as case ID. The process map showed every case as a single straight line — because every 'case' only had one event. It took two days to figure out why.",
  case_id_right: "The case ID is the glue that holds everything together. Without it, you just have a pile of disconnected events — like having puzzle pieces from 10,000 different puzzles in one box.",
  activity_mapping: "Raw systems don't speak 'process.' On every project, the data engineer needs a functional consultant or documentation to decode the codes. Without that handoff, status code '08' is just a number. One project stalled for two weeks because the consultant was on holiday and nobody else knew what the codes meant.",
  timestamp_timezone: "A client once had their process show payments happening before invoices. Turned out one system logged in UTC and another in local time. Three hours of 'time travel' in the data.",
  timestamp_format: "Date formats are a classic headache. Is 01/02/2024 January 2nd or February 1st? In one project, this ambiguity caused a full month of process variants to appear that didn't actually exist.",
  quality_no_timestamp: "Without timestamps, process mining becomes a glorified flowchart. You lose all performance analysis — no bottleneck detection, no waiting times, no SLA monitoring.",
  quality_no_caseid: "Without case IDs, every event floats independently. The tool can't reconstruct any process flow because it doesn't know which events belong together.",
  quality_unmapped: "Unmapped activities appear as cryptic codes in your dashboard. Imagine presenting to the CFO and the biggest bottleneck shows up as 'STAT_CHG_42'.",
  dashboard_reveal: "The 15 minutes of dashboard time your stakeholders see represents weeks of extraction, cleaning, mapping, and validation work. That's the iceberg under the waterline.",
  sql_join: "In a real project you might join 5-15 tables. Each join is a decision point: INNER vs LEFT, which key to join on, how to handle duplicates. One wrong join can silently multiply your rows.",
  sql_casewhen: "CASE WHEN statements are the workhorse of activity mapping. But they're only as good as the documentation behind them — you need a data dictionary or functional consultant to tell you what FRGZU='08' actually means. One wrong mapping and your biggest bottleneck shows up under the wrong name.",
  kpi_throughput: "Throughput time is the most asked-for KPI, but it's meaningless if your timestamps are wrong. A 2-hour timezone error can make your average throughput look 2 hours longer across every single case.",
  kpi_conformance: "Conformance checking compares reality vs. the ideal. It often reveals that the 'standard process' only accounts for 30-40% of actual cases. The rest are variants nobody documented.",
};

// ─── SHARED COMPONENTS ──────────────────────────────────────────────
const Tooltip = ({ text, children, position = "top" }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", zIndex: 50, width: 288, padding: "12px 16px", borderRadius: 12,
          fontSize: 13, lineHeight: 1.55, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          background: "#1a1a2e", color: "#e8dcc8", border: "1.5px solid #f4a261",
          fontFamily: "'DM Sans', sans-serif", pointerEvents: "none",
          ...(position === "top" ? { bottom: "100%", marginBottom: 8, left: "50%", transform: "translateX(-50%)" }
            : position === "bottom" ? { top: "100%", marginTop: 8, left: "50%", transform: "translateX(-50%)" }
            : { top: 0, left: "100%", marginLeft: 8 }),
        }}>
          <span style={{ color: "#f4a261", fontWeight: 700 }}>Real-world story: </span>{text}
        </span>
      )}
    </span>
  );
};

const InfoDot = ({ tip, position = "top" }) => (
  <Tooltip text={tip} position={position}>
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: "50%", fontSize: 13, fontWeight: 800,
      background: "#f4a261", color: "#1a1a2e", cursor: "help", marginLeft: 6,
      fontFamily: "'DM Mono', monospace", flexShrink: 0, verticalAlign: "middle",
    }}>?</span>
  </Tooltip>
);

const CodeBlock = ({ code, language = "sql" }) => (
  <pre style={{
    background: "#0d0d1a", border: "1.5px solid #2a2a4a", borderRadius: 10, padding: "14px 18px",
    fontFamily: "'DM Mono', monospace", fontSize: 12.5, lineHeight: 1.7, color: "#c8d8e8",
    overflowX: "auto", margin: "12px 0", textAlign: "left", whiteSpace: "pre",
  }}>
    <span style={{ color: "#5a5a7a", fontSize: 11, display: "block", marginBottom: 6 }}>-- {language.toUpperCase()}</span>
    {code}
  </pre>
);

const LearnCard = ({ icon, title, children }) => (
  <div style={{
    background: "rgba(244,162,97,0.04)", border: "1.5px solid #2a2a4a", borderRadius: 12,
    padding: "16px 20px", marginBottom: 12,
  }}>
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#f4a261", marginBottom: 8 }}>
      {icon} {title}
    </div>
    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#c8c0b4", lineHeight: 1.65 }}>
      {children}
    </div>
  </div>
);

const PhaseButton = ({ onClick, children, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "12px 28px", borderRadius: 10, border: "2px solid #f4a261",
    background: disabled ? "transparent" : "#f4a261",
    color: disabled ? "#5a5a7a" : "#1a1a2e",
    fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s",
    opacity: disabled ? 0.4 : 1,
  }}>
    {children}
  </button>
);

const SectionDivider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 20px 0" }}>
    <div style={{ flex: 1, height: 1, background: "#2a2a4a" }} />
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#5a5a7a", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: "#2a2a4a" }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// STAGE 1 — THE PROCESS
// ═══════════════════════════════════════════════════════════════════
const Stage1 = ({ onComplete }) => {
  const [phase, setPhase] = useState("learn"); // learn | do
  const [slots, setSlots] = useState(Array(5).fill(null));
  const [available, setAvailable] = useState(
    ["Receive Goods", "Process Payment", "Create PO", "Record Invoice", "Approve PO"].sort(() => Math.random() - 0.5)
  );
  const [dragItem, setDragItem] = useState(null);
  const [correct, setCorrect] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleDrop = (idx) => {
    if (!dragItem || slots[idx]) return;
    setSlots(s => { const n = [...s]; n[idx] = dragItem; return n; });
    setAvailable(a => a.filter(x => x !== dragItem));
    setDragItem(null);
    setChecked(false);
  };

  const handleRemove = (idx) => {
    if (!slots[idx] || correct) return;
    setAvailable(a => [...a, slots[idx]]);
    setSlots(s => { const n = [...s]; n[idx] = null; return n; });
    setChecked(false);
  };

  const checkOrder = () => {
    setChecked(true);
    if (slots.every((s, i) => s === CORRECT_ORDER[i])) setCorrect(true);
  };

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>What is Process Mining?</h2>
      <p style={introStyle}>
        Process mining uses <strong style={{ color: "#f4a261" }}>event data</strong> from IT systems to reconstruct and analyze how business processes actually run — not how they're documented, but how they <em>really</em> happen. Before we can mine a process, we first need to understand the <strong style={{ color: "#f4a261" }}>intended process flow</strong>. That's where the process engineer's map comes in.
      </p>

      <LearnCard icon="📦" title="Our example: Purchase-to-Pay (P2P)">
        Purchase-to-Pay is one of the most commonly mined processes. It covers the full lifecycle of a purchase from the buyer's side — from someone in the company creating a purchase order, through approvals and goods receipt, all the way to paying the supplier. It typically touches the procurement, warehouse, and finance departments.
      </LearnCard>

      <LearnCard icon="🗺️" title="The 5 steps in our simplified P2P">
        <div style={{ marginTop: 6 }}>
          <strong style={{ color: "#e8dcc8" }}>Create PO</strong> — A purchase order is created in the system<br />
          <strong style={{ color: "#e8dcc8" }}>Approve PO</strong> — A manager reviews and releases the PO<br />
          <strong style={{ color: "#e8dcc8" }}>Receive Goods</strong> — The warehouse confirms physical receipt<br />
          <strong style={{ color: "#e8dcc8" }}>Record Invoice</strong> — Finance logs the supplier's invoice<br />
          <strong style={{ color: "#e8dcc8" }}>Process Payment</strong> — Payment is executed to the supplier
        </div>
      </LearnCard>

      <LearnCard icon="⚡" title="Why the order matters">
        Process mining tools reconstruct the flow from timestamps. If events are out of order, the tool will show the wrong process. The sequence above represents the <em>happy path</em> — in reality, there will be loops, rework, and exceptions. But the happy path is our starting point.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Got it — let me build the flow →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>
        Build the Process Flow
        <InfoDot tip={TOOLTIPS.process_build} />
      </h2>
      <p style={introStyle}>
        Drag the activities into the correct order — from start to finish.
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
        {available.map(item => (
          <div key={item} draggable onDragStart={() => setDragItem(item)}
            style={{
              padding: "10px 18px", borderRadius: 10, cursor: "grab",
              background: "#2a2a4a", border: "2px solid #f4a261", color: "#f4a261",
              fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600,
              userSelect: "none",
            }}>{item}</div>
        ))}
        {available.length === 0 && <div style={{ color: "#5a5a7a", fontStyle: "italic", fontSize: 14 }}>All activities placed!</div>}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginBottom: 28 }}>
        {slots.map((slot, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(i)} onClick={() => handleRemove(i)}
              style={{
                width: 155, height: 52, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px dashed ${slot ? (checked ? (slot === CORRECT_ORDER[i] ? "#2ecc71" : "#e74c3c") : "#f4a261") : "#5a5a7a"}`,
                background: slot ? (checked ? (slot === CORRECT_ORDER[i] ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)") : "rgba(244,162,97,0.08)") : "rgba(42,42,74,0.3)",
                fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600,
                color: slot ? "#e8dcc8" : "#5a5a7a", cursor: slot ? "pointer" : "default",
              }}>{slot || `Step ${i + 1}`}</div>
            {i < 4 && <span style={{ color: "#5a5a7a", fontSize: 20 }}>→</span>}
          </div>
        ))}
      </div>

      {checked && !correct && (
        <p style={{ color: "#e74c3c", fontFamily: "'DM Sans', sans-serif", fontSize: 14, marginBottom: 12 }}>
          Not quite — click on misplaced activities to rearrange.
        </p>
      )}

      {correct ? (
        <div style={{ animation: "fadeIn 0.5s ease" }}>
          <p style={{ color: "#2ecc71", fontSize: 16, fontWeight: 600, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>✓ That's the ideal Purchase-to-Pay flow. Now let's see where this data actually lives...</p>
          <PhaseButton onClick={onComplete}>Continue →</PhaseButton>
        </div>
      ) : (
        <PhaseButton onClick={checkOrder} disabled={slots.some(s => !s)}>Check Order</PhaseButton>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 2 — THE REALITY
// ═══════════════════════════════════════════════════════════════════
const SOURCE_SYSTEMS = {
  erp: {
    name: "SAP ERP", tip: TOOLTIPS.source_erp,
    headers: ["EBELN", "EBELP", "AEDAT", "ERNAM", "BSART", "BUKRS", "LOEKZ", "FRGZU"],
    rows: [
      ["4500017823", "00010", "2024-01-15T09:23:11Z", "JSMITH", "NB", "1000", "", "08"],
      ["4500017823", "00020", "2024-01-15T09:23:11Z", "JSMITH", "NB", "1000", "", "08"],
      ["4500017824", "00010", "2024-01-16T14:02:45Z", "MWILSON", "NB", "2000", "L", ""],
      ["4500017825", "00010", "", "ABROWN", "NB", "1000", "", "04"],
    ],
    issues: [
      { row: 2, col: 6, msg: "This PO line was flagged for deletion (LOEKZ='L'). Should you include deleted items? This decision affects your case count." },
      { row: 3, col: 2, msg: "Empty timestamp! Someone started a PO but the system didn't log when. This happens more often than you'd think." },
      { row: 0, col: 0, msg: "EBELN is the PO number — but it's not labeled 'PO Number' anywhere. You need domain knowledge to know this." },
      { row: 0, col: 7, msg: "FRGZU is the release status. '08' means fully approved, '04' means partially. These codes are SAP-specific — good luck googling them." },
    ],
  },
  excel: {
    name: "Excel Export", tip: TOOLTIPS.source_excel,
    headers: ["PO #", "GR Date", "GR Qty", "Received By", "Warehouse", "Notes"],
    rows: [
      ["4500017823", "15-Jan-2024", "100", "Tom H.", "WH-01", "partial delivery"],
      ["4500017823", "22-Jan-2024", "400", "Tom H.", "WH-01", "remaining qty"],
      ["4500017825", "01/28/2024", "250", "Sara K.", "WH-03", ""],
      ["PO4500017826", "2024-02-01", "50", "Tom H.", "WH-01", "URGENT"],
    ],
    issues: [
      { row: 0, col: 1, msg: "Date format: 'dd-MMM-yyyy'. The ERP uses ISO format. Mixing formats is a guaranteed headache during transformation." },
      { row: 2, col: 1, msg: "This one uses MM/DD/YYYY! Someone manually typed it differently. Three date formats across two systems." },
      { row: 3, col: 0, msg: "Someone added a 'PO' prefix that doesn't exist in SAP. This will fail to join unless you strip it first." },
      { row: 3, col: 5, msg: "'URGENT' — humans love adding context that machines can't process. This is noise for your event log." },
    ],
  },
  email: {
    name: "Approval Emails", tip: TOOLTIPS.source_email,
    headers: ["From", "To", "Subject", "Date", "Body snippet"],
    rows: [
      ["j.manager@corp.com", "procurement@corp.com", "RE: PO 4500017823 Approved", "Jan 15, 2024 11:45 AM", "Approved. Please proceed."],
      ["j.manager@corp.com", "procurement@corp.com", "RE: PO 4500017825", "Jan 17, 2024 3:20 PM", "Looks fine, go ahead"],
      ["cfo@corp.com", "j.manager@corp.com", "Fwd: Budget concerns", "Jan 18, 2024 9:00 AM", "Hold PO 4500017825 for now"],
      ["j.manager@corp.com", "procurement@corp.com", "PO 4500017825 — ok now", "Jan 22, 2024 2:10 PM", "CFO signed off. Approved."],
    ],
    issues: [
      { row: 1, col: 4, msg: "'Looks fine, go ahead' — is this an official approval? There's no status field. You'd need NLP or manual rules to classify this." },
      { row: 2, col: 4, msg: "A hold communicated only by email. If you miss this, your process model won't show that this case was blocked for 5 days." },
      { row: 3, col: 3, msg: "The final approval came a week later. This waiting time is invisible in the ERP — it only lives in email threads." },
    ],
  },
};

const Stage2 = ({ onComplete, stats }) => {
  const [phase, setPhase] = useState("learn");
  const [activeSystem, setActiveSystem] = useState(null);
  const [found, setFound] = useState(new Set());
  const totalIssues = Object.values(SOURCE_SYSTEMS).reduce((s, sys) => s + sys.issues.length, 0);

  const handleCellClick = (sysKey, row, col) => {
    const issue = SOURCE_SYSTEMS[sysKey].issues.find(i => i.row === row && i.col === col);
    if (issue) {
      const key = `${sysKey}-${row}-${col}`;
      const newFound = new Set(found);
      newFound.add(key);
      setFound(newFound);
      stats.current.issuesFound = newFound.size;
    }
  };

  const isIssueCell = (sysKey, row, col) => SOURCE_SYSTEMS[sysKey].issues.some(i => i.row === row && i.col === col);
  const isFound = (sysKey, row, col) => found.has(`${sysKey}-${row}-${col}`);
  const getIssueTip = (sysKey, row, col) => SOURCE_SYSTEMS[sysKey].issues.find(i => i.row === row && i.col === col)?.msg;

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Where Does the Data Actually Live?</h2>
      <p style={introStyle}>
        You might expect the process data to sit neatly in one database. In reality, it's scattered across multiple systems — each with its own structure, naming conventions, and quirks. The data engineer's first job is to <strong style={{ color: "#f4a261" }}>find and understand</strong> these sources before writing a single line of code.
      </p>

      <LearnCard icon="🏢" title="ERP Systems (e.g., SAP, Oracle)">
        The backbone of most P2P processes. ERPs store structured transactional data — but with cryptic column names like <code style={codeInline}>EBELN</code>, <code style={codeInline}>FRGZU</code>, and <code style={codeInline}>BUKRS</code>. No human-readable labels. You need SAP documentation or a functional consultant to decode them.
      </LearnCard>

      <LearnCard icon="📊" title="Spreadsheets & Manual Exports">
        Many sub-processes are tracked in Excel. Warehouse staff might log goods receipts in a shared spreadsheet. These files often have inconsistent date formats, typos, and ad-hoc prefixes. They're hard to join to ERP data.
      </LearnCard>

      <LearnCard icon="📧" title="Email & Unstructured Sources">
        Some activities — especially approvals and escalations — happen over email. The data is there, but it's trapped in free text. Extracting structured events from emails is one of the hardest data engineering challenges.
      </LearnCard>

      <LearnCard icon="🔍" title="Your task: be a data detective">
        Next, you'll explore three source systems. Click on cells that look suspicious — wrong formats, missing values, cryptic codes. Each issue you spot is something the data engineer has to handle before the data is usable.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Start exploring →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Explore the Source Systems</h2>
      <p style={introStyle}>
        Click on suspicious cells to uncover data issues. Hover discovered issues to see why they matter.
      </p>
      <p style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#f4a261", marginBottom: 20 }}>
        Issues discovered: {found.size} / {totalIssues}
      </p>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18, flexWrap: "wrap" }}>
        {Object.entries(SOURCE_SYSTEMS).map(([key, sys]) => (
          <button key={key} onClick={() => setActiveSystem(key === activeSystem ? null : key)}
            style={{
              padding: "10px 18px", borderRadius: 10,
              border: `2px solid ${activeSystem === key ? "#f4a261" : "#3a3a5a"}`,
              background: activeSystem === key ? "rgba(244,162,97,0.12)" : "#1e1e38",
              color: activeSystem === key ? "#f4a261" : "#a89b8c",
              fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
            {sys.name} <InfoDot tip={sys.tip} position="bottom" />
          </button>
        ))}
      </div>

      {activeSystem && (
        <div style={{ overflowX: "auto", marginBottom: 20, animation: "fadeIn 0.3s ease" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
            <thead><tr>
              {SOURCE_SYSTEMS[activeSystem].headers.map((h, i) => (
                <th key={i} style={{ padding: "8px 10px", borderBottom: "2px solid #3a3a5a", color: "#a89b8c", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {SOURCE_SYSTEMS[activeSystem].rows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => {
                  const hasIssue = isIssueCell(activeSystem, ri, ci);
                  const wasFound = isFound(activeSystem, ri, ci);
                  const tip = getIssueTip(activeSystem, ri, ci);
                  const inner = (
                    <td key={ci} onClick={() => handleCellClick(activeSystem, ri, ci)} style={{
                      padding: "8px 10px", borderBottom: "1px solid #2a2a4a", whiteSpace: "nowrap",
                      color: wasFound ? "#f4a261" : hasIssue ? "#e8dcc8" : "#7a7a9a",
                      background: wasFound ? "rgba(244,162,97,0.08)" : hasIssue ? "rgba(244,162,97,0.03)" : "transparent",
                      cursor: hasIssue ? "pointer" : "default",
                      textDecoration: wasFound ? "underline wavy #f4a261" : "none",
                    }}>{cell || <span style={{ color: "#e74c3c", fontStyle: "italic" }}>NULL</span>}</td>
                  );
                  return wasFound && tip ? <Tooltip key={ci} text={tip} position="bottom">{inner}</Tooltip> : inner;
                })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {found.size >= Math.ceil(totalIssues * 0.6) && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
          <p style={{ color: "#2ecc71", fontSize: 15, fontWeight: 600, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
            ✓ Nice work! You've found {found.size === totalIssues ? "all" : "enough"} issues. Now let's learn how to structure this into an event log.
          </p>
          <PhaseButton onClick={onComplete}>Continue →</PhaseButton>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 3 — THE EVENT LOG (learn the 3 pillars, then extract fields)
// ═══════════════════════════════════════════════════════════════════
const EXTRACTION_FIELDS = [
  { field: "EBELN", desc: "Purchase document number", correct: true, role: "case_id", feedback: "Correct! The PO number uniquely identifies each process instance." },
  { field: "AEDAT", desc: "Created on date", correct: true, role: "timestamp", feedback: "Correct! This is the timestamp that records when this event occurred." },
  { field: "ERNAM", desc: "Created by (username)", correct: false, feedback: "This tells you WHO did it, not WHAT happened or WHEN. Useful metadata, but not a pillar." },
  { field: "BSART", desc: "Document type code", correct: false, feedback: "Document type (e.g. 'NB' = standard PO). Categorizes the case, but isn't an event." },
  { field: "FRGZU", desc: "Release status indicator", correct: true, role: "activity", feedback: "Correct! The release status encodes which activity happened (approval stage)." },
  { field: "BUKRS", desc: "Company code", correct: false, feedback: "An organizational attribute. Important for filtering, but not an event log pillar." },
  { field: "LOEKZ", desc: "Deletion indicator", correct: false, feedback: "A flag, not an event. It hints something happened, but lacks a timestamp of when." },
  { field: "EBELP", desc: "PO line item number", correct: false, feedback: "Line item detail — affects granularity decisions, but not a pillar." },
];

const Stage3 = ({ onComplete, stats }) => {
  const [phase, setPhase] = useState("learn");
  const [selected, setSelected] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const toggle = (f) => { if (submitted) return; const n = new Set(selected); n.has(f) ? n.delete(f) : n.add(f); setSelected(n); };
  const correctFieldNames = EXTRACTION_FIELDS.filter(f => f.correct).map(f => f.field);
  const allCorrect = submitted && correctFieldNames.every(f => selected.has(f)) && [...selected].every(f => correctFieldNames.includes(f));

  const check = () => {
    setSubmitted(true);
    setAttempts(a => a + 1);
    if (correctFieldNames.every(f => selected.has(f)) && [...selected].every(f => correctFieldNames.includes(f))) {
      stats.current.extractionAttempts = attempts + 1;
    }
  };
  const retry = () => { setSubmitted(false); setSelected(new Set()); };

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>The Three Pillars of an Event Log</h2>
      <p style={introStyle}>
        Before we can do process mining, we need to transform raw data into an <strong style={{ color: "#f4a261" }}>event log</strong>. An event log is a structured table where every row is one event — one thing that happened to one case at one point in time. Every event log requires exactly three pillars:
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { color: "#f4a261", title: "Case ID", icon: "🔗", desc: "Which process instance does this event belong to? In P2P, this is the Purchase Order number. It groups all events of the same case together." },
          { color: "#e76f51", title: "Activity", icon: "⚡", desc: "What happened? This is the name of the process step — 'Create PO', 'Approve PO', etc. Raw systems often store these as cryptic status codes, not readable names." },
          { color: "#2a9d8f", title: "Timestamp", icon: "🕐", desc: "When did it happen? This determines the sequence of events and enables all performance analysis — throughput times, bottlenecks, SLA monitoring." },
        ].map(p => (
          <div key={p.title} style={{
            background: "rgba(0,0,0,0.15)", border: `2px solid ${p.color}`, borderRadius: 12,
            padding: "16px 18px",
          }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: p.color, marginBottom: 6 }}>
              {p.icon} {p.title}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#c8c0b4", lineHeight: 1.6 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <LearnCard icon="📋" title="What a finished event log looks like">
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12, width: "100%" }}>
            <thead><tr>
              {["Case ID", "Activity", "Timestamp"].map((h, i) => (
                <th key={h} style={{ padding: "6px 12px", borderBottom: `2px solid ${["#f4a261", "#e76f51", "#2a9d8f"][i]}`, color: ["#f4a261", "#e76f51", "#2a9d8f"][i], textAlign: "left" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                ["4500017823", "Create PO", "2024-01-15 10:23:11"],
                ["4500017823", "Approve PO", "2024-01-15 11:45:00"],
                ["4500017823", "Receive Goods", "2024-01-22 14:30:00"],
                ["4500017824", "Create PO", "2024-01-16 14:02:45"],
              ].map((r, i) => (
                <tr key={i}>{r.map((c, j) => (
                  <td key={j} style={{ padding: "6px 12px", borderBottom: "1px solid #2a2a4a", color: "#c8c0b4" }}>{c}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </LearnCard>

      <LearnCard icon="🎯" title="Your task">
        Next, you'll see the SAP ERP fields from Stage 2. Select exactly the <strong>3 fields</strong> that map to Case ID, Activity, and Timestamp. The rest are noise — useful metadata, but not event log pillars.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Let me pick the fields →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Extract the Three Pillars <InfoDot tip={TOOLTIPS.wrong_field} /></h2>
      <p style={introStyle}>
        Select the 3 fields from the SAP table that map to <strong style={{ color: "#f4a261" }}>Case ID</strong>, <strong style={{ color: "#e76f51" }}>Activity</strong>, and <strong style={{ color: "#2a9d8f" }}>Timestamp</strong>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 24 }}>
        {EXTRACTION_FIELDS.map(f => {
          const isSel = selected.has(f.field);
          const isC = f.correct;
          let border = isSel ? "#f4a261" : "#3a3a5a";
          let bg = isSel ? "rgba(244,162,97,0.08)" : "transparent";
          if (submitted && isSel) { border = isC ? "#2ecc71" : "#e74c3c"; bg = isC ? "rgba(46,204,113,0.08)" : "rgba(231,76,60,0.06)"; }
          if (submitted && !isSel && isC) { border = "#2ecc71"; bg = "rgba(46,204,113,0.04)"; }
          return (
            <div key={f.field} onClick={() => toggle(f.field)} style={{
              padding: "12px 16px", borderRadius: 10, border: `2px solid ${border}`, background: bg,
              cursor: submitted ? "default" : "pointer",
            }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: "#e8dcc8", marginBottom: 4 }}>
                {f.field}
                {submitted && isC && <span style={{ marginLeft: 8, fontSize: 12, color: f.role === "case_id" ? "#f4a261" : f.role === "activity" ? "#e76f51" : "#2a9d8f" }}>● {f.role === "case_id" ? "Case ID" : f.role === "activity" ? "Activity" : "Timestamp"}</span>}
              </div>
              <div style={{ fontSize: 13, color: "#7a7a9a", fontFamily: "'DM Sans', sans-serif" }}>{f.desc}</div>
              {submitted && <div style={{ marginTop: 8, fontSize: 12, color: isC ? "#2ecc71" : isSel ? "#e74c3c" : "#5a5a7a", fontStyle: isC || isSel ? "normal" : "italic", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{f.feedback}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center" }}>
        {!submitted && <PhaseButton onClick={check} disabled={selected.size === 0}>Check Selection</PhaseButton>}
        {submitted && !allCorrect && <PhaseButton onClick={retry}>Try Again</PhaseButton>}
        {allCorrect && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            <p style={{ color: "#2ecc71", fontSize: 15, fontWeight: 600, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
              ✓ {attempts === 1 ? "First try!" : "Got it!"} Now let's write the actual transformation code.
            </p>
            <PhaseButton onClick={onComplete}>Continue →</PhaseButton>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 4 — THE TRANSFORMATION (SQL / ETL code)
// ═══════════════════════════════════════════════════════════════════
const CASE_ID_OPTIONS = [
  { field: "EBELP (Line Item)", correct: false, tip: TOOLTIPS.case_id_wrong, result: "12,847 cases — each line item becomes its own case. Straight lines only." },
  { field: "EBELN (PO Number)", correct: true, tip: TOOLTIPS.case_id_right, result: "3,241 cases — events correctly grouped by purchase order." },
  { field: "ERNAM (Username)", correct: false, tip: "Using username means all of John's POs become one mega-case with 500 activities.", result: "47 cases — each user's history merged. Meaningless." },
  { field: "BUKRS (Company Code)", correct: false, tip: "Company code groups thousands of POs into a single case.", result: "3 cases — one per company. Completely unusable." },
];

const ACTIVITY_MAPPINGS = [
  { code: "FRGZU = '08'", correctActivity: "Approve PO", options: ["Create PO", "Approve PO", "Record Invoice", "Process Payment"] },
  { code: "FRGZU = '04'", correctActivity: "Partial Approval", options: ["Create PO", "Partial Approval", "Receive Goods", "Approve PO"] },
  { code: "GR_POSTED = TRUE", correctActivity: "Receive Goods", options: ["Create PO", "Record Invoice", "Receive Goods", "Process Payment"] },
  { code: "RE_STATUS = 'POSTED'", correctActivity: "Record Invoice", options: ["Approve PO", "Record Invoice", "Receive Goods", "Create PO"] },
];

const Stage4 = ({ onComplete, stats }) => {
  const [phase, setPhase] = useState("learn");
  const [subStage, setSubStage] = useState("caseid"); // caseid | activity | timestamp
  const [caseIdChoice, setCaseIdChoice] = useState(null);
  const [activityMappings, setActivityMappings] = useState({});
  const [timestampDone, setTimestampDone] = useState(false);

  const correctActivities = ACTIVITY_MAPPINGS.every((m, i) => activityMappings[i] === m.correctActivity);

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Writing the Transformation</h2>
      <p style={introStyle}>
        Now comes the core of the data engineer's work: writing the code that turns raw source data into a clean event log.
        This typically involves <strong style={{ color: "#f4a261" }}>SQL queries</strong> or <strong style={{ color: "#f4a261" }}>Python scripts</strong> that extract, join, clean, and reshape the data. Let's walk through what these transformations look like.
      </p>

      <SectionDivider label="Step 1: Join the sources" />
      <LearnCard icon="🔗" title="SQL JOINs — connecting the systems">
        The first challenge is combining data from different systems. We need to join the ERP data with the Excel goods receipts and email approvals — all using the PO number as the key. But remember: the Excel sheet sometimes has a "PO" prefix, and the emails embed the number in free text.
        <InfoDot tip={TOOLTIPS.sql_join} position="right" />
      </LearnCard>

      <CodeBlock code={`SELECT
  ekpo.EBELN            AS case_id,
  ekpo.AEDAT            AS timestamp_raw,
  ekpo.FRGZU            AS status_code,
  gr.gr_date            AS gr_timestamp,
  email.approval_date   AS email_timestamp
FROM sap_ekpo ekpo
LEFT JOIN excel_goods_receipt gr
  ON ekpo.EBELN = REPLACE(gr."PO #", 'PO', '')
LEFT JOIN parsed_emails email
  ON ekpo.EBELN = email.po_number
WHERE ekpo.LOEKZ = ''   -- exclude deleted POs`} />

      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#a89b8c", lineHeight: 1.65, marginBottom: 16 }}>
        Notice the <code style={codeInline}>REPLACE()</code> to strip the "PO" prefix from Excel, and the <code style={codeInline}>WHERE</code> clause to exclude deleted records.
        The <code style={codeInline}>LEFT JOIN</code> ensures we keep POs even if they don't have a goods receipt yet — they're still valid in-progress cases.
      </p>

      <SectionDivider label="Step 2: Map activities" />
      <LearnCard icon="⚡" title="CASE WHEN — translating codes to activities">
        Raw status codes need to be mapped to human-readable activity names. This is <strong>never</strong> guesswork — the data engineer consults a <strong style={{ color: "#e8dcc8" }}>data dictionary</strong> or works with a functional consultant to understand what each code means in the business context. Without documentation, codes like "FRGZU = 08" are meaningless.
        <InfoDot tip={TOOLTIPS.sql_casewhen} position="right" />
      </LearnCard>

      <CodeBlock code={`SELECT
  case_id,
  CASE
    WHEN source = 'ERP' AND status_code = '08'
      THEN 'Approve PO'
    WHEN source = 'ERP' AND status_code = '04'
      THEN 'Partial Approval'
    WHEN source = 'GR'  AND gr_posted = TRUE
      THEN 'Receive Goods'
    WHEN source = 'INV' AND re_status = 'POSTED'
      THEN 'Record Invoice'
    ELSE 'Unknown: ' || status_code
  END AS activity,
  timestamp_normalized
FROM joined_sources`} />

      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#a89b8c", lineHeight: 1.65, marginBottom: 16 }}>
        The <code style={codeInline}>ELSE 'Unknown:'</code> fallback is critical — it catches unmapped codes so they don't silently disappear. You'd rather see "Unknown: 06" in your log than miss events entirely.
      </p>

      <SectionDivider label="Step 3: Normalize timestamps" />
      <LearnCard icon="🕐" title="Date conversion & timezone alignment">
        Different systems use different date formats and timezones. The transformation must parse each format and convert everything to a single standard.
      </LearnCard>

      <CodeBlock code={`SELECT
  case_id,
  activity,
  CASE
    -- SAP: already ISO 8601, just convert from UTC to CET
    WHEN source = 'ERP'
      THEN CONVERT_TIMEZONE('UTC', 'CET', timestamp_raw)
    -- Excel: mixed formats, parse with TRY_TO_TIMESTAMP
    WHEN source = 'GR'
      THEN COALESCE(
        TRY_TO_TIMESTAMP(gr_date, 'DD-Mon-YYYY'),
        TRY_TO_TIMESTAMP(gr_date, 'MM/DD/YYYY'),
        TRY_TO_TIMESTAMP(gr_date, 'YYYY-MM-DD')
      )
    -- Email: human-readable US format
    WHEN source = 'EMAIL'
      THEN TRY_TO_TIMESTAMP(email_date, 'Mon DD, YYYY HH:MI AM')
  END AS event_timestamp
FROM activity_mapped_sources
ORDER BY case_id, event_timestamp`} />

      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#a89b8c", lineHeight: 1.65, marginBottom: 16 }}>
        The <code style={codeInline}>COALESCE</code> with <code style={codeInline}>TRY_TO_TIMESTAMP</code> tries three date formats for Excel — because users typed dates inconsistently. The final <code style={codeInline}>ORDER BY</code> ensures events are in chronological order per case.
      </p>

      <LearnCard icon="🎯" title="Your turn">
        Now that you've seen the code, let's walk through each of these three mapping decisions interactively. You'll choose the Case ID field, map activity codes, and spot timestamp problems.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Let me try the mappings →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Interactive Mapping</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {["caseid", "activity", "timestamp"].map((s, i) => (
          <span key={s} style={{
            fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: subStage === s ? "#f4a261" : "transparent",
            color: subStage === s ? "#1a1a2e" : "#5a5a7a",
          }}>{i + 1}. {s === "caseid" ? "Case ID" : s === "activity" ? "Activity Mapping" : "Timestamps"}</span>
        ))}
      </div>

      {/* 4a: Case ID */}
      {subStage === "caseid" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <p style={introStyle}>Which field should be the Case ID? Each choice produces a wildly different result. <InfoDot tip={TOOLTIPS.case_id_right} position="bottom" /></p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 16 }}>
            {CASE_ID_OPTIONS.map((opt, i) => {
              const chosen = caseIdChoice === i;
              return (
                <div key={i} onClick={() => { setCaseIdChoice(i); if (caseIdChoice === null) stats.current.caseIdFirstTry = opt.correct; }}
                  style={{
                    padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${chosen ? (opt.correct ? "#2ecc71" : "#e74c3c") : "#3a3a5a"}`,
                    background: chosen ? (opt.correct ? "rgba(46,204,113,0.08)" : "rgba(231,76,60,0.06)") : "transparent",
                  }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#e8dcc8", marginBottom: 6 }}>
                    {opt.field} <InfoDot tip={opt.tip} position="bottom" />
                  </div>
                  {chosen && <div style={{ fontSize: 13, color: opt.correct ? "#2ecc71" : "#e74c3c", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>→ {opt.result}</div>}
                </div>
              );
            })}
          </div>
          {caseIdChoice !== null && CASE_ID_OPTIONS[caseIdChoice].correct && (
            <div style={{ textAlign: "center", animation: "fadeIn 0.3s ease" }}>
              <PhaseButton onClick={() => setSubStage("activity")}>Next: Activity Mapping →</PhaseButton>
            </div>
          )}
        </div>
      )}

      {/* 4b: Activity Mapping */}
      {subStage === "activity" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <p style={introStyle}>
            In reality, you never guess what codes mean — you consult documentation. Below is a snippet from the data dictionary that the functional consultant shared with you. Use it to map each raw code to the correct activity.
            <InfoDot tip={TOOLTIPS.activity_mapping} position="bottom" />
          </p>

          {/* Documentation snippet */}
          <div style={{
            background: "#faf8f5", borderRadius: 12, padding: "18px 22px", marginBottom: 24,
            border: "1.5px solid #d4cfc7", position: "relative",
          }}>
            <div style={{ position: "absolute", top: 10, right: 14, fontSize: 11, color: "#a09888", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
              DATA DICTIONARY — CONFIDENTIAL
            </div>
            <h4 style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#3a3530", marginBottom: 14, borderBottom: "1px solid #e0dbd3", paddingBottom: 8 }}>
              📄 P2P Status Codes & Source Fields Reference
            </h4>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#5a4f44", marginBottom: 6 }}>
                Table: EKKO / EKPO — Purchase Order Header & Items
              </div>
              <table style={{ borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12, width: "100%" }}>
                <thead><tr>
                  {["Field", "Value", "Business Meaning", "Notes"].map(h => (
                    <th key={h} style={{ padding: "5px 10px", borderBottom: "2px solid #c8c0b4", color: "#6a5f54", textAlign: "left", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    ["FRGZU", "'08'", "Release (approval) complete", "PO fully approved by all required parties"],
                    ["FRGZU", "'04'", "Release partially complete", "First-level approval done, awaiting final sign-off"],
                    ["FRGZU", "'02'", "Release not yet started", "PO created but no approvals initiated"],
                    ["FRGZU", "'' (empty)", "No release procedure", "PO type does not require approval"],
                  ].map((r, i) => (
                    <tr key={i}>{r.map((c, j) => (
                      <td key={j} style={{ padding: "5px 10px", borderBottom: "1px solid #e8e2da", color: j === 1 ? "#b45309" : "#4a4540", fontSize: 11.5 }}>{c}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#5a4f44", marginBottom: 6 }}>
                Table: MKPF / MSEG — Goods Movement Documents
              </div>
              <table style={{ borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12, width: "100%" }}>
                <thead><tr>
                  {["Field", "Value", "Business Meaning"].map(h => (
                    <th key={h} style={{ padding: "5px 10px", borderBottom: "2px solid #c8c0b4", color: "#6a5f54", textAlign: "left", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    ["GR_POSTED", "TRUE", "Goods receipt posted — physical goods received at warehouse"],
                    ["GR_POSTED", "FALSE", "Goods receipt pending or cancelled"],
                  ].map((r, i) => (
                    <tr key={i}>{r.map((c, j) => (
                      <td key={j} style={{ padding: "5px 10px", borderBottom: "1px solid #e8e2da", color: j === 1 ? "#b45309" : "#4a4540", fontSize: 11.5 }}>{c}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#5a4f44", marginBottom: 6 }}>
                Table: RBKP — Invoice Document Header
              </div>
              <table style={{ borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12, width: "100%" }}>
                <thead><tr>
                  {["Field", "Value", "Business Meaning"].map(h => (
                    <th key={h} style={{ padding: "5px 10px", borderBottom: "2px solid #c8c0b4", color: "#6a5f54", textAlign: "left", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    ["RE_STATUS", "'POSTED'", "Invoice recorded and posted to financial accounting"],
                    ["RE_STATUS", "'PARKED'", "Invoice saved as draft, not yet posted"],
                    ["RE_STATUS", "'BLOCKED'", "Invoice blocked for payment (price or quantity variance)"],
                  ].map((r, i) => (
                    <tr key={i}>{r.map((c, j) => (
                      <td key={j} style={{ padding: "5px 10px", borderBottom: "1px solid #e8e2da", color: j === 1 ? "#b45309" : "#4a4540", fontSize: 11.5 }}>{c}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: "#8a8078", marginTop: 14, lineHeight: 1.5, fontStyle: "italic" }}>
              Document version 3.1 — Last updated by K. Müller (SAP Functional Consultant), 2024-01-08.
              This is the kind of documentation data engineers rely on. Without it, codes like FRGZU = '08' are meaningless.
            </p>
          </div>

          {/* Now the mapping exercise */}
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#c8c0b4", textAlign: "center", marginBottom: 16 }}>
            Now use the reference above to map each code to the right P2P activity:
          </p>
          <div style={{ display: "grid", gap: 12, maxWidth: 560, margin: "0 auto 20px auto" }}>
            {ACTIVITY_MAPPINGS.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#a89b8c", minWidth: 175 }}>{m.code}</span>
                <span style={{ color: "#5a5a7a" }}>→</span>
                <select value={activityMappings[i] || ""} onChange={e => setActivityMappings({ ...activityMappings, [i]: e.target.value })}
                  style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    border: `2px solid ${activityMappings[i] ? (activityMappings[i] === m.correctActivity ? "#2ecc71" : "#e74c3c") : "#3a3a5a"}`,
                    background: "#1e1e38", color: "#e8dcc8", fontFamily: "'DM Mono', monospace",
                  }}>
                  <option value="">Select...</option>
                  {m.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {activityMappings[i] && (activityMappings[i] === m.correctActivity ? <span style={{ color: "#2ecc71" }}>✓</span> : <span style={{ color: "#e74c3c" }}>✗</span>)}
              </div>
            ))}
          </div>
          {correctActivities && (
            <div style={{ textAlign: "center", animation: "fadeIn 0.3s ease" }}>
              <p style={{ color: "#2ecc71", fontSize: 14, marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>✓ All mapped! Notice how the documentation made this possible — without it, these codes are gibberish.</p>
              <PhaseButton onClick={() => setSubStage("timestamp")}>Next: Timestamps →</PhaseButton>
            </div>
          )}
        </div>
      )}

      {/* 4c: Timestamps */}
      {subStage === "timestamp" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <p style={introStyle}>Inspect these timestamps from different sources. Spot the problems before aligning them. <InfoDot tip={TOOLTIPS.timestamp_format} position="bottom" /></p>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
              <thead><tr>
                {["System", "Activity", "Raw Timestamp", "Format", "Timezone"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: "2px solid #3a3a5a", color: "#a89b8c", textAlign: "left" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { sys: "SAP ERP", act: "Create PO", raw: "2024-01-15T09:23:11Z", fmt: "ISO 8601", tz: "UTC", tricky: false },
                  { sys: "Excel", act: "Receive Goods", raw: "15-Jan-2024", fmt: "dd-MMM-yyyy", tz: "CET", tricky: true, tip: TOOLTIPS.timestamp_format },
                  { sys: "Email", act: "Approve PO", raw: "Jan 15, 2024 11:45 AM", fmt: "US readable", tz: "CET", tricky: false },
                  { sys: "SAP FI", act: "Process Payment", raw: "2024-02-03T23:15:00Z", fmt: "ISO 8601", tz: "UTC", tricky: true, tip: TOOLTIPS.timestamp_timezone },
                ].map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", color: "#7a7a9a" }}>{t.sys}</td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", color: "#e8dcc8" }}>{t.act}</td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", color: t.tricky ? "#f4a261" : "#e8dcc8" }}>
                      {t.raw} {t.tricky && <InfoDot tip={t.tip} position="bottom" />}
                    </td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", color: "#7a7a9a" }}>{t.fmt}</td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", color: t.tz !== "UTC" ? "#e76f51" : "#7a7a9a" }}>{t.tz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <LearnCard icon="⚠️" title="Two hidden problems here">
            <strong style={{ color: "#e8dcc8" }}>1)</strong> The Goods Receipt has no time component — only a date. You'll need to decide: use midnight? Interpolate? Flag it as low-precision?<br />
            <strong style={{ color: "#e8dcc8" }}>2)</strong> The Payment at 23:15 UTC is actually <strong style={{ color: "#f4a261" }}>Feb 4th</strong> in CET, not Feb 3rd. A timezone offset that crosses midnight changes the date — and potentially your SLA calculation.
          </LearnCard>

          {!timestampDone ? (
            <div style={{ textAlign: "center" }}>
              <PhaseButton onClick={() => setTimestampDone(true)}>Align to CET →</PhaseButton>
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.5s ease" }}>
              <div style={{ background: "rgba(46,204,113,0.08)", border: "2px solid #2ecc71", borderRadius: 12, padding: 16, marginBottom: 16, maxWidth: 460, margin: "0 auto 16px auto" }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#2ecc71", marginBottom: 8, fontWeight: 700 }}>✓ Aligned Event Log (CET):</p>
                {[
                  { a: "Create PO", t: "2024-01-15 10:23:11" },
                  { a: "Approve PO", t: "2024-01-15 11:45:00" },
                  { a: "Receive Goods", t: "2024-01-15 (time unknown)" },
                  { a: "Process Payment", t: "2024-02-04 00:15:00" },
                ].map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#e8dcc8" }}>
                    <span>{e.a}</span><span style={{ color: "#a89b8c" }}>{e.t}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center" }}>
                <PhaseButton onClick={onComplete}>Continue →</PhaseButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 5 — THE KPIs (learn about KPI calculations, then code them)
// ═══════════════════════════════════════════════════════════════════
const KPI_QUESTIONS = [
  {
    id: "throughput",
    title: "Throughput Time",
    question: "How do you calculate the total throughput time of a case?",
    code: `-- Throughput time per case
SELECT
  case_id,
  DATEDIFF('day',
    MIN(event_timestamp),
    MAX(event_timestamp)
  ) AS throughput_days
FROM event_log
GROUP BY case_id`,
    options: [
      { label: "MAX(timestamp) - MIN(timestamp) per case", correct: true },
      { label: "COUNT(events) × average step duration", correct: false, why: "This estimates but doesn't measure actual time. Real throughput must come from actual timestamps — estimated values hide bottlenecks and waiting times." },
      { label: "SUM of all timestamps", correct: false, why: "Summing timestamps is meaningless — timestamps are points in time, not durations. You need the difference between the first and last event." },
      { label: "Last event timestamp only", correct: false, why: "Without the first event, you have no start reference. You need both the start and end to calculate duration." },
    ],
  },
  {
    id: "bottleneck",
    title: "Bottleneck Detection",
    question: "How do you find the slowest transition between two activities?",
    code: `-- Waiting time between consecutive activities
SELECT
  activity                    AS from_activity,
  LEAD(activity) OVER w       AS to_activity,
  DATEDIFF('hour',
    event_timestamp,
    LEAD(event_timestamp) OVER w
  ) AS wait_hours
FROM event_log
WINDOW w AS (
  PARTITION BY case_id
  ORDER BY event_timestamp
)`,
    options: [
      { label: "Use LEAD() window function to get next event's timestamp, then subtract", correct: true },
      { label: "Count how many events each activity has", correct: false, why: "Event count tells you frequency, not speed. A step could have many events but be fast, or few events and be the bottleneck." },
      { label: "Average all timestamps per activity", correct: false, why: "Averaging timestamps gives you the 'typical time of day' an activity happens, not how long the wait is between steps." },
      { label: "Look at which activity appears last most often", correct: false, why: "Being the last step doesn't mean it's the slowest. The bottleneck is about the waiting time between transitions, not position." },
    ],
  },
  {
    id: "conformance",
    title: "Conformance Rate",
    question: "How do you check if a case followed the happy path?",
    code: `-- Conformance: does the activity sequence match the ideal?
WITH case_paths AS (
  SELECT
    case_id,
    STRING_AGG(activity, ' → '
      ORDER BY event_timestamp
    ) AS actual_path
  FROM event_log
  GROUP BY case_id
)
SELECT
  case_id,
  actual_path,
  CASE
    WHEN actual_path =
      'Create PO → Approve PO → Receive Goods → Record Invoice → Process Payment'
    THEN 'Conformant'
    ELSE 'Deviant'
  END AS conformance
FROM case_paths`,
    options: [
      { label: "Aggregate activities in timestamp order per case, then compare to ideal sequence", correct: true },
      { label: "Check if all 5 activities exist for each case", correct: false, why: "Having all activities isn't enough — the ORDER matters. A case with payment before approval has all 5 steps but is clearly deviant." },
      { label: "Count total cases and divide by expected cases", correct: false, why: "This would only tell you if cases exist, not if they followed the correct path. Conformance is about the sequence, not the count." },
      { label: "Compare case duration to average duration", correct: false, why: "A case can be slower than average but still follow the correct path, or be fast but skip steps. Speed ≠ conformance." },
    ],
  },
];

const Stage5 = ({ onComplete }) => {
  const [phase, setPhase] = useState("learn");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showCode, setShowCode] = useState({});

  const handleAnswer = (qIdx, optIdx, correct) => {
    setAnswers(a => ({ ...a, [qIdx]: { optIdx, correct } }));
  };

  const allAnswered = Object.keys(answers).length === KPI_QUESTIONS.length;
  const allCorrect = allAnswered && Object.values(answers).every(a => a.correct);

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>From Event Log to KPIs</h2>
      <p style={introStyle}>
        The event log is built — but the dashboard doesn't populate itself. Every KPI, chart, and metric you see on a process mining dashboard is backed by a <strong style={{ color: "#f4a261" }}>specific calculation</strong> written by the data engineer. Let's look at the most common ones.
      </p>

      <LearnCard icon="⏱️" title="Throughput Time">
        The time from the first event to the last event in a case. Sounds simple, but it depends entirely on correct timestamps and case IDs. A timezone error of 2 hours inflates <em>every</em> case's throughput by 2 hours.
        <InfoDot tip={TOOLTIPS.kpi_throughput} position="right" />
      </LearnCard>

      <LearnCard icon="🚧" title="Bottleneck Detection">
        Where in the process do cases wait the longest? This requires calculating the time gap between <em>consecutive</em> events within each case — a SQL window function problem. The output shows you which transition (e.g., "Approve PO → Receive Goods") is the slowest on average.
      </LearnCard>

      <LearnCard icon="✅" title="Conformance Rate">
        What percentage of cases followed the expected "happy path"? This means reconstructing the full activity sequence per case and comparing it to the ideal. Real-world conformance rates are often surprisingly low — sometimes only 30-40%.
        <InfoDot tip={TOOLTIPS.kpi_conformance} position="right" />
      </LearnCard>

      <LearnCard icon="📊" title="Case Variants">
        How many unique paths exist through the process? Each distinct sequence of activities is a "variant." P2P processes typically have hundreds of variants — most are edge cases, but some reveal systemic issues.
      </LearnCard>

      <LearnCard icon="🎯" title="Your task">
        For each KPI, you'll see the question and choose the correct calculation approach. After choosing correctly, you can view the actual SQL that implements it. This is what the data engineer writes before it becomes a number on a dashboard.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Let me code the KPIs →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Code the Dashboard KPIs</h2>
      <p style={introStyle}>Use the event log schema and KPI requirements below to choose the correct calculation approach for each metric.</p>

      {/* Documentation: Event Log Schema */}
      <div style={{
        background: "#faf8f5", borderRadius: 12, padding: "18px 22px", marginBottom: 16,
        border: "1.5px solid #d4cfc7", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 10, right: 14, fontSize: 11, color: "#a09888", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
          EVENT LOG — SCHEMA REFERENCE
        </div>
        <h4 style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#3a3530", marginBottom: 12, borderBottom: "1px solid #e0dbd3", paddingBottom: 8 }}>
          📄 Event Log Table: <code style={{ color: "#b45309" }}>event_log</code>
        </h4>
        <table style={{ borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12, width: "100%", marginBottom: 14 }}>
          <thead><tr>
            {["Column", "Type", "Description", "Example"].map(h => (
              <th key={h} style={{ padding: "5px 10px", borderBottom: "2px solid #c8c0b4", color: "#6a5f54", textAlign: "left", fontWeight: 700 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              ["case_id", "VARCHAR", "PO number — groups all events of one process instance", "4500017823"],
              ["activity", "VARCHAR", "Human-readable activity name", "Approve PO"],
              ["event_timestamp", "TIMESTAMP", "When the event occurred (CET timezone)", "2024-01-15 11:45:00"],
              ["source_system", "VARCHAR", "Origin system of this event", "SAP_ERP"],
              ["user_id", "VARCHAR", "Who performed the activity", "JSMITH"],
            ].map((r, i) => (
              <tr key={i}>{r.map((c, j) => (
                <td key={j} style={{ padding: "5px 10px", borderBottom: "1px solid #e8e2da", color: j === 0 ? "#b45309" : "#4a4540", fontSize: 11.5, fontWeight: j === 0 ? 700 : 400 }}>{c}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#5a4f44", marginBottom: 6 }}>
          Row count: 14,208 events &nbsp;|&nbsp; Unique cases: 3,241 &nbsp;|&nbsp; Date range: 2024-01-02 to 2024-12-18
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#7a7068", marginBottom: 4 }}>
          Sample rows:
        </div>
        <table style={{ borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11, width: "100%" }}>
          <thead><tr>
            {["case_id", "activity", "event_timestamp"].map(h => (
              <th key={h} style={{ padding: "4px 8px", borderBottom: "1.5px solid #c8c0b4", color: "#6a5f54", textAlign: "left", fontWeight: 700 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              ["4500017823", "Create PO", "2024-01-15 10:23:11"],
              ["4500017823", "Approve PO", "2024-01-15 11:45:00"],
              ["4500017823", "Receive Goods", "2024-01-22 14:30:00"],
              ["4500017823", "Record Invoice", "2024-01-25 09:12:33"],
              ["4500017823", "Process Payment", "2024-02-04 00:15:00"],
              ["4500017824", "Create PO", "2024-01-16 14:02:45"],
              ["4500017824", "Create PO", "2024-01-16 14:02:45"],
              ["4500017824", "Approve PO", "2024-01-17 08:30:00"],
            ].map((r, i) => (
              <tr key={i} style={{ background: i < 5 ? "rgba(180,83,9,0.04)" : "transparent" }}>{r.map((c, j) => (
                <td key={j} style={{ padding: "3px 8px", borderBottom: "1px solid #ede8e0", color: "#4a4540", fontSize: 11 }}>{c}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#a09888", marginTop: 6, fontStyle: "italic" }}>
          Highlighted rows show one complete case (PO 4500017823). Note that PO 4500017824 has a duplicate "Create PO" — real data is never perfectly clean.
        </p>
      </div>

      {/* Documentation: KPI Requirements */}
      <div style={{
        background: "#faf8f5", borderRadius: 12, padding: "18px 22px", marginBottom: 28,
        border: "1.5px solid #d4cfc7", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 10, right: 14, fontSize: 11, color: "#a09888", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
          FROM: PROCESS ENGINEER
        </div>
        <h4 style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#3a3530", marginBottom: 12, borderBottom: "1px solid #e0dbd3", paddingBottom: 8 }}>
          📋 KPI Requirements — P2P Dashboard v1
        </h4>

        <div style={{ display: "grid", gap: 12 }}>
          {[
            {
              kpi: "Throughput Time",
              def: "The total elapsed time from when a case starts (first event) to when it ends (last event), measured in days.",
              usage: "Used to monitor overall process efficiency and SLA compliance. Target: < 30 days for 80% of cases.",
              note: "Should be calculated per case, then aggregated (avg, median, P90) for the dashboard."
            },
            {
              kpi: "Bottleneck Identification",
              def: "The average waiting time between each pair of consecutive activities across all cases.",
              usage: "Identifies which process transitions cause the most delay. Used to prioritize improvement initiatives.",
              note: "Needs to compare each event to the next event within the same case, ordered by timestamp. Longest average transition = primary bottleneck."
            },
            {
              kpi: "Conformance Rate",
              def: "The percentage of cases that follow the exact expected sequence: Create PO → Approve PO → Receive Goods → Record Invoice → Process Payment.",
              usage: "Measures process discipline. Non-conformant cases often indicate workarounds, policy violations, or system issues.",
              note: "Order matters — a case with all 5 activities in the wrong order is non-conformant. Cases with extra or missing steps are also non-conformant."
            },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(0,0,0,0.02)", borderRadius: 8, padding: "12px 14px", border: "1px solid #e8e2da" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#b45309", marginBottom: 4 }}>
                {k.kpi}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "#4a4540", lineHeight: 1.55, marginBottom: 4 }}>
                <strong style={{ color: "#3a3530" }}>Definition:</strong> {k.def}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "#4a4540", lineHeight: 1.55, marginBottom: 4 }}>
                <strong style={{ color: "#3a3530" }}>Business use:</strong> {k.usage}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#8a8078", lineHeight: 1.5, fontStyle: "italic" }}>
                Implementation note: {k.note}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: "#8a8078", marginTop: 14, lineHeight: 1.5, fontStyle: "italic" }}>
          Sent by M. de Vries (Process Engineer), 2024-02-12.
          This is the kind of requirements handoff a data engineer receives — the process engineer defines <em>what</em> each KPI means, and the data engineer figures out <em>how</em> to calculate it from the event log.
        </p>
      </div>

      <SectionDivider label="Now implement each KPI" />

      {/* SQL function reference */}
      <div style={{
        background: "rgba(244,162,97,0.04)", border: "1.5px solid #2a2a4a", borderRadius: 10,
        padding: "12px 16px", marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#a89b8c" }}>
          <span style={{ color: "#f4a261", fontWeight: 700 }}>SQL Reference:</span>
        </div>
        {[
          { fn: "DATEDIFF(unit, start, end)", desc: "Time between two timestamps" },
          { fn: "MIN() / MAX()", desc: "Earliest / latest value in group" },
          { fn: "LEAD(col) OVER (PARTITION BY ... ORDER BY ...)", desc: "Next row's value" },
          { fn: "STRING_AGG(col, sep ORDER BY ...)", desc: "Concatenate values in order" },
          { fn: "GROUP BY / HAVING", desc: "Aggregate per group" },
        ].map((f, i) => (
          <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.5 }}>
            <span style={{ color: "#f4a261" }}>{f.fn}</span>
            <span style={{ color: "#5a5a7a" }}> — {f.desc}</span>
          </div>
        ))}
      </div>

      {KPI_QUESTIONS.map((q, qi) => (
        <div key={q.id} style={{
          background: "rgba(0,0,0,0.12)", border: `1.5px solid ${answers[qi]?.correct ? "#2ecc71" : "#2a2a4a"}`,
          borderRadius: 12, padding: "18px 20px", marginBottom: 16,
        }}>
          <h3 style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#f4a261", marginBottom: 4 }}>{q.title}</h3>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#c8c0b4", marginBottom: 14 }}>{q.question}</p>

          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {q.options.map((opt, oi) => {
              const chosen = answers[qi]?.optIdx === oi;
              const revealed = answers[qi] !== undefined;
              let border = "#2a2a4a";
              let bg = "transparent";
              if (revealed && opt.correct) { border = "#2ecc71"; bg = "rgba(46,204,113,0.06)"; }
              if (chosen && !opt.correct) { border = "#e74c3c"; bg = "rgba(231,76,60,0.06)"; }
              return (
                <div key={oi} onClick={() => !revealed && handleAnswer(qi, oi, opt.correct)}
                  style={{
                    padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${border}`, background: bg,
                    cursor: revealed ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#e8dcc8",
                  }}>
                  {opt.correct && revealed && "✓ "}{chosen && !opt.correct && "✗ "}{opt.label}
                  {revealed && !opt.correct && chosen && opt.why && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#e74c3c", lineHeight: 1.5 }}>{opt.why}</div>
                  )}
                </div>
              );
            })}
          </div>

          {answers[qi]?.correct && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <button onClick={() => setShowCode(s => ({ ...s, [qi]: !s[qi] }))}
                style={{
                  background: "none", border: "1px solid #3a3a5a", borderRadius: 6, padding: "6px 14px",
                  color: "#a89b8c", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer",
                }}>
                {showCode[qi] ? "Hide SQL ▲" : "View SQL implementation ▼"}
              </button>
              {showCode[qi] && <CodeBlock code={q.code} />}
            </div>
          )}
        </div>
      ))}

      {allCorrect && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease", marginTop: 8 }}>
          <p style={{ color: "#2ecc71", fontSize: 15, fontWeight: 600, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
            ✓ All KPIs coded! Now let's see what happens when the underlying data is broken.
          </p>
          <PhaseButton onClick={onComplete}>Continue →</PhaseButton>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 6 — QUALITY CHECK (toggle breakers)
// ═══════════════════════════════════════════════════════════════════
const Stage6 = ({ onComplete }) => {
  const [phase, setPhase] = useState("learn");
  const [toggles, setToggles] = useState({ timestamps: false, caseids: false, unmapped: false });
  const toggle = (k) => setToggles(t => ({ ...t, [k]: !t[k] }));
  const anyBroken = toggles.timestamps || toggles.caseids || toggles.unmapped;

  const goodProcess = [
    { from: "Create PO", to: "Approve PO", pct: "92%", time: "1.2 days" },
    { from: "Approve PO", to: "Receive Goods", pct: "88%", time: "5.4 days" },
    { from: "Receive Goods", to: "Record Invoice", pct: "95%", time: "2.1 days" },
    { from: "Record Invoice", to: "Process Payment", pct: "97%", time: "8.7 days" },
  ];

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Why Data Quality Makes or Breaks Everything</h2>
      <p style={introStyle}>
        You've seen how to extract, transform, and build KPIs. But what if any of those earlier steps went wrong? Process mining tools are powerful — but they <strong style={{ color: "#f4a261" }}>faithfully visualize whatever data you give them</strong>, including garbage. The tool won't warn you if your Case IDs are wrong or your timestamps are misaligned. It will just show a wrong but confident-looking dashboard.
      </p>

      <LearnCard icon="🔗" title="What if Case IDs are wrong?">
        If you use the wrong field as Case ID, events from different process instances get mixed together. The result: spaghetti diagrams where activities seem to jump randomly. A process mining tool can't distinguish a "real" mess from a data quality mess — it just shows what the data says.
      </LearnCard>

      <LearnCard icon="🕐" title="What if timestamps are missing?">
        Without timestamps, you still see which activities exist and how they connect — but you lose <em>all</em> performance insight. No throughput times, no bottleneck detection, no SLA monitoring. Process mining becomes a glorified flowchart.
      </LearnCard>

      <LearnCard icon="🏷️" title="What if activities aren't mapped?">
        If you skip the CASE WHEN mapping, raw codes flow into your dashboard. The process is technically correct, but stakeholders see "FRGZU_08" instead of "Approve PO." Understanding and buy-in evaporate instantly.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Let me break things →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Break Things on Purpose</h2>
      <p style={introStyle}>Toggle each switch to see the dashboard before and after the data engineering work is removed.</p>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { key: "timestamps", label: "Remove Timestamps", tip: TOOLTIPS.quality_no_timestamp },
          { key: "caseids", label: "Scramble Case IDs", tip: TOOLTIPS.quality_no_caseid },
          { key: "unmapped", label: "Skip Activity Mapping", tip: TOOLTIPS.quality_unmapped },
        ].map(t => (
          <button key={t.key} onClick={() => toggle(t.key)} style={{
            padding: "10px 16px", borderRadius: 10, cursor: "pointer",
            border: `2px solid ${toggles[t.key] ? "#e74c3c" : "#3a3a5a"}`,
            background: toggles[t.key] ? "rgba(231,76,60,0.12)" : "#1e1e38",
            color: toggles[t.key] ? "#e74c3c" : "#a89b8c",
            fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600,
          }}>
            {toggles[t.key] ? "✗ " : "○ "}{t.label} <InfoDot tip={t.tip} position="bottom" />
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        {/* Good */}
        <div style={{ background: "rgba(46,204,113,0.06)", border: "2px solid #2a4a3a", borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#2ecc71", marginBottom: 12, textAlign: "center" }}>✓ Proper Event Log</h3>
          {goodProcess.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#e8dcc8" }}>
                <span>{p.from} → {p.to}</span><span style={{ color: "#2ecc71" }}>{p.pct}</span>
              </div>
              <div style={{ height: 6, background: "#1a2a20", borderRadius: 3, marginTop: 4 }}>
                <div style={{ height: "100%", width: p.pct, background: "#2ecc71", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: "#5a7a6a", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>avg. {p.time}</div>
            </div>
          ))}
        </div>

        {/* Broken */}
        <div style={{
          background: anyBroken ? "rgba(231,76,60,0.06)" : "rgba(46,204,113,0.06)",
          border: `2px solid ${anyBroken ? "#4a2a2a" : "#2a4a3a"}`, borderRadius: 12, padding: 16,
        }}>
          <h3 style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: anyBroken ? "#e74c3c" : "#2ecc71", marginBottom: 12, textAlign: "center" }}>
            {anyBroken ? "✗ Broken Event Log" : "✓ Matching"}
          </h3>

          {!anyBroken && goodProcess.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#e8dcc8" }}>
                <span>{p.from} → {p.to}</span><span style={{ color: "#2ecc71" }}>{p.pct}</span>
              </div>
              <div style={{ height: 6, background: "#1a2a20", borderRadius: 3, marginTop: 4 }}>
                <div style={{ height: "100%", width: p.pct, background: "#2ecc71", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: "#5a7a6a", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>avg. {p.time}</div>
            </div>
          ))}

          {toggles.timestamps && !toggles.caseids && !toggles.unmapped && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {goodProcess.map((p, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#e8dcc8" }}>
                    <span>{p.from} → {p.to}</span><span style={{ color: "#e74c3c" }}>{p.pct}</span>
                  </div>
                  <div style={{ height: 6, background: "#2a1a1a", borderRadius: 3, marginTop: 4 }}>
                    <div style={{ height: "100%", width: p.pct, background: "#e74c3c", borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#7a5a5a", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>avg. ??? (no timing data)</div>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "#e74c3c", marginTop: 12, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                Flow paths visible, but all performance metrics are gone. No bottleneck detection possible.
              </p>
            </div>
          )}

          {toggles.caseids && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {[
                { from: "Create PO", to: "Process Payment", pct: "12%" },
                { from: "Approve PO", to: "Create PO", pct: "23%" },
                { from: "Receive Goods", to: "Approve PO", pct: "8%" },
                { from: "Record Invoice", to: "Create PO", pct: "31%" },
                { from: "Process Payment", to: "Receive Goods", pct: "15%" },
                { from: "Create PO", to: "Record Invoice", pct: "19%" },
              ].map((p, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#e8dcc8", display: "flex", justifyContent: "space-between" }}>
                    <span>{p.from} → {p.to}</span><span style={{ color: "#e74c3c" }}>{p.pct}</span>
                  </div>
                  <div style={{ height: 4, background: "#2a1a1a", borderRadius: 2, marginTop: 2 }}>
                    <div style={{ height: "100%", width: p.pct, background: "#e74c3c", borderRadius: 2 }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "#e74c3c", marginTop: 12, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                Total chaos — events randomly assigned to cases. The spaghetti process from hell.
              </p>
            </div>
          )}

          {toggles.unmapped && !toggles.caseids && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {[
                { from: "FRGZU_08", to: "GR_POST_T", pct: "88%" },
                { from: "BSART_NB", to: "FRGZU_08", pct: "92%" },
                { from: "GR_POST_T", to: "RE_STAT_P", pct: "95%" },
                { from: "RE_STAT_P", to: "PAY_CLR", pct: "97%" },
              ].map((p, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#e8dcc8" }}>
                    <span>{p.from} → {p.to}</span><span style={{ color: "#f4a261" }}>{p.pct}</span>
                  </div>
                  <div style={{ height: 6, background: "#2a2a1a", borderRadius: 3, marginTop: 4 }}>
                    <div style={{ height: "100%", width: p.pct, background: "#f4a261", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "#f4a261", marginTop: 12, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                Technically "works" — but good luck presenting FRGZU_08 to stakeholders.
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <PhaseButton onClick={onComplete}>Continue to the Dashboard →</PhaseButton>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 8 — THE DASHBOARD REVEAL
// ═══════════════════════════════════════════════════════════════════
const Stage8 = ({ stats }) => {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 600); return () => clearTimeout(t); }, []);

  const effortData = [
    { label: "Extraction & cleaning", pct: 35, color: "#e76f51" },
    { label: "Transformation & mapping", pct: 30, color: "#f4a261" },
    { label: "KPI coding & validation", pct: 20, color: "#2a9d8f" },
    { label: "Dashboard & visualization", pct: 15, color: "#264653" },
  ];

  return (
    <div style={{ textAlign: "center" }}>
      <h2 style={{
        ...h2Style, fontSize: 32, opacity: revealed ? 1 : 0, transition: "opacity 1s ease 0.2s",
      }}>The Dashboard</h2>

      <div style={{
        background: "linear-gradient(135deg, #1e1e38 0%, #2a2a4a 100%)", borderRadius: 16,
        border: "2px solid #3a3a5a", padding: 24, marginBottom: 28,
        opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(20px)",
        transition: "all 1s ease 0.5s",
      }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "Cases", value: "3,241", color: "#f4a261" },
            { label: "Activities", value: "5", color: "#e76f51" },
            { label: "Avg. Throughput", value: "17.4 days", color: "#2a9d8f" },
            { label: "Conformance", value: "76.3%", color: "#264653" },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "12px 18px", minWidth: 110 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 12, color: "#7a7a9a", fontFamily: "'DM Sans', sans-serif" }}>{kpi.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "#5a5a7a", fontStyle: "italic", fontFamily: "'DM Sans', sans-serif" }}>
          Process Mining Dashboard — Purchase to Pay
        </div>
      </div>

      <div style={{ opacity: revealed ? 1 : 0, transition: "opacity 1s ease 1.2s", marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#a89b8c", marginBottom: 16 }}>
          Where the effort actually goes: <InfoDot tip={TOOLTIPS.dashboard_reveal} />
        </h3>
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          {effortData.map((d, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e8dcc8", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                <span>{d.label}</span><span style={{ color: d.color, fontWeight: 700 }}>{d.pct}%</span>
              </div>
              <div style={{ height: 10, background: "#1a1a2e", borderRadius: 5 }}>
                <div style={{
                  height: "100%", width: revealed ? `${d.pct}%` : "0%", background: d.color, borderRadius: 5,
                  transition: `width 1.2s ease ${1.5 + i * 0.2}s`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: "rgba(244,162,97,0.06)", border: "2px solid #f4a261", borderRadius: 14,
        padding: 20, maxWidth: 480, margin: "0 auto 20px auto",
        opacity: revealed ? 1 : 0, transition: "opacity 1s ease 2.5s",
      }}>
        <h3 style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#f4a261", marginBottom: 12 }}>Your Journey Scorecard</h3>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#e8dcc8", lineHeight: 2 }}>
          <div>Data issues discovered: <strong style={{ color: "#f4a261" }}>{stats.current.issuesFound || 0}</strong> / 11</div>
          <div>Extraction attempts: <strong style={{ color: "#f4a261" }}>{stats.current.extractionAttempts || "—"}</strong></div>
          <div>Case ID on first try: <strong style={{ color: stats.current.caseIdFirstTry ? "#2ecc71" : "#e76f51" }}>{stats.current.caseIdFirstTry ? "Yes!" : "Needed a few tries"}</strong></div>
          <div>Detective bugs found: <strong style={{ color: (stats.current.detectiveBugsFound || 0) === 3 ? "#2ecc71" : "#f4a261" }}>{stats.current.detectiveBugsFound || 0}</strong> / 3</div>
        </div>
      </div>

      <p style={{
        fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#e8dcc8", fontStyle: "italic",
        maxWidth: 520, margin: "0 auto", lineHeight: 1.6,
        opacity: revealed ? 1 : 0, transition: "opacity 1s ease 3s",
      }}>
        "Next time you open a process mining dashboard, remember — everything you just walked through is what makes it possible."
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STAGE 7 — THE DETECTIVE
// ═══════════════════════════════════════════════════════════════════
const BUGGY_LOG = [
  { key: "r1",  caseid: "PO-1001",  activity: "Create PO",       ts: "2024-01-15 08:32", src: "SAP-MM", bug: null },
  { key: "r2",  caseid: "PO-1001",  activity: "Approve PO",      ts: "2024-01-15 10:14", src: "SAP-MM", bug: null },
  { key: "r3",  caseid: "INV-8842", activity: "Record Invoice",  ts: "2024-01-16 09:00", src: "SAP-FI", bug: { type: "wrong-caseid", col: "caseid" } },
  { key: "r4",  caseid: "PO-1001",  activity: "Receive Goods",   ts: "2024-01-16 14:22", src: "WMS",    bug: null },
  { key: "r5",  caseid: "PO-1001",  activity: "FRGZU_08",        ts: "2024-01-17 11:05", src: "SAP-MM", bug: { type: "unmapped", col: "activity" } },
  { key: "r6",  caseid: "PO-1001",  activity: "Process Payment", ts: "2024-01-17 13:47", src: "SAP-FI", bug: null },
  { key: "r7",  caseid: "PO-1002",  activity: "Create PO",       ts: "2024-01-18 09:15", src: "SAP-MM", bug: null },
  { key: "r8",  caseid: "PO-1002",  activity: "Approve PO",      ts: "2024-01-18 16:33", src: "SAP-MM", bug: null },
  { key: "r9",  caseid: "INV-9103", activity: "Record Invoice",  ts: "2024-01-19 08:20", src: "SAP-FI", bug: { type: "wrong-caseid", col: "caseid" } },
  { key: "r10", caseid: "PO-1002",  activity: "Receive Goods",   ts: "2024-01-19 14:22", src: "WMS",    bug: null },
  { key: "r11", caseid: "PO-1002",  activity: "Process Payment", ts: "2024-01-19 09:48", src: "SAP-FI", bug: { type: "timezone", col: "ts" } },
];

const DETECTIVE_BUGS = {
  "wrong-caseid": {
    icon: "🔑", color: "#e74c3c", title: "Wrong Case ID Field",
    description: "INV-8842 and INV-9103 are invoice numbers, not PO numbers. The invoice and its PO belong to the same process instance — but with different IDs, the mining tool treats them as completely separate cases. Your process map silently splits in two.",
  },
  "unmapped": {
    icon: "❓", color: "#f4a261", title: "Unmapped Activity Code",
    description: "FRGZU_08 is a raw SAP status code that was never mapped to a readable name. The dashboard will display this cryptic string to business stakeholders. This is exactly the scenario where a consultant on holiday stalls a project for two weeks.",
  },
  "timezone": {
    icon: "🕐", color: "#e67e22", title: "Timezone Mismatch",
    description: "PO-1002's Process Payment (09:48) appears before Receive Goods (14:22) on the same day — payment before delivery is impossible. SAP-FI logs in UTC while WMS logs in local time (UTC+3). The 3-hour offset creates ghost sequences that break conformance analysis.",
  },
};

const TABLE_COLS = [
  { key: "caseid", label: "Case ID" },
  { key: "activity", label: "Activity" },
  { key: "ts", label: "Timestamp" },
  { key: "src", label: "Source" },
];

const Stage7 = ({ onComplete, stats }) => {
  const [phase, setPhase] = useState("learn");
  const [found, setFound] = useState(new Set());
  const [flash, setFlash] = useState(null); // { key, col } — brief "nothing here" feedback
  const [activeInfo, setActiveInfo] = useState(null); // bug type currently shown in panel

  const handleCellClick = (row, col) => {
    if (row.bug && row.bug.col === col) {
      const next = new Set(found);
      next.add(row.bug.type);
      setFound(next);
      setActiveInfo(row.bug.type);
      stats.current.detectiveBugsFound = next.size;
    } else {
      setFlash({ key: row.key, col });
      setActiveInfo(null);
      setTimeout(() => setFlash(null), 700);
    }
  };

  const allFound = found.size === 3;

  if (phase === "learn") return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>The Detective</h2>
      <p style={introStyle}>
        Even a well-architected pipeline can harbour silent data bugs. In this stage you play <strong style={{ color: "#f4a261" }}>data detective</strong> — inspect a raw event log and click on every cell that looks wrong. There are exactly <strong style={{ color: "#f4a261" }}>3 issues</strong> hidden in the table.
      </p>

      <LearnCard icon="🔍" title="The three classic silent killers">
        <strong style={{ color: "#e8dcc8" }}>Wrong Case ID</strong> — using the invoice number instead of the PO number as the case identifier splits one process instance into multiple disconnected fragments.<br /><br />
        <strong style={{ color: "#e8dcc8" }}>Unmapped activity codes</strong> — raw system codes like FRGZU_08 that were never translated make the dashboard incomprehensible to business users.<br /><br />
        <strong style={{ color: "#e8dcc8" }}>Timezone mismatches</strong> — when two source systems log in different timezones, events appear in impossible order (payment before delivery, approval before creation).
      </LearnCard>

      <LearnCard icon="🎯" title="How to play">
        Scan each row carefully. Click the specific cell you think contains an error. Non-buggy cells will flash green ("nothing wrong here"). Once you've identified all 3 issue types, you can proceed.
      </LearnCard>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <PhaseButton onClick={() => setPhase("do")}>Open the case file →</PhaseButton>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={h2Style}>Find the Bugs</h2>
      <p style={introStyle}>
        Click any cell that looks suspicious. Found: <strong style={{ color: "#f4a261" }}>{found.size} / 3</strong>
      </p>

      {/* Bug type badges */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(DETECTIVE_BUGS).map(([type, info]) => (
          <div key={type} onClick={() => found.has(type) && setActiveInfo(activeInfo === type ? null : type)}
            style={{
              padding: "6px 14px", borderRadius: 20, userSelect: "none",
              border: `1.5px solid ${found.has(type) ? info.color : "#252540"}`,
              background: found.has(type) ? `${info.color}18` : "transparent",
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              color: found.has(type) ? info.color : "#353555",
              cursor: found.has(type) ? "pointer" : "default",
              transition: "all 0.3s",
            }}>
            {found.has(type) ? "✓ " : "○ "}{info.icon} {info.title}
          </div>
        ))}
      </div>

      {/* Event log table */}
      <div style={{ overflowX: "auto", marginBottom: 20, borderRadius: 10, border: "1.5px solid #1e1e38" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0d0d1a" }}>
              {TABLE_COLS.map(c => (
                <th key={c.key} style={{
                  padding: "9px 14px", textAlign: "left", fontSize: 10,
                  color: "#4a4a6a", borderBottom: "1.5px solid #1e1e38",
                  letterSpacing: 1, textTransform: "uppercase", fontWeight: 600,
                }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUGGY_LOG.map((row, ri) => (
              <tr key={row.key} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                {TABLE_COLS.map(c => {
                  const isBugCell = row.bug?.col === c.key;
                  const isFound = isBugCell && found.has(row.bug.type);
                  const isFlashing = flash?.key === row.key && flash?.col === c.key;
                  const bugInfo = isBugCell ? DETECTIVE_BUGS[row.bug.type] : null;
                  return (
                    <td key={c.key} onClick={() => handleCellClick(row, c.key)} style={{
                      padding: "9px 14px", borderBottom: "1px solid #161628",
                      color: isFound ? bugInfo.color : isFlashing ? "#2ecc71" : "#b8c8d8",
                      background: isFound ? `${bugInfo.color}14` : isFlashing ? "rgba(46,204,113,0.07)" : "transparent",
                      cursor: "pointer", transition: "background 0.15s, color 0.15s",
                    }}>
                      {row[c.key]}{isFound && <span style={{ marginLeft: 6, fontSize: 10 }}>⚠</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info panel — shown when a bug badge or buggy cell is clicked */}
      {activeInfo && (
        <div style={{
          background: `${DETECTIVE_BUGS[activeInfo].color}10`,
          border: `1.5px solid ${DETECTIVE_BUGS[activeInfo].color}`,
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          animation: "fadeIn 0.25s ease",
        }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: DETECTIVE_BUGS[activeInfo].color, marginBottom: 6 }}>
            {DETECTIVE_BUGS[activeInfo].icon} Bug found: {DETECTIVE_BUGS[activeInfo].title}
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#c8c0b4", lineHeight: 1.65 }}>
            {DETECTIVE_BUGS[activeInfo].description}
          </div>
        </div>
      )}

      {allFound && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
          <p style={{ color: "#2ecc71", fontFamily: "'DM Mono', monospace", fontSize: 13, marginBottom: 16 }}>
            ✓ All 3 issues identified — the log is clean. Time to see the dashboard.
          </p>
          <PhaseButton onClick={onComplete}>Continue to Dashboard →</PhaseButton>
        </div>
      )}
    </div>
  );
};

// ─── SHARED STYLES ──────────────────────────────────────────────────
const h2Style = { fontFamily: "'Playfair Display', serif", fontSize: 27, color: "#e8dcc8", textAlign: "center", marginBottom: 8 };
const introStyle = { color: "#a89b8c", textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.65, marginBottom: 22, maxWidth: 640, marginLeft: "auto", marginRight: "auto" };
const codeInline = { fontFamily: "'DM Mono', monospace", fontSize: 13, background: "rgba(244,162,97,0.1)", color: "#f4a261", padding: "1px 6px", borderRadius: 4 };

// ═══════════════════════════════════════════════════════════════════
// DATA FLOW ANIMATION — plays between stage transitions
// ═══════════════════════════════════════════════════════════════════
const PIPELINE_NODES = [
  { icon: "🗄️", label: "Source Systems", sub: "ERP · Excel · Email", color: "#e76f51" },
  { icon: "📋", label: "Event Log",       sub: "Case · Activity · Time", color: "#f4a261" },
  { icon: "⚙️",  label: "Transform",      sub: "ETL · Map · Validate", color: "#2a9d8f" },
  { icon: "📊", label: "Dashboard",       sub: "KPIs · Flow · Insights", color: "#a8d8ea" },
];

const TRANSITION_MESSAGES = {
  1: "Identifying data sources...",
  2: "Extracting records from source systems...",
  3: "Building the event log...",
  4: "Applying transformations & mappings...",
  5: "Computing KPIs...",
  6: "Validating data quality...",
  7: "Preparing the detective case file...",
};

const DataFlowAnimation = ({ fromStage, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  // Which node index is currently "active" (glowing), 0-indexed
  const activeNode = Math.min(fromStage - 1, PIPELINE_NODES.length - 1);
  const message = TRANSITION_MESSAGES[fromStage] || "Processing...";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0d0d1a", zIndex: 100,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.35s ease",
    }}>
      <p style={{
        color: "#5a5a7a", fontFamily: "'DM Mono', monospace", fontSize: 12,
        letterSpacing: 2, textTransform: "uppercase", marginBottom: 52,
      }}>
        {message}
      </p>

      {/* Pipeline row */}
      <div style={{ display: "flex", alignItems: "center", maxWidth: 680, width: "100%", padding: "0 24px" }}>
        {PIPELINE_NODES.map((node, i) => (
          <React.Fragment key={node.label}>
            {/* Node box */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              animation: `pipelineFadeIn 0.45s ease ${i * 0.12}s both`,
              flexShrink: 0,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 14,
                background: i <= activeNode ? `${node.color}18` : "#161625",
                border: `2px solid ${i <= activeNode ? node.color : "#252540"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26,
                animation: i === activeNode ? "nodeGlow 1.6s ease-in-out infinite" : "none",
                boxShadow: i === activeNode ? `0 0 18px ${node.color}55` : "none",
                transition: "border-color 0.5s, background 0.5s",
              }}>
                {node.icon}
              </div>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
                color: i <= activeNode ? node.color : "#333355",
                textAlign: "center", letterSpacing: 0.5,
              }}>{node.label}</span>
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 9,
                color: "#363650", textAlign: "center",
              }}>{node.sub}</span>
            </div>

            {/* Connector with animated particles */}
            {i < PIPELINE_NODES.length - 1 && (
              <div style={{
                flex: 1, height: 2, position: "relative", marginBottom: 38,
                background: i < activeNode
                  ? `linear-gradient(90deg, ${PIPELINE_NODES[i].color}, ${PIPELINE_NODES[i + 1].color})`
                  : "#1e1e38",
                overflow: "hidden",
                transition: "background 0.6s ease",
              }}>
                {/* Particles flow on the edge just before the active node */}
                {i === activeNode - 1 && [0, 1, 2].map(p => (
                  <div key={p} style={{
                    position: "absolute", top: "50%", transform: "translateY(-50%)",
                    width: 7, height: 7, borderRadius: "50%",
                    background: PIPELINE_NODES[i + 1].color,
                    boxShadow: `0 0 8px ${PIPELINE_NODES[i + 1].color}`,
                    animation: `flowRight 1.3s linear ${p * 0.43}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <button onClick={onDone} style={{
        marginTop: 52, padding: "7px 18px", background: "transparent",
        border: "1px solid #252540", borderRadius: 7, color: "#444466",
        fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer",
        letterSpacing: 1, transition: "color 0.2s, border-color 0.2s",
      }}
        onMouseEnter={e => { e.currentTarget.style.color = "#f4a261"; e.currentTarget.style.borderColor = "#f4a261"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#444466"; e.currentTarget.style.borderColor = "#252540"; }}
      >
        SKIP →
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [stage, setStage] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [nextStage, setNextStage] = useState(null);
  const stats = useRef({ issuesFound: 0, extractionAttempts: 0, caseIdFirstTry: false, detectiveBugsFound: 0 });

  const advanceStage = useCallback((n) => {
    setNextStage(n);
    setAnimating(true);
  }, []);

  const handleAnimDone = useCallback(() => {
    setStage(s => nextStage ?? s + 1);
    setAnimating(false);
    setNextStage(null);
  }, [nextStage]);

  return (
    <div style={{ minHeight: "100vh", background: "#12121f", fontFamily: "'DM Sans', sans-serif", padding: "0 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pipelineFadeIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes nodeGlow { 0%, 100% { box-shadow: 0 0 8px rgba(244,162,97,0.15); } 50% { box-shadow: 0 0 24px rgba(244,162,97,0.55); } }
        @keyframes flowRight { from { left: -8px; opacity: 0.9; } to { left: 100%; opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.88; }
        select { outline: none; }
        select option { background: #1e1e38; color: #e8dcc8; }
        code { font-family: 'DM Mono', monospace; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", padding: "24px 0 10px 0" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, color: "#f4a261", letterSpacing: 1, marginBottom: 4 }}>
          FROM PROCESS TO DASHBOARD
        </h1>
        <p style={{ fontSize: 12.5, color: "#5a5a7a", fontFamily: "'DM Sans', sans-serif" }}>
          An interactive journey through the data engineering pipeline
        </p>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 24, flexWrap: "wrap", padding: "0 4px" }}>
        {STAGES.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div onClick={() => s.id < stage && setStage(s.id)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7,
              background: stage === s.id ? "rgba(244,162,97,0.15)" : stage > s.id ? "rgba(46,204,113,0.08)" : "transparent",
              border: `1.5px solid ${stage === s.id ? "#f4a261" : stage > s.id ? "#2ecc71" : "#2a2a4a"}`,
              cursor: s.id < stage ? "pointer" : "default",
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: stage > s.id ? "#2ecc71" : stage === s.id ? "#f4a261" : "#2a2a4a",
                color: stage >= s.id ? "#1a1a2e" : "#5a5a7a", fontSize: 10, fontWeight: 800, fontFamily: "'DM Mono', monospace",
              }}>{stage > s.id ? "✓" : s.id}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: stage === s.id ? "#f4a261" : stage > s.id ? "#2ecc71" : "#5a5a7a" }}>
                {s.title}
              </span>
            </div>
            {i < STAGES.length - 1 && <span style={{ color: "#2a2a4a", fontSize: 12 }}>—</span>}
          </div>
        ))}
      </div>

      {/* Data flow transition overlay */}
      {animating && <DataFlowAnimation fromStage={stage} onDone={handleAnimDone} />}

      {/* Content */}
      <div style={{ maxWidth: 780, margin: "0 auto", paddingBottom: 48, animation: "fadeIn 0.4s ease" }} key={stage}>
        {stage === 1 && <Stage1 onComplete={() => advanceStage(2)} />}
        {stage === 2 && <Stage2 onComplete={() => advanceStage(3)} stats={stats} />}
        {stage === 3 && <Stage3 onComplete={() => advanceStage(4)} stats={stats} />}
        {stage === 4 && <Stage4 onComplete={() => advanceStage(5)} stats={stats} />}
        {stage === 5 && <Stage5 onComplete={() => advanceStage(6)} />}
        {stage === 6 && <Stage6 onComplete={() => advanceStage(7)} />}
        {stage === 7 && <Stage7 onComplete={() => advanceStage(8)} stats={stats} />}
        {stage === 8 && <Stage8 stats={stats} />}
      </div>
    </div>
  );
}
