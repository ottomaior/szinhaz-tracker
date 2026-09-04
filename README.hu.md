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
**sorrendben** (`0001_init.sql`-től a `0012_replace_play_cast.sql`-ig) a projekt
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
    discover.tsx             Felfedezés — keresés + helyszíntípus szűrők
    watchlist.tsx             Figyelőlista
    profile.tsx                Profil
  play/[id].tsx           Előadás részletei
  checkin.tsx             Előadás rögzítése (modál)
  add-play.tsx            Előadás kézi felvitele (modál, belépés kell hozzá)
  sign-in.tsx / sign-up.tsx  Auth modálok

components/
  icons/                  kézzel rajzolt SVG ikonok, köztük az álarc-értékelő jel
  ui/                     Button, Chip, Avatar, PosterPlaceholder, TabBar

theme/                    tervezési tokenek — a „Velvet Curtain" vizuális
                          rendszer egyetlen forrása
  colors.ts               a paletta, mellette az OKLCH érték, amiből az adott
                          hexa származik
  typography.ts           a két márkabetű és a visszaesési sorrendjük
  type.ts                 a tipográfiai skála: nyolc megnevezett szerep
  tokens.ts               térközök, lekerekítések, árnyékszintek, töréspontok,
                          maximális szélességek

contexts/AuthContext.tsx  Supabase munkamenet-állapot, az egész appot körbeveszi

data/types.ts             domain típusok (Play, Venue, Review, User, …)
services/supabase.ts      a Supabase kliens (az EXPO_PUBLIC_SUPABASE_*-ot olvassa)
services/playsService.ts  a képernyők KIZÁRÓLAG innen kapnak előadás/helyszín/
                          felhasználó adatot — Supabase lekérdezésekkel
services/searchService.ts keresés előadásokban/helyszínekben/szereplők közt
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

Öt adapter él és alapból be van kapcsolva, együtt nagyjából 490 produkciót adnak
— ebből körülbelül 165 fut most vagy meg van hirdetve, 325 pedig olyan, amit
maguk a színházak sorolnak az archívumukba —, valamint 155 játszási időpontot.
Az archív sorok `plays.is_archived`-et kapnak, ami kiveszi őket a Felfedezés
bemutató- és felkapott-sávjaiból, de kereshetők és rögzíthetők maradnak, így
évekkel ezelőtt látott előadást is fel lehet vinni (lásd
`0005_archive_and_reconcile.sql`).

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

Ami még nincs megírva, azzal együtt, hogy élő ellenőrzéskor mi derült ki róla:

- **Vígszínház** — megvalósítható, de befejezetlen. A `/hu/eloadasok`
  szerveroldalon 56 produkciólinket ad ki (`/hu/produkciok/{slug}`) valódi
  grafikával, de a produkciónkénti metaadat a Next.js RSC flight payloadjában
  van, ahol a szereposztás numerikus tag-azonosítók listája, amihez még egy
  névjegyzék-lekérés kell — pontosan olyan alakú, mint az Örkény API-ja. A
  szerkezet fel van térképezve, az adapter nincs megírva.
- **Radnóti** és **Trafó** — sima HTTP-vel egyáltalán nem érhetők el. Mindkettő
  kliensoldalon rendereli a műsorát: a Radnóti `/repertoar/`,
  `/bemutatok-20262027/` és `/archivum/` oldala sima lekéréssel három bájtra
  azonos navigációs vázat ad vissza, a `trafo.hu/programok` pedig egyetlen
  linket 168KB HTML-ben. Ezekhez fejnélküli böngésző kellene a
  szinkronfeladatban, ami egy ütemezett GitHub Actionhöz jóval nehezebb
  függőség, mint a cheerio.

Szintén nincs még kész: követés/követők, és a maradék Jegy.hu-alapú színházak
(Nemzeti, Madách, Centrál, Pesti Magyar, Vojtina). A figyelőlistára
felvétel/levétel viszont kész — a `services/playsService.ts`-ben ott az
`addToWatchlist`/`removeFromWatchlist`, az Előadás részletei oldal kapcsolójára
kötve.
