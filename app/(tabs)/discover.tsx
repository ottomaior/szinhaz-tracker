import { useCallback, useEffect, useState, useRef } from "react";
import { View, ScrollView, StyleSheet, Pressable, useWindowDimensions, type ViewStyle } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bar, control, gutter, radius, space, thumb } from "@/theme/tokens";
import { useAtLeast } from "@/hooks/useBreakpoint";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { useAuth } from "@/contexts/AuthContext";
import { getFirstRunStatus } from "@/services/profileService";
import {
  getCities,
  getFilterGenres,
  getFilterVenues,
  getPremieres,
  getProgramForDay,
  getTrending,
  getUpcomingProgram,
  getPlaysByIds,
  getVenueById,
  type BrowseSort,
} from "@/services/playsService";
import { getLists, type ListSummary } from "@/services/listsService";
import { getFriendsRecentPlays } from "@/services/friendsService";
import { searchPlays, type SearchPage, type SortKey } from "@/services/searchService";
import { getPortraits, searchPeople, type PersonSearchResult } from "@/services/peopleService";
import type { Play, Portrait, ProgramEntry, Venue, VenueType } from "@/data/types";
import { PersonRow } from "@/components/ui/Rows";
import { PosterTile } from "@/components/ui/PosterTile";
import { OverlayPill } from "@/components/ui/Badges";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SelectChip, type SelectOption } from "@/components/ui/SelectChip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListCard } from "@/components/ui/ListCard";
import { ListsBody } from "@/components/ui/ListsBody";
import { PosterCardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { HERO_MIN_ASPECT, PosterPlaceholder, posterAspect } from "@/components/ui/PosterPlaceholder";
import { ProgramRow, ProgramRowSkeleton, programKind } from "@/components/ui/ProgramRow";
import { Screen, ContentColumn } from "@/components/ui/Screen";
import { ProgramView } from "@/components/ui/ProgramView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Grid } from "@/components/ui/Grid";
import { SearchField } from "@/components/ui/SearchField";
import { Text } from "@/components/ui/Text";
import { PillTabs } from "@/components/ui/PillTabs";
import { useDockInset } from "@/components/ui/TabBar";
import { PressCard } from "@/components/motion/PressCard";
import { AnimatedList } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";
import { strings } from "@/i18n/hu";
import { personInitials } from "@/utils/people";
import { foldSearchTerm } from "@/utils/search";
import { budapestDayKey, daypart, formatRuntimeMinutes, formatTime, formatWeekday, todayInBudapest } from "@/utils/datetime";
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

/**
 * Whether to offer the genre chip.
 *
 * Off between 13 and 18 September (T-077): on the redesigned Discover the
 * chip appeared to do nothing, because the lead above the grid ignored it —
 * see the upcoming-evenings effect below. Back on now that everything under
 * the chip row answers it. Kept as a flag, like the venue-type chip above,
 * because the last time it had to go it went in one line.
 */
const SHOW_GENRE_FILTER = true;

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
  const { height: windowHeight } = useWindowDimensions();
  /**
   * How much room the lead has, measured rather than guessed: the pinned
   * header's height is whatever the title, the city, the search and the tabs
   * come to, and that differs with the palette's type and the reader's
   * system font. What is left after it, the facet row and the dock is what
   * the hero may take — see `TonightHero`, which fits its poster and its
   * caption inside it.
   */
  const [headerHeight, setHeaderHeight] = useState(0);
  const dockInset = useDockInset();
  const router = useRouter();
  // From 900pt the lead goes two-column: the hero beside the programme rather
  // than above it, so a desktop window is not a phone column with margins.
  const wide = useAtLeast("expanded");
  // Set when something else in the app means "show me this theatre" — today
  // that is a followed venue on the watchlist, which has no page of its own to
  // open. Applied once, in an effect below, so the chip stays the user's to
  // change afterwards rather than being reasserted on every render.
  const { venueId: venueIdParam, q: queryParam } = useLocalSearchParams<{ venueId?: string; q?: string }>();
  const { session } = useAuth();
  const [mode, setMode] = useState<DiscoverMode>("browse");
  const [activeFilter, setActiveFilter] = useState(strings.discover.filterAll);
  const [cities, setCities] = useState<string[]>([]);
  const [activeCity, setActiveCity] = useState(strings.discover.filterAll);
  /**
   * The city on the profile, applied once when both it and the option list
   * are known, and only while the chip still says "Mind" (the first run
   * writes `profiles.city` for exactly this). After that the chip is the
   * reader's: a preference that reasserted itself on every render would be a
   * filter nobody could change.
   */
  const seededCity = useRef(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activeVenueId, setActiveVenueId] = useState<string>();
  const [query, setQuery] = useState("");
  const [premieres, setPremieres] = useState<Play[]>([]);
  const [trending, setTrending] = useState<Play[]>([]);
  const [peoplePortraits, setPeoplePortraits] = useState<Map<string, Portrait>>(new Map());
  const [searchFocused, setSearchFocused] = useState(false);
  // Pages after the first, appended by "Továbbiak betöltése", remembered
  // together with the question they answer: a page for a term that has since
  // been retyped is simply not shown, with no reset and no stale-guard needed.
  const [morePages, setMorePages] = useState<{ key: string | null; plays: Play[] }>({ key: null, plays: [] });
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);
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
  // Every curtain going up on the lead's evening, for the poster rail. Keyed
  // by the day it answers for, so a rail fetched for Friday is never shown
  // under a hero that has moved to Saturday.
  const [curtains, setCurtains] = useState<{ day: string; entries: ProgramEntry[] }>({ day: "", entries: [] });

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
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  // Re-read when the scope changes, like the other two option lists: a chip
  // list narrower than the grid it filters cannot reach half of what is on
  // screen. Debrecen has theatres with nothing currently on and 166 archived
  // productions between them.
  useEffect(() => {
    if (!session || seededCity.current || cities.length === 0) return;
    let cancelled = false;
    getFirstRunStatus()
      .then((status) => {
        if (cancelled || seededCity.current) return;
        seededCity.current = true;
        const home = status?.city;
        if (home && cities.includes(home)) {
          setActiveCity((current) => (current === strings.discover.filterAll ? home : current));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session, cities]);

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
   * A search typed in the top bar, which is where a wide screen's search
   * lives: the bar hands the term over and this screen answers it. Applied
   * when the parameter changes rather than on every render, so the field
   * stays the reader's to edit afterwards.
   */
  useEffect(() => {
    if (queryParam === undefined) return;
    setQuery(queryParam);
  }, [queryParam]);

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
   * Scoped to every chip, not only the city. It used to ignore the genre and
   * venue chips on the argument that "what is on near me soon" is a wider
   * question than the grid's — and the result was T-077: the chip sits
   * directly above this section, says "Műfaj: Musical", and the hero and
   * the evenings under it carry on showing prose, because the part of the
   * screen the chip does narrow starts a viewport further down. A visible
   * filter that the visible content ignores reads as broken, whatever the
   * reasoning. So everything under the chip row now answers the chips, and
   * the heading means the next evenings *of what you asked for*.
   *
   * Browse only: in Műsor mode the calendar is a better answer to the same
   * question, and running both would be two queries to say one thing twice.
   */
  useEffect(() => {
    if (mode !== "browse") return;
    let active = true;
    getUpcomingProgram({ city, venueId, genre }, { limit: UPCOMING_LIMIT })
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
  }, [city, venueId, genre, mode]);

  /**
   * The rest of that evening. Tonight when anything is on tonight, otherwise
   * the evening the hero has moved to — the rail and the hero must agree on
   * which night they are talking about, and on which chips they answer.
   */
  const heroDay = upcoming[0] ? budapestDayKey(upcoming[0].startsAt) : undefined;
  useEffect(() => {
    if (mode !== "browse" || !heroDay) return;
    let active = true;
    getProgramForDay(heroDay, { city, venueId, genre })
      .then((entries) => {
        if (active) setCurtains({ day: heroDay, entries });
      })
      .catch(() => {
        if (active) setCurtains({ day: heroDay, entries: [] });
      });
    return () => {
      active = false;
    };
  }, [heroDay, city, venueId, genre, mode]);

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

  /**
   * The productions the term finds — one page, with the totals.
   *
   * The key is the folded term plus everything that changes the answer, so a
   * retyped accent or a moved chip is a new question and a repeated one is
   * served from the hook's cache. `useSearchQuery` keeps the last page on
   * screen while the next is on its way and ignores answers that arrive out of
   * order, which is what the old pair of `setTimeout` effects did not.
   */
  const searchKey = isSearching
    ? [foldSearchTerm(trimmedQuery), venueType ?? "", city ?? "", venueId ?? "", genre ?? "", searchSort].join("\u001f")
    : null;
  const playSearch = useSearchQuery<SearchPage>(searchKey, () =>
    searchPlays(trimmedQuery, { venueType, city, venueId, genre, sort: searchSort })
  );

  /**
   * The same term, asked of the catalogue's people.
   *
   * Keyed on the query alone, because the chips and the sort key describe
   * productions: a person has no premiere date to sort by and is not in one
   * city, so re-running this when the sort changes would be a round trip that
   * cannot change its own answer.
   *
   * Nor do the filters narrow it. Somebody who has typed a name is asking about
   * a person, and hiding her because the genre chip says "opera" would answer a
   * question about her work with a claim about her.
   */
  const peopleSearch = useSearchQuery<PersonSearchResult[]>(isSearching ? foldSearchTerm(trimmedQuery) : null, () =>
    searchPeople(trimmedQuery)
  );

  // The faces arrive a beat after the names; a row without one is the
  // ordinary case, so nothing waits for this. Keyed on the slugs rather than
  // the array, because the hook hands the same rows back from its cache as a
  // fresh array.
  const peopleResults = peopleSearch.data ?? [];
  const peopleSlugs = peopleResults.map((r) => r.slug).join(",");
  useEffect(() => {
    if (!peopleSlugs) return;
    let active = true;
    getPortraits(peopleSlugs.split(","))
      .then((portraits) => {
        if (active) setPeoplePortraits(portraits);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [peopleSlugs]);

  const searchPage = playSearch.data;
  const moreSearchPlays = morePages.key === searchKey ? morePages.plays : [];
  const shownSearchPlays = searchPage ? [...searchPage.plays, ...moreSearchPlays] : [];
  const canLoadMoreSearch = !!searchPage && shownSearchPlays.length < searchPage.total;

  const loadMoreSearch = useCallback(async () => {
    if (!searchPage || loadingMoreSearch) return;
    const keyAtStart = searchKey;
    setLoadingMoreSearch(true);
    try {
      const next = await searchPlays(trimmedQuery, {
        venueType,
        city,
        venueId,
        genre,
        sort: searchSort,
        offset: shownSearchPlays.length,
      });
      setMorePages((cur) => ({
        key: keyAtStart,
        plays: [...(cur.key === keyAtStart ? cur.plays : []), ...next.plays],
      }));
    } catch {
      // Silent, as the browse rail's "load more" is: what is on screen is
      // still correct.
    } finally {
      setLoadingMoreSearch(false);
    }
  }, [searchPage, loadingMoreSearch, searchKey, trimmedQuery, venueType, city, venueId, genre, searchSort, shownSearchPlays.length]);

  const hasBrowseContent = upcoming.length > 0 || premieres.length > 0 || trending.length > 0;
  // Editorial lists are written about the whole catalogue and cannot answer a
  // city or genre filter, so the section steps aside once one is on rather
  // than sitting there ignoring it.
  const browseFiltered = !!(venueType || city || venueId || genre);

  const openPlay = (id: string) => router.push(`/play/${id}`);

  /**
   * The facet chips, and why they scroll.
   *
   * Everything above the rails used to be pinned: search field, a boxed mode
   * switch, this row and the city header, which on a 375pt phone cost around
   * 440pt — more than half the viewport — before a single poster. Now the
   * pinned bar is the title, the search field and the tabs; the chips are the
   * first thing in the scroll, so they are there when the reader arrives and
   * gone when they are reading. Facets with nothing to choose between are left
   * out entirely.
   *
   * The field earns its 50pt of pinned height: it is the one control on this
   * screen that answers a question the rails cannot, and hiding it behind a
   * magnifier made it a feature people had to know about.
   */
  const chips = (
    <>
      {SHOW_VENUE_TYPE_FILTER && (
        <SelectChip
          name={strings.discover.filterVenueType}
          value={activeFilter === strings.discover.filterAll ? undefined : activeFilter}
          options={venueTypeOptions}
          onChange={(next) => setActiveFilter(next ?? strings.discover.filterAll)}
        />
      )}

      {SHOW_GENRE_FILTER && genres.length > 1 && (
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
    </>
  );
  // On a phone the facets scroll off the edge; on a wide screen there is
  // room for all of them, and a row that scrolls at 1100pt hides two chips
  // for no reason.
  const chipRow = wide ? (
    <View style={[styles.chipRow, styles.chipWrap]}>{chips}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {chips}
    </ScrollView>
  );

  // The facet row is a chip and its padding; the dock only covers the page
  // on a phone. A floor keeps the hero a picture rather than a strip on a
  // very short window.
  const leadHeight = Math.max(
    MIN_LEAD_HEIGHT,
    windowHeight -
      // The top bar is part of the window but not of this screen's layout.
      (wide ? bar : 0) -
      headerHeight -
      (control.sm + space.md * 2) -
      (wide ? space["4xl"] : dockInset) -
      space.xl
  );

  const hero = upcoming[0];
  const programme = upcoming.slice(1);
  // Only for the day the hero is on; a stale answer for another day is dropped.
  const curtainsTonight = hero && curtains.day === heroDay ? curtains.entries : [];

  /**
   * The lead: the next evening as a hero, and the evenings after it as a
   * programme. Two columns from 900pt, stacked below.
   */
  const lead = hero && (
    <View style={wide ? styles.leadWide : undefined}>
      {/* Every curtain that evening, not just the first (T-125). `key` per
          evening so a change of day or of chips starts the rotation over
          rather than resuming at whatever slide the last evening reached. */}
      <TonightHero
        key={heroDay}
        entries={curtainsTonight.length ? curtainsTonight : [hero]}
        onOpen={openPlay}
        available={leadHeight}
        tall={wide}
      />
      {programme.length > 0 && (
        <View style={wide ? styles.leadSide : styles.leadStacked}>
          <SectionHeader
            eyebrow={strings.discover.upcomingEyebrow}
            title={strings.discover.upcomingTitle}
            action={strings.discover.upcomingAction}
            onAction={() => setMode("program")}
          />
          <AnimatedList style={{ marginTop: space.xs }} stagger={55} initialDelay={120}>
            {programme.map((entry) => (
              <ProgramRow key={entry.performanceId} entry={entry} onPress={() => openPlay(entry.playId)} />
            ))}
          </AnimatedList>
        </View>
      )}
    </View>
  );

  /* Always on screen rather than behind a magnifier: the field is the
     one control here that answers a question the rails cannot, and a
     search you have to discover is a search half the readers never make.
     Typing takes the screen over; the cross gives it back. */
  const search = (
    <SearchField
      value={query}
      onChangeText={setQuery}
      prominent
      // A newer answer is on its way and the grid below is the older
      // one. The spinner says so without emptying it.
      loading={isSearching && (playSearch.loading || peopleSearch.loading)}
      placeholder={strings.discover.searchPlaceholder}
      accessibilityLabel={strings.discover.searchLabel}
      onFocusChange={setSearchFocused}
      // Recorded on submit rather than on every keystroke, so the
      // list holds "Katona" and not "K", "Ka", "Kat".
      onSubmit={() => remember(query)}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View
          style={[styles.header, { paddingTop: insets.top + space.md }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          {/* On a phone the title, the city and the search stack; from the
              `expanded` breakpoint the search sits beside the title, so the
              pinned header is two rows across 1100pt rather than four. */}
          <View style={[styles.titleRow, wide && styles.titleRowWide]}>
            <View style={{ flex: 1, gap: space.sm }}>
              <SplitText text={strings.discover.title} />
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
          </View>

          {/* On a wide screen the top bar carries the search — it is the
              app's chrome, it is where a desktop reader looks for it, and it
              works from every screen rather than from this one only. */}
          {!wide && <View style={styles.searchRow}>{search}</View>}

          {/* Only while the field is focused and empty: once there is a query
              the results themselves are the better answer, and the row would
              otherwise sit above the rails permanently. */}
          {searchFocused && !isSearching && recent.length > 0 && (
            <View style={{ gap: space.xs, paddingTop: space.sm }}>
              <View style={styles.rowBetween}>
                <Text variant="eyebrow" tone="faint">{strings.discover.recentTitle}</Text>
                <Pressable onPress={clearRecent} hitSlop={space.sm} accessibilityRole="button">
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
            <PillTabs<DiscoverMode> tabs={MODES} value={mode} onChange={setMode} style={styles.tabs} />
          )}
        </View>

        {isSearching ? (
          <ScrollView contentContainerStyle={[styles.scrollBody, { paddingBottom: dockInset }]} keyboardShouldPersistTaps="handled">
            {chipRow}
            <ContentColumn width="content" style={{ paddingHorizontal: gutter, gap: space.xl }}>
              {/* The people first, and above the count that heads the grid.
                  Typing a performer's name used to return the eleven
                  productions she is in and never her. Held back while the
                  productions are still loading: the two queries share a
                  debounce, and a list of people from the previous keystroke
                  sitting above a grid of skeletons would be answering a
                  question that has already been retyped. */}
              {peopleResults.length > 0 && (
                <View style={{ gap: space.sm }}>
                  <SectionHeader eyebrow={strings.discover.searchOpen} title={strings.discover.peopleResultsTitle} />
                  {peopleResults.map((person) => (
                    <PersonResultRow
                      key={person.slug}
                      person={person}
                      portrait={peoplePortraits.get(person.slug)}
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
                  title={searchPage ? strings.discover.searchResultsTitle(searchPage.total) : strings.discover.searching}
                  // Search covers the theatres' archives as well as what is
                  // on now — that is the point, since the app is for logging
                  // plays you have already seen — but a run of "ended" badges
                  // reads as a bug unless the list says so first.
                  action={searchPage && searchPage.archived > 0 ? strings.discover.includesArchived(searchPage.archived) : undefined}
                />
                {/* Skeletons only before the first answer. After that the
                    grid stays put while a newer answer loads — the field's
                    spinner carries the "still working" — so typing a letter
                    no longer wipes the posters and rebuilds them. */}
                {!searchPage ? (
                  <Grid>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <PosterCardSkeleton key={i} />
                    ))}
                  </Grid>
                ) : (
                  <Grid>
                    {shownSearchPlays.map((p) => (
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
                {/* The rest of the match, a page at a time — the same control
                    the "Népszerű" grid uses, for the same reason: forty tiles
                    is a screenful, 296 is a scroll nobody finishes. */}
                {canLoadMoreSearch && (
                  <Button
                    variant="outline"
                    label={loadingMoreSearch ? strings.discover.loadingMore : strings.discover.loadMore}
                    disabled={loadingMoreSearch}
                    onPress={loadMoreSearch}
                    style={styles.loadMore}
                  />
                )}
              </View>
              {/* "Nothing found — add it yourself" would be a lie under a list
                  of people the search did find, and the invitation it carries
                  is to create a duplicate production. Only once both answers
                  are in: an empty state flashed while they load is a "no" the
                  screen then takes back. */}
              {searchPage && searchPage.total === 0 && !peopleSearch.loading && peopleResults.length === 0 && (
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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollBody, { paddingBottom: dockInset }]}>
            <ContentColumn width="content" style={{ padding: gutter }}>
              <ListsBody />
            </ContentColumn>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.scrollBody, { paddingBottom: dockInset }]}>
            {chipRow}

            {browseLoading && (
              <View style={{ gap: space["2xl"], paddingHorizontal: gutter }}>
                <View style={{ aspectRatio: HERO_ASPECT }}>
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

/** What the caption is assumed to cost before it has been measured once. */
const CAPTION_FALLBACK = 180;

/**
 * The lead's column on a wide screen: wide enough for the credit line to sit
 * on one line under the picture, narrow enough that a poster shortened to fit
 * the window does not leave much ground beside it.
 */
const HERO_COLUMN_WIDTH = 400;

/** Below these the lead stops being a picture and becomes a strip. */
const MIN_LEAD_HEIGHT = 320;
const MIN_POSTER_HEIGHT = 160;

/** The dots and their counter, which the poster has to make room for. */
const DOTS_ROW_HEIGHT = 28;

/**
 * Scroll snapping, said in CSS for the web.
 *
 * Cast because these are not React Native style properties — they are passed
 * straight through to the browser, and native simply has no use for them
 * since `pagingEnabled` already works there.
 */
const WEB_SNAP_STRIP = { scrollSnapType: "x mandatory" } as unknown as ViewStyle;
const WEB_SNAP_ITEM = { scrollSnapAlign: "start" } as unknown as ViewStyle;

/** How still the strip has to be before it is nudged onto a poster. */
const SETTLE_MS = 180;

/** How long a scroll we started ourselves may still be arriving. */
const OUR_MOVE_MS = 900;

/** How long each curtain holds the lead before the next one slides in. */
const ROTATE_EVERY_MS = 10_000;

/**
 * The evening, as the thing the screen is for.
 *
 * "What is on tonight" used to be a 132pt thumbnail in a rail, then a single
 * poster as the lead. A single poster was the wrong promise: the badge says
 * MA ESTE and there are usually six or seven curtains that night, so the one
 * the app happened to pick read as the only one (T-125). It is now all of
 * them — swipeable, and rotating on its own every ten seconds so the rest
 * are not a secret kept behind a gesture nobody knows to make.
 *
 * Under the poster rather than on it, and that is the point. A poster carries
 * its own title, set by the house in the house's own lettering, and the app
 * printing the same words over them made every hero read twice. The picture
 * is left to say what it was drawn to say; the app says the things a picture
 * cannot — when it starts and where.
 *
 * Three things the rotation has to get right:
 *
 *  - **The frame cannot move.** `posterAspect` clamps to between 4:5 and 4:3,
 *    which is a two-thirds difference in height between a portrait poster and
 *    a wide banner; resizing the lead every ten seconds would shove the whole
 *    screen up and down. So an evening of several takes one frame and each
 *    poster is shown whole inside it, over a blurred copy of itself. A single
 *    curtain keeps its own proportions, since nothing is going to follow it.
 *  - **It stops when touched.** A swipe means somebody is reading rather than
 *    watching, and nothing should pull the poster out from under them. The
 *    timer does not come back until the screen does.
 *  - **It never runs unseen.** Not while the tab is in the background, and
 *    not at all for a reader who has asked for less motion — for them the
 *    dots and the swipe are the whole feature, which is what they should be
 *    anyway.
 */
function TonightHero({
  entries,
  onOpen,
  available,
  tall,
}: {
  entries: ProgramEntry[];
  onOpen: (playId: string) => void;
  /** The height the whole lead has to live in — the poster takes what the caption leaves. */
  available: number;
  tall: boolean;
}) {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();

  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  // The index is held twice on purpose: the state draws the dots and the
  // caption, the ref is what the interval reads, so the timer does not have
  // to be torn down and rebuilt on every slide.
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  // Until when the strip is moving because *we* moved it. Neither
  // `onScrollBeginDrag` nor `onTouchStart` fires for a mouse drag on the web,
  // so "has the reader taken over" is answered by the scroll itself — and the
  // only way to tell their movement from ours is to know when ours was.
  const ourMoveUntil = useRef(0);
  // Fires once the strip has been still for a moment, to finish a flick that
  // stopped between two posters.
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(settle.current), []);

  useFocusEffect(
    useCallback(() => {
      setOnScreen(true);
      return () => setOnScreen(false);
    }, [])
  );

  const many = entries.length > 1;
  const entry = entries[Math.min(index, entries.length - 1)];

  // Grows but never shrinks: some titles wrap to two lines and some do not,
  // and a caption that changed height per slide would move the poster above
  // it just as surely as a changing frame would.
  const [captionHeight, setCaptionHeight] = useState(CAPTION_FALLBACK);
  const posterHeight = Math.max(
    MIN_POSTER_HEIGHT,
    available - captionHeight - space.md - (many ? DOTS_ROW_HEIGHT : 0)
  );
  /**
   * The frame an evening of several shares.
   *
   * Driven by the column's width rather than by a ratio: deriving the width
   * from a portrait ratio gave a narrow frame in the middle of a wide column,
   * which letterboxed every banner into a thin strip and cut the badge off.
   * So the frame fills the column and takes the height that is going spare,
   * capped at 5:4 so it cannot become a tower on a tall window. A single
   * curtain keeps its poster's own proportions, since nothing follows it.
   */
  const frameStyle = many
    ? { width: "100%" as const, height: width ? Math.min(posterHeight, width / HERO_MIN_ASPECT) : posterHeight }
    : { aspectRatio: posterAspect(entry.poster, HERO_ASPECT), height: posterHeight };

  /**
   * Keep the strip on the slide the caption is describing when the column
   * changes width — a rotated phone, a resized window, the two-column
   * layout arriving. The offset is a number of pixels, so it means a
   * different slide the moment the slide is a different size, and the poster
   * ends up belonging to a title further down.
   */
  useEffect(() => {
    if (!width) return;
    scroller.current?.scrollTo({ x: indexRef.current * width, animated: false });
  }, [width]);

  useEffect(() => {
    if (!many || stopped || reducedMotion || !onScreen || !width) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % entries.length;
      indexRef.current = next;
      setIndex(next);
      // Sliding to the next one is the point; sliding *back* over six posters
      // to reach the first again is a rewind nobody asked to watch, and the
      // caption changes the moment the index does, so the long way round
      // shows the wrong poster under the right title for most of a second.
      // The wrap is a cut.
      ourMoveUntil.current = Date.now() + OUR_MOVE_MS;
      scroller.current?.scrollTo({ x: next * width, animated: next !== 0 });
    }, ROTATE_EVERY_MS);
    return () => clearInterval(timer);
  }, [many, stopped, reducedMotion, onScreen, width, entries.length]);

  // The house's own line where there is one, the genre bucket otherwise — the
  // same rule as the rows below, so the hero cannot call an evening `Proza`
  // that the row under it calls `enekkari proba`.
  const credits = [
    entry.director ? strings.discover.heroDirected(entry.director) : undefined,
    programKind(entry),
    entry.runtimeMinutes != null ? formatRuntimeMinutes(entry.runtimeMinutes) : undefined,
  ].filter(Boolean);

  // A `useCallback` rather than a plain function: the lint rule cannot tell a
  // helper declared in the body from one called during render, and this one
  // reads the clock.
  const goTo = useCallback(
    (i: number) => {
      setStopped(true);
      indexRef.current = i;
      setIndex(i);
      ourMoveUntil.current = Date.now() + OUR_MOVE_MS;
      scroller.current?.scrollTo({ x: i * width, animated: true });
    },
    [width]
  );

  return (
    <View style={tall ? styles.heroTall : undefined}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        // `onScrollBeginDrag` is the native answer to "somebody has taken
        // over", and on the web it does not fire for a mouse drag. A touch
        // start does, for both a finger and a mouse, so the two together
        // cover every way in.
        onTouchStart={() => setStopped(true)}
      >
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          scrollEnabled={many}
          showsHorizontalScrollIndicator={false}
          // `pagingEnabled` alone leaves `scroll-snap-type: none` in this
          // version of react-native-web, so a flick rests between two
          // posters. These say it in CSS, which native ignores.
          style={WEB_SNAP_STRIP}
          decelerationRate="fast"
          snapToInterval={width || undefined}
          snapToAlignment="start"
          onScrollBeginDrag={() => setStopped(true)}
          // Momentum events are not dependable on the web either, so where
          // the strip has come to rest is read from the scroll itself. Only
          // a change of slide is written down, so this is not a re-render a
          // frame.
          scrollEventThrottle={64}
          onScroll={(e) => {
            if (!width) return;
            const x = e.nativeEvent.contentOffset.x;
            // Movement away from where this slide sits, at a moment we did
            // not cause, is the reader scrolling. The tolerance keeps a
            // layout-time event at rest from counting as a gesture.
            if (Math.abs(x - indexRef.current * width) > 4 && Date.now() > ourMoveUntil.current) setStopped(true);
            const landed = Math.max(0, Math.min(entries.length - 1, Math.round(x / width)));

            /**
             * Come to rest on a poster, not between two.
             *
             * `pagingEnabled` and CSS scroll snapping both claim to do this
             * and neither could be relied on here \u2014 the strip was left
             * sitting 69px into a slide, showing two half posters. So once
             * the scrolling has stopped, whatever stopped it, the nearest
             * poster is scrolled to. When the strip is already on a boundary,
             * which is where every move of ours lands, this does nothing.
             */
            clearTimeout(settle.current);
            settle.current = setTimeout(() => {
              const target = landed * width;
              if (Math.abs(x - target) <= 1) return;
              ourMoveUntil.current = Date.now() + OUR_MOVE_MS;
              scroller.current?.scrollTo({ x: target, animated: true });
            }, SETTLE_MS);

            if (landed === indexRef.current) return;
            indexRef.current = landed;
            setIndex(landed);
          }}
        >
          {entries.map((curtain) => (
            <View key={curtain.performanceId} style={[{ width: width || undefined }, WEB_SNAP_ITEM]}>
              {/* The frame is one shape for the whole evening, so the page
                  below it never moves; the poster is shown whole inside it. */}
              <PressCard
                onPress={() => onOpen(curtain.playId)}
                accessibilityRole="button"
                accessibilityLabel={curtain.title}
                style={[styles.poster, tall ? styles.posterWide : styles.posterPhone, frameStyle]}
                surfaceStyle={{ flex: 1 }}
                radius={radius.lg}
                tilt={4}
              >
                <PosterPlaceholder
                  poster={curtain.poster}
                  title={curtain.title}
                  seed={curtain.playId}
                  height="100%"
                  radius={0}
                  priority="high"
                  contentFit="contain"
                  backdrop
                />
                {/* On the picture rather than beside it: the frame is narrower
                    than the column, and a pill floating on the ground would
                    belong to nothing. */}
                <OverlayPill style={styles.heroBadge}>
                  {budapestDayKey(curtain.startsAt) === todayInBudapest()
                    ? strings.discover.heroToday(daypart(curtain.startsAt))
                    : strings.discover.heroNext(formatWeekday(curtain.startsAt))}
                </OverlayPill>
              </PressCard>
            </View>
          ))}
        </ScrollView>
      </View>

      {many && (
        <View style={styles.dotsRow}>
          {entries.map((curtain, i) => (
            <Pressable
              key={curtain.performanceId}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={strings.discover.curtainAt(formatTime(curtain.startsAt), curtain.title)}
              accessibilityState={{ selected: i === index }}
              style={styles.dotTarget}
            >
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
          <Text variant="caption" tone="faint" style={styles.dotsCount}>
            {index + 1}/{entries.length}
          </Text>
        </View>
      )}

      <View
        style={styles.heroCaption}
        onLayout={(e) => setCaptionHeight((tallest) => Math.max(tallest, e.nativeEvent.layout.height))}
      >
        <Text variant="eyebrow" numberOfLines={1}>
          {formatTime(entry.startsAt)} · {entry.venueName}
        </Text>
        <Text variant="title" numberOfLines={2}>
          {entry.title}
        </Text>
        {credits.length > 0 && (
          <Text variant="bodySmall" tone="dim" numberOfLines={1}>
            {credits.join(" · ")}
          </Text>
        )}
        <Button label={strings.discover.heroOpen} onPress={() => onOpen(entry.playId)} style={styles.heroButton} />
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
  const venue = useVenue(play.venueId);
  return <PosterTile poster={play.poster} title={play.title} seed={play.id} width={thumb.tile.width} onPress={onPress} meta={venue?.name} />;
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
    <PosterTile
      poster={play.poster}
      title={play.title}
      seed={play.id}
      onPress={onPress}
      meta={
        <>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {venue?.name}
          </Text>
          <StatusBadge status={play.status} inline />
        </>
      }
    />
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
function PersonResultRow({
  person,
  portrait,
  onPress,
}: {
  person: PersonSearchResult;
  portrait?: Portrait;
  onPress: () => void;
}) {
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
    <PersonRow
      name={person.displayName}
      meta={parts.join(" · ")}
      avatarUri={portrait?.thumbUrl}
      initials={personInitials(person.displayName)}
      serif
      onPress={onPress}
    />
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: {
    paddingHorizontal: gutter,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  titleRowWide: { alignItems: "center", gap: space["2xl"] },
  searchRow: { marginTop: space.lg },
  tabs: { marginTop: space.md, marginBottom: space.md },
  // `alignItems: "center"`: a chip keeps its own height even if the row is
  // ever given more than it needs (T-105).
  chipRow: { gap: space.sm, paddingHorizontal: gutter, paddingVertical: space.md, alignItems: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scrollBody: {},

  // `flex-start`, not `stretch`: the programme beside the hero is six rows
  // tall, and a hero stretched to match became a portrait twice the height of
  // the poster it was showing.
  leadWide: { flexDirection: "row", gap: space["2xl"], alignItems: "flex-start" },
  // A column, not a panel: the rows under the header draw their own
  // hairlines, and a bordered surface beside a full-bleed poster made two
  // objects of one lead.
  leadSide: { flex: 1 },
  leadStacked: { marginTop: space["2xl"] },

  /*
   * A column the width of a poster, not a share of the row.
   *
   * It was `flex: 1.35`, which was right while the picture filled whatever
   * width it was given; now that the picture is sized to fit the screen's
   * height, a flex share left a hand's breadth of empty ground between it
   * and the programme beside it. Fixed rather than derived from the
   * picture's own width, because the caption under it wraps to this column
   * and its height is what decides the picture's height: a column that
   * followed the picture would be a circle.
   */
  heroTall: { width: HERO_COLUMN_WIDTH, alignSelf: "flex-start" },
  /*
   * No width of its own: with a height and an aspect ratio set, the frame
   * derives its width, so the poster keeps its own shape at the largest size
   * the screen has room for. On a wide screen that is narrower than the
   * column, and it sits on the column's left edge — the picture, its
   * eyebrow, its title and its button then share one margin, which is the
   * grid the rest of the page is on.
   */
  poster: { maxWidth: "100%", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface2 },
  // On a wide screen the column is the picture's width, so the two agree on
  // a left edge; on a phone the column is the screen and a poster that has
  // been shortened to fit sits in the middle of it rather than against one
  // side with the ground showing at the other.
  posterWide: { alignSelf: "flex-start" },
  posterPhone: { alignSelf: "center" },
  heroBadge: { position: "absolute", top: space.md, left: space.md },
  heroCaption: { gap: space.sm, paddingTop: space.md },
  /**
   * The evening at a glance: one dot per curtain, and the count in numbers
   * beside them. The dots alone answer "is there more than this one"; the
   * count answers "how many" without asking anybody to count dots.
   */
  dotsRow: { flexDirection: "row", alignItems: "center", gap: space["2xs"], paddingTop: space.sm, alignSelf: "center" },
  // The dot is 6pt; the target around it is a finger.
  dotTarget: { padding: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairline },
  dotOn: { backgroundColor: colors.gold },
  dotsCount: { marginLeft: space.xs },
  heroButton: { alignSelf: "flex-start", marginTop: space.xs },

  rail: { gap: space.md, paddingHorizontal: gutter },

  loadMore: { alignSelf: "center", minWidth: 220 },
}));
