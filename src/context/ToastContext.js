"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Toast from "@/components/Toast/Toast";

const TOAST_DURATION_MS = 3000;
const ToastContext = createContext(null);

function createToast(type, message) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    message: String(message || "").trim(),
  };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutIdsRef = useRef(new Map());

  const dismiss = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));

    const timeoutId = timeoutIdsRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(toastId);
    }
  }, []);

  const push = useCallback(
    (type, message) => {
      const toast = createToast(type, message);
      if (!toast.message) {
        return null;
      }

      setToasts((current) => [...current, toast]);

      const timeoutId = window.setTimeout(() => {
        dismiss(toast.id);
      }, TOAST_DURATION_MS);
      timeoutIdsRef.current.set(toast.id, timeoutId);
      return toast.id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      push,
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
      dismiss,
    }),
    [dismiss, push]
  );

  useEffect(
    () => () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
    },
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
