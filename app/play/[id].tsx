import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { addToWatchlist, getPlayById, getReviewsForPlay, getUserById, getVenueById, isInWatchlist, removeFromWatchlist } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Review, User, Venue } from "@/data/types";
import { IconButton, Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { ChevronLeftIcon, ShareIcon, TicketIcon, PlusIcon } from "@/components/icons/Icons";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";

export default function PlayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
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
    if (!play || watchlistBusy) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    setNotice(undefined);
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
      // A failed insert/delete used to leave the button silently out of sync
      // with the database.
      setNotice(strings.playDetail.watchlistError);
    } finally {
      setWatchlistBusy(false);
    }
  }

  async function handleShare() {
    if (!play) return;
    const message = venue?.name ? `${play.title} — ${venue.name}` : play.title;
    setNotice(undefined);
    try {
      // React Native's Share sheet does not exist on web; the Web Share API is
      // only available in secure contexts, so fall back to the clipboard.
      if (Platform.OS === "web") {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) {
          await nav.share({ title: play.title, text: message });
        } else if (nav?.clipboard) {
          await nav.clipboard.writeText(message);
          setNotice(strings.playDetail.linkCopied);
        } else {
          setNotice(strings.playDetail.shareFailed);
        }
        return;
      }
      await Share.share({ title: play.title, message });
    } catch {
      setNotice(strings.playDetail.shareFailed);
    }
  }

  if (loadFailed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 13, color: colors.textFaint, textAlign: "center" }}>
          {strings.checkin.playNotFound}
        </Text>
        <Pressable onPress={() => closeModal(router, "/(tabs)")} accessibilityRole="button">
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.gold }}>{strings.checkin.close}</Text>
        </Pressable>
      </View>
    );
  }

  if (!play) return null;

  const hasRatings = play.rating.count > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView bounces={false}>
        <View style={{ height: 300 }}>
          <PosterPlaceholder uri={play.posterUrl} height={300} radius={0} />
          <View style={[styles.heroTop, { top: insets.top + 18 }]}>
            <IconButton translucent onPress={() => closeModal(router, "/(tabs)")} accessibilityLabel={strings.playDetail.back}>
              <ChevronLeftIcon />
            </IconButton>
            {/* The second button up here used to be a duplicate of the
                watchlist bookmark below and had no press handler at all. */}
            <IconButton translucent onPress={handleShare} accessibilityLabel={strings.playDetail.share}>
              <ShareIcon />
            </IconButton>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16, marginTop: -8 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 30, color: colors.text, lineHeight: 33 }}>
              {play.title}
            </Text>
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.textDim }}>
              {[play.author, play.director ? `rend. ${play.director}` : ""].filter(Boolean).join(" · ")}
            </Text>
            <View style={styles.metaRow}>
              {!!venue?.name && (
                <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>{venue.name}</Text>
              )}
              {play.runtimeMinutes != null && (
                <>
                  <View style={styles.dot} />
                  <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>
                    {formatRuntime(play.runtimeMinutes)}
                  </Text>
                </>
              )}
              {!!play.genre && (
                <>
                  <View style={styles.dot} />
                  <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>
                    {strings.genres[play.genre] ?? play.genre}
                  </Text>
                </>
              )}
              {play.isArchived && (
                <View style={styles.archivedBadge}>
                  <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 10, color: colors.textDim, letterSpacing: 0.06 }}>
                    {strings.playDetail.archivedBadge}
                  </Text>
                </View>
              )}
            </View>
            {play.isArchived && (
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint, lineHeight: 16, marginTop: 2 }}>
                {strings.playDetail.archivedNote}
              </Text>
            )}
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingSummary}>
              {/* A play with no reviews used to render a bold gold "0.0", which
                  reads as a terrible score rather than as "not rated yet". */}
              <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 32, fontWeight: "700", color: hasRatings ? colors.gold : colors.textFaint }}>
                {hasRatings ? play.rating.overall.toFixed(1) : strings.common.noRating}
              </Text>
              {hasRatings && <MaskRatingRow rating={play.rating.overall} size={12} gap={2} />}
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10, color: colors.textFaint, textAlign: "center" }}>
                {hasRatings ? strings.playDetail.ratingsCount(play.rating.count) : strings.playDetail.noRatingsYet}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              <RatingBar label={strings.playDetail.acting} value={hasRatings ? play.rating.acting : 0} />
              <RatingBar label={strings.playDetail.directing} value={hasRatings ? play.rating.directing : 0} />
              <RatingBar label={strings.playDetail.setDesign} value={hasRatings ? play.rating.setDesign : 0} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
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
            <Text
              accessibilityRole="alert"
              style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12, color: colors.gold }}
            >
              {notice}
            </Text>
          )}

          {play.cast.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13.5, color: colors.text }}>{strings.playDetail.castCrew}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {play.cast.map((c, i) => (
                  // Keyed by index: the same performer legitimately appears
                  // twice when they cover two roles in one production.
                  <View key={`${c.name}-${i}`} style={{ width: 64, alignItems: "center", gap: 6 }}>
                    <View style={styles.castAvatar} />
                    <Text
                      numberOfLines={2}
                      style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11, color: colors.text, textAlign: "center", lineHeight: 14 }}
                    >
                      {c.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ gap: 10, paddingBottom: 32 }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13.5, color: colors.text }}>
                {strings.playDetail.fromFollowing}
              </Text>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 11.5, color: colors.gold }}>
                {strings.playDetail.reviewsCount(reviews.length)}
              </Text>
            </View>
            {reviews.length === 0 ? (
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
                {strings.playDetail.noReviewsYet}
              </Text>
            ) : (
              reviews.map((r) => <ReviewRow key={r.id} review={r} />)
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ${strings.playDetail.minutes}`;
  if (!rest) return `${hours} ${strings.playDetail.hours}`;
  return `${hours} ${strings.playDetail.hours} ${rest} ${strings.playDetail.minutes}`;
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const fontsLoaded = useAppFonts();
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11, color: colors.textDim, width: 62 }}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const fontsLoaded = useAppFonts();
  const [user, setUser] = useState<User>();
  useEffect(() => {
    getUserById(review.userId)
      .then(setUser)
      .catch(() => setUser(undefined));
  }, [review]);
  if (!user) return null;

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Avatar initials={user.initials} size={32} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.text }}>{user.name}</Text>
        <MaskRatingRow rating={review.ratingOverall} size={11} gap={2} />
        {!!review.text && (
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, lineHeight: 18, color: colors.textDim }}>
            {`„${review.text}”`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" },
  archivedBadge: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textFaint },
  ratingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    padding: 16,
  },
  ratingSummary: {
    alignItems: "center",
    gap: 6,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  barTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface2, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.gold },
  castAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.hairline },
  rowBetween: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
});
