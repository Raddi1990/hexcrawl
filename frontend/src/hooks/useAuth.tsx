import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

interface AuthState {
  username: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ username: null, loading: true });

  useEffect(() => {
    api
      .get<{ username: string }>("/api/auth/me")
      .then((me) => setState({ username: me.username, loading: false }))
      .catch(() => setState({ username: null, loading: false }));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const me = await api.post<{ username: string }>("/api/auth/login", { username, password });
    setState({ username: me.username, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setState({ username: null, loading: false });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
