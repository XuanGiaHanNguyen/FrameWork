export function Card({ className = "", ...props }) {
  return (
    <div
      className={`bg-[#fafafa] rounded-xl ${className}`.trim()}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }) {
  return (
    <div className={`space-y-1 px-6 py-5 ${className}`.trim()} {...props} />
  );
}

export function CardTitle({ className = "", ...props }) {
  return (
    <h2
      className={`text-lg font-semibold text-slate-900 ${className}`.trim()}
      {...props}
    />
  );
}

export function CardDescription({ className = "", ...props }) {
  return (
    <p className={`text-sm text-slate-600 ${className}`.trim()} {...props} />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={`px-6 pb-6 ${className}`.trim()} {...props} />;
}
