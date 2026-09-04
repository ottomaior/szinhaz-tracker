import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getCities, getPremieres, getTrending, getVenueById } from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import type { Play, Venue, VenueType } from "@/data/types";
import { SearchIcon, PlusIcon } from "@/components/icons/Icons";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
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
  const [cities, setCities] = useState<string[]>([]);
  const [activeCity, setActiveCity] = useState(strings.discover.filterAll);
  const [query, setQuery] = useState("");
  const [premieres, setPremieres] = useState<Play[]>([]);
  const [trending, setTrending] = useState<Play[]>([]);
  const [searchResults, setSearchResults] = useState<Play[]>([]);
  const [searching, setSearching] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseFailed, setBrowseFailed] = useState(false);
  const [showAllPremieres, setShowAllPremieres] = useState(false);

  const venueType = FILTER_TO_VENUE_TYPE[activeFilter];
  const city = activeCity === strings.discover.filterAll ? undefined : activeCity;
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  const loadBrowse = useCallback(async () => {
    setBrowseFailed(false);
    setBrowseLoading(true);
    try {
      const [nextPremieres, nextTrending] = await Promise.all([getPremieres({ venueType, city }), getTrending({ venueType, city })]);
      setPremieres(nextPremieres);
      setTrending(nextTrending);
    } catch {
      // Previously both promises rejected unhandled and the screen stayed
      // blank with no indication that anything had gone wrong.
      setBrowseFailed(true);
      setPremieres([]);
      setTrending([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [venueType, city]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  // Collapse the expanded premiere list whenever the filters change, so the
  // "see all" toggle can never be left claiming to show a list it no longer has.
  useEffect(() => {
    setShowAllPremieres(false);
  }, [venueType, city]);

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchPlays(query, venueType, city)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, venueType, city, isSearching]);

  const hasBrowseContent = premieres.length > 0 || trending.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.titleRow}>
          <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 24, color: colors.text }}>{strings.discover.title}</Text>
          <Pressable
            style={styles.fab}
            onPress={() => router.push("/add-play")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.discover.addPlayFab}
          >
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
            accessibilityLabel={strings.discover.searchPlaceholder}
            style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: 13.5, color: colors.text }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(f)} />
          ))}
        </ScrollView>

        {cities.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {[strings.discover.filterAll, ...cities].map((c) => (
              <Chip key={c} label={c} active={activeCity === c} onPress={() => setActiveCity(c)} />
            ))}
          </ScrollView>
        )}
      </View>

      {isSearching ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14, color: colors.text }}>
            {searching ? strings.discover.searching : strings.discover.searchResultsTitle(searchResults.length)}
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
              <Pressable onPress={() => router.push("/add-play")} accessibilityRole="button">
                <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12.5, color: colors.gold }}>
                  {strings.discover.noResultsAction}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: 20 }}>
          {premieres.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={[styles.rowBetween, { paddingHorizontal: 20 }]}>
                <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14, color: colors.text }}>
                  {strings.discover.premieresTitle}
                </Text>
                {/* This label used to be plain text with nothing behind it. */}
                <Pressable onPress={() => setShowAllPremieres((s) => !s)} hitSlop={8} accessibilityRole="button">
                  <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12, color: colors.gold }}>
                    {showAllPremieres ? strings.discover.seeLess : strings.discover.seeAll}
                  </Text>
                </Pressable>
              </View>
              {showAllPremieres ? (
                <View style={[styles.grid, { paddingHorizontal: 20 }]}>
                  {premieres.map((p) => (
                    <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
                  {premieres.map((p) => (
                    <PremiereCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {trending.length > 0 && (
            <View style={{ gap: 10, paddingHorizontal: 20 }}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14, color: colors.text }}>
                {/* Was hardcoded to Budapest even with Debrecen selected. */}
                {city ? strings.discover.trendingTitleInCity(city) : strings.discover.trendingTitle}
              </Text>
              <View style={styles.grid}>
                {trending.map((p) => (
                  <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                ))}
              </View>
            </View>
          )}

          {!browseLoading && !hasBrowseContent && (
            <View style={styles.empty}>
              <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 18, color: colors.text, textAlign: "center" }}>
                {browseFailed ? strings.common.loadError : strings.discover.emptyTitle}
              </Text>
              {!browseFailed && (
                <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.textFaint, textAlign: "center", lineHeight: 19 }}>
                  {strings.discover.emptyBody}
                </Text>
              )}
              <Button
                label={browseFailed ? strings.common.retry : strings.discover.addPlayFab}
                variant="outline"
                onPress={browseFailed ? loadBrowse : () => router.push("/add-play")}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function PremiereCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const fontsLoaded = useAppFonts();
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [play]);

  return (
    <Pressable onPress={onPress} style={{ width: 112, gap: 6 }} accessibilityRole="button" accessibilityLabel={play.title}>
      <PosterPlaceholder poster={play.poster} height={168} radius={8} preferThumb />
      <Text numberOfLines={2} style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.text, lineHeight: 16 }}>
        {play.title}
      </Text>
      <Text numberOfLines={2} style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10.5, color: colors.textFaint }}>
        {venue?.name}
      </Text>
    </Pressable>
  );
}

function TrendingCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const fontsLoaded = useAppFonts();
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [play]);
  const hasRatings = play.rating.count > 0;

  return (
    <Pressable onPress={onPress} style={{ width: "47.5%", gap: 6 }} accessibilityRole="button" accessibilityLabel={play.title}>
      <View style={{ aspectRatio: 2 / 3 }}>
        <PosterPlaceholder poster={play.poster} height="100%" radius={8} preferThumb />
        {/* Unrated plays used to show a gold "0.0" badge, which reads as a
            rock-bottom score rather than as "nobody has rated this yet". */}
        {hasRatings && (
          <View style={styles.ratingBadge}>
            <MaskIcon state="on" size={11} />
            <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 10.5, color: colors.gold }}>
              {play.rating.overall.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.text }}>
        {play.title}
      </Text>
      <Text numberOfLines={2} style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10.5, color: colors.textFaint }}>
        {venue?.name}
      </Text>
      <StatusBadge status={play.status} size="sm" />
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
  empty: { alignItems: "center", gap: 12, paddingVertical: 48, paddingHorizontal: 30 },
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
