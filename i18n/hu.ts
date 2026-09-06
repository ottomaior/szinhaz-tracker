/**
 * All UI copy in one place, in Hungarian — the app's only language for now.
 * Screens import from here rather than hardcoding strings, so a future
 * second language (or a copy change) touches this file only.
 */
import { elapsedSince } from "@/utils/datetime";

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
    /* An entry ticked during onboarding: seen, but the date is not known. Said
       rather than left blank, so the card does not read as though the person
       went today. */
    seenUndated: "dátum nélkül",
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
    /* Deliberately the same words as the Listák képernyő heading: it is the
       same shelf, seen from two places. */
    featuredListsTitle: "Szerkesztői listák",
    seeAll: "Összes",
    seeLess: "Kevesebb",
    trendingTitle: "Népszerű",
    // Hungarian case suffixes are irregular per place name (Budapest*en* but
    // Debrecen*ben*), so this uses a suffix-free construction that is correct
    // for any city the venue table happens to contain.
    trendingTitleInCity: (city: string) => `Népszerű itt: ${city}`,

    /* The browse scope. Not a filter — it widens the list rather than narrowing
       it — but it lives in the same row because it is the same kind of
       decision about what the grid is a list of. */
    scopeLabel: "Terjedelem",
    scopeCurrent: "Ami most megy",
    scopeAll: "Az archívummal együtt",
    allIncludingArchive: "Minden előadás, archívummal",
    allIncludingArchiveInCity: (city: string) => `Minden előadás itt: ${city}`,
    /* Says how many there are, not how many fit on screen. */
    showingCount: (shown: number, total: number) =>
      shown >= total ? `${total} előadás` : `${shown} / ${total} előadás`,
    loadMore: "Továbbiak betöltése",
    loadingMore: "Betöltés…",
    searchResultsTitle: (n: number) => `${n} találat`,
    /**
     * The people a search found, listed above the productions.
     *
     * Searching a performer's name used to return only the productions they
     * are in, which answers a question nobody asked: type a name, get the
     * person. The heading says "alkotók" — makers — rather than "színészek",
     * because the list holds directors too, and a director shown under a
     * heading that says "actors" has been miscredited.
     */
    peopleResultsTitle: "Alkotók",
    /** "12 közreműködés · 3 színház · 1998–2024", as much of it as is known. */
    personCredits: (n: number) => `${n} közreműködés`,
    personDirected: (n: number) => `${n} rendezés`,
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

    /* The second half of this screen: not "which production", but "which
       people and which houses". */
    followingHeading: "Akiket követsz",
    followingPeople: "Alkotók",
    followingVenues: "Színházak",
    followingEmpty:
      "Egy alkotó vagy egy színház oldalán kérhetsz értesítést, ha új bemutatójuk lesz.",
    personItems: (n: number) => `${n} közreműködés`,
    venueItems: (n: number) => `${n} futó előadás`,
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
    /* Shown only where nothing else on the screen answers the question — see
       `statusNote` in app/play/[id].tsx for why the raw `status_reason` is not
       rendered. */
    dormantNote: "A színház repertoárján szerepel, de nincs meghirdetett időpont.",
    premiereNote: (date: string) => `Bemutató: ${date}`,

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
    editTitle: "Bejegyzés szerkesztése",
    /* Shown when the form has adopted the blank entry onboarding wrote, rather
       than starting a new one — see the effect in app/checkin.tsx. */
    completingBlank:
      "Ezt már bejelölted a naplódban dátum nélkül — most kiegészíted, nem új bejegyzés lesz.",
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

    /* Who was on that night — the one question a film log never has to ask. */
    castLabel: "Kiket láttál?",
    castHint: "Koppints azokra, akik aznap este játszottak. Ha beugró volt, vedd fel a nevét.",
    castNoneKnown: "Ehhez az előadáshoz nincs szereplőlistánk. Írd be, akire emlékszel.",
    castAddAlternate: "Beugró hozzáadása",
    castAlternatePlaceholder: "Ki ugrott be?",
    castAdd: "Hozzáadás",
    castAlternateBadge: "beugró",
    castSelectedCount: (n: number) => `${n} kiválasztva`,

    seatLabel: "Hol ültél?",
    seatPlaceholder: "Pl. Erkély bal, 2. sor 14.",
    priceLabel: "Mennyibe került?",
    pricePlaceholder: "Ft",
    priceHint: "A 0 is válasz — tiszteletjegy, iskolai előadás, valakinek a szabad helye.",
    priceInvalid: "A jegyár csak szám lehet, 0 és 1 000 000 Ft között.",

    stubLabel: "Jegy vagy fotó",
    stubAdd: "Fotó hozzáadása",
    stubReplace: "Fotó cseréje",
    stubRemove: "Fotó eltávolítása",
    stubUploading: "Feltöltés…",
    /* Said before the camera comes out, not after. A ticket usually has a name
       and a booking code printed on it, and this entry is public. */
    stubHint:
      "A napló bejegyzései nyilvánosak, így ez a fotó is az lesz. Egy jegyen általában rajta van a neved és a foglalási kódod — takard ki, ha nem szeretnéd megosztani.",
    stubPermission: "A fotó feltöltéséhez engedélyt kell adnod a galériához.",
    stubUploadFailed: "A fotó feltöltése nem sikerült. Próbáld újra.",
  },

  /**
   * The évad in review. Counted September to August — see 0031_the_evad.sql
   * for why the summer belongs to the season that opened the previous autumn.
   */
  season: {
    headerTitle: "Évad",
    /* The label arrives with its suffix already on it — "2025/26-os",
       "2026/27-es" — because which one is right depends on how the closing
       year is spoken. See `seasonSuffix` in utils/season.ts. */
    title: (labelWithSuffix: string) => `A ${labelWithSuffix} évad`,
    thisSeason: "Ez az évad",
    entries: "Előadás",
    venues: "Színház",
    cities: "Város",
    rewatches: "Újranézés",
    rated: "Értékelve",
    firstNight: "Első este",
    lastNight: "Utolsó este",
    spendHeading: "Amibe került",
    spendTotal: (huf: number) => `${huf.toLocaleString("hu-HU")} Ft`,
    spendAverage: (huf: number) => `Átlag ${huf.toLocaleString("hu-HU")} Ft`,
    /* Said rather than hidden: an average over three priced entries out of
       twenty is a different claim from an average over twenty. */
    spendCoverage: (priced: number, total: number) =>
      priced === total
        ? "Minden bejegyzésnél megadtad a jegyárat."
        : `${total} bejegyzésből ${priced} tartalmaz jegyárat.`,
    spendEmpty:
      "Naplózáskor megadhatod a jegyárat — akkor itt összesítjük, mibe került az évad.",
    genresHeading: "Mit néztél",
    peopleHeading: "Kiket láttad a legtöbbször",
    peopleNights: (n: number) => (n === 1 ? "1 este" : `${n} este`),
    /* Where the number comes from, because it is two different things. */
    peopleSource:
      "A naplózott szereposztásból, ahol megadtad — máshol az előadás hivatalos szereplőlistájából.",
    topHeading: "A legjobb este",
    seatCount: (n: number) => (n === 1 ? "1 helyet jegyeztél fel" : `${n} helyet jegyeztél fel`),
    empty: "Ebben az évadban még nincs naplózott előadásod.",
    emptyAction: "Felfedezés",
    undated: (n: number) =>
      n === 1
        ? "1 bejegyzésed dátum nélkül van, ezért egyik évadba sem számít bele."
        : `${n} bejegyzésed dátum nélkül van, ezért egyik évadba sem számítanak bele.`,
    signInPrompt: "Jelentkezz be az évadösszegződhöz",
  },

  /**
   * The inbox. What the nightly sync learned that somebody was waiting to
   * hear — see 0030_alerts.sql for what produces each of the four kinds.
   */
  inbox: {
    headerTitle: "Értesítések",
    empty: "Nincs új értesítésed.",
    emptyBody:
      "Tegyél előadásokat a kívánságlistádra, vagy kérj értesítést egy alkotótól vagy színháztól — itt szólunk, ha történik velük valami.",
    signInPrompt: "Jelentkezz be az értesítéseidhez",
    /* One line per kind. The production's title is the row's heading, so these
       say what happened to it rather than repeating the name. */
    datesPublished: (through: string, count: number) =>
      count === 1
        ? `Új játszási időpont, ${through}-ig.`
        : `${count} új játszási időpont, ${through}-ig.`,
    playingTomorrow: (time: string, room?: string) =>
      room ? `Holnap játsszák, ${time} — ${room}` : `Holnap játsszák, ${time}`,
    venueNewPlay: (venue: string) => `Új bemutató: ${venue}`,
    personNewPlay: (person: string) => `${person} új előadásban játszik`,
    reviewLiked: (person: string) => `${person} kedveli a bejegyzésedet`,
    reviewCommented: (person: string) => `${person} hozzászólt a bejegyzésedhez`,
    unreadBadge: (n: number) => (n > 9 ? "9+" : String(n)),
    openNotifications: "Értesítések",
  },

  /** What the people you follow thought — see 0033. */
  friends: {
    playHeading: "A követettek szerint",
    /* Singular and plural, because "1 követett látta" is what the screen will
       say for most people for a long time. */
    seenBy: (n: number) => (n === 1 ? "1 követett látta" : `${n} követett látta`),
    discoverHeading: "Amit a követettek láttak",
    unrated: "Nem értékelte",
  },

  /** Likes and comments — see 0032, which made the two counters true. */
  social: {
    like: "Tetszik",
    liked: "Tetszik",
    likeCount: (n: number) => (n === 1 ? "1 tetszés" : `${n} tetszés`),
    signInToLike: "Jelentkezz be a tetszéshez",
    commentsHeading: "Hozzászólások",
    commentPlaceholder: "Írj hozzá valamit…",
    send: "Küldés",
    sending: "Küldés…",
    signInToComment: "Jelentkezz be a hozzászóláshoz",
    commentsEmpty: "Még senki nem szólt hozzá.",
    delete: "Törlés",
    deleteFailed: "Nem sikerült törölni a hozzászólást.",
    sendFailed: "Nem sikerült elküldeni a hozzászólást.",
    edited: "szerkesztve",
    tooLong: (max: number) => `A hozzászólás legfeljebb ${max} karakter lehet.`,
    remaining: (left: number) => `${left} karakter maradt`,
  },

  /** One evening, read back: what the diary holds about a single night. */
  entry: {
    headerTitle: "Napló bejegyzés",
    notFound: "Ez a bejegyzés nem található.",
    seenOn: (date: string) => `Megnézve: ${date}`,
    seenUndated: "Dátum nélkül naplózva",
    share: "Megosztás",
    sharing: "Kép készítése…",
    shareFailed: "Nem sikerült képet készíteni. Próbáld újra.",
    edit: "Szerkesztés",
    delete: "Törlés",
    deleting: "Törlés…",
    deleteConfirmTitle: "Törlöd ezt a bejegyzést?",
    /* Named, because a diary entry is not one row: the date, a szereposztás, a
       hely, a jegyár, egy fotó és a hozzászólások mind vele mennek. */
    deleteConfirmBody:
      "A dátum, a szereposztás, a hely, a jegyár, a fotó és a hozzászólások is törlődnek. Ezt nem lehet visszavonni.",
    deleteFailed: "Nem sikerült törölni a bejegyzést. Próbáld újra.",
    rewatch: "Újranézés",
    castHeading: "Akiket aznap este láttál",
    castAlternateBadge: "beugró",
    seatHeading: "Hely",
    priceHeading: "Jegyár",
    priceValue: (huf: number) => (huf === 0 ? "Tiszteletjegy" : `${huf.toLocaleString("hu-HU")} Ft`),
    stubHeading: "Jegy",
    reviewHeading: "Vélemény",
    openPlay: "Az előadás adatlapja",
    nothingRecorded:
      "Ehhez az estéhez még nem rögzítettél helyet, jegyárat vagy szereplőket.",
  },

  /**
   * The first-run flow: tick what you have already seen, so the diary does not
   * start empty. Entries created here carry no date and no rating — see
   * 0026_seen_without_a_date.sql for why inventing either would be worse than
   * omitting it.
   */
  onboarding: {
    headerTitle: "Mit láttál már?",
    lede: "Jelöld be, amit láttál — így nem üres naplóval indulsz. A dátumot és az értékelést később bármikor hozzáadhatod.",
    skip: "Kihagyom",
    save: (n: number) => (n === 0 ? "Válassz előadást" : n === 1 ? "1 előadás mentése" : `${n} előadás mentése`),
    saving: "Mentés…",
    saveError: "Nem sikerült menteni. Próbáld újra.",
    nothingLeftTitle: "Mindent bejelöltél már.",
    nothingLeftBody: "Ebben a városban nincs több olyan előadás, amit ne naplóztál volna.",
    /** On the profile, when the diary is empty. */
    prompt: "Láttál már előadásokat? Jelöld be őket.",
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

  /**
   * Standing subscriptions — a performer or a theatre, rather than one
   * production. The wording is deliberately "értesítést kérek" and not just
   * "követés": what this buys you is news, and 0029 is the table the nightly
   * sync will read to send it.
   */
  follow: {
    followPerson: "Értesítést kérek",
    followingPerson: "Értesítést kérsz",
    followVenue: "Értesítést kérek",
    followingVenue: "Értesítést kérsz",
    signInToFollow: "Jelentkezz be az értesítésekhez",
    followerCount: (n: number) => (n === 1 ? "1 néző követi" : `${n} néző követi`),
    personHint: "Szólunk, ha új előadásban lép színpadra.",
    venueHint: "Szólunk, ha új bemutatót hirdet.",
    /* Said plainly: nothing sends these yet, and a promise the app cannot keep
       is worse than a feature that says what it is. */
    notYetSending:
      "Az értesítéseket még nem küldjük ki — egyelőre azt jegyezzük fel, mire vagy kíváncsi.",
  },

  profile: {
    playsSeen: "Megnézett darab",
    thisSeason: "Ebben az évadban",
    followers: "Követő",
    following: "Követett",
    tabDiary: "Napló",
    tabWatchlists: "Kívánságlisták",
    tabReviews: "Vélemények",
    comingSoon: (tab: string) => `${tab} hamarosan.`,
    diaryEmpty: "Még nincs naplózott előadásod.",
    /* An entry ticked during onboarding: seen, but the date is not known. */
    seenUndated: "dátum nélkül",
    watchlistEmpty: "Még nincs semmi a kívánságlistádon.",
    reviewsEmpty: "Még nem írtál véleményt. Naplózáskor a szöveg opcionális — itt azok jelennek meg, amikhez írtál is valamit.",
    seenOn: (date: string) => `Megnézve: ${date}`,
    signInPrompt: "Jelentkezz be, hogy lásd a profilod",
    signInButton: "Bejelentkezés",
    edit: "Profil szerkesztése",
  },

  settings: {
    title: "Beállítások",
    appearance: "Megjelenés",
    /* Said once, above the list, rather than repeated on every row. */
    appearanceHint: "A választás ezen az eszközön marad meg.",
    themeSystem: "Rendszer szerint",
    /* Appended to the system row so the third state is not a mystery. */
    themeSystemNow: (name: string) => `jelenleg: ${name}`,
    themes: {
      velvetDark: "Bársony",
      playbillLight: "Színlap",
      minimalLight: "Letisztult",
      modernDark: "Éjszakai",
    },
    themeBlurbs: {
      velvetDark: "A ház stílusa: sötét bordó, arany kiemeléssel.",
      playbillLight: "Ugyanaz a színlap, nyomtatva: meleg krém és tinta.",
      minimalLight: "Világos és semleges, minden dísz nélkül.",
      modernDark: "Hűvös, szürke sötét mód.",
    },
    /* The legal documents, reachable from here because Settings is the one
       screen a person opens when they want to know what they agreed to. */
    legal: "Jogi tudnivalók",
    legalPrivacy: "Adatkezelési tájékoztató",
    legalPrivacyHint: "Mit tárolunk rólad, mi ebből nyilvános, és hogyan kérheted a törlését.",
    legalTerms: "Felhasználási feltételek",
    legalTermsHint: "Mit vállalunk a szolgáltatással, és mit kérünk cserébe.",
    legalImprint: "Impresszum",
    legalImprintHint: "Ki üzemelteti az alkalmazást, és hol éred el.",
  },

  editProfile: {
    title: "Profil szerkesztése",
    photoLabel: "Profilkép",
    photoAdd: "Kép hozzáadása",
    photoReplace: "Kép cseréje",
    photoRemove: "Kép eltávolítása",
    photoUploading: "Feltöltés…",
    photoHint:
      "Ha nincs képed, a neved kezdőbetűi jelennek meg helyette. Csak olyan képet tölts fel, amire jogod van.",
    nameLabel: "Név",
    namePlaceholder: "Ahogy mások látnak",
    cityLabel: "Város",
    cityPlaceholder: "Pl. Budapest",
    bioLabel: "Bemutatkozás",
    bioPlaceholder: "Mit szeretsz nézni? Melyik a törzsszínházad?",
    /* The counter counts down rather than up: what matters is the room left. */
    bioRemaining: (left: number) => `${left} karakter maradt`,
    /* Past the limit the countdown would read "-20 karakter maradt", which is
       arithmetic rather than Hungarian. */
    bioOver: (over: number) => `${over} karakterrel hosszabb a megengedettnél`,
    save: "Mentés",
    saving: "Mentés…",
    errorNameRequired: "A név nem maradhat üresen.",
    errorPhotoPermission: "A képfeltöltéshez engedélyt kell adnod a galériához.",
    errorPhotoUpload: "A kép feltöltése nem sikerült. Próbáld újra.",
    errorBioTooLong: "A bemutatkozás legfeljebb 280 karakter lehet.",
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

/**
 * "3 órája", "tegnap" — the wording for `elapsedSince` in `utils/datetime.ts`.
 *
 * Split from the arithmetic because the two fail differently: the arithmetic is
 * testable and is, while this is a lookup table for four cases. It sits here
 * rather than in the util so that `utils/` keeps no dependency on the copy, and
 * outside the `strings` object so the object does not have to refer to itself
 * while TypeScript is still inferring its type.
 *
 * Until now this lived as a private `timeAgo` inside the feed screen, which is
 * how this project previously ended up with four different `formatDate`s.
 */
export function formatTimeAgo(iso: string): string {
  const elapsed = elapsedSince(iso);
  switch (elapsed.unit) {
    case "now":
      return strings.time.justNow;
    case "hours":
      return strings.time.hoursAgo(elapsed.value);
    case "yesterday":
      return strings.time.yesterday;
    case "days":
      return strings.time.daysAgo(elapsed.value);
  }
}
