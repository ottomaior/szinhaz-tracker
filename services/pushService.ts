import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/i18n/notificationCopy";

/**
 * This device's place in `push_subscriptions`, and the person's preferences.
 *
 * Two transports behind one surface (T-089). On the web it is the Push API:
 * the service worker at /sw.js, a subscription against the project's VAPID
 * public key, and the endpoint plus its two keys stored as a `web` row. On a
 * phone it is Expo's push service: the device asks for a token, the token is
 * stored as an `expo` row, and Expo carries messages on to APNs and FCM.
 * Either way the sender (`supabase/functions/send-push`) reads the row and
 * does not care which.
 *
 * The permission is never requested from here on load. `enablePush` is what
 * a button calls, after the app has said what will arrive — see
 * `components/ui/PushPrimer.tsx` for why the ask waits for a moment that
 * earns it.
 */
export type PushStatus = "unsupported" | "denied" | "off" | "on";

const NATIVE_TOKEN_KEY = "vastaps.push.expoToken";

/**
 * The public half of the VAPID pair, from `app.config.ts`'s `extra`.
 *
 * Read when asked rather than at import: on the web `expo-constants` resolves
 * the inlined manifest lazily, and a module-level read during bundle
 * evaluation came back empty on the dev server. `EXPO_PUBLIC_VAPID_PUBLIC_KEY`
 * is a second door for a build that wants to override it.
 */
function vapidPublicKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromEnv) return fromEnv;
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra?.expoClient?.extra) as
    | { vapidPublicKey?: string }
    | undefined;
  return extra?.vapidPublicKey;
}

if (Platform.OS !== "web") {
  // A notification that arrives while the app is open is still shown; the
  // inbox badge is not a substitute for the thing a person asked to be told.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function isPushSupported(): boolean {
  if (Platform.OS === "web") {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(vapidPublicKey())
    );
  }
  return Device.isDevice;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // Backed by a plain ArrayBuffer, which is what `subscribe` is typed to take.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function webRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  if (Platform.OS === "web") {
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission !== "granted") return "off";
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      return sub ? "on" : "off";
    } catch {
      return "off";
    }
  }
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status === "denied" && !perm.canAskAgain) return "denied";
  const token = await AsyncStorage.getItem(NATIVE_TOKEN_KEY);
  return perm.granted && token ? "on" : "off";
}

/**
 * Asks the OS, subscribes, and stores the row. Returns the status afterwards,
 * so a screen can show "on" or the reason it is not.
 */
export async function enablePush(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  if (Platform.OS === "web") {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return "denied";
    if (permission !== "granted") return "off";
    const reg = await webRegistration();
    await navigator.serviceWorker.ready;
    // A fresh subscription every time: an endpoint left over from another
    // account in the same browser belongs to that account's row, which this
    // one may not overwrite.
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()!),
    });
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      platform: "web",
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? null,
      auth: json.keys?.auth ?? null,
      user_agent: navigator.userAgent.slice(0, 200),
    });
    if (error) {
      await sub.unsubscribe();
      throw error;
    }
    return "on";
  }

  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? "off" : "denied";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Értesítések",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      platform: "expo",
      endpoint: token,
      user_agent: `${Device.manufacturer ?? ""} ${Device.modelName ?? ""} ${Platform.OS} ${Device.osVersion ?? ""}`.trim(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  await AsyncStorage.setItem(NATIVE_TOKEN_KEY, token);
  return "on";
}

/** Unsubscribes this device and removes its row. The OS permission stays. */
export async function disablePush(): Promise<void> {
  if (Platform.OS === "web") {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
    return;
  }
  const token = await AsyncStorage.getItem(NATIVE_TOKEN_KEY);
  if (token) await supabase.from("push_subscriptions").delete().eq("endpoint", token);
  await AsyncStorage.removeItem(NATIVE_TOKEN_KEY);
}

/** Which kinds this person wants. No row means all of them. */
export async function getNotificationPreferences(): Promise<NotificationKind[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [...NOTIFICATION_KINDS];
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("kinds")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return [...NOTIFICATION_KINDS];
  return (data.kinds as string[]).filter((k): k is NotificationKind =>
    (NOTIFICATION_KINDS as readonly string[]).includes(k)
  );
}

export async function setNotificationPreferences(kinds: NotificationKind[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, kinds, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
