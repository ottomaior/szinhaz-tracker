/**
 * All UI copy in one place, in Hungarian — the app's only language for now.
 * Screens import from here rather than hardcoding strings, so a future
 * second language (or a copy change) touches this file only.
 */
import { elapsedSince, type Daypart } from "@/utils/datetime";
import { notificationLines } from "./notificationCopy";

/** Hungarian number words for the curtains heading on Discover. */
const CURTAIN_WORDS: Record<number, string> = {
  1: "Egy",
  2: "Két",
  3: "Három",
  4: "Négy",
  5: "Öt",
  6: "Hat",
  7: "Hét",
  8: "Nyolc",
  9: "Kilenc",
  10: "Tíz",
  11: "Tizenegy",
  12: "Tizenkét",
};

export const strings = {
  appName: "Vastaps",

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
    /* The cross in a search field: empties it and keeps the keyboard up. */
    clearSearch: "Keresés törlése",
    retry: "Újrapróbálom",
    loadError: "Nem sikerült betölteni. Ellenőrizd a kapcsolatot.",
    noRating: "—",
    /* Spoken where the visible cue for "no answer" is an empty row of masks
       or a dash, neither of which reads aloud as anything. */
    notRated: "Nincs értékelve",
    /* Spoken on the mask that is already the whole rating, which is the one
       that clears it. There is no visual affordance for that on the mask
       itself, so the hint is the only place a screen reader hears about it. */
    clearRating: "Koppints rá újra az értékelés törléséhez.",

    /* app/+not-found.tsx — an address the router has no screen for. */
    notFoundTitle: "Ez az oldal nincs meg.",
    notFoundBody: "Lehet, hogy elgépelt a cím, vagy a link már nem él.",
    notFoundAction: "Felfedezés",
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
    /* Where a rating would be, on an entry whose author this reader does not
       follow. Names the person, because "follow somebody" is advice and
       "follow Ottó" is a next step — and because the card is already about
       them. See 0041: the columns are withheld by the database, and this is
       only the sentence that explains the gap. */
    followToSee: (name: string) => `Kövesd ${name} bejegyzéseit, hogy lásd, mit gondolt róla.`,
    /* The same, before the author's profile has loaded. */
    followToSeeGeneric: "Kövesd a szerzőt, hogy lásd, mit gondolt róla.",

    /* One onboarding sitting folded into a card: "18 előadást jelölt meg
       látottnak". The verb agrees with the byline's "X megnézte" pattern. */
    backfilled: (n: number) => `${n} előadást jelölt meg látottnak`,
    backfillMore: (n: number) => `+${n}`,
  },

  /**
   * What a visitor without an account sees on the two tabs that are about
   * their account. One dim sentence in a dark void read as an error; this says
   * what the account is for, in the app's voice, and offers the door.
   */
  signedOut: {
    eyebrow: "Vastaps",
    title: "A színházi naplód, ami emlékszik helyetted.",
    diaryTitle: "Napló",
    diaryBody: "Minden este, amit láttál: darab, dátum, értékelés, és amit meg akarsz belőle jegyezni.",
    watchlistTitle: "Kívánságlista",
    watchlistBody: "Amit meg akarsz nézni, a következő időponttal.",
    peopleTitle: "Színházbarátok",
    peopleBody: "Kövesd, ki mit néz meg Budapesten és Debrecenben.",
    signUp: "Fiókot nyitok",
    haveAccount: "Van már fiókod?",
    signIn: "Bejelentkezés",
  },

  time: {
    justNow: "Most",
    hoursAgo: (h: number) => `${h} órája`,
    yesterday: "Tegnap",
    daysAgo: (d: number) => `${d} napja`,
  },

  discover: {
    title: "Felfedezés",
    /**
     * No "Keresés:" prefix — the magnifier next to it already says that, and
     * with the prefix the line ran past the end of the field on a 375pt
     * phone and was cut mid-word ("…színés"). What the field needs to say is
     * what you may type into it, and that now fits.
     */
    searchPlaceholder: "Darabok, színházak, színészek",
    /** Spelt out for a screen reader, which has no magnifier to go on. */
    searchLabel: "Keresés darabok, színházak és színészek között",
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

    /* Under the city picker: how much is in scope, not how much is filtered. */
    venueCount: (n: number) => (n === 1 ? "1 színház" : `${n} színház`),
    /* The header picker's unset state. The chip said "Mind", which reads as an
       answer to "which filter" — but as the line that names what the whole
       screen is scoped to it has to answer "which city". */
    cityAll: "Minden város",
    upcomingTitle: "A következő esték",
    upcomingEyebrow: "Műsor",
    upcomingAction: "Teljes műsor",
    upcomingToday: "Ma",
    /* The lead: what is on today, or failing that the next day there is
       anything on at all. "Ma este" is the answer the reader came for — but
       a 14:30 matinée is "Ma délután", and when the same day holds both, the
       heading says only the day (T-112). A weekday is the honest substitute
       on a dark night. */
    heroToday: (part: Daypart | undefined) => (part === undefined ? "Ma" : part === "afternoon" ? "Ma délután" : "Ma este"),
    heroNext: (weekday: string) => `Legközelebb · ${weekday}`,
    heroOpen: "Megnézem",
    heroDirected: (name: string) => `${name} rendezése`,
    /* The poster rail under the lead: every curtain going up that evening
       across the theatres in scope. Spelled out up to twelve, because "8
       függöny" on a heading reads as a count and "Nyolc függöny" as a line. */
    /* Read aloud for one dot of the evening's lead (T-125): the dots are a
       row of identical circles to a screen reader without it. */
    curtainAt: (time: string, title: string) => `${time} — ${title}`,
    curtainsTitle: (n: number) => `${CURTAIN_WORDS[n] ?? String(n)} függöny, egy este`,
    curtainsEyebrowOn: (weekday: string | undefined, part: Daypart | undefined) => {
      const day = weekday ?? "Ma";
      return part === undefined ? day : part === "afternoon" ? `${day} délután` : `${day} este`;
    },
    /* Section eyebrows: what kind of shelf each one is. */
    featuredEyebrow: "Szerkesztői válogatás",
    premieresEyebrow: "Bemutató előtt",
    trendingEyebrowSorted: "Minden előadás",
    trendingEyebrowArchive: "Az archívummal együtt",
    searchOpen: "Keresés",
    searchClose: "Keresés bezárása",
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

    /* One button above the form on both auth modals. "Folytatás" rather than
       "Bejelentkezés" or "Regisztráció", because with a provider the two are
       one action: whichever the address turns out to need is what happens. */
    continueWithGoogle: "Folytatás Google-fiókkal",
    /* The line between the provider button and the form. */
    orWithEmail: "vagy e-mail-címmel",

    /* Under the sign-up button, in pieces so the two links can be pressed
       separately inside one sentence: "A fiók létrehozásával elfogadod a
       Felhasználási feltételeket, és tudomásul veszed az Adatkezelési
       tájékoztatót." */
    legalNoticeBefore: "A fiók létrehozásával elfogadod a ",
    legalNoticeTerms: "Felhasználási feltételeket",
    legalNoticeBetween: ", és tudomásul veszed az ",
    legalNoticePrivacy: "Adatkezelési tájékoztatót",
    legalNoticeAfter: ".",
    signOut: "Kijelentkezés",
    signOutConfirmTitle: "Kijelentkezel?",
    signOutConfirmBody: "Újra be kell majd jelentkezned a naplózáshoz.",
    genericError: "Hiba történt. Próbáld újra.",
    emailRequired: "Add meg az e-mail címed.",
    passwordRequired: "Add meg a jelszavad.",
    nameRequired: "Add meg a neved.",

    /**
     * The auth API's error codes a person can cause, in Hungarian. Keyed by
     * the `code` on AuthApiError; anything not here falls back to
     * `genericError`. See authErrorMessage in services/authService.ts.
     */
    errors: {
      invalid_credentials: "Hibás e-mail cím vagy jelszó.",
      email_not_confirmed: "Ezt a címet még nem erősítetted meg. Nézd meg a postaládád.",
      email_address_invalid: "Ez nem tűnik érvényes e-mail címnek.",
      validation_failed: "Ez nem tűnik érvényes e-mail címnek.",
      user_already_exists: "Ezzel a címmel már van fiók. Jelentkezz be.",
      email_exists: "Ezzel a címmel már van fiók. Jelentkezz be.",
      weak_password: "A jelszó legyen legalább 8 karakter.",
      same_password: "Az új jelszó nem egyezhet a régivel.",
      over_email_send_rate_limit: "Túl sok e-mailt kértél rövid időn belül. Próbáld később.",
      over_request_rate_limit: "Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.",
      session_expired: "A link lejárt. Kérj újat.",
      otp_expired: "A link lejárt. Kérj újat.",
      signup_disabled: "A regisztráció most szünetel.",
    } as Record<string, string>,

    /* Sign-up used to close its modal the moment the request resolved, which
       looks exactly like being signed in. With e-mail megerősítés on, it is
       not — so the screen now stays put and says what has to happen next. */
    confirmEmailTitle: "Nézd meg a postaládád",
    confirmEmailBody: (email: string) =>
      `Küldtünk egy megerősítő linket a(z) ${email} címre. Kattints rá, és utána tudsz bejelentkezni.`,
    confirmEmailSpam: "Ha pár percen belül nem érkezik meg, nézd meg a spam mappát is.",
    /* The one thing to do when the mail does not come. The API allows it
       once a minute per address, and says so through
       `over_email_send_rate_limit` above. */
    resendConfirmation: "Megerősítő levél újraküldése",
    resentConfirmation: "Elküldtük újra. Nézd meg a postaládád.",

    forgotPassword: "Elfelejtetted a jelszavad?",
    forgotTitle: "Új jelszó kérése",
    forgotBody:
      "Add meg az e-mail címed, és küldünk egy linket, amivel új jelszót állíthatsz be.",
    forgotButton: "Link küldése",
    /* Deliberately the same answer whether or not the address has an account:
       a form that distinguishes the two is a way to find out who is a member
       here. Supabase answers identically for the same reason. */
    forgotSentTitle: "Elküldtük, ha van ilyen fiók",
    forgotSentBody: (email: string) =>
      `Ha tartozik fiók a(z) ${email} címhez, már úton van rá a link. Egy óráig érvényes.`,

    resetTitle: "Új jelszó beállítása",
    resetBody: "Írd be az új jelszavad. Utána egyből be leszel jelentkezve.",
    newPasswordLabel: "Új jelszó",
    newPasswordAgainLabel: "Új jelszó még egyszer",
    resetButton: "Jelszó mentése",
    resetSaving: "Mentés…",
    resetDone: "Kész. Az új jelszavaddal vagy bejelentkezve.",
    /* The link carries a short-lived session. Landing here without one means
       it expired, was already used, or was opened on a different device from
       the one that asked — all of which look the same and have one answer. */
    resetNoLinkTitle: "Ez a link már nem érvényes",
    resetNoLinkBody:
      "Lejárt, vagy már használtad. Kérj egy újat, és nyisd meg ugyanezen az eszközön.",
    resetTooShort: "A jelszó legyen legalább 8 karakter.",
    resetMismatch: "A két jelszó nem egyezik.",
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


    castCrew: "Szereposztás és alkotók",
    castCount: (n: number) => (n === 1 ? "1 közreműködő" : `${n} közreműködő`),
    aboutHeading: "A darabról",
    readMore: "Tovább",
    readLess: "Kevesebb",
    venueEyebrow: "Színház",
    followingEyebrow: "Követettek",

    /**
     * The block where the public average used to be.
     *
     * Second person, because that is the whole point of it: the production
     * page tells you what *you* gave it rather than what two strangers
     * averaged to. Shown only to somebody who has rated it.
     */
    yourRatingTitle: "A te értékelésed",
    yourRatingSeen: (date: string) => `Láttad: ${date}`,
    /* An evening with no date is a real answer since 0026 — a ticked title
       from the archives — so the caption says that rather than nothing. */
    yourRatingUndated: "Dátum nélkül",
    /** The way into the entry itself, on the right of the heading. */
    yourRatingOpen: "A bejegyzés",
    /* Above one visit the count replaces it: a single figure standing over
       three evenings would quietly claim to be all of them. */
    yourRatingEntries: (n: number) => `${n} bejegyzés`,
    /* Labels for the three per-dimension bars inside that block. Restored
       with the bars themselves: these describe one person's own answer now,
       not an average of everybody's. */
    acting: "Színészi játék",
    directing: "Rendezés",
    setDesign: "Díszlet",
    ticketsShort: "Jegyek ↗",
    fromFollowing: "Vélemények",
    reviewsCount: (n: number) => `${n} vélemény`,
    noReviewsYet: "Erről az előadásról még senki nem írt.",
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
    /**
     * A production the house is hosting rather than staging.
     *
     * Takes the theatre’s own line verbatim rather than composing one from the
     * company name, because Hungarian picks the definite article by the sound
     * that follows it — *a* Kolozsvári, *az* Örkény — and the source has
     * already made that choice correctly. `plays.produced_by` is the field to
     * read when a machine needs the company; this is the field to print.
     */
    guestRun: (line: string) => `Vendégjáték — ${line}`,
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
    /* The three acts of the form, in the order they are asked. */
    stepLabels: ["Este", "Értékelés", "Jegyzet"],
    stepWhenTitle: "Melyik este volt?",
    stepRateTitle: "Öt maszk, három szempont",
    stepRateHint: "Az összesített a kötelező kérdés; a három szempont csak ha van róla véleményed.",
    stepNoteTitle: "Mit gondoltál róla?",
    stepNoteHint: "Nem kötelező. Évek múlva ez lesz, amire emlékszel.",
    next: "Tovább",
    back: "Vissza",
    overallRating: "Összesített értékelés",
    acting: "Színészi játék",
    directing: "Rendezés",
    setAndCostume: "Díszlet és jelmez",
    /* All four rows are optional, and tapping the mask you already chose is
       the only way back to "not answered" once you have answered. */
    clearRatingHint: "A kiválasztott maszkra újra koppintva törölheted az értékelést.",
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
    /* The third quick pick, and the chip's label for an entry that has no date. */
    noDate: "Dátum nélkül",
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

    /* Everything from here to `notYetStarted` belongs to three questions the
       form no longer asks — the cast, the seat and the price. Kept rather than
       deleted: entries that answered them still show them on the entry screen,
       and if any of the three comes back it should come back already written
       rather than hastily retranslated. (The fourth, the ticket photo, is gone
       for good: a ticket carries a name and a booking code, and a photo of it
       has no place in this app.) */
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
    /* Tonight's show, logged this morning. */
    notYetStarted: (time: string) => `Ez az előadás ${time}-kor kezdődik — naplózd, ha már láttad.`,
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
    /* One line per kind. They live in i18n/notificationCopy.ts now, because
       the push sender renders the same sentences on Deno and cannot reach
       this file; spread here so `strings.inbox.*` keeps answering. */
    ...notificationLines,
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

  /**
   * Bejelentés és letiltás.
   *
   * A hangnem szándékosan tárgyilagos. Aki ezeket a szövegeket olvassa, annak
   * épp rossz napja van, és az utolsó dolog, amire szüksége van, az egy vidám
   * alkalmazás. Semmi felkiáltójel, semmi biztatás, és sehol nem ígérünk olyat
   * — „megvizsgáljuk", „24 órán belül" —, amit egy egyszemélyes üzemeltetés nem
   * tud betartani.
   */
  moderation: {
    report: "Bejelentés",
    reported: "Bejelentve",
    reportTitleReview: "Bejegyzés bejelentése",
    reportTitleComment: "Hozzászólás bejelentése",
    reportTitleProfile: "Felhasználó bejelentése",
    reportLead:
      "Mi a baj ezzel a tartalommal? A bejelentés névtelen: akit bejelentesz, nem tudja meg, hogy te tetted.",
    reasons: {
      harassment: "Zaklatás vagy célzott támadás",
      hate: "Gyűlöletkeltés",
      spam: "Kéretlen tartalom vagy reklám",
      sexual: "Szexuális tartalom",
      violence: "Erőszak vagy önveszélyes tartalom",
      misinformation: "Megtévesztő állítás",
      other: "Egyéb",
    } as const,
    notePlaceholder: "Ha szeretnéd, írd le röviden (nem kötelező)",
    submit: "Bejelentés elküldése",
    submitting: "Küldés…",
    /* Nincs benne határidő. Egy ember nézi át, és jobb nem ígérni semmit. */
    submitted: "Köszönjük. A bejelentést megkaptuk, és átnézzük.",
    alreadyReported: "Ezt már bejelentetted.",
    failed: "Nem sikerült elküldeni a bejelentést.",
    signInToReport: "Jelentkezz be a bejelentéshez",

    block: "Felhasználó letiltása",
    unblock: "Letiltás feloldása",
    blocked: "Letiltva",
    blockConfirmTitle: (name: string) => `Letiltod őt: ${name}?`,
    blockConfirmBody:
      "Nem fogjátok látni egymás bejegyzéseit és hozzászólásait, és a köztetek lévő követés megszűnik. Erről nem kap értesítést. Bármikor feloldhatod a Beállításokban.",
    blockConfirm: "Letiltás",
    blockFailed: "Nem sikerült letiltani.",
    unblockFailed: "Nem sikerült feloldani a letiltást.",

    blockedListTitle: "Letiltott felhasználók",
    blockedListEmpty: "Még senkit nem tiltottál le.",
    blockedListLead: "Az ő bejegyzéseiket és hozzászólásaikat nem látod, és ők sem a tieidet.",
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
    /* Named, because a diary entry is not one row: the date, the ratings, the
       note, the tags and everybody's comments under it all go with it. Seat,
       price and cast are not listed since the form stopped asking for them;
       an old entry that holds them loses them too, which "minden" covers. */
    deleteConfirmBody:
      "A dátum, az értékelés, a vélemény, a címkék és a hozzászólások is törlődnek — minden, ami ehhez az estéhez tartozik. Ezt nem lehet visszavonni.",
    deleteFailed: "Nem sikerült törölni a bejegyzést. Próbáld újra.",
    rewatch: "Újranézés",
    castHeading: "Akiket aznap este láttál",
    castAlternateBadge: "beugró",
    seatHeading: "Hely",
    priceHeading: "Jegyár",
    priceValue: (huf: number) => (huf === 0 ? "Tiszteletjegy" : `${huf.toLocaleString("hu-HU")} Ft`),
    reviewHeading: "Vélemény",
    openPlay: "Az előadás adatlapja",
  },

  /**
   * The share sheet on a diary entry, and the card it makes (T-108). Two
   * formats: the square that goes anywhere, and the 9:16 story that Instagram
   * takes as a full screen. The opinion — the review text, the tags, the cast —
   * is a switch that is off by default and is only offered on your own entry:
   * a story travels further than the feed, and the app puts nobody's opinion
   * on a card but their own, by their own hand.
   */
  shareCard: {
    sheetTitle: "Megosztás képként",
    lead: "Készítünk egy képet erről az estéről, amit bárhova elküldhetsz.",
    square: "Négyzet",
    squareBlurb: "Feed, üzenet, bármelyik alkalmazás",
    story: "Story",
    storyBlurb: "Álló, 9:16 — Instagram és a többiek storyjához",
    withOpinion: "A véleményem is legyen rajta",
    withOpinionBlurb: "A szöveg, a címkék és a szereplők, akiket láttál",
    preparing: "Kép készítése…",
    /** Before the names on the card: "Láttam: Ónodi Eszter, Fekete Ernő". */
    castPrefix: "Láttam: ",
    /**
     * The card's colophon. The domain is what a person can type after seeing
     * a story; the landing page's subtitle says what they would find. Both
     * are printed, never localised into the app's name alone — see
     * `SHARE_CARD.wordmark` in services/shareCardSpec.ts.
     */
    domain: "vastaps.app",
    tagline: "magyar színházi napló",
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

  /**
   * The first run (T-083): opened once, by `FirstRunGate`, the first time a
   * new account lands on a tab. Three short questions and the archive grid,
   * every one of them skippable, none of them answered in advance.
   */
  firstRun: {
    headerTitle: "Üdv a Vastapsban",
    skipAll: "Kihagyom",
    later: "Később",
    next: "Tovább",
    stepLabels: ["Név", "Város", "Színházak", "Láttad"],

    nameTitle: "Hogy szólítsunk?",
    nameLede: "Ez a név áll majd a bejegyzéseid fölött. A felhasználónév az, amivel mások megtalálnak.",

    cityTitle: "Hol jársz színházba?",
    cityLede: "A Felfedezés ezt a várost nyitja meg először, és a következő lépés ennek a színházait ajánlja. Bármikor átállíthatod.",

    theatresTitle: "Melyik színházakat követnéd?",
    theatresLede: "Ha egy követett színház új előadást hirdet, a postaládádban látod. Egy koppintás követ, még egy elenged.",
    theatresEmpty: "Ebben a városban még nincs színház a katalógusban.",
    follow: (n: number) =>
      n === 0 ? "Válassz színházat" : n === 1 ? "1 színház követése" : `${n} színház követése`,

    doneTitle: "Készen állsz.",
    doneBody:
      "A postaládád szól, ha egy követett színház bemutatót hirdet, vagy egy kívánságlistás előadás új időpontot kap. A naplód a tiéd: hogy hol jártál, mindenki látja, hogy mit gondoltál, csak a követőid.",
    doneButton: "Irány a Felfedezés",

    saveError: "Nem sikerült menteni. Próbáld újra.",
  },

  /**
   * The ask for notification permission, in the app's words, before the OS
   * dialog (T-089). Shown at the end of the first run and on a watchlist
   * that holds something.
   */
  pushPrimer: {
    eyebrow: "Értesítések",
    title: "Szóljunk az este előtt?",
    body:
      "Ha egy kívánságlistás előadást holnap játszanak, vagy egy követett színház bemutatót hirdet, küldünk egy értesítést. Csak azt, amit kérsz — a beállításokban bármikor módosíthatod.",
    accept: "Kérek értesítést",
    later: "Most nem",
    done: "Bekapcsolva. Szólunk az este előtt.",
  },

  /**
   * The feedback layer (T-085 to T-088): the toast that answers an action,
   * the undo on it, the offline banner and the error screen.
   */
  feedback: {
    dismiss: "Bezárás",
    undo: "Visszavonás",
    watchlistRemoved: (title: string) => `Levéve a kívánságlistáról: ${title}`,
    watchlistAdded: (title: string) => `A kívánságlistádon: ${title}`,
    entryDeleted: "Az este törölve.",
    entryRestored: "Visszaállítva.",
    listEntryRemoved: (title: string) => `Levéve a listáról: ${title}`,
    profileSaved: "A profilod mentve.",
    entrySaved: "Elmentve a naplódba.",
    entryUpdated: "A bejegyzés frissítve.",
    linkCopied: "Link a vágólapon.",
    followed: (name: string) => `Követed: ${name}`,
    unfollowed: (name: string) => `Már nem követed: ${name}`,
    offline: "Nincs kapcsolat. Amit látsz, az utoljára betöltött állapot.",
    errorTitle: "Ez itt elakadt.",
    errorBody: "Valami hibázott ezen a képernyőn. Próbáld újra; ha megint megtörténik, írd meg nekünk.",
    errorRetry: "Újra",
    errorReport: "Megírom",
  },

  /** Productions gathered under a title — user-made and editorial alike. */
  lists: {
    headerTitle: "Listák",
    headerFallback: "Lista",
    featuredHeading: "Szerkesztői listák",
    featuredEyebrow: "Válogatás",
    mineHeading: "A listáim",
    mineEyebrow: "Saját",
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
    /* Editing, on the list's own page: the same four fields as creation. */
    editList: "Szerkesztés",
    save: "Mentés",
    saving: "Mentés…",
    updateError: "Nem sikerült menteni. Próbáld újra.",
    /* Public is the default; this is the exception, phrased as one. */
    privateLabel: "Privát lista",
    privateHint: "Csak te látod. Nem jelenik meg a profilodon és a Listák között.",
    /* Above the composer when a production's page sent the reader here. */
    attachNotice: (title: string) => `„${title}” rákerül az új listára.`,
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
    /**
     * Marks a credit earned with a visiting company rather than with the house
     * the row names. The venue stays on the row because it is why the evening
     * is in this catalogue at all — and because the coverage note below the
     * list counts theatres, not companies.
     */
    guestRun: "vendégjáték",
    director: "Rendező",
    venueCount: (n: number) => `${n} színház`,
    // What the page is counting, said out loud. Without it a career this
    // catalogue only partly holds reads as a complete one — see T-020: a
    // spot-check found three credits missing for three different structural
    // reasons, and the page presented the result as the whole story either
    // way. The second half names the other reason a name can be missing from
    // a production the catalogue *does* hold.
    coverageNote: (n: number, venues: string) =>
      `Ez a lista ${n} színház műsorából készül: ${venues}. Ami máshol ment, ide nem kerül be — ` +
      `és ahol a színház nem közöl szereposztást, ott az előadás szerepel a katalógusban, az alkotói nem.`,
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
    /* Used to say that nothing was sent yet. Since T-089 something is: a
       device that has push switched on hears about it, and the settings
       screen is where that is turned on. */
    notYetSending: "Szólunk, ha új előadást hirdet. Az értesítéseket a beállításokban kapcsolhatod be.",
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
    /* The season on the reader's card, the way a theatre prints it: 2026/27. */
    seasonEyebrow: (start: number) => `${start}/${String(start + 1).slice(-2)} · évad`,
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
      lavenderLight: "Levendula",
      velvetDark: "Bársony",
      playbillLight: "Színlap",
      minimalLight: "Letisztult",
      modernDark: "Éjszakai",
    },
    themeBlurbs: {
      lavenderLight: "Világos levendula, ibolya kiemeléssel.",
      velvetDark: "A ház stílusa: bársonyfüggöny, arany fényben — az alapértelmezett sötét.",
      playbillLight: "Ugyanaz a színlap, nyomtatva: krém papír, tinta és bordó — az alapértelmezett világos.",
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
    /* Biztonság. A jogi blokk alatt, de a fiókműveletek fölött: nem jogi
       szöveg, de nem is olyasmi, amit véletlenül kell megtalálni. */
    safety: "Biztonság",
    blockedUsers: "Letiltott felhasználók",
    blockedUsersHint: "Kit nem látsz, és ki nem lát téged. Bármikor feloldható.",

    /* The installable web app (6.4). Shown only where it applies: a browser
       that can offer the install, or iOS Safari, where the person does it by
       hand — and never once the app is already running from the Home Screen. */
    install: "Telepítés",
    installHint:
      "A Vastaps a kezdőképernyőre tehető: saját ikonnal, teljes képernyőn, böngészősáv nélkül nyílik.",
    installButton: "Telepítés a kezdőképernyőre",
    installIosHint:
      "Safariban: koppints a Megosztás gombra, majd a „Hozzáadás a Főképernyőhöz” sorra.",

    /* Notifications (T-089). The device switch first, then what to be told
       about; the second list applies to every device the person has. */
    notifications: "Értesítések",
    notificationsHint:
      "Amit itt bekapcsolsz, arról értesítést kapsz erre az eszközre — az esti előadásról, egy követett színház bemutatójáról.",
    notificationsEnable: "Bekapcsolás ezen az eszközön",
    notificationsEnabled: "Bekapcsolva ezen az eszközön.",
    notificationsDisable: "Kikapcsolás",
    notificationsUnsupported:
      "Ez a böngésző nem tud értesítést mutatni. iPhone-on előbb tedd az appot a kezdőképernyőre, és onnan nyisd meg.",
    notificationsDenied:
      "A böngésző letiltotta az értesítéseket ehhez az oldalhoz. A címsor melletti lakat ikonnál engedélyezheted újra.",
    /* Named for the channel it actually governs (T-118). These toggles are
       read only by `send-push`; `generate_notifications()` writes the inbox
       row whatever they say, so a heading that asked "miről szóljunk?" was
       promising something wider than the switch delivers. */
    notificationsKinds: "Mi szóljon a telefonodon?",
    notificationsKindsHint:
      "A kikapcsoltakról nem szól a telefonod — az appban, a harang alatt továbbra is megtalálod őket.",
    notificationsError: "Nem sikerült bekapcsolni. Próbáld újra.",
    /* The Play build cannot register for push until it ships with Firebase
       configuration (T-107); until then this is the honest answer, not
       "try again". */
    notificationsUnavailable:
      "Ezen a verzión az értesítés még nem kapcsolható be — a következő alkalmazásfrissítés hozza.",
    /* The weekly letter (T-090). Default on; the letter itself carries the
       way out, and this is the same switch from the other side. */
    digest: "Heti levél e-mailben",
    /* Shortened with the rest of the settings prose (T-117), down to the two
       things the title does not already say: what is in it, and that it does
       not arrive when there is nothing to put in it. */
    digestHint: "A hét előadásai a listáidról és a követett színházaidból. Üres hétről nem írunk.",

    /* The account's own two controls. Only shown to somebody signed in —
       there is nothing to export or delete otherwise — which is why they sit
       here rather than beside the theme rows. */
    account: "A fiókod",
    exportTitle: "Adataim letöltése",
    exportHint:
      "A profilod, a naplód, az értékeléseid, a listáid és a követéseid egyetlen JSON-fájlban.",
    exportButton: "Letöltés",
    exportWorking: "Összeállítás…",
    /* Said rather than hidden, the same way the share card says it: a control
       that quietly does nothing teaches people the app is a mockup. */
    exportUnsupported: "Az adatok letöltése egyelőre csak böngészőben működik.",
    exportError: "Nem sikerült összeállítani az adataidat. Próbáld újra.",

    deleteTitle: "Fiók törlése",
    /* Names what goes and what stays. A production somebody added by hand
       survives them (plays.created_by is `on delete set null`), and finding
       that out afterwards would feel like the deletion had not worked. */
    deleteHint:
      "Véglegesen törli a profilodat, a naplódat, az értékeléseidet, a listáidat, a követéseidet és a feltöltött képeidet. Az általad felvett előadások a katalógusban maradnak, de többé nem kapcsolódnak hozzád. Ez nem vonható vissza.",
    deleteStart: "Fiók törlése",
    /* Typing a word rather than pressing a second button: this is the one
       action in the app that nothing can undo, and a two-tap confirmation is
       the same gesture as the tap that opened it. */
    deleteConfirmWord: "TÖRLÉS",
    deleteConfirmPrompt: (word: string) =>
      `Írd be, hogy „${word}”, ha biztos vagy benne.`,
    deleteConfirm: "Végleges törlés",
    deleteWorking: "Törlés…",
    deleteError: "Nem sikerült törölni a fiókot. Próbáld újra, vagy írj nekünk.",

    /* Üzemeltetés: a számok. Csak az üzemeltető fiókja látja — a sor maga
       is csak neki jelenik meg (T-099). */
    operations: "Üzemeltetés",
    stats: "Használati számok",
    statsHint: "Regisztrációk, bejegyzések, ki jött vissza, melyik eszköz figyel.",
  },

  /**
   * Az üzemeltető műszerfala (T-099). A címkék rövidek, mert csempéken
   * állnak; a magyarázat a szakasz alcímében van.
   */
  stats: {
    headerTitle: "Használati számok",
    signInPrompt: "Jelentkezz be a számokhoz",
    notForYou: "Itt nincs semmi",
    notForYouBody: "Ez az oldal az üzemeltetőé.",
    loading: "Számolás…",
    reload: "Frissítés",
    generatedAt: (day: string, time: string) => `Állapot: ${day} ${time}`,
    excluded: (n: number) => `${n} fiók nincs beleszámolva (demó és üzemeltető).`,

    today: "Ma",
    active1d: "aktív az elmúlt 24 órában",
    new7d: "új fiók 7 nap alatt",
    entries7d: "bejegyzés 7 nap alatt",

    signups: "Regisztrációk",
    signupsHint: "Az elmúlt 14 nap, naponta. „Aktív”: bejelentkezett vagy csinált valamit.",
    accountsTotal: "fiók összesen",
    accountsConfirmed: "megerősített e-mail",
    accountsOnboarded: "látta a bemutatkozást",
    new30d: "új fiók 30 nap alatt",
    active7d: "aktív 7 napon belül",
    active30d: "aktív 30 napon belül",

    entries: "Bejegyzések",
    entriesHint: "Naplóbejegyzések az elmúlt 14 napban, és összesen.",
    entriesTotal: "bejegyzés összesen",
    entriesRated: "értékeléssel",
    entriesWithText: "szöveggel",
    entries30d: "bejegyzés 30 nap alatt",
    authors30d: "író 30 nap alatt",
    watchlist: "kívánságlistán",

    social: "Kapcsolatok",
    followsAccepted: "elfogadott követés",
    followsPending: "függő kérés",
    subjectFollows: "követett színház / alkotó",
    likes: "kedvelés",
    comments: "hozzászólás",
    lists: "lista",

    devices: "Eszközök",
    devicesHint: "Hány fiók kapcsolt be értesítést: a Play-alkalmazásból, illetve böngészőből vagy a kezdőképernyőről.",
    pushExpo: "Android app",
    pushWeb: "web / PWA",
    digestEnabled: "heti levelet kér",

    recent: "Legutóbbi fiókok",
    recentHint: "A tizenkét legfrissebb regisztráció. A szám a bejegyzéseik.",
    recentEmpty: "Még senki.",
    noName: "(név nélkül)",
    joinedOn: (day: string) => `csatlakozott ${day}`,
    lastSeen: (when: string) => `utoljára ${when}`,
    neverSeen: "még nem lépett be",
    unconfirmed: "e-mail nincs megerősítve",

    catalogue: "Katalógus",
    plays: "előadás",
    venues: "színház",
    upcoming: "közelgő időpont",
    lastSync: (when: string, errors: number) =>
      errors > 0 ? `Utolsó szinkron ${when}, ${errors} hiba 24 órán belül` : `Utolsó szinkron ${when}`,
    noSync: "Még nem futott szinkron",

    barsLabel: (total: number) => `Napi oszlopok, összesen ${total}`,
    barsTotal: (total: number) => `összesen ${total}`,

    elapsedNow: "az imént",
    elapsedHours: (h: number) => `${h} órája`,
    elapsedYesterday: "tegnap",
    elapsedDays: (d: number) => `${d} napja`,

    /* A kérdőív. Ugyanazok a számok, mint a scripts/research-report.ts
       jelentésében, csak élőben; a címkék a kérdőív tervéből jönnek. */
    research: "Kérdőív",
    researchHint: (version: number) =>
      `A ${version}. változat válaszai. Harminc alatt csak darabszám: a rangsor teteje és alja mond valamit, a közepe zaj.`,
    researchAnswers: "válasz",
    researchOlder: "korábbi változat",
    researchEmails: "e-mail az indulásról",
    researchRange: (first: string, last: string) => (first === last ? `Beérkezett: ${first}` : `Beérkezett ${first} és ${last} között`),
    researchSources: (list: string) => `Forrás szerint: ${list}`,
    researchNoSource: "(nincs)",
    researchEmpty: "Ehhez a változathoz még nincs válasz.",
    researchRatings: "Mennyit érnek a funkciók",
    researchRatingsHint:
      "Ezért nyitnám meg · jó, hogy van · nem tűnne fel · nem használnám. A nettó: „ezért” kétszer, „jó” egyszer, „nem” mínusz egy.",
    researchRatingCells: (ezert: number, jo: number, mindegy: number, nem: number) => `${ezert} · ${jo} · ${mindegy} · ${nem}`,
    researchNet: (net: number) => `${net > 0 ? "+" : ""}${net}`,
    researchPicks: "Melyik háromért vennék elő",
    researchPicksHint: "Hányan tették a három közé. Ez a szűkebb rangsor: nem az, mi jó, hanem az, mi az ok.",
    researchMissing: "Ha kimaradna az indulásból",
    researchMissingHint: "Hiányozna · nem tűnne fel · jobb is nélküle.",
    researchMissingOther: "Mi más hiányzik — a saját szavaikkal",
    researchVerdict: {
      base: "alap",
      wanted: "kellene",
      later: "későbbre",
      no: "inkább ne",
      none: "nincs válasz",
    },
    researchBehaviour: "Hogyan járnak színházba ma",
    researchOther: "máshol:",
    researchOpen: "„Mitől használnád minden színházi este után?”",
    researchOpenEmpty: "Még nincs szöveges válasz.",
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
    /* The @name. Shown with the @ on every profile, typed without it here. */
    handleLabel: "Felhasználónév",
    handlePlaceholder: "pl. kovacsbence",
    handleHint: "Ez jelenik meg @-cal a neved alatt. Kisbetűk, számok és aláhúzás, 3–30 karakter.",
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
    errorHandleShape: "A felhasználónév 3–30 karakter lehet: kisbetű, szám és aláhúzás.",
    errorHandleTaken: "Ez a felhasználónév már foglalt. Válassz másikat.",
    errorPhotoPermission: "A képfeltöltéshez engedélyt kell adnod a galériához.",
    errorPhotoUpload: "A kép feltöltése nem sikerült. Próbáld újra.",
    errorBioTooLong: "A bemutatkozás legfeljebb 280 karakter lehet.",
  },

  people: {
    follow: "Követés",
    unfollow: "Követés visszavonása",
    followingLabel: "Követed",
    /* A follow is a request since 0065 (T-095): the button says so while it
       waits, and pressing it again withdraws the request. */
    requested: "Kérelem elküldve",
    withdrawRequest: "Kérelem visszavonása",
    requestHint: "Ha elfogadja, látni fogod, mit gondolt az előadásokról.",
    /* The follower lists behind the two numbers on the profile (T-096). */
    requestsTitle: "Kérelmek",
    requestsEmpty: "Nincs függő kérelem.",
    requestsHint: "Ők szeretnének követni. Aki követ, az látja a véleményeidet.",
    accept: "Elfogadom",
    decline: "Elutasítom",
    removeFollower: "Eltávolítás",
    pendingRequests: (n: number) => (n === 1 ? "1 követési kérelem" : `${n} követési kérelem`),
    acceptedToast: (name: string) => `${name} mostantól követ.`,
    declinedToast: (name: string) => `Elutasítva: ${name}.`,
    removedToast: (name: string) => `${name} már nem követ.`,
    searchTitle: "Színházbarátok",
    searchPlaceholder: "Név vagy @felhasználónév",
    searchEmpty: "Nincs ilyen felhasználó.",
    followersTitle: "Követők",
    followingTitle: "Követettek",
    followersEmpty: "Még senki nem követi.",
    followingEmpty: "Még senkit nem követ.",
    signInToFollow: "Jelentkezz be a követéshez",
    /* The signed-out /people screen: the search above still works. */
    signInPrompt: "Jelentkezz be, hogy lásd, kiket követsz — és hogy követhess valakit.",
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
