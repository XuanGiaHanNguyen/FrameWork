export function Label({ className = "", ...props }) {
  return (
    <label
      className={`block text-sm font-medium text-slate-700 ${className}`.trim()}
      {...props}
    />
  );
}
