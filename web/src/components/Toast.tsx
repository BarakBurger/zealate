import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => {});

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">{msg && <div className="toast">{msg}</div>}</div>
    </Ctx.Provider>
  );
};
export const useToast = () => useContext(Ctx);
