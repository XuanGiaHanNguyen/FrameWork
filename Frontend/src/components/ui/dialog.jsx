import {
  createContext,
  useContext,
  useState,
  cloneElement,
  Children,
} from "react";

const DialogContext = createContext(null);

export function Dialog({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ asChild, children, ...props }) {
  const ctx = useContext(DialogContext);

  const handleClick = (event) => {
    children.props.onClick?.(event);
    ctx.setOpen(true);
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

export function DialogContent({ children, ...props }) {
  const ctx = useContext(DialogContext);
  if (!ctx.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-xl"
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = "", ...props }) {
  return <div className={`mb-4 ${className}`.trim()} {...props} />;
}

export function DialogTitle({ className = "", ...props }) {
  return (
    <h2
      className={`text-lg font-semibold text-slate-900 ${className}`.trim()}
      {...props}
    />
  );
}

export function DialogFooter({ className = "", ...props }) {
  return (
    <div
      className={`mt-4 flex justify-end gap-2 ${className}`.trim()}
      {...props}
    />
  );
}
