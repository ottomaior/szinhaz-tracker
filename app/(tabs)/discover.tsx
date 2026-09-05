import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, minTouchTarget, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import {
  getCities,
  getFilterGenres,
  getFilterVenues,
  getNowPlaying,
  getPremieres,
  getTrending,
  getVenueById,
  type BrowseSort,
} from "@/services/playsService";
import { searchPlays, type SortKey } from "@/services/searchService";
import type { Play, Venue, VenueType } from "@/data/types";
import { SearchIcon, PlusIcon, CloseIcon } from "@/components/icons/Icons";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PosterCardSkeleton, SkeletonRail } from "@/components/ui/Skeleton";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Screen } from "@/components/ui/Screen";
import { ProgramView } from "@/components/ui/ProgramView";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

const FILTERS = [strings.discover.filterAll, strings.discover.filterKoszinhaz, strings.discover.filterFuggetlen, strings.discover.filterSzabadteri];

/**
 * Whether to offer the venue-type chips.
 *
 * Off for now: all four sources currently in the catalogue are kőszínház, so
 * every chip but "Mind" returns an empty screen, which reads as a broken
 * filter rather than an honest "we have none of those yet". The filter itself
 * works and stays wired up end to end — `activeFilter` still feeds
 * `venueType` into every query — so turning this back on once there is a
 * független or szabadtéri source is a one-line change and nothing else.
 */
const SHOW_VENUE_TYPE_FILTER = false;

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

/**
 * Discover answers two different questions and now says which one it is on.
 *
 * "Felfedezés" is the browse rails: what is worth seeing, ranked. "Műsor" is
 * the calendar: pick an evening, see what is on that night across every
 * theatre in scope. The second was not reachable at all before — every query
 * in the app started from a production and asked when it played, never from a
 * date — even though the sync job has been collecting showtimes all along.
 *
 * A fifth bottom tab would have been the obvious home for it, and is why it is
 * here instead: components/ui/TabBar splits the routes around a raised centre
 * button, so an odd number of tabs puts three on one side and two on the other
 * and pulls the "+" off centre.
 */
type DiscoverMode = "browse" | "program";

/**
 * The sort options, and why there are two sets.
 *
 * "Relevancia" only means something when there is a query to be relevant to,
 * so it is offered in search results and nowhere else — an option that cannot
 * change what you are looking at is worse than no option. Everything else is
 * shared, and in browse mode applies to the "Népszerű" grid, the one rail
 * whose ordering is not already its subject.
 */
const SEARCH_SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: strings.sort.relevance },
  { key: "next", label: strings.sort.next },
  { key: "premiere", label: strings.sort.premiere },
  { key: "rating", label: strings.sort.rating },
  { key: "title", label: strings.sort.title },
];

const BROWSE_SORTS: { key: BrowseSort; label: string }[] = [
  { key: "rating", label: strings.sort.rating },
  { key: "next", label: strings.sort.next },
  { key: "premiere", label: strings.sort.premiere },
  { key: "title", label: strings.sort.title },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  const [mode, setMode] = useState<DiscoverMode>("browse");
  const [activeFilter, setActiveFilter] = useState(strings.discover.filterAll);
  const [cities, setCities] = useState<string[]>([]);
  const [activeCity, setActiveCity] = useState(strings.discover.filterAll);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activeVenueId, setActiveVenueId] = useState<string>();
  const [query, setQuery] = useState("");
  const [nowPlaying, setNowPlaying] = useState<Play[]>([]);
  const [premieres, setPremieres] = useState<Play[]>([]);
  const [trending, setTrending] = useState<Play[]>([]);
  const [searchResults, setSearchResults] = useState<Play[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const { recent, remember, clear: clearRecent } = useRecentSearches();
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseFailed, setBrowseFailed] = useState(false);
  const [showAllPremieres, setShowAllPremieres] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [activeGenre, setActiveGenre] = useState<string>();
  const [searchSort, setSearchSort] = useState<SortKey>("relevance");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("rating");

  const venueType = FILTER_TO_VENUE_TYPE[activeFilter];
  const city = activeCity === strings.discover.filterAll ? undefined : activeCity;
  const venueId = activeVenueId;
  const genre = activeGenre;
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  // Scoped to the selected city, so picking Debrecen offers Debrecen's
  // theatres rather than all of them.
  useEffect(() => {
    let active = true;
    getFilterVenues(city)
      .then((next) => {
        if (!active) return;
        setVenues(next);
        // A venue selected under the previous city is not in this list any
        // more; leaving it set would filter every rail down to nothing with
        // no visibly active chip to explain why.
        setActiveVenueId((current) => (current && next.some((v) => v.id === current) ? current : undefined));
      })
      .catch(() => {
        if (active) setVenues([]);
      });
    return () => {
      active = false;
    };
  }, [city]);

  // Scoped to city and venue for the same reason those are scoped to each
  // other: a chip whose only outcome is an empty screen reads as broken.
  useEffect(() => {
    let active = true;
    getFilterGenres({ venueType, city, venueId })
      .then((next) => {
        if (!active) return;
        setGenres(next);
        setActiveGenre((current) => (current && next.includes(current) ? current : undefined));
      })
      .catch(() => {
        if (active) setGenres([]);
      });
    return () => {
      active = false;
    };
  }, [venueType, city, venueId]);

  const loadBrowse = useCallback(async () => {
    setBrowseFailed(false);
    setBrowseLoading(true);
    try {
      const [nextNowPlaying, nextPremieres, nextTrending] = await Promise.all([
        getNowPlaying({ venueType, city, venueId, genre }),
        getPremieres({ venueType, city, venueId, genre }),
        getTrending({ venueType, city, venueId, genre }, browseSort),
      ]);
      setNowPlaying(nextNowPlaying);
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
  }, [venueType, city, venueId, genre, browseSort]);

  useEffect(() => {
    // Skipped in program mode: three rail queries whose results nothing
    // renders is a round trip per filter change for nothing.
    if (mode !== "browse") return;
    loadBrowse();
  }, [loadBrowse, mode]);

  // Collapse the expanded premiere list whenever the filters change, so the
  // "see all" toggle can never be left claiming to show a list it no longer has.
  useEffect(() => {
    setShowAllPremieres(false);
  }, [venueType, city, venueId, genre]);

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchPlays(query, { venueType, city, venueId, genre, sort: searchSort })
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, venueType, city, venueId, genre, searchSort, isSearching]);

  const hasBrowseContent = nowPlaying.length > 0 || premieres.length > 0 || trending.length > 0;
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              // Recorded on submit rather than on every keystroke, so the list
              // holds "Katona" and not "K", "Ka", "Kat".
              onSubmitEditing={() => remember(query)}
              returnKeyType="search"
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

          {/* Only while the field is focused and empty: once there is a query
              the results themselves are the better answer, and the row would
              otherwise sit above the rails permanently. */}
          {searchFocused && !isSearching && recent.length > 0 && (
            <View style={{ gap: space.xs }}>
              <View style={styles.rowBetween}>
                <Text variant="caption" tone="faint">{strings.discover.recentTitle}</Text>
                <Pressable onPress={clearRecent} hitSlop={8} accessibilityRole="button">
                  <Text variant="caption" tone="dim">{strings.discover.recentClear}</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {recent.map((term) => (
                  <Chip key={term} label={term} active={false} onPress={() => setQuery(term)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Hidden while searching: results are their own answer, and a mode
              switch above them would silently change what a query returns. */}
          {!isSearching && (
            <View style={styles.segmented}>
              {(
                [
                  ["browse", strings.program.modeBrowse],
                  ["program", strings.program.modeProgram],
                ] as [DiscoverMode, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setMode(value)}
                  style={[styles.segment, mode === value && styles.segmentActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === value }}
                  accessibilityLabel={label}
                >
                  <Text variant="label" tone={mode === value ? "default" : "faint"}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {SHOW_VENUE_TYPE_FILTER && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {FILTERS.map((f) => (
                <Chip key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(f)} />
              ))}
            </ScrollView>
          )}

          {cities.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {[strings.discover.filterAll, ...cities].map((c) => (
                <Chip key={c} label={c} active={activeCity === c} onPress={() => setActiveCity(c)} />
              ))}
            </ScrollView>
          )}

          {/* Which theatre, within whatever city is selected. Only shown when
              there is a choice to make: with one venue in scope the row is a
              single chip that cannot change the result, and Debrecen is
              exactly that today — Csokonai is the only Debrecen venue the
              adapters feed. It appears there by itself the moment a second one
              does. */}
          {/* Genre. Only worth offering now that it means something: until
              0016_genre_taxonomy.sql these values were adapter defaults —
              "próza" on 276 rows and "színház" on 167, neither of them read
              from any theatre's site — so the chips would have partitioned the
              catalogue by which scraper had written it. */}
          {genres.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip
                label={strings.discover.filterAll}
                active={!activeGenre}
                onPress={() => setActiveGenre(undefined)}
              />
              {genres.map((g) => (
                <Chip
                  key={g}
                  label={strings.genres[g] ?? g}
                  active={activeGenre === g}
                  onPress={() => setActiveGenre(activeGenre === g ? undefined : g)}
                />
              ))}
            </ScrollView>
          )}

          {venues.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip
                label={strings.discover.filterAll}
                active={!activeVenueId}
                onPress={() => setActiveVenueId(undefined)}
              />
              {venues.map((v) => (
                <Chip
                  key={v.id}
                  label={v.name}
                  active={activeVenueId === v.id}
                  onPress={() => setActiveVenueId(activeVenueId === v.id ? undefined : v.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {mode !== "program" && (
          <View style={styles.sortBar}>
            <Text variant="caption" tone="faint">
              {strings.sort.label}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {isSearching
                ? SEARCH_SORTS.map((s) => (
                    <Chip key={s.key} label={s.label} active={searchSort === s.key} onPress={() => setSearchSort(s.key)} />
                  ))
                : BROWSE_SORTS.map((s) => (
                    <Chip key={s.key} label={s.label} active={browseSort === s.key} onPress={() => setBrowseSort(s.key)} />
                  ))}
            </ScrollView>
          </View>
        )}

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
                  <TrendingCard
                    key={p.id}
                    play={p}
                    // Opening a result is the signal that this search was worth
                    // keeping. Pressing Enter is not: on web the results appear
                    // as you type, so most searches never submit at all.
                    onPress={() => {
                      remember(query);
                      router.push(`/play/${p.id}`);
                    }}
                  />
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
        ) : mode === "program" ? (
          <ProgramView filters={{ venueType, city, venueId, genre }} />
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

            {/* First rail, and the one the screen is really for: what is on
                in the next few days, soonest first. */}
            {!browseLoading && nowPlaying.length > 0 && (
              <View style={{ gap: space.md }}>
                <View style={{ paddingHorizontal: gutter }}>
                  <Text variant="subheading">{strings.discover.nowPlayingTitle}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {nowPlaying.map((p) => (
                    <PremiereCard key={p.id} play={p} onPress={() => router.push(`/play/${p.id}`)} />
                  ))}
                </ScrollView>
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
                  {/* The heading follows the sort. "Népszerű" is a claim about
                      ratings; leaving it up while the grid is ordered by
                      premiere date would describe the wrong list. */}
                  {browseSort !== "rating"
                    ? strings.discover.allPlaysTitle
                    : city
                      ? strings.discover.trendingTitleInCity(city)
                      : strings.discover.trendingTitle}
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
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height="100%" radius={radius.md} preferThumb />
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
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height="100%" radius={radius.md} preferThumb />
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
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: space.sm, borderRadius: radius.sm },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingLeft: gutter,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  segmentActive: { backgroundColor: colors.surface2 },
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
