import { useState } from "react";
import DynamicTable from "./table";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Tabs, TabsContent } from "../ui/tabs";
import { Card, CardContent } from "../ui/card";
import { AlertCircle } from "lucide-react";

const SAMPLE_DATA = [
  {
    id: 1,
    name: "Juan Perez",
    email: "juan@example.com",
    registered: "2023-01-15T10:30:00Z",
    active: true,
    age: 28,
    tags: ["client", "premium", "new"],
    visits: 15,
  },
  {
    id: 2,
    name: "Maria Lopez",
    email: "maria@example.com",
    registered: "2022-11-20T14:45:00Z",
    active: true,
    age: 34,
    tags: ["client", "regular"],
    visits: 42,
  },
  {
    id: 3,
    name: "Carlos Rodriguez",
    email: "carlos@example.com",
    registered: "2023-03-05T09:15:00Z",
    active: false,
    age: 45,
    tags: ["client", "inactive"],
    visits: 3,
  },
];

const CUSTOM_COLUMNS = [
  { key: "id", label: "ID", type: "number" },
  { key: "name", label: "Name", type: "string" },
  { key: "email", label: "Email", type: "string" },
  { key: "registered", label: "Registered", type: "date" },
  { key: "active", label: "Status", type: "boolean" },
  { key: "age", label: "Age", type: "number" },
  { key: "tags", label: "Tags", type: "array" },
  { key: "visits", label: "Visits", type: "number" },
];

export default function DemoPage({ theme: t = {} }) {
  const [jsonInput, setJsonInput] = useState("");
  const [tableData, setTableData] = useState(SAMPLE_DATA);
  const [error, setError] = useState("");
  const useCustomColumns = true;

  const handleLoadJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        throw new Error("Data must be a JSON array of objects");
      }
      setTableData(parsed);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = () => {
    setTableData(SAMPLE_DATA);
    setJsonInput("");
    setError("");
  };

  return (
    <div
      className="flex-1 overflow-auto bg-[var(--bg)] p-7"
      style={{
        "--bg": t.bg,
        "--surface": t.surface,
        "--surface-2": t.surface2,
        "--border": t.border,
        "--text": t.text,
        "--text-muted": t.textMuted,
        "--shadow": t.shadow,
        "--err": t.errColor,
      }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-2xl font-bold text-[var(--text)]">
              Notebooks
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Search or create a notebook for your research.
            </p>
          </div>

          <div className="flex flex-row gap-2">
            <Button
              className="rounded-[10px] bg-[var(--text)] text-[var(--bg)] px-4 py-2 text-sm font-semibold"
              onClick={() => {}}
            >
              New notebook
            </Button>
          </div>
        </div>

        <Card className="!bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow)]">
          <CardContent className="flex flex-col gap-5 p-6">
            <Tabs defaultValue="table">
              <TabsContent value="table">
                <DynamicTable
                  theme={t}
                  data={tableData}
                  columns={useCustomColumns ? CUSTOM_COLUMNS : undefined}
                  pageSize={5}
                  searchable
                  filterable
                  groupable
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
