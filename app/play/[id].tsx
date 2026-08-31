import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const fontsLoaded = useAppFonts();
  const { session } = useAuth();
  const [play, setPlay] = useState<Play>();
  const [venue, setVenue] = useState<Venue>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

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
        getVenueById(p.venueId).then(setVenue);
      })
      .catch(() => setLoadFailed(true));
    getReviewsForPlay(id).then(setReviews);
  }, [id]);

  useEffect(() => {
    if (!id || !session) {
      setInWatchlist(false);
      return;
    }
    isInWatchlist(id).then(setInWatchlist);
  }, [id, session]);

  async function toggleWatchlist() {
    if (!play || watchlistBusy) return;
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
    } finally {
      setWatchlistBusy(false);
    }
  }

  if (loadFailed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 13, color: colors.textFaint, textAlign: "center" }}>
          {strings.checkin.playNotFound}
        </Text>
        <Pressable onPress={() => closeModal(router, "/(tabs)")}>
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.gold }}>{strings.checkin.close}</Text>
        </Pressable>
      </View>
    );
  }

  if (!play) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView bounces={false}>
        <View style={{ height: 300 }}>
          <PosterPlaceholder uri={play.posterUrl} height={300} radius={0} />
          <View style={styles.heroTop}>
            <IconButton translucent onPress={() => closeModal(router, "/(tabs)")}>
              <ChevronLeftIcon />
            </IconButton>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <IconButton translucent>
                <TicketIcon size={16} color={colors.text} />
              </IconButton>
              <IconButton translucent>
                <ShareIcon />
              </IconButton>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16, marginTop: -8 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 30, color: colors.text, lineHeight: 33 }}>
              {play.title}
            </Text>
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.textDim }}>
              {play.author} · rend. {play.director}
            </Text>
            <View style={styles.metaRow}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>{venue?.name}</Text>
              {play.runtimeMinutes != null && (
                <>
                  <View style={styles.dot} />
                  <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>
                    {Math.floor(play.runtimeMinutes / 60)} óra {play.runtimeMinutes % 60} perc
                  </Text>
                </>
              )}
              <View style={styles.dot} />
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>
                {strings.genres[play.genre] ?? play.genre}
              </Text>
            </View>
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingSummary}>
              <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 32, fontWeight: "700", color: colors.gold }}>
                {play.rating.overall.toFixed(1)}
              </Text>
              <MaskRatingRow rating={play.rating.overall} size={12} gap={2} />
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10, color: colors.textFaint }}>
                {strings.playDetail.ratingsCount(play.rating.count)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              <RatingBar label={strings.playDetail.acting} value={play.rating.acting} />
              <RatingBar label={strings.playDetail.directing} value={play.rating.directing} />
              <RatingBar label={strings.playDetail.setDesign} value={play.rating.setDesign} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label={strings.playDetail.logButton}
              icon={<PlusIcon size={16} />}
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: "/checkin", params: { playId: play.id } })}
            />
            <IconButton onPress={toggleWatchlist} active={inWatchlist}>
              <TicketIcon size={18} color={inWatchlist ? colors.bg : colors.text} />
            </IconButton>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13.5, color: colors.text }}>{strings.playDetail.castCrew}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {play.cast.map((c) => (
                <View key={c.name} style={{ width: 64, alignItems: "center", gap: 6 }}>
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

          <View style={{ gap: 10, paddingBottom: 32 }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13.5, color: colors.text }}>
                {strings.playDetail.fromFollowing}
              </Text>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 11.5, color: colors.gold }}>
                {strings.playDetail.reviewsCount(reviews.length)}
              </Text>
            </View>
            {reviews.map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const fontsLoaded = useAppFonts();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11, color: colors.textDim, width: 62 }}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${(value / 5) * 100}%` }]} />
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const fontsLoaded = useAppFonts();
  const [user, setUser] = useState<User>();
  useEffect(() => {
    getUserById(review.userId).then(setUser);
  }, [review]);
  if (!user) return null;

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Avatar initials={user.initials} size={32} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.text }}>{user.name}</Text>
        <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, lineHeight: 18, color: colors.textDim }}>
          „{review.text}”
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
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
