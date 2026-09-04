import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { addToWatchlist, getPlayById, getReviewsForPlay, getUserById, getVenueById, isInWatchlist, removeFromWatchlist } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Poster, Review, User, Venue } from "@/data/types";
import { IconButton, Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { ChevronLeftIcon, ShareIcon, TicketIcon, PlusIcon } from "@/components/icons/Icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";

/**
 * The hero honours the poster's real proportions, within limits.
 *
 * There is one image here and room to show it, so unlike the browsing grids
 * this does not force a single ratio — the catalogue is close to half
 * landscape production stills and half portrait artwork, and cropping either
 * into the other's shape loses the part worth looking at. The clamp keeps a
 * panorama from becoming a letterbox slit and a tall poster from pushing the
 * title off a phone screen entirely.
 */
const MIN_HERO_ASPECT = 4 / 5;
const MAX_HERO_ASPECT = 16 / 9;
const FALLBACK_HERO_ASPECT = 3 / 2;

function heroAspect(poster?: Poster): number {
  if (!poster?.width || !poster?.height) return FALLBACK_HERO_ASPECT;
  return Math.min(MAX_HERO_ASPECT, Math.max(MIN_HERO_ASPECT, poster.width / poster.height));
}

export default function PlayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [play, setPlay] = useState<Play>();
  const [venue, setVenue] = useState<Venue>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (!id) {
      setLoadFailed(true);
      return;
    }
    getPlayById(id)
      .then((p) => {
        if (!p) {
          setLoadFailed(true);
          return;
        }
        setPlay(p);
        getVenueById(p.venueId).then(setVenue).catch(() => setVenue(undefined));
      })
      .catch(() => setLoadFailed(true));
    getReviewsForPlay(id)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    if (!id || !session) {
      setInWatchlist(false);
      return;
    }
    isInWatchlist(id)
      .then(setInWatchlist)
      .catch(() => setInWatchlist(false));
  }, [id, session]);

  async function toggleWatchlist() {
    if (!play) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(play.id);
        setInWatchlist(false);
      } else {
        await addToWatchlist(play.id);
        setInWatchlist(true);
      }
    } catch {
      setNotice(strings.common.loadError);
    } finally {
      setWatchlistBusy(false);
    }
  }

  async function handleShare() {
    if (!play) return;
    try {
      const url = Platform.OS === "web" ? window.location.href : undefined;
      await Share.share({ message: url ? `${play.title} — ${url}` : play.title, title: play.title });
    } catch {
      setNotice(strings.playDetail.shareFailed);
    }
  }

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <Text variant="body" tone="dim" style={{ textAlign: "center" }}>
          {strings.checkin.playNotFound}
        </Text>
        <Pressable onPress={() => closeModal(router, "/(tabs)")} accessibilityRole="button" hitSlop={8}>
          <Text variant="label" tone="accent">
            {strings.checkin.close}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!play) return null;

  const hasRatings = play.rating.count > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: space["3xl"] }}>
        <View style={{ aspectRatio: heroAspect(play.poster), maxHeight: 460 }}>
          <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height="100%" radius={0} priority="high" />
          <View style={[styles.heroTop, { top: insets.top + space.lg }]}>
            <IconButton translucent onPress={() => closeModal(router, "/(tabs)")} accessibilityLabel={strings.playDetail.back}>
              <ChevronLeftIcon />
            </IconButton>
            {/* The second button up here used to be a duplicate of the
                watchlist bookmark below and had no press handler at all. */}
            <IconButton translucent onPress={handleShare} accessibilityLabel={strings.playDetail.share}>
              <ShareIcon />
            </IconButton>
          </View>
          {/* These are working photographers' production stills; the credit
              belongs with the image wherever it is shown at size. */}
          {!!play.poster?.credit && (
            <Text variant="caption" style={styles.posterCredit}>
              {play.poster.credit}
            </Text>
          )}
        </View>

        <ContentColumn style={{ paddingHorizontal: gutter, gap: space.xl, marginTop: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Text variant="display">{play.title}</Text>
            <Text variant="body" tone="dim">
              {[play.author, play.director ? `rend. ${play.director}` : ""].filter(Boolean).join(" · ")}
            </Text>
            <View style={styles.metaRow}>
              {!!venue?.name && (
                <Text variant="caption" tone="faint">
                  {venue.name}
                </Text>
              )}
              {play.runtimeMinutes != null && (
                <>
                  <View style={styles.dot} />
                  <Text variant="caption" tone="faint">
                    {formatRuntime(play.runtimeMinutes)}
                  </Text>
                </>
              )}
              {!!play.genre && (
                <>
                  <View style={styles.dot} />
                  <Text variant="caption" tone="faint">
                    {strings.genres[play.genre] ?? play.genre}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.statusRow}>
              <StatusBadge status={play.status} />
              <Text variant="bodySmall" tone="dim" style={{ flexShrink: 1 }}>
                {schedulingLine(play)}
              </Text>
            </View>

            {/* recompute_play_status() writes a plain-language sentence saying
                exactly why a production reads as it does ("no future dates;
                last performance 2025-06-14"). Nothing displayed it, which left
                the badge as an assertion the reader had to take on trust. */}
            {!!play.statusReason && (
              <Text variant="caption" tone="faint">
                {play.statusReason}
              </Text>
            )}

            {play.isArchived && (
              <Text variant="caption" tone="faint">
                {strings.playDetail.archivedNote}
              </Text>
            )}
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingSummary}>
              {/* A play with no reviews used to render a bold gold "0.0", which
                  reads as a terrible score rather than as "not rated yet". */}
              <Text variant="title" tone={hasRatings ? "accent" : "faint"}>
                {hasRatings ? play.rating.overall.toFixed(1) : strings.common.noRating}
              </Text>
              {hasRatings && <MaskRatingRow rating={play.rating.overall} size={12} gap={2} />}
              <Text variant="caption" tone="faint" style={{ textAlign: "center" }}>
                {hasRatings ? strings.playDetail.ratingsCount(play.rating.count) : strings.playDetail.noRatingsYet}
              </Text>
            </View>
            <View style={{ flex: 1, gap: space.sm }}>
              <RatingBar label={strings.playDetail.acting} value={hasRatings ? play.rating.acting : 0} />
              <RatingBar label={strings.playDetail.directing} value={hasRatings ? play.rating.directing : 0} />
              <RatingBar label={strings.playDetail.setDesign} value={hasRatings ? play.rating.setDesign : 0} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: space.md }}>
            <Button
              label={strings.playDetail.logButton}
              icon={<PlusIcon size={16} />}
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: "/checkin", params: { playId: play.id } })}
            />
            <IconButton
              onPress={toggleWatchlist}
              active={inWatchlist}
              disabled={watchlistBusy}
              accessibilityLabel={inWatchlist ? strings.playDetail.removeFromWatchlist : strings.playDetail.addToWatchlist}
            >
              <TicketIcon size={18} color={inWatchlist ? colors.bg : colors.text} />
            </IconButton>
          </View>

          {!!notice && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
              {notice}
            </Text>
          )}

          {!!play.synopsis && (
            <Text variant="body" tone="dim">
              {play.synopsis}
            </Text>
          )}

          {play.cast.length > 0 && (
            <View style={{ gap: space.md }}>
              <Text variant="subheading">{strings.playDetail.castCrew}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.lg }}>
                {play.cast.map((c, i) => (
                  // Keyed by index: the same performer legitimately appears
                  // twice when they cover two roles in one production.
                  <View key={`${c.name}-${i}`} style={styles.castMember}>
                    <Avatar initials={initialsOf(c.name)} size={52} />
                    <Text variant="caption" numberOfLines={2} style={{ textAlign: "center" }}>
                      {c.name}
                    </Text>
                    {!!c.role && (
                      <Text variant="caption" tone="faint" numberOfLines={1} style={{ textAlign: "center" }}>
                        {c.role}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ gap: space.md }}>
            <View style={styles.rowBetween}>
              <Text variant="subheading">{strings.playDetail.fromFollowing}</Text>
              <Text variant="label" tone="accent">
                {strings.playDetail.reviewsCount(reviews.length)}
              </Text>
            </View>
            {reviews.length === 0 ? (
              <Text variant="bodySmall" tone="faint">
                {strings.playDetail.noReviewsYet}
              </Text>
            ) : (
              reviews.map((r) => <ReviewRow key={r.id} review={r} />)
            )}
          </View>
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

/**
 * The one line a reader actually wants under the title: when can I see this,
 * or when was the last chance. Falls back to silence rather than filler when
 * neither date is known.
 */
function schedulingLine(play: Play): string {
  if (play.nextPerformanceAt) {
    const when = new Date(play.nextPerformanceAt).toLocaleString("hu-HU", {
      month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
    });
    return strings.status.nextPerformance + ": " + when;
  }
  if (play.lastPerformanceAt) {
    const when = new Date(play.lastPerformanceAt).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
    return strings.status.lastPerformance + ": " + when;
  }
  return play.status === "running" || play.status === "announced" ? strings.status.noUpcoming : "";
}

/** Cast avatars were empty circles; initials at least identify the performer. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ${strings.playDetail.minutes}`;
  if (!rest) return `${hours} ${strings.playDetail.hours}`;
  return `${hours} ${strings.playDetail.hours} ${rest} ${strings.playDetail.minutes}`;
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <Text variant="caption" tone="dim" style={{ width: 62 }}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const [user, setUser] = useState<User>();
  useEffect(() => {
    getUserById(review.userId)
      .then(setUser)
      .catch(() => setUser(undefined));
  }, [review]);
  if (!user) return null;

  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <Avatar initials={user.initials} size={32} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="label">{user.name}</Text>
        <MaskRatingRow rating={review.ratingOverall} size={11} gap={2} />
        {!!review.text && (
          <Text variant="bodySmall" tone="dim">{`„${review.text}”`}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: gutter,
  },
  heroTop: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  posterCredit: {
    position: "absolute",
    right: space.md,
    bottom: space.sm,
    color: "rgba(245,237,228,0.62)",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 2, flexWrap: "wrap" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap", marginTop: space.xs },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textFaint },
  ratingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  ratingSummary: {
    alignItems: "center",
    gap: space.sm,
    paddingRight: space.lg,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  castMember: { width: 64, alignItems: "center", gap: space.sm },
  barTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface2, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.gold },
  rowBetween: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
});
