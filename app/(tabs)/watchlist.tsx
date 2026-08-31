import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getVenueById, getWatchlist } from "@/services/playsService";
import type { Play, Venue } from "@/data/types";
import { CalendarIcon, PinIcon } from "@/components/icons/Icons";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { strings } from "@/i18n/hu";

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  const [items, setItems] = useState<{ play: Play; addedAt: string }[]>([]);

  useEffect(() => {
    getWatchlist().then(setItems);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 24, color: colors.text }}>{strings.watchlist.title}</Text>
        <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
          {strings.watchlist.subtitle(items.length)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }}>
        {items.map(({ play, addedAt }) => (
          <WatchlistRow key={play.id} play={play} onPress={() => router.push(`/play/${play.id}`)} />
        ))}
      </ScrollView>
    </View>
  );
}

function WatchlistRow({ play, onPress }: { play: Play; onPress: () => void }) {
  const fontsLoaded = useAppFonts();
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId).then(setVenue);
  }, [play]);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <PosterPlaceholder uri={play.posterUrl} width={64} height={88} radius={8} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 16, color: colors.text }}>{play.title}</Text>
        <View style={styles.metaRow}>
          <PinIcon size={13} />
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>{venue?.name}</Text>
        </View>
        {play.premiereDate && (
          <View style={styles.metaRow}>
            <CalendarIcon size={13} />
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>
              {strings.watchlist.premiereLabel}: {formatDate(play.premiereDate)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  row: { flexDirection: "row", gap: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
