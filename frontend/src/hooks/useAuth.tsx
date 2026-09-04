import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type UserRole = "admin" | "player";

interface AuthState {
  username: string | null;
  role: UserRole | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<UserRole>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ username: null, role: null, loading: true });

  useEffect(() => {
    api
      .get<{ username: string; role: UserRole }>("/api/auth/me")
      .then((me) => setState({ username: me.username, role: me.role, loading: false }))
      .catch(() => setState({ username: null, role: null, loading: false }));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const me = await api.post<{ username: string; role: UserRole }>("/api/auth/login", { username, password });
    setState({ username: me.username, role: me.role, loading: false });
    return me.role;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setState({ username: null, role: null, loading: false });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
