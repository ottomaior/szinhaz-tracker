import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useAtLeast } from "@/hooks/useBreakpoint";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCities,
  getFilterGenres,
  getFilterVenues,
  getPremieres,
  getTrending,
  getUpcomingProgram,
  getPlaysByIds,
  getVenueById,
  type BrowseSort,
} from "@/services/playsService";
import { getLists, type ListSummary } from "@/services/listsService";
import { getFriendsRecentPlays } from "@/services/friendsService";
import { searchPlays, type SortKey } from "@/services/searchService";
import { searchPeople, type PersonSearchResult } from "@/services/peopleService";
import type { Play, ProgramEntry, Venue, VenueType } from "@/data/types";
import { SearchIcon, CloseIcon } from "@/components/icons/Icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SelectChip, type SelectOption } from "@/components/ui/SelectChip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListCard } from "@/components/ui/ListCard";
import { ListsBody } from "@/components/ui/ListsBody";
import { PosterCardSkeleton, Skeleton, SkeletonRail } from "@/components/ui/Skeleton";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ProgramRow, ProgramRowSkeleton, programKind } from "@/components/ui/ProgramRow";
import { Screen, ContentColumn } from "@/components/ui/Screen";
import { ProgramView } from "@/components/ui/ProgramView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { personInitials } from "@/utils/people";
import { budapestDayKey, formatRuntimeMinutes, formatTime, formatWeekday, todayInBudapest } from "@/utils/datetime";
import { makeStyles } from "@/theme/styles";

const FILTERS = [strings.discover.filterAll, strings.discover.filterKoszinhaz, strings.discover.filterFuggetlen, strings.discover.filterSzabadteri];

/**
 * How many editorial lists Discover shows before sending people to the full
 * tab. Three is a shelf; ten is a second Listák screen with no way out.
 */
const FEATURED_LIST_LIMIT = 3;

/** How many of the productions your follows have been to the rail carries. */
const FRIENDS_RAIL_LIMIT = 10;

/**
 * How many evenings the lead section carries: one as the hero, the rest as a
 * programme. Seven is about a week of a two-city catalogue.
 */
const UPCOMING_LIMIT = 7;

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
 * Discover answers three questions and says which one it is on.
 *
 * "Felfedezés" is the browse screen: what is on next, what is worth seeing.
 * "Műsor" is the calendar: pick an evening, see what is on that night across
 * every theatre in scope. "Listák" is the editorial shelf and the reader's own
 * lists. They used to be a segmented switch and a modal; as tabs under the
 * title they are places a reader can go rather than modes a screen can be in.
 *
 * A fifth bottom tab would have been the obvious home for the calendar, and
 * is why it is here instead: components/ui/TabBar splits the routes around a
 * raised centre button, so an odd number of tabs puts three on one side and
 * two on the other and pulls the "+" off centre.
 */
type DiscoverMode = "browse" | "program" | "lists";

const MODES: { key: DiscoverMode; label: string }[] = [
  { key: "browse", label: strings.program.modeBrowse },
  { key: "program", label: strings.program.modeProgram },
  { key: "lists", label: strings.lists.headerTitle },
];

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
  { key: "title", label: strings.sort.title },
];

const BROWSE_SORTS: { key: BrowseSort; label: string }[] = [
  { key: "premiere", label: strings.sort.premiere },
  { key: "next", label: strings.sort.next },
  { key: "title", label: strings.sort.title },
];

export default function DiscoverScreen() {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  // From 900pt the lead goes two-column: the hero beside the programme rather
  // than above it, so a desktop window is not a phone column with margins.
  const wide = useAtLeast("expanded");
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [premieres, setPremieres] = useState<Play[]>([]);
  const [trending, setTrending] = useState<Play[]>([]);
  const [searchResults, setSearchResults] = useState<Play[]>([]);
  const [searchPeopleResults, setSearchPeopleResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const { recent, remember, clear: clearRecent } = useRecentSearches();
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseFailed, setBrowseFailed] = useState(false);
  const [showAllPremieres, setShowAllPremieres] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [activeGenre, setActiveGenre] = useState<string>();
  const [searchSort, setSearchSort] = useState<SortKey>("relevance");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("premiere");
  // Off by default: the rails answer "what can I go and see", and 731 closed
  // Budapest productions mixed into that would bury the 232 that are on. It is
  // a control rather than a constant because the archive is the larger half of
  // this catalogue and is kept precisely so it stays findable.
  const [includeArchived, setIncludeArchived] = useState(false);
  const [trendingTotal, setTrendingTotal] = useState(0);
  const [trendingPage, setTrendingPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [featuredLists, setFeaturedLists] = useState<ListSummary[]>([]);
  const [listCovers, setListCovers] = useState<Map<string, Play>>(new Map());
  const [friendsSeen, setFriendsSeen] = useState<{ play: Play; friends: number }[]>([]);
  const [upcoming, setUpcoming] = useState<ProgramEntry[]>([]);

  // Built here rather than inline so each list is one object per render and
  // the "Mind" entry is written once instead of at four call sites.
  const cityOptions: SelectOption[] = [
    { value: undefined, label: strings.discover.cityAll },
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

  // Re-read when the scope changes, like the other two option lists: a chip
  // list narrower than the grid it filters cannot reach half of what is on
  // screen. Debrecen has theatres with nothing currently on and 166 archived
  // productions between them.
  useEffect(() => {
    getCities(includeArchived)
      .then(setCities)
      .catch(() => setCities([]));
  }, [includeArchived]);

  /**
   * The editorial lists, fetched once and never refetched per filter.
   *
   * A brand-new account's Discover is otherwise led by "Népszerű", a grid
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

  /**
   * The next few evenings — the screen's lead.
   *
   * Scoped to the city and nothing else. The genre and venue chips narrow the
   * grid below, but this section answers "what is on near me soon", and a
   * timeline silently filtered to opera would answer a narrower question
   * than the heading above it asks.
   *
   * Browse only: in Műsor mode the calendar is a better answer to the same
   * question, and running both would be two queries to say one thing twice.
   */
  useEffect(() => {
    if (mode !== "browse") return;
    let active = true;
    getUpcomingProgram({ city }, { limit: UPCOMING_LIMIT })
      .then(({ entries }) => {
        if (!active) return;
        setUpcoming(entries);
      })
      .catch(() => {
        if (!active) return;
        setUpcoming([]);
      });
    return () => {
      active = false;
    };
  }, [city, mode]);

  // Scoped to the selected city, so picking Debrecen offers Debrecen's
  // theatres rather than all of them.
  useEffect(() => {
    let active = true;
    getFilterVenues(city, includeArchived)
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
  }, [city, includeArchived]);

  // Scoped to city and venue for the same reason those are scoped to each
  // other: a chip whose only outcome is an empty screen reads as broken.
  useEffect(() => {
    let active = true;
    getFilterGenres({ venueType, city, venueId, includeArchived })
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
  }, [venueType, city, venueId, includeArchived]);

  const loadBrowse = useCallback(async () => {
    setBrowseFailed(false);
    setBrowseLoading(true);
    try {
      const scoped = { venueType, city, venueId, genre, includeArchived };
      const [nextPremieres, firstPage] = await Promise.all([
        // Current-only whatever the scope says: an archived production has no
        // premiere ahead of it. Passing the flag would widen it to nothing.
        getPremieres({ venueType, city, venueId, genre }),
        getTrending(scoped, browseSort, 0),
      ]);
      setPremieres(nextPremieres);
      setTrending(firstPage.plays);
      setTrendingTotal(firstPage.total);
      setTrendingPage(0);
    } catch {
      // Previously both promises rejected unhandled and the screen stayed
      // blank with no indication that anything had gone wrong.
      setBrowseFailed(true);
      setPremieres([]);
      setTrending([]);
      setTrendingTotal(0);
    } finally {
      setBrowseLoading(false);
    }
  }, [venueType, city, venueId, genre, browseSort, includeArchived]);

  /**
   * The next page of the grid, appended.
   *
   * An explicit control rather than infinite scroll: the grid is the last
   * section of a screen that also carries three rails, and a list that grows
   * as you reach the end of it makes the bottom of the page unreachable —
   * including the empty state and the "add a play" way out that live below it.
   */
  const loadMoreTrending = useCallback(async () => {
    if (loadingMore) return;
    const nextPage = trendingPage + 1;
    setLoadingMore(true);
    try {
      const { plays } = await getTrending(
        { venueType, city, venueId, genre, includeArchived },
        browseSort,
        nextPage
      );
      // Appended by id rather than concatenated blindly: a filter change that
      // lands while a page is in flight would otherwise splice two different
      // result sets together.
      setTrending((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...plays.filter((p) => !seen.has(p.id))];
      });
      setTrendingPage(nextPage);
    } catch {
      // Silent: the rows already on screen are still correct, and an error
      // banner for a page that did not arrive is louder than the problem.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, trendingPage, venueType, city, venueId, genre, includeArchived, browseSort]);

  useEffect(() => {
    // Skipped off the browse tab: rail queries whose results nothing renders
    // are a round trip per filter change for nothing.
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

  /**
   * The same term, asked of the catalogue's people.
   *
   * Its own effect, keyed on the query alone, because the chips and the sort
   * key describe productions: a person has no premiere date to sort by and is
   * not in one city, so re-running this when the sort changes would be a round
   * trip that cannot change its own answer.
   *
   * Nor do the filters narrow it. Somebody who has typed a name is asking about
   * a person, and hiding her because the genre chip says "opera" would answer a
   * question about her work with a claim about her.
   */
  useEffect(() => {
    if (!isSearching) {
      setSearchPeopleResults([]);
      return;
    }
    const handle = setTimeout(() => {
      searchPeople(query)
        .then(setSearchPeopleResults)
        // A failed people query leaves the productions to answer alone, which
        // is what this screen did before there was a people query at all.
        .catch(() => setSearchPeopleResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, isSearching]);

  const hasBrowseContent = upcoming.length > 0 || premieres.length > 0 || trending.length > 0;
  // Editorial lists are written about the whole catalogue and cannot answer a
  // city or genre filter, so the section steps aside once one is on rather
  // than sitting there ignoring it.
  const browseFiltered = !!(venueType || city || venueId || genre);
  const archivedCount = searchResults.filter((p) => p.isArchived || p.status === "ended").length;

  const openPlay = (id: string) => router.push(`/play/${id}`);

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
  }

  /**
   * The facet chips, and why they scroll.
   *
   * Everything above the rails used to be pinned: search field, a boxed mode
   * switch, this row and the city header, which on a 375pt phone cost around
   * 440pt — more than half the viewport — before a single poster. Now the
   * pinned bar is the title and the tabs; the chips are the first thing in the
   * scroll, so they are there when the reader arrives and gone when they are
   * reading. Facets with nothing to choose between are left out entirely.
   */
  const chipRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {SHOW_VENUE_TYPE_FILTER && (
        <SelectChip
          name={strings.discover.filterVenueType}
          value={activeFilter === strings.discover.filterAll ? undefined : activeFilter}
          options={venueTypeOptions}
          onChange={(next) => setActiveFilter(next ?? strings.discover.filterAll)}
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

      {/* What the grid is a list *of*. Not a filter — it widens rather than
          narrows — but it belongs in this row because it is the same kind of
          decision, and because putting it anywhere else would hide the answer
          to "where is everything else". Browse only: search has covered the
          archive from the start. */}
      {mode === "browse" && !isSearching && (
        <SelectChip
          name={strings.discover.scopeLabel}
          title={strings.discover.scopeLabel}
          value={includeArchived ? "all" : undefined}
          defaultValue={undefined}
          options={[
            { value: undefined, label: strings.discover.scopeCurrent },
            { value: "all", label: strings.discover.scopeAll },
          ]}
          onChange={(next) => setIncludeArchived(next === "all")}
        />
      )}

      {/* Sorting sits in the same row rather than on a bar of its own. Not
          offered in the calendar, where the ordering is the date. */}
      {mode !== "program" && (
        <SelectChip
          name={strings.sort.label}
          title={strings.sort.label}
          value={isSearching ? searchSort : browseSort}
          // Highlighted only once it has been moved off its default, so the
          // gold on this row always means "changed".
          defaultValue={isSearching ? "relevance" : "premiere"}
          options={isSearching ? searchSortOptions : browseSortOptions}
          onChange={(next) => {
            if (isSearching) setSearchSort((next as SortKey) ?? "relevance");
            else setBrowseSort((next as BrowseSort) ?? "premiere");
          }}
        />
      )}
    </ScrollView>
  );

  const hero = upcoming[0];
  const programme = upcoming.slice(1);

  /**
   * The lead: the next evening as a hero, and the evenings after it as a
   * programme. Two columns from 900pt, stacked below.
   */
  const lead = hero && (
    <View style={wide ? styles.leadWide : undefined}>
      <TonightHero entry={hero} onPress={() => openPlay(hero.playId)} tall={wide} />
      {programme.length > 0 && (
        <View style={wide ? styles.leadSide : styles.leadStacked}>
          <SectionHeader
            eyebrow={strings.discover.upcomingEyebrow}
            title={strings.discover.upcomingTitle}
            action={strings.discover.upcomingAction}
            onAction={() => setMode("program")}
          />
          <View style={{ marginTop: space.xs }}>
            {programme.map((entry) => (
              <ProgramRow key={entry.performanceId} entry={entry} onPress={() => openPlay(entry.playId)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          {searchOpen ? (
            <View style={styles.searchBar}>
              <SearchIcon />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                // Recorded on submit rather than on every keystroke, so the
                // list holds "Katona" and not "K", "Ka", "Kat".
                onSubmitEditing={() => remember(query)}
                returnKeyType="search"
                placeholder={strings.discover.searchPlaceholder}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={strings.discover.searchLabel}
                style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }}
              />
              {/* One control closes the search whether or not there is a
                  query: backspacing out of a term on a phone is tedious, and a
                  field with nothing in it has no other way back. */}
              <Pressable onPress={closeSearch} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.discover.searchClose}>
                <CloseIcon size={16} color={colors.textDim} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.titleRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="display">{strings.discover.title}</Text>
                {/* The city decides what the whole screen is about, so it is
                    printed under the title like a season under a theatre's
                    name, not offered as one chip among the facets. */}
                {mode !== "lists" && (
                  <SelectChip
                    variant="header"
                    name={strings.discover.filterCity}
                    value={city}
                    subtitle={venues.length > 0 ? strings.discover.venueCount(venues.length) : undefined}
                    options={cityOptions}
                    onChange={(next) => setActiveCity(next ?? strings.discover.filterAll)}
                  />
                )}
              </View>
              <IconButton onPress={() => setSearchOpen(true)} accessibilityLabel={strings.discover.searchOpen}>
                <SearchIcon size={18} color={colors.text} />
              </IconButton>
            </View>
          )}

          {/* Only while the field is focused and empty: once there is a query
              the results themselves are the better answer, and the row would
              otherwise sit above the rails permanently. */}
          {searchOpen && searchFocused && !isSearching && recent.length > 0 && (
            <View style={{ gap: space.xs, paddingTop: space.sm }}>
              <View style={styles.rowBetween}>
                <Text variant="eyebrow" tone="faint">{strings.discover.recentTitle}</Text>
                <Pressable onPress={clearRecent} hitSlop={8} accessibilityRole="button">
                  <Text variant="caption" tone="dim">{strings.discover.recentClear}</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {recent.map((term) => (
                  <Chip key={term} label={term} active={false} onPress={() => setQuery(term)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Hidden while searching: results are their own answer, and a tab
              row above them would silently change what a query returns. */}
          {!isSearching && (
            <View style={styles.tabs} accessibilityRole="tablist">
              {MODES.map(({ key, label }) => {
                const active = mode === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setMode(key)}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityRole="tab"
                    aria-selected={active}
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                  >
                    <Text variant="label" tone={active ? "default" : "faint"}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {isSearching ? (
          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {chipRow}
            <ContentColumn width="content" style={{ paddingHorizontal: gutter, gap: space.xl }}>
              {/* The people first, and above the count that heads the grid.
                  Typing a performer's name used to return the eleven
                  productions she is in and never her. Held back while the
                  productions are still loading: the two queries share a
                  debounce, and a list of people from the previous keystroke
                  sitting above a grid of skeletons would be answering a
                  question that has already been retyped. */}
              {!searching && searchPeopleResults.length > 0 && (
                <View style={{ gap: space.sm }}>
                  <SectionHeader eyebrow={strings.discover.searchOpen} title={strings.discover.peopleResultsTitle} />
                  {searchPeopleResults.map((person) => (
                    <PersonResultRow
                      key={person.slug}
                      person={person}
                      onPress={() => {
                        remember(query);
                        router.push(`/person/${person.slug}`);
                      }}
                    />
                  ))}
                </View>
              )}
              <View style={{ gap: space.md }}>
                <SectionHeader
                  eyebrow={strings.discover.searchOpen}
                  title={searching ? strings.discover.searching : strings.discover.searchResultsTitle(searchResults.length)}
                  // Search covers the theatres' archives as well as what is
                  // on now — that is the point, since the app is for logging
                  // plays you have already seen — but a run of "ended" badges
                  // reads as a bug unless the list says so first.
                  action={!searching && archivedCount > 0 ? strings.discover.includesArchived(archivedCount) : undefined}
                />
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
                        // Opening a result is the signal that this search was
                        // worth keeping. Pressing Enter is not: on web the
                        // results appear as you type, so most searches never
                        // submit at all.
                        onPress={() => {
                          remember(query);
                          openPlay(p.id);
                        }}
                      />
                    ))}
                  </Grid>
                )}
              </View>
              {/* "Nothing found — add it yourself" would be a lie under a list
                  of people the search did find, and the invitation it carries
                  is to create a duplicate production. */}
              {!searching && searchResults.length === 0 && searchPeopleResults.length === 0 && (
                <EmptyState
                  eyebrow={strings.discover.searchOpen}
                  title={strings.discover.noResultsTitle}
                  actionLabel={strings.discover.noResultsAction}
                  onAction={() => router.push("/add-play")}
                />
              )}
            </ContentColumn>
          </ScrollView>
        ) : mode === "program" ? (
          <ProgramView filters={{ venueType, city, venueId, genre }} header={chipRow} />
        ) : mode === "lists" ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
            <ContentColumn width="content" style={{ padding: gutter }}>
              <ListsBody />
            </ContentColumn>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollBody}>
            {chipRow}

            {browseLoading && (
              <View style={{ gap: space["2xl"], paddingHorizontal: gutter }}>
                <View style={{ aspectRatio: wide ? 16 / 7 : HERO_ASPECT }}>
                  <Skeleton width="100%" height="100%" radius={radius.lg} />
                </View>
                <View>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ProgramRowSkeleton key={i} />
                  ))}
                </View>
                <Grid>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PosterCardSkeleton key={i} />
                  ))}
                </Grid>
              </View>
            )}

            {!browseLoading && (
              <View style={{ gap: space["3xl"] }}>
                {!!lead && <View style={{ paddingHorizontal: gutter }}>{lead}</View>}

                {/* Above the editorial lists, and only for an account that
                    follows somebody: a handful of people you chose beats
                    anything written for everybody, and unlike the lists it is
                    different for every reader. */}
                {!browseFiltered && friendsSeen.length > 0 && (
                  <View style={{ gap: space.md }}>
                    <SectionHeader
                      style={{ paddingHorizontal: gutter }}
                      eyebrow={strings.feed.scopeFollowing}
                      title={strings.friends.discoverHeading}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                      {friendsSeen.map(({ play }) => (
                        <PremiereCard key={play.id} play={play} onPress={() => openPlay(play.id)} />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Above "Népszerű" on purpose. What is on tonight is a fact
                    and stays first; after that, three hand-made lists are a
                    better thing to put in front of a new account than a grid
                    ranked by an average over five reviews. */}
                {!browseFiltered && featuredLists.length > 0 && (
                  <View style={{ gap: space.sm, paddingHorizontal: gutter }}>
                    <SectionHeader
                      eyebrow={strings.discover.featuredEyebrow}
                      title={strings.lists.headerTitle}
                      action={strings.discover.seeAll}
                      onAction={() => setMode("lists")}
                    />
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

                {premieres.length > 0 && (
                  <View style={{ gap: space.md }}>
                    <SectionHeader
                      style={{ paddingHorizontal: gutter }}
                      eyebrow={strings.discover.premieresEyebrow}
                      title={strings.discover.premieresTitle}
                      action={showAllPremieres ? strings.discover.seeLess : strings.discover.seeAll}
                      onAction={() => setShowAllPremieres((s) => !s)}
                    />
                    {showAllPremieres ? (
                      <Grid style={{ paddingHorizontal: gutter }}>
                        {premieres.map((p) => (
                          <TrendingCard key={p.id} play={p} onPress={() => openPlay(p.id)} />
                        ))}
                      </Grid>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                        {premieres.map((p) => (
                          <PremiereCard key={p.id} play={p} onPress={() => openPlay(p.id)} />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {trending.length > 0 && (
                  <View style={{ gap: space.md, paddingHorizontal: gutter }}>
                    <SectionHeader
                      // The heading used to swing between "Népszerű" and a
                      // neutral title depending on the sort, because
                      // "Népszerű" was a claim about the public average and
                      // describing a list ordered by premiere date that way
                      // would have been describing the wrong list. The average
                      // is gone and so is the claim; all that is left for the
                      // heading to carry is the scope.
                      eyebrow={
                        includeArchived
                          ? strings.discover.trendingEyebrowArchive
                          : strings.discover.trendingEyebrowSorted
                      }
                      title={city ? city : strings.discover.allPlaysTitle}
                      // How many there are, not how many fit. The grid used
                      // to stop at forty with nothing saying whether that was
                      // the answer or the limit.
                      action={strings.discover.showingCount(trending.length, trendingTotal)}
                    />
                    <Grid>
                      {trending.map((p) => (
                        <TrendingCard key={p.id} play={p} onPress={() => openPlay(p.id)} />
                      ))}
                    </Grid>
                    {trending.length < trendingTotal && (
                      <Button
                        variant="outline"
                        label={loadingMore ? strings.discover.loadingMore : strings.discover.loadMore}
                        disabled={loadingMore}
                        onPress={loadMoreTrending}
                        style={styles.loadMore}
                      />
                    )}
                    {/* The rare favour a reader does the catalogue: a
                        production the sync has not found. It used to be a
                        floating "+" in the header, where it competed with the
                        one action the app is built around. */}
                    <Button
                      variant="text"
                      label={strings.discover.addPlayFab}
                      onPress={() => router.push("/add-play")}
                      style={{ alignSelf: "center" }}
                    />
                  </View>
                )}

                {!hasBrowseContent && (
                  <EmptyState
                    eyebrow={strings.discover.title}
                    title={browseFailed ? strings.common.loadError : strings.discover.emptyTitle}
                    body={browseFailed ? undefined : strings.discover.emptyBody}
                    actionLabel={browseFailed ? strings.common.retry : strings.discover.addPlayFab}
                    onAction={browseFailed ? loadBrowse : () => router.push("/add-play")}
                  />
                )}
              </View>
            )}
          </ScrollView>
        )}
      </Screen>
    </View>
  );
}

/**
 * The hero's proportions on a phone: a touch taller than square, so a
 * landscape production still fills the frame and a portrait poster is not
 * beheaded, with room under the scrim for three lines and a button.
 */
const HERO_ASPECT = 4 / 4.6;

/**
 * The next evening, as the thing the screen is for.
 *
 * "What is on tonight" used to be a 132pt thumbnail in a rail. Here it is the
 * lead: the full poster with the title, the curtain time and the theatre set
 * on it, and the one filled gold button on the screen. Everything on the
 * image takes its colour from `overlay` rather than from the palette — the
 * scrim under it is the stage in every theme.
 */
function TonightHero({ entry, onPress, tall }: { entry: ProgramEntry; onPress: () => void; tall: boolean }) {
  const styles = useStyles();

  const isToday = budapestDayKey(entry.startsAt) === todayInBudapest();
  // The house's own line where there is one, the genre bucket otherwise — the
  // same rule as the rows below, so the hero cannot call an evening `Próza`
  // that the row under it calls `énekkari próba`.
  const credits = [
    entry.director ? strings.discover.heroDirected(entry.director) : undefined,
    programKind(entry),
    entry.runtimeMinutes != null ? formatRuntimeMinutes(entry.runtimeMinutes) : undefined,
  ].filter(Boolean);

  // The image is the pressable and the button sits beside it in the tree, not
  // inside it: a Pressable within a Pressable renders as a <button> inside a
  // <button> on the web, which the DOM forbids.
  return (
    <View style={[styles.hero, tall ? styles.heroTall : { aspectRatio: HERO_ASPECT }]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={entry.title} style={StyleSheet.absoluteFill}>
        <PosterPlaceholder poster={entry.poster} title={entry.title} seed={entry.playId} height="100%" radius={0} scrim priority="high" />
      </Pressable>
      <View style={[styles.heroBadge, { pointerEvents: "none" }]}>
        <Text variant="eyebrow" style={{ color: overlay.onImageAccent }}>
          {isToday ? strings.discover.heroTonight : strings.discover.heroNext(formatWeekday(entry.startsAt))}
        </Text>
      </View>
      <View style={[styles.heroCaption, { pointerEvents: "box-none" }]}>
        <Text variant="eyebrow" style={{ color: overlay.onImageAccent }}>
          {formatTime(entry.startsAt)} · {entry.venueName}
        </Text>
        <Text variant="display" numberOfLines={2} style={{ color: overlay.onImageHeading }}>
          {entry.title}
        </Text>
        {credits.length > 0 && (
          <Text variant="bodySmall" numberOfLines={2} style={{ color: overlay.onImageText }}>
            {credits.join(" · ")}
          </Text>
        )}
        <View style={styles.heroActions}>
          <Button label={strings.discover.heroOpen} onPress={onPress} style={styles.heroButton} />
        </View>
      </View>
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
  const styles = useStyles();

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

/**
 * One production in a grid: the poster and two lines, nothing on the artwork.
 *
 * The rating used to be a black pill over the image and every tile wore a
 * status badge, so forty tiles carried eighty pieces of chrome over the one
 * thing worth looking at. It moved to the end of the venue line, and then off
 * the tile altogether with the rest of the public average. What is left is the
 * venue and a status that appears only when it is news — see StatusBadge's
 * `inline`.
 */
function TrendingCard({ play, onPress }: { play: Play; onPress: () => void }) {
  const venue = useVenue(play.venueId);

  return (
    <Pressable onPress={onPress} style={{ gap: space.sm }} accessibilityRole="button" accessibilityLabel={play.title}>
      <View style={{ aspectRatio: TILE_ASPECT }}>
        <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height="100%" radius={radius.md} preferThumb />
      </View>
      <View style={{ gap: 3 }}>
        <Text variant="label" numberOfLines={2}>
          {play.title}
        </Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {venue?.name}
        </Text>
        <StatusBadge status={play.status} inline />
      </View>
    </Pressable>
  );
}

/**
 * One person in the search results.
 *
 * A row rather than a tile, and deliberately unlike the poster grid below it:
 * these two lists answer the same term with different kinds of thing, and a
 * person rendered as a poster-shaped card would read as a production.
 *
 * The line under the name is what tells two people with the same surname apart
 * before either page is open — how much work the catalogue holds for them,
 * where, and over what span.
 */
function PersonResultRow({ person, onPress }: { person: PersonSearchResult; onPress: () => void }) {
  const styles = useStyles();

  const parts = [strings.discover.personCredits(person.creditCount)];
  if (person.directedCount > 0) parts.push(strings.discover.personDirected(person.directedCount));
  if (person.venueCount > 0) parts.push(strings.person.venueCount(person.venueCount));
  // Absent for somebody all of whose productions are undated, and collapsed to
  // one year when the first and last coincide — "2025–2025" looks like a bug.
  if (person.firstYear && person.lastYear) {
    parts.push(
      person.firstYear === person.lastYear ? `${person.firstYear}` : `${person.firstYear}–${person.lastYear}`
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={styles.personRow}
      accessibilityRole="button"
      accessibilityLabel={person.displayName}
    >
      <Avatar initials={personInitials(person.displayName)} size={44} serif />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{person.displayName}</Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {parts.join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: {
    paddingHorizontal: gutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: minTouchTarget,
  },
  tabs: { flexDirection: "row", gap: space["2xl"], marginTop: space.sm },
  tab: { paddingVertical: space.md - 2, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.gold },
  chipRow: { gap: space.sm, paddingHorizontal: gutter, paddingVertical: space.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scrollBody: { paddingBottom: 100 },

  // `flex-start`, not `stretch`: the programme beside the hero is six rows
  // tall, and a hero stretched to match became a portrait twice the height of
  // the poster it was showing.
  leadWide: { flexDirection: "row", gap: space["2xl"], alignItems: "flex-start" },
  leadSide: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  leadStacked: { marginTop: space["2xl"] },

  hero: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    width: "100%",
  },
  heroTall: { flex: 1.35, aspectRatio: 1.15, alignSelf: "flex-start" },
  heroBadge: {
    position: "absolute",
    top: space.lg,
    left: space.lg,
    backgroundColor: overlay.onImage,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  heroCaption: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    gap: 6,
  },
  heroActions: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.sm },
  heroButton: { paddingVertical: 10, paddingHorizontal: space.lg, borderRadius: radius.md },

  rail: { gap: space.lg, paddingHorizontal: gutter },
  railCard: { width: 132, gap: space.sm },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  loadMore: { alignSelf: "center", minWidth: 220 },
}));
