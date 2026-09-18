import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { isAuthApiError } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { authLinkParams } from "@/utils/authLink";
import { strings } from "@/i18n/hu";

/**
 * The shortest password a form here accepts — the reset screen's rule, now
 * shared with sign-up, which used to let the API decide (six) and then print
 * the API's English sentence about it. Short enough to type twice, long
 * enough not to be the year of your birth.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * What to show when an auth call fails.
 *
 * The four auth screens used to print `e.message` — "Invalid login
 * credentials", "Password should be at least 6 characters." — in the accent
 * colour under a Hungarian form (T-054). The API attaches a stable `code` to
 * each failure; the handful a person can actually cause are translated here,
 * and everything else, including a network failure, is the generic line.
 */
export function authErrorMessage(e: unknown): string {
  const code = isAuthApiError(e) ? e.code : undefined;
  const known = code ? strings.auth.errors[code as keyof typeof strings.auth.errors] : undefined;
  return known ?? strings.auth.genericError;
}

/**
 * Creates the account, and says whether the person is actually signed in.
 *
 * Whether they are depends on a project setting rather than on this code. With
 * "Confirm email" on, `signUp` returns `session: null` and nobody is signed in
 * until they click the link in their inbox; with it off, a session comes back
 * immediately. This project has had it both ways — every account created before
 * 6 September 2026 has a `confirmation_sent_at`, and none since does — so the
 * caller cannot assume either.
 *
 * The old code assumed the second, closing the sign-up modal the moment this
 * resolved. That is right today and silently wrong the moment confirmation is
 * switched back on: it looks exactly like a successful sign-in, and leaves
 * somebody signed out with nothing on screen explaining why. Returning the flag
 * means the screen handles both without anybody having to remember the setting.
 */
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      // Where the link in the confirmation email lands. Same reasoning as the
      // reset link below: without it Supabase falls back to the project's Site
      // URL, which is one fixed origin and therefore wrong for whichever of
      // localhost and production is not it.
      emailRedirectTo: Linking.createURL("/"),
    },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

/**
 * Sends the confirmation mail again.
 *
 * The first one is sent by `signUp`, and the only thing a person can do when
 * it does not arrive is sign up again — which fails with `user_already_exists`
 * and sends nothing. The API rate-limits this per address (one a minute), and
 * `over_email_send_rate_limit` is already translated for the screen.
 *
 * Same `emailRedirectTo` as `signUp`, for the same reason: the link has to
 * land back on whichever origin asked for it.
 */
export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: Linking.createURL("/") },
  });
  if (error) throw error;
}

/**
 * Turns the URL an e-mailed link opened the app with into a session.
 *
 * On web the client does this itself: `detectSessionInUrl` reads the tokens
 * Supabase puts in the fragment of the redirect and signs the person in
 * before anything renders. On a device that option is off — there is no
 * `window.location` to read — and until this existed nothing took its place,
 * so a confirmation or password-reset link opened the app and then did
 * nothing at all (T-005). The app's own scheme is on the redirect allow list;
 * this is the half that consumes what arrives on it.
 *
 * Returns true when a session was set. A link with no tokens on it — the
 * app opened by a share, a deep link into a play — is not an error and does
 * nothing. A link whose tokens have expired arrives with `error_code` in
 * place of the tokens; that is not an error here either, because the
 * screens already say what an absent session means (`reset-password`), and
 * the person's next step is the same whatever the reason.
 */
export async function consumeAuthLink(url: string | null): Promise<boolean> {
  if (!url) return false;
  const params = authLinkParams(url);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return true;
  }
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  return false;
}

/**
 * Signs in, or up, with a Google account.
 *
 * The account is the same account: Supabase matches the provider's verified
 * address against existing users, so somebody who registered with a password
 * and later taps Google lands in their own diary rather than in a second one.
 * A brand-new address goes through `handle_new_user()` like any other sign-up,
 * with the display name read from what Google sent (0060) — and no
 * confirmation mail, because Google has already vouched for the address.
 *
 * Two shapes, one flow. On the web `signInWithOAuth` leaves the page for
 * Google and comes back to `redirectTo` with the session in the fragment,
 * which `detectSessionInUrl` reads before anything renders — so on web this
 * never resolves with a value worth reading; the tab is gone. On a device
 * the same call is asked *not* to open anything (`skipBrowserRedirect`) and
 * the URL it hands back is opened in the system's auth sheet instead — Safari
 * View Controller, a Custom Tab — which closes itself when Google redirects
 * to the app scheme, and the URL it closed on is consumed the way an e-mailed
 * link is. The redirect is `Linking.createURL("/")` for the reason every
 * other redirect here is: it is the current origin on web and the app scheme
 * on a device, and both are on the project's allow list.
 *
 * Returns false when the person closed the sheet without finishing. That is
 * a decision rather than a failure, and the screen shows nothing for it.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL("/");
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
    return false;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;
  return consumeAuthLink(result.url);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Sends the "set a new password" email.
 *
 * Until this existed an account that forgot its password was simply gone:
 * there was no reset screen, no magic link and no second sign-in method, so
 * the only recovery was a new account and an abandoned diary.
 *
 * `redirectTo` is built with `Linking.createURL` rather than hardcoded so the
 * same code works from a dev server, from the deployed site and from a native
 * build — it resolves to the current origin on web and to the
 * `szinhaztracker://` scheme on a device. Every origin it can produce has to
 * be on the project's redirect allow list in the Supabase dashboard, or the
 * link silently lands on the Site URL instead.
 *
 * It deliberately resolves the same way whether or not the address has an
 * account. Supabase answers identically by design, and the screen says "if
 * there is an account, we have written to it" for the same reason: a form that
 * distinguishes the two is a way to find out who has an account here.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Linking.createURL("/reset-password"),
  });
  if (error) throw error;
}

/**
 * Sets a new password for whoever the current session belongs to.
 *
 * On the reset path that session comes from the emailed link: the recovery URL
 * carries a token that `detectSessionInUrl` exchanges for a real, short-lived
 * session before this is ever called. So there is no separate "reset token"
 * parameter here — by the time the form can be submitted, the person is
 * signed in, and this is the same call the account settings would make.
 */
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback);
}
