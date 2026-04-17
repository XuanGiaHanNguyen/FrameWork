import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  LayoutList,
  X,
  Plus,
  ChevronsUpDown,
} from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

// ─── helpers ────────────────────────────────────────────────────────────────

function detectType(value) {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && !isNaN(Date.parse(value)))
      return "date";
    return "string";
  }
  return "unknown";
}

function formatCell(col, value) {
  if (value == null) return <span className="text-muted-foreground">—</span>;

  if (col.type === "boolean") {
    return (
      <Badge variant={value ? "success" : "secondary"}>
        {value ? "Active" : "Inactive"}
      </Badge>
    );
  }

  if (col.type === "array" && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs font-normal">
            {tag}
          </Badge>
        ))}
      </div>
    );
  }

  if (col.type === "date") {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return String(value);
}

function comparator(a, b, key, type) {
  let av = a[key],
    bv = b[key];
  if (Array.isArray(av)) av = av.join(",");
  if (Array.isArray(bv)) bv = bv.join(",");
  if (av == null) return 1;
  if (bv == null) return -1;
  if (type === "number") return av - bv;
  if (type === "date") return new Date(av) - new Date(bv);
  return String(av).localeCompare(String(bv));
}

const OPERATORS = {
  string: ["contains", "=", "!=", "startsWith", "endsWith"],
  number: ["=", "!=", ">", ">=", "<", "<="],
  date: ["=", "!=", ">", "<"],
  boolean: ["=", "!="],
  array: ["contains"],
  unknown: ["=", "!="],
};

function evaluateRule(row, rule) {
  const raw = row[rule.field];
  const val = String(raw ?? "").toLowerCase();
  const target = rule.value.toLowerCase();

  switch (rule.op) {
    case "=":
      return val === target;
    case "!=":
      return val !== target;
    case "contains": {
      if (Array.isArray(raw))
        return raw.some((v) => String(v).toLowerCase().includes(target));
      return val.includes(target);
    }
    case "startsWith":
      return val.startsWith(target);
    case "endsWith":
      return val.endsWith(target);
    case ">":
      return Number(raw) > Number(rule.value);
    case ">=":
      return Number(raw) >= Number(rule.value);
    case "<":
      return Number(raw) < Number(rule.value);
    case "<=":
      return Number(raw) <= Number(rule.value);
    default:
      return true;
  }
}

// ─── FilterPopover ───────────────────────────────────────────────────────────

function FilterPopover({ columns, activeFilters, onApply, onRemove }) {
  const [field, setField] = useState(columns[0]?.key ?? "");
  const [op, setOp] = useState("contains");
  const [value, setValue] = useState("");

  const currentCol = columns.find((c) => c.key === field);
  const ops = OPERATORS[currentCol?.type ?? "string"] ?? ["=", "!="];

  const handleAdd = () => {
    if (!value.trim()) return;
    onApply({ field, op, value });
    setValue("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {activeFilters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-3" align="start">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Active filters
        </p>

        {activeFilters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No filters applied.</p>
        ) : (
          <div className="space-y-1">
            {activeFilters.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-xs"
              >
                <span>
                  <span className="font-medium">{f.field}</span>{" "}
                  <span className="text-muted-foreground">{f.op}</span>{" "}
                  <span className="font-medium">"{f.value}"</span>
                </span>
                <button
                  onClick={() => onRemove(i)}
                  className="ml-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Add rule
          </p>
          <div className="flex gap-1.5">
            <Select
              value={field}
              onValueChange={(v) => {
                setField(v);
                setOp(
                  OPERATORS[
                    columns.find((c) => c.key === v)?.type ?? "string"
                  ][0],
                );
              }}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns
                  .filter((c) => c.type !== "array" || true)
                  .map((c) => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={op} onValueChange={setOp}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ops.map((o) => (
                  <SelectItem key={o} value={o} className="text-xs">
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1.5">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="Value…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" className="h-8 px-2" onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── GroupByPopover ──────────────────────────────────────────────────────────

function GroupByPopover({ columns, groupBy, onChange }) {
  const groupableColumns = columns.filter(
    (c) => c.type !== "array" && c.type !== "unknown",
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={groupBy ? "secondary" : "outline"}
          size="sm"
          className="gap-2"
        >
          <LayoutList className="w-3.5 h-3.5" />
          {groupBy
            ? `Grouped by ${columns.find((c) => c.key === groupBy)?.label ?? groupBy}`
            : "Group by"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1.5" align="start">
        {groupableColumns.map((col) => (
          <button
            key={col.key}
            onClick={() => onChange(groupBy === col.key ? null : col.key)}
            className={cn(
              "w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors",
              groupBy === col.key && "bg-muted font-medium",
            )}
          >
            {col.label}
          </button>
        ))}
        {groupBy && (
          <>
            <div className="my-1 border-t" />
            <button
              onClick={() => onChange(null)}
              className="w-full text-left px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
            >
              Clear grouping
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── SortIcon ────────────────────────────────────────────────────────────────

function SortIcon({ direction }) {
  if (direction === "asc")
    return <ChevronUp className="w-3 h-3 ml-1 shrink-0" />;
  if (direction === "desc")
    return <ChevronDown className="w-3 h-3 ml-1 shrink-0" />;
  return <ChevronsUpDown className="w-3 h-3 ml-1 shrink-0 opacity-30" />;
}

// ─── DynamicTable ────────────────────────────────────────────────────────────

export default function DynamicTable({
  data = [],
  columns,
  pageSize = 10,
  searchable = true,
  filterable = true,
  groupable = true,
  theme = {},
}) {
  const t = theme;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [page, setPage] = useState(1);
  const [perPage] = useState(pageSize);

  // Auto-detect columns if not provided
  const cols = useMemo(() => {
    if (columns) return columns;
    if (!data.length) return [];
    const keys = [...new Set(data.flatMap(Object.keys))];
    return keys.map((key) => ({
      key,
      label:
        key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
      type: detectType(data.find((r) => r[key] != null)?.[key]),
    }));
  }, [data, columns]);

  // Filter
  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        cols.some((c) =>
          String(r[c.key] ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    }
    for (const rule of filters) {
      rows = rows.filter((r) => evaluateRule(r, rule));
    }
    return rows;
  }, [data, search, filters, cols]);

  // Sort
  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = cols.find((c) => c.key === sort.key);
    const multiplier = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => comparator(a, b, sort.key, col?.type) * multiplier,
    );
  }, [filtered, sort, cols]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const handleSort = useCallback((key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  const toggleGroup = useCallback((key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const removeFilter = useCallback((index) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
    setPage(1);
  }, []);

  const addFilter = useCallback((rule) => {
    setFilters((prev) => [...prev, rule]);
    setPage(1);
  }, []);

  // Group rows
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    sorted.forEach((row) => {
      const gk = String(row[groupBy] ?? "—");
      if (!map.has(gk)) map.set(gk, []);
      map.get(gk).push(row);
    });
    return map;
  }, [sorted, groupBy]);

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        "--border": t.border,
        "--surface": t.surface,
        "--surface-2": t.surface2,
        "--text": t.text,
        "--text-muted": t.textMuted,
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {searchable && (
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            <Input
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-9 h-9 text-[var(--text)]"
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}

        {filterable && (
          <FilterPopover
            columns={cols}
            activeFilters={filters}
            onApply={addFilter}
            onRemove={removeFilter}
          />
        )}

        {groupable && (
          <GroupByPopover
            columns={cols}
            groupBy={groupBy}
            onChange={setGroupBy}
          />
        )}
      </div>

      {/* Active filter tags */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[var(--text)] text-xs"
            >
              <span className="font-semibold">{f.field}</span>
              <span className="text-[var(--text-muted)]">{f.op}</span>
              <span className="font-semibold">&quot;{f.value}&quot;</span>
              <button
                onClick={() => removeFilter(i)}
                className="border-none bg-transparent text-[var(--text-muted)] cursor-pointer p-0"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--surface-2)]">
              {cols.map((col) => (
                <TableHead
                  key={col.key}
                  className="cursor-pointer select-none whitespace-nowrap px-4 py-3.5 text-xs font-semibold text-[var(--text)]"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <SortIcon
                      direction={sort.key === col.key ? sort.dir : null}
                    />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups ? (
              Array.from(groups.entries()).map(([gk, rows]) => {
                const open = expandedGroups.has(gk);
                const groupCol = cols.find((c) => c.key === groupBy);
                return (
                  <>
                    <TableRow
                      key={`group-${gk}`}
                      onClick={() => toggleGroup(gk)}
                      className="cursor-pointer bg-[var(--surface-2)]"
                    >
                      <TableCell
                        colSpan={cols.length}
                        className="px-4 py-3 text-sm text-[var(--text)]"
                      >
                        <div className="flex items-center gap-2.5">
                          {open ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          )}
                          <span className="font-semibold">
                            {groupCol?.label}: {gk}
                          </span>
                          <Badge variant="secondary">{rows.length}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    {open &&
                      rows.map((row, ri) => (
                        <TableRow key={`${gk}-${ri}`}>
                          {cols.map((col) => (
                            <TableCell
                              key={col.key}
                              className="px-4 py-3 text-sm text-[var(--text)]"
                            >
                              {formatCell(col, row[col.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                  </>
                );
              })
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={cols.length}
                  className="px-4 py-10 text-center text-sm text-[var(--text-muted)]"
                >
                  No results found
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, i) => (
                <TableRow key={i}>
                  {cols.map((col) => (
                    <TableCell
                      key={col.key}
                      className="px-4 py-3 text-sm text-[var(--text)]"
                    >
                      {formatCell(col, row[col.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!groups && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-sm text-[var(--text-muted)]">
            {sorted.length === 0
              ? "No results"
              : `${(safePage - 1) * perPage + 1}–${Math.min(safePage * perPage, sorted.length)} of ${sorted.length}`}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="min-w-[32px] min-h-[32px]"
              disabled={safePage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-w-[32px] min-h-[32px]"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - safePage) <= 2)
              .map((n) => (
                <Button
                  key={n}
                  variant={n === safePage ? "default" : "outline"}
                  size="icon"
                  className="min-w-[32px] min-h-[32px] text-xs"
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}

            <Button
              variant="outline"
              size="icon"
              className="min-w-[32px] min-h-[32px]"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-w-[32px] min-h-[32px]"
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
