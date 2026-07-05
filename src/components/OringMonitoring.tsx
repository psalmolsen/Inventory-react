import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sidebar } from "./Sidebar";
import { getOringDataFn } from "../lib/oring-server-functions";
import type { OringRecord } from "../lib/oring-sheets";
import "./OringMonitoring.css";

const COLORS = {
  navy: "#1E2A78",
  navyDark: "#141D57",
  navySoft: "#EEF1FB",
  gold: "#F5B400",
  goldSoft: "#FFF4D2",
  good: "#2E7D32",
  goodSoft: "#E8F5E9",
  reject: "#D32F2F",
  rejectSoft: "#FDECEC",
  warning: "#F57C00",
  warningSoft: "#FFF3E0",
  ink: "#23304D",
  muted: "#6B7080",
  faint: "#9AA0B1",
  border: "#E4E7F2",
  bg: "#F6F8FD",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PAGE_SIZE = 8;

type StatusTone = "good" | "warn" | "reject";

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return display;
}

function pctChange(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function initials(name: string) {
  const value = name.trim();
  if (!value) return "--";
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarGradient(index: number) {
  const gradients = [
    "linear-gradient(135deg,#F5B400,#C98F00)",
    "linear-gradient(135deg,#1E2A78,#3B4CC0)",
    "linear-gradient(135deg,#2E7D32,#4C9E50)",
    "linear-gradient(135deg,#6B7080,#8C92A3)",
  ];
  return gradients[index % gradients.length];
}

function formatMonthLabel(monthKey: string) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  const monthIndex = Number(month) - 1;
  return `${MONTHS[monthIndex] || monthKey.slice(5, 7)} ${year}`;
}

function formatDateLabel(dateKey: string) {
  if (!dateKey) return "";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(record: OringRecord) {
  const date = formatDateLabel(record.dateKey || record.date);
  return record.time ? `${date} • ${record.time}` : date;
}

function getStatus(record: OringRecord): StatusTone {
  if (record.reject > 0) return "reject";
  if (record.valvesRepaired > 0) return "good";
  return "warn";
}

function sum(records: OringRecord[], key: keyof Pick<OringRecord, "valvesRepaired" | "good" | "reject">) {
  return records.reduce((total, record) => total + (record[key] || 0), 0);
}

function groupCount(records: OringRecord[], getter: (record: OringRecord) => string) {
  const map = new Map<string, number>();
  for (const record of records) {
    const key = getter(record).trim();
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function groupMetric(records: OringRecord[], getter: (record: OringRecord) => string) {
  const map = new Map<string, { label: string; repaired: number; good: number; reject: number; count: number }>();
  for (const record of records) {
    const label = getter(record).trim();
    if (!label) continue;
    const current = map.get(label) || { label, repaired: 0, good: 0, reject: 0, count: 0 };
    current.repaired += record.valvesRepaired;
    current.good += record.good;
    current.reject += record.reject;
    current.count += 1;
    map.set(label, current);
  }
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      passRate: item.repaired ? (item.good / item.repaired) * 100 : 0,
    }))
    .sort((a, b) => b.repaired - a.repaired);
}

function monthIndexFromKey(monthKey: string) {
  return monthKey ? Number(monthKey.split("-")[1]) - 1 : 0;
}

function timeBucket(time: string) {
  const text = time.trim();
  if (!text) return "Unspecified";
  return text
    .replace(/\s+/g, "")
    .replace(/([ap]m)/gi, " $1")
    .replace(/-/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferRejectReason(remarks: string) {
  const text = remarks.toLowerCase();
  if (!text) return "Unspecified";
  if (text.includes("leak")) return "Leak";
  if (text.includes("wrong") || text.includes("size")) return "Wrong Size";
  if (text.includes("damage") || text.includes("crack")) return "Damage";
  if (text.includes("surface") || text.includes("scratch")) return "Surface Damage";
  if (text.includes("pressure")) return "Pressure Test Failure";
  if (text.includes("seal") || text.includes("groove")) return "Seal / Groove Issue";
  return "Other";
}

const Icon: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  Search: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Source: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M3 3h18v3l-7 7v6l-4 2v-8L3 6z" />
    </svg>
  ),
  User: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  ),
  Calendar: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Clock: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Check2: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Reject: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  Wrench: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  Target: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  ),
  Filter: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Warn: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  Eye: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Edit: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
};

function StatCard({
  label,
  value,
  change,
  icon: IconComp,
  tone,
}: {
  label: string;
  value: string;
  change: React.ReactNode;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  tone: "navy" | "good" | "reject" | "gold";
}) {
  return (
    <div className="orm-stat">
      <div className="orm-stat-top">
        <div className="orm-stat-label">{label}</div>
        <div className={`orm-stat-icon ${tone}`}>
          <IconComp />
        </div>
      </div>
      <div className="orm-stat-value">{value}</div>
      <div className="orm-stat-change">{change}</div>
    </div>
  );
}

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return <span className={`orm-chip ${up ? "good" : "reject"}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs previous month</span>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="orm-section">
      <div>
        <div className="orm-section-kicker">O-Ring Monitoring</div>
        <h1 className="orm-title">{title}</h1>
        {subtitle ? <p className="orm-subtitle">{subtitle}</p> : null}
      </div>
      <div className="orm-page-badge">
        <span className="dot" />
        Live sheet sync
      </div>
    </div>
  );
}

export default function OringMonitoring() {
  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["oring-records", "all"],
    queryFn: () => getOringDataFn({ data: "All" }),
  });

  const [selectedMonth, setSelectedMonth] = useState("All");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    source: "",
    installedTo: "",
    remarks: "",
    status: "All Status",
  });
  const monthInitialized = useRef(false);

  const allRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
      if (a.timeSort !== b.timeSort) return b.timeSort - a.timeSort;
      return b.rowNumber - a.rowNumber;
    });
  }, [records]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of allRecords) {
      if (record.monthKey && !map.has(record.monthKey)) {
        map.set(record.monthKey, formatMonthLabel(record.monthKey));
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, label]) => ({ key, label }));
  }, [allRecords]);

  useEffect(() => {
    if (!monthInitialized.current && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[monthOptions.length - 1].key);
      monthInitialized.current = true;
    }
  }, [monthOptions]);

  const latestMonthKey = monthOptions[monthOptions.length - 1]?.key || "";
  const focusMonthKey = selectedMonth === "All" ? latestMonthKey : selectedMonth;

  const focusRecords = useMemo(() => {
    if (!focusMonthKey) return allRecords;
    return allRecords.filter((record) => record.monthKey === focusMonthKey);
  }, [allRecords, focusMonthKey]);

  const previousMonthKey = useMemo(() => {
    if (!focusMonthKey) return "";
    const index = monthOptions.findIndex((option) => option.key === focusMonthKey);
    return index > 0 ? monthOptions[index - 1].key : "";
  }, [focusMonthKey, monthOptions]);

  const previousMonthRecords = useMemo(() => {
    if (!previousMonthKey) return [];
    return allRecords.filter((record) => record.monthKey === previousMonthKey);
  }, [allRecords, previousMonthKey]);

  const totalRepaired = useMemo(() => sum(focusRecords, "valvesRepaired"), [focusRecords]);
  const totalGood = useMemo(() => sum(focusRecords, "good"), [focusRecords]);
  const totalReject = useMemo(() => sum(focusRecords, "reject"), [focusRecords]);
  const passRate = totalRepaired ? (totalGood / totalRepaired) * 100 : 0;

  const prevTotalRepaired = useMemo(() => sum(previousMonthRecords, "valvesRepaired"), [previousMonthRecords]);
  const prevTotalGood = useMemo(() => sum(previousMonthRecords, "good"), [previousMonthRecords]);
  const prevTotalReject = useMemo(() => sum(previousMonthRecords, "reject"), [previousMonthRecords]);

  const totalDisplay = useCountUp(totalRepaired);
  const goodDisplay = useCountUp(totalGood);
  const rejectDisplay = useCountUp(totalReject);

  const totalPct = pctChange(totalRepaired, prevTotalRepaired);
  const goodPct = pctChange(totalGood, prevTotalGood);
  const rejectPct = pctChange(totalReject, prevTotalReject);

  const currentLabel = selectedMonth === "All" ? "All records" : formatMonthLabel(focusMonthKey);

  const trendData = useMemo(() => {
    const map = new Map<string, { day: string; repaired: number; good: number; reject: number }>();
    for (const record of focusRecords) {
      const existing = map.get(record.dateKey) || {
        day: formatDateLabel(record.dateKey),
        repaired: 0,
        good: 0,
        reject: 0,
      };
      existing.repaired += record.valvesRepaired;
      existing.good += record.good;
      existing.reject += record.reject;
      map.set(record.dateKey, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [focusRecords]);

  const sourceDistribution = useMemo(
    () => groupCount(focusRecords, (record) => record.valveCameFrom),
    [focusRecords]
  );

  const installedDistribution = useMemo(
    () => groupMetric(focusRecords, (record) => record.installedTo),
    [focusRecords]
  );

  const shiftPerformance = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of focusRecords) {
      const bucket = timeBucket(record.time);
      map.set(bucket, (map.get(bucket) || 0) + record.valvesRepaired);
    }
    return Array.from(map.entries())
      .map(([shift, repaired]) => ({ shift, repaired }))
      .sort((a, b) => b.repaired - a.repaired);
  }, [focusRecords]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of allRecords) {
      if (!record.monthKey) continue;
      map.set(record.monthKey, (map.get(record.monthKey) || 0) + record.valvesRepaired);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, repaired]) => ({ month: formatMonthLabel(month), repaired }));
  }, [allRecords]);

  const rejectReasons = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of focusRecords) {
      if (record.reject <= 0) continue;
      const reason = inferRejectReason(record.remarks);
      map.set(reason, (map.get(reason) || 0) + record.reject);
    }
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [focusRecords]);

  const visibleRecords = useMemo(() => {
    return focusRecords.filter((record) => {
      if (filters.source && !record.valveCameFrom.toLowerCase().includes(filters.source.toLowerCase())) return false;
      if (filters.installedTo && !record.installedTo.toLowerCase().includes(filters.installedTo.toLowerCase())) return false;
      if (filters.remarks && !record.remarks.toLowerCase().includes(filters.remarks.toLowerCase())) return false;
      if (filters.status !== "All Status") {
        const status = getStatus(record);
        if (filters.status === "Completed" && status !== "good") return false;
        if (filters.status === "Has Reject" && status !== "reject") return false;
        if (filters.status === "Pending Review" && status === "good") return false;
      }
      return true;
    });
  }, [focusRecords, filters]);

  useEffect(() => {
    setPage(1);
  }, [selectedMonth, filters]);

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const pagedRows = visibleRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const peakShift = shiftPerformance[0];
  const topInstaller = installedDistribution[0];

  const loadingText = isLoading ? "Loading O-Ring data..." : "";
  const displayError = error instanceof Error ? error : null;

  return (
    <div className="h-screen bg-ccb-canvas overflow-hidden">
      <div className="flex h-full bg-white">
        <Sidebar />
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <div className="orm-page h-full overflow-y-auto">
            <SectionTitle
              title="Sheet-backed repair tracking for O-Ring monitoring"
              subtitle="Every chart and row below is pulled from the Google Sheet, so the dashboard now reflects the real records instead of mock data."
            />

            <div className="orm-shell">
        <div className="orm-hero">
          <div className="orm-hero-copy">
            <div className="orm-hero-kicker">Live source</div>
            <div className="orm-hero-title">Repair quality overview for {selectedMonth === "All" ? "all available data" : currentLabel}</div>
            <div className="orm-hero-text">
              The layout stays review-friendly, but the numbers now come directly from the sheet columns:
              date, time, valve came from, valves repaired, installed to, good, reject, and remarks.
            </div>
          </div>
          <div className="orm-hero-metrics">
            <div className="orm-hero-metric">
              <span>Pass rate</span>
              <strong>{passRate.toFixed(1)}%</strong>
            </div>
            <div className="orm-hero-metric">
              <span>Top installed to</span>
              <strong>{topInstaller?.label || "No data"}</strong>
            </div>
            <div className="orm-hero-metric">
              <span>Peak time window</span>
              <strong>{peakShift?.shift || "No data"}</strong>
            </div>
          </div>
        </div>

        <div className="orm-month-nav">
          <button className={`orm-month-pill all ${selectedMonth === "All" ? "active" : ""}`} onClick={() => setSelectedMonth("All")}>
            All
          </button>
          {monthOptions.map((option) => (
            <button
              key={option.key}
              className={`orm-month-pill ${selectedMonth === option.key ? "active" : ""}`}
              onClick={() => setSelectedMonth(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="orm-kpi-row">
          <StatCard
            label="Total Valves Repaired"
            value={totalDisplay.toLocaleString()}
            change={selectedMonth === "All" ? <span className="orm-chip good">All-time total</span> : <TrendBadge pct={totalPct} />}
            icon={Icon.Wrench}
            tone="navy"
          />
          <StatCard
            label="Good"
            value={goodDisplay.toLocaleString()}
            change={selectedMonth === "All" ? <span className="orm-chip good">All-time total</span> : <span className="orm-chip good">{Math.abs(goodPct).toFixed(1)}% vs previous month</span>}
            icon={Icon.Check2}
            tone="good"
          />
          <StatCard
            label="Reject"
            value={rejectDisplay.toLocaleString()}
            change={selectedMonth === "All" ? <span className="orm-chip reject">All-time total</span> : <span className="orm-chip reject">{Math.abs(rejectPct).toFixed(1)}% vs previous month</span>}
            icon={Icon.Reject}
            tone="reject"
          />
          <div className="orm-stat orm-stat-ring">
            <div className="orm-stat-top">
              <div className="orm-stat-label">Quality Efficiency</div>
              <div className="orm-stat-icon gold">
                <Icon.Target />
              </div>
            </div>
            <div className="orm-ring-wrap">
              <svg width="72" height="72" viewBox="0 0 58 58">
                <circle cx="29" cy="29" r="24" fill="none" stroke={COLORS.navySoft} strokeWidth="7" />
                <circle
                  cx="29"
                  cy="29"
                  r="24"
                  fill="none"
                  stroke={COLORS.good}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={150.8}
                  strokeDashoffset={150.8 * (1 - passRate / 100)}
                  transform="rotate(-90 29 29)"
                />
              </svg>
              <div>
                <div className="orm-ring-num">{passRate.toFixed(1)}%</div>
                <div className="orm-ring-cap">Pass rate this period</div>
              </div>
            </div>
          </div>
        </div>

              {isLoading ? (
          <div className="orm-panel">
            <div className="orm-panel-title">{loadingText}</div>
          </div>
              ) : displayError ? (
          <div className="orm-panel">
            <div className="orm-panel-title">Failed to load O-Ring data</div>
            <div className="orm-panel-sub">{displayError.message}</div>
          </div>
              ) : allRecords.length === 0 ? (
          <div className="orm-panel">
            <div className="orm-panel-title">No O-Ring rows found</div>
            <div className="orm-panel-sub">
              Check that the spreadsheet id is correct, the service account has access, and the sheet contains data under the headers.
            </div>
          </div>
              ) : (
          <>
            <div className="orm-grid-2">
              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Production Trend</div>
                    <div className="orm-panel-sub">
                      Daily repair totals for {selectedMonth === "All" ? "the latest available month" : currentLabel}
                    </div>
                  </div>
                  <div className="orm-panel-tag orm-tag-navy">trendline</div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.navy} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={COLORS.navy} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={COLORS.border} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 12, color: "#fff" }} labelStyle={{ color: "#fff" }} />
                    <Area type="monotone" dataKey="repaired" stroke="none" fill="url(#trendFill)" />
                    <Line type="monotone" dataKey="repaired" stroke={COLORS.navy} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: COLORS.navy, stroke: "#fff", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Quality Split</div>
                    <div className="orm-panel-sub">Good vs reject and the main reject reasons</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-gold">pass rate</div>
                </div>
                <div className="orm-split">
                  <div className="orm-donut-wrap">
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Good", value: totalGood },
                            { name: "Reject", value: totalReject },
                          ]}
                          dataKey="value"
                          innerRadius="72%"
                          outerRadius="100%"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill={COLORS.good} />
                          <Cell fill={COLORS.reject} />
                        </Pie>
                        <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 12, color: "#fff" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="orm-donut-center">
                      <div className="orm-pct">{passRate.toFixed(1)}%</div>
                      <div className="orm-cap">Good rate</div>
                    </div>
                  </div>
                  <div className="orm-legend-stack">
                    <div className="orm-legend-row">
                      <span className="orm-legend-dot" style={{ background: COLORS.good }} />
                      <span>Good</span>
                      <b>{totalGood}</b>
                    </div>
                    <div className="orm-legend-row">
                      <span className="orm-legend-dot" style={{ background: COLORS.reject }} />
                      <span>Reject</span>
                      <b>{totalReject}</b>
                    </div>
                    <div className="orm-reason-list">
                      {rejectReasons.map((reason, index) => (
                        <div className="orm-reason" key={reason.reason}>
                          <span className="orm-legend-dot" style={{ background: [COLORS.reject, COLORS.warning, COLORS.navy, COLORS.gold, COLORS.faint][index % 5] }} />
                          <span>{reason.reason}</span>
                          <b>{reason.count}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="orm-grid-2">
              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Installed To Distribution</div>
                    <div className="orm-panel-sub">Where the repaired o-rings ended up</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-good">top ranked</div>
                </div>
                {installedDistribution.slice(0, 5).map((item, index) => (
                  <div className="orm-rank-row" key={item.label}>
                    <div className={`orm-rank-num ${index === 0 ? "top" : ""}`}>#{index + 1}</div>
                    <div className="orm-rank-avatar" style={{ background: avatarGradient(index) }}>
                      {initials(item.label)}
                    </div>
                    <div className="orm-rank-info">
                      <div className="orm-rank-name">{item.label}</div>
                      <div className="orm-rank-bar-track">
                        <div className="orm-rank-bar-fill" style={{ width: `${installedDistribution[0]?.repaired ? (item.repaired / installedDistribution[0].repaired) * 100 : 0}%` }} />
                      </div>
                      <div className="orm-rank-meta">
                        {item.repaired} repaired • {item.good} good • {item.reject} reject
                      </div>
                    </div>
                    <div className="orm-rank-pct">{item.passRate.toFixed(0)}%</div>
                  </div>
                ))}
              </div>

              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Source Distribution</div>
                    <div className="orm-panel-sub">Where the valve repairs are coming from</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-navy">by source</div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sourceDistribution} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid horizontal={false} stroke={COLORS.border} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 12, color: "#fff" }} cursor={{ fill: COLORS.navySoft }} />
                    <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={22}>
                      {sourceDistribution.map((_, index) => (
                        <Cell key={index} fill={[COLORS.navy, "#3246A6", "#6A77D8", COLORS.gold][index % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="orm-grid-2">
              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Time Window Performance</div>
                    <div className="orm-panel-sub">Repairs grouped by the sheet time column</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-navy">peak: {peakShift?.shift || "n/a"}</div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={shiftPerformance}>
                    <CartesianGrid vertical={false} stroke={COLORS.border} />
                    <XAxis dataKey="shift" tick={{ fontSize: 10, fill: COLORS.muted }} axisLine={false} tickLine={false} interval={0} height={48} />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 12, color: "#fff" }} cursor={{ fill: COLORS.navySoft }} />
                    <Bar dataKey="repaired" fill={COLORS.navy} radius={[10, 10, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Monthly Summary</div>
                    <div className="orm-panel-sub">A month-to-month view of repaired counts</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-gold">live sheet</div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlySummary}>
                    <defs>
                      <linearGradient id="monthlyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.34} />
                        <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={COLORS.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: COLORS.navy, border: "none", borderRadius: 12, color: "#fff" }} />
                    <Area type="monotone" dataKey="repaired" stroke={COLORS.gold} strokeWidth={3} fill="url(#monthlyFill)" dot={{ r: 4, fill: "#fff", stroke: COLORS.gold, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="orm-grid-2">
              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Recent Activity</div>
                    <div className="orm-panel-sub">The latest rows from the sheet</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-good">live feed</div>
                </div>
                <div className="orm-feed">
                  {focusRecords.slice(0, 5).map((record) => {
                    const status = getStatus(record);
                    return (
                      <div className="orm-feed-item" key={`${record.tabName}-${record.rowNumber}`}>
                        <div className="orm-feed-time">{record.time || "No time"}</div>
                        <div className={`orm-feed-dot ${status === "reject" ? "warn" : "good"}`}>
                          {status === "reject" ? <Icon.Warn /> : <Icon.Check2 />}
                        </div>
                        <div className="orm-feed-body">
                          <div className="orm-feed-main">
                            <div className="orm-jo">
                              {record.valveCameFrom || "Unknown source"} • {formatDateLabel(record.dateKey)}
                            </div>
                            <div className="orm-meta">
                              {record.valvesRepaired} valves repaired • Installed to: {record.installedTo || "n/a"}
                            </div>
                          </div>
                          <div className="orm-feed-stats">
                            <div className="orm-feed-stat">
                              <div className="orm-n" style={{ color: COLORS.good }}>{record.good}</div>
                              <div className="orm-l">Good</div>
                            </div>
                            <div className="orm-feed-stat">
                              <div className="orm-n" style={{ color: COLORS.reject }}>{record.reject}</div>
                              <div className="orm-l">Reject</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="orm-panel">
                <div className="orm-panel-head">
                  <div>
                    <div className="orm-panel-title">Review Filters</div>
                    <div className="orm-panel-sub">Filter live sheet rows by source, destination, remarks, and status</div>
                  </div>
                  <div className="orm-panel-tag orm-tag-navy">search + filter</div>
                </div>
                <div className="orm-search-bar">
                  <div className="orm-field grow">
                    <Icon.Search />
                    <input
                      placeholder="Search source..."
                      value={filters.source}
                      onChange={(e) => setFilters((current) => ({ ...current, source: e.target.value }))}
                    />
                  </div>
                  <div className="orm-field">
                    <Icon.Source />
                    <input
                      placeholder="Installed to"
                      value={filters.installedTo}
                      onChange={(e) => setFilters((current) => ({ ...current, installedTo: e.target.value }))}
                    />
                  </div>
                  <div className="orm-field">
                    <Icon.User />
                    <input
                      placeholder="Remarks"
                      value={filters.remarks}
                      onChange={(e) => setFilters((current) => ({ ...current, remarks: e.target.value }))}
                    />
                  </div>
                  <div className="orm-field">
                    <Icon.Calendar />
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                      <option value="All">All</option>
                      {monthOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="orm-field">
                    <Icon.Check2 />
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
                    >
                      <option>All Status</option>
                      <option>Completed</option>
                      <option>Has Reject</option>
                      <option>Pending Review</option>
                    </select>
                  </div>
                  <button className="orm-btn-filter" type="button">
                    <Icon.Filter />
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="orm-panel orm-table-panel">
              <div className="orm-panel-head">
                <div>
                  <div className="orm-panel-title">O-Ring Records</div>
                  <div className="orm-panel-sub">Each row maps to the sheet columns you showed me</div>
                </div>
                <div className="orm-panel-tag orm-tag-reject">{visibleRecords.length} rows</div>
              </div>
              <div className="orm-table-wrap">
                <div className="orm-table-scroll">
                  <table className="orm-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Valve Came From</th>
                        <th>Valves Repaired</th>
                        <th>Installed To</th>
                        <th>Good</th>
                        <th>Reject</th>
                        <th>Remarks</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((record) => {
                        const status = getStatus(record);
                        return (
                          <tr key={`${record.tabName}-${record.rowNumber}`}>
                            <td>{formatDateLabel(record.dateKey)}</td>
                            <td>{record.time || "—"}</td>
                            <td><b>{record.valveCameFrom || "—"}</b></td>
                            <td>{record.valvesRepaired}</td>
                            <td>{record.installedTo || "—"}</td>
                            <td className="orm-cell-good">{record.good}</td>
                            <td className="orm-cell-reject">{record.reject}</td>
                            <td>{record.remarks || "—"}</td>
                            <td>
                              <span className={`orm-pill ${status}`}>
                                {status === "good" ? "Completed" : status === "reject" ? "Has Reject" : "Needs Review"}
                              </span>
                            </td>
                            <td>
                              <div className="orm-row-actions">
                                <button title="View" type="button">
                                  <Icon.Eye />
                                </button>
                                <button title="Edit" type="button">
                                  <Icon.Edit />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {pagedRows.length === 0 && (
                        <tr>
                          <td colSpan={10} style={{ textAlign: "center", padding: 28, color: COLORS.faint }}>
                            No rows match your current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="orm-table-foot">
                  <div className="orm-info">
                    Showing {visibleRecords.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, visibleRecords.length)} of {visibleRecords.length} rows
                  </div>
                  <div className="orm-pager">
                    <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1)
                      .slice(0, 5)
                      .map((value) => (
                        <button key={value} className={value === page ? "active" : ""} onClick={() => setPage(value)}>
                          {value}
                        </button>
                      ))}
                    <button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
