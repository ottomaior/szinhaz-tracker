import { useCallback, useState } from "react";
import { View, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { gutter, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotifications,
  markAllRead,
  type AppNotification,
} from "@/services/notificationService";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatShortDayForSuffix, formatTime } from "@/utils/datetime";
import { useColors } from "@/theme/styles";
import { notificationLine } from "@/i18n/notificationCopy";
import { isPersonKind } from "@/i18n/notificationCopy";
import type { Play } from "@/data/types";
import { PersonRow } from "@/components/ui/Rows";
import { PlayRow } from "@/components/ui/PlayRow";
import { CountBadge } from "@/components/ui/Badges";
import { RowSkeleton } from "@/components/ui/Skeleton";
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={strings.inbox.headerTitle} fallbackRoute="/(tabs)" />
        <ContentColumn style={{ padding: gutter }}>
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </ContentColumn>
      </View>
    );
  }

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
  // A dot rather than an "unread" label: the row is already a sentence, and
  // the state is worth one glyph, not a second line of text.
  const unread = !notification.readAt ? <CountBadge /> : undefined;
  const meta = (
    <Text variant="bodySmall" tone="dim" numberOfLines={2}>
      {describe(notification)}
    </Text>
  );

  // About a person or about a production, and the row follows: a face and
  // two lines, or a poster and two lines.
  return isPersonKind(notification.kind) ? (
    <PersonRow
      name={notification.playTitle}
      meta={meta}
      initials={personInitials(notification.playTitle)}
      onPress={onPress}
      trailing={unread}
    />
  ) : (
    <PlayRow
      play={{
        id: notification.playId ?? notification.id,
        title: notification.playTitle,
        poster: notification.poster,
      } as Play}
      onPress={onPress}
      meta={meta}
      trailing={unread}
    />
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


