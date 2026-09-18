import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { radius, space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * The Settings section that puts the app on the Home Screen (6.4).
 *
 * Rendered only when there is something to do: a browser that will show the
 * install prompt gets a button, iOS Safari gets the two-step instruction it
 * needs instead, and a page already running standalone gets nothing — a
 * section saying "already installed" is a trophy, not a setting. Native
 * never sees it.
 */
export function InstallCard() {
  const styles = useStyles();
  const install = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  if (install.kind === "none" || install.kind === "installed") return null;

  async function handleInstall() {
    if (install.kind !== "prompt" || busy) return;
    setBusy(true);
    try {
      await install.install();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={{ gap: space.xs }}>
        <Text variant="heading">{strings.settings.install}</Text>
      </View>
      <View style={styles.card}>
        <Text variant="bodySmall" tone="dim">
          {strings.settings.installHint}
        </Text>
        {install.kind === "prompt" ? (
          <Button
            label={strings.settings.installButton}
            variant="outline"
            onPress={handleInstall}
            loading={busy}
            disabled={busy}
          />
        ) : (
          <Text variant="bodySmall">{strings.settings.installIosHint}</Text>
        )}
      </View>
    </>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
}));
