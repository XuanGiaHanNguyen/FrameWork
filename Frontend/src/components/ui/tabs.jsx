import { createContext, useContext, useState } from "react";

const TabsContext = createContext(null);

export function Tabs({ defaultValue, value, onValueChange, children }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value ?? internalValue;

  const setValue = (next) => {
    onValueChange?.(next);
    if (value === undefined) setInternalValue(next);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      {children}
    </TabsContext.Provider>
  );
}

export function TabsList({ className = "", ...props }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()} {...props} />
  );
}

export function TabsTrigger({ value, className = "", children, ...props }) {
  const context = useContext(TabsContext);
  const active = context?.value === value;

  return (
    <button
      type="button"
      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${active ? "bg-slate-900 text-white" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"} ${className}`.trim()}
      onClick={() => context?.setValue?.(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = "", children, ...props }) {
  const context = useContext(TabsContext);
  if (context?.value !== value) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
