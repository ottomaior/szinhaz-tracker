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
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/utils/haptics";
import { strings } from "@/i18n/hu";

/**
 * The notifications block in Settings (T-089).
 *
 * Two questions, in this order. Does *this device* hear: a switch that is
 * the OS permission plus a `push_subscriptions` row, and says plainly when a
 * browser cannot do it or has said no. And *what* to hear about: eight
 * toggles that apply to the person, on every device, and are written the
 * first time one is turned off.
 *
 * Both lists are one card apiece rather than a card per row (T-117), and
 * most of the toggles are a label alone: the sentence that used to sit under
 * each one only said the label again. `notificationKindLabels` keeps the two
 * hints that still tell the reader something.
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
    } catch (e) {
      const unavailable = (e as { code?: string } | null)?.code === "push_unavailable";
      toast.show({ message: unavailable ? strings.settings.notificationsUnavailable : strings.settings.notificationsError });
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
        <SettingsGroup>
          <ToggleRow
            bare
            label={strings.settings.digest}
            blurb={strings.settings.digestHint}
            on={digest}
            onChange={toggleDigest}
          />
        </SettingsGroup>
      )}

      {kinds && (
        <View style={{ gap: space.sm }}>
          {/* The heading names the phone, and the line under it says what
              switching one off does not do (T-118): these toggles are read
              only by `send-push`, so the inbox keeps the row either way. */}
          <View style={{ gap: space["2xs"] }}>
            <Text variant="eyebrow" tone="faint">
              {strings.settings.notificationsKinds}
            </Text>
            <Text variant="caption" tone="faint">
              {strings.settings.notificationsKindsHint}
            </Text>
          </View>
          <SettingsGroup>
            {NOTIFICATION_KINDS_IN_SETTINGS_ORDER.map((kind) => (
              <ToggleRow
                bare
                key={kind}
                label={notificationKindLabels[kind].label}
                blurb={notificationKindLabels[kind].hint}
                on={kinds.has(kind)}
                onChange={(on) => toggleKind(kind, on)}
              />
            ))}
          </SettingsGroup>
        </View>
      )}
    </>
  );
}
