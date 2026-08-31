import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getPremieres, getTrending, getVenueById } from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import type { Play, Venue, VenueType } from "@/data/types";
import { SearchIcon, PlusIcon } from "@/components/icons/Icons";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { strings } from "@/i18n/hu";

const FILTERS = [strings.discover.filterAll, strings.discover.filterKoszinhaz, strings.discover.filterFuggetlen, strings.discover.filterSzabadteri];

const FILTER_TO_VENUE_TYPE: Record<string, VenueType | undefined> = {
  [strings.discover.filterAll]: undefined,
  [strings.discover.filterKoszinhaz]: "kőszínház",
  [strings.discover.filterFuggetlen]: "független",
  [strings.discover.filterSzabadteri]: "szabadtéri",
};

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState(strings.discover.filterAll);
  const [query, setQuery] = useState("");
  const [premieres, setPremieres] = useState<Play[]>([]);
  const [trending, setTrending] = useState<Play[]>([]);
  const [searchResults, setSearchResults] = useState<Play[]>([]);
  const [searching, setSearching] = useState(false);

  const venueType = FILTER_TO_VENUE_TYPE[activeFilter];
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    getPremieres(venueType).then(setPremieres);
    getTrending(venueType).then(setTrending);
  }, [venueType]);

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchPlays(query, venueType)
        .then(setSearchResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, venueType, isSearching]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.titleRow}>
          <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 24, color: colors.text }}>{strings.discover.title}</Text>
          <Pressable style={styles.fab} onPress={() => router.push("/add-play")} hitSlop={8}>
            <PlusIcon size={16} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={strings.discover.searchPlaceholder}
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: 13.5, color: colors.text }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(f)} />
          ))}
        </ScrollView>
      </View>

      {isSearching ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }}>
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14, color: colors.text }}>
            {strings.discover.searchResultsTitle(searchResults.length)}
          </Text>
          <View style={styles.grid}>
            {searchResults.map((p) => (
              <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
            ))}
          </View>
          {!searching && searchResults.length === 0 && (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 30 }}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 13, color: colors.textFaint }}>
                {strings.discover.noResultsTitle}
              </Text>
              <Pressable onPress={() => router.push("/add-play")}>
                <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12.5, color: colors.gold }}>
                  {strings.discover.noResultsAction}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
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
      )}
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
      <PosterPlaceholder uri={play.posterUrl} height={158} radius={8} />
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
        <PosterPlaceholder uri={play.posterUrl} height={150} radius={8} />
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
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
