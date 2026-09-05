import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { getFeed, getPlayById, getUserById, getVenueById, type FeedScope } from "@/services/playsService";
import type { FeedItem, Play, User, Venue, Review, WatchlistEntry } from "@/data/types";
import { useAuth } from "@/contexts/AuthContext";
import { Chip } from "@/components/ui/Chip";
import { MaskIcon, MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { budapestDayKey, formatLongDate } from "@/utils/datetime";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();
  const [scope, setScope] = useState<FeedScope>("everyone");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems(await getFeed(scope));
    } catch {
      // A network/RLS failure used to reject silently, leaving a blank screen
      // that was indistinguishable from an empty feed.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen width="reading">
        <View style={[styles.topBar, { paddingTop: insets.top + space.md }]}>
          <View style={styles.brand}>
            <MaskIcon state="on" size={22} />
            <Text variant="heading">{strings.appName}</Text>
          </View>
          <Pressable onPress={() => router.push("/people")} hitSlop={8} accessibilityRole="button">
            <Text variant="label" tone="accent">{strings.feed.findPeople}</Text>
          </Pressable>
        </View>

        {/* Only offered when signed in: "Követettek" for a signed-out visitor
            could only ever be empty, and the scope is per account anyway. */}
        {!!session && (
          <View style={styles.scopeRow}>
            <Chip
              label={strings.feed.scopeEveryone}
              active={scope === "everyone"}
              onPress={() => setScope("everyone")}
            />
            <Chip
              label={strings.feed.scopeFollowing}
              active={scope === "following"}
              onPress={() => setScope("following")}
            />
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        >
          {items.map((item) => (
            <FeedCardRouter key={feedItemKey(item)} item={item} onOpenPlay={(id) => router.push(`/play/${id}`)} />
          ))}

          {/* An empty "Követettek" feed means "follow someone", not "nobody has
              used the app yet", and pointing it at Discover would be advice for
              the wrong problem. */}
          {!loading && items.length === 0 && !failed && scope === "following" && (
            <EmptyState
              title={strings.feed.followingEmptyTitle}
              body={strings.feed.followingEmptyBody}
              actionLabel={strings.feed.followingEmptyAction}
              onAction={() => router.push("/people")}
            />
          )}

          {!loading && items.length === 0 && (failed || scope === "everyone") && (
            <EmptyState
              title={failed ? strings.common.loadError : strings.feed.emptyTitle}
              body={failed ? undefined : strings.feed.emptyBody}
              actionLabel={failed ? strings.common.retry : strings.feed.emptyAction}
              onAction={failed ? load : () => router.push("/(tabs)/discover")}
            />
          )}
        </ScrollView>
      </Screen>
    </View>
  );
}

/**
 * Stable identity for a feed row. This used to be the array index, so any
 * refresh that reordered the feed re-mounted every card below the change and
 * threw away its already-loaded play/user data.
 */
function feedItemKey(item: FeedItem) {
  return item.kind === "checkin" ? `review:${item.review.id}` : `watchlist:${item.entry.playId}:${item.entry.addedByUserId}`;
}

function FeedCardRouter({ item, onOpenPlay }: { item: FeedItem; onOpenPlay: (id: string) => void }) {
  if (item.kind === "checkin") return <CheckinCard review={item.review} onOpenPlay={onOpenPlay} />;
  return <WatchlistCard entry={item.entry} onOpenPlay={onOpenPlay} />;
}

/**
 * The "who did what, when" line every feed card opens with.
 *
 * The byline is the natural way to get from "this person keeps seeing things I
 * like" to following them, so the whole avatar-and-name block opens their
 * profile.
 */
function CardByline({ user, action, meta }: { user: User; action: string; meta: string }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.byline}
      onPress={() => router.push(`/user/${user.id}`)}
      accessibilityRole="button"
      accessibilityLabel={user.name}
    >
      <Avatar initials={user.initials} size={36} />
      <View style={{ flexShrink: 1 }}>
        <Text variant="bodySmall">
          <Text variant="bodySmall" style={styles.name}>
            {user.name}
          </Text>{" "}
          <Text variant="bodySmall" tone="faint">
            {action}
          </Text>
        </Text>
        <Text variant="caption" tone="faint">
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

function CheckinCard({ review, onOpenPlay }: { review: Review; onOpenPlay: (id: string) => void }) {
  const [play, setPlay] = useState<Play>();
  const [user, setUser] = useState<User>();
  const [venue, setVenue] = useState<Venue>();

  useEffect(() => {
    getPlayById(review.playId)
      .then((p) => {
        setPlay(p);
        if (p) getVenueById(p.venueId).then(setVenue).catch(() => setVenue(undefined));
      })
      .catch(() => setPlay(undefined));
    getUserById(review.userId)
      .then(setUser)
      .catch(() => setUser(undefined));
  }, [review]);

  if (!play || !user) return null;

  return (
    <View style={{ gap: space.md }}>
      {/* Two different times, and the card needs both when they disagree. The
          feed is a record of activity, so the byline leads with how long ago
          this was posted; but somebody catching up on a production they saw
          last spring is posting today about an evening in March, and without
          the second half the card would quietly claim they had just been. */}
      <CardByline
        user={user}
        action={strings.feed.checkedIn}
        meta={[
          timeAgo(review.createdAt),
          review.seenAt !== budapestDayKey(review.createdAt)
            ? strings.feed.seenOn(formatLongDate(`${review.seenAt}T12:00:00Z`))
            : undefined,
          venue?.name,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <Pressable onPress={() => onOpenPlay(play.id)} accessibilityRole="button" accessibilityLabel={play.title}>
        {/* `scrim` matters here: these are production photos, and bright ones
            left the white caption below completely unreadable. */}
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height={200} radius={radius.md} scrim priority="high" />
        <View style={styles.posterCaption}>
          <Text variant="title" numberOfLines={2}>
            {play.title}
          </Text>
          {!!play.director && (
            <Text variant="bodySmall" tone="dim" numberOfLines={1}>
              rend. {play.director}
            </Text>
          )}
        </View>
      </Pressable>

      {/* The heart and speech-bubble counters that used to sit opposite the
          rating are gone. `reviews.like_count` and `comment_count` are real
          columns and no code path has ever incremented either, so both drew a
          permanent zero beside an icon that did nothing when tapped — which
          teaches a first-time visitor that the app is a mockup. They come back
          when liking and commenting exist. */}
      <MaskRatingRow rating={review.ratingOverall} size={15} />

      {!!review.text && (
        <Text variant="bodySmall" tone="dim">{`„${review.text}”`}</Text>
      )}

      <View style={styles.divider} />
    </View>
  );
}

function WatchlistCard({ entry, onOpenPlay }: { entry: WatchlistEntry; onOpenPlay: (id: string) => void }) {
  const [play, setPlay] = useState<Play>();
  const [user, setUser] = useState<User>();
  const [venue, setVenue] = useState<Venue>();

  useEffect(() => {
    getPlayById(entry.playId)
      .then((p) => {
        setPlay(p);
        if (p) getVenueById(p.venueId).then(setVenue).catch(() => setVenue(undefined));
      })
      .catch(() => setPlay(undefined));
    getUserById(entry.addedByUserId)
      .then(setUser)
      .catch(() => setUser(undefined));
  }, [entry]);

  if (!play || !user) return null;

  return (
    <View style={{ gap: space.md }}>
      <CardByline user={user} action={strings.feed.wantsToSee} meta={`${timeAgo(entry.addedAt)} · ${strings.feed.addedToWatchlist}`} />
      <Pressable onPress={() => onOpenPlay(play.id)} style={styles.watchlistRow} accessibilityRole="button" accessibilityLabel={play.title}>
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} width={64} height={96} radius={radius.sm} preferThumb />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="subheading" numberOfLines={2}>
            {play.title}
          </Text>
          <Text variant="caption" tone="dim" numberOfLines={1}>
            {venue?.name}
          </Text>
          {play.premiereDate && (
            <Text variant="caption" tone="faint">
              {strings.feed.premiereLabel}: {formatDate(play.premiereDate)}
            </Text>
          )}
        </View>
      </Pressable>
      <View style={styles.divider} />
    </View>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return strings.time.justNow;
  if (hours < 24) return strings.time.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return days === 1 ? strings.time.yesterday : strings.time.daysAgo(days);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: gutter,
    paddingBottom: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  scopeRow: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingTop: space.md,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  body: { padding: gutter, paddingBottom: 100, gap: space["2xl"] },
  byline: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { color: colors.text },
  watchlistRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // `right` was missing, so long titles ran off the poster and out past the
  // edge of the card.
  posterCaption: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, gap: space.xs },
  divider: { height: 1, backgroundColor: colors.hairlineSoft, marginTop: space.xs },
});
