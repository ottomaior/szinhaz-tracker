import { useState } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { signIn } from "@/services/authService";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";

export default function SignInScreen() {
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      closeModal(router);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.auth.signInTitle} />

      <ContentColumn style={{ padding: gutter, gap: space.lg }}>

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
          autoComplete="current-password"
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

        {/* The button used to only dim while submitting, so a second tap fired
            a second sign-in request. */}
        <Button label={strings.auth.signInButton} onPress={handleSubmit} loading={submitting} disabled={submitting} />

        {/* Above the "create an account" line rather than below it: somebody
            who cannot get in is far likelier to have forgotten a password than
            to want a second account, and putting the recovery route under the
            signup route is how people end up with two diaries. */}
        <Pressable
          onPress={() => router.push("/forgot-password")}
          style={{ alignItems: "center" }}
          accessibilityRole="button"
        >
          <Text variant="bodySmall" style={{ color: colors.gold }}>
            {strings.auth.forgotPassword}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/sign-up")} style={{ alignItems: "center", marginTop: 8 }} accessibilityRole="button">
          <Text variant="bodySmall" tone="faint">
            {strings.auth.noAccount} <Text style={{ color: colors.gold }}>{strings.auth.switchToSignUp}</Text>
          </Text>
        </Pressable>
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
