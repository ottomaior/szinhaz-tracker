import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getFeed, getPlayById, getUserById, getVenueById } from "@/services/playsService";
import type { FeedItem, Play, User, Venue, Review, WatchlistEntry } from "@/data/types";
import { MaskIcon, MaskRatingRow } from "@/components/icons/MaskIcon";
import { BellIcon, HeartIcon, CommentIcon } from "@/components/icons/Icons";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Avatar } from "@/components/ui/Avatar";
import { strings } from "@/i18n/hu";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    getFeed().then(setItems);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brand}>
          <MaskIcon state="on" size={22} />
          <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 19, color: colors.text }}>
            {strings.appName}
          </Text>
        </View>
        <BellIcon />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 18 }}>
        {items.map((item, i) => (
          <FeedCardRouter key={i} item={item} onOpenPlay={(id) => router.push(`/play/${id}`)} />
        ))}
      </ScrollView>
    </View>
  );
}

function FeedCardRouter({ item, onOpenPlay }: { item: FeedItem; onOpenPlay: (id: string) => void }) {
  if (item.kind === "checkin") return <CheckinCard review={item.review} onOpenPlay={onOpenPlay} />;
  return <WatchlistCard entry={item.entry} onOpenPlay={onOpenPlay} />;
}

function CheckinCard({ review, onOpenPlay }: { review: Review; onOpenPlay: (id: string) => void }) {
  const fontsLoaded = useAppFonts();
  const [play, setPlay] = useState<Play>();
  const [user, setUser] = useState<User>();
  const [venue, setVenue] = useState<Venue>();

  useEffect(() => {
    getPlayById(review.playId).then((p) => {
      setPlay(p);
      if (p) getVenueById(p.venueId).then(setVenue);
    });
    getUserById(review.userId).then(setUser);
  }, [review]);

  if (!play || !user) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.rowGap10}>
        <Avatar initials={user.initials} size={36} />
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 13.5, color: colors.text }}>
            {user.name} <Text style={{ fontFamily: bodyFont(fontsLoaded), color: colors.textFaint }}>{strings.feed.checkedIn}</Text>
          </Text>
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>
            {timeAgo(review.createdAt)} · {venue?.name}
          </Text>
        </View>
      </View>

      <Pressable onPress={() => onOpenPlay(play.id)} style={{ height: 180 }}>
        <PosterPlaceholder height={180} />
        <View style={styles.posterCaption}>
          <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 22, color: colors.text }}>{play.title}</Text>
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textDim }}>rend. {play.director}</Text>
        </View>
      </Pressable>

      <View style={styles.rowBetween}>
        <MaskRatingRow rating={review.ratingOverall} size={15} />
        <View style={styles.rowGap14}>
          <View style={styles.rowGap4}>
            <HeartIcon />
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>{review.likeCount}</Text>
          </View>
          <View style={styles.rowGap4}>
            <CommentIcon />
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>{review.commentCount}</Text>
          </View>
        </View>
      </View>

      {!!review.text && (
        <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, lineHeight: 19.5, color: colors.textDim }}>
          „{review.text}”
        </Text>
      )}

      <View style={styles.divider} />
    </View>
  );
}

function WatchlistCard({ entry, onOpenPlay }: { entry: WatchlistEntry; onOpenPlay: (id: string) => void }) {
  const fontsLoaded = useAppFonts();
  const [play, setPlay] = useState<Play>();
  const [user, setUser] = useState<User>();
  const [venue, setVenue] = useState<Venue>();

  useEffect(() => {
    getPlayById(entry.playId).then((p) => {
      setPlay(p);
      if (p) getVenueById(p.venueId).then(setVenue);
    });
    getUserById(entry.addedByUserId).then(setUser);
  }, [entry]);

  if (!play || !user) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.rowGap10}>
        <Avatar initials={user.initials} size={36} />
        <View>
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 13.5, color: colors.text }}>
            {user.name} <Text style={{ fontFamily: bodyFont(fontsLoaded), color: colors.textFaint }}>{strings.feed.wantsToSee}</Text>
          </Text>
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>
            {timeAgo(entry.addedAt)} · {strings.feed.addedToWatchlist}
          </Text>
        </View>
      </View>
      <Pressable onPress={() => onOpenPlay(play.id)} style={styles.rowGap12}>
        <PosterPlaceholder width={64} height={88} />
        <View style={{ gap: 3 }}>
          <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 16, color: colors.text }}>{play.title}</Text>
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textDim }}>{venue?.name}</Text>
          {play.premiereDate && (
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11, color: colors.textFaint }}>
              {strings.feed.premiereLabel}: {formatDate(play.premiereDate)}
            </Text>
          )}
        </View>
      </Pressable>
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
    height: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowGap10: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowGap12: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowGap14: { flexDirection: "row", alignItems: "center", gap: 14 },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  posterCaption: { position: "absolute", left: 14, bottom: 14, gap: 4 },
  divider: { height: 1, backgroundColor: colors.hairlineSoft, marginTop: 4 },
});
