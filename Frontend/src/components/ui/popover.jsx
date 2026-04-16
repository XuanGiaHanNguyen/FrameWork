import {
  createContext,
  useContext,
  useState,
  cloneElement,
  Children,
} from "react";

const PopoverContext = createContext(null);

export function Popover({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ asChild, children, ...props }) {
  const ctx = useContext(PopoverContext);

  const handleClick = (event) => {
    children.props.onClick?.(event);
    ctx.setOpen(!ctx.open);
  };

  if (asChild) {
    return cloneElement(Children.only(children), {
      onClick: handleClick,
      ...props,
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export function PopoverContent({ className = "", children, ...props }) {
  const ctx = useContext(PopoverContext);
  if (!ctx.open) return null;

  return (
    <div
      className={`absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white p-3 shadow-lg ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
