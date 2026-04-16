import { createContext, useContext, useState } from "react";

const SelectContext = createContext(null);

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className = "", children, ...props }) {
  const ctx = useContext(SelectContext);

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-between w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ${className}`.trim()}
      onClick={() => ctx.setOpen(!ctx.open)}
      {...props}
    >
      {children}
    </button>
  );
}

export function SelectValue({ className = "", placeholder, ...props }) {
  const ctx = useContext(SelectContext);
  return (
    <span className={`text-sm text-slate-700 ${className}`.trim()} {...props}>
      {ctx.value ?? placeholder}
    </span>
  );
}

export function SelectContent({ className = "", children, ...props }) {
  const ctx = useContext(SelectContext);
  if (!ctx.open) return null;
  return (
    <div
      className={`absolute z-20 mt-1 min-w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, className = "", children, ...props }) {
  const ctx = useContext(SelectContext);

  return (
    <button
      type="button"
      className={`block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 ${className}`.trim()}
      onClick={() => {
        ctx.onValueChange?.(value);
        ctx.setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
