[English](README.md) · **Magyarul**

> Ez a magyar változat. Az eredeti az angol `README.md` — ha a kettő valaha
> ellentmond egymásnak, az angol az érvényes, és azt kell javítani.

# Színház Tracker

Mobilalkalmazás magyar színházba járóknak: rögzítsd, pontozd és írd meg, mit
láttál. Expo + React Native + TypeScript alapon, a navigáció fájlalapú,
[expo-router](https://docs.expo.dev/router/introduction/)-rel.

## Beállítás

```bash
npm install
npx expo install --fix
```

Ezután hozz létre egy [Supabase](https://supabase.com) projektet (az ingyenes
csomag bőven elég), futtasd le a `supabase/migrations/` **összes** fájlját
**sorrendben** (`0001_init.sql`-től a `0029_standing_follows.sql`-ig) a projekt
SQL-szerkesztőjében, majd másold a `.env.example`-t `.env`-re, és töltsd ki a
projekt Settings → API oldaláról az URL-t és az anon kulcsot:

```bash
cp .env.example .env
```

A második parancs fontos: minden `expo-*` / `react-native-*` csomagot
újrafeloldja arra a verzióra, ami a telepített Expo SDK-hoz ténylegesen aktuális
és kompatibilis — vagyis kijavítja azt, ami a `package.json`-ben elcsúszott
azóta (2026. augusztus), hogy ez íródott.

Ha az `npx expo install --fix` azt jelzi, hogy a
`@expo-google-fonts/bodoni-moda` vagy a `@expo-google-fonts/sora` nem létezik
pontosan ezen a néven, keresd meg mindkét betűtípushoz a helyes csomagot az
[npmjs.com](https://www.npmjs.com/search?q=%40expo-google-fonts)-on, és cseréld
ki a `hooks/useAppFonts.ts`-ben — az app többi részét ez nem érinti, mert minden
képernyő rendszer talpas/talpatlan betűre esik vissza, amíg a márkabetűk be nem
töltenek (lásd `theme/typography.ts`).

## Futtatás

```bash
npx expo start --web    # böngészőben nyílik — így lehet a leggyorsabban iterálni
npx expo start          # utána i / a az iOS szimulátorhoz / Android emulátorhoz,
                        # vagy olvasd be a QR-kódot telefonon az Expo Góval
```

A webes kiadás éles kiszolgálásra is kész: a `Dockerfile` `expo export`-tal
építi a statikus oldalt, és nginx (`nginx.conf`) szolgálja ki.

## Felépítés

```
app/                     expo-router képernyők (fájlalapú útvonalak)
  _layout.tsx             gyökér stack: tabok + előadás oldal + rögzítés/
                          előadás-felvitel/auth modálok
  (tabs)/
    _layout.tsx            tab navigátor, saját TabBar
    index.tsx               Feed
    discover.tsx             Felfedezés — két mód (böngésző sávok / Műsor
                              naptár), rangsorolt keresés, rendezés, szűrők
    watchlist.tsx             Figyelőlista
    profile.tsx                Profil
  play/[id].tsx           Előadás részletei
  person/[slug].tsx       Egy alkotó, és minden, amiben szerepel
  list/[id].tsx           Egy lista és a tartalma
  entry/[id].tsx          Egy este: kiket láttál, hol ültél, mennyibe került
  lists.tsx               Szerkesztői listák és a sajátjaid (modál)
  checkin.tsx             Előadás rögzítése — dátum, értékelés, vélemény (modál)
  onboarding.tsx          "Mit láttál már?" — első indítás rácsa a színházak
                          archívuma fölött (modál)
  add-play.tsx            Előadás kézi felvitele (modál, belépés kell hozzá)
  edit-profile.tsx        Kép, név, város és bemutatkozás (modál, belépés kell)
  sign-in.tsx / sign-up.tsx  Auth modálok

components/
  icons/                  kézzel rajzolt SVG ikonok, köztük az álarc-értékelő jel
  ui/                     Button, Chip, SelectChip, DateField, Avatar,
                          FollowSubjectButton, PosterPlaceholder, TabBar

theme/                    tervezési tokenek — a „Velvet Curtain" vizuális
                          rendszer egyetlen forrása
  colors.ts               a paletta, mellette az OKLCH érték, amiből az adott
                          hexa származik
  typography.ts           a két márkabetű és a visszaesési sorrendjük
  type.ts                 a tipográfiai skála: nyolc megnevezett szerep
  tokens.ts               térközök, lekerekítések, árnyékszintek, töréspontok,
                          maximális szélességek

contexts/AuthContext.tsx  Supabase munkamenet-állapot, az egész appot körbeveszi

utils/people.ts           névkanonizálás, slug-képzés és profil-kezdőbetűk — a
                          person_slug() és a profile_initials()
                          adatbázisfüggvény kliensoldali fele
utils/calendar.ts         a dátumválasztó hónaprács-számításai, a komponensen
                          kívül tartva, hogy tesztelhető legyen
utils/datetime.ts         magyar dátum- és időformázás, Europe/Budapest
                          zónára rögzítve
utils/money.ts            forintösszeg kiolvasása szövegmezőből, és a különbség
                          a tiszteletjegy meg a „nem adta meg" között

data/types.ts             domain típusok (Play, Venue, Review, User, …)
services/supabase.ts      a Supabase kliens (az EXPO_PUBLIC_SUPABASE_*-ot olvassa)
services/playsService.ts  a képernyők KIZÁRÓLAG innen kapnak előadás/helyszín/
                          felhasználó adatot — Supabase lekérdezésekkel
services/peopleService.ts egy alkotó közreműködései, a play_cast és a
                          plays.director táblát együtt olvasva
services/listsService.ts  listák és a bejegyzéseik, felhasználói és
                          szerkesztői egyaránt
services/profileService.ts  a profil szerkeszthető fele — profilkép feltöltése,
                          bemutatkozás, és a tárolt kép nyilvános URL-je
services/searchService.ts rangsorolt, ékezetfüggetlen keresés elgépelés-tűréssel,
                          előadásokban/helyszínekben/szereplők közt
                          (Postgres RPC)
services/authService.ts   regisztráció / belépés / kilépés

supabase/migrations/      séma, RLS szabályok, triggerek és RPC-k (kézzel kell
                          lefuttatni a Supabase SQL-szerkesztőjében)

sync/                     önálló Node szkript (`npm run sync`; a `-- --dry-run`
                          kapcsolóval adatbázis nélkül is ellenőrizhető egy
                          adapter az élő forrásokon), ütemezetten futtatja a
                          .github/workflows/sync-plays.yml. A színházak saját
                          jegyértékesítő felületeiről szedi le az aktuális
                          műsort, és a service-role kulccsal írja be a
                          Supabase-be — forrásonkénti jegyzetek a
                          sync/adapters/ alatt és a megvalósítási tervben
  __fixtures__/           lementett oldalak minden lekapart forrásból, hogy az
                          adaptertesztek (`npm test`) elkapják, ha egy színház
                          átírja a HTML-jét — ne az legyen a jelzés, hogy
                          elnémul a katalógus

.github/workflows/
  ci.yml                  típusellenőrzés + lint + tesztek minden pushra és
                          PR-re — a webes build sosem érinti a sync/-et, így ez
                          fogja meg az elromlott adaptert, mielőtt az éjszakai
                          futás tenné
  sync-plays.yml          a napi műsorszinkron
```

## Tervezési rendszer

A színek és a tipográfia a `theme/`-ben laknak. A paletta ugyanaz a „Velvet
Curtain" rendszer, mint a tervezővásznon: majdnem fekete, meleg bordó háttér,
meleg arany kiemelőszín, Bodoni Moda a kiemelt szövegre, Sora a felület
szövegére, és egy saját színházi álarc ikon mindenütt, ahol egyébként csillagos
értékelés lenne.

A `theme/colors.ts` dokumentálja, melyik hexa konstans melyik OKLCH értékből
lett átváltva, arra az esetre, ha később hangolni kell a palettán — a React
Native stílusmotorja nem fogad el `oklch()`-t, ezért itt minden előre átváltott
sRGB hexa.

Két szabályt érdemes ismerni, mielőtt bárki új képernyőt ír:

- **Sose állíts be betűméretet kézzel.** A `components/ui/Text` egy `variant`-ot
  (display / title / heading / subheading / body / bodySmall / label / caption)
  és egy `tone`-t vár. Korábban a méretek a hívás helyén voltak beírva — így
  gyűlt össze belőlük húsz. Az egyetlen kivétel a `TextInput`, ami nem tudja
  használni ezt a komponenst, és `inputFontSize`-t kap: 16px, mert az iOS Safari
  ránagyít az oldalra, ha egy fókuszált mező szövege ennél kisebb.
- **A Bodoni Moda csak kiemelt szövegre való, 19px-től felfelé.** Didone betű: a
  vastag-vékony kontraszt, ami címméretben megadja az appnak a színlap-
  karakterét, képaláírás-méretben masszává olvad, mert a hajszálvonalak egy pixel
  alá esnek. A `theme/type.ts` ezt ki is kényszeríti — a `heading` alatti minden
  szerep Sora.

A `textFaint` `#80716d`-ről `#8a7a75`-re lett világosítva. Az eredeti 4,29:1-et
mért a háttérhez képest, ami kevés a WCAG AA által folyószövegre elvárt
4,5:1-hez — és pont ez a szín viszi az app legkisebb méretű metaadatait.

Az elrendezés reszponzív, nem csak telefonra való, mert a webes kiadás is
kimegy. A `hooks/useBreakpoint.ts` futásidőben olvassa a nézetablakot (a
react-native-webben nincs media query a `StyleSheet.create`-en belül), a
`components/ui/Screen` maximalizálja és középre húzza a tartalmat, a
`components/ui/Grid` pedig a saját mért szélességéből számol csempeszélességet,
nem százalékból.

## Hogyan találsz meg egy előadást, és mikor játsszák

Három dolog, amit a katalógus mostanáig nem tudott, és hogy pontosan mi volt a
baj mindegyikkel.

### A műfaj nem volt metaadat

A `plays.genre` nagyrészt nem forrásból származott, hanem ez a projekt találta
ki. 476 sorból 276 azt mondta, "próza", 167 pedig azt, "színház", és mindegyik
egy adapterbe drótozott `DEFAULT_GENRE` konstansból jött — ugyanazokban a
fájlokban ott a megjegyzés, hogy az oldal nem közöl műfajmezőt, aztán mégis
írtak egyet. További tizenkét sor műfaja "IX. MagdaFeszt" volt: fesztiválnév,
amit a Csokonai taxonómiája a valódi kifejezések mellé sorol, olyan sorokon,
amelyek közt díjátadó és koncert is akadt. Egy ilyen mezőre szűrő műfaj-chip
aszerint darabolta volna a katalógust, hogy melyik lekapó írta az adott sort.

A `0016_genre_taxonomy.sql` meghagyja a `genre`-ben azt, amit a forrás mondott
— a mező mostantól nullozható, tehát egy adapter mondhatja azt is, hogy semmit
—, és mellé képzi a `genre_normalized`-et egy rögzített szótár fölött. A
`genre_source` azt rögzíti, honnan jött ez a válasz, mert ezek valóban
különböző állítások:

| `genre_source` | jelentése |
|---|---|
| `source` | a színház saját taxonómiai kifejezése |
| `inferred` | innen származtatva az `author` mezőben álló zeneszerzőből — Verdi és Puccini nem írt operettet |
| `venue_default` | a ház profiljából feltételezve (`venues.default_genre`) |
| `user` | kézzel megadva, aki felvitte az előadást |

A következtetés szándékosan óvatos: ami nem ismerhető fel biztosan, az `zenés`
marad, nem kerekítjük `musical`-ra; és van egy rövid lista azokról a művekről,
ahol a szerző szokásos műfaja rossz választ adna erre a darabra — Offenbach száz
operettet írt és egy komoly operát, és a *Hoffmann meséi* az opera.

### A keresés nem rangsorolt, és ékezeteket követelt

A `search_plays` `order by pl.title`-lel végződött, tehát az eredmények
betűrendben jöttek, és egy szereposztás-találat megelőzhette azt a produkciót,
amit a keresés valójában néven nevezett. `ilike`-ot használt, ami ékezetérzékeny:
az "orkeny" semmit nem talált, a "szinhaz" sem. Egyetlen elgépelés pedig üres
képernyőt adott, aminek a felhívása az, hogy "vedd fel te magad" — így egy
félreütés egyenesen duplikált sorhoz vezetett.

A `0019_search_ranking.sql` bekapcsolja az `unaccent` és a `pg_trgm`
kiterjesztést — mindkettő végig elérhető volt a projektben —, és relevanciasávokat
ad (pontos cím > címkezdet > címben szerepel > szerző > rendező > helyszín >
színpad > műfaj), minden szó szerinti sáv alatt egy trigram-küszöbbel, így egy
elgépelés-találat soha nem előzhet meg egy valódit. A hibatűrő háló
`word_similarity`-t használ, nem `similarity`-t: a
`similarity('csokonay', 'csokonai nemzeti szinhaz')` értéke 0,26, mert az egész
célszöveggel oszt, míg a `word_similarity` a célszövegen belüli legjobban
illeszkedő szósorozathoz méri a kifejezést, és 0,78-at ad. Ezen a katalóguson
mérve: Csokonay→Csokonai 0,78, Katonna→Katona 0,67, Verdy→Verdi 0,67, értelmetlen
szövegre 0,00; a küszöb 0,6-nál van.

A Felfedezés rendezésvezérlőt is kapott. A lehetőségek szándékosan mások
keresésben és böngészésben — a "találat" szerinti rendezéshez kell egy lekérdezés,
amihez viszonyítani lehet, ezért ott nem jelenik meg, ahol nincs beírva semmi —,
és a "Népszerű" felirat "Előadások"-ra vált minden olyan rendezésnél, ami nem
értékelés szerinti, mert a felirat állítás arról, hogy mi ez a lista.

### A játszási időpontokat begyűjtöttük, de sosem mutattuk meg

A `getUpcomingPerformances()` a `services/playsService.ts`-ben ott volt, mióta
a performances tábla létezik, és **egyetlen hívási helye sem volt**. Több száz
jövőbeli időpont ült az adatbázisban, mindegyik a színpaddal együtt, miközben az
Előadás részletei oldal egyetlen "következő előadás" sort mutatott.

Mostantól két út vezet oda. Az Előadás részletei oldal hónapokra bontva
felsorolja az összes közelgő időpontot, a színpaddal együtt; a Felfedezésnek
pedig lett egy második módja, a **Műsor**, ami a naptár felől olvassa a
katalógust — kiválasztasz egy estét, és látod, mi megy aznap az összes szóba jövő
színházban, helyszínenként csoportosítva. Ez az irány korábban egyáltalán nem
volt lekérdezhető: az app minden lekérdezése egy produkcióból indult, és azt
kérdezte, mikor játsszák. A hátterében a `program_in_range` és a `program_days`
áll (`0017_program_by_day.sql`), a dátumválasztó pedig csak olyan napokat kínál,
amelyeken van is valami, így soha nem vezethet üres képernyőre.

Ahol egy produkciónak tényleg nincs időpontja, ott a képernyő mostantól
megmondja, a négy ok közül melyik érvényes, ahelyett hogy üres helyet mutatna —
egy színház, amelyik még nem hirdette meg a következő évadot, nem ugyanaz, mint
egy produkció, amelyik lekerült a műsorról.

**Egy megjegyzés az időről.** Minden játszási időpont `timestamptz`-ként van
tárolva, és a `utils/datetime.ts`-en keresztül jelenik meg, ami kifejezetten az
`Europe/Budapest` zónát rögzíti, nem az eszközét: egy londoni böngésző különben
18:00-ként jelenítene meg egy 19:00-s budapesti kezdést, és ez az az egyetlen
szám, amit egy műsorlista soha nem ronthat el. A `utils/datetime.test.ts` ezt
egy nyári időszámítás-váltáson át is ellenőrzi, mert a hiba a képernyőn
láthatatlan — a 18:00 tökéletesen hihető kezdésnek látszik. Ugyanezt a hibát
megtaláltuk és javítottuk az adatbázisban is: a származtatott `status_reason`
szöveg zóna nélkül formázta az időbélyegeit, így az Előadás részletei oldal a
"next performance 2026-09-06 17:00" sort közvetlenül a helyes "szept. 6.,
vasárnap · 19:00" alá írta ki (`0018_status_reason_timezone.sql`).

## A napló már tudja, melyik este volt

Az app azért létezett, hogy megjegyezze a színházban töltött estéket, és éppen
azt nem tudta rögzíteni, *melyik* estéről van szó. A `submitReview()` egyáltalán
nem írt be dátumot, így a napló a `reviews.created_at` mezőt olvasta, és minden
bejegyzésre annak a pillanatnak a bélyegét ütötte, amikor a sor létrejött. A
naplózó modál még dátumot is mutatott — egy `new Date()`-et egy dobozba nyomtatva,
minden gombkezelő nélkül —, ami így egyszerre volt hibás mindenre a mai estén
kívül, és javíthatatlan.

Ez pont abban az esetben a legrosszabb, amiért a katalógus egyáltalán felépült. A
`0005_archive_and_reconcile.sql` nagyjából 900 archív produkciót tart
kereshetőként és naplózhatóként **éppen azért**, hogy valaki rögzíthessen egy
évekkel ezelőtt látott darabot — a napló pedig azt állította, hogy ma látta.

A `0022_diary_dates.sql` három oszlopot ad a `reviews` táblához:

| oszlop | mit tárol |
|---|---|
| `seen_at` | maga az este, `date` típusként — a napló eszerint rendez és csoportosít |
| `performance_id` | melyik időpont volt, ha a katalógus ismer ilyet |
| `is_rewatch` | nem ez volt az első alkalom, hogy látta a produkciót |

A `seen_at` `date`, nem `timestamptz`. A kezdés az előadás tulajdonsága, arra a
`performance_id` mutat; félig megjegyzett percet megerősíttetni valakivel
hosszabb űrlap, aminek a végén nem lesz jobb adat. Az alapértéke a **budapesti**
mai nap, nem a `current_date`, ami az adatbázis saját zónája — éjfél és hajnali
2 között ez két különböző nap, és egy késői előadásról hazafelé begépelt
bejegyzés pont ebbe az ablakba esik a leggyakrabban.

A vezérlő a `components/ui/DateField.tsx`, amit megírtunk és nem telepítettünk: a
`@react-native-community/datetimepicker` a gyakorlatban csak natívon működik, a
webes export viszont az, ami élesben megy. Szándékosan a `SelectChip` szűrőlap
formáját követi — ugyanaz a chip, ugyanaz a lap, ugyanaz a fogantyú —, és soha
nem kínál jövőbeli dátumot, mert az a napló, amibe jövő hónap is belefér, olyan
napló, aminek az összesítéseiben nem lehet megbízni. A hónapszámítás a
`utils/calendar.ts`-ben lakik és nem a komponensben, ugyanazért, amiért a
`vitest.config.ts` a `utils/datetime.ts`-t is kiemeli: az egy nappal elcsúszott
rács tökéletesen hihető naptárként jelenik meg, csak épp minden dátum rossz
napnév alatt — és naptárt senki nem ellenőriz másik naptárral.

Azt, hogy melyik időpont volt, az app kikövetkezteti, nem megkérdezi. Egy
produkciót általában egyszer játszanak egy adott estén, így a `submitReview()`
csendben összeköti a bejegyzést azzal az előadással; az űrlap csak akkor kérdez,
ha aznap délutáni és esti előadás is van — ez az egyetlen eset, ahol a válasz nem
magától értetődő.

### Egy ember, egy szavazat

Az újranézés a színházban hétköznapi módon fordul elő, a filmhez képest sokkal
inkább, ezért a `reviews` táblán szándékosan nincs egyedi kulcs a
`(play_id, user_id)` páron — a naplónak mindkét estét meg kell tartania. A
`recompute_play_rating()` viszont minden *sort* átlagolt, így aki háromszor
látott egy produkciót és mindháromszor 5-öst adott, háromszoros súllyal
szerepelt ahhoz képest, aki egyszer látta, és a nyilvános értékelés észrevétlenül
a lelkesedés és a látogatásszám szorzatává vált. Mostantól előbb személyenként
átlagol, aztán a személyek között. A `rating_count` is embereket számol, mert a
képernyőn az "55 értékelés" ezt állítja.

### Szeretett, vagy megosztó

Egy produkció kiírhatta, hogy 4,2, és sehogy nem tudta megmutatni, hogy ez
tizenegy ötös és két egyes-e. A `play_rating_histogram()` maszksávonként egy sort
ad vissza, mindig mind az ötöt, hogy a tengely teljes legyen, és az Előadás
részletei oldal a naplózó gomb fölé rajzolja, amint egynél többen értékelték —
egyetlen értékelésnek nincs szórása.

## Miben játszik még?

A `play_cast` eddig az adatbázis legnagyobb táblája volt — 6 397 közreműködés
2 424 emberrel —, és az egyetlen, amire semmilyen képernyő nem mutatott. A
keresés rangsorolja a szereposztásban talált egyezést, tehát egy színész nevére
rákeresve megjelentek az előadásai, aztán minden találat egy produkcióra vitt. A
kérdésre, amiért a szereposztás egyáltalán ott van, nem volt válasz.

A `0024_people.sql` és az `app/person/[slug].tsx` ez a válasz. Az oldalra az
Előadás részletei képernyő szereposztás-sávjából és rendezősorából lehet eljutni
— ez az a két hely, ahol az ember már úgyis egy nevet néz, és épp ezt kérdezi.

Ehhez három dolognak kellett igaznak lennie, és egyik sem volt az.

### A névmező nem mindig csak nevet tartalmaz

A magyar színházak a kitüntetéseket és a vendégstátuszt is a névbe írják, és nem
egyformán. Ha ezt békén hagyjuk, egy ember több oldalra esik szét — és pont ezt
az egy hibát nem éli túl egy alkotói oldal, hiszen a teljes értéke abból jön,
hogy egy helyre gyűjti a közreműködéseket.

A legnagyobb tettes az **m.v.** — *mint vendég* — nagyjából 230 szereposztássoron.
Pontosan a lehető legrosszabb névhalmaz ehhez a hibához: a vendég értelemszerűen
olyan színházban lép fel, ami nem a sajátja, tehát épp a vendégek fordulnak elő a
legnagyobb eséllyel két háznál — a "Mészáros Béla m.v." és a "Mészáros Béla" pedig
két idegen lett volna. Utána jönnek az állami díjak: "Szikora János Jászai-díjas,
Érdemes Művész", vagy "Rátkai Erzsébet Ferenczy Noémi- és Jászai Mari-díjas,
Érdemes Művész, a Magyar Művészeti Akadémia rendes tagja".

A `person_canonical_name()` az első ilyen jelölőtől a sztring végéig vág, ami
azért működik, mert a magyar előbb írja a nevet és utána a titulusokat — ebben a
katalógusban kivétel nélkül. A díjakat névről soroljuk fel, nem "bármely
`-díjas`-ra végződő szó" mintával, mert az általános szabály nem tudja eldönteni,
hogy a toldalék előtti szó a díjhoz vagy az emberhez tartozik: a "Szikora János
Jászai-díjas" esetben a keresztneve, a "Létay Kiss Gabriella Liszt Ferenc-díjas"
esetben a díj nevének a fele. Az opcionális `- és` ág azt a magyar
szerkezetet kezeli, amikor két díj osztozik egy toldalékon.

A hatás látszik: Molnár Levente négy írásmódja egyetlen, kilenc közreműködést
tartalmazó oldallá válik, Ágoston Péter pedig összeolvad a CSUPA NAGYBETŰS
írásmóddal, amit egy másik ház használ.

### A rendezői munka fele nincs benne a szereposztástáblában

945 produkció nevez meg rendezőt, és ezek közül csak 122 rendező szerepel a
`play_cast` táblában is. Egy csak a szereposztástáblára épülő alkotói oldal a
katalógus rendezői munkájának hét nyolcadát elveszítené — Bodó Viktor oldala üres
lett volna a most látható, három színházban játszott nyolc előadás helyett.

Ezért a `person_credits()` egyesíti a szereposztássorokat a `plays.director`
mezővel. Azt a mezőt szét kell bontani: tíz sorban társrendezők vannak, vagy
nagykötőjellel (ez a Vígszínház szokása), vagy vesszővel elválasztva. Ha csak
vessző mentén bontunk, embereket találunk ki, mert ugyanez az elválasztó vezeti
be a kitüntetéseket is — a "Juronics Tamás Kossuth-díjas, érdemes művész" egyetlen
rendező, és a naiv bontás a titulusa felét kollégaként iktatja be "érdemes
művész" néven. Ha előbb bontunk és utána kanonizáljuk a darabokat, mindkét eset
megoldódik, a nagybetű-ellenőrzés pedig kiszűri, ami maradt és nem név.

### Van, ami szerepnek látszik, de nem az

Több oldal listafejlécet ír a szerep oszlopba — "továbbá", "valamint",
"játsszák" —, a scraperek pedig ugyanúgy név/szerep párként olvassák, mint
mindent. Az `is_listing_artifact()` ezeket elnyomja, mert értelmetlen egy
oldalon a "továbbá" valakinek a feladataként. A "Szereplő" szándékosan nincs
ezen a listán: általános, de igaz állítás, és egy olyan oldalon, aminek épp a
játszás és az alkotás elkülönítése a lényege, az általános és a haszontalan két
különböző dolog.

### A slug szándékosan kétszer van megírva

Az URL `/person/<slug>`, és a slug két helyen készül: a `person_slug()` az
adatbázisban, a `personSlug()` az `utils/people.ts`-ben. Az appnak azért kell,
hogy a szereposztásból hálózati kérés nélkül tudjon linket építeni; az
adatbázisnak azért, hogy minden tárolt névvel össze tudja vetni.

Karakterre egyezniük kell, és csúnya a hiba, ha nem: az oldal nem hibázik, hanem
**üresen** jön vissza, ami megkülönböztethetetlen attól, hogy valakinek nincs
közreműködése. Az `utils/people.test.ts` a TypeScript oldalt a katalógus valódi
neveinek táblájához köti, és ugyanez a tábla átmegy az SQL függvényen is, így a
bármelyik oldalon bekövetkező elcsúszás kiderül, nem pedig feltételezzük, hogy
nincs.

## Napló, ami nem üresen indul

Egy új fiók naplója üres, az üres napló pedig űrlap. A színházak saját archívuma
teszi lehetővé a másik utat: a `0005_archive_and_reconcile.sql` megírása óta több
száz levett produkció maradt kereshető és naplózható, és eddig soha semmi nem
kínálta fel őket senkinek.

Az `app/onboarding.tsx` egyetlen kérdést tesz fel — *mit láttál már ezek közül?*
— borítóképek rácsán, darabonként egy koppintással.

### A bejelölés nem értékelés, és nem is dátum

A kézenfekvő megvalósítás a mai dátumot és valamilyen alapértelmezett értékelést
ír be. Mindkettő pont azt rontaná el, amit ez a séma épp most javított meg.

A mai dátum pontosan az a hiba, amiért a `0022_diary_dates.sql` létezik. A
kitalált értékelés pedig nem marad magánügy: a `plays.rating_overall` ezekből a
sorokból számolódik, és az Előadás részletei oldalon jelenik meg — vagyis egyetlen
onboarding-menetben kitalált tizenöt négyes tizenöt valódi produkció nyilvános
pontszámát mozdítaná el.

Ezért a `0026_seen_without_a_date.sql` mindkét oszlopot nullozhatóvá teszi, és
így itt is kifejezhetővé válik a különbség, amit a Letterboxd a *megnézett* és a
*naplóbejegyzés* között tesz:

| | jelentése |
|---|---|
| `seen_at` null | láttam, de nem tudom, mikor |
| `rating_overall` null | láttam, de nem teszek rá számot |

A naplózó űrlap továbbra is kitölti mindkettőt — a dátum alapból a mai nap, az
értékelés négy —, tehát a szokásos naplózás változatlan.

Ezzel együtt a `recompute_play_rating()` egy sora módosult. Az `avg()` eddig is
kihagyta a nullokat, tehát egy értékelés nélküli bejelölés önmagában sosem
mozdított átlagot; a `rating_count` volt az, ami hazudott volna, mert *minden
sorral rendelkező embert* számolt. Tizenöt bejelölés után tizenöt produkció
állította volna, hogy "1 értékelés", pontszám nélkül. Mostantól azokat számolja,
akik tényleg értékeltek.

A `statsForUser` is lekerült a `created_at`-ről. Az "Idén" a sorokat a beírásuk
ideje szerint számolta, ami csak addig volt ugyanaz, amíg az app nem tudta
megmondani, mikor voltál ott — egy onboarding-menet tizenöt idén látott előadást
jelentett volna. Most a `seen_at`-et számolja, a dátum nélküli bejegyzések pedig
kimaradnak belőle, nem pedig belekerülnek találgatásból.

### A csempék igazságos osztása

A jelöltek bemutató szerinti sorrendje kézenfekvőnek látszott, és rossz volt. Az
első hatvanból 20 lett örkényes és 16 vojtinás, szemben 3 katonással és 1
centrálossal — ez nem azt tükrözi, mit játszanak ezek a színházak, hanem azt,
milyen sűrűn közlik az adaptereik a bemutatók dátumát. Az Örkény JSON API-ja
mindenhez pontos dátumot ad, egy lekapart oldal gyakran semmit. Az a nyitóképernyő,
ami harmadrészt Örkény és negyedrészt bábszínház, a legtöbb embertől rossz
kérdéseket kérdez.

Az `onboarding_candidates()` ehelyett körbeoszt: előbb minden színház
legfrissebbje, aztán mindegyik második darabja. Így a hét ház 8–9 csempével
egyenlítődik ki, a frissesség pedig a házon belül továbbra is dönt.

Két dolog, ami a rangsor szándékosan nem. Nem a `perf_count_total` — a "sokat
ment, tehát többen látták" jó megérzés, csakhogy az oszlop 1 214 sorból mindössze
161-en van kitöltve, és mind jelenlegi, lekapart időpontokkal rendelkező
produkció, tehát pont az archívumot temetné el, amiért ez a képernyő létezik. És
nincs workshopokra és beszélgetésekre szűrve sem, mert **a katalógus jelenleg nem
tudja megkülönböztetni azokat a produkcióktól ezeknél a színházaknál**: mindkettő
`próza` a `venue_default` alapján, és a `runtime_minutes` rengeteg valódi
produkciónál is null. Egy eltévedt "Workshop: …" csempe egy kihagyott koppintásba
kerül; egy címre illesztő heurisztika csendben valódi munkát rejtene el, ami
többe.

### Egy akadálymentességi tanulság

A csempék jelölőnégyzetek, és két nekifutás kellett, hogy a weben ezt ki is
mondják. Az `accessibilityState={{ checked }}` — az a konvenció, amit az app
többi része használ — semmit nem renderel a react-native-web ezen verziójával: a
DOM-ban `role="checkbox"` jelent meg mindenféle bejelölt állapot nélkül, tehát a
bejelölt csempét egyedül az arany fedőréteg jelezte, amit a képernyőolvasó nem
lát. Az `aria-checked` hozzáadása a meglévő `accessibility*` propok mellé még
rosszabb volt: ez a verzió az egyik vagy a másik konvenciót fogadja el, a keverék
hatására pedig a role-t és a címkét is eldobta, hatvan címkézetlen div-et hagyva.

A csempék most végig `role` / `aria-checked` / `aria-label` propokat használnak. A
React Native 0.71+ ezeket natívan is elfogadja, tehát egy propkészlet mindkét
platformot kiszolgálja — de a két konvenciót nem szabad egy elemen keverni.

## Listák, és hogy mire jók valójában

A lista a filmnaplózás legtöbbet másolt ötlete, itt viszont van egy második
feladata is, amire a filmes appoknak nincs szükségük: ez az egyetlen mód, hogy
egy vadonatúj fiók elé valami olvasnivalót tegyünk.

A Felfedezés böngészősávjai a `plays.rating_overall` szerint rangsorolnak, ami
négy értékelésből számolt átlag 1 214 produkción. Ez nem népszerűségi jelzés,
hanem tizedesponttal ellátott zaj. Tíz kézzel készített lista ugyanezen a
katalóguson jobb első képernyő — és a népszerűségi jelzéssel ellentétben nem kell
hozzá, hogy előbb legyenek felhasználók.

Ezért a `0025_lists.sql` mindkét fajtát ugyanazon a két táblán tartja: a saját
magának készített listát, és az SQL-szerkesztőből írt, `is_featured` jelzésű
szerkesztői listát.

Három sémadöntés érdemel figyelmet.

**Az `is_ranked` rögzített, nem kikövetkeztetett.** "A 2025/26-os évad
legjobbjai" rangsor, a "Shakespeare Budapesten" nem, és a részletek képernyő csak
az elsőt számozza. Ha egy listát megszámozunk, amit a készítője nem rangsorolt,
olyan ítéletet teszünk közzé, amit ő nem mondott ki.

**A "szerkesztői" jelzésnek jelentenie kell valamit.** Őrzés nélkül az
`is_featured` csak egy oszlop egy soron, amit a tulajdonosa módosíthat, tehát
bárki a Felfedezés élére tehetné a saját listáját. A `lists_guard_featured` a
korábbi értékére szögezi a jelzőt, hacsak az utasítás nem `postgres` vagy
`service_role` néven fut.

A trigger első változata `security definer` volt, és csendben nem csinált semmit
— ezt érdemes feljegyezni, mert helyesnek látszik: egy `security definer`
függvényen belül a `current_user` a függvény *tulajdonosa*, így az őr minden
híváskor `postgres`-t látott, és mindig az engedélyező ágra futott. Úgy derült
ki, hogy egy valódi bejelentkezett felhasználót utánoztunk — `set local role
authenticated` plusz egy `request.jwt.claims` beállítás, pontosan ahogy a
PostgREST teszi egy alkalmazáskérésnél —, és a lista szerkesztőiként szúrta be
magát. A soha nem is szükséges emelt jogosultság nélkül ugyanez a teszt már
`is_featured = false` értéket ad vissza, miközben az ugyanabban az utasításban
lévő átnevezés átmegy: az őr sebészi, nem takarópokróc.

**Az elsődleges kulcs a `(list_id, play_id)`.** Egy produkció nem szerepelhet
kétszer ugyanazon a listán; rangsorolt vagy sem, a második bejegyzés hiba lenne,
nem vélemény.

A `list_summaries()` egyetlen hívásban adja vissza minden listához a méretét és
legfeljebb négy borítóazonosítót, a képernyő pedig egyetlen `getPlaysByIds`
hívással oldja fel mindet — kártyánként négy bélyegkép, egy képernyőnyi kártyával
megszorozva pontosan az az elemenkénti kérés, ami ellen a `getVenuesByIds`
létezik. A borítók átfedik egymást a kártyán, nem egymás mellett sorakoznak, mert
a lista egyetlen objektum több dologgal benne — négy különálló csempe négy
különálló sornak látszana.

Egy produkció listára vétele szándékosan más vezérlő, mint a kívánságlista. A
kívánságlista arra válaszol, hogy "elmegyek-e erre" — egy kérdés, egy válasz —,
a lista pedig arra, hogy "mivel tartozik ez össze", ami nyitott, és egyszerre
több is lehet.

A Felfedezés az első három szerkesztői listát viszi, a "Műsoron most" és a
"Népszerű" közé — szándékosan a rangsorolt rács fölé, hiszen épp annak az
átlagnak a helyére készült ez a funkció. A blokk eltűnik, amint város-,
színház-, helyszíntípus- vagy műfajszűrő van bekapcsolva: a szerkesztői lista a
katalógusról szóló írás, nem lekérdezés fölötte, tehát nem tud válaszolni a
szűrőre — ott hagyni úgy, hogy közben figyelmen kívül hagyja, rosszabb lenne,
mint egyáltalán nem mutatni.

## Kijárat a jegypénztárhoz

A `plays` táblán a `source` és a `source_key` kezdettől fogva megvolt: ahhoz elég,
hogy upsertelni lehessen rá, ahhoz nem, hogy linkelni. Minden adapter lekérte egy
produkció aloldalát, kiszedte belőle a címet, a szereposztást és az időpontokat,
majd eldobta a címet.

Ennek az ára a tölcsér végén jelent meg. Valaki böngészi a Műsor naptárat, talál
egy estét, megnyitja a produkciót, elolvassa a tartalmat, eldönti, hogy megy — és
az appnak nem volt hová küldenie.

A `0023_source_url.sql` felveszi a `plays.source_url` oszlopot, és minden adapter
megőrzi. Két kivétel érdemel említést:

- A **Vígszínház** a `/hu/produkciok/{slug}` címet kapja. Ennek az egyszerű
  lekérése navigációs vázat ad vissza, ezért jön az adat az `/api/programme/`
  végpontról — de ez a scrapelésről szóló tény. A böngésző lefuttatja a kliens
  oldali renderelést és megmutatja a valódi oldalt, tehát emberi látogatót
  tökéletesen jó ide küldeni.
- Az **Örkény** nem kap semmit. Az `/api/performances` azonosítót ad vissza és
  slugot nem, az oldal pedig kliens oldalon állítja össze a produkciólinkjeit,
  így nincs az API-ból levezethető útvonal. Egy megtippelt URL-minta a "Jegyek"
  gomb mögött rosszabb, mint ha nem lenne gomb: azt küldi 404-re, aki már
  eldöntötte, hogy megy.

## Amit egy filmvetítés nem tud

Egy film minden vetítése ugyanaz a fájl. Egy előadás nem: változik a szereposztás,
a hely a tiéd, a jegynek ára volt, és utána ott marad a csonk a kabátzsebedben. A
`0022_diary_dates.sql` óta a napló tudja, *melyik este* volt — magáról az estéről
viszont semmit.

A `0028_the_evening_itself.sql` négy dolgot ad hozzá, mindet opcionálisan, így
minden korábbi bejegyzés érvényes marad, és az a bejegyzés is teljes értékű, ami
egyikre sem válaszol.

**Kik játszottak.** Ez a lényeg, és ezért létezik önálló oldalként az
[understudies.org](https://understudies.org): a szereposztást aznap este kiteszik
az előtérbe, és utána sehol nem publikálják — vagyis a nézői feljegyzés az
egyetlen feljegyzés, ami valaha lesz róla. A `review_cast` külön tábla, nem
`text[]` a `reviews`-on, mert épp az a cél, hogy visszafelé is meg lehessen
kérdezni — ki ugrott be ehhez az előadóhoz, hány estéjét látta ez a néző —, egy
tömb pedig egyiket sem válaszolja meg anélkül, hogy minden olvasásnál kibontanánk.

A nevek szabad szövegek, mint a `play_cast`-ban, az azonosság pedig a slug: a
0024 `person_slug()`-ja a „Máthé Zsolt"-ot és a „Máthé Zsolt m.v."-t egy emberre
hozza, és egy generált `name_slug` oszlop viszi ezt tovább az egyedi indexbe, így
egy este nem rögzítheti kétféleképpen ugyanazt a színészt. A naplózó űrlap is
slug szerint jelöl, és a megjelenítés előtt kiszűri az ismétlődéseket az előadás
publikált szereplőlistájából — a `play_cast` szerepenként egyszer krediteli az
embert, tehát aki játszik is meg átdolgozott is, két csempeként érkezett egyetlen
emberre.

Az `is_alternate` az az oszlop, amiért az egész készült. A megjelölt név a
katalógusból jött; a begépelt nem, tehát beugró, helyettesítő vagy egy estére
érkező vendég. Ha valaki mégis a publikált szereplőlistában van, a begépelés őt
jelöli meg, nem beugróként veszi fel — így az egyetlen jelentéssel bíró jelző
megőrzi a jelentését.

**Hely és ár.** A helynél szabad szöveg: a magyar színházak tucatféleképpen
jelölik — „Erkély bal 2. sor 14.", „Földszint jobb oldalpáholy", „Stúdió, szabad
ülőhely" —, három oszlop pedig mindet olyan alakba kényszerítené, ami nem az
övék. Semmi, amire ez való, nem igényli a szöveg elemzését.

A `price_huf` a pénznemét viseli a nevében, mert egy magyar appon a jelöletlen
`price` az az oszlop, amibe egyszer valaki eurót fog írni. A nulla valódi válasz
— tiszteletjegy, iskolai előadás, valakinek a szabad helye —, ezért a teljes út
a `utils/money.ts`-től a `submitReview`-n át a bejegyzés képernyőjéig
`undefined`-ra vizsgál, nem hamis értékre. A `parseTicketPrice` a `utils/`-ban
lakik, és ott is van tesztelve: a „4500", a „4 500", a „4.500" és a beillesztett
`toLocaleString("hu-HU")` nem törhető szóköze ugyanaz a szám, a „kb 4000"-t
viszont visszautasítjuk, nem pedig ráhúzzuk egy számra — ez ugyanis egyike annak
a két értéknek, amit az évadösszegző majd összead, és egy szám, amit senki nem
gépelt be, láthatatlan marad egy végösszegben. A felső korlát nem a jegyárakról
mond ítéletet: egy elgépelt plusz számjegyet fog meg.

**A jegy fotója.** Bejegyzésenként egy kép — a jegy, a műsorfüzet, a taps. A
vezetékek már megvoltak, csak máshová mutattak: az `expo-image-picker`
függőség, a 0013 pedig mappánkénti szabályt adott a felhasználói feltöltéseknek,
tehát ez egy második bucket, nem új infrastruktúra. Nyilvános, mint a `posters`
és az `avatars`, mert a napló bejegyzése is nyilvános — a `reviews_select_all` a
0001 óta bárkinek engedi olvasni a szöveget. Ez valódi következmény, nem
mellékes, ezért a naplózó űrlap ki is mondja, *mielőtt* elővennéd a kamerát: egy
jegyen általában rajta van a neved és a foglalási kódod. A tulajdonlást itt is
két helyen érvényesítjük, a tárhely RLS-ével a feltöltésnél és a
`reviews_guard_stub_path`-szal a soron — ugyanazzal az érveléssel, amit a 0027
az `avatar_path`-ról ír.

**És egy képernyő, ahol mindez visszaolvasható.** Semmit nem érte volna meg
leírni, ha soha többé nem mutatja meg neked semmi. Az `entry/[id].tsx` egyetlen
este: az előadás, a dátum és a kezdés, kik játszottak, a hely, az ár, a jegy, a
vélemény. A napló sorai már ide mutatnak, nem a katalógus adatlapjára — a napló
egy sora egy este emléke, és a produkcióról szóló közvélekedéshez küldeni azt
jelentette, hogy eldobjuk az estét. Valaki más estéje ugyanígy nyílik meg, és
épp ezért érdemes egyáltalán rögzíteni, ki lépett színpadra; a szereplőcsempék
az előadók oldalára visznek.

Egy dolgot szándékosan nem dobunk tovább: ha a `review_cast` beszúrása elhasal
azután, hogy a bejegyzés már bent van, a `submitReview` akkor is visszaadja a
bejegyzést. Az este már el van mentve, és elveszíteni azért, mert a
szereplőlista nem ment be, sokkal rosszabb csere lenne, mint egy bejegyzés, ami
rögzíti az estét, de azt nem, ki játszott.

## Állandó feliratkozás, nem elmentett előadás

A kívánságlista arra válaszol, hogy „elmegyek-e erre": egy előadás, egy döntés.
Amit egy ilyen apptól valójában várnak az emberek, az nyitott — szólj, ha az
Örkény új bemutatót hirdet, szólj, ha Für Anikó új előadásban lép színpadra —, és
ezt semmi nem tudta kifejezni az appban. Ez többet számított, mint amennyire
hangzik, mert az éjszakai szinkron az egyetlen része ennek a projektnek, ami
*hírt termel*, és nem volt kinek átadnia.

A `0029_standing_follows.sql` felveszi a `subject_follows` táblát, ami a 0014
ötlete más típusú alanyra. Szándékosan nem a `follows`-t bővíti: annak a
`followee_id`-ja idegen kulcs az `auth.users`-be, egy színház pedig nem
felhasználó.

Egy polimorf tábla, nem `person_follows` meg `venue_follows`, hogy a „mindaz,
amire várok" egyetlen lekérdezés legyen, és az értesítő feladat, ami majd ezt
olvassa, egy táblát járjon be. Ennek az ára egy `subject_key`, ami kétféle
azonosítót tárol — `person_slug()`-ot egy alkotóhoz, uuid-t egy színházhoz —,
amit típusonként egy check megszorítás rögzít. Az alkotói ág az érdekesebb fele:
azt vizsgálja, hogy `subject_key = person_slug(subject_key)`, és mivel a függvény
idempotens a saját kimenetén, egy nyers „Máthé Zsolt m.v." itt elhasal ahelyett,
hogy csendben második, elérhetetlen identitássá válna valakinek, akit már
követnek.

Ezeket a kulcsokat a `followed_subjects()` fordítja vissza névre, mert kliens
oldalról soronként egy lekérdezés lenne, két különböző táblán. Egy slug, amire
nincs találat, megtartja a slugot címkeként: egy követés, ami már nem oldódik
fel, tűnjön hibásnak, ne pedig üres sornak.

A gomb az alkotó oldalán és az előadás adatlapján, a színház mellett él — az
adatlapon azért, mert nincs önálló helyszín-képernyő, és mert az a pillanat,
amikor valaki többet szeretne egy háztól, épp az, amikor annak egyik produkcióját
nézi. Mindkettő kimondja, mit csinál ma: a feliratkozást feljegyezzük, és még
semmi nem küld semmit. Egy vezérlő, ami olyan levelet ígér, amit senki nem fog
megkapni, azt tanítja meg, hogy az app makett — ugyanaz az érvelés, ami levette
a sosem növelt like- és kommentszámlálókat a hírfolyam kártyáiról.

Az eredményt a Kívánságlista fül hordozza, az elmentett előadások alatt, mert
ugyanaz a kérdés más igeidőben. Egy követett színháznak nincs hová megnyílnia, így
a Felfedezést nyitja meg arra a házra szűrve — amit egy helyszínoldal is
mutatott volna.

## Egy profil, amit érdemes megnézni

A `profiles` a `0001_init.sql` óta négy mezőt tartalmazott — név, felhasználónév,
város, kezdőbetűk —, és ezek közül három azonosító, nem pedig olyasmi, amit az
ember maga választ. Minden képernyő ugyanazt a monogramot rajzolta ugyanabba a
körbe, a profilon lévő „Profil szerkesztése" pirula mögött pedig nem volt
eseménykezelő, mert nem volt mit szerkeszteni.

A `0027_profile_identity.sql` hozzáadja azt a két mezőt, amitől a képernyőre
érdemes lesz visszatérni: `avatar_path` és `bio`. Négy döntés érdemes belőle
megjegyzésre.

**A profilkép útvonal, nem URL.** Ugyanaz az alak, amit a
`0011_poster_storage.sql` a borítóképekre bevezetett: a sorokban `<uid>/<fájl>`
áll egy nyilvános `avatars` bucketen belül, a CDN-címet pedig az `avatarUrl()`
építi fel. Így az origó megváltoztatása soha nem jár sorok átírásával.

**Külön bucket, nem a `posters` egyik mappája.** A két fájlnak más az élettartama.
A letükrözött plakátot egyszer töltjük le és megtartjuk; a profilképet akkor
cserélik, amikor a tulajdonosa meggondolja magát — ezért van az `avatars`
bucketen törlési szabály is, a `posters`-en pedig nincs. Az `updateProfile()`
eltávolítja azt a fájlt, amire a profil épp most szűnt meg mutatni, így az
ötödik képcsere után is egy fájl marad, nem öt.

**A tulajdonlást két helyen érvényesítjük.** A tárhely RLS-e a
`(storage.foldername(name))[1] = auth.uid()` feltétellel szűkíti az írást, ami
megakadályozza a más mappájába való feltöltést — ezt valódi belépett munkamenettel
ellenőriztük, `403 new row violates row-level security policy` a válasz. A *sor*
viszont külön kérdés: a `profiles_update_own` engedi, hogy a felhasználó
közvetlenül írja a saját sorát, tehát második ellenőrzés nélkül olyan fájlra is
ráállíthatná az `avatar_path`-t, ami nem az övé. A `profiles_guard_avatar_path`
minden olyan útvonalat elutasít, ami nem a profil saját azonosítójával kezdődik.
Ugyanez az érvelés áll a `poster_path` mögött a `0013_user_poster_uploads.sql`
`create_play_with_cast` függvényében.

**A kezdőbetűk követik a nevet.** Ez az a tartalék, ami fénykép hiányában
látszik, tehát az a fiók, ami átnevezi magát és megtartja a régi monogramját,
egyszerűen hibás. A `profile_initials()` az első két szó első betűjét veszi —
„Máthé Zsolt" így `MZ` —, egy trigger pedig újraszámolja, valahányszor a név
változik. A regisztrációs trigger `upper(left(name, 2))` kifejezése ugyanerre a
névre `MÁ`-t adott, ezért a meglévő négy sort az új függvénnyel töltöttük fel
újra.

A `bio` hossza 280 karakterben van maximálva egy check megszorítással, nem csak
az űrlap `maxLength`-jével, mert a módosítási szabály miatt nem az űrlap az
egyetlen út befelé. Az űrlap egyáltalán nem használ `maxLength`-et: a
leütéseket némán elnyelni úgy hat, mintha a billentyűzet lenne rossz — ezért
hatvan karakternél kevesebb hátralévő helynél számlálót mutat, és mentéskor
utasítja vissza a túl hosszú szöveget.

## Ami ma tényleg megvan

Az app mögött valódi Supabase (Postgres) adatbázis van Row Level Security-vel,
valódi e-mail/jelszó alapú belépés, működő keresés, és egy „előadás rögzítése"
folyamat, ami tényleg elmenti az értékelést — a séma a
`supabase/migrations/`-ben, a kommunikáció a `services/`-ben.

A `supabase/migrations/0002_seed.sql` felvisz néhány valós budapesti és
debreceni helyszínt, hogy az előadás-felvitelnek és a szinkronnak legyen mire
mutatnia a `venue_id`-val az első pillanattól. Korábban 7 minta-előadást is
felvitt (egy kézzel írt, azóta törölt `data/mockData.ts`-ből átvéve)
helykitöltőnek, de az az adat — valódi címek, helyszínek és rendezők, sosem
ellenőrzött összeállításban — utólag nézve többnyire egyetlen valós produkciónak
sem felelt meg (a felvitt „Csongor és Tünde" például a Vígszínházhoz volt kötve,
miközben Zsótér Sándor valódi rendezése a Katona József Színház Kamrájában
ment). Valódi fotókat rakni erre a kitalált adatra csak tekintélyesebbnek
mutatta volna, nem javította volna meg, ezért az előadás-sorok kikerültek — lásd
`supabase/migrations/0003_drop_fabricated_seed_plays.sql` (csak akkor számít, ha
az adatbázisodban a javítás előttről még benne vannak).

A valódi katalógus ma teljes egészében a `sync/`-ből jön: ez egy ismétlődő
feladat (GitHub Actions, naponta), ami **aktuális** műsort tölt le közvetlenül a
színházak saját oldalairól — forrásonkénti jegyzetek a `sync/adapters/` alatt.

A gyűjtőoldalakról, élőben újraellenőrizve, nem feltételezésből (a fájl egy
korábbi változata mindhármat egy kalap alá vette azzal, hogy „a robots.txt
tiltja az automatikus hozzáférést", ami csak az egyikre igaz):

- `jegyx1.hu` — a `User-agent: *` alatt `Disallow: /`. Teljesen tiltott. Helyes
  volt kihagyni.
- `port.hu` — a `User-agent: *` csak a `/jegymester/`, `/site/`, `/ticketlist/`
  és `/galeria/` útvonalakat tiltja; a műsor- és társulati oldalak nincsenek
  tiltva. A `GPTBot` és a `Kantar` teljesen ki van zárva, de ez a feladat egyik
  sem. Vagyis **nem a robots.txt** az ok, amiért kimarad — hanem az összeállított
  műsoradatbázisra vonatkozó EU-s *sui generis* adatbázisjog, ami jogi kérdés,
  nem technikai.
- `jegy.hu` — a `User-agent: *` csak a `/ticket/` és `/invoice/` útvonalakat
  tiltja, `Crawl-delay: 20` mellett. A műsor bejárható; a késleltetés miatt lesz
  lassú egy teljes kör.

Tíz adapter él és alapból be van kapcsolva, nyolc színházat fed le két
városban, együtt nagyjából 1160 produkciót adnak — ebből körülbelül 310 fut most
vagy meg van hirdetve, 850 pedig olyan, amit maguk a színházak sorolnak az
archívumukba —, valamint 400 közelgő játszási időpontot. Az archív sorok
`plays.is_archived`-et kapnak, ami kiveszi őket a Felfedezés böngészősávjaiból,
de kereshetők és rögzíthetők maradnak, így évekkel ezelőtt látott előadást is
fel lehet vinni (lásd `0005_archive_and_reconcile.sql`).

| Színház | Város | Adapter(ek) | Forrás |
|---|---|---|---|
| Örkény István Színház | Budapest | `orkeny` | saját JSON API |
| Katona József Színház | Budapest | `katona-wp`, `katona-archive` | WordPress + befagyasztott Joomla |
| Nemzeti Színház | Budapest | `nemzeti` | saját oldal |
| Centrál Színház | Budapest | `central` | saját oldal + The Events Calendar API |
| Madách Színház | Budapest | `madach` | saját oldal |
| Vígszínház | Budapest | `vigszinhaz` | saját JSON API |
| Csokonai Nemzeti Színház | Debrecen | `csokonai`, `csokonai-archive` | saját oldal |
| Vojtina Bábszínház | Debrecen | `vojtina` | saját oldal |

Attól, hogy Debrecennek lett egy második helyszíne, kapcsolnak be ott a
Felfedezés színház-chipjei: a sor elrejti magát, ha egy városban csak egy
lehetőség van, mert egy szűrő, ami nem tud változtatni az eredményen, hibásnak
látszik. A Vojtina egyben a katalógus első bábszínháza is, így a
`genre_normalized` tőle kapja az első valódi `báb` értékeit, nem újabb pár
tucat prózasort.

A **Katona József Színház** (Budapest) két adaptert visz, mert a színház
WordPressre költöztette az oldalát (a feltöltések dátuma 2026-06/07), és a régi
Joomla-lekapás egyszerűen elszállt: az `/eloadasok/{bemutatok,repertoar}` ma
301-gyel az `/eloadasok/`-ra megy, az `/eloadasok/archivum` pedig 404.

- A `sync/adapters/katona-wp.ts` (`katona-wp`) az aktuális repertoárt olvassa az
  új oldalról. Egyértelmű előrelépés ahhoz képest, amit leváltott: az oldalakon
  ott vannak a **játszási időpontok** (a Katonától korábban egyetlen dátum sem
  jött, ezért van a `0006_play_status.sql`-ben máig külön eset arra a forrásra,
  ami nem közöl dátumot), a játszóhely (Nagyszínpad vs Kamra), és a produkciós
  fotó a fotós nevével együtt.
- A `sync/adapters/katona.ts` (`katona-archive`) a színház régi anyagát olvassa
  a befagyasztott Joomla-telepítésből, ami szó szerint továbbél az
  `archive.katonajozsefszinhaz.hu` címen, így ott az eredeti egyedimező-
  szelektorok még működnek. Csak az `/eloadasok/archivum` van beolvasva: azon az
  oldalon a `repertoar`/`bemutatok` szekció annak az állapotnak a befagyott
  pillanatképe, ami a nyugdíjazáskor ment, és ami még fut, az a WordPress
  adapterből jön.

Mindkettő megkerüli a lentebb leírt Jegymester hozzáférési token falát — nincs
szükség tokenre, mert mindkét oldal szerveroldalon rendereli a tartalmat.

A **Csokonai Nemzeti Színház** (Debrecen) szintén két adaptert visz, de ennek
semmi köze ahhoz, hogy elromlott volna egy oldal:

- A `sync/adapters/csokonai.ts` (`csokonai`) az aktuális repertoárt olvassa a
  lapozott listából és a naptárból. A szelektorok és a szélső esetek — kísérő
  „sorozat" tételek, duplikált részletoldal-linkek — élő adaton lettek
  ellenőrizve, nem feltételezve.
- A `sync/adapters/csokonai-archive.ts` (`csokonai-archive`) az `/archivum/`-ot
  olvassa: egyetlen oldal, nagyjából 190 korábbi produkcióval, amiből körülbelül
  172 sehol nem szerepel a repertoárlistában. Nem futhat együtt az élő
  adapterrel: az archív oldalakon nincs műfaji taxonómia, márpedig az élő menet
  pont ezzel választja szét a valódi produkciókat a színház beszélgetéseitől és
  házbejárásaitól — ugyanez a szabály itt mindet eldobná. Az archívumlista maga a
  szűrő. A még repertoáron lévő produkciók ki vannak vonva, hogy a két adapter ne
  vitatkozhasson ugyanazon a soron.

Szintén él: **Örkény István Színház** (Budapest, a saját JSON API-jukon
keresztül). A Katona Jegymester alapú adaptere létezik, de **nincs bekapcsolva**
— az a platform élő próbán `403 requires access token`-t ad, szemben azzal, amit
a csak robots.txt-re épülő kutatás sugallt; hogy mi kellene a javításához, lásd
a figyelmeztető fejlécet a `sync/adapters/jegymester.ts`-ben. A Csokonai
korábban szintén ezen az elromlott platformon volt — a most működő adaptere a
Csokonai saját oldalát olvassa.

A **Vígszínház** mostanra él, és a legbőségesebb forrás az összes közül — de nem
úgy, ahogy e fájl korábbi változata jósolta. Az oldalai kliensoldalon
renderelnek, az RSC flight payload pedig csak a felület saját feliratszótárát
tartalmazza: produkcióadatot egyáltalán nem. Amit az alkalmazás ténylegesen hív,
az az `/api/programme/`, és ez minden produkciót visszaad bemutatódátummal,
perces játékidővel, szünetszámmal és strukturált rendezővel. Két dolgot érdemes
tudni róla: **1890-ig** nyúlik vissza, ezért a `sync/adapters/vigszinhaz.ts`
1960-os bemutatóévnél megáll (az 1897-es évadot senki nem látta, aki ezt az
appot használja, és a teljes behúzás egyetlen helyszínt négyszer akkorává tenne,
mint az összes többit együtt); és ez az egyetlen forrás, ahol **szereposztás**
sehol nem érhető el, tehát ezeket a produkciókat színészre keresve nem lehet
megtalálni.

A **Madách** külön megjegyzést kíván. A `robots.txt`-je a Cloudflare
content-signals sablonszövege és semmi más — az egész fájl kommentekből áll,
amelyek elmagyarázzák, mi az a content signal, de nincs benne `User-agent`
blokk, nincs `Disallow`, és egyetlen jelzésérték sincs beállítva. A szöveg saját
(c) pontja szerint az az üzemeltető, aki nem állít be jelzést, "sem nem ad, sem
nem korlátoz engedélyt" — tehát nincs kifejezett korlátozás, és nincs betartandó
bejárási szabály sem. Érdemes újraolvasni, ha az a fájl valaha valódi direktívát
kap.

Ami továbbra sincs megírva, azzal együtt, hogy élő ellenőrzéskor mi derült ki:

- **Radnóti** és **Trafó** — sima HTTP-vel egyáltalán nem érhetők el. Mindkettő
  kliensoldalon rendereli a műsorát: a Radnóti `/repertoar/`,
  `/bemutatok-20262027/` és `/archivum/` oldala sima lekéréssel három bájtra
  azonos navigációs vázat ad vissza, a `trafo.hu/programok` pedig egyetlen
  linket 168KB HTML-ben. Ezekhez fejnélküli böngésző kellene a
  szinkronfeladatban, ami egy ütemezett GitHub Actionhöz jóval nehezebb
  függőség, mint a cheerio.

- **Pesti Magyar Színház** — sima lekérésre "Access Forbidden" a válasz.

Szintén nincs még kész: követés/követők. A figyelőlistára
felvétel/levétel viszont kész — a `services/playsService.ts`-ben ott az
`addToWatchlist`/`removeFromWatchlist`, az Előadás részletei oldal kapcsolójára
kötve.
