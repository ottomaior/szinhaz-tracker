[English](BACKLOG.md) · **Magyarul**

> Ez a magyar változat. Az eredeti az angol `BACKLOG.md` — ha a kettő valaha
> ellentmond egymásnak, az angol az érvényes, és azt kell javítani.

# Teendők — út a bemutatóig

Hol tart a projekt, és mi van hátra. Hogy *miért* készült el az egyes darabok,
azt a [README.hu.md](README.hu.md) meséli el; ez a fájl a terv és az aktuális
állapot, hogy egy hosszabb szünet után is fel lehessen venni a fonalat anélkül,
hogy mindent újra ki kellene találni.

Utoljára frissítve: 2026. szeptember 6.

---

## A döntések, amiken ez a terv áll

Négy döntés, ami mindent meghatároz alább:

- **Előbb a web.** Az alkalmazásboltok dokumentált, elhalasztott sávot kapnak ([„A" rész](#a-rész--amit-az-alkalmazásboltok-megkövetelnek-elhalasztva)), nem ez a következő feladat. Az alkalmazás valódi React Native alkalmazás, így ez az út nyitva marad.
- **Budapest és Debrecen, rendesen.** Nem országos — az később jön. A már lefedett két város *teljes és pontos* lefedettséget kap, amitől az adatminőség önálló munkafolyam lesz, nem az adapterek hozzáadásának mellékhatása.
- **A push-értesítések benne vannak a bemutatóban.** A weben ez PWA-t és Web Pusht jelent, ami egyben a natív push alapozása is.
- **Az üzemeltető személye eldöntetlen** — magánszemély vagy cég. Ez csak az első boltos beadást gátolja. A mérlegelés az „A" részben.

---

## 1. fázis — Jogi dokumentumok és fiókéletciklus · **kész**

Öt commit a `phase-1-legal` ágon. A GDPR a webes termékre ma is vonatkozik,
függetlenül bármelyik bolttól, és pontosan ez az, amire a boltos sávnak is
szüksége lesz később.

| | Mi |
|---|---|
| 1.1 | Adatkezelési tájékoztató, felhasználási feltételek és impresszum valódi, előrenderelt route-ként az `app/legal/` alatt, a szöveg az `i18n/legal.ts`-ben, a Beállításokból linkelve |
| 1.2 | Fióktörlés az alkalmazásból — `supabase/functions/delete-account/`, a projekt első Edge Functionje |
| 1.2b | A `recompute_play_rating()` és a `list_items_touch_list()` javítva és visszatöltve — `supabase/migrations/0036_…sql` |
| 1.3 | Adatexport — `services/accountService.ts`, JSON-letöltés a naplóról, értékelésekről, listákról, kívánságlistáról és követésekről |
| 1.4 | Jelszó-visszaállítás — `app/forgot-password.tsx`, `app/reset-password.tsx`; a regisztráció már nem feltételezi, hogy munkamenet érkezett vissza |

**Amit érdemes tudni:** a `recompute_play_rating()` soha, egyetlen egyszer sem
frissített értékelést. Annak a nevében fut, aki a kritikát írta, a
`plays_update_own` az előadás felvevőjére korlátozza az UPDATE-et, és az az
UPDATE, amit az RLS nullára szűkít, nem hiba. Az értékelést hordozó 14
kritikából 13 olyan előadáson ült, amelyik továbbra is `0.0`-t mutatott. Az
előadásoldal pontszáma, a hisztogram és a `Népszerű` sáv mind ezt az oszlopot
olvassa. Javítva és visszatöltve — lásd a README *„Egy harmadik számláló, ami
sosem volt igaz"* szakaszát.

### Ami már él az éles Supabase projekten

Mindkettőre szükség volt ahhoz, hogy bármit ellenőrizni lehessen, és mindkettő
hozzáadó jellegű:

- `delete-account` Edge Function — telepítve, `verify_jwt: true`. Semmi nem hívja, amíg az ág nincs beolvasztva.
- `0036` migráció — alkalmazva. Mindkét triggert `security definer`-ré teszi, visszavonja az `EXECUTE` jogot, hogy egyikből se legyen RPC (beleértve a `handle_new_user` régóta nyitva álló ugyanilyen lyukát), és visszatölti a hibás sorokat.

### Amit ellenőriztünk

- A jogi route-ok munkamenet nélkül elérhetők, benne vannak a statikus exportban, és a szövegük a szerver által küldött markupban van.
- A fióktörlés végponttól végpontig, a valódi gombbal: 15/15 állítás, beleértve, hogy mi tűnik el, mi marad (a felhasználó által felvett előadás `created_by` nélkül életben marad, a plakátja megmarad), és hogy az értékelés mindkét irányban újraszámolódik.
- A jelszó-visszaállítás valódi, generált helyreállító linkkel: mindkét ellenőrzés, a jelszó megváltozott, a régi elutasítva, az új elfogadva egy friss bejelentkezésnél.
- Az éles build tiszta: mind az öt új route statikus HTML-ként exportálódik, a `Dockerfile` `_shell.html` őre lefut, egyetlen kiszolgált HTML-be sem kerül helyőrző, és az nginx meglévő `try_files $uri $uri.html` szabálya minden új útvonalat lefed, konfigurációmódosítás nélkül.

### Nyitott kérdések — egyik sem gátolja a további munkát

1. **Az üzemeltető négy adata** — teljes név, postacím, kapcsolati e-mail-cím, valamint nyilvántartási/adószám, ha vállalkozásként jelenik meg. Döntés alapján a bemutató közelére halasztva. Amíg nincsenek meg, az `operatorDetailsComplete()` hamis, és a jogi képernyők a dokumentum helyett *„még készül"* jelzést mutatnak, így senki nem lát `TODO_OPERATOR_NAME`-et adatkezelőként.
2. **A Railway origin a Supabase átirányítási engedélylistáján.** A `localhost` rajta van (ellenőrizve). Az éles origin nélkül a telepített oldalról indított jelszó-visszaállító linkek a Site URL-en landolnak.
3. **Visszakapcsoljuk-e az e-mail-megerősítést.** 2026. szeptember 6-án kapcsolták ki — minden addig létrehozott fiók hordoz `confirmation_sent_at` értéket, azóta egy sem. Amíg ki van kapcsolva, bárki regisztrálhat más e-mail-címével.

```bash
npm run check:launch
```

Kiírja a fentieket, és azokat is, amiket a repóból egyáltalán nem lehet
ellenőrizni. Ez indulás előtti ellenőrzőlista, nem CI-lépés — szándékosan,
mert minden rajta lévő elem a projekt életének nagy részében befejezetlen.

---

## 2. fázis — PWA-alapok és Web Push · következik

Ma nincs manifest, nincs service worker és nincs PWA-ikonkészlet; ez zöldmezős
munka. A Web Push az egyetlen működő csatorna egy csak webes bemutatóhoz, iOS-en
pedig **kizárólag** a kezdőképernyőre kitett oldalnál működik. (Az Apple 2024
februárjában bejelentette a kezdőképernyős webalkalmazások megszüntetését az
EU-ban a DMA miatt, majd márciusban visszavonta — Magyarországon működnek.)

- **2.1** `public/manifest.webmanifest`, `display: "standalone"`, 192/512/maskable ikonok az `assets/images/icon.png`-ből generálva (a `sharp` már devDependency). `<link rel="manifest">` és `apple-touch-icon` az `app/+html.tsx`-be.
- **2.2** Kézzel írt `public/sw.js` — app-shell gyorsítótár, `push` és `notificationclick`. Az `nginx.conf`-ba kell `Service-Worker-Allowed: /` és `Cache-Control: no-cache` a `/sw.js`-re, mert az `/assets/` egy évig `immutable`, egy beragadt service worker pedig visszafordíthatatlan.
- **2.3** `0037_push_subscriptions.sql` migráció — `push_subscriptions` tábla (`user_id`, egyedi `endpoint`, `p256dh`, `auth`, `user_agent`, időbélyegek) tulajdonosra szűkített RLS-sel, plusz `pushed_at` a `notifications`-ön.
- **2.4** VAPID kulcspár a Supabase secretsben; `send-push` Edge Function, ami a `pushed_at is null` sorokat olvassa, a magyar szöveget **az `i18n/hu.ts`-ből importálva, nem újra begépelve** rendereli (a `0030` épp azért tárol strukturált `payload` jsonb-t, hogy az alkalmazás hangja egy fájlban éljen), `web-push`-sal küld, `pushed_at`-et bélyegez, és kiszórja a 404/410-et adó feliratkozásokat. A `sync/run.ts` végén hívva, a `generate_notifications()` után.
- **2.5** Feliratkozó felület a Beállításokban: engedélykérés kifejezett gomb mögött (a Push API megköveteli), kapcsolók a hat meglévő `NotificationKind` értékre, és iOS Safarin egy „tedd ki a kezdőképernyőre" kártya, mert ott a `PushManager` egy sima lapon egyszerűen nincs. A `components/ui/FollowSubjectButton.tsx` ma kiírja, hogy még semmi nem megy ki; ez a szöveg ekkor kerül ki.

> **Ottó nélkül nem fejezhető be:** kell egy VAPID kulcspár — a privát fele a Supabase secretsbe, a publikus fele a Railway build változói közé. A `Dockerfile` build időben süti be az `EXPO_PUBLIC_*` értékeket, így a Railway változónak *a push előtt* léteznie kell, különben a telepítés csendben nélküle megy ki.

Szándékosan csatorna-formájú: a `notifications` sorok, a dedupe kulcsok és a
szövegek változatlanul újrahasznosulnak, amikor jön a natív push; csak a küldő
cserélődik.

---

## 3. fázis — Moderáció és biztonság

A kritikák és hozzászólások nyilvános, idegenek által írt tartalmak, és ma az
egyetlen moderációs szabály az, hogy a napló tulajdonosa törölhet egy
hozzászólást a saját bejegyzése alól. Nincs bejelentés, nincs letiltás, és nincs
mód a tartalom megnézésére vagy eltávolítására. Valódi biztonsági hiányosság a
weben, és később szinte biztos App Store-elutasítás (1.2-es irányelv).

- **3.1** Migráció: `reports` (bejelentő, cél típusa ∈ `review|comment|profile`, cél azonosítója, indok, státusz) és `user_blocks`, mindkettő RLS-sel; a letiltott felhasználók kiszűrve a hírfolyamból, a bejegyzések szálaiból és a személykeresésből.
- **3.2** Bejelentési lehetőség az `app/entry/[id].tsx`, a `components/ui/ReviewSocial.tsx` és az `app/user/[id].tsx` felületén.
- **3.3** Minimális moderációs felület. A kiemelt listákat ma is kézzel gondozzuk az SQL-szerkesztőben, így dokumentált lekérdezések plusz egy `is_hidden` oszlop a `reviews`/`review_comments` táblán arányos megoldás; admin alkalmazás nem indokolt, amíg nincsenek felhasználók.
- **3.4** Közzétett kapcsolati cím az impresszumban — a DSA amúgy is megköveteli.

---

## 4. fázis — Budapest és Debrecen, teljesen és pontosan · ez a hosszú vég

Nem országos. A szélesség számolható volt, a mélység nem, ezért ennek a
fázisnak saját „mikor van kész" definíció kell — innen a 4.5 és a 4.6.

- **4.1 Játszóhely-nyilvántartás.** A `venues` kézzel van feltöltve fix UUID-kkel a `0002`/`0020`-ban, a `sync/venueMap.ts` pedig kézzel karbantartott forrás→UUID leképezés, aminek nem szabad elcsúsznia. Kell egy `venues.source_key`, és egy deklaratív `sync/venues.ts`-ből upsertelt feltöltés, hogy egy új színház egy konfigurációs sor legyen, ne migráció plusz leképezés-szerkesztés. A termek itt számítanak: egy budapesti ház több színpad (Katona/Kamra, Víg/Pesti Színház/Házi Színpad, Örkény/Stúdió), a `primary_room` pedig ma szabad szöveg.
- **4.2 A hiányzó színházak, aszerint csoportosítva, hogyan lehet őket olvasni.** Az első feladat egy felmérés: minden budapesti és debreceni színházat számba venni, élesben ellenőrizni, és feljegyezni, melyik csoportba esik. Ez a lista a valódi backlog, és még nem létezik. Csoportok: szerveroldalon rendered saját oldal (a meglévő minta); The Events Calendar WordPress-bővítmény (a `sync/adapters/central.ts` általánosítása); **InterTicket-mikrooldalak** `<szinhaz>.jegy.hu` címen, amelyek egy HTML-szerkezeten osztoznak, így egy adapter plusz konfiguráció több házat lefed; kliensoldalon rendered (Radnóti, Trafó — ehhez kell a 4.3); és ami elutasítja a sima kérést (Pesti Magyar).
  - A `jegy.hu` `robots.txt`-je csak a `/ticket/` és `/invoice/` útvonalakat tiltja, `Crawl-delay: 20` mellett — bejárható, de lassú.
  - A `sui generis` adatbázis-jogi aggály, amit a README a `port.hu` kapcsán felvet, itt kevésbé áll, mivel az InterTicket saját közlése szerint csak a jegyértékesítési platformot üzemelteti a helyszín számára. Ezt el kell dönteni és rögzíteni.
- **4.3 Fejnélküli böngésző.** Opcionális, Playwrightra épülő letöltés a `sync/lib/http.ts`-ben, amit csak az azt igénylő adapterek használnak, hogy az olcsó `cheerio` út maradjon az alapértelmezés.
- **4.4 Szinkronizáló job.** Mátrix-jobra bontva (forráscsoportonként egy futtató), eltolt ütemezéssel; a `sync_runs` marad a napló.
- **4.5 A pontosság mint önálló munkafolyam.**
  - **A Vígszínháznak egyáltalán nincs szereposztás-adata** — ez az egyetlen forrás, ahol semmi nem érhető el, így a produkciói láthatatlanok egy színészkeresésben, és a szereposztás-sávjuk üres. Egy Budapestre teljes katalógusban ez a város egyik legnagyobb színháza, épp az a funkció hiányzik róla, amiért a személyoldalak léteznek. Kell egy második forrás.
  - Az `is_event` (`0034`) címre épülő heurisztika, ami hat sort talál el; a szókészletet újra kell ellenőrizni azon, amit az új források hoznak.
  - Figyelni kell a `genre_source` `venue_default` arányát — egy feltételezett értékek fölötti műfajszűrő aszerint particionálja a katalógust, melyik scraper írta az adott sort.
  - **Duplikátumok a források között.** A `source`/`source_key` forrásonként egyedi, ami nem akadályozza meg, hogy két forrás ugyanarra a produkcióra hivatkozzon — ez a platformadapterek és oldaladapterek egymás mellé tételének tipikus hibája. A `0007` már egyszer kézzel rendezte ezt.
  - A `person_slug()` a `0024` óta *ehhez* a katalógushoz igazítva hajtja össze a kitüntetéseket és az `m.v.`-t; az új színházak máshogy írják a titulusokat, és az egyetlen hiba, amit egy személyoldal nem él túl, az, ha valakit két oldalra vág szét.
- **4.6 Adatminőségi riport.** `npm run sync -- --report` (vagy egy SQL-nézet), ami kiírja a produkciók és időpontok számát színházanként, a szereposztás-lefedettséget színházanként, a `genre_source` megoszlását, a plakát nélküli sorokat, az elavult sorokat és a gyanús kereszt-forrás duplikátumokat. Ez teszi a „jól lefedett és pontos"-at ellenőrizhetővé.
- **4.7** Fixture-tesztek minden új adapterhez, a `sync/__fixtures__/` mintájára.
- **4.8** A `SHOW_VENUE_TYPE_FILTER` bekapcsolása (`app/(tabs)/discover.tsx`) — végponttól végpontig be van kötve, csak azért rejtett, mert ma minden játszóhely `kőszínház`. Budapesttel jön a `független` és a `szabadtéri`, Debrecennel a Nagyerdei szabadtéri.
- **4.9 Kapacitás.** A Supabase ingyenes csomagja 500MB adatbázis / 1GB tárhely / 5GB kimenő forgalom, a `sync/lib/posters.ts` pedig produkciónként egy teljes webp és egy bélyegkép tárol. A 4.6 során mérni kell; ha megerősíti, be kell tervezni a Pro csomagot (kb. 25 USD/hó).

**A 1. fázisból ide vihető tanulság:** a böngészősávok a `plays.rating_overall`
szerint rendeznek, ami eddig gyakorlatilag üres volt. Minden korábbi ítélet
arról, hogy a népszerűségi sáv „tizedesponttal ellátott zaj", olyan számok
alapján született, amik nemcsak kevesek, hanem hibásak is voltak.

---

## 5. fázis — Indulási készenlét

- **5.0 A React máig nem tud hidratálni egyetlen route-on sem.** Az 1. fázis telepítésének
  ellenőrzésekor derült ki: az éles oldal `Minified React error #425` (a szöveges tartalom nem
  egyezett), majd #418 és #422 hibát dob **minden** oldalon — beleértve a `/discover`-t is, amihez
  az 1. fázis hozzá sem nyúlt, tehát ez régi, nem új probléma. Az `nginx.conf` hosszan magyarázza,
  hogy a `try_files $uri.html` javítás pontosan ezeket a hibákat szüntette meg; láthatóan csak az
  *útválasztási* felét gyógyította meg, és a renderben marad valami, ami eltér a szerver és a
  kliens között. A költsége az, hogy a statikus renderelést megfizetjük, majd az első festéskor
  eldobjuk — épp az, amiről az a komment azt mondja, hogy nem szabad megtörténnie. Érdemes egy nem
  minifikált buildtel megvizsgálni, mielőtt az 5.4 hozzányúl a route-onkénti `<Head>`-hez, mert az
  ugyanezt a területet érinti. Valószínű gyanúsítottak: valami, ami render közben olvassa a
  nézetablakot (`useSafeAreaInsets`, `hooks/useBreakpoint.ts`), vagy egy betűtípustól függő mérés.
- **5.1 Hibafigyelés.** Semmi nincs — se Sentry, se PostHog, csak `console.log` a szinkronizáló szkriptben. Ezt *az első valódi felhasználók előtt* kell megcsinálni.
- **5.2 Termékhiányok.** Játszóhely-/színházoldal (a követett színházak ma szűrt Felfedezésre visznek, mert nincs saját oldaluk). A szerzők neve nem kattintható, pedig a színészeké és a rendezőké igen.
- **5.3 A Supabase CLI bevezetése.** 36 migráció ment fel kézzel, és a README azt mondja egy új fejlesztőnek, hogy futtassa le mindet sorban. `supabase link` + `supabase db push`, plusz generált `database.types.ts`.
- **5.4 SEO és megosztás.** Route-onkénti `<title>`/`<meta description>` és Open Graph. Az 1. fázis kiderítette, hogy az `expo-router/head` *eljut* a statikus exportba, így ez képernyőnkénti `<Head>` hozzáadása, nem új infrastruktúra. Közben **ki kell venni a `<title>`-t az `app/+html.tsx`-ből**: ma minden exportált oldal két `<title>` elemet szállít — előbb a react-helmetét, aztán a shell beégetettjét. Ártalmatlan volt, amíg ugyanazt mondták; most, hogy eltérhetnek, bármi, ami az utolsó találatot veszi, rossz címet olvas.

---

## „A" rész — Amit az alkalmazásboltok megkövetelnek (elhalasztva)

Ebből semmi nincs kész. Azért van rögzítve, mert megkötéseket ad a fenti
fázisokhoz.

**A jó hír:** ez valódi React Native alkalmazás, nem webview-burok, így az Apple
4.2-es, „minimális funkcionalitás" irányelve — a webes eredetű alkalmazások
leggyakoribb elutasítási oka — nem ugyanúgy vonatkozik rá. Az út járható; csak
még soha nem próbáltuk ki.

| Akadály | Megjegyzés |
|---|---|
| Nincs `eas.json`, nincs EAS projekt | Soha nem készült eszközre build. Az ikonok megvannak, de bolti méretekben soha nem lettek ellenőrizve. |
| **Expo SDK 52** (2024. nov.) | Android `targetSdk` 35-tel jár. A Google Play 2026. augusztus 31. óta **API 36**-ot követel. Minimum SDK 55 kell; az 57 az aktuális. Többnapos frissítés öt SDK-kiadáson át (RN 0.82-től az Új Architektúra kötelező). |
| Nincs `PrivacyInfo.xcprivacy` | Kötelező indoklású API-deklarációk, az `expo.ios.privacyManifests`-en át. |
| Nincs UGC-moderáció | 3. fázis. Ennél az alkalmazásnál ez a legvalószínűbb elutasítási ok. |
| A megosztókártya csak webes | Canvas-alapú; natívhoz `react-native-view-shot` kell. |
| Nincsenek mélylinkek | Az `app.json`-ban csak `scheme` van — nincs `associatedDomains` / `intentFilters`. |

A fióktörlés és a jogi oldalak **készen vannak** (1. fázis), és mindkét bolt
követelményét kielégítik, beleértve a Google webről elérhető törlési URL-jét is.

**Fiókok, pénz, naptári idő.** Apple Developer Program 99 USD/év, a
regisztráció ellenőrzése napokig tart. Google Play Console 25 USD egyszer — de
a 2023. november 13. után létrehozott **magánfiókoknak** zárt tesztet kell
futtatniuk **legalább 12 tesztelővel, 14 egymást követő napon át**, mielőtt éles
hozzáférést kérhetnek; ez kb. 3 hét naptári idő. Mindkettőhöz kell EU DSA
kereskedői nyilatkozat, adatbiztonsági űrlap / adatvédelmi címkék, korhatár-
besorolás, eszközosztályonkénti képernyőképek és magyar bolti szöveg.

**Az üzemeltető személye — az eldöntetlen kérdés.**

| | Magánszemély | Magyar cég |
|---|---|---|
| EU DSA következmény | Az Apple mind a 27 EU-s területen közzéteszi a teljes nevedet, fizikai címedet, telefonszámodat és e-mail-címedet az App Store oldalon. Magánszemélynél ez a lakcím. | A bejegyzett székhely jelenik meg helyette. |
| Beállítás | Napok | Hetek (bejegyzés, D-U-N-S kb. 5–10 munkanap) |
| Felelősség | Személyes | Korlátolt (Kft.) |
| Folyamatos költség | Nincs | Könyvelés, adóbevallások |

A katalógus harmadik felek oldalairól származik, az alkalmazás pedig nyilvános
felhasználói tartalmat tárol, így a felelősségbeli különbség nem elméleti. A
**székhelyszolgáltatás** a szokásos magyar válasz arra, ha valaki nem akarja a
lakcímét közzétenni, és mindkét formával működik.

---

## Hogyan jut ki a munka az élesbe

A `main` közvetlenül a Railwayre van kötve, tehát **a `main`-be olvasztás éles
kiadás**. A munka fázisonként külön ágon zajlik, felpusholva a GitHubra, hogy a
CI lefusson rajta, és csak akkor olvad be, ha Ottó jóváhagyja. Semmi nem olvad
be, amíg nincs ellenőrizve, hogy működik.

Két dolgot érdemes előre tervezni:

- **A Supabase-hitelesítők build időben égnek bele.** A `Dockerfile` build `ARG`-ként veszi át az `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` értékeket, így minden olyan fázis, amihez új környezeti beállítás kell (a 2. fázis VAPID publikus kulcsa), megköveteli, hogy a Railway build változói *a push előtt* frissüljenek, különben a telepítés csendben nélküle megy ki.
- **A migrációk kézzel mennek fel.** A migrációt alkalmazni és ellenőrizni kell, mielőtt a rá épülő alkalmazáskód felmegy, hogy a telepített build soha ne kérdezzen le még nem létező táblát. Az 5.3 részben azért van a Supabase CLI, hogy ez a sorrendezés kevésbé legyen kézi.
