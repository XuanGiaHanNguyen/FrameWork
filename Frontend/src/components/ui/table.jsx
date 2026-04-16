export function Table({ className = "", ...props }) {
  return (
    <table
      className={`min-w-full divide-y divide-slate-200 ${className}`.trim()}
      {...props}
    />
  );
}

export function TableHeader({ className = "", ...props }) {
  return <thead className={className} {...props} />;
}

export function TableBody({ className = "", ...props }) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className = "", ...props }) {
  return <tr className={className} {...props} />;
}

export function TableHead({ className = "", ...props }) {
  return (
    <th
      className={`px-3 py-3 text-left text-sm font-semibold text-slate-900 ${className}`.trim()}
      {...props}
    />
  );
}

export function TableCell({ className = "", ...props }) {
  return (
    <td
      className={`px-3 py-3 text-sm text-slate-700 ${className}`.trim()}
      {...props}
    />
  );
}
