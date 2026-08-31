import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getPremieres, getTrending, getVenueById } from "@/services/playsService";
import type { Play, Venue } from "@/data/types";
import { SearchIcon } from "@/components/icons/Icons";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { strings } from "@/i18n/hu";

const FILTERS = [strings.discover.filterAll, strings.discover.filterKoszinhaz, strings.discover.filterFuggetlen, strings.discover.filterSzabadteri];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState(strings.discover.filterAll);
  const [premieres, setPremieres] = useState<Play[]>([]);
  const [trending, setTrending] = useState<Play[]>([]);

  useEffect(() => {
    getPremieres().then(setPremieres);
    getTrending().then(setTrending);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 24, color: colors.text }}>{strings.discover.title}</Text>

        <View style={styles.searchBar}>
          <SearchIcon />
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13.5, color: colors.textFaint }}>
            {strings.discover.searchPlaceholder}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(f)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: 20 }}>
        <View style={{ gap: 10 }}>
          <View style={[styles.rowBetween, { paddingHorizontal: 20 }]}>
            <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14, color: colors.text }}>
              {strings.discover.premieresTitle}
            </Text>
            <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12, color: colors.gold }}>{strings.discover.seeAll}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
            {premieres.map((p) => (
              <PremiereCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: 10, paddingHorizontal: 20 }}>
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14, color: colors.text }}>{strings.discover.trendingTitle}</Text>
          <View style={styles.grid}>
            {trending.map((p) => (
              <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PremiereCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const fontsLoaded = useAppFonts();
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId).then(setVenue);
  }, [play]);

  return (
    <Pressable onPress={onPress} style={{ width: 112, gap: 6 }}>
      <PosterPlaceholder height={158} radius={8} />
      <Text numberOfLines={2} style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.text, lineHeight: 16 }}>
        {play.title}
      </Text>
      <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10.5, color: colors.textFaint }}>{venue?.name}</Text>
    </Pressable>
  );
}

function TrendingCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const fontsLoaded = useAppFonts();
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId).then(setVenue);
  }, [play]);

  return (
    <Pressable onPress={onPress} style={{ width: "47.5%", gap: 6 }}>
      <View style={{ height: 150 }}>
        <PosterPlaceholder height={150} radius={8} />
        <View style={styles.ratingBadge}>
          <MaskIcon state="on" size={11} />
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 10.5, color: colors.gold }}>
            {play.rating.overall.toFixed(1)}
          </Text>
        </View>
      </View>
      <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.text }}>{play.title}</Text>
      <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10.5, color: colors.textFaint }}>{venue?.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowBetween: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(9,4,3,0.78)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
});
