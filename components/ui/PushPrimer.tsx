import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { enablePush, getPushStatus, type PushStatus } from "@/services/pushService";
import { radius, space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/utils/haptics";
import { strings } from "@/i18n/hu";

/**
 * The ask, at a moment that earns it (T-089).
 *
 * An OS permission dialog on launch is refused by most people and can never
 * be shown again. So the app asks in its own words first — what will arrive,
 * and that it is only what was asked for — on the two screens where the
 * reader has just done the thing the notification is about: the end of the
 * first run, and the watchlist once it holds something. Only the button
 * opens the OS dialog. "Most nem" is remembered on this device and the card
 * does not come back; Settings keeps the switch for later.
 *
 * Renders nothing unless there is a signed-in person, a device that can be
 * notified, and no subscription yet. That is most of the time, which is the
 * point: a card that is usually absent is one that means something when it
 * is there.
 */
const DISMISSED_KEY = "vastaps.pushPrimer.dismissed";

export function PushPrimer() {
  const styles = useStyles();
  const { session } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus>();
  const [dismissed, setDismissed] = useState<boolean>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([getPushStatus(), AsyncStorage.getItem(DISMISSED_KEY)])
      .then(([found, flag]) => {
        if (cancelled) return;
        setStatus(found);
        setDismissed(flag === "1");
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session || status !== "off" || dismissed !== false) return null;

  async function accept() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await enablePush();
      setStatus(next);
      if (next === "on") {
        haptic("success");
        toast.show({ message: strings.pushPrimer.done });
      } else if (next === "denied") {
        toast.show({ message: strings.settings.notificationsDenied });
      }
    } catch (e) {
      const unavailable = (e as { code?: string } | null)?.code === "push_unavailable";
      toast.show({ message: unavailable ? strings.settings.notificationsUnavailable : strings.settings.notificationsError });
    } finally {
      setBusy(false);
    }
  }

  async function later() {
    setDismissed(true);
    await AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => undefined);
  }

  return (
    <View style={styles.card}>
      <Text variant="eyebrow">{strings.pushPrimer.eyebrow}</Text>
      <Text variant="heading">{strings.pushPrimer.title}</Text>
      <Text variant="bodySmall" tone="dim">
        {strings.pushPrimer.body}
      </Text>
      <View style={styles.actions}>
        <Button label={strings.pushPrimer.accept} variant="outline" onPress={accept} loading={busy} disabled={busy} />
        <Button label={strings.pushPrimer.later} variant="text" onPress={later} disabled={busy} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldTintBg,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs, flexWrap: "wrap" },
}));
