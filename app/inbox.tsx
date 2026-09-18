import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { gutter, radius, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotifications,
  markAllRead,
  type AppNotification,
} from "@/services/notificationService";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatShortDayForSuffix, formatTime } from "@/utils/datetime";
import { makeStyles, useColors } from "@/theme/styles";
import { notificationLine } from "@/i18n/notificationCopy";
import { isPersonKind } from "@/i18n/notificationCopy";
import { Avatar } from "@/components/ui/Avatar";
import { personInitials } from "@/utils/people";

/**
 * What the sync learned that you were waiting to hear.
 *
 * An in-app inbox rather than push, which is the whole reason this shipped
 * without any device-token infrastructure: 0030 writes rows, this reads them,
 * and email can sit on the same rows later without changing either.
 *
 * Everything is marked read on open. Opening the screen *is* reading them, and
 * a per-row "mark as read" control would be housekeeping the app asks the user
 * to do on its behalf.
 */
export default function InboxScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const rows = await getNotifications();
      setItems(rows);
      // After the rows are in hand, so a failure to mark them read cannot cost
      // the user the list itself. The badge clears on the next focus either way.
      if (rows.some((n) => !n.readAt)) await markAllRead().catch(() => undefined);
    } catch {
      setFailed(true);
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setItems([]);
        setLoaded(true);
        return;
      }
      load();
    }, [session, load])
  );

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.inbox.headerTitle} fallbackRoute="/(tabs)" />

      <ScrollView contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.md }}>
          {!session && (
            <EmptyState
              title={strings.inbox.signInPrompt}
              actionLabel={strings.profile.signInButton}
              onAction={() => router.push("/sign-in")}
            />
          )}

          {!!session &&
            items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                // A like or a comment is about your evening, so it opens the
                // evening — the production page would be the wrong end of it,
                // and the thread the notice is announcing is not on it.
                onPress={() => {
                  // A follow request or acceptance is about a person, and the
                  // request is answered on your own follower list.
                  if (isPersonKind(n.kind)) {
                    if (n.kind === "follow_requested") router.push({ pathname: "/followers", params: { tab: "requests" } });
                    else if (n.payload.userId) router.push(`/user/${n.payload.userId}`);
                    return;
                  }
                  if (n.reviewId) router.push({ pathname: "/entry/[id]", params: { id: n.reviewId } });
                  else if (n.playId) router.push(`/play/${n.playId}`);
                }}
              />
            ))}

          {!!session && loaded && items.length === 0 && (
            <EmptyState
              title={failed ? strings.common.loadError : strings.inbox.empty}
              body={failed ? undefined : strings.inbox.emptyBody}
              actionLabel={failed ? strings.common.retry : strings.watchlist.emptyAction}
              onAction={failed ? load : () => router.push("/(tabs)/discover")}
            />
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !notification.readAt && styles.unread]}
      accessibilityRole="button"
      accessibilityLabel={notification.playTitle}
    >
      {isPersonKind(notification.kind) ? (
        <View style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
          <Avatar initials={personInitials(notification.playTitle)} size={44} />
        </View>
      ) : (
        <PosterPlaceholder
          poster={notification.poster}
          title={notification.playTitle}
          seed={notification.playId ?? notification.id}
          width={44}
          height={66}
          radius={radius.sm}
          preferThumb
        />
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label" numberOfLines={2}>{notification.playTitle}</Text>
        <Text variant="bodySmall" tone="dim" numberOfLines={2}>
          {describe(notification)}
        </Text>
      </View>
      {/* A dot rather than an "unread" label: the row is already a sentence,
          and the state is worth one glyph, not a second line of text. */}
      {!notification.readAt && <View style={styles.dot} />}
    </Pressable>
  );
}

/**
 * The one line each kind is worth.
 *
 * Kept here rather than in the database for the reason 0030's `payload` column
 * gives: a notifications table full of rendered Hungarian would be a second
 * place where the app's voice lives, and the one nobody thinks to edit.
 */
function describe(n: AppNotification): string {
  // The same renderer the push sender uses (i18n/notificationCopy.ts); this
  // screen only formats the two dates first.
  return notificationLine(n.kind, {
    // The suffix-safe form: the copy glues "-ig" onto this, and "okt. 28."
    // plus "-ig" is not how Hungarian writes it.
    throughLabel: n.payload.through ? formatShortDayForSuffix(n.payload.through) : undefined,
    count: n.payload.count,
    timeLabel: n.payload.startsAt ? formatTime(n.payload.startsAt) : undefined,
    room: n.payload.room,
    venue: n.payload.venue,
    person: n.payload.person,
  });
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  unread: { borderWidth: 1, borderColor: colors.hairline },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
}));
