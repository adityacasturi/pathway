import { Check, Minus } from "lucide-react";

type Cell = "yes" | "partial" | "no" | string;

type Row = {
  label: string;
  pathway: Cell;
  simplify: Cell;
  spreadsheet: Cell;
};

const ROWS: Row[] = [
  { label: "Price", pathway: "Free", simplify: "$39.99/mo", spreadsheet: "Free" },
  { label: "Check frequency", pathway: "Every 15 min", simplify: "Hourly", spreadsheet: "Manual" },
  { label: "Instant new-role alerts", pathway: "yes", simplify: "no", spreadsheet: "no" },
  { label: "Daily digest of new roles", pathway: "yes", simplify: "no", spreadsheet: "no" },
];

function CellMark({ value, emphasis }: { value: Cell; emphasis?: boolean }) {
  if (value === "yes") {
    return (
      <span className={`compare-mark ${emphasis ? "compare-mark--yes" : "compare-mark--neutral"}`}>
        <Check size={15} strokeWidth={2.4} />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="compare-mark compare-mark--no" aria-label="No">
        <Minus size={15} strokeWidth={2.2} />
      </span>
    );
  }
  if (value === "partial") {
    return <span className="compare-text compare-text--muted">Partial</span>;
  }
  return (
    <span className={`compare-text ${emphasis ? "compare-text--strong" : "compare-text--muted"}`}>
      {value}
    </span>
  );
}

export function ComparisonTable() {
  return (
    <div className="compare">
      <div className="compare-row compare-row--head">
        <span className="compare-feature label-micro">Feature</span>
        <span className="compare-col compare-col--pathway">Pathway</span>
        <span className="compare-col">Simplify</span>
        <span className="compare-col">Spreadsheet</span>
      </div>
      {ROWS.map((row) => (
        <div key={row.label} className="compare-row">
          <span className="compare-feature">{row.label}</span>
          <span className="compare-col compare-col--pathway">
            <CellMark value={row.pathway} emphasis />
          </span>
          <span className="compare-col">
            <CellMark value={row.simplify} />
          </span>
          <span className="compare-col">
            <CellMark value={row.spreadsheet} />
          </span>
        </div>
      ))}
    </div>
  );
}
