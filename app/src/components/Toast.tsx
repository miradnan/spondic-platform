import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface ToastItem {
  id: string;
  type: "success" | "error";
  message: string;
}

interface ToastContextValue {
  toast: (type: "success" | "error", message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((type: "success" | "error", message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastNotification key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastNotification({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm min-w-[300px] ${
        item.type === "success"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {item.type === "success" ? (
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600" />
      ) : (
        <XCircleIcon className="h-5 w-5 shrink-0 text-red-600" />
      )}
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="ml-2 shrink-0 text-current opacity-60 hover:opacity-100"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
