import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, maxWidth, space } from "@/theme/tokens";
import { PASSWORD_MIN_LENGTH, authErrorMessage, resendConfirmation, signUp } from "@/services/authService";
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

export default function SignUpScreen() {
  const styles = useStyles();

  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  /**
   * Set when the account exists but nobody is signed in yet.
   *
   * Only reachable while the project requires e-mail confirmation, which it
   * does not at the time of writing — so this branch is dormant rather than
   * dead. It exists because the alternative is a screen that closes itself and
   * looks exactly like a successful sign-in the day the setting is turned back
   * on, leaving people signed out with no idea an e-mail is waiting for them.
   */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  /** What the resend link said last: nothing, "sent again", or an error. */
  const [resendNote, setResendNote] = useState<string>();
  const [resending, setResending] = useState(false);

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      await resendConfirmation(email.trim());
      setResendNote(strings.auth.resentConfirmation);
    } catch (e) {
      setResendNote(authErrorMessage(e));
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!name.trim()) {
      setError(strings.auth.nameRequired);
      return;
    }
    if (!email.trim()) {
      setError(strings.auth.emailRequired);
      return;
    }
    if (!password) {
      setError(strings.auth.passwordRequired);
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(strings.auth.resetTooShort);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password, name.trim());
      if (needsEmailConfirmation) {
        setAwaitingConfirmation(true);
      } else {
        closeModal(router);
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.signUpTitle} />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn width="reading" style={styles.form}>
        {awaitingConfirmation ? (
          <>
            <Text variant="heading">{strings.auth.confirmEmailTitle}</Text>
            <Text variant="body" tone="dim">
              {strings.auth.confirmEmailBody(email.trim())}
            </Text>
            <Text variant="bodySmall" tone="faint">
              {strings.auth.confirmEmailSpam}
            </Text>
            {resendNote && <Notice>{resendNote}</Notice>}
            <Button
              label={strings.auth.resendConfirmation}
              variant="outline"
              onPress={handleResend}
              loading={resending}
              disabled={resending}
            />
            <Button
              label={strings.auth.signInButton}
              variant="outline"
              onPress={() => router.replace("/sign-in")}
            />
          </>
        ) : (
          <>
        <SocialSignIn onSignedIn={() => closeModal(router)} onError={setError} />

        <TextField
          value={name}
          onChangeText={setName}
          placeholder={strings.auth.nameLabel}
          accessibilityLabel={strings.auth.nameLabel}
          autoComplete="name"
        />
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
          autoComplete="new-password"
          secureTextEntry
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {error && <Notice>{error}</Notice>}

        <Button label={strings.auth.signUpButton} onPress={handleSubmit} loading={submitting} disabled={submitting} />

        {/* The moment the terms are accepted and the privacy notice given —
            both documents existed under /legal and this screen never
            mentioned them (T-058). Two links in a caption, the way every
            sign-up form does it; pressing the button is the acceptance. */}
        <Text variant="caption" tone="faint" style={styles.switch}>
          {strings.auth.legalNoticeBefore}
          <Text variant="caption" tone="accent" onPress={() => router.push("/legal/feltetelek")} accessibilityRole="link">
            {strings.auth.legalNoticeTerms}
          </Text>
          {strings.auth.legalNoticeBetween}
          <Text variant="caption" tone="accent" onPress={() => router.push("/legal/adatvedelem")} accessibilityRole="link">
            {strings.auth.legalNoticePrivacy}
          </Text>
          {strings.auth.legalNoticeAfter}
        </Text>

        <Text variant="bodySmall" tone="faint" style={styles.switch}>
          {strings.auth.haveAccount}{" "}
          <Text variant="bodySmall" tone="accent" accessibilityRole="link" onPress={() => router.replace("/sign-in")}>
            {strings.auth.switchToSignIn}
          </Text>
        </Text>
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
