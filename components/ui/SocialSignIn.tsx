import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { GoogleMark } from "@/components/icons/GoogleMark";
import { authErrorMessage, signInWithGoogle } from "@/services/authService";
import { strings } from "@/i18n/hu";

/**
 * The provider button and the "or with e-mail" rule under it, shared by the
 * sign-in and sign-up modals so the two cannot drift.
 *
 * It sits *above* the form rather than under it. Most people who arrive at a
 * sign-in screen on a phone have a Google account on the device already, and
 * for them the form is the slow path; putting the fast path first is most of
 * what makes a sign-in feel finished. One provider today. Sign in with Apple
 * joins it the week there is an Apple Developer account to register it under —
 * and it has to, on iOS, the moment Google is offered there (App Review 4.8).
 *
 * The button is `outline`, not `primary`: the gold control on these screens
 * is the form's own submit, and the rule is one filled gold thing per screen.
 */
export function SocialSignIn({
  onSignedIn,
  onError,
}: {
  /** Called once a session exists — on a device. On web the page navigates away instead. */
  onSignedIn: () => void;
  /** Receives the translated error line, or `undefined` to clear it. */
  onError: (message: string | undefined) => void;
}) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    if (busy) return;
    onError(undefined);
    setBusy(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) onSignedIn();
    } catch (e) {
      onError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <Button
        label={strings.auth.continueWithGoogle}
        variant="outline"
        icon={<GoogleMark size={18} />}
        onPress={handleGoogle}
        loading={busy}
        disabled={busy}
      />
      <View style={styles.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.hairline} />
        <Text variant="caption" tone="faint">
          {strings.auth.orWithEmail}
        </Text>
        <View style={styles.hairline} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  hairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
}));
