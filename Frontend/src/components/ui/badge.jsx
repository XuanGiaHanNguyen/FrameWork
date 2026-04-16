export function Badge({ className = "", ...props }) {
  return (
    <span
      className={`inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ${className}`.trim()}
      {...props}
    />
  );
}
