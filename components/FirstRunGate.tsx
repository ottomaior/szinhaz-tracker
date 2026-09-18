import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { getFirstRunStatus } from "@/services/profileService";

/**
 * Opens the first run once, for an account that has never seen it.
 *
 * Nothing in the app reacts to a sign-in as such: `AuthContext` ignores the
 * event and every sign-in path ends in `closeModal`, which lands on a tab. On
 * the web the Google redirect does not even return to the code that started
 * it. So the question "is this a new account" is asked here, from the fact
 * on the row (`profiles.onboarded_at`, 0061), the first time a session is
 * seen on a tab, which is the one place every path passes through.
 *
 * Only on a tab, deliberately. A recovery link opens `/reset-password` with
 * a short-lived session, and a welcome sliding over a password form is the
 * wrong moment; a deep link into a play can wait for the reader to come up
 * for air. Asked once per user per app load, whatever the answer, so a slow
 * response cannot open it twice.
 */
const TAB_PATHS = new Set(["/", "/discover", "/watchlist", "/profile"]);

export function FirstRunGate() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;
    if (askedFor.current === session.user.id) return;
    if (!TAB_PATHS.has(pathname)) return;
    askedFor.current = session.user.id;
    getFirstRunStatus()
      .then((status) => {
        if (status && !status.onboardedAt) router.push("/first-run");
      })
      .catch(() => undefined);
  }, [loading, session, pathname, router]);

  return null;
}
