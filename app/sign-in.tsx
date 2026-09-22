import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { isAuthApiError } from "@supabase/supabase-js";
import { colors } from "@/theme/colors";
import { gutter, maxWidth, space } from "@/theme/tokens";
import { authErrorMessage, resendConfirmation, signIn } from "@/services/authService";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { SocialSignIn } from "@/components/ui/SocialSignIn";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";
import { makeStyles } from "@/theme/styles";

export default function SignInScreen() {
  const styles = useStyles();

  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  /**
   * Set when the sign-in failed because the address was never confirmed —
   * the one failure a person cannot fix by typing more carefully. It puts a
   * resend link under the error, since the alternative is signing up again,
   * which fails with "already exists" and sends nothing.
   */
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    if (!email.trim()) {
      setError(strings.auth.emailRequired);
      return;
    }
    if (!password) {
      setError(strings.auth.passwordRequired);
      return;
    }
    setError(undefined);
    setUnconfirmed(false);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      closeModal(router);
    } catch (e) {
      setError(authErrorMessage(e));
      setUnconfirmed(isAuthApiError(e) && e.code === "email_not_confirmed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      await resendConfirmation(email.trim());
      setError(strings.auth.resentConfirmation);
      setUnconfirmed(false);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.signInTitle} />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn width="reading" style={styles.form}>
        <SocialSignIn onSignedIn={() => closeModal(router)} onError={setError} />

        <TextField
          value={email}
          onChangeText={setEmail}
          placeholder={strings.auth.emailLabel}
          accessibilityLabel={strings.auth.emailLabel}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          value={password}
          onChangeText={setPassword}
          placeholder={strings.auth.passwordLabel}
          accessibilityLabel={strings.auth.passwordLabel}
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {error && <Notice>{error}</Notice>}
        {unconfirmed && (
          <Button
            variant="text"
            size="sm"
            label={strings.auth.resendConfirmation}
            onPress={handleResend}
            disabled={resending}
            style={styles.link}
          />
        )}

        {/* The button used to only dim while submitting, so a second tap fired
            a second sign-in request. */}
        <Button label={strings.auth.signInButton} onPress={handleSubmit} loading={submitting} disabled={submitting} />

        {/* Above the "create an account" line rather than below it: somebody
            who cannot get in is far likelier to have forgotten a password than
            to want a second account, and putting the recovery route under the
            signup route is how people end up with two diaries. */}
        <Button
          variant="text"
          size="sm"
          label={strings.auth.forgotPassword}
          onPress={() => router.push("/forgot-password")}
          style={styles.link}
        />

        <Text variant="bodySmall" tone="faint" style={styles.switch}>
          {strings.auth.noAccount}{" "}
          <Text variant="bodySmall" tone="accent" accessibilityRole="link" onPress={() => router.replace("/sign-up")}>
            {strings.auth.switchToSignUp}
          </Text>
        </Text>
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
