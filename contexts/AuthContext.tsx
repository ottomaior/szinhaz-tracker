import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { consumeAuthLink } from "@/services/authService";

type AuthContextValue = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // On a device the URL an e-mailed link opened the app with has to be
    // consumed *before* `loading` clears: the reset-password screen reads
    // "no session once loading is over" as "this link is no good", so a
    // session that arrives a tick later would be too late. On web the client
    // reads the URL itself (`detectSessionInUrl`) and this is a no-op.
    const fromLink =
      Platform.OS === "web"
        ? Promise.resolve(false)
        : Linking.getInitialURL()
            .then(consumeAuthLink)
            .catch(() => false);

    fromLink
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // The same for a link that arrives while the app is already open — the
    // person reads the mail on the phone the app is running on, which is the
    // common case. `setSession` inside emits onAuthStateChange, so nothing
    // more is needed here.
    const opened =
      Platform.OS === "web"
        ? undefined
        : Linking.addEventListener("url", ({ url }) => {
            consumeAuthLink(url).catch(() => undefined);
          });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      opened?.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
