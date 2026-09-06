import { useState } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { updatePassword } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";

/** Short enough to type twice, long enough not to be the year of your birth. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Where the emailed reset link lands.
 *
 * There is no token to read here. The recovery URL carries one, and the
 * Supabase client exchanges it for a real, short-lived session before this
 * screen renders — `detectSessionInUrl` is on for web in `services/supabase.ts`
 * — so by the time somebody can type, they are signed in and this is an
 * ordinary password change.
 *
 * That is also what makes the failure case legible. No session means the link
 * expired, was already used, or was opened on a device that never asked for
 * it. Those look identical from here and have the same answer, so they get one
 * message rather than three guesses.
 *
 * The screen waits for `loading` before deciding. Reading `session` while the
 * client is still parsing the URL would show "this link is not valid" to
 * everybody for a frame, which is the one message on this screen nobody should
 * see by accident.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session, loading } = useAuth();

  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (saving) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(strings.auth.resetTooShort);
      return;
    }
    if (password !== again) {
      setError(strings.auth.resetMismatch);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.auth.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.resetTitle} />

      <ContentColumn style={{ padding: gutter, gap: space.lg }}>
        {loading ? null : !session ? (
          <>
            <Text variant="heading">{strings.auth.resetNoLinkTitle}</Text>
            <Text variant="body" tone="dim">
              {strings.auth.resetNoLinkBody}
            </Text>
            <Button
              label={strings.auth.forgotButton}
              onPress={() => router.replace("/forgot-password")}
            />
          </>
        ) : done ? (
          <>
            <Text variant="body" tone="dim">
              {strings.auth.resetDone}
            </Text>
            <Button label={strings.common.close} onPress={() => router.replace("/(tabs)")} />
          </>
        ) : (
          <>
            <Text variant="body" tone="dim">
              {strings.auth.resetBody}
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={strings.auth.newPasswordLabel}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.auth.newPasswordLabel}
              autoCapitalize="none"
              // `new-password` rather than `password`, so a password manager
              // offers to generate and store one instead of filling in the old
              // one the person is here to replace.
              autoComplete="new-password"
              secureTextEntry
              style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
            />
            <TextInput
              value={again}
              onChangeText={setAgain}
              placeholder={strings.auth.newPasswordAgainLabel}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.auth.newPasswordAgainLabel}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
            />

            {!!error && (
              <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                {error}
              </Text>
            )}

            <Button
              label={saving ? strings.auth.resetSaving : strings.auth.resetButton}
              onPress={handleSubmit}
              loading={saving}
              disabled={saving}
            />
          </>
        )}
      </ContentColumn>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: space.lg,
    fontSize: inputFontSize,
    color: colors.text,
  },
});
