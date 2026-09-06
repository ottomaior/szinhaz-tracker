import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, minTouchTarget, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCities,
  getFilterGenres,
  getFilterVenues,
  getNowPlaying,
  getPremieres,
  getTrending,
  getPlaysByIds,
  getVenueById,
  type BrowseSort,
} from "@/services/playsService";
import { getLists, type ListSummary } from "@/services/listsService";
import { getFriendsRecentPlays } from "@/services/friendsService";
import { searchPlays, type SortKey } from "@/services/searchService";
import type { Play, Venue, VenueType } from "@/data/types";
import { SearchIcon, PlusIcon, CloseIcon } from "@/components/icons/Icons";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { SelectChip, type SelectOption } from "@/components/ui/SelectChip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListCard } from "@/components/ui/ListCard";
import { PosterCardSkeleton, SkeletonRail } from "@/components/ui/Skeleton";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Screen } from "@/components/ui/Screen";
import { ProgramView } from "@/components/ui/ProgramView";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

const FILTERS = [strings.discover.filterAll, strings.discover.filterKoszinhaz, strings.discover.filterFuggetlen, strings.discover.filterSzabadteri];

/**
 * How many editorial lists Discover shows before sending people to the full
 * screen. Three is a shelf; ten is a second Listák screen with no way out.
 */
const FEATURED_LIST_LIMIT = 3;

/** How many of the productions your follows have been to the rail carries. */
const FRIENDS_RAIL_LIMIT = 10;

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
  // Set when something else in the app means "show me this theatre" — today
  // that is a followed venue on the watchlist, which has no page of its own to
  // open. Applied once, in an effect below, so the chip stays the user's to
  // change afterwards rather than being reasserted on every render.
  const { venueId: venueIdParam } = useLocalSearchParams<{ venueId?: string }>();
  const { session } = useAuth();
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
  const [featuredLists, setFeaturedLists] = useState<ListSummary[]>([]);
  const [listCovers, setListCovers] = useState<Map<string, Play>>(new Map());
  const [friendsSeen, setFriendsSeen] = useState<{ play: Play; friends: number }[]>([]);

  // Built here rather than inline so each list is one object per render and
  // the "Mind" entry is written once instead of at four call sites.
  const cityOptions: SelectOption[] = [
    { value: undefined, label: strings.discover.filterAll },
    ...cities.map((c) => ({ value: c, label: c })),
  ];
  const genreOptions: SelectOption[] = [
    { value: undefined, label: strings.discover.filterAll },
    ...genres.map((g) => ({ value: g, label: strings.genres[g] ?? g })),
  ];
  const venueOptions: SelectOption[] = [
    { value: undefined, label: strings.discover.filterAll },
    ...venues.map((v) => ({ value: v.id, label: v.name })),
  ];
  const venueTypeOptions: SelectOption[] = FILTERS.filter((f) => f !== strings.discover.filterAll).map((f) => ({
    value: f,
    label: f,
  }));
  venueTypeOptions.unshift({ value: undefined, label: strings.discover.filterAll });
  // Sorting always has a value, so no "Mind" entry: there is no unsorted list.
  const searchSortOptions: SelectOption[] = SEARCH_SORTS.map((o) => ({ value: o.key, label: o.label }));
  const browseSortOptions: SelectOption[] = BROWSE_SORTS.map((o) => ({ value: o.key, label: o.label }));

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

  /**
   * The editorial lists, fetched once and never refetched per filter.
   *
   * This is the half of 0025 that had not reached the screen it was written
   * for. A brand-new account's Discover is otherwise led by "Népszerű", a grid
   * ordered by an average over five reviews across 1,214 productions — not a
   * popularity signal, and no amount of waiting makes it one. A hand-made list
   * is worth reading on day one.
   *
   * Deliberately outside the filter effects: a list is a piece of writing about
   * the catalogue, not a query over it, so narrowing to Debrecen cannot narrow
   * it — which is also why the section hides itself entirely once a filter is
   * on rather than showing results that ignore it.
   */
  useEffect(() => {
    let active = true;
    getLists({ featuredOnly: true })
      .then(async (lists) => {
        if (!active) return;
        const top = lists.slice(0, FEATURED_LIST_LIMIT);
        setFeaturedLists(top);
        // One lookup for every cover on the rail, the way the lists screen
        // does it — not four requests per card.
        const plays = await getPlaysByIds([...new Set(top.flatMap((l) => l.coverPlayIds))]);
        if (active) setListCovers(new Map(plays.map((p) => [p.id, p])));
      })
      .catch(() => {
        if (active) setFeaturedLists([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // A theatre named in the route. Applied when the venue list has loaded and
  // actually contains it — setting an id the chip list cannot show would filter
  // every rail to nothing with no visible chip explaining why, which is the
  // failure the city-change reconciliation below already guards against.
  useEffect(() => {
    if (!venueIdParam) return;
    if (!venues.some((v) => v.id === venueIdParam)) return;
    setActiveVenueId(venueIdParam);
    setMode("browse");
  }, [venueIdParam, venues]);

  /**
   * What the people this account follows have been to lately.
   *
   * Deliberately "have been to" rather than "rated highest": a rail titled with
   * a superlative over four reviews is the same empty claim as the popularity
   * average it sits beside, while "they went to this" is a fact and is true
   * from the first entry.
   *
   * Fetched once per session rather than per filter, and hidden entirely when
   * empty — which is most accounts, most of the time. An empty "your friends"
   * rail is a reminder that you have none, which is not what Discover is for.
   */
  useEffect(() => {
    if (!session) {
      setFriendsSeen([]);
      return;
    }
    let active = true;
    getFriendsRecentPlays(FRIENDS_RAIL_LIMIT)
      .then(async (rows) => {
        if (!active || rows.length === 0) {
          if (active) setFriendsSeen([]);
          return;
        }
        const plays = await getPlaysByIds(rows.map((r) => r.playId));
        const byId = new Map(plays.map((p) => [p.id, p]));
        if (!active) return;
        setFriendsSeen(
          rows
            .map((r) => {
              const play = byId.get(r.playId);
              return play ? { play, friends: r.friends } : undefined;
            })
            .filter((x): x is { play: Play; friends: number } => !!x)
        );
      })
      .catch(() => {
        if (active) setFriendsSeen([]);
      });
    return () => {
      active = false;
    };
  }, [session]);

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
  // Editorial lists are written about the whole catalogue and cannot answer a
  // city or genre filter, so the section steps aside once one is on rather
  // than sitting there ignoring it.
  const browseFiltered = !!(venueType || city || venueId || genre);
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

          {/*
            One row of value-carrying chips, replacing four rows of options.
            Each opens a sheet; each shows what it is currently set to.

            Those four rows pushed the first result to 401px on a 375x812
            phone — half the screen was controls, and the Musor calendar showed
            exactly one performance above the fold.

            Chips still carry their value rather than collapsing behind a
            single "Filters" button: this screen already hides a filter row
            instead of showing one that returns nothing, and renames the
            "Nepszeru" heading when the sort stops matching it. A screen
            quietly filtered to Debrecen and opera, looking unfiltered, would
            be the same mistake in a new place.

            Facets with nothing to choose between are left out entirely, which
            is the rule the rows already followed.
          */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SHOW_VENUE_TYPE_FILTER && (
              <SelectChip
                name={strings.discover.filterVenueType}
                value={activeFilter === strings.discover.filterAll ? undefined : activeFilter}
                options={venueTypeOptions}
                onChange={(next) => setActiveFilter(next ?? strings.discover.filterAll)}
              />
            )}

            {cities.length > 1 && (
              <SelectChip
                name={strings.discover.filterCity}
                value={activeCity === strings.discover.filterAll ? undefined : activeCity}
                options={cityOptions}
                onChange={(next) => setActiveCity(next ?? strings.discover.filterAll)}
              />
            )}

            {genres.length > 1 && (
              <SelectChip
                name={strings.discover.filterGenre}
                value={activeGenre}
                options={genreOptions}
                onChange={setActiveGenre}
              />
            )}

            {venues.length > 1 && (
              <SelectChip
                name={strings.discover.filterVenue}
                value={activeVenueId}
                options={venueOptions}
                onChange={setActiveVenueId}
              />
            )}

            {/* Sorting sits in the same row rather than on a bar of its own.
                Not offered in the calendar, where the ordering is the date. */}
            {mode !== "program" && (
              <SelectChip
                name={strings.sort.label}
                title={strings.sort.label}
                value={isSearching ? searchSort : browseSort}
                // Highlighted only once it has been moved off its default, so
                // the gold on this row always means "changed".
                defaultValue={isSearching ? "relevance" : "rating"}
                options={isSearching ? searchSortOptions : browseSortOptions}
                onChange={(next) => {
                  if (isSearching) setSearchSort((next as SortKey) ?? "relevance");
                  else setBrowseSort((next as BrowseSort) ?? "rating");
                }}
              />
            )}
          </ScrollView>
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

            {/* Above the editorial lists, and only for an account that follows
                somebody: a handful of people you chose beats anything written
                for everybody, and unlike the lists it is different for every
                reader. */}
            {!browseLoading && !browseFiltered && friendsSeen.length > 0 && (
              <View style={{ gap: space.md }}>
                <View style={{ paddingHorizontal: gutter }}>
                  <Text variant="subheading">{strings.friends.discoverHeading}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {friendsSeen.map(({ play }) => (
                    <PremiereCard key={play.id} play={play} onPress={() => router.push(`/play/${play.id}`)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Above "Népszerű" on purpose. What is on tonight is a fact and
                stays first; after that, three hand-made lists are a better
                thing to put in front of a new account than a grid ranked by an
                average over five reviews. */}
            {!browseLoading && !browseFiltered && featuredLists.length > 0 && (
              <View style={{ gap: space.md, paddingHorizontal: gutter }}>
                <View style={styles.rowBetween}>
                  <Text variant="subheading">{strings.discover.featuredListsTitle}</Text>
                  <Pressable onPress={() => router.push("/lists")} hitSlop={8} accessibilityRole="button">
                    <Text variant="label" tone="accent">{strings.discover.seeAll}</Text>
                  </Pressable>
                </View>
                {featuredLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    playsById={listCovers}
                    onPress={() => router.push({ pathname: "/list/[id]", params: { id: list.id } })}
                  />
                ))}
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
