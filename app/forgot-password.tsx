import { useState } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { authErrorMessage, requestPasswordReset } from "@/services/authService";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * Asking for a new password.
 *
 * Until this screen existed, forgetting a password ended the account: there is
 * no OAuth provider, no magic link and no second factor, so the only way back
 * in was a new address and an abandoned diary.
 *
 * The success state deliberately does not confirm whether the address has an
 * account — see the note on `requestPasswordReset`.
 */
export default function ForgotPasswordScreen() {
  const styles = useStyles();

  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    if (!email.trim()) {
      setError(strings.auth.emailRequired);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.forgotTitle} />

      <ContentColumn style={{ padding: gutter, gap: space.lg }}>
        {sent ? (
          <>
            <Text variant="heading">{strings.auth.forgotSentTitle}</Text>
            <Text variant="body" tone="dim">
              {strings.auth.forgotSentBody(email.trim())}
            </Text>
            <Text variant="bodySmall" tone="faint">
              {strings.auth.confirmEmailSpam}
            </Text>
            <Button
              label={strings.auth.signInButton}
              variant="outline"
              onPress={() => router.replace("/sign-in")}
            />
          </>
        ) : (
          <>
            <Text variant="body" tone="dim">
              {strings.auth.forgotBody}
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={strings.auth.emailLabel}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.auth.emailLabel}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
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
              label={strings.auth.forgotButton}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
            />
          </>
        )}
      </ContentColumn>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: space.lg,
    fontSize: inputFontSize,
    color: colors.text,
  },
}));
