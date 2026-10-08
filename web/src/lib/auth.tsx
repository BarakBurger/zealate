import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from './api';

type AuthCtx = { user: User | null; ready: boolean; setUser: (u: User | null) => void; logout: () => Promise<void> };
const Ctx = createContext<AuthCtx>(null!);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api<{ user: User | null }>('/auth/me').then(r => setUser(r.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); }, []);
  return <Ctx.Provider value={{ user, ready, setUser, logout }}>{children}</Ctx.Provider>;
};
export const useAuth = () => useContext(Ctx);
