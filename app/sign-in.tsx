import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
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
  const fontsLoaded = useAppFonts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
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
      <View style={styles.topBar}>
        <Pressable onPress={() => closeModal(router)} hitSlop={8}>
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
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={strings.auth.passwordLabel}
          placeholderTextColor={colors.textFaint}
          secureTextEntry
          style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
        />

        {error && <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.gold }}>{error}</Text>}

        <Button label={strings.auth.signInButton} onPress={handleSubmit} style={submitting ? { opacity: 0.6 } : undefined} />

        <Pressable onPress={() => router.replace("/sign-up")} style={{ alignItems: "center", marginTop: 8 }}>
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
