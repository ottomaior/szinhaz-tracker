import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, overlay, radius, space } from "@/theme/tokens";
import {
  getCurrentUser,
  getFeed,
  type FeedScope,
} from "@/services/playsService";
import { getUnreadCount } from "@/services/notificationService";
import { likeReview, unlikeReview } from "@/services/socialService";
import type { FeedAuthor, FeedItem, FeedPage, Play, User, Venue, Review, WatchlistEntry } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { BellIcon, CommentIcon, HeartIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { formatTimeAgo, strings } from "@/i18n/hu";
import { budapestDayKey, formatLongDate, formatShowtime } from "@/utils/datetime";
import { makeStyles } from "@/theme/styles";

/**
 * Whether this launch has already sent a signed-out visitor to Discover.
 *
 * The feed is the first tab, and for somebody without an account it is a list
 * of strangers' evenings. Discover, with tonight's lead, is a stronger first
 * screen and needs no account — so the *first* time the feed mounts in a
 * session with nobody signed in, it hands over. Once per launch, not on every
 * visit: the tab stays reachable, since a visitor who taps Hírfolyam on
 * purpose should get it.
 *
 * Module state rather than React state because it has to survive this screen
 * unmounting and remounting, which is exactly what the redirect causes.
 */
let handedOffToDiscover = false;

export default function FeedScreen() {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The pages so far, flattened for rendering and kept as maps for lookup.
  // Every card reads its play, venue and author out of `page` rather than
  // fetching them: a page is three queries now, not six per card (T-046).
  const [page, setPage] = useState<FeedPage>({ items: [], plays: new Map(), venues: new Map(), authors: new Map() });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const [scope, setScope] = useState<FeedScope>("everyone");
  const [unread, setUnread] = useState(0);
  const [viewer, setViewer] = useState<User>();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPage(await getFeed(scope));
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

  /**
   * The page after the last one, appended. The feed used to be the twenty
   * newest entries and nothing behind them (T-048); now it ends where the
   * data does, and says so with the absence of the button.
   */
  const loadMore = useCallback(async () => {
    if (loadingMore || !page.nextBefore) return;
    setLoadingMore(true);
    try {
      const next = await getFeed(scope, { before: page.nextBefore });
      setPage((cur) => ({
        items: [...cur.items, ...next.items],
        plays: new Map([...cur.plays, ...next.plays]),
        venues: new Map([...cur.venues, ...next.venues]),
        authors: new Map([...cur.authors, ...next.authors]),
        nextBefore: next.nextBefore,
      }));
    } catch {
      // Left as it was: the pages already on screen are fine, and the button
      // stays to be pressed again.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page.nextBefore, scope]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // In an effect rather than during render: flipping the module flag is a
  // side effect, and React's rules want those out of the render pass.
  useEffect(() => {
    if (authLoading || session || handedOffToDiscover) return;
    handedOffToDiscover = true;
    router.replace("/(tabs)/discover");
  }, [authLoading, session, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen width="reading">
        <View style={[styles.topBar, { paddingTop: insets.top + space.md }]}>
          {/* The screen names itself rather than the app: every other tab
              does, and the tab bar underneath already says which app this is. */}
          <Text variant="display">{strings.tabs.feed}</Text>
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
                <Avatar uri={viewer?.avatarUrl} initials={viewer?.initials ?? ""} size={36} />
              </Pressable>
            )}
          </View>
        </View>

        {/* The scope as text tabs on the header's rule, the way Discover
            offers its three views, rather than two filled chips floating in a
            row. Signed-in only — "Követettek" for a visitor with no account
            could only ever be empty. "Színházbarátok" is not: it is the one
            route into finding people, and a signed-out visitor is exactly who
            needs it, so the row renders for them too with the link alone. */}
        <View style={styles.scopeRow}>
          {!!session ? (
            <View style={styles.tabs} accessibilityRole="tablist">
              {(
                [
                  ["everyone", strings.feed.scopeEveryone],
                  ["following", strings.feed.scopeFollowing],
                ] as [FeedScope, string][]
              ).map(([key, label]) => {
                const active = scope === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setScope(key)}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityRole="tab"
                    aria-selected={active}
                    accessibilityState={{ selected: active }}
                  >
                    <Text variant="label" tone={active ? "default" : "faint"}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable onPress={() => router.push("/people")} hitSlop={8} accessibilityRole="button" style={styles.tab}>
            <Text variant="label" tone="accent">{strings.feed.findPeople}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        >
          {page.items.map((item) => (
            <FeedCardRouter
              key={feedItemKey(item)}
              item={item}
              page={page}
              onOpenPlay={(id) => router.push(`/play/${id}`)}
              // `compose` opens the evening with the comment box already
              // focused, so tapping a bubble that reads 0 lands somewhere you
              // can actually answer rather than on an empty thread.
              onOpenEntry={(reviewId, options) =>
                router.push({
                  pathname: "/entry/[id]",
                  params: options?.compose ? { id: reviewId, compose: "1" } : { id: reviewId },
                })
              }
            />
          ))}

          {!!page.nextBefore && (
            <Button
              variant="outline"
              label={loadingMore ? strings.discover.loadingMore : strings.discover.loadMore}
              disabled={loadingMore}
              onPress={loadMore}
              style={styles.loadMore}
            />
          )}

          {/* An empty "Követettek" feed means "follow someone", not "nobody has
              used the app yet", and pointing it at Discover would be advice for
              the wrong problem. */}
          {!loading && page.items.length === 0 && !failed && scope === "following" && (
            <EmptyState
              eyebrow={strings.feed.scopeFollowing}
              title={strings.feed.followingEmptyTitle}
              body={strings.feed.followingEmptyBody}
              actionLabel={strings.feed.followingEmptyAction}
              onAction={() => router.push("/people")}
            />
          )}

          {!loading && page.items.length === 0 && (failed || scope === "everyone") && (
            <EmptyState
              eyebrow={strings.tabs.feed}
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
  if (item.kind === "checkin") return `review:${item.review.id}`;
  if (item.kind === "watchlist") return `watchlist:${item.entry.playId}:${item.entry.addedByUserId}`;
  return `backfill:${item.reviews[0].id}`;
}

function FeedCardRouter({
  item,
  page,
  onOpenPlay,
  onOpenEntry,
}: {
  item: FeedItem;
  page: FeedPage;
  onOpenPlay: (id: string) => void;
  /** The evening itself, where the conversation lives. */
  onOpenEntry: (reviewId: string, options?: { compose?: boolean }) => void;
}) {
  if (item.kind === "checkin") {
    const play = page.plays.get(item.review.playId);
    const user = page.authors.get(item.review.userId);
    if (!play || !user) return null;
    return (
      <CheckinCard
        review={item.review}
        likedByMe={item.likedByMe}
        play={play}
        venue={page.venues.get(play.venueId)}
        user={user}
        onOpenPlay={onOpenPlay}
        onOpenEntry={onOpenEntry}
      />
    );
  }
  if (item.kind === "watchlist") {
    const play = page.plays.get(item.entry.playId);
    const user = page.authors.get(item.entry.addedByUserId);
    if (!play || !user) return null;
    return <WatchlistCard entry={item.entry} play={play} venue={page.venues.get(play.venueId)} user={user} onOpenPlay={onOpenPlay} />;
  }
  const user = page.authors.get(item.userId);
  if (!user) return null;
  return <BackfillCard item={item} user={user} plays={page.plays} onOpenPlay={onOpenPlay} />;
}

/**
 * One person's onboarding sitting, as one card.
 *
 * The posters in a row rather than a poster card each: the point of the fold
 * is that this was one act, not eighteen evenings. Every tile still opens
 * its production, and the byline still opens the person.
 */
function BackfillCard({
  item,
  user,
  plays,
  onOpenPlay,
}: {
  item: Extract<FeedItem, { kind: "backfill" }>;
  user: FeedAuthor;
  plays: Map<string, Play>;
  onOpenPlay: (id: string) => void;
}) {
  const styles = useStyles();

  const shown = item.reviews.slice(0, BACKFILL_TILES);
  const rest = item.reviews.length - shown.length;

  return (
    <View style={{ gap: space.md }}>
      <CardByline user={user} action={strings.feed.backfilled(item.reviews.length)} meta={formatTimeAgo(item.createdAt)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.backfillRow}>
        {shown.map((review) => {
          const play = plays.get(review.playId);
          if (!play) return null;
          return (
            <Pressable
              key={review.id}
              onPress={() => onOpenPlay(play.id)}
              accessibilityRole="button"
              accessibilityLabel={play.title}
              style={styles.backfillTile}
            >
              <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} width={72} height={104} radius={radius.sm} preferThumb />
              <Text variant="caption" numberOfLines={2}>{play.title}</Text>
            </Pressable>
          );
        })}
        {rest > 0 && (
          <View style={[styles.backfillTile, styles.backfillMore]}>
            <Text variant="label" tone="dim">{strings.feed.backfillMore(rest)}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.divider} />
    </View>
  );
}

/** Posters shown on a backfill card before the "+N" tile. */
const BACKFILL_TILES = 8;

/**
 * The "who did what, when" line every feed card opens with.
 *
 * The byline is the natural way to get from "this person keeps seeing things I
 * like" to following them, so the whole avatar-and-name block opens their
 * profile.
 */
function CardByline({ user, action, meta }: { user: FeedAuthor; action: string; meta: string }) {
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
  likedByMe,
  play,
  venue,
  user,
  onOpenPlay,
  onOpenEntry,
}: {
  review: Review;
  likedByMe: boolean;
  play: Play;
  venue?: Venue;
  user: FeedAuthor;
  onOpenPlay: (id: string) => void;
  onOpenEntry: (reviewId: string, options?: { compose?: boolean }) => void;
}) {
  const styles = useStyles();

  const router = useRouter();
  const { session } = useAuth();

  // Seeded from the feed payload and owned by the card from then on, so a
  // like survives the next `getFeed` reordering the page underneath it.
  const [liked, setLiked] = useState(likedByMe);
  const [likes, setLikes] = useState(review.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  // A refresh is the one thing allowed to overrule the card: it is a newer
  // answer to the same question, from the same server.
  useEffect(() => {
    setLiked(likedByMe);
    setLikes(review.likeCount);
  }, [likedByMe, review.likeCount]);

  /**
   * Flipped straight away and rolled back if the write fails — the same
   * bargain `ReviewSocial` makes on the evening screen, for the same reason:
   * a toggle that waits for a round trip gets pressed twice.
   *
   * A signed-out tap is not a failure. It is the most natural moment in the
   * app to ask somebody to sign in — they have just found an evening worth
   * saying something about — so it goes to sign-in rather than doing nothing.
   */
  async function toggleLike() {
    if (likeBusy) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    setLikeBusy(true);
    try {
      if (next) await likeReview(review.id);
      else await unlikeReview(review.id);
    } catch {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setLikeBusy(false);
    }
  }

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
        meta={[formatTimeAgo(review.createdAt), seenNote(review)].filter(Boolean).join(" · ")}
      />

      <Pressable onPress={() => onOpenPlay(play.id)} accessibilityRole="button" accessibilityLabel={play.title}>
        {/* `scrim` matters here: these are production photos, and bright ones
            left the white caption below completely unreadable. */}
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height={220} radius={radius.md} scrim priority="high" />
        {/* Everything on the image takes its colour from `overlay`, not from
            the palette. The scrim is dark in every theme, so a theme with
            near-black text would print this caption in ink over a lit
            production photograph. */}
        {!!venue?.name && (
          <View style={styles.posterEyebrow}>
            <Text variant="eyebrow" numberOfLines={1} style={{ color: overlay.onImageAccent }}>
              {venue.name}
            </Text>
          </View>
        )}
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

      {/* An entry whose opinion is not this reader's to see. The card above
          still says who went and to what — that is what the feed is for, and
          what makes somebody worth following — but the rating, the note and
          the whole social row stop here.

          Said rather than left blank. A card that simply ended after the
          poster would read as an entry nobody bothered to rate, which is a
          claim about the person; this says the rating exists and names the way
          in. See 0041 for where the emptiness is actually enforced — by then
          the database has already withheld the columns, and this line is only
          the explanation. */}
      {!review.canSeeOpinion ? (
        <Text variant="caption" tone="faint">
          {strings.feed.followToSee(user.name)}
        </Text>
      ) : (
      <>
      <View style={styles.cardFooter}>
        {/* Absent for a "seen it, not rating it" entry. Rendering a zero-mask
            row would read as one star out of five rather than as no opinion. */}
        {review.ratingOverall !== undefined ? (
          <MaskRatingRow rating={review.ratingOverall} size={15} />
        ) : (
          <View />
        )}

        {/* Two controls, not one. They used to share a single press target that
            opened the evening, and a heart that answers a tap by navigating
            somewhere reads as broken: a heart is a toggle in every app anybody
            has ever used. So the heart likes, here, without leaving the feed —
            and the bubble keeps leading to the evening, which is what a comment
            icon does everywhere and is the only place a thread can be read. */}
        <View style={styles.counters}>
          <Pressable
            onPress={toggleLike}
            disabled={likeBusy}
            hitSlop={10}
            accessibilityRole="button"
            aria-pressed={liked}
            accessibilityState={{ selected: liked }}
            accessibilityLabel={session ? strings.social.like : strings.social.signInToLike}
            style={styles.counter}
          >
            <HeartIcon size={15} color={liked ? colors.gold : colors.textFaint} filled={liked} />
            <Text variant="caption" tone={liked ? "accent" : "faint"}>{likes}</Text>
          </Pressable>
          <Pressable
            onPress={() => onOpenEntry(review.id, { compose: true })}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={strings.social.commentsHeading}
            style={styles.counter}
          >
            <CommentIcon size={15} color={colors.textFaint} />
            <Text variant="caption" tone="faint">{review.commentCount}</Text>
          </Pressable>
        </View>
      </View>

      {!!review.text && (
        <Text variant="bodySmall" tone="dim">{`„${review.text}”`}</Text>
      )}
      </>
      )}

      <View style={styles.divider} />
    </View>
  );
}

/**
 * Somebody wants to see something. A programme row rather than a poster card:
 * the poster belongs to the evening that happened, and a wish is a smaller
 * thing than a night out. The line under the title is the next date, which
 * is what turns "wants to see" into "could go on Friday".
 */
function WatchlistCard({
  entry,
  play,
  venue,
  user,
  onOpenPlay,
}: {
  entry: WatchlistEntry;
  play: Play;
  venue?: Venue;
  user: FeedAuthor;
  onOpenPlay: (id: string) => void;
}) {
  const styles = useStyles();

  const when = play.nextPerformanceAt
    ? formatShowtime(play.nextPerformanceAt)
    : play.premiereDate
      // With its year: a premiere only shows here when nothing is scheduled,
      // which for an old production means a date years back, and "szept. 17."
      // alone read as news (T-056).
      ? `${strings.feed.premiereLabel}: ${formatLongDate(`${play.premiereDate}T12:00:00Z`)}`
      : undefined;

  return (
    <View style={{ gap: space.md }}>
      <CardByline user={user} action={strings.feed.wantsToSee} meta={`${formatTimeAgo(entry.addedAt)} · ${strings.feed.addedToWatchlist}`} />
      <Pressable onPress={() => onOpenPlay(play.id)} style={styles.watchlistRow} accessibilityRole="button" accessibilityLabel={play.title}>
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} width={56} height={76} radius={radius.sm} preferThumb />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="subheading" numberOfLines={2}>
            {play.title}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {venue?.name}
            {!!when && (
              <>
                {" · "}
                <Text variant="caption" tone="accent">{when}</Text>
              </>
            )}
          </Text>
        </View>
      </Pressable>
      <View style={styles.divider} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  topBar: {
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: gutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  tabs: { flexDirection: "row", gap: space["2xl"] },
  tab: { paddingVertical: space.md - 2, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.gold },
  body: { padding: gutter, paddingBottom: 100, gap: space["2xl"] },
  byline: { flexDirection: "row", alignItems: "center", gap: space.md },
  backfillRow: { flexDirection: "row", gap: space.md },
  backfillTile: { width: 72, gap: space.xs },
  backfillMore: { height: 104, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairline },
  loadMore: { alignSelf: "center", minWidth: 220, marginTop: space.md },
  name: { color: colors.text },
  watchlistRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  posterEyebrow: {
    position: "absolute",
    top: space.md,
    left: space.md,
    maxWidth: "70%",
    backgroundColor: overlay.onImage,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  // `right` was missing once, so long titles ran off the poster and out past
  // the edge of the card.
  posterCaption: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, gap: space.xs },
  divider: { height: 1, backgroundColor: colors.hairlineSoft, marginTop: space.xs },
}));
