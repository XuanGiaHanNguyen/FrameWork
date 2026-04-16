import { forwardRef } from "react";

export const Button = forwardRef(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
    const styles =
      variant === "outline"
        ? "border border-neutral-200 bg-white text-[#3d3d3d] hover:bg-neutral-100 focus:outline-none"
        : "bg-[#3d3d3d] text-white hover:bg-[#3d3d3d] focus:outline-none";

    return (
      <button
        ref={ref}
        className={`${base} ${styles} ${className}`.trim()}
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
