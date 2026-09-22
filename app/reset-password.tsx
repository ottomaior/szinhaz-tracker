import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, maxWidth, space } from "@/theme/tokens";
import { PASSWORD_MIN_LENGTH, authErrorMessage, updatePassword } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

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
  const styles = useStyles();

  const router = useRouter();
  const { session, loading } = useAuth();

  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (saving) return;
    if (password.length < PASSWORD_MIN_LENGTH) {
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
      setError(authErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.resetTitle} />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn width="reading" style={styles.form}>
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

            <TextField
              value={password}
              onChangeText={setPassword}
              placeholder={strings.auth.newPasswordLabel}
              accessibilityLabel={strings.auth.newPasswordLabel}
              autoCapitalize="none"
              // `new-password` rather than `password`, so a password manager
              // offers to generate and store one instead of filling in the old
              // one the person is here to replace.
              autoComplete="new-password"
              secureTextEntry
            />
            <TextField
              value={again}
              onChangeText={setAgain}
              placeholder={strings.auth.newPasswordAgainLabel}
              accessibilityLabel={strings.auth.newPasswordAgainLabel}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {!!error && <Notice>{error}</Notice>}

            <Button
              label={saving ? strings.auth.resetSaving : strings.auth.resetButton}
              onPress={handleSubmit}
              loading={saving}
              disabled={saving}
            />
          </>
        )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  // Narrower than a reading column: a row of form fields 680pt wide reads
  // as a table, and every field here holds one short answer.
  form: { padding: gutter, gap: space.lg, maxWidth: maxWidth.reading / 2, alignSelf: "center", width: "100%" },
  link: { alignSelf: "center" },
  switch: { textAlign: "center" },
}));
