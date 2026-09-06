import { useState } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { signUp } from "@/services/authService";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";

export default function SignUpScreen() {
  const router = useRouter();
  const fontsLoaded = useAppFonts();
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
      setError(e instanceof Error ? e.message : strings.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.signUpTitle} />

      <ContentColumn style={{ padding: gutter, gap: space.lg }}>
        {awaitingConfirmation ? (
          <>
            <Text variant="heading">{strings.auth.confirmEmailTitle}</Text>
            <Text variant="body" tone="dim">
              {strings.auth.confirmEmailBody(email.trim())}
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
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={strings.auth.nameLabel}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={strings.auth.nameLabel}
          autoComplete="name"
          style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={strings.auth.emailLabel}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={strings.auth.emailLabel}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={strings.auth.passwordLabel}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={strings.auth.passwordLabel}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
          style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
        />

        {error && (
          <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
            {error}
          </Text>
        )}

        <Button label={strings.auth.signUpButton} onPress={handleSubmit} loading={submitting} disabled={submitting} />

        <Pressable onPress={() => router.replace("/sign-in")} style={{ alignItems: "center", marginTop: 8 }} accessibilityRole="button">
          <Text variant="bodySmall" tone="faint">
            {strings.auth.haveAccount} <Text style={{ color: colors.gold }}>{strings.auth.switchToSignIn}</Text>
          </Text>
        </Pressable>
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
