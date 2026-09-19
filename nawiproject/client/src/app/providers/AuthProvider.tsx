import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export type Role = 'TESTER' | 'REVIEWER' | 'ADMIN';
export type User = { id: string; firstName: string; lastName: string; email: string; role: Role };

type AuthValue = { user: User | null; loading: boolean; login: (user: User) => void; logout: () => Promise<void> };
const Auth = createContext<AuthValue>({ user: null, loading: true, login: () => {}, logout: async () => {} });

export function useAuth() { return useContext(Auth); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { axios.get('/auth/me').then(response => setUser(response.data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  const logout = async () => { await axios.post('/auth/logout'); setUser(null); };
  return <Auth.Provider value={{ user, loading, login: setUser, logout }}>{children}</Auth.Provider>;
}
