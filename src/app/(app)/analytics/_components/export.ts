/**
 * Client-side export of whatever the current analytics view holds. Data was
 * already scoped by the server, so an export can never include more than the
 * user is allowed to see on screen.
 */
import { METRICS, formatMetric, type Cat, type KpiValue, type SeriesPoint, type TableData } from "@/lib/analytics/definitions";

export interface ExportMeta {
  title: string;
  period: string;
  comparison: string;
  hospital: string;
  doctor: string;
  generatedAt: string;
}

interface Sheet { name: string; rows: (string | number)[][] }

const isKpi = (x: unknown): x is KpiValue => !!x && typeof x === "object" && "id" in x && (x as KpiValue).id in METRICS;
const isCat = (x: unknown): x is Cat => !!x && typeof x === "object" && "label" in x && "value" in x && typeof (x as Cat).value === "number";
const isPoint = (x: unknown): x is SeriesPoint => !!x && typeof x === "object" && "values" in x && "key" in x;
const isTable = (x: unknown): x is TableData => !!x && typeof x === "object" && "columns" in x && "rows" in x;

function humanize(key: string) {
  const s = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Turns one tab's data object into sheets: KPIs first, then every chart and table. */
export function sheetsFromData(sectionTitle: string, data: unknown): Sheet[] {
  if (!data || typeof data !== "object") return [];
  const sheets: Sheet[] = [];
  const kpiRows: (string | number)[][] = [];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isTable(value)) {
      sheets.push({
        name: value.title,
        rows: [value.columns.map((c) => c.label), ...value.rows.map((r) => value.columns.map((c) => r[c.key] ?? ""))],
      });
    } else if (Array.isArray(value) && value.length > 0) {
      if (value.every(isKpi)) {
        for (const k of value) {
          const def = METRICS[k.id];
          kpiRows.push([k.label ?? def.label, k.display ?? formatMetric(k.value, def.format), k.prev === null || k.prev === undefined ? "" : formatMetric(k.prev, def.format), def.calc]);
        }
      } else if (value.every(isPoint)) {
        const seriesKeys = Object.keys(value[0].values);
        sheets.push({ name: humanize(key), rows: [["Period", ...seriesKeys.map(humanize)], ...value.map((p) => [p.label, ...seriesKeys.map((s) => p.values[s] ?? 0)])] });
      } else if (value.every(isCat)) {
        sheets.push({ name: humanize(key), rows: [["Category", "Value"], ...value.map((c) => [c.label, c.value])] });
      }
    }
  }

  if (kpiRows.length) sheets.unshift({ name: `${sectionTitle} KPIs`, rows: [["Metric", "Value", "Comparison value", "Calculation"], ...kpiRows] });
  return sheets;
}

function metaRows(meta: ExportMeta): (string | number)[][] {
  return [
    [meta.title],
    ["Reporting period", meta.period],
    ["Compared with", meta.comparison],
    ["Hospital", meta.hospital],
    ["Doctor", meta.doctor],
    ["Generated", meta.generatedAt],
  ];
}

/* ── CSV ──────────────────────────────────────────────────────────────────── */

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function toCsv(meta: ExportMeta, sheets: Sheet[]) {
  const lines: string[] = metaRows(meta).map((r) => r.map(csvCell).join(","));
  for (const s of sheets) {
    lines.push("", csvCell(s.name));
    for (const r of s.rows) lines.push(r.map(csvCell).join(","));
  }
  return "﻿" + lines.join("\r\n");
}

/* ── Excel (SpreadsheetML 2003: opens natively in Excel, multiple sheets) ── */

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

function xmlRow(r: (string | number)[], bold = false) {
  const cells = r.map((v) => {
    const type = typeof v === "number" ? "Number" : "String";
    return `<Cell${bold ? ' ss:StyleID="h"' : ""}><Data ss:Type="${type}">${xml(String(v))}</Data></Cell>`;
  });
  return `<Row>${cells.join("")}</Row>`;
}

export function toExcel(meta: ExportMeta, sheets: Sheet[]) {
  const used = new Set<string>();
  const summary = `<Worksheet ss:Name="${xml(sheetName("Summary", used))}"><Table>${metaRows(meta).map((r, i) => xmlRow(r, i === 0)).join("")}</Table></Worksheet>`;
  const body = sheets.map((s) => {
    const [head, ...rest] = s.rows;
    return `<Worksheet ss:Name="${xml(sheetName(s.name, used))}"><Table>${head ? xmlRow(head, true) : ""}${rest.map((r) => xmlRow(r)).join("")}</Table></Worksheet>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>`
    + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
    + `<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>${summary}${body}</Workbook>`;
}

/* ── Download ─────────────────────────────────────────────────────────────── */

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTableCsv(table: TableData) {
  const rows = [table.columns.map((c) => c.label), ...table.rows.map((r) => table.columns.map((c) => r[c.key] ?? ""))];
  const slug = table.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  download(`rf-health-${slug}.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
}
