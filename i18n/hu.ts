/**
 * All UI copy in one place, in Hungarian — the app's only language for now.
 * Screens import from here rather than hardcoding strings, so a future
 * second language (or a copy change) touches this file only.
 */
export const strings = {
  appName: "Színház Tracker",

  tabs: {
    feed: "Hírfolyam",
    discover: "Felfedezés",
    watchlist: "Kívánságlista",
    profile: "Profil",
  },

  feed: {
    checkedIn: "megnézte",
    wantsToSee: "szeretné megnézni",
    addedToWatchlist: "hozzáadva a kívánságlistához",
    premiereLabel: "Bemutató",
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
    filterKoszinhaz: "Kőszínház",
    filterFuggetlen: "Független",
    filterSzabadteri: "Szabadtéri",
    premieresTitle: "E heti bemutatók",
    seeAll: "Összes",
    trendingTitle: "Népszerű Budapesten",
    searchResultsTitle: (n: number) => `${n} találat`,
    noResultsTitle: "Nincs találat",
    noResultsAction: "Nem található? Add hozzá magad",
    addPlayFab: "Darab hozzáadása",
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
    genericError: "Hiba történt. Próbáld újra.",
  },

  addPlay: {
    headerTitle: "Darab hozzáadása",
    save: "Mentés",
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
  },

  watchlist: {
    title: "Kívánságlista",
    subtitle: (n: number) => `${n} darabot szeretne megnézni a köröd`,
    premiereLabel: "Bemutató",
  },

  playDetail: {
    logButton: "Előadás naplózása",
    castCrew: "Szereposztás és alkotók",
    fromFollowing: "Akiket követsz",
    reviewsCount: (n: number) => `${n} vélemény`,
    ratingsCount: (n: number) => `${n} értékelés`,
    acting: "Színészi játék",
    directing: "Rendezés",
    setDesign: "Díszlet",
    hours: "óra",
    minutes: "perc",
  },

  checkin: {
    headerTitle: "Előadás naplózása",
    save: "Mentés",
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
    addPhoto: "Fénykép hozzáadása",
    playNotFound: "Nem található az előadás.",
    close: "Bezárás",
  },

  profile: {
    editProfile: "Profil szerkesztése",
    playsSeen: "Megnézett darab",
    thisYear: "Idén",
    followers: "Követő",
    following: "Követett",
    tabDiary: "Napló",
    tabWatchlists: "Kívánságlisták",
    tabReviews: "Vélemények",
    comingSoon: (tab: string) => `${tab} hamarosan.`,
    signInPrompt: "Jelentkezz be, hogy lásd a profilod",
    signInButton: "Bejelentkezés",
  },

  genres: {
    musical: "musical",
    drama: "dráma",
    "physical theatre": "fizikai színház",
  } as Record<string, string>,
};
