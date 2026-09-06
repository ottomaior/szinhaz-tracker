import * as Linking from "expo-linking";
import { supabase } from "@/services/supabase";

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
