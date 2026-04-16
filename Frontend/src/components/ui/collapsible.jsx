import {
  createContext,
  useContext,
  useState,
  cloneElement,
  Children,
} from "react";

const CollapsibleContext = createContext(null);

export function Collapsible({ children, open: openProp, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const value = isControlled ? openProp : open;

  const setValue = (next) => {
    if (!isControlled) setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open: value, setOpen: setValue }}>
      {children}
    </CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({ asChild, children, ...props }) {
  const ctx = useContext(CollapsibleContext);

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

export function CollapsibleContent({ className = "", children, ...props }) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx.open) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
