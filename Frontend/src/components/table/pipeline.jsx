import { useState } from "react";
import DynamicTable from "./table";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
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
  const [useCustomColumns, setUseCustomColumns] = useState(true);

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
      style={{
        flex: 1,
        padding: 28,
        overflow: "auto",
        background: t.bg,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: t.text,
              }}
            >
              Automate
            </p>
            <p
              style={{
                margin: "6px 0 0",
                maxWidth: 660,
                color: t.textMuted,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              A dynamic data table for your automate workspace.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Button
              size="sm"
              variant={useCustomColumns ? "default" : "outline"}
              onClick={() => setUseCustomColumns(true)}
              style={{ minWidth: 130 }}
            >
              Create New
            </Button>
            <Button
              size="sm"
              variant={!useCustomColumns ? "default" : "outline"}
              onClick={() => setUseCustomColumns(false)}
              style={{ minWidth: 130 }}
            >
              Edit Existing
            </Button>
          </div>
        </div>

        <Card
          style={{
            border: `1px solid ${t.border}`,
            background: t.surface,
            boxShadow: t.shadow,
          }}
        >

          <CardContent
            style={{
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
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

              <TabsContent value="data">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <Label
                    htmlFor="json-input"
                    style={{ color: t.textMuted, fontSize: 13 }}
                  >
                    Paste a JSON array of objects
                  </Label>
                  <Textarea
                    id="json-input"
                    style={{
                      minHeight: 220,
                      fontFamily: "DM Mono, monospace",
                      color: t.text,
                      background: t.surface2,
                      border: `1px solid ${t.border}`,
                    }}
                    placeholder='[{"id": 1, "name": "Alice", "age": 30}]'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />

                  {error && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: t.errColor,
                        fontSize: 13,
                      }}
                    >
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button onClick={handleLoadJson}>Load JSON</Button>
                    <Button variant="outline" onClick={handleReset}>
                      Reset to sample
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
