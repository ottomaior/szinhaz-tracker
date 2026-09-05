/**
 * All UI copy in one place, in Hungarian — the app's only language for now.
 * Screens import from here rather than hardcoding strings, so a future
 * second language (or a copy change) touches this file only.
 */
export const strings = {
  appName: "Színház Tracker",

  /** Derived "is it still on?" state — see supabase/migrations/0006_play_status.sql. */
  status: {
    announced: "Bemutató előtt",
    running: "Műsoron",
    dormant: "Szünetel",
    ended: "Levették a műsorról",
    nextPerformance: "Következő előadás",
    lastPerformance: "Utolsó előadás",
    noUpcoming: "Nincs meghirdetett időpont",
    remaining: (n: number) => (n === 1 ? "1 hátralévő előadás" : n + " hátralévő előadás"),
  },

  common: {
    cancel: "Mégsem",
    close: "Bezárás",
    retry: "Újrapróbálom",
    loadError: "Nem sikerült betölteni. Ellenőrizd a kapcsolatot.",
    noRating: "—",
  },

  tabs: {
    feed: "Hírfolyam",
    discover: "Felfedezés",
    watchlist: "Kívánságlista",
    profile: "Profil",
  },

  feed: {
    /** Only shown when the evening differs from the day the entry was posted. */
    seenOn: (date: string) => `látta: ${date}`,
    checkedIn: "megnézte",
    wantsToSee: "szeretné megnézni",
    addedToWatchlist: "hozzáadva a kívánságlistához",
    premiereLabel: "Bemutató",
    emptyTitle: "Még üres a hírfolyam",
    emptyBody: "Amint valaki naplóz egy előadást, itt fog megjelenni.",
    emptyAction: "Nézz körül a darabok között",
    scopeEveryone: "Mindenki",
    scopeFollowing: "Követettek",
    followingEmptyTitle: "Csendes a hírfolyamod",
    followingEmptyBody: "Kövess másokat, és itt látod majd, mit néznek meg.",
    followingEmptyAction: "Színházbarátok keresése",
    findPeople: "Színházbarátok",
  },

  time: {
    justNow: "Most",
    hoursAgo: (h: number) => `${h} órája`,
    yesterday: "Tegnap",
    daysAgo: (d: number) => `${d} napja`,
  },

  discover: {
    title: "Felfedezés",
    searchPlaceholder: "Keresés: darabok, színházak, színészek…",
    filterAll: "Mind",
    /**
     * What each filter is, shown on its chip while nothing is chosen and as
     * the heading of the sheet it opens. Once a value is set the chip shows
     * the value instead — "Debrecen" rather than "Város" — so the row says
     * what is filtered without needing a row per facet.
     */
    filterCity: "Város",
    filterGenre: "Műfaj",
    filterVenue: "Színház",
    filterVenueType: "Helyszín típusa",
    filterKoszinhaz: "Kőszínház",
    filterFuggetlen: "Független",
    filterSzabadteri: "Szabadtéri",
    nowPlayingTitle: "Műsoron most",
    recentTitle: "Korábbi keresések",
    recentClear: "Törlés",
    premieresTitle: "Közelgő bemutatók",
    seeAll: "Összes",
    seeLess: "Kevesebb",
    trendingTitle: "Népszerű",
    // Hungarian case suffixes are irregular per place name (Budapest*en* but
    // Debrecen*ben*), so this uses a suffix-free construction that is correct
    // for any city the venue table happens to contain.
    trendingTitleInCity: (city: string) => `Népszerű itt: ${city}`,
    searchResultsTitle: (n: number) => `${n} találat`,
    /** The grid heading once it is no longer ordered by rating. */
    allPlaysTitle: "Előadások",
    searching: "Keresés…",
    noResultsTitle: "Nincs találat",
    noResultsAction: "Nem található? Add hozzá magad",
    /** Search deliberately includes the theatres' archives, which is worth saying. */
    includesArchived: (n: number) => `Ebből ${n} már nincs műsoron`,
    addPlayFab: "Darab hozzáadása",
    emptyTitle: "Ehhez a szűréshez még nincs darab",
    emptyBody: "Próbálj másik várost vagy színháztípust, vagy vedd fel a darabot magad.",
  },

  auth: {
    signInTitle: "Bejelentkezés",
    signUpTitle: "Regisztráció",
    nameLabel: "Név",
    emailLabel: "E-mail cím",
    passwordLabel: "Jelszó",
    signInButton: "Bejelentkezés",
    signUpButton: "Fiók létrehozása",
    noAccount: "Még nincs fiókod?",
    haveAccount: "Már van fiókod?",
    switchToSignUp: "Regisztrálok",
    switchToSignIn: "Bejelentkezem",
    signInPrompt: "Jelentkezz be, hogy folytathasd",
    signOut: "Kijelentkezés",
    signOutConfirmTitle: "Kijelentkezel?",
    signOutConfirmBody: "Újra be kell majd jelentkezned a naplózáshoz.",
    genericError: "Hiba történt. Próbáld újra.",
    emailRequired: "Add meg az e-mail címed.",
    passwordRequired: "Add meg a jelszavad.",
    nameRequired: "Add meg a neved.",
  },

  addPlay: {
    headerTitle: "Darab hozzáadása",
    save: "Mentés",
    saving: "Mentés…",
    titleLabel: "Cím",
    authorLabel: "Szerző",
    directorLabel: "Rendező",
    genreLabel: "Műfaj",
    runtimeLabel: "Időtartam (perc)",
    intermissionsLabel: "Szünetek száma",
    premiereDateLabel: "Bemutató dátuma (ÉÉÉÉ-HH-NN)",
    venueLabel: "Játszóhely",
    venueSearchPlaceholder: "Keress egy színházat…",
    venueNotFound: "Nem találod a színházat?",
    createVenue: "Új játszóhely létrehozása",
    venueNameLabel: "Név",
    venueCityLabel: "Város",
    castLabel: "Szereposztás",
    castNamePlaceholder: "Színész neve",
    castRolePlaceholder: "Szerep",
    addCastMember: "Szereplő hozzáadása",
    removeCastMember: "Eltávolítás",
    clearVenue: "Másik játszóhely választása",
    errorTitleRequired: "A darab címe kötelező.",
    errorVenueRequired: "Válassz játszóhelyet a mentés előtt.",
    errorVenueNameRequired: "Add meg a játszóhely nevét és városát.",
    errorPremiereDate: "A bemutató dátuma ÉÉÉÉ-HH-NN formátumú legyen.",
    posterLabel: "Borítókép",
    posterAdd: "Kép választása",
    posterReplace: "Másik kép választása",
    posterRemove: "Kép eltávolítása",
    posterUploading: "Feltöltés…",
    posterCreditLabel: "Fotó készítője",
    posterCreditPlaceholder: "Például: Kiss Anna",
    posterHint: "Csak olyan képet tölts fel, amelyre jogosult vagy.",
    errorPosterPermission: "A képek eléréséhez engedély szükséges.",
    errorPosterUpload: "A kép feltöltése nem sikerült.",
  },

  watchlist: {
    title: "Kívánságlista",
    subtitle: (n: number) => (n === 1 ? "1 darab a listádon" : `${n} darab a listádon`),
    premiereLabel: "Bemutató",
    emptyTitle: "Üres a kívánságlistád",
    emptyBody: "A darab oldalán a könyvjelző gombbal tehetsz ide előadásokat.",
    emptyAction: "Felfedezés",
    signInPrompt: "Jelentkezz be, hogy lásd a kívánságlistád",
  },

  playDetail: {
    logButton: "Előadás naplózása",

    /**
     * The exit to the box office. Labelled for where it goes rather than what
     * it does — "Jegyek" is the word every Hungarian theatre puts on this, and
     * the button leaves the app, which the icon says.
     */
    tickets: "Jegyek a színház oldalán",
    ticketsFailed: "Nem sikerült megnyitni a színház oldalát.",

    /** Above the histogram: how the ratings are spread, not just their average. */
    ratingSpread: "Értékelések megoszlása",
    ratingBand: (band: number, people: number) =>
      `${band} maszk: ${people} értékelés`,

    castCrew: "Szereposztás és alkotók",
    fromFollowing: "Vélemények",
    reviewsCount: (n: number) => `${n} vélemény`,
    ratingsCount: (n: number) => `${n} értékelés`,
    noRatingsYet: "Még nincs értékelés",
    noReviewsYet: "Erről az előadásról még senki nem írt.",
    acting: "Színészi játék",
    directing: "Rendezés",
    setDesign: "Díszlet",
    hours: "óra",
    minutes: "perc",
    back: "Vissza",
    share: "Megosztás",
    shareFailed: "A megosztás nem sikerült.",
    linkCopied: "A link a vágólapra másolva.",
    addToWatchlist: "Kívánságlistához adom",
    /* Distinct from the watchlist: that answers "am I going", this answers
       "what does this belong with", and the second can be several at once. */
    addToList: "Felvétel egy listára",
    removeFromWatchlist: "Törlés a kívánságlistáról",
    watchlistError: "Nem sikerült frissíteni a kívánságlistát.",
    archivedBadge: "Archív",
    archivedNote: "Ez a produkció már nincs műsoron, de naplózhatod, ha láttad.",

    showtimes: "Időpontok",
    showtimesCount: (n: number) => (n === 1 ? "1 előadás" : `${n} előadás`),
    showtimesSeeAll: (n: number) => `Mind a(z) ${n}`,
    showtimesSeeLess: "Kevesebb",
    /**
     * Said instead of an empty list. Which of these applies is a real
     * difference to a reader: a theatre that has not published next season yet
     * is not the same thing as a production that has closed, and before this
     * the screen showed the same blank space for both.
     */
    noShowtimesRunning: "A színház még nem hirdette meg a következő időpontokat.",
    noShowtimesAnnounced: "A bemutató még nem kapott meghirdetett időpontot.",
    noShowtimesEnded: "Ez a produkció lekerült a műsorról.",
    noShowtimesUnknown: "Erről a produkcióról nincs időpontunk.",
    ticketsAt: (venue: string) => `Jegyek: ${venue}`,
  },

  checkin: {
    headerTitle: "Előadás naplózása",
    save: "Mentés",
    saving: "Mentés…",
    overallRating: "Összesített értékelés",
    acting: "Színészi játék",
    directing: "Rendezés",
    setAndCostume: "Díszlet és jelmez",
    momentTags: "Élmény címkék",
    tagStandingOvation: "Állótapsot kapott",
    tagCried: "Megkönnyeztem",
    tagRecommend: "Ajánlom",
    reviewLabel: "Vélemény",
    reviewPlaceholder: "Oszd meg a gondolataidat az előadásról…",
    playNotFound: "Nem található az előadás.",
    close: "Bezárás",
    saveError: "Nem sikerült menteni a naplóbejegyzést. Próbáld újra.",
    pickPlayTitle: "Melyik előadást naplózod?",
    pickPlayPlaceholder: "Keress egy darabot…",
    pickPlayHint: "Kezdj el gépelni a darab, a színház vagy egy színész nevével.",
    pickPlayNoResults: "Nincs találat. Vedd fel a darabot a Felfedezés fülön.",
    changePlay: "Másik előadás",

    /* When you were there — the whole point of 0022_diary_dates.sql. */
    dateLabel: "Mikor láttad?",
    today: "Ma",
    yesterday: "Tegnap",
    previousMonth: "Előző hónap",
    nextMonth: "Következő hónap",

    /**
     * Shown when the catalogue holds more than one showtime on the chosen day.
     * A single showtime is linked silently; asking about the one case where the
     * answer is obvious would be a question for its own sake.
     */
    whichShowtime: "Melyik előadás?",

    /**
     * Not a checkbox. The app knows this is a return visit because it can see
     * the earlier entry, so this states the fact rather than asking about it.
     */
    rewatchNotice: (count: number) =>
      count === 1 ? "Ezt már láttad egyszer — ez a második alkalom." : `Ezt már ${count}-szer láttad.`,
  },

  /** Productions gathered under a title — user-made and editorial alike. */
  lists: {
    headerTitle: "Listák",
    headerFallback: "Lista",
    featuredHeading: "Szerkesztői listák",
    mineHeading: "A listáim",
    newList: "Új lista",
    create: "Létrehozás",
    creating: "Létrehozás…",
    createError: "Nem sikerült létrehozni a listát. Próbáld újra.",
    titlePlaceholder: "A lista címe",
    descriptionPlaceholder: "Miről szól ez a lista? (nem kötelező)",
    rankedLabel: "Sorrendezett lista",
    rankedHint: "A sorrend számít, és a lista sorszámozva jelenik meg.",
    itemCount: (n: number) => `${n} előadás`,
    rankedBadge: "sorrendezett",
    privateBadge: "privát",
    featuredBadge: "szerkesztői",

    emptyTitle: "Még nincs listád.",
    emptyBody: "A lista arra jó, hogy egy témába rendezd az előadásokat — évadösszegzés, Shakespeare Budapesten, amit egy első színházlátogatónak ajánlanál.",
    signInTitle: "Jelentkezz be a saját listáidhoz.",
    signInBody: "A szerkesztői listákat bejelentkezés nélkül is olvashatod.",

    emptyListTitle: "Ez a lista még üres.",
    emptyListBody: "A készítője még nem tett bele előadást.",
    emptyListBodyOwner: "Keress egy előadást, és a részletek oldalán vedd fel erre a listára.",
    browseToAdd: "Felfedezés",

    notFoundTitle: "Nem találjuk ezt a listát.",
    notFoundBody: "Lehet, hogy törölték, vagy a készítője privátra állította.",

    addToListTitle: "Melyik listára?",
    noListsYet: "Még nincs listád. Hozz létre egyet, és ide kerül.",
    addError: "Nem sikerült felvenni a listára.",
    removeError: "Nem sikerült levenni a listáról.",
    removeEntry: "Levesz",

    deleteList: "Lista törlése",
    deleteConfirmTitle: "Törlöd ezt a listát?",
    deleteConfirmBody: (n: number) =>
      n === 0
        ? "A lista üres, a törlés nem érint egyetlen előadást sem."
        : `A listán ${n} előadás van. Maguk az előadások megmaradnak, csak ez a gyűjtemény szűnik meg.`,
    deleteError: "Nem sikerült törölni a listát.",
  },

  /** One performer or director, and everything the catalogue credits them on. */
  person: {
    headerFallback: "Alkotó",
    creditsHeading: "Előadások",
    credits: "Közreműködés",
    venues: "Színház",
    directed: "Rendezés",
    seenByYou: "Ebből láttad",
    seenBadge: "Láttad",
    director: "Rendező",
    venueCount: (n: number) => `${n} színház`,
    notFoundTitle: "Nem találjuk ezt az alkotót.",
    notFoundBody: "Lehet, hogy elgépelt a cím, vagy a katalógusban más néven szerepel.",
  },

  profile: {
    playsSeen: "Megnézett darab",
    thisYear: "Idén",
    followers: "Követő",
    following: "Követett",
    tabDiary: "Napló",
    tabWatchlists: "Kívánságlisták",
    tabReviews: "Vélemények",
    comingSoon: (tab: string) => `${tab} hamarosan.`,
    diaryEmpty: "Még nincs naplózott előadásod.",
    watchlistEmpty: "Még nincs semmi a kívánságlistádon.",
    reviewsEmpty: "Még nem írtál véleményt. Naplózáskor a szöveg opcionális — itt azok jelennek meg, amikhez írtál is valamit.",
    seenOn: (date: string) => `Megnézve: ${date}`,
    signInPrompt: "Jelentkezz be, hogy lásd a profilod",
    signInButton: "Bejelentkezés",
  },

  people: {
    follow: "Követés",
    unfollow: "Követés visszavonása",
    followingLabel: "Követed",
    searchTitle: "Színházbarátok",
    searchPlaceholder: "Keresés név vagy @felhasználónév alapján",
    searchEmpty: "Nincs ilyen felhasználó.",
    followersTitle: "Követők",
    followingTitle: "Követettek",
    followersEmpty: "Még senki nem követi.",
    followingEmpty: "Még senkit nem követ.",
    signInToFollow: "Jelentkezz be a követéshez",
    diaryTitle: "Napló",
    diaryEmpty: "Még nincs naplózott előadása.",
  },

  /**
   * Labels for `plays.genre_normalized` — the fixed vocabulary from
   * 0016_genre_taxonomy.sql, which is what the filters and the play detail
   * line now read.
   *
   * The previous version of this map keyed on "musical", "drama" and
   * "physical theatre": three English words against a column that has never
   * held an English value, so every lookup missed and the raw scraped term was
   * rendered instead.
   */
  genres: {
    "próza": "Próza",
    opera: "Opera",
    operett: "Operett",
    musical: "Musical",
    "zenés": "Zenés",
    "tánc": "Tánc",
    "báb": "Báb",
    "felolvasószínház": "Felolvasószínház",
    "egyéb": "Egyéb",
  } as Record<string, string>,

  /**
   * Where a genre came from, shown where the distinction matters.
   *
   * A production tagged "Próza" because Katona stages prose is a weaker claim
   * than one the theatre itself filed under a genre term, and the app should
   * be able to say which it is rather than presenting both as fact.
   */
  genreSource: {
    source: "a színház besorolása",
    inferred: "a szerző alapján",
    venue_default: "a színház profilja alapján",
    user: "kézzel megadva",
  } as Record<string, string>,

  genreUnknown: "Nincs besorolva",

  /**
   * Ordering. Offered because there was none: search results came back
   * alphabetically and the browse grid was always by rating, with no way to
   * ask for anything else.
   */
  sort: {
    label: "Rendezés",
    relevance: "Találat",
    next: "Legközelebbi",
    premiere: "Bemutató",
    rating: "Értékelés",
    title: "Cím",
  },

  /** The date-first half of Discover: pick an evening, see what is on. */
  program: {
    modeBrowse: "Felfedezés",
    modeProgram: "Műsor",
    performanceCount: (n: number) => (n === 1 ? "1 előadás" : `${n} előadás`),
    emptyTitle: "Nincs meghirdetett időpont",
    emptyBody: "A szűrőkhöz nem találunk előadást a következő két hónapban. Próbálj tágabb szűrést.",
  },
};
