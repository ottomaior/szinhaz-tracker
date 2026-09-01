import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { signIn } from "@/services/authService";
import { CloseIcon } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Pressable onPress={() => closeModal(router)} hitSlop={8} accessibilityRole="button" accessibilityLabel={strings.common.close}>
          <CloseIcon />
        </Pressable>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14.5, color: colors.text }}>{strings.auth.signInTitle}</Text>
        <View style={{ width: 18 }} />
      </View>

      <View style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 22, color: colors.text }}>{strings.auth.signInTitle}</Text>

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
          <Text accessibilityRole="alert" style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.gold }}>
            {error}
          </Text>
        )}

        {/* The button used to only dim while submitting, so a second tap fired
            a second sign-in request. */}
        <Button label={strings.auth.signInButton} onPress={handleSubmit} loading={submitting} disabled={submitting} />

        <Pressable onPress={() => router.replace("/sign-up")} style={{ alignItems: "center", marginTop: 8 }} accessibilityRole="button">
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
            {strings.auth.noAccount} <Text style={{ color: colors.gold }}>{strings.auth.switchToSignUp}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: colors.text,
  },
});
