import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  disablePush,
  enablePush,
  getDigestEnabled,
  getNotificationPreferences,
  getPushStatus,
  setDigestEnabled,
  setNotificationPreferences,
  type PushStatus,
} from "@/services/pushService";
import {
  NOTIFICATION_KINDS_IN_SETTINGS_ORDER,
  notificationKindLabels,
  type NotificationKind,
} from "@/i18n/notificationCopy";
import { space } from "@/theme/tokens";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/utils/haptics";
import { strings } from "@/i18n/hu";

/**
 * The notifications block in Settings (T-089).
 *
 * Two questions, in this order. Does *this device* hear: a switch that is
 * the OS permission plus a `push_subscriptions` row, and says plainly when a
 * browser cannot do it or has said no. And *what* to hear about: six toggles
 * that apply to the person, on every device, and are written the first time
 * one is turned off.
 */
export function NotificationsSection() {
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus>();
  const [kinds, setKinds] = useState<Set<NotificationKind>>();
  const [digest, setDigest] = useState<boolean>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Two independent reads, each with its own failure: a preference row
    // that will not load must not make the device look incapable.
    getPushStatus()
      .then((found) => {
        if (!cancelled) setStatus(found);
      })
      .catch(() => {
        if (!cancelled) setStatus("off");
      });
    getNotificationPreferences()
      .then((prefs) => {
        if (!cancelled) setKinds(new Set(prefs));
      })
      .catch(() => undefined);
    getDigestEnabled()
      .then((on) => {
        if (!cancelled) setDigest(on);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleDevice() {
    if (busy || !status) return;
    setBusy(true);
    try {
      if (status === "on") {
        await disablePush();
        setStatus("off");
      } else {
        const next = await enablePush();
        setStatus(next);
        if (next === "on") haptic("success");
      }
    } catch {
      toast.show({ message: strings.settings.notificationsError });
    } finally {
      setBusy(false);
    }
  }

  async function toggleDigest(on: boolean) {
    const before = digest;
    setDigest(on);
    try {
      await setDigestEnabled(on);
    } catch {
      setDigest(before);
      toast.show({ message: strings.common.loadError });
    }
  }

  async function toggleKind(kind: NotificationKind, on: boolean) {
    if (!kinds) return;
    const before = new Set(kinds);
    const next = new Set(kinds);
    if (on) next.add(kind);
    else next.delete(kind);
    setKinds(next);
    try {
      await setNotificationPreferences(NOTIFICATION_KINDS_IN_SETTINGS_ORDER.filter((k) => next.has(k)));
    } catch {
      setKinds(before);
      toast.show({ message: strings.common.loadError });
    }
  }

  const deviceLine =
    status === "unsupported"
      ? strings.settings.notificationsUnsupported
      : status === "denied"
        ? strings.settings.notificationsDenied
        : status === "on"
          ? strings.settings.notificationsEnabled
          : strings.settings.notificationsHint;

  return (
    <>
      <View style={{ gap: space.xs }}>
        <Text variant="heading">{strings.settings.notifications}</Text>
        <Text variant="caption" tone="faint">
          {deviceLine}
        </Text>
      </View>

      {status === "off" && (
        <Button
          label={strings.settings.notificationsEnable}
          variant="outline"
          onPress={toggleDevice}
          loading={busy}
          disabled={busy}
        />
      )}
      {status === "on" && (
        <Button label={strings.settings.notificationsDisable} variant="text" onPress={toggleDevice} disabled={busy} />
      )}

      {/* The weekly letter is the one channel that reaches every account,
          whatever the device, so it sits above the per-kind list rather
          than among it (T-090). */}
      {digest !== undefined && (
        <ToggleRow
          label={strings.settings.digest}
          blurb={strings.settings.digestHint}
          on={digest}
          onChange={toggleDigest}
        />
      )}

      {kinds && (
        <View style={{ gap: space.sm }}>
          <Text variant="eyebrow" tone="faint">
            {strings.settings.notificationsKinds}
          </Text>
          {NOTIFICATION_KINDS_IN_SETTINGS_ORDER.map((kind) => (
            <ToggleRow
              key={kind}
              label={notificationKindLabels[kind].label}
              blurb={notificationKindLabels[kind].hint}
              on={kinds.has(kind)}
              onChange={(on) => toggleKind(kind, on)}
            />
          ))}
        </View>
      )}
    </>
  );
}
