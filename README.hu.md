[English](README.md) · **Magyarul**

> Ez a magyar változat. Az eredeti az angol `README.md` — ha a kettő valaha
> ellentmond egymásnak, az angol az érvényes, és azt kell javítani.

# Vastaps

> A tapsról, amiért visszahívják a társulatot. A repó, az Expo-slug és a
> csomagazonosítók továbbra is `szinhaz-tracker` / `hu.szinhaztracker.app` —
> ezek azonosítók, nem nevek, és az átírásuk látható haszon nélkül törné el a
> mélylinkeket és a bolti identitást.

Mobilalkalmazás magyar színházba járóknak: rögzítsd, pontozd és írd meg, mit
láttál. Expo + React Native + TypeScript alapon, a navigáció fájlalapú,
[expo-router](https://docs.expo.dev/router/introduction/)-rel.

> **Merre tart ez:** a [BACKLOG.hu.md](BACKLOG.hu.md) tartalmazza az aktuális
> állapotot és a bemutatóig vezető tervet — mi van kész, mi van nyitva, és mit
> jelent a hátralévő fázisok mindegyike. Ez a README azt magyarázza, *miért* úgy
> működik minden meglévő darab, ahogy; a backlog azt, hogy mit kell folytatni.

## Beállítás

```bash
npm install
npx expo install --fix
```

Ezután hozz létre egy [Supabase](https://supabase.com) projektet (az ingyenes
csomag bőven elég), futtasd le a `supabase/migrations/` **összes** fájlját
**sorrendben** (`0001_init.sql`-től a `0036_ratings_that_move_and_accounts_that_close.sql`-ig) a projekt
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

Igazi telefonra — nem szimulátorra — a natív buildek az
[EAS](https://docs.expo.dev/build/introduction/)-en át készülnek: a három profil
az `eas.json`-ben van, a natív projektek pedig igény szerint generálódnak, nem
be vannak commitolva (lásd *[Valami, amit egy bolt is
elfogad](#valami-amit-egy-bolt-is-elfogad)*):

```bash
npx eas-cli build --profile preview --platform android   # oldalról telepíthető APK
npx eas-cli build --profile production --platform all    # egy .aab és egy .ipa
```

## Felépítés

```
app.config.ts            az Expo-konfiguráció — app.json volt, amíg a natív sáv
                          el nem indult. Egyben az iOS- és Android-projektek
                          egyetlen létező leírása is; az `expo prebuild` ebből
                          generálja őket, és nincsenek becommitolva
eas.json                 a három EAS build profil

app/                     expo-router képernyők (fájlalapú útvonalak)
  _layout.tsx             gyökér stack: tabok + előadás oldal + rögzítés/
                          előadás-felvitel/auth modálok
  (tabs)/
    _layout.tsx            tab navigátor — telefonon TabBar, 900pt-tól TopBar
    index.tsx               Feed (a be nem jelentkezett látogatót indításonként
                              egyszer a Felfedezésre küldi)
    discover.tsx             Felfedezés — három fül: böngészés, a következő
                              estével az élén és a héttel műsorlistaként; a
                              Műsor naptár; és a Listák. Rangsorolt keresés,
                              rendezés, szűrők
    watchlist.tsx             Figyelőlista
    profile.tsx                Profil
  play/[id].tsx           Előadás részletei
  person/[slug].tsx       Egy alkotó, és minden, amiben szerepel
  list/[id].tsx           Egy lista és a tartalma
  entry/[id].tsx          Egy este: kiket láttál, hol ültél, mennyibe került
  season/[start].tsx      Egy évad összegzése, szeptembertől augusztusig
  lists.tsx               Szerkesztői listák és a sajátjaid (modál; ugyanaz a
                          törzs, a components/ui/ListsBody, a Felfedezés
                          Listák füle)
  inbox.tsx               Amit az éjszakai szinkron megtudott, és te kérdezted
  checkin.tsx             Előadás rögzítése — dátum, értékelés, vélemény (modál)
  onboarding.tsx          "Mit láttál már?" — első indítás rácsa a színházak
                          archívuma fölött (modál)
  add-play.tsx            Előadás kézi felvitele (modál, belépés kell hozzá)
  edit-profile.tsx        Kép, név, város és bemutatkozás (modál, belépés kell)
  sign-in.tsx / sign-up.tsx  Auth modálok

components/
  icons/                  kézzel rajzolt SVG ikonok. A maskGeometry.ts tartja
                          az álarc-értékelő jelet, a brandGeometry.ts a logót;
                          mindkettőn osztozik a megosztókártya és az
                          ikongenerátor, hogy egyik példány se csússzon el
  ui/                     Button, Chip, SelectChip, DateField, Avatar,
                          FollowSubjectButton, PosterPlaceholder, ReviewSocial,
                          SectionHeader, ProgramRow, StatusBadge, EmptyState,
                          SignedOutState, ListsBody, TabBar, TopBar

theme/                    tervezési tokenek — a „Velvet Curtain" vizuális
                          rendszer egyetlen forrása, a második felvonásban
                          újravágva (lásd lejjebb: „A második felvonás")
  colors.ts               a paletta, mellette az OKLCH érték, amiből az adott
                          hexa származik
  typography.ts           a két márkabetű és a visszaesési sorrendjük
  type.ts                 a tipográfiai skála: tíz megnevezett szerep
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
utils/season.ts           melyik évadba tartozik egy este, és hogyan írja le a
                          magyar az évad nevét — a season_start_year()
                          adatbázisfüggvény kliensoldali fele
utils/authRetry.ts        egy újrapróbálkozás friss tokennel, ha a kiszolgáló
                          a lejárt régi miatt utasította vissza a kérést
utils/ownRating.ts        melyik saját estédet idézi vissza az előadásoldal,
                          miután a nyilvános átlag lekerült róla

data/types.ts             domain típusok (Play, Venue, Review, User, …)
services/supabase.ts      a Supabase kliens (az EXPO_PUBLIC_SUPABASE_*-ot olvassa)
services/playsService.ts  a képernyők KIZÁRÓLAG innen kapnak előadás/helyszín/
                          felhasználó adatot — Supabase lekérdezésekkel
services/peopleService.ts egy alkotó közreműködései, a play_cast és a
                          plays.director táblát együtt olvasva — és a
                          keresőkifejezésre illeszkedő alkotók
services/listsService.ts  listák és a bejegyzéseik, felhasználói és
                          szerkesztői egyaránt
services/profileService.ts  a profil szerkeszthető fele — profilkép feltöltése,
                          bemutatkozás, és a tárolt kép nyilvános URL-je
services/searchService.ts rangsorolt, ékezetfüggetlen keresés elgépelés-tűréssel,
                          előadásokban/helyszínekben/szereplők közt
                          (Postgres RPC)
services/notificationService.ts  az értesítések — az appból csak olvasható, a
                          sorokat az éjszakai feladat és a reakció-triggerek
                          írják, kérés soha
services/socialService.ts tetszések és hozzászólások egy naplóbejegyzésen;
                          számlálót soha nem ír, azt triggerek tartják karban
services/friendsService.ts mit gondoltak a követettek egy produkcióról
services/shareCardService.ts egy este canvasra rajzolva, PNG-ként — csak
                          weben, és ezt ki is mondja, nem csendben degradálódik
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

landing/                  a marketing egyoldalas (lásd landing/README.md) és a
                          kutatas.html, az indulás előtti kérdőív — a válaszai
                          egyetlen ellenőrző függvényen át jutnak a Supabase-be,
                          ez a séma egyetlen névtelen írása
research/                 a felhasználói kutatás eszköztára: a módszer, egy
                          interjú-vezérfonal, használhatósági forgatókönyv,
                          toborzószövegek, és hogy hogyan olvassuk az eredményt
                          kevés válasznál. Az `npm run research:report` ide írja
                          a kérdőív jelentését (git figyelmen kívül hagyja, mert
                          e-mail-címeket tartalmazhat)
scripts/research-design.ts  a kérdőív tizenkét funkciója és az a hat, amelynek
                          a hiányáról kérdez — az oldal egy másolatot ágyaz be,
                          és a mellette lévő teszt elbukik, ha a kettő valaha
                          eltér

.github/workflows/
  ci.yml                  típusellenőrzés + lint + tesztek minden pushra és
                          PR-re — a webes build sosem érinti a sync/-et, így ez
                          fogja meg az elromlott adaptert, mielőtt az éjszakai
                          futás tenné
  sync-plays.yml          a napi műsorszinkron
```

## Tervezési rendszer

A színek és a tipográfia a `theme/`-ben laknak. A paletta a tervezővászon
„Velvet Curtain" rendszere, 2026 szeptemberében újravágva: szilvafekete
színpad, bordó felületek, pezsgőarany kiemelőszín, Bodoni Moda a kiemelt
szövegre, Sora a felület szövegére, és egy saját színházi álarc ikon mindenütt,
ahol egyébként csillagos értékelés lenne. Ez az öt választható paletta egyike —
lásd lejjebb az „Öt paletta" részt — és az, amire az app tervezve van; a
nyomtatott párja, a Színlap, a világos alapértelmezés.

A `theme/themes.ts` tartja a palettákat, és dokumentálja, melyik hexa konstans
melyik OKLCH értékből lett átváltva, arra az esetre, ha később hangolni kell
valamelyiken — a React Native stílusmotorja nem fogad el `oklch()`-t, ezért ott
minden előre átváltott sRGB hexa. A `theme/colors.ts` az a vékony réteg, ami
eldönti, melyik palettát látja az adott platform.

Két szabályt érdemes ismerni, mielőtt bárki új képernyőt ír:

- **Sose állíts be betűméretet kézzel.** A `components/ui/Text` egy `variant`-ot
  (display / title / heading / numeral / subheading / body / bodySmall / label /
  caption / eyebrow) és egy `tone`-t vár. Korábban a méretek a hívás helyén
  voltak beírva — így gyűlt össze belőlük húsz. Az egyetlen kivétel a
  `TextInput`, ami nem tudja használni ezt a komponenst, és `inputFontSize`-t
  kap: 16px, mert az iOS Safari ránagyít az oldalra, ha egy fókuszált mező
  szövege ennél kisebb. Két szerepnek saját tónusa van: a `numeral` (kezdési
  idő, pontszám, a hónap napja — Bodoni, alapból a kiemelőszínben) és az
  `eyebrow` (a kis, ritkított kapitális egy cím fölött vagy egy képen).
- **A Bodoni Moda csak kiemelt szövegre való, 19px-től felfelé.** Didone betű: a
  vastag-vékony kontraszt, ami címméretben megadja az appnak a színlap-
  karakterét, képaláírás-méretben masszává olvad, mert a hajszálvonalak egy pixel
  alá esnek. A `theme/type.ts` ezt ki is kényszeríti — a `heading` alatti minden
  szerep Sora, és a `numeral` ugyanezért 22px-en ül.
- **Egy szakasz egyféleképpen mutatkozik be.** A `components/ui/SectionHeader`
  egy eyebrow, egy Bodoni cím és egy záró link vagy szám az alapvonalon, és
  minden képernyő ezt használja. Amit egy cím korábban a szövegébe zsúfolt
  („Népszerű itt: Debrecen"), az az eyebrow-ra kerül.
- **Képernyőnként egy kitöltött arany vezérlő.** Az arany azt jelenti: „a
  cselekvés", vagy „ezt még meg tudod nézni". Minden más körvonalas, szöveges
  (a `Button` `text` változata) vagy ikon. Az állapot egy pont egy mondatban —
  `StatusInline` —, és csak akkor jelvény, ha hír: rácsban a `StatusBadge`
  `inline` formája egy futó előadásról semmit sem mond, hiszen a futó az, *amiből*
  egy böngészőrács áll.

A `textFaint` az a token, ami eldönti, megfelel-e egy téma: az app legkisebb
méretű metaadatait viszi, méghozzá jellemzően *kártyán belül*, vagyis épp a két
felületháttéren. A régi palettán kétszer világosodott, és az újravágás tartja
a szabályt — a Bársonyban `#9f8e8a`: 6,36 / 6,01 / 5,47 a `bg` / `surface` /
`surface2` háttérhez képest.

Az elrendezés reszponzív, nem csak telefonra való, mert a webes kiadás is
kimegy. A `hooks/useBreakpoint.ts` futásidőben olvassa a nézetablakot (a
react-native-webben nincs media query a `StyleSheet.create`-en belül), a
`components/ui/Screen` maximalizálja és középre húzza a tartalmat, a
`components/ui/Grid` a saját mért szélességéből számol csempeszélességet, nem
százalékból, az `expanded` töréspontól pedig az `app/(tabs)/_layout.tsx` az
alsó fülsávot a `components/ui/TopBar`-ra cseréli.

## Öt paletta, és hogyan jut el egy téma a képernyőig

Az olvasó a Beállításokban választ témát, ahová a profilján lévő fogaskerék
vezet: **Bársony** (a ház stílusa, és a sötét alapértelmezés), **Színlap**
(ugyanaz a színlap, nyomtatva — krém papír, tinta, és a függöny bordója ott,
ahol a színpadon arany van; a világos alapértelmezés), **Levendula** (halvány
lila, ibolya kiemeléssel), **Letisztult** (semleges, szürke) és **Éjszakai**
(hűvös szürke sötét mód), valamint egy **Rendszer szerint** opció, ami az
eszközt követi. A választás az eszközön marad, `AsyncStorage`-ban, nem a
profilban: a téma annak a képernyőnek a tulajdonsága, amin olvasol, nem a tiéd.

A két alapértelmezés egy márka, a nap két szakában. 2026 szeptemberéig a
Levendula volt a világos alapértelmezés, vagyis egy világos módú telefon lila
appot nyitott meg egy olyan nyitóoldal alatt, ami épp bársonyt és aranyat adott
el; a `gold` token szerepet nevez meg, nem árnyalatot, és papíron ezt a
szerepet a bordó (`#7a2433`) viszi, nem a korábbi mustársárga okker.

Csak a szín változik. A Bodoni Moda, az álarc ikon, a térköz-rács és a
lekerekítések az app identitása, nem beállítás.

Az érdekes rész az, hogy egy téma egyáltalán változni tud. Minden képernyő
modulszintű `StyleSheet.create`-en belül olvassa a `colors`-t, ami egyszer, a
betöltéskor értékelődik ki — renderkor semmi nem olvassa újra. A kézenfekvő
megoldás mind a 37 blokk hookká írása lett volna, ami nagyon nagy változtatás.
Kiderült, hogy fölösleges: a react-native-web elfogad CSS custom property-t
színként, és változtatás nélkül átengedi:

```js
// react-native-web/dist/modules/isWebColor/index.js
color === 'currentcolor' || color === 'inherit' || color.indexOf('var(') === 0
```

Vagyis a weben a `colors.bg` maga a `"var(--vc-bg)"` *string*, a generált
atomi osztályok sosem változnak, és a témaváltás egyetlen `data-theme`
attribútum beírása a `<html>`-re — nulla újrarenderelés, nulla React-oldali
stílusszámítás. Az `app/+html.tsx` mondja meg, mire oldódnak fel ezek a
property-k, és egy blokkoló, beágyazott szkripttel még az első kirajzolás
előtt alkalmazza az elmentett témát, hogy aki témát választott, egy képkockára
se lássa a rosszat. A **„Rendszer szerint" két `prefers-color-scheme` media
query**, nem `matchMedia`-feliratkozás: nem kerül JavaScriptbe, és akkor is
működik, ha a bundle be sem töltődik.

Két következmény, amit érdemes tudni, mielőtt bárki új színt vesz fel:

- **Minden témázott érték csupasz `var(...)` kell legyen.** Az `isWebColor`
  csak a `var(`-ral kezdődő stringeket fogadja el; minden más a
  `processColor`-hoz esik, null-lal tér vissza, és szó szerinti
  `background-color:undefined` deklarációként kerül a stíluslapba, amit a
  böngésző némán eldob. Így az `rgba(var(--vc-gold-rgb), 0.15)` és a
  `color-mix()` nem elérhető, és minden alfa, amire egy témának szüksége van —
  a jelvények árnyalatai, a fülsáv fénye, a kiemelt felső él — külön token.
  Ezért 18 tokenes a paletta, nem 12.
- **A mélység palettánként egy `boxShadow` string.** A React Native 0.86
  elavulttá tette a négy `shadow*` propot, ezért a `theme/tokens.ts`
  `elevation.floating`-je és a fülsáv fénye `"0 8px 24px var(--vc-shadow)"` és
  hasonló: a web a stringet változatlanul, a custom propertyvel együtt adja
  tovább a CSS-nek, natíven pedig az új architektúra ugyanezt a stringet
  értelmezi. Az alfa továbbra is a színtokenben lakik.

Néhány szín szándékosan nem követi a témát, és mindegyik ott is leírja, miért:
a modálisok sötétítése és az előadásfotókra fektetett kezelőelemek (`overlay` a
`theme/tokens.ts`-ben), a `PosterPlaceholder` generált színvilágai, és a
megosztókártya. A kártya azért van a bársony palettához szögezve, mert a canvas
nem tud `var()`-t feloldani — az `addColorStop` kivételt dob rá, amitől az
egész funkció a link-megosztásos tartalékra esne vissza —, és mert ami elhagyja
az appot, az app képét kell vinnie, nem egy olvasó megjelenítési beállításáét.

A natív oldalon nincs custom property, ott tehát a váltás a React dolga: a
`theme/colors.ts` egy Proxyn keresztül az épp aktív palettához oldja fel a
`colors.bg`-t, a `theme/styles.ts` `makeStyles`-a pedig témánként újraépíti
minden képernyő stíluslapját — ezért gyár minden stíluslap az appban, nem
modulszintű `StyleSheet.create`, és a `theme/palette.test.ts` elbuktatja a
buildet, ha valamelyik nem az. Az indítóképernyő és a rendszer kerete az
`app.config.ts`-ben a sötét oldalhoz van rögzítve, a státuszsáv pedig
futásidőben témánként választ oldalt.

## A második felvonás: egy ház, mindenütt ugyanúgy megvilágítva

Az appnak koherens tokenrendszere és egy bársonyt-aranyat eladó nyitóoldala
volt, de egyiket sem viselte még magabiztosan. 2026 szeptemberében az egész
felület újra lett vágva úgy, hogy minden képernyő, útvonal, service és a
témamechanizmus megmaradt, és az változott, ahogyan a termék hordja magát. Öt
szabály, és hogy mit tettek az egyes képernyőkkel:

- **Minden képernyő egy vezérképpel nyit.** A Felfedezés a következő olyan
  estével kezd, amikor egyáltalán van valami — a plakát, a kezdési idő és a
  színház a képre szedve egy sötétítés alatt, és a képernyő egyetlen kitöltött
  arany gombja —, majd a hét többi estéje jön műsorlistaként. A keresőmező, egy
  dobozos módváltó, egy chipsor és a városfejléc korábban a sávok fölé volt
  rögzítve, ami egy 375pt-os telefonon nagyjából 440pt-ba került az első plakát
  előtt; most a rögzített sáv a cím és három szöveges fül, a chipek pedig a
  tartalommal görgetnek. Az előadás oldala a címet, az alkotókat és a színházat
  a plakátra teszi.
- **A címek Bodoniul beszélnek, a tények Sorául.** Mindenütt `SectionHeader`,
  `numeral` a kezdési időknek és pontszámoknak, `eyebrow` a kontextusnak.
- **A lista listának néz ki, a plakát plakátnak.** A `ProgramRow` — dátum vagy
  idő a bal oszlopban, egy kis kép, a cím, egy sor tény — váltja a 16:5-ös
  szalagsorokat, amiket a Felfedezés korábban minden estére rajzolt, és a Műsor
  dobozos kártyáit. A rácscsempék semmit sem hordanak a képen: a második sor a
  színház, az állapot pedig csak akkor jelenik meg, ha nem „műsoron". (Az
  értékelés a színházsor végén ült, amíg a nyilvános átlag le nem került —
  lásd a „Szeretett, vagy megosztó" részt.) Az előadás oldalán az időpontok
  hajszálvonalakra szedett táblázat;
  a szereposztás lista, amin a teljes szerep látszik, nem körök sávja, ami a
  „Zoltán, a narrátor"-t egy szó után levágta.
- **Képernyőnként egy arany dolog.** Az előadás oldalán három egymásra rakott,
  teljes szélességű sáv volt az időpontok előtt, kettő közülük arany. Most egy
  van, mellette a kívánságlista és a listára tétel ikongombként, a
  színházkövetés pedig kompakt pirula egy saját sorban.
- **Az asztali gép másik szoba.** 900pt-tól az alsó fülsáv felső sávvá válik a
  márkával, a négy szekcióval, a naplózás gombbal és az olvasó arcával; a
  Felfedezés vezérképe kéthasábos lesz. A telefonon marad a kiemelt „+".

Két kisebb dolog ugyanebből a gondolatmenetből következik. A fiók nélküli
látogató korábban idegenek estéinek hírfolyamán landolt; a hírfolyam most
indításonként egyszer átadja a Felfedezésnek (`app/(tabs)/index.tsx`), és a fül
elérhető marad. A két fiókfül pedig kijelentkezve egy fakó mondat volt egy sötét
űrben — a `SignedOutState` elmondja, mire való a napló és a kívánságlista, és
azzal a füllel kezdi a felsorolást, amelyiken az olvasó áll.

Semmi sem animál, ami eddig nem: a csontváz lüktetése marad, a hangulat a
háttérből, a fotók fölötti sötétítésből és a tipográfiából jön. A `landing/`
nyitóoldala ugyanebben a palettában lett újravágva a kiadott felület
képernyőképeivel, és vele a megosztókártya is.

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
és a "Népszerű" felirat "Előadások"-ra váltott minden olyan rendezésnél, ami nem
értékelés szerinti, mert a felirat állítás arról, hogy mi ez a lista. Azóta az
értékelés szerinti rendezés és a „Népszerű" is lekerült a nyilvános átlaggal
együtt, így a rács mindig „Előadások".

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

### A rács negyvennél megállt, az archívumot pedig sosem mutatta

Két probléma, ami egynek látszott. A Felfedezést Debrecenre szűrve negyven
produkcióból álló rács jött ki, és semmi nem mondta meg, hogy a negyven a válasz
vagy a korlát — Debrecenben pedig 76 jelenleg böngészhető produkció van, és
mögöttük további 166 archivált.

A `TRENDING_LIMIT` **korlát volt, ami lapméret nevét viselte**. Most már lap: a
`getTrending` lapszámot vesz át, a sorokkal együtt pontos darabszámot ad vissza,
a rács pedig kiírja, hogy „40 / 242 előadás", és van gombja a többihez. A javítás
nagyobb része az, hogy megmondjuk, *hányan vannak*, nem azt, hogy hány fér ki; egy
szám, ami csendben azt jelenti, „amennyit betölteni akartunk", ugyanabba az
osztályba tartozik, mint egy számláló, amit semmi nem növel.

A lapozáshoz **stabil rendezés** kell, ami a korábbi lekérdezésben nem volt. Az
értékelés szerinti rendezés mellett több száz sor holtversenyben áll 0.0-n, a
Postgres pedig kérésenként másképp rendezheti a holtversenyt — így egy sor az
első lapról megjelenhetett volna a másodikon is, miközben egy másik sosem jött
volna vissza. Minden böngésző lekérdezés `id`-t visz második rendezési
kulcsként. Ellenőrizve: Debrecent végiglapozva 242 kártya jött ki 242 sorra.

Az archívum a másik fele. A böngésző sávok mindig is csak az aktuális munkát
mutatták, és ez így helyes — 731 lezárt budapesti produkció belekeverve abba,
hogy „mit nézhetek meg", maga alá temetné azt a 232-t, ami tényleg megy. Csakhogy
az archívum ennek a katalógusnak a *nagyobbik* fele, és épp azért van, hogy a
régi produkciók megtalálhatók és naplózhatók maradjanak — vagyis az, hogy a
Felfedezésen sehol nem volt elérhető, ugyanannak a hibának a másik fele volt.
Mostantól van egy terjedelem-vezérlő a szűrősorban — „Ami most megy" / „Az
archívummal együtt" —, és az eyebrow is változik vele, mert egy olyan rács, ami
azt állítja magáról, hogy ez megy most, miközben többségében évekkel ezelőtt
lezárt produkciókat tartalmaz, rossz listát ír le.

A terjedelemnek **a szűrőopciókig is el kellett érnie**, nem csak a rácsig. Egy
város-, színház- vagy műfajlista, ami csak az aktuális munkából épül, nem éri el
annak felét sem, amit a kiszélesített rács tartalmaz — Debrecenben vannak
színházak, amiknek most semmi nem megy, és archivált produkciók vannak mögöttük.
Az `applyBrowseScope` egyetlen segédfüggvény, hogy a kettő ne csússzon el, és
együtt mozgatja az `is_archived`-et meg a `status`-t: az a produkció, amit a
forrás az archívumába sorol, archivált, az pedig, aminek a státusza azért esett
`ended`-re, mert lejárt az utolsó dátuma, nem az — és egyik sem tartozik abba,
hogy „mi megy most".

### Egy napló, amit írni lehetett, átírni nem

Négy hiba egyetlen telefonos ülésből, és kiderült, hogy közös gyökerük van: az
app három helyről tudott naplóbejegyzést *létrehozni*, megváltoztatni vagy
törölni viszont sehonnan.

**Egy rács, ami soha nem rajzolt ki semmit.** A `Grid` az `onLayout`-tal mérte a
saját szélességét, és minden csempét visszatartott, amíg az meg nem érkezett —
„ahelyett, hogy teljes szélességben felvillanna és újratördelne", ami észszerű
szándék, észszerűtlen legrosszabb esettel. Az onboarding modálban a
layout-esemény sosem jött meg, így egy 335 pont széles konténer ült ott nulla
gyerekkel: se csempe, se csontváz, se üres állapot, se hiba. Mérés már nincs. Az
elválasztás minden csempe burkolatán belüli padding, a konténeren negatív
margóval, hogy a külső élek visszasimuljanak — ez bármilyen szélességen pontos,
semmit nem kell mérnie, és nem tud kimaradni a rajzolás.

**„látta: Invalid Date".** A `seen_at` a 0026 óta nullozható — az undefined azt
jelenti, „láttam, de nem tudom megmondani, mikor", és pontosan ezt írja az
onboarding —, a hírfolyam sora viszont csak az írás dátumához hasonlította. Így
egy bejelölt bejegyzés `undefinedT12:00:00Z`-t formázott, és a kártya azt írta
ki, hogy Invalid Date. Most három eset van, nem kettő, és a harmadik azt mondja:
„dátum nélkül".

**Nem lehetett szerkeszteni.** A naplózó űrlap csak beszúrt, így épp azok a
bejegyzések voltak a legkevésbé javíthatók, amiket az app *helyetted* ír: az
onboarding dátum és értékelés nélküli sort hagy, és nem volt képernyő, ahol
megmondhattad volna, mikor voltál ott. Ugyanaz az űrlap most átvesz egy
`reviewId`-t, és frissít. Egy képernyő, nem kettő, mert egy este naplózása és
egy bejegyzés javítása ugyanaz a kérdéssor — két képernyő, ami kicsit másképp
kérdezi, épp így csúszik el egymástól.

**Duplikátumok.** Ha az onboardingban bejelölt produkciót rendesen is
lenaplóztad, az egy *második* sort szúrt be, így a napló és a hírfolyam kétszer
mutatta, és egyik példányt sem lehetett javítani. A naplózó űrlap most átveszi
az üres bejegyzést — pontosan azt az alakot, amit az onboarding ír, és mást
semmi nem állít elő —, és ezt ki is mondja a képernyőn, mert csendben kitölteni
azt hagyná, hogy valaki azon tűnődjön, miért nem nőtt a naplója. Egy valódi
második bejegyzés továbbra is második bejegyzés: kétszer látni egy produkciót
itt hétköznapi dolog, és az `is_rewatch` épp ezért van.

**Nem lehetett törölni.** A `reviews_delete_own` a 0001 óta létezik, és soha
semmi nem hívta. A kívánságlistának a kezdetektől van eltávolító vezérlője; a
naplónak, ami a nehezebben visszavonható dolog, egy sem — így egy tévedésből
naplózott bejegyzés végleges volt. Megerősítéshez kötött, nem azonnali, és a
megerősítés meg is nevezi, mi megy vele: egy kívánságlista-sor egy koppintás
visszatenni, egy naplóbejegyzés viszont dátumot, szereposztást, helyet, jegyárat,
fotót és beszélgetést hordozhat. A tetszések, a hozzászólások és a `review_cast`
kaszkádolnak, a `recompute_play_rating()` pedig töröléskor is lefut, így a
produkció átlaga magától helyreáll.

### Amit egy színház csinál, de nem előadás

Egy színház nem csak darabokat hirdet: beszélgetéseket, házbejárásokat,
workshopokat, könyvbemutatókat, kiállításokat, pedagógusesteket is. Ezek
ugyanabban a repertoárlistában vannak, amit az adapterek olvasnak, így `plays`
sorként érkeznek meg, és utána megjelennek a Felfedezésen, a keresésben és az
onboardingban, mintha meg lehetne őket nézni — a böngészőrács a „Workshop:
Országkórus"-t kínálja amellett a produkció mellett, amihez a workshop tartozik.

**A Csokonai adaptere ezt már a forrásnál megoldja, méghozzá rendesen.** Az a
színház a valódi produkciókat műfaj-taxonómiacímkével látja el, a kísérő
eseményeit pedig nem — így a „Csokonai Társalgó", a „Színházbejárás", a
„Csokonai közTér" és a „PEDAGÓGUSTÉR" soha nem is lesz play. Élőben
ellenőrizve, miközben ennek utánanéztünk: a szeptemberi naptár hét „Izzik a
galagonya" tételt sorol fel, a katalógus pedig azt az ötöt tartja, amelyik
előadás — a bemutató előtti este 18 órás Társalgó és egy pedagógusesemény
egyaránt helyesen hiányzik.

A többi forrásnál nincs ilyesmi. Az Örkénynél egy workshop és egy valódi
produkció **megkülönböztethetetlen az adatban**: egyiknek sincs szereposztása,
játékideje, időpontja, a műfajukat pedig nem a színház adta, hanem ez a projekt
a `venue_default`-ból. A maradékot tehát a cím alapján fogjuk meg, ami
heurisztika — a `0034_ancillary_events.sql` pedig úgy van megírva, hogy az
elkerülhetetlen tévedés olcsó legyen:

- a besorolás **tárolt**, a `plays.is_event`-ben, nem minden lekérdezésen belül
  fut le, tehát megnézhető, kézzel javítható és újraszámolható;
- a sorokat **megtartjuk**, nem töröljük, így semmi nem vész el, ha rossz volt a
  döntés;
- a `recompute_play_events()` soha nem sorol át olyan produkciót, amit **valaki
  már lenaplózott** — ha valaki feljegyezte, hogy ott volt egy beszélgetésen, az
  egy valóban megtörtént estéje, és elrejteni azt a naplóbejegyzésével együtt
  vinné el;
- a szókészlet szándékosan **szűk**, és a commit előtt mind az 1205 címre le lett
  futtatva: hat sorra illeszkedik, egyetlen produkcióra sem. Azok a szavak,
  amikkel egy darab címe is kezdődhetne, kimaradtak, még ott is, ahol egy adott
  sor eseménynek látszik. A legvilágosabb példa a `felolvasószínház`: egy
  felolvasószínházi est valóban megnézhető és naplózható, és az Örkény műfajként
  is használja.

A jelzőt a böngészés, a Műsor, a keresés és az onboarding is kizárja. Érdemes
megjegyezni, hogy az archívum-terjedelemből is: az `is_archived` egy produkció
életének egy szakaszát írja le, egy workshop viszont nem lesz darab attól, hogy
kiszélesítjük a képernyőn látható évek körét. Az onboarding számított itt a
legtöbbet — mind a hat eseménynek van plakátja, ami épp a *legjobban* minősített
jelöltekké tette őket azon a képernyőn.

### A jelvény angolul magyarázta magát

A `plays.status_reason`-t a `recompute_play_status()` írja annak, aki az
adatbázist olvassa — „next performance 2026-09-06 19:00 (4 known dates)" —, az
előadás adatlapja pedig nyersen jelenítette meg, közvetlenül a magyar sor alatt,
ami ugyanazt mondta. Úgy hatott, mint véletlenül bent felejtett hibakeresési
kimenet, mert nagyjából az is volt.

Mind az öt alakja angol ismétlés: vagy az időpontsoré, vagy az archívum-jegyzeté,
vagy egy bemutatódátumé. Ezért a jegyzetet a kliens vezeti le ugyanazokból a
tényekből, magyarul, és semmit nem ad vissza azokban az esetekben, amiket a
képernyő már lefedett. Kettő marad: a szünetelő produkció, ahol a
`schedulingLine` néma, és a jelvény lenne az egyetlen, ami mond valamit, illetve
a bemutató előtti, ahol a bemutató dátuma sehol máshol nem szerepel, pedig a
„mikor lesz" az egész kérdés.

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
képernyőn az "55 értékelés" ezt állította, amíg a szám még ki volt írva.

### Szeretett, vagy megosztó

Egy produkció kiírhatta, hogy 4,2, és sehogy nem tudta megmutatni, hogy ez
tizenegy ötös és két egyes-e. A `play_rating_histogram()` maszksávonként egy sort
ad vissza, mindig mind az ötöt, hogy a tengely teljes legyen, és az Előadás
részletei oldal a naplózó gomb fölé rajzolta, amint egynél többen értékelték —
egyetlen értékelésnek nincs szórása.

**2026. szeptember: a nyilvános átlag teljes egészében lekerült az appról, és
vele a diagram is.** A fentiek továbbra is igazak és továbbra is meg vannak
építve; egyszerűen nem rajzoljuk ki őket. Az ok inkább számtani, mint tervezői.
Ennyi felhasználó mellett egy átlag két vélemény széles, két vélemény pedig nem
összefoglalása semminek — egy szám tekintélyét viseli, a bizonyítékát nem. A
diagram pedig egy előadásoldal harmadát arra költötte, hogy ugyanezt még egyszer
elmondja sávokban, öt oszlopból kettővel.

Az Előadás részletei oldalon az az egyetlen értékelés maradt a helyén, ami nem
egy tömegről szóló állítás: **a sajátod**, csak neked, hogy hónapokkal később is
megmondja az oldal, mit gondoltál róla. Mellette megmarad az "A követettek
szerint" — hogy hányast adtak azok, akiket követsz —, ami bármekkora mintán
valódi információ, mert tudod, kik ők. A szabály, amit a változtatás követett:
*aki elmondja, mit gondolt, marad; egy maroknyi emberből számolt szám nem.* Az
egyéni maszkok ott vannak minden hírfolyam-kártyán és minden vélemény sorában.

Migráció nem történt. A `recompute_play_rating()` továbbra is fut, a
`rating_overall` és a `rating_count` továbbra is helyes, és a
`play_rating_histogram()` továbbra is válaszol. Az átlagot nem egy commit hozza
vissza, hanem az értékelők száma — és amikor meglesz, az felületi munka lesz
olyan oszlopokon, amelyek végig jók voltak.

**A három részértékelés-sáv visszakerült, a szabály másik oldalán.** Az átlaggal
együtt kerültek le, de volt egy saját okuk is: a naplózó űrlap 4 / 3 / 4 értéken
indította a színészi játék, a rendezés és a díszlet pontszámát, és attól
függetlenül mentette őket, hogy valaki hozzányúlt-e azokhoz a sorokhoz — így a
kirajzolásuk olyan véleményeket idézett volna az emberek szájába, amelyeket soha
nem mondtak. Az űrlap most mind a négy értékelést üresen hagyja addig, amíg rá
nem koppintanak, és `null`-t ír azokra, amelyek üresen maradnak; ezzel a
részpontszámok ugyanannyira az adott ember sajátjai, mint a mellettük álló szám —
tehát ott a helyük „A te értékelésed" blokkban, amely egyetlen ember válaszát
mutatja, sosem átlagot. A megválaszolatlan dimenzió üres sávot és gondolatjelet
rajzol, az olyan bejegyzés pedig, amely a háromból egyikre sem válaszolt, teljesen
elhagyja az oszlopot ahelyett, hogy három gondolatjelet mutatna. A változtatás
előtt írt bejegyzések továbbra is hordozzák a kitalált számokat, és meg is
mutatják őket: sosem migráltuk el ezeket, abból az elvből kiindulva, hogy az app
nem tudja megkülönböztetni az automatikusan beírt négyest a szándékostól, és
valakinek az eltárolt válaszát törölni nem egy hibajavítás döntése.

## A vélemény követés mögé kerül

2026 szeptemberéig egy naplóbejegyzés teljes egészében nyilvános volt. A
`reviews_select_all` a `0001` óta `using (true)` volt, a `0037` pedig csak a
rejtett és a blokkolt sorokat vette ki belőle — így bárki, kijelentkezve, egy
inkognitóablakban elolvashatta egy idegen értékelését, kritikáját, azt, hogy
mennyit fizetett és hol ült. Ez tudatos modell volt, és ez a repó érvelt is
mellette: a napló attól ér valamit, hogy mások is olvassák.

**A mostani szabály:** mindenki látja, *hogy* ott voltál; azt, hogy mit
gondoltál róla, csak te látod és azok, akik követnek téged.

Minden bejegyzésen nyilvános: ki, melyik előadás, mikor, és hogy visszatérő
nézés volt-e. A követés mögött: a négy értékelés, a leírt vélemény, a címkék, az
ülőhely, a jegyár, a jegyfotó, az aznap esti szereposztás, a kedvelések és a
hozzászólások száma, valamint maga a hozzászólás-szál.

A vágás úgy van megválasztva, hogy a hírfolyam továbbra is az a hely maradjon,
ahol embereket találsz. Egy kártya, amelyen „Nagy Zsófia megnézte" áll egy
plakát fölött, épp attól teszi valakit követésre érdemessé; csak épp nem adja
oda előre azt, amiért a követés van.

**Miért nézet, és miért nem szabály.** A tény és a vélemény ugyanannak a sornak
az oszlopai. Az RLS sorokat szűr, nem oszlopokat, a Postgres
oszlopjogosultságai pedig szerepenkéntiek és statikusak — egyik sem tudja
kifejezni, hogy „ezt a sort láthatod, de tizenegy oszlopa nem neked szól".
Ezért a `0041` létrehozza a `public.reviews_readable` nézetet, amely tulajdonosi
jogon fut, és minden olvasható sort visszaad úgy, hogy a privát oszlopokat
kinullázza, hacsak a `private.can_see_entry(szerző)` mást nem mond; a `0042`
pedig magát a `reviews` táblát szűkíti `user_id = auth.uid()`-ra, így a nézet az
egyetlen út bárki más bejegyzéséhez. A maszkolás képernyőn végezve egyetlen
PostgREST-kérésnyire hagyta volna az adatot — ugyanaz az érv, amit a `0037` a
szolgáltatásfájlban lévő `.neq()`-ról mondott.

A segédfüggvények azért élnek a `private` sémában, amiért a `0037` odatette
őket, és amiért egyszer meg is fizetett érte: egy szabálykifejezés a kérdező
szerep jogaival fut, tehát az általa hívott függvényt az `anon` és az
`authenticated` **muszáj**, hogy futtathassa — a HTTP API-ról nem a jogosultság
megvonása, hanem az elhelyezés tartja távol.

**Két migráció, szándékosan.** A `0041` csak hozzáad, és a futó alkalmazás alatt
lett alkalmazva; a `0042` zárja be az ajtót, és csak akkor ment ki, amikor már
élt a nézetet olvasó kliens. A tábla egy lépésben való szűkítése mindenkinek
kiürítette volna a hírfolyamát a kettő között.

**Ami vele jár.** A `review_likes`, a `review_comments` és a `review_cast` is
ahhoz a bejegyzéshez van kötve, amelyen ülnek, különben a kapu oldalt szivárog —
egy maszkolt `like_count` semmit sem ér, amíg a mögötte lévő sorok
megszámolhatók. A `friends_ratings` és a `friends_recent_plays` a nézetre mutat
át, mert `security invoker` függvényként különben üres „A követettek szerint"
blokkot adnának vissza, hibaüzenet nélkül. A `0031` évadfüggvényeit nem
piszkáljuk, és így csendben abbahagyják a válaszolást olyan `viewer`
argumentumra, amely nem a hívó — ezt a rést eddig senki nem vette észre.

**Ami nyitva marad:** a `stubs` bucket `public: true`. Az útvonalat már nem
adjuk ki annak, aki nem követ, de egy már meglévő hivatkozás továbbra is
megnyílik. Az adatkezelési tájékoztató ezt ki is mondja, nem sugallja az
ellenkezőjét; a bucket priváttá tétele aláírt URL-eket és aszinkron
`stubUrl()`-t igényel, és érdemes megcsinálni indulás előtt.

Ez nem az átlag visszatérése a hátsó ajtón. Ezek olyan számok, amelyeket egy
konkrét ember adott egy konkrét produkcióra, és neki mutatjuk meg őket; ami
továbbra is az értékelők számára vár, az bármilyen, *emberek között* számolt
érték.

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

### Egy szerep, több ember

Egy színház *szerepenként* tesz közzé egy sort, nem emberenként, és egy
szerepet rendszeresen többen is játszanak: a váltott főszereplők „Ács Eszter /
Battai Lili Lujza" alakban, egy kórus nevek sorozataként. A `play_cast` pont
azért (play_id, name, role) kulcsú, hogy mindegyikük saját sort kaphasson
ugyanannál a figuránál, és 2026 szeptemberéig a legtöbb adapter mégis az egész
stringet írta a `name`-be, mintha egy ember volna — a Csokonai esetében pedig
`split("/")[0]`-lal vette az elsőt, és a többit eldobta.

A `sync/lib/performers.ts` dönti el, hol vannak egy közreműködés határai, a
`sync/run.ts` pedig minden forrásra alkalmazza, ugyanazért, amiért a
`dedupeCast` is ott lakik: a forma a tábláé. A szétválasztás mindent-vagy-semmit
és szándékosan szigorú, mert a két hiba nem ugyanannyiba kerül — egy
szét nem vágott közreműködés az, amit a színház ma is közöl, egy olyan
szétvágása viszont, ami nem lista, embereket talál ki és oldalt ad nekik. Így a
„Numen/For Use + Ivana Jonke" és a „Molnár Levente - Liszt-díjas, érdemes
művész" egyben marad, míg a mellettük álló kórus szétválik.

A Csokonainak egy második javítás is kellett, mert kétféleképpen nyomtatja a
váltásokat. A vendégek egy elemen osztoznak, perjellel — ezt a szétválasztó
kezeli. A társulati tagok viszont *fejenként* egy-egy linkelt elemet kapnak, és
az adapter csak az elsőt olvasta — így Faluvégi Fanni a szétválasztás után is
hiányzott Pünkösdi Kató mellől a *Csókos asszony*ban az éles oldalon. A
`sync/adapters/csokonai.ts` most egy sor minden előadóelemét beolvassa, az
éles oldallal mint fixture-rel. A két Csokonai-forrásnál a több emberhez
rendelt szerephelyek száma 203-ról 292-re nőtt.

Jött vele egy üzemeltetési tanulság is. Az ütemezett szinkron 04:00 UTC-re van
bejelentve, és a GitHub 08:20 körül indította, mert az ugyanarra a percre
ütemezett jobokat együtt sorolja be, és az egész óra a legzsúfoltabb hely;
szeptember 8-án ez a négyórás csúszás azt jelentette, hogy a napi katalógus az
aznap reggeli merge *előtti* értelmezővel épült újra. A cron most `47 3 * * *`,
egy csúcsidőn kívüli perc, és a workflow-fájl leírja, miért.

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

### Egy színészre keresve minden előjött, csak ő nem

Az alkotói oldal megvolt, a keresés pedig rangsorolta a szereposztás-találatot,
és kettejük között ott maradt egy hiány, ami a keresőmező első használatakor
szembeötlő: a „Für Anikó" beírására megjött az a tizenegy előadás, amelyben
játszik — ő maga nem. Minden találat egy produkció volt, így az alkotói oldalra
egyetlen út vezetett: megnyitni valamelyik előadását, és a szereposztásban
rákoppintani a nevére.

A `0035_search_finds_people.sql` hozza a `search_people()`-t, ami ugyanarra a
kifejezésre emberekkel válaszol, a Felfedezés pedig a plakátrács fölött, az
„Alkotók" cím alatt sorolja fel őket — alkotók, nem „színészek", mert a
listában rendezők is vannak. Ugyanazt a két forrást olvassa, amit az alkotói
oldal: a `play_cast`-ot és a `plays.director` mezőben álló neveket. 945
produkció nevez meg rendezőt, és közülük csak 122 szerepel a szereposztás
táblában is, tehát egy csak `play_cast`-ra épülő keresés a katalógus rendezői
munkájának hét nyolcadát nem találná meg.

A rangsorolása nem a `search_rank()`-é. Egy névnek nincs szerzője vagy
helyszíne, amire visszaeshetne, a magyar pedig elöl írja a családnevet, így
annak a kifejezésnek, amely a név egyik *szavát* kezdi — egy önmagában beírt
keresztnévnek — saját sávja van a „csak tartalmazza" fölött, az azonos sávba
esőket pedig a közreműködések száma választja szét. Alatta ugyanaz a 0019-es
trigram-háló ül ugyanazon a 0.6-os küszöbön, így a „macsay" továbbra is
megtalálja Mácsai Pált.

A sorokban álló számok ugyanazok, amiket az alkotói oldal fejléce ír ki: ez
különbözteti meg a két azonos vezetéknevű embert, mielőtt bármelyik oldal
megnyílna. Nem a `person_profile()` eredményéből jönnek, hanem a találati
sorokból — az a függvény minden produkciót végigolvas a `director_names()`
számításával, ami egy oldalhoz egyszer rendben van, kétszáz jelölthöz viszont
elfogadhatatlan. Három dolog teszi elég gyorssá a lekérdezést ahhoz, hogy egy
keresőmező mögött álljon: a kifejezést skalár alkérdéseken keresztül olvassa, így
egyszeri `InitPlan` lesz belőle, amivel a 0019 trigram-indexe bejárható; a
fuzzy vizsgálat `%>` alakban áll, ami indexelhető; a CTE-k pedig
`MATERIALIZED`-ek, így a slug reguláris kifejezései a találati sorokon futnak, és
nem mind a 6 397-en. A kézenfekvő módon megírva ugyanez a lekérdezés 870 ms, így
127 ms — a `search_plays()` 96 ms alatt válaszol ugyanerre a kifejezésre.

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
kitalált értékelés pedig nem maradt magánügy: a `plays.rating_overall` ezekből a
sorokból számolódik, és korábban az Előadás részletei oldalon jelent meg —
vagyis egyetlen onboarding-menetben kitalált tizenöt négyes tizenöt valódi
produkció nyilvános pontszámát mozdította volna el. Az átlagot már nem mutatjuk
— lásd a „Szeretett, vagy megosztó" részt —, de az oszlop továbbra is ezekből a
sorokból számolódik, és egy értékelés, amit senki nem adott, továbbra is olyan
értékelés, amit senki nem adott.

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

A Felfedezés böngészősávjai a `plays.rating_overall` szerint rangsoroltak, ami
négy értékelésből számolt átlag 1 214 produkción. Ez nem népszerűségi jelzés,
hanem tizedesponttal ellátott zaj. Tíz kézzel készített lista ugyanezen a
katalóguson jobb első képernyő — és a népszerűségi jelzéssel ellentétben nem kell
hozzá, hogy előbb legyenek felhasználók.

Az érvelés kétszer nyert. A listák a 0025-ben elkészültek, 2026 szeptemberében
pedig az értékelés szerinti rendezés is lekerült a rácsról azzal az átlaggal
együtt, ami szerint rendezett: egy nyilvános listát olyan szám szerint sorba
rakni, amit senki nem lát, még mindig annak a számnak a közzététele, csak eggyel
lejjebb. A rács most **Bemutató** szerint nyílik, a „Népszerű" felirat pedig a
rendezéssel együtt ment, hiszen az a szó mindig is az átlagról szóló állítás
volt.

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

A Felfedezés az első három szerkesztői listát viszi, a hét műsorlistája és a
böngészőrács közé — szándékosan fölé, hiszen épp annak a rácsnak az átlaga
helyére készült ez a funkció. Az átlag azóta teljesen eltűnt, ami ugyanennek az
érvelésnek a végigvitele. A blokk eltűnik, amint város-,
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
és az `avatars`, mert a napló bejegyzése nyilvános volt, amikor készült — a
`reviews_select_all` a 0001-től a 0042-ig bárkinek engedte olvasni a szöveget.
**A bucket nem változott, amikor ez igen.** A 0041 már nem adja ki a
`stub_path`-t annak, aki nem követi a szerzőt, tehát a hivatkozás nem
felderíthető; a fájl viszont, ha valakinél már megvan a link, továbbra is
letölthető, és az adatkezelési tájékoztató ezt ki is mondja ahelyett, hogy a
kép priváttá válását sugallná. Magának a bucketnek a priváttá tétele külön
munka — aláírt URL-ek, és a `stubUrl()` aszinkronná válik —, és érdemes
megcsinálni indulás előtt. A naplózó űrlap közben már egyáltalán nem kér fotót
(lásd 983d6ef), tehát új kép nem érkezik oda. A tulajdonlást itt is
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

## Mit gondoltak a követettek, és egy kártya, amit érdemes megosztani

Két dolog zárja a terv utolsó fázisát.

**A követettek értékelései.** Egy teljes adatbázisra vett átlag arra válaszol,
hogy „szeretik-e ezt", ami nem az a kérdés, amit bárki feltesz egy műsor előtt
állva. Az inkább úgy szól: „*én* szeretném-e" — és a legolcsóbb őszinte közelítés
hozzá, jóval azelőtt, hogy elég adat lenne bármiféle kollaboratív szűréshez, az,
hogy mit gondolt róla az a néhány ember, akit te választottál. A
`0033_friends_ratings.sql` két lekérdezést ad hozzá: ki látta a követettjeid
közül ezt a produkciót, és hol jártak mostanában.

Az érvelés jól öregedett: az átlag mára lekerült az appról, és ez a rész az egyik
a két megmaradt értékelés-jelzésből — mert egy név, amit felismersz, egy pontszám
mellett bármekkora mintán információ.

Mindkettő RPC, mert a kliensoldali alternatíva az volna, hogy lekérjük az összes
követést, aztán az összes véleményt, aztán az összes profilt, és JavaScriptben
összefésülünk három listát egyetlen sorért. Három döntés van bennük:

Az adatlapon lévő lista **az este szerint rendez, nem az értékelés szerint** —
ez emberek listája, és a barátaidat aszerint sorrendbe tenni, mennyire tetszett
nekik valami, róluk szóló rangsornak hat. **Személyenként egy sort** mutat akkor
is, ha valaki többször látta, mert egy rajongó három bejegyzése leszorítana
mindenki mást egy olyan képernyőről, ahol néhány arcnak van hely. A Felfedezés
sávja pedig szándékosan **„amit láttak"**, nem „amit a legjobbra értékeltek":
egy felsőfok négy vélemény fölött ugyanaz az üres állítás, mint a
népszerűség-átlag, ami mellett áll — az viszont, hogy „elmentek rá", tény, és az
első bejegyzéstől kezdve igaz.

Mindkettő eltűnik, ha üres, ami a legtöbb fióknál az idő legnagyobb részében így
van. Egy üres „a barátaid" blokk arra emlékeztet, hogy nincsenek, és nem ez egy
műsorkínálat dolga.

**A megosztókártya.** A `handleShare()` linket osztott meg, ami semmit nem
terjeszt: egy link egy apphoz, ami senkinek nincs meg, úgy néz ki, mint egy link
egy apphoz, ami senkinek nincs meg. Egy naplózó appot a kép terjeszt, és ennek
van egy igazán jellegzetes jele, amit beletehet — a legtöbb app csillagokkal
értékel.

**Canvasra rajzoljuk, nem SVG-szövegként**, egyetlen konkrét okból: az `<img>`-en
keresztül raszterizált SVG el van szigetelve a dokumentumtól, és nem éri el az
oldal webfontjait — a kártya tehát Georgiában jönne ki, miközben az app Bodoni
Modában van szedve. A canvas-szöveg azzal rajzol, ami a dokumentumban be van
töltve, így a kártya és a képernyő, ahonnan jött, ugyanabban a betűben van.

Az álarc a `components/icons/maskGeometry.ts`-ből jön, a szóvédjegy logója
pedig a `components/icons/brandGeometry.ts`-ből — ugyanonnan rajzol a
`MaskIcon` és a `BrandMark` is. Ez az az egyetlen elem, amin az egész ötlet áll, és a
útvonalszámok két példánya elcsúszna, amint az egyikhez hozzányúl valaki — az
elcsúszás pedig csak valaki más képernyőképén lenne látható.

Az elrendezés **alulról felfelé** épül, és nem ez volt az első próbálkozás. A
plakáttól lefelé rétegezni a kézenfekvő megoldás, és egy háromsoros címet
egyenesen átvitt a szóvédjegyen — az „Ugyanaz másként - Kortársunk, Rómeó és
Júlia" pedig valódi cím ebben a katalógusban. Ha a rögzített elemeket az alsó
élhez horgonyozzuk, és a cím felfelé nő bele abba a helybe, amit a plakát
visszaad, a kártya nem tud átfedésbe kerülni magával, bármit is csinál a cím.

Csak weben működik, és ezt ki is mondja. Egy nézet képpé alakításához nativ
oldalon nativ modul és újrafordítás kell, a kiszállított termék pedig a statikus
webes export — így az `isShareCardSupported()` kapuzza a vezérlőt ahelyett, hogy
csendben visszaesne linkmegosztásra, ami ugyanaz a hazugság lenne, mint egy
számláló, ami sosem mozdul.

## Két számláló, ami sosem volt igaz

A `reviews.like_count` és a `comment_count` a `0001_init.sql` óta létezik, és
egyik kódút sem növelte soha egyiket sem. Minden hírfolyam-kártyán állandó
nullaként jelentek meg egy ikon mellett, ami koppintásra nem csinált semmit —
amíg egy későbbi commit le nem vette őket azzal, hogy egy vezérlő, ami sosem
működött, azt tanítja meg az első látogatónak, hogy az app makett.

A `0032_likes_and_comments.sql` a másik megoldás erre: legyenek igazak. Két
tábla, triggerek, amik becsületesen tartják a számlálókat, és a számlálók vissza
a kártyán — most már vezetnek is valahová.

**A számlálókat újraszámoljuk, nem növeljük.** Egy `+1/-1` számláló egyetlen
elmaradt visszagörgetésre van attól, hogy véglegesen hibás legyen anélkül, hogy
bárki észrevenné, mert nincs második forrás, ami ellentmondana neki. A sorokból
újraszámolni egyetlen indexolvasás, és nem tud elcsúszni. A
`services/socialService.ts` egyáltalán nem ír számlálót: azokat a
tetszés-sorokat olvassa, amiket amúgy is olvas ahhoz, hogy megválaszolja, „én
kedveltem-e".

**Két hiba, amit érdemes feljegyezni, mert mindkettő sikernek látszott.**

Az első: az értesítő trigger `case` kifejezéssel építette a dedupe-kulcsot, és
abban szerepelt a `new.id`. A `review_likes`-nak nincs `id` oszlopa — a kulcsa
`(review_id, user_id)` —, a PL/pgSQL pedig minden mezőhivatkozást feloldott egy
kifejezésben, akkor is, ha az az ág nem fut le: így *minden tetszés* elhasalt
`record "new" has no field "id"` hibával, beleértve azt az ágat is, ami hozzá sem
nyúl. `if`-re bontva csak azt oldja fel, amit ki is értékel.

A második halkabb volt, és ez a hasznosabb. Az újraszámoló trigger annak a
nevében fut, aki megnyomta a szívet, a sor pedig, amit frissítenie kell, valaki
máséhoz tartozik — így a `reviews_update_own` nulla sorra szűkítette az UPDATE-et.
**Az az UPDATE, amit az RLS semmire szűkít, nem hiba.** A tetszés elmentődött, az
értesítés megérkezett, a képernyő azt mutatta, amit kellett, a számláló pedig
nullán állt úgy, hogy sehol semmi nem jelzett hibát. Mindkét újraszámoló függvény
most `security definer`, ami nem optimalizáció, hanem az egyetlen mód, ahogy egy
trigger karbantarthat egy származtatott értéket olyan soron, amit a
kezdeményezője nem írhat.

**A drága trigger már nem fut le olcsó dolgokra.** A 0001
`reviews_recompute_rating`-je *bármilyen* review-frissítésre lefutott, a
`recompute_play_rating()` pedig a produkció minden értékelését átlagolja
felhasználónként, majd felhasználók között. Egy számláló karbantartása a
`reviews` frissítésével tehát minden egyes szívkoppintásra újraszámolta volna egy
előadás nyilvános értékelését. Most külön insert/delete triggerre és egy
`update of ... when (...)` triggerre bomlik, így az aggregálás csak akkor fut, ha
tényleg változott valami, amit olvas.

**A tetszés postaládába érkezik.** A 0030 megépített egyet, így a 0032
reakció-értesítései ugyanazon a táblán és képernyőn mennek át. A trigger, ami
írja őket, `security definer` — a 0030 szándékosan nem adott a
`notifications`-nek insert szabályt —, és az teszi biztonságossá, hogy semmi nem
a hívótól jön: a címzettet és a produkciót a bejegyzésből olvassuk, a
kezdeményező pedig az `auth.uid()`. Nincs út a kérés törzsétől egy oszlopig.

**A hozzászólásoknak pontosan egy moderációs szabályuk van.** Ketten törölhetnek
egyet: aki írta, és akié az este, ami alatt áll. A második nem udvariasság — ez
az egyetlen moderáció, amivel ez az app rendelkezik, és annak a szerzőnek, aki
nem tud eltávolítani valamit a saját naplóbejegyzéséről, egyáltalán nincs kiútja
belőle. Harmadik fél egyiket sem teheti meg, amit mindhárom megszemélyesítésével
ellenőriztünk.

A szál az este képernyőjén él, nem a hírfolyam-kártyán, mert egy beszélgetésnek
kell hely, ahol elolvasható; a kártya a számokat viszi, és odavezet. Ugyanez az
érvelés küldi a tetszés- és hozzászólás-értesítést a bejegyzésre, nem a produkció
adatlapjára, ami ennek a rossz vége.

**A szív vezérlő, a buborék link, és nem oszthattak tovább egy érintési
felületet.** A két számláló egyetlen `Pressable` volt, ami megnyitotta az estét.
Ez a hozzászólás-ikonnak helyes — minden appban ezt teszi, és a szálat el kell
tudni olvasni valahol —, a szívnek viszont nem: a szív mindenhol kapcsoló, ahol
bárki valaha megnyomott egyet. Az a szív, ami érintésre továbbvisz, akkor is
elrontottnak látszik, ha semmi nem hibázott. A szív tehát most helyben kedvel,
azonnal átbillenve és az írás bukásakor visszagördülve, a buborék pedig továbbra
is az estére vezet — de `?compose=1`-gyel, ami fókuszált hozzászólás-mezővel
nyitja meg, hogy a 0-t mutató buborék ne egy üres szálban érjen véget.
Kijelentkezve mindkettő a bejelentkezéshez visz: ez a legjobb pillanat, amit az
app kap a kérdésre, hiszen az olvasó épp talált egy estét, amire válaszolna.

A hírfolyam ehhez egyetlen új tényt tanul meg — *ezek közül melyiket kedveltem* —,
oldalanként egy lekérdezésből, nem kártyánként egyből; és a `getFeed` úgy készült,
hogy ennek a hibája ne bukhassa meg magát a hírfolyamot: a ki nem színezhető
szívek nem érnek meg egy oldalnyi estét. Maga a szám továbbra is a
`reviews.like_count`-ból jön és sehonnan máshonnan — ez akadályozza meg, hogy egy
kártya és a mögötte lévő este ugyanarról a tetszésről mást állítson.

## Egy harmadik számláló, ami sosem volt igaz — és a kijárat az alkalmazásból

A `0032` őszintévé tette a kedvelés- és hozzászólás-számlálókat, és le is írta,
miért voltak rosszak: a trigger annak a nevében fut, aki megnyomta a gombot, a
sor pedig, amit frissítenie kell, valaki máshoz tartozik — és **az az UPDATE,
amit az RLS nullára szűkít, nem hiba**. Ugyanez a mondat írja le a
`recompute_play_rating()` függvényt is, amit viszont senki nem nézett vissza.

Az soha, egyetlen egyszer sem frissített értékelést. Annak a nevében fut, aki a
kritikát írta, a `plays_update_own` pedig a `0001_init.sql` óta a
`created_by = auth.uid()` sorokra korlátozza az UPDATE-et — így minden olyan
naplózás, amit nem az előadás felvevője írt, csendben nem csinált semmit. A
javítás előtt mérve: az értékelést hordozó 14 kritikából **13 olyan előadáson
ült, amelyik továbbra is `rating_overall = 0.0` és `rating_count = 0` értéket
mutatott**. Az előadásoldal pontszáma, a naplózás gombja fölötti hisztogram és a
`rating_overall` szerint rendező „Népszerű" sáv mind egy olyan oszlopot
olvasott, amelyet a rendes használat soha nem írt. (Mindhárom lekerült azóta az
appról — lásd a „Szeretett, vagy megosztó" részt —, de az oszlop, amit olvastak,
továbbra is karban van tartva, és épp ennek a javításnak köszönhetően helyesen.)

Az az egyetlen sor, amelyiken mégis volt értékelés, épp ezt takarta el: egy
olyan előadás, amelynek az értékelője egyben a felvevője is — pontosan az az
eset, amit a szabály átenged.

A `0036_ratings_that_move_and_accounts_that_close.sql` `security definer`-ré
teszi — ez nem optimalizálás, hanem az egyetlen módja annak, hogy egy trigger
származtatott értéket tartson karban egy olyan soron, amit a végrehajtója nem
írhat, márpedig egy nyilvános átlag definíció szerint ilyen —, visszavonja az
`EXECUTE` jogot, hogy ne legyen belőle RPC, és visszatölti a meglévő sorokat.
Ma már semmi nem mond ellent a kritikáknak, és 17 előadáson van értékelés a
korábbi 4 helyett.

### Úgy került elő, hogy valaki távozni akart

Az alkalmazás nem tudott fiókot törölni, ami a weben GDPR-kötelezettség, és
mindkét alkalmazásbolt kemény követelménye. A
`supabase/functions/delete-account` a projekt első Edge Functionje, és egyetlen
okból létezik: az `auth.admin.deleteUser` a service-role kulcsot igényli, az
pedig nem szállítható egy olyan bundle-ben, amit bárki elolvashat.

Alig van benne törlő kód. Az idegen kulcsok a `0001` óta helyesek — a
`profiles`, `reviews`, `watchlist_entries`, `follows`, `subject_follows`,
`lists`, `review_likes`, `review_comments` és `notifications` mind
kaszkádol —, így az auth-felhasználó törlése az egészet elviszi. **A tárhely az,
amihez kód kell**, mert a tárolt objektumoknak nincs idegen kulcsuk az
`auth.users` felé, és csendben túlélnék a fiókot. Ez a `stubs` esetében
számít a legtöbbet: egy nyilvános tároló, tele jegyfotókkal, amiken név és
foglalási azonosító van, az az egyetlen hely itt, ahol az „elfelejtettük
kitakarítani" adatvédelmi incidens, nem pedig rendetlenség.

Egy tárolót szándékosan békén hagyunk. A `posters` a `user/<uid>/…` alatt
olyan borítóképet tart, amelyik egy őt túlélő előadáshoz tartozik — a
`plays.created_by` `on delete set null`, mert mások naplóbejegyzései
hivatkoznak ezekre a sorokra —, így a kép törlése ugyanaz a hiba lenne, mint
magának az előadásnak a törlése. A megerősítő szöveg ki is mondja, mert ha
valaki utólag szembesülne vele, az úgy hatna, mintha a törlés nem működött volna.

És így került elő az értékelési hiba. Egy auth-felhasználó törlése kaszkádol a
`reviews` és a `lists` felé, a GoTrue pedig ezt `supabase_auth_admin`
néven végzi — egy olyan szerep nevében, amelynek semmilyen joga nincs a
`public` sémában. Mindkét DELETE-re elsülő trigger egy olyan táblát próbált
frissíteni, amihez nem nyúlhat, így a törlés visszagördült, **„Database error
deleting user"** üzenettel — ami a réteget nevezi meg, mást semmit. Ugyanezt a
sort kézzel, `postgres` néven törölve tökéletesen működött, és pont ettől tűnt
úgy, mintha a hiba a függvényben lenne, nem a sémában. A
`list_items_touch_list()` ugyanebben a hibában szenvedett, csak észre sem
vette senki, mert a rendes úton a lista tulajdonosa és a végrehajtó ugyanaz.

### És a többi ajtó, ami nem volt ott

Még három dolog, amit egy fiók nem tudott — mind előfeltétel, nem funkció:

- **Elvinni magával az adatait.** A `services/accountService.ts` egyetlen
  JSON-fájlba írja ki a naplót, az értékeléseket, a listákat, a kívánságlistát és
  a követéseket. Csak böngészőben, és ezt ki is mondja, ugyanúgy, ahogy a
  megosztókártya teszi.
- **Visszaszerezni egy jelszót.** Itt nincs OAuth-szolgáltató, nincs varázslink
  és nincs második faktor, így egy elfelejtett jelszó megszüntette a fiókot. A
  `forgot-password` és a `reset-password` ezt zárja le. A jelszóváltó képernyő
  nem olvas tokent: az e-mailben küldött link hordoz egyet, a
  `detectSessionInUrl` ezt még a képernyő megjelenése előtt rövid életű
  munkamenetre váltja, és ami marad, az egy hétköznapi jelszóváltás.
- **Elolvasni, mihez járult hozzá.** Az `app/legal/` tartalmazza az
  adatkezelési tájékoztatót, a felhasználási feltételeket és az impresszumot, a
  szöveg pedig az `i18n/legal.ts`-ben él. Ezek rendes route-ok, így az
  `expo export` előrendereli őket, az nginx pedig sima URL-en, munkamenet
  nélkül szolgálja ki — amire a Google Play fióktörlési URL-követelményének is
  szüksége lesz majd. Az adatkezelési tájékoztató azzal kezd, amit egy sablon
  soha nem mondana ki: hogy pontosan hol húzódik a határ a bejegyzés mindenki
  által olvasható és a csak a követőidnek látszó fele között, és hogy egy
  jegyfotón általában rajta van a neved és a foglalási azonosítód, egy olyan
  tárolóban, amely azután is nyilvános marad, hogy a hozzá vezető hivatkozás
  már nem az.

## Az évadot számoljuk, nem a naptári évet

Senki nem naptári években számolja a színházba járását. A magyar évad
szeptemberben kezdődik, és egy statisztika, ami december 31-én vág ketté,
mindegyiket félbevágja: a novemberi vígszínházi bemutató és a februári ugyanahhoz
az évadhoz tartozik, mégis két külön összesítésbe került.

A profil a `0001_init.sql` óta hordoz egy `thisYear` mutatót, pontosan ezen a
rossz naptáron. A `0031_the_evad.sql` ez a mutató képernyővé nőve, a helyes
naptárral — és maga a mutató is az évadot számolja, ami látható különbség, nem
szőrszálhasogatás: egy fiók, amelynek januári, áprilisi és szeptemberi
bejegyzései vannak, a régi naptáron **3**-at mutat, az újon **1**-et, és az új
szám az igaz.

**Az évad augusztusban zárul, nem júniusban.** Ez a migráció egyetlen valódi
döntése. A `0006_play_status.sql` már rögzíti, hogy a kőszínházak június
közepétől sötétek, és hogy a szabadtéri helyszínek ezt pontosan megfordítják — a
Nagyerdei, a Margitsziget és a Városmajor *csak* nyáron játszik. Ha az évad
júniusban érne véget, ezek az esték két évad közötti résbe esnének. Így az évad
szeptember 1-től augusztus 31-ig tart, minden dátum pontosan egybe tartozik, és
egy júliusi margitszigeti este az előző ősszel nyílt évad farka, nem külön évad.

**A számtan szándékosan kétszer van megírva**, ugyanúgy, mint a `person_slug()`:
a `public.season_start_year()` számolja a sorokat, a `utils/season.ts` nevezi meg
az évadot a címben, még mielőtt bármilyen körút lezajlana, a határesetek pedig
egymáshoz vannak rögzítve. Ha eltérnének, az oldal címe az egyik évadot mondaná,
a tartalma a másikat.

A `utils/season.ts` viszi a toldalékot is, ami az a fajta részlet, ami eldönti,
hogy egy app írottnak vagy fordítottnak hat. A magyar a kiejtés szerint teszi a
kötőhangot a szám után: a 26 „huszonhat", tehát „a 2025/26-**os** évad", a 27
viszont „huszonhét", tehát „a 2026/27-**es** évad" — a nullára végződő év pedig a
tízes szót veszi („a 2029/30-**as** évad", a „harmincas"-ból). Mindez tesztelve
van.

**A legtöbbször látott előadó két forrásból jön, igazságtartalom szerinti
sorrendben.** Ahol egy bejegyzés rögzítette, ki lépett aznap színpadra — a 0028
`review_cast` táblája —, arra az estére kizárólag az számít. Minden más este az
előadás hivatalos szereplőlistájára esik vissza, ami a legjobb, amit egy
katalógus mondhat egy olyan estéről, amihez senki nem naplózott szereposztást. Az
a lényeg, hogy a kettő *bejegyzésenként* keveredik, nem évadonként: egy este, ami
azt mondja, „a beugrót láttam", nem számíthat egyszerre a főszereplőnek is, akiről
azt állítja, hogy nem lépett fel.

Két dolgot a képernyő kimond ahelyett, hogy elrejtené. Kiírja a nevezőt a
költések mögé — kilencből öt bejegyzésen alapuló átlag más állítás, mint a
kilencen alapuló, és csak az egyik „az évad átlagos jegyára". És kiírja, hány
bejegyzés esik kívül minden évadon, mert nincs dátuma — ilyet ír az onboarding:
aki az első futáskor tizenöt előadást jelölt be, máskülönben megnyitná ezt az
oldalt, nullát látna, és arra jutna, hogy elromlott. Ugyanaz az őszinteség, amit
a `0026` választott, amikor a `seen_at`-et nullozhatóvá tette.

## A kör bezárása

Tíz adapter fut minden éjjel, és az adatbázis megtud dolgokat — egy előadás,
amit elmentettél, kiírta a tavaszi időpontjait, valami a listádról holnap megy, a
színház, amit követsz, új bemutatót hirdetett. Mindez a `plays`-be és a
`performances`-be került, és ott meg is állt. Ez volt az app leggyakoribb oka
arra, hogy valaki visszanyissa — és nem létezett.

A `0030_alerts.sql` felveszi a `notifications` táblát és a feladatot, ami
megtölti. Szándékosan appon belüli postaláda, nem push: nincs eszközazonosító,
nincs APNs- vagy FCM-beállítás, nincs mit konfigurálni az első verzió előtt, és
az e-mail később ugyanezekre a sorokra ülhet rá anélkül, hogy bármi változna.

**A sorok szerkezetet hordoznak, nem mondatokat.** A `payload` egy `jsonb`, amiben
a dátum, a helyszín neve, az előadó van — a magyar szöveget az `app/inbox.tsx`
állítja elő. Egy kész prózával teli értesítéstábla második, láthatatlan helye
lenne az app hangjának, méghozzá az, amit soha senki nem gondol átírni.

**A feladat felépítésénél fogva idempotens.** Nincs emlékezete az előző futásáról,
ezért minden sor, amit létrehozhat, kap egy `dedupe_key`-t, ami arra a tényre
nézve állandó, és megváltozik, ha a tény változik — a `(user_id, dedupe_key)`
egyedi index mellett. Ha kétszer fut egy éjjel, vagy három nap kiesés után hoz
be lemaradást, mindent pontosan egyszer küld el.

A kulcsokba ment a gondolkodás. Az „időpontok kiírva" a jelenleg meghirdetett
**legtávolabbi** dátumra kulcsol, tehát akkor szólal meg, ha egy színház
meghosszabbítja a szériát — és nem minden alkalommal, amikor a legkorábbi dátum
átcsúszik a múltba, ami a minimumra kulcsolva minden éjjel megtörtént volna. A
„holnap játsszák" az előadásra kulcsol, nem a napra, mert a délutáni és az esti
előadás két külön döntés.

**Semmi nem szólal meg arról, amit már tudtál.** A
`performances.created_at > watchlist.added_at` és a
`plays.created_at > subject_follows.created_at` a hír definíciója: új, *amióta
kérted*. Nélkülük az első futás mindenkinek elmondja azokat az időpontokat,
amiket már látott, amikor elmentette, egyetlen Örkény-követés pedig mind a 76
produkciót kiküldi. Van egy 30 napos alsó korlát második, tompább védelemként —
és őszintén ki kell mondani, hogy ma semmit nem ér: az egész katalógus az elmúlt
hónapban került be, tehát a korlát minden sor fölött van. Akkor kezd működni,
amikor az import kiöregszik, ami pontosan az a pillanat, amikor egy sorokat
újralétrehozó szinkronváltozás máskülönben megkülönböztethetetlen lenne egy
évadhirdetéstől.

**Bejelentkezve semmi nem írhat ilyet.** Egyáltalán nincs insert szabály: a sorok
az éjszakai feladattól jönnek, ami service role-ként fut, a
`generate_notifications()`-től pedig el van véve az `EXECUTE` az `anon` és az
`authenticated` szerepektől. Mindkettőt valódi belépett kérés megszemélyesítésével
ellenőriztük — `set local role authenticated` plusz `request.jwt.claims`, ugyanaz a
technika, amivel a 0025 kiemelt-lista őrét elkaptuk —, és mindkettő elutasításra
kerül. A `follows`-szal és a `subject_follows`-szal ellentétben ezek a sorok nem
is olvashatók nyilvánosan: egy követés egy előadóról szóló állítás, egy postaláda
viszont valakinek a teljes kívánságlistája, érdeklődési sorrendben.

A feladat a `sync/run.ts` végén fut, a státusz- és műfaj-újraszámolás után, mert
az, hogy egy produkció archivált-e, és hogy milyen dátumai vannak, egyaránt
bemenete annak, hogy „érdemes-e erről bárkinek szólni". SQL-ben van megírva, nem
az adapterekben, ugyanazért, amiért azok a menetek is: egy színház tíz adapter
bármelyikén keresztül közzétehet egy dátumot, és arra, hogy „érdekli-e ez
bárkit", ugyanaz a válasz.

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

## Az a letiltás, ami csak elrejt, fél funkció

A kritikák és a hozzászólások itt idegenek nyilvános írásai. Egészen mostanáig
az egyetlen moderációs szabály az egész rendszerben egy házirend volt a
`0032`-ből: egy naplóbejegyzés gazdája törölhetett egy hozzászólást a saját
estéje alól. Nem volt mód semmit bejelenteni, nem volt mód senkit elkerülni, és
az üzemeltetőnek sem volt módja levenni egy sort azon kívül, hogy törli az
SQL-szerkesztőből.

Ez valódi biztonsági hiányosság az élő webes terméken — és ettől függetlenül az
App Store 1.2-es irányelve, a legvalószínűbb ok, amiért ezt az alkalmazást
elutasítanák a felülvizsgálatnál. A `0037_reports_and_blocks.sql` ezt zárja be.

### Miért házirendek a szabályok, és nem lekérdezések

Itt minden szűrés row-level security házirend, nem egy feltétel a `services/`
alatt. Ez a különbség maga a tervezés lényege.

Egy `.neq("user_id", blockedId)` egy szolgáltatásfájlban *javaslat*. A PostgREST
készséggel válaszol egy olyan kérésre is, amiből kimarad, tehát a védelem csak
azokra a lekérdezésekre érvényes, amelyek nem felejtik el kérni — és minden
később hozzáadott képernyőnek emlékeznie kell rá, örökre, beleértve azokat is,
amiket még senki nem írt meg. Egy házirend viszont válasz minden lekérdezésre,
amit valaha bárki írni fog. Ez a különbség egy szabály és egy szokás között.

Az ára az, hogy a házirendeket nehezebb olvasni, és sokkal nehezebb tesztelni.
Épp ezért az alábbi két dolgot a *futtatásuk* hozta felszínre, nem az
elolvasásuk.

### Attól, hogy valakinek az írását elrejtjük, még írhat

A letiltás kézenfekvő fele a select-házirend: a bejegyzésed láthatatlanná válik
annak, akit letiltottál. Ez a rész könnyű volt, és nem elég.

A `review_comments` `with check (user_id = auth.uid())` feltétele semmit nem
kérdez arról, hogy *kinek* az estéjéhez szól a hozzászólás. A letiltott fiók
tehát továbbra is beküldhetett volna egy hozzászólást a kritikád azonosítójával
— a sor létrejött volna, a trigger megnövelte volna a hozzászólás-számlálódat,
te pedig csak azt a képességet vesztetted volna el, hogy *lásd*, ahogy ez
történik. Az a letiltás, ami a zaklatás bizonyítékát tünteti el a zaklatás
helyett, rosszabb, mintha nem lenne letiltás, mert aki használja, azt hiszi,
védve van.

Így a hozzászólások, a tetszések és a követések insert-házirendje mind
ellenőrzi a letiltást, egy trigger pedig eldobja a már meglévő követést mindkét
irányban — mert a `generate_notifications()` a `follows`-ból olvas, és különben
minden rögzített estédről értesítené a letiltott fiókot.

A letiltás ugyanezért szimmetrikus. Az egyirányú letiltás szabadon hagyná a
másikat, hogy olvassa, idézze és megválaszolja mindazt, amit írtál.

### Egy RLS-házirend a lekérdező szerep jogaival fut, nem a tábla tulajdonosáéval

Ez rövid időre eltörte az élest, és ez a szakasz leghasznosabb része.

A `blocked_between(other uuid)` más emberekhez tartozó `user_blocks` sorokat
olvas, tehát `security definer`-nek kell lennie. Ettől viszont sajátos módon
veszélyes: `public` függvényként elérhető lenne a
`POST /rest/v1/rpc/blocked_between` címen, és bármely azonosítóra megválaszolná,
hogy *„letiltott-e engem ez a személy"*. Senkinek nem mondjuk meg, hogy
letiltották — a közlés maga is érintkezés, és pontosan ez az, amit valaki, aki
épp letiltott valakit, el akar kerülni.

A kézenfekvő javítás a `revoke execute ... from public, anon, authenticated`, és
téves. **Egy házirend kifejezése a lekérdezést futtató szerep jogaival
értékelődik ki, nem a tábla tulajdonosának jogaival.** Az execute elvétele nem
egy végpontot szüntetett meg, hanem minden házirendet eltört, ami hívta a
függvényt. A `select * from reviews` ettől ez lett:

```
ERROR: 42501: permission denied for function blocked_between
```

az oldal *minden* olvasója számára, bejelentkezve és anélkül is. A
`blocked_between` egy névtelen látogatónál azonnal hamissal tér vissza, de a
házirendnek akkor is *meg kell hívnia*, hogy ezt megtudja — és épp a hívás volt
az, ami már nem volt megengedve.

Ez az utolsó mondat helyesbítés. Ennek első leírása azt állította, hogy a kiesés
csak a bejelentkezett olvasókat érintette, a névtelen látogatókat nem — ami az
egyetlen ténylegesen megfigyelt hibából volt következtetve, és soha nem lett
ellenőrizve. A pontos szerkezetet egy eldobható táblán reprodukálva az `anon`
ugyanúgy elhasal. Érdemes rögzíteni, mert egy hihető részlet kitalálása azért,
hogy a magyarázat kerek legyen, ugyanaz a hiba, mint az alábbi szerkezeti
ellenőrzés: mindkettő olyasmit állít elő, ami tudásnak látszik, és nem az.

A jognak léteznie kell. Aminek nem szabad léteznie, az a végpont — és a kettő
szétválasztható: a PostgREST csak a beállított sémáiban (`public`,
`graphql_public`, `storage`) teszi közzé a függvényeket. Egy `private` sémában
lévő függvényt egy házirend elér, a HTTP nem. Ez a javítás, és a `public`
másolat törlődik, nem marad ott — mert ugyanannak a szabálynak egy második,
soha ki nem értékelt definíciója pontosan az, amitől a következő ember újra
elrontja.

Egy viselkedési teszt fogta meg: tizenegy állítás egy visszagörgetett
tranzakcióban, ami lefedi a letiltás mindkét irányát, a követést eldobó
triggert, az írási házirendeket, és a szerzőt, aki továbbra is látja a saját
elrejtett kritikáját. Az „el van-e véve a jog, ki van-e tűzve a `search_path`"
szerkezeti ellenőrzés vidáman átment volna vele. Ezt érdemes felidézni, amikor
legközelebb valami ellenőrzöttnek látszik.

### Elrejtés, nem törlés

Az `is_hidden` a `reviews` és a `review_comments` táblán az üzemeltető
levételi eszköze, és szándékosan visszafordítható. Egy bejelentés lehet téves,
egy törlés nem vonható vissza, és egy eltávolított sor egyben annak a
bizonyítéka is odalett, hogy *miért* távolították el.

A szerző továbbra is látja a saját elrejtett kritikáját. Egy naplóbejegyzés itt
éppúgy valakinek a saját feljegyzése egy estéről, mint nyilvános bejegyzés, és
egy levételnek a nyilvános felét kell eltüntetnie anélkül, hogy a magánfelét
csendben törölné.

### Nincs admin alkalmazás

A `supabase/moderation.sql` hat lekérdezés: a nyitott sor a bejelentett
szöveggel együtt, ugyanezek célonként csoportosítva, hogy öt ember egy
hozzászólásra tett bejelentése egy problémának látsszon, hogyan rejtsünk el
valamit, hogyan zárjunk le egyszerre minden ugyanarról a célról szóló
bejelentést, ki mennyit jelent be és mennyit utasítunk el, és mi van jelenleg
elrejtve.

Ez a teljes moderációs felület, szándékosan. A kiemelt listákat amúgy is kézzel
gondozzuk az SQL-szerkesztőben, egy üzemeltető van, egy admin felület pedig,
amit még felhasználók előtt építünk, egy második karbantartandó termék, aminek a
használatát senki nem kérte. Az `npm run check:launch -- --stores` ellenőrzi,
hogy mindhárom felület, ahol idegen írása jelenik meg, továbbra is kínál
bejelentési lehetőséget — név szerint, mert a tényleges hibamód az, hogy egy
később hozzáadott képernyő csendben kimarad belőle.

Az egyetlen dolog, amit a repó nem tud ellenőrizni: alkalmazva van-e a migráció
arra az adatbázisra, amivel egy adott build beszél. Nélküle a vezérlők
díszletek, és minden írás 400-as hiba.

## Valami, amit egy bolt is elfogad

Ez mindig is valódi React Native alkalmazás volt, nem egy burokba csomagolt
weboldal — és általában épp ez az, ami a webes eredetű alkalmazásokat elsüllyeszti
a felülvizsgálatnál (az Apple 4.2-es, „minimális funkcionalitás" irányelve). De a
*hihető* és a *megépített* két különböző szó, és eddig egyetlenegyszer sem
fordítottuk le telefonra. Az út nyitva állt, és kipróbálatlan volt.

Amitől sürgőssé vált, az egy már lejárt határidő. A Google Play 2026. augusztus
31. óta minden új feltöltéstől Android **API 36**-ot követel, az Expo SDK 52
pedig — amire ez íródott, 2024 novemberi kiadás — `targetSdk` 35-tel jár. Erre
nem volt olyan beállítás, ami segített volna: a válasz öt SDK-kiadás.

### Öt főverzió, és a négy dolog, ami tényleg eltört

Expo 52 → 57, React 18 → 19, React Native 0.76 → 0.86. Ez újraírásnak hangzik, és
nem az volt, mert az alkalmazás függőséglistája rövid, és a saját komponenseit
maga birtokolja. Négy dolgon kellett változtatni, mind átnevezés:

- A `StyleSheet.absoluteFillObject` eltűnt az RN 0.86-ban. Az `absoluteFill` ma
  már sima, fagyasztott objektum, nem regisztrált stílusazonosító, tehát
  szétteríthető — és a régi nevet itt eleve csak így használtuk.
- **Az expo-router 57 már egyáltalán nem függ a `@react-navigation`-től.** Saját
  másolatot visz magával. A `package.json` két közvetlen függősége tehát
  ugyanazon típusok második, szerkezetileg összeférhetetlen készlete volt, és a
  rossz helyről importált `BottomTabBarProps` már nem írta le azokat a propokat,
  amiket az expo-router valójában átad. Mindkettő kikerült; a típus és maga a
  `Tabs` is az `expo-router/js-tabs`-ból jön, mert az `expo-router`-ből való
  újraexport elavult.
- A `Router` mostantól `ImperativeRouter`.
- A `Skeleton` egy refben tartotta az `Animated.Value`-ját, és render közben
  olvasta, amit a `react-hooks` 6 React Compiler-szabályai elutasítanak. Helyette
  lusta `useState` — ami azt is megszünteti, hogy minden renderben új
  `Animated.Value` készüljön, csak hogy azonnal eldobjuk.

A frissítés 22 lint-jelzést hagyott maga után, mind egyetlen új szabályból: a
`set-state-in-effect`-ből. Mindegyik egy `setState` egy egyébként aszinkron
effekt szinkron, korai kilépési ágán — egy sáv `[]`-re állítása, amikor megszűnik
a munkamenet; egy útvonalparaméter state-be másolása, miután betöltött a lista,
amit indexel. Ezek valódi „származtatott érték state-ben" szagok, és a
kibogozásuk tíz képernyőn át a state tulajdonlásának átrendezését jelenti. Az
önálló változtatás, önálló ellenőrzéssel, és ha egy olyan frissítés belsejébe
temetnénk, aminek az egész értéke épp az, hogy semmilyen viselkedést nem
változtatott, mindkettőt nehezebb lenne elhinni. Az `.eslintrc.js` figyelmeztetésre
fokozza le a szabályt, az indoklással együtt melléírva, hogy a szám látható
maradjon, és csak csökkenhessen.

Mivel a Metro a típusokat eldobja, nem ellenőrzi, egy ilyen frissítést nem a
build bizonyítja, hanem a `tsc --noEmit` — ezért futtatja a CI. Ketten együtt a
típusellenőrzés és a 299 fixtúrateszt mind a négy törést megtalálta, mielőtt
bárki böngészőt nyitott volna.

### Az app.json app.config.ts lesz

Szinte minden mező, ami egy boltot érdekel, megkíván egy mondatnyi magyarázatot
arról, hogy miért épp úgy van beállítva — és a JSON nem tud ilyet hordozni.
Hármat közülük különben csak nehéz úton fedez fel az ember, és mindhárom
ugyanolyan alakú: valami hiányzik, és semmi nem szól róla.

- **Az adatvédelmi manifest.** 2024 tavasza óta az Apple elutasít minden buildet,
  ami kötelező indoklású API-t hív indoklási kód nélkül. Az alkalmazás négyet is
  érint — fájlidőbélyeg, `NSUserDefaults`, rendszerindítási idő, szabad
  lemezterület —, és *ezek közül egyik hívás sincs az alkalmazás kódjában*. A
  React Native-ből és az Expo-moduljaiból jönnek, és pontosan ezért maradnak
  láthatatlanok addig, amíg egy elutasítás meg nem nevezi őket.
- **`usesNonExemptEncryption: false`.** Az alkalmazás közönséges HTTPS-en beszél a
  Supabase-zel, és semmilyen saját titkosítást nem szállít. Ha az exportmegfelelést
  a binárisban válaszoljuk meg, akkor soha többé nem kell gondolni rá — különben
  minden egyes beadásnál kézzel kérdezik meg, és addig blokkolják.
- **`blockedPermissions`.** Az expo-image-picker konfigurációs pluginje akkor is
  hozzáadja a kamera- és mikrofonjogosultságot, ha nincsenek használatban, ez az
  alkalmazás pedig kizárólag a `launchImageLibraryAsync`-et hívja. Békén hagyva a
  Play-adatlap olyan hozzáférést állított volna magáról, amit az alkalmazás soha
  nem kér, az adatbiztonsági űrlapot pedig ehhez kellett volna igazítani.

Két sémaváltozás jött az SDK-ugrással: az SDK 54 kivette a legfelső szintű
`splash` kulcsot (ma az `expo-splash-screen` plugin), az SDK 57 pedig a
`newArchEnabled`-et, mert már csak egyetlen architektúra van. Mindkettőre az
`npx expo-doctor` az ellenőrzés, és 21/21-gyel megy át.

### Mélylinkek, és egy hiba, amiben nincs hibaüzenet

Az `ios.associatedDomains` és egy `autoVerify` intent filter az alkalmazás
felől igényt támaszt az éles domainre. Mindkét fél önmagában hatástalan: minden
bolt lekér egy fájlt is arról a domainről, ami megnevezi, melyik alkalmazás
támaszthat ilyen igényt — és **egyik bolt sem szól, ha az hiányzik**. A link
egyszerűen böngészőben nyílik meg — pontosan úgy, ahogy azelőtt, hogy a
mélylinkeket egyáltalán beállítottuk volna. Egy funkció, ami úgy hibázik, mintha
meg sem épült volna, elromlott is marad.

Ezért a két fájlt szkript írja, nem kéz, abból a két hitelesítőből, amelyik addig
nem létezik, amíg le nem futott egy EAS build — az Apple Team ID-ból és az aláíró
kulcs SHA-256 ujjlenyomatából:

```bash
npx tsx scripts/write-well-known.ts --team-id ABCDE12345 --sha256 AA:BB:...
```

A `public/.well-known/`-ba kerülnek, amit az `expo export` szó szerint másol a
`dist/` gyökerébe, így a következő telepítés már kiszolgálja őket. Az
`nginx.conf` egyetlen okból kapott blokkot erre a könyvtárra: az Apple a
`/.well-known/apple-app-site-association` címet kéri le — *kiterjesztés nélkül* —,
és `application/json`-ként kell kiszolgálni. Az nginx kiterjesztés alapján
típusol, tehát explicit `default_type` nélkül `application/octet-stream`-ként
menne ki, és csendben elutasítanák — ami ugyanaz a hibamód, egy szinttel lejjebb.

### A natív projektek generálódnak, nem íródnak

Az `android/` és az `ios/` a `.gitignore`-ban van. Az `app.config.ts` az egyetlen
létező leírásuk, és az `expo prebuild` — amit az EAS Build a saját gépein futtat
— ebből állítja elő a két könyvtárat, igény szerint. Ha becommitolnánk őket, az
minden kérdésre egy második, elavult választ adna, amire a konfiguráció már
válaszol: egy gitben tárolt `AndroidManifest.xml` még jóval azután is őrzi a
jogosultságokat, amikkel készült, hogy a konfiguráció már nem kéri őket.

Ez a helyben lefuttatott prebuild az egyben, ami a konfigurációt ellenőrizte is.
A generált manifestből mindhárom letiltott jogosultság kikerül
(`tools:node="remove"`), benne van az `autoVerify` intent filter az éles hosztra,
és — a React Native 0.86 Gradle verziókatalógusán át — `targetSdk` 36,
`compileSdk` 36, `minSdk` 24 lesz belőle. Ez a teljesített határidő.

Az iOS-fél sémahelyes és bizonyítatlan: az `expo prebuild` Windowsról nem generál
Xcode-projektet, így az adatvédelmi manifestet és az entitlementeket az első,
macOS-en futó EAS build gyakorolja be először.

### A jelet a gép rajzolja, nem a kéz

Az appnak van logója: egy függönyszegély, alatta két félrekötött szárny, és a
köztük lévő nyílásban egy csillag. Öt fájl rajzolja ki — `icon.png`,
`adaptive-icon.png`, `splash.png`, `favicon.png` és `assets/logo-source.svg` —,
és mind az öt kimenet. Az útvonaladatokat a
`components/icons/brandGeometry.ts` tartja, a két színt a `theme/themes.ts`, a
többit pedig az `npm run icons` írja meg.

Ez a szabály itt fontosabb, mint bárhol máshol a repóban, mert egy PNG
láthatatlan a diffben. Egy kézzel átszerkesztett ikon nem tűnik fel a
kódellenőrzésen, és egy elavult példány ott bukkan elő, ahol már nem lehet
kideríteni, melyik rajz volt a szándékolt: egy bolti listán vagy valaki
kezdőképernyőjén, hónapokkal később. Tehát: átírod a jelet, lefuttatod a
szkriptet, commitolod, amit írt. Az `assets/logo-source.svg`-t ugyanezért írja a
szkript — korábban ez volt a kézzel karbantartott eredeti, márpedig épp a kézzel
karbantartott eredeti az a példány, amelyik elcsúszik.

A geometriát nem az ízlés döntötte el, hanem az, hogy 22, 32 és 48 pontosan is
kirajzoltuk. Az első vázlatban a szárnyak egy vonallal húzott rúdról lógtak, és
nagyobb csillag ült köztük: 180 ponton zászlónak látszott, 32-n arany
masszának. Most minden kitöltés — egy vonalat minden nem SVG rajzolóban kézzel
kell skálázni, a weben pedig a fel nem oldódó `stroke` a `none`-ra esik vissza
(lásd `svgPaint.ts`), ami némán tüntetné el a rudat a lelógó szárnyak alól —, a
szárnyak belső éle pedig kifelé ível lefelé haladva, így a nyílás pont ott a
legszélesebb, ahol a csillag ül.

Ugyanezekből a konstansokból rajzol a `BrandMark` az appon belül, és ezeket
tölti ki a megosztókártya is a vászonra, a szóvédjegy mellé. Ugyanaz az érvelés,
mint az álarcnál: ami elhagyja az appot, annak ugyanannak kell lennie, ami benne
van.

### Egy aszimmetria, amit érdemes tudni

A palettaválasztó mindkét platformon működik, csak másképp: a weben CSS custom
propertyket cserél a dokumentumelemen, natíven a `PaintContext`-en keresztül
újrarenderel (lásd fentebb: *Öt paletta*). Az van rögzítve, amit a rendszer
azelőtt rajzol, hogy az app bármit mondott volna — az `app.config.ts`-ben a
`userInterfaceStyle` és az indítóképernyő háttere sötét, és az is marad, mert
egy indítóképernyő nem tudhatja, melyik témát választotta az olvasó.

### Ami még hiányzik

Az `npm run check:launch -- --stores` a lista, és amit tud, azt ki is kényszeríti. A moderáció korábban ennek az élén állt, most már nem — lásd: *[Az a letiltás, ami csak elrejt, fél funkció](#az-a-letiltás-ami-csak-elrejt-fél-funkció)*:

- **Az EAS projekt összekötése.** Az `npx eas-cli init` írja be az
  `extra.eas.projectId`-t, és Expo-fiók kell hozzá. Ez az első lépés, amit nem
  lehet a repóból megtenni.
- **A két igazoló fájl**, amikhez a fenti hitelesítők kellenek.
- **A megosztókártya**, ami egy estét rajzol canvasra, és így natív buildben
  egyáltalán nem csinál semmit.

És a részek, amiket semmilyen repó nem tud ellenőrizni: egy Apple Developer
Program tagság (99 USD/év, napokig tartó ellenőrzéssel), egy Play Console fiók
(25 USD egyszer), a döntés, hogy magánszemélyként vagy magyar cégként jelenjünk-e
meg — ami a DSA szerint eldönti, hogy egy lakcím felkerül-e az App Store oldalára
27 országban —, és a Google követelménye, hogy egy 2023. november 13. után
létrehozott magánfiók zárt tesztet futtasson **12 tesztelővel, 14 egymást követő
napon át**, mielőtt éles hozzáférést kérhet. Ez az utolsó nagyjából három hét
naptári idő, amit nem lehet összenyomni, úgyhogy érdemes elkezdeni, amint van
mit telepíteni.

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
városban, együtt nagyjából 1200 produkciót adnak — ebből körülbelül 300 fut most
vagy meg van hirdetve, alig 900 alatti pedig olyan, amit maguk a színházak
sorolnak az archívumukba —, valamint közel 500 közelgő játszási időpontot. Az archív sorok
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
