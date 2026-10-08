import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from './api';

/** mail: the server can send account email (confirmation, password reset). */
type AuthCtx = { user: User | null; ready: boolean; mail: boolean; setUser: (u: User | null) => void; logout: () => Promise<void> };
const Ctx = createContext<AuthCtx>(null!);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mail, setMail] = useState(false);
  useEffect(() => {
    api<{ user: User | null; mail: boolean }>('/auth/me').then(r => { setUser(r.user); setMail(!!r.mail); }).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); }, []);
  return <Ctx.Provider value={{ user, ready, mail, setUser, logout }}>{children}</Ctx.Provider>;
};
export const useAuth = () => useContext(Ctx);
