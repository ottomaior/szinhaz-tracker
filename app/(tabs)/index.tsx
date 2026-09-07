import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, overlay, radius, space } from "@/theme/tokens";
import {
  getCurrentUser,
  getFeed,
  getPlayById,
  getUserById,
  getVenueById,
  type FeedScope,
} from "@/services/playsService";
import { getUnreadCount } from "@/services/notificationService";
import type { FeedItem, Play, User, Venue, Review, WatchlistEntry } from "@/data/types";
import { useAuth } from "@/contexts/AuthContext";
import { Chip } from "@/components/ui/Chip";
import { BellIcon, CommentIcon, HeartIcon } from "@/components/icons/Icons";
import { MaskIcon, MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { formatTimeAgo, strings } from "@/i18n/hu";
import { budapestDayKey, formatLongDate } from "@/utils/datetime";
import { makeStyles } from "@/theme/styles";

export default function FeedScreen() {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();
  const [scope, setScope] = useState<FeedScope>("everyone");
  const [unread, setUnread] = useState(0);
  const [viewer, setViewer] = useState<User>();

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

  // Refreshed on focus rather than only on mount, so the badge clears when the
  // user comes back from the inbox having read everything.
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setUnread(0);
        return;
      }
      let active = true;
      getUnreadCount()
        .then((n) => {
          if (active) setUnread(n);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [session])
  );

  /**
   * The reader's own avatar for the header.
   *
   * Refetched on focus rather than only on mount, because the one screen that
   * changes it — Profil szerkesztése — is reached from here and returns here,
   * and a header still showing the old picture would look like the edit had
   * not saved. A failure leaves `viewer` undefined, which `Avatar` renders as
   * initials-less rather than as an error: a broken avatar is not worth a
   * message.
   */
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setViewer(undefined);
        return;
      }
      let active = true;
      getCurrentUser()
        .then((user) => {
          if (active) setViewer(user);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [session])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen width="reading">
        <View style={[styles.topBar, { paddingTop: insets.top + space.md }]}>
          {/* The screen names itself rather than the app. Every other tab does,
              the tab bar underneath already says which app this is, and the
              widest line on the first screen is better spent on something the
              reader does not already know. */}
          <View style={styles.brand}>
            <MaskIcon state="on" size={22} />
            <Text variant="title">{strings.tabs.feed}</Text>
          </View>
          <View style={styles.topBarActions}>
            {/* Only when signed in: an inbox is per account, and a bell that
                can only ever be empty is a control that teaches you to ignore
                it. The badge is a count, not a dot, because "3 dates published"
                and "1" are different decisions about whether to look now. */}
            {!!session && (
              <Pressable
                onPress={() => router.push("/inbox")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.inbox.openNotifications}
                style={styles.bell}
              >
                <BellIcon />
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text variant="caption" style={styles.badgeText}>
                      {strings.inbox.unreadBadge(unread)}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            {/* The reader's own face, and the shortest way back to their
                diary. Signed out there is nobody to show and the Profil tab
                is the honest route, so it is simply absent rather than a
                grey silhouette that opens a sign-in prompt. */}
            {!!session && (
              <Pressable
                onPress={() => router.push("/(tabs)/profile")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.tabs.profile}
              >
                {/* Empty initials until the profile arrives, rather than
                    hiding the avatar until then: the circle holds its place so
                    the header does not shift under a thumb already reaching
                    for it. */}
                <Avatar uri={viewer?.avatarUrl} initials={viewer?.initials ?? ""} size={38} />
              </Pressable>
            )}
          </View>
        </View>

        {/* The scope chips are signed-in only — "Követettek" for a visitor with
            no account could only ever be empty. "Színházbarátok" is not: it is
            the one route into finding people, and a signed-out visitor is
            exactly who needs it, so the row renders for them too with the link
            alone. */}
        <View style={styles.scopeRow}>
          {!!session && (
            <>
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
            </>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push("/people")} hitSlop={8} accessibilityRole="button">
            <Text variant="label" tone="accent">{strings.feed.findPeople}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        >
          {items.map((item) => (
            <FeedCardRouter
              key={feedItemKey(item)}
              item={item}
              onOpenPlay={(id) => router.push(`/play/${id}`)}
              onOpenEntry={(reviewId) =>
                router.push({ pathname: "/entry/[id]", params: { id: reviewId } })
              }
            />
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
 * The "when were they there" half of a feed byline, or nothing.
 *
 * The card leads with how long ago the entry was *posted*, because the feed is
 * a record of activity. This is the second half, and it is only worth printing
 * when the two facts disagree:
 *
 *  - posted today about tonight — the time-ago line already said it;
 *  - posted today about an evening last March — the card would otherwise claim
 *    they had just been;
 *  - ticked during onboarding, with no date at all — which is a real answer
 *    since 0026, and the one that used to render as "Invalid Date".
 */
function seenNote(review: Review): string | undefined {
  if (!review.seenAt) return strings.feed.seenUndated;
  if (review.seenAt === budapestDayKey(review.createdAt)) return undefined;
  return strings.feed.seenOn(formatLongDate(`${review.seenAt}T12:00:00Z`));
}

/**
 * Stable identity for a feed row. This used to be the array index, so any
 * refresh that reordered the feed re-mounted every card below the change and
 * threw away its already-loaded play/user data.
 */
function feedItemKey(item: FeedItem) {
  return item.kind === "checkin" ? `review:${item.review.id}` : `watchlist:${item.entry.playId}:${item.entry.addedByUserId}`;
}

function FeedCardRouter({
  item,
  onOpenPlay,
  onOpenEntry,
}: {
  item: FeedItem;
  onOpenPlay: (id: string) => void;
  /** The evening itself, where the likes and the conversation live. */
  onOpenEntry: (reviewId: string) => void;
}) {
  if (item.kind === "checkin")
    return <CheckinCard review={item.review} onOpenPlay={onOpenPlay} onOpenEntry={onOpenEntry} />;
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
  const styles = useStyles();

  const router = useRouter();
  return (
    <Pressable
      style={styles.byline}
      onPress={() => router.push(`/user/${user.id}`)}
      accessibilityRole="button"
      accessibilityLabel={user.name}
    >
      <Avatar uri={user.avatarUrl} initials={user.initials} size={36} />
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

function CheckinCard({
  review,
  onOpenPlay,
  onOpenEntry,
}: {
  review: Review;
  onOpenPlay: (id: string) => void;
  onOpenEntry: (reviewId: string) => void;
}) {
  const styles = useStyles();

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
          formatTimeAgo(review.createdAt),
          // Three cases, not two. `seenAt` has been nullable since 0026 —
          // undefined means "seen it, cannot say when", which is what
          // onboarding writes — and this line only tested it against the write
          // date, so a ticked entry rendered `undefinedT12:00:00Z` and the card
          // said "látta: Invalid Date".
          seenNote(review),
          venue?.name,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <Pressable onPress={() => onOpenPlay(play.id)} accessibilityRole="button" accessibilityLabel={play.title}>
        {/* `scrim` matters here: these are production photos, and bright ones
            left the white caption below completely unreadable. */}
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height={200} radius={radius.md} scrim priority="high" />
        {/* Both lines take their colour from `overlay`, not from the palette.
            They sit on the scrim above, which is dark in every theme, so a
            theme with near-black text would print this caption in dark plum
            over a lit production photograph. */}
        <View style={styles.posterCaption}>
          <Text variant="title" numberOfLines={2} style={{ color: overlay.onImageHeading }}>
            {play.title}
          </Text>
          {!!play.director && (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: overlay.onImageText }}>
              rend. {play.director}
            </Text>
          )}
        </View>
      </Pressable>

      <View style={styles.cardFooter}>
        {/* Absent for a "seen it, not rating it" entry. Rendering a zero-mask
            row would read as one star out of five rather than as no opinion. */}
        {review.ratingOverall !== undefined ? (
          <MaskRatingRow rating={review.ratingOverall} size={15} />
        ) : (
          <View />
        )}

        {/* Back, and true this time. These counters existed as columns from
            0001 with nothing writing to them, so they drew a permanent zero
            beside an icon that did nothing when tapped — which is why they were
            removed. 0032 maintains them, and both now lead to the evening,
            where the conversation actually is: a feed card is a summary, and a
            thread read inside one would be a thread nobody can reply to
            without losing their place. */}
        <Pressable
          onPress={() => onOpenEntry(review.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={strings.social.commentsHeading}
          style={styles.counters}
        >
          <View style={styles.counter}>
            <HeartIcon size={15} color={colors.textFaint} />
            <Text variant="caption" tone="faint">{review.likeCount}</Text>
          </View>
          <View style={styles.counter}>
            <CommentIcon size={15} color={colors.textFaint} />
            <Text variant="caption" tone="faint">{review.commentCount}</Text>
          </View>
        </Pressable>
      </View>

      {!!review.text && (
        <Text variant="bodySmall" tone="dim">{`„${review.text}”`}</Text>
      )}

      <View style={styles.divider} />
    </View>
  );
}

function WatchlistCard({ entry, onOpenPlay }: { entry: WatchlistEntry; onOpenPlay: (id: string) => void }) {
  const styles = useStyles();

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
      <CardByline user={user} action={strings.feed.wantsToSee} meta={`${formatTimeAgo(entry.addedAt)} · ${strings.feed.addedToWatchlist}`} />
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  topBar: {
    paddingHorizontal: gutter,
    paddingBottom: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  counters: { flexDirection: "row", alignItems: "center", gap: space.lg },
  counter: { flexDirection: "row", alignItems: "center", gap: 5 },
  // `overflow: visible` matters: the badge is positioned outside the bell's own
  // box, and clipping it would leave a bell that never looks like it has
  // anything in it.
  bell: { position: "relative", overflow: "visible" },
  badge: {
    position: "absolute",
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onAccent, fontWeight: "700", fontSize: 10, lineHeight: 16 },
  scopeRow: {
    alignItems: "center",
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
}));
