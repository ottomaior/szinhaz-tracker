import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, minTouchTarget, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getCities, getPremieres, getTrending, getVenueById } from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import type { Play, Venue, VenueType } from "@/data/types";
import { SearchIcon, PlusIcon, CloseIcon } from "@/components/icons/Icons";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PosterCardSkeleton, SkeletonRail } from "@/components/ui/Skeleton";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Screen } from "@/components/ui/Screen";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

const FILTERS = [strings.discover.filterAll, strings.discover.filterKoszinhaz, strings.discover.filterFuggetlen, strings.discover.filterSzabadteri];

const FILTER_TO_VENUE_TYPE: Record<string, VenueType | undefined> = {
  [strings.discover.filterAll]: undefined,
  [strings.discover.filterKoszinhaz]: "kőszínház",
  [strings.discover.filterFuggetlen]: "független",
  [strings.discover.filterSzabadteri]: "szabadtéri",
};

/**
 * Grid tiles are 3:4 rather than the 2:3 of a printed poster.
 *
 * The catalogue is very nearly half landscape production photography and half
 * portrait artwork, so no single ratio flatters both. A grid still needs one
 * rhythm — mixed heights read as broken rather than considered — and 3:4 is
 * the compromise that holds a portrait poster comfortably while cropping far
 * less out of a landscape still than 2:3 did. The play detail hero, where
 * there is only one image and room to spare, honours the real ratio instead.
 */
const TILE_ASPECT = 3 / 4;

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
  const archivedCount = searchResults.filter((p) => p.isArchived || p.status === "ended").length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <View style={styles.titleRow}>
            <Text variant="title">{strings.discover.title}</Text>
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
              style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }}
            />
            {/* Clearing a search by backspacing through it is tedious on a
                phone, and there was no other way out of the results view. */}
            {isSearching && (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.common.close}>
                <CloseIcon size={15} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {FILTERS.map((f) => (
              <Chip key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(f)} />
            ))}
          </ScrollView>

          {cities.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {[strings.discover.filterAll, ...cities].map((c) => (
                <Chip key={c} label={c} active={activeCity === c} onPress={() => setActiveCity(c)} />
              ))}
            </ScrollView>
          )}
        </View>

        {isSearching ? (
          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            <View style={{ gap: space.xs }}>
              <Text variant="subheading">
                {searching ? strings.discover.searching : strings.discover.searchResultsTitle(searchResults.length)}
              </Text>
              {/* Search covers the theatres' archives as well as what is on
                  now — that is the point, since the app is for logging plays
                  you have already seen — but a run of "ended" badges reads as
                  a bug unless the list says so first. */}
              {!searching && archivedCount > 0 && (
                <Text variant="caption" tone="faint">
                  {strings.discover.includesArchived(archivedCount)}
                </Text>
              )}
            </View>
            {searching ? (
              <Grid>
                {Array.from({ length: 6 }).map((_, i) => (
                  <PosterCardSkeleton key={i} />
                ))}
              </Grid>
            ) : (
              <Grid>
                {searchResults.map((p) => (
                  <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                ))}
              </Grid>
            )}
            {!searching && searchResults.length === 0 && (
              <View style={styles.noResults}>
                <Text variant="body" tone="dim">
                  {strings.discover.noResultsTitle}
                </Text>
                <Pressable onPress={() => router.push("/add-play")} accessibilityRole="button" hitSlop={8}>
                  <Text variant="label" tone="accent">
                    {strings.discover.noResultsAction}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: space["2xl"] }}>
            {browseLoading && (
              <View style={{ gap: space["2xl"] }}>
                <View style={{ gap: space.md }}>
                  <View style={{ paddingHorizontal: gutter }}>
                    <Text variant="subheading">{strings.discover.premieresTitle}</Text>
                  </View>
                  <View style={{ paddingHorizontal: gutter }}>
                    <SkeletonRail />
                  </View>
                </View>
                <View style={{ gap: space.md, paddingHorizontal: gutter }}>
                  <Text variant="subheading">{strings.discover.trendingTitle}</Text>
                  <Grid>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <PosterCardSkeleton key={i} />
                    ))}
                  </Grid>
                </View>
              </View>
            )}

            {!browseLoading && premieres.length > 0 && (
              <View style={{ gap: space.md }}>
                <View style={[styles.rowBetween, { paddingHorizontal: gutter }]}>
                  <Text variant="subheading">{strings.discover.premieresTitle}</Text>
                  {/* This label used to be plain text with nothing behind it. */}
                  <Pressable onPress={() => setShowAllPremieres((s) => !s)} hitSlop={8} accessibilityRole="button">
                    <Text variant="label" tone="accent">
                      {showAllPremieres ? strings.discover.seeLess : strings.discover.seeAll}
                    </Text>
                  </Pressable>
                </View>
                {showAllPremieres ? (
                  <Grid style={{ paddingHorizontal: gutter }}>
                    {premieres.map((p) => (
                      <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                    ))}
                  </Grid>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {premieres.map((p) => (
                      <PremiereCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {!browseLoading && trending.length > 0 && (
              <View style={{ gap: space.md, paddingHorizontal: gutter }}>
                <Text variant="subheading">
                  {/* Was hardcoded to Budapest even with Debrecen selected. */}
                  {city ? strings.discover.trendingTitleInCity(city) : strings.discover.trendingTitle}
                </Text>
                <Grid>
                  {trending.map((p) => (
                    <TrendingCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                  ))}
                </Grid>
              </View>
            )}

            {!browseLoading && !hasBrowseContent && (
              <EmptyState
                title={browseFailed ? strings.common.loadError : strings.discover.emptyTitle}
                body={browseFailed ? undefined : strings.discover.emptyBody}
                actionLabel={browseFailed ? strings.common.retry : strings.discover.addPlayFab}
                onAction={browseFailed ? loadBrowse : () => router.push("/add-play")}
              />
            )}
          </ScrollView>
        )}
      </Screen>
    </View>
  );
}

/** Shared by both cards: the venue name under the title. */
function useVenue(venueId: string): Venue | undefined {
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [venueId]);
  return venue;
}

function PremiereCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const venue = useVenue(play.venueId);

  return (
    <Pressable onPress={onPress} style={styles.railCard} accessibilityRole="button" accessibilityLabel={play.title}>
      <View style={{ aspectRatio: TILE_ASPECT }}>
        <PosterPlaceholder poster={play.poster} height="100%" radius={radius.md} preferThumb />
      </View>
      <Text variant="label" numberOfLines={2}>
        {play.title}
      </Text>
      <Text variant="caption" tone="faint" numberOfLines={2}>
        {venue?.name}
      </Text>
    </Pressable>
  );
}

function TrendingCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const venue = useVenue(play.venueId);
  const hasRatings = play.rating.count > 0;

  return (
    <Pressable onPress={onPress} style={{ gap: space.sm }} accessibilityRole="button" accessibilityLabel={play.title}>
      <View style={{ aspectRatio: TILE_ASPECT }}>
        <PosterPlaceholder poster={play.poster} height="100%" radius={radius.md} preferThumb />
        {/* Unrated plays used to show a gold "0.0" badge, which reads as a
            rock-bottom score rather than as "nobody has rated this yet". */}
        {hasRatings && (
          <View style={styles.ratingBadge}>
            <MaskIcon state="on" size={11} />
            <Text variant="caption" tone="accent">
              {play.rating.overall.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
      <Text variant="label" numberOfLines={2}>
        {play.title}
      </Text>
      <Text variant="caption" tone="faint" numberOfLines={2}>
        {venue?.name}
      </Text>
      <StatusBadge status={play.status} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: gutter,
    paddingBottom: space.lg,
    gap: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fab: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  chipRow: { gap: space.sm, paddingRight: gutter },
  scrollBody: { padding: gutter, paddingBottom: 100, gap: space.lg },
  rail: { gap: space.lg, paddingHorizontal: gutter },
  railCard: { width: 132, gap: space.sm },
  rowBetween: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  noResults: { alignItems: "center", gap: space.md, paddingVertical: space["3xl"] },
  ratingBadge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    backgroundColor: "rgba(9,4,3,0.78)",
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
});
