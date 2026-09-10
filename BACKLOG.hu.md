[English](BACKLOG.md) · **Magyarul**

> Ez a magyar változat. Az eredeti az angol `BACKLOG.md` — ha a kettő valaha
> ellentmond egymásnak, az angol az érvényes, és azt kell javítani.

# Teendők — út a bemutatóig

Hol tart a projekt, és mi van hátra. Hogy *miért* készült el az egyes darabok,
azt a [README.hu.md](README.hu.md) meséli el; ez a fájl a terv és az aktuális
állapot, hogy egy hosszabb szünet után is fel lehessen venni a fonalat anélkül,
hogy mindent újra ki kellene találni.

Az elszórt hibák, apró szépséghibák és ötletek nem itt laknak, hanem az
[ISSUES.md](ISSUES.md) fájlban, ami nem terv, hanem gyűjtőhely. Ami ötletből
vállalt munka lesz, az onnan lép elő az alábbi fázisok valamelyikébe.

Utoljára frissítve: 2026. szeptember 10.

---

## A döntések, amiken ez a terv áll

Négy döntés, ami mindent meghatároz alább:

- **Előbb a web.** A webes termék az, ami elindul; az alkalmazásboltok egy mögötte futó második sáv ([„A" rész](#a-rész--a-boltos-sáv)). Ez a sáv már nem csak dokumentált — az SDK-frissítés, a natív konfiguráció és a moderáció is elkészült, és van telepíthető Android-build. Semmi mérnöki jellegű nincs hátra rajta: ami maradt, az egy fizetős fejlesztői fiók, az üzemeltető személyéről szóló döntés, és naptári idő.
- **Budapest és Debrecen, rendesen.** Nem országos — az később jön. A már lefedett két város *teljes és pontos* lefedettséget kap, amitől az adatminőség önálló munkafolyam lesz, nem az adapterek hozzáadásának mellékhatása.
- **A push-értesítések benne vannak a bemutatóban.** A weben ez PWA-t és Web Pusht jelent, ami egyben a natív push alapozása is.
- **Az üzemeltető személye eldöntetlen** — magánszemély vagy cég. Ez csak az első boltos beadást gátolja. A mérlegelés az „A" részben.

> **Hol vegyük fel a fonalat.** Az „A" rész A.1-e és a 3. fázis is soron kívül
> készült el, így az alábbi fázisok már nem egymás utániak. **A boltos sávon nem
> maradt mérnöki akadály** — ami hátravan belőle, az egy fizetős fejlesztői
> fiók, az üzemeltető személyéről szóló döntés és a Google háromhetes zárt
> tesztje, és ezek egyike sem kód. Így a következő *megépítendő* dolog a 2.
> fázis (PWA és Web Push) a webes termékhez, a következő *elindítandó* pedig a
> Play tesztóra, mert ez az egyetlen tétel, aminek az ára naptári idő.

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

## 2. fázis — PWA-alapok és Web Push · a weben ez következik

Ma nincs manifest, nincs service worker és nincs PWA-ikonkészlet; ez zöldmezős
munka. A Web Push az egyetlen működő csatorna egy csak webes bemutatóhoz, iOS-en
pedig **kizárólag** a kezdőképernyőre kitett oldalnál működik. (Az Apple 2024
februárjában bejelentette a kezdőképernyős webalkalmazások megszüntetését az
EU-ban a DMA miatt, majd márciusban visszavonta — Magyarországon működnek.)

- **2.1** `public/manifest.webmanifest`, `display: "standalone"`, 192/512/maskable ikonok az `assets/images/icon.png`-ből generálva (a `sharp` már devDependency). `<link rel="manifest">` és `apple-touch-icon` az `app/+html.tsx`-be.
- **2.2** Kézzel írt `public/sw.js` — app-shell gyorsítótár, `push` és `notificationclick`. Az `nginx.conf`-ba kell `Service-Worker-Allowed: /` és `Cache-Control: no-cache` a `/sw.js`-re, mert az `/assets/` egy évig `immutable`, egy beragadt service worker pedig visszafordíthatatlan.
- **2.3** `0038_push_subscriptions.sql` migráció — `push_subscriptions` tábla (`user_id`, egyedi `endpoint`, `p256dh`, `auth`, `user_agent`, időbélyegek) tulajdonosra szűkített RLS-sel, plusz `pushed_at` a `notifications`-ön.
- **2.4** VAPID kulcspár a Supabase secretsben; `send-push` Edge Function, ami a `pushed_at is null` sorokat olvassa, a magyar szöveget **az `i18n/hu.ts`-ből importálva, nem újra begépelve** rendereli (a `0030` épp azért tárol strukturált `payload` jsonb-t, hogy az alkalmazás hangja egy fájlban éljen), `web-push`-sal küld, `pushed_at`-et bélyegez, és kiszórja a 404/410-et adó feliratkozásokat. A `sync/run.ts` végén hívva, a `generate_notifications()` után.
- **2.5** Feliratkozó felület a Beállításokban: engedélykérés kifejezett gomb mögött (a Push API megköveteli), kapcsolók a hat meglévő `NotificationKind` értékre, és iOS Safarin egy „tedd ki a kezdőképernyőre" kártya, mert ott a `PushManager` egy sima lapon egyszerűen nincs. A `components/ui/FollowSubjectButton.tsx` ma kiírja, hogy még semmi nem megy ki; ez a szöveg ekkor kerül ki.

> **Ottó nélkül nem fejezhető be:** kell egy VAPID kulcspár — a privát fele a Supabase secretsbe, a publikus fele a Railway build változói közé. A `Dockerfile` build időben süti be az `EXPO_PUBLIC_*` értékeket, így a Railway változónak *a push előtt* léteznie kell, különben a telepítés csendben nélküle megy ki.

Szándékosan csatorna-formájú: a `notifications` sorok, a dedupe kulcsok és a
szövegek változatlanul újrahasznosulnak, amikor jön a natív push; csak a küldő
cserélődik.

---

## 3. fázis — Moderáció és biztonság · **kész**

Két commit a `part-a-native` ágon. A kritikák és hozzászólások nyilvános,
idegenek által írt tartalmak, és eddig az egyetlen moderációs szabály az volt,
hogy a napló tulajdonosa törölhet egy hozzászólást a saját bejegyzése alól.
Valódi biztonsági hiányosság az élő webes terméken, és az App Store 1.2-es
irányelve a felülvizsgálatnál.

| | Mi |
|---|---|
| 3.1 | `supabase/migrations/0037_reports_and_blocks.sql` — `reports` és `user_blocks`, mindkettő RLS-sel, plusz `is_hidden` a `reviews`/`review_comments` táblán. A letiltott fiókok **házirenddel** vannak kiszűrve a hírfolyamból, a bejegyzések szálaiból és a személykeresésből, nem egy szolgáltatásfájlban lévő feltétellel |
| 3.2 | Bejelentési lehetőség az `app/entry/[id].tsx`, a `components/ui/ReviewSocial.tsx` és az `app/user/[id].tsx` felületén, egyetlen `components/ui/ReportSheet.tsx`-en át, ami ugyanarra a lapra épül, mint az `AddToListSheet` |
| 3.3 | `supabase/moderation.sql` — hat dokumentált lekérdezés. Admin alkalmazás nincs, pontosan azért, amiért a terv is mondta: egy üzemeltető van, a kiemelt listákat pedig amúgy is kézzel gondozzuk az SQL-szerkesztőben |
| 3.4 | Még hátravan — kell hozzá az üzemeltető kapcsolati címe, ami ugyanaz az akadály, mint a jogi dokumentumoknál. Lásd az 1. fázis hátralévő listáját |
| 3.5 | *(új)* `app/blocked.tsx`, a Beállításokból elérhetően. Nem volt az eredeti tervben, és nem elhagyható: a letiltásnak különben nincs visszavonása, mert épp maga a letiltás az, amitől a másik felhasználót nehéz újra megtalálni |

**A két dolog, amit érdemes tudni.**

*Az a letiltás, ami csak elrejt, fél funkció.* Attól, hogy valakinek az írását
elrejtjük, még írhat. A select-házirendtől a bejegyzésed láthatatlan lesz neki
az alkalmazásban, de a `user_id = auth.uid()` semmit nem kérdez arról, hogy
kinek az estéjéhez szól a hozzászólás — a PostgREST tehát továbbra is elfogad
egy insertet, ami megnevezi az azonosítóját, és a letiltott fiók vidáman
hozzászól a kritikáid alatt, miközben te elveszíted a képességet, hogy ezt lásd.
A hozzászólások, a tetszések és a követések insert-házirendje mind ellenőriz
már, egy trigger pedig eldobja a meglévő követést mindkét irányban, mert a
`generate_notifications()` a `follows`-ból olvas.

*Egy RLS-házirend kifejezése a lekérdezést futtató szerep jogaival fut, nem a
tábla tulajdonosáéval.* Az első változat elvette az `execute` jogot a
`blocked_between`-re a `public`-tól, az `anon`-tól és az `authenticated`-től,
hogy ne váljon olyan RPC-vé, ami megválaszolja, hogy „letiltott-e engem ez a
személy". Ez nem egy végpontot szüntetett meg — hanem minden házirendet eltört,
ami hívta, és a `select * from reviews` jogosultsági hibává vált **minden**
olvasó számára, bejelentkezve és anélkül is. A függvény most egy `private`
sémában él: a PostgREST csak a beállított sémáit teszi közzé, tehát a házirend
eléri, a HTTP nem. Egy viselkedési teszt fogta meg; a „el van-e véve a jog, ki
van-e tűzve a `search_path`" szerkezeti ellenőrzés átment volna vele.

*És egy helyesbítés, amit érdemes megtartani, mert ugyanaz a hiba egy szinttel
feljebb.* A fentiek első leírása azt állította, hogy a névtelen látogatókat nem
érintette a kiesés — hogy az csak a bejelentkezett olvasókat sújtotta. Ez az
egyetlen ténylegesen megfigyelt hibából volt következtetve, nem tesztelve, és
nem igaz: a pontos szerkezetet egy eldobható táblán reprodukálva az `anon`
ugyanúgy elhasal. Egy ellenőrizetlen részlet, amit azért találunk ki, hogy a
történet kerekebb legyen, pontosan az, amit a szerkezeti ellenőrzés rosszul
csinált — így nem maradhat benne annak a leírásában, hogy az az ellenőrzés
tévedett.

### Ellenőrizve

Tizenegy állítás az éles adatbázison, visszagörgetett tranzakcióban — a letiltás
mindkét iránya, a követést eldobó trigger, az írási házirendek, a szerző, aki
továbbra is látja a saját elrejtett kritikáját, és a névtelen olvasók, akiket
mások letiltása nem érint —, plusz további öt, miután a `search_profiles`
visszakerült `security invoker`-re. A `get_advisors` semmi újat nem jelez.
Helyben: típusellenőrzés, 299 teszt, tiszta lint, és a statikus export
hibaüzenet nélkül renderel telefonszélességen, munkamenet nélkül.

Az `npm run check:launch -- --stores` mostantól név szerint ellenőrzi a három
bejelenthető felületet, nem azt, hogy a funkció „létezik" — mert a tényleges
hibamód az, hogy egy később hozzáadott képernyő csendben bejelentési lehetőség
nélkül kerül ki.
## 4. fázis — Budapest és Debrecen, teljesen és pontosan · ez a hosszú vég

Nem országos. A szélesség számolható volt, a mélység nem, ezért ennek a
fázisnak saját „mikor van kész" definíció kell — innen a 4.5 és a 4.6.

- **4.1 Játszóhely-nyilvántartás.** A `venues` kézzel van feltöltve fix UUID-kkel a `0002`/`0020`-ban, a `sync/venueMap.ts` pedig kézzel karbantartott forrás→UUID leképezés, aminek nem szabad elcsúsznia. Kell egy `venues.source_key`, és egy deklaratív `sync/venues.ts`-ből upsertelt feltöltés, hogy egy új színház egy konfigurációs sor legyen, ne migráció plusz leképezés-szerkesztés. A termek itt számítanak: egy budapesti ház több színpad (Katona/Kamra, Víg/Pesti Színház/Házi Színpad, Örkény/Stúdió), a `primary_room` pedig ma szabad szöveg.
- **4.2 A hiányzó színházak, aszerint csoportosítva, hogyan lehet őket olvasni.** Az első feladat egy felmérés: minden budapesti és debreceni színházat számba venni, élesben ellenőrizni, és feljegyezni, melyik csoportba esik. Ez a lista a valódi backlog, és még nem létezik. Csoportok: szerveroldalon rendered saját oldal (a meglévő minta); The Events Calendar WordPress-bővítmény (a `sync/adapters/central.ts` általánosítása); **InterTicket-mikrooldalak** `<szinhaz>.jegy.hu` címen, amelyek egy HTML-szerkezeten osztoznak, így egy adapter plusz konfiguráció több házat lefed; és ami elutasítja a sima kérést (Pesti Magyar).
  - *Két csoport magától kiürült 2026. szeptember 10-én.* A Radnóti és a Trafó kliensoldaliként volt bejegyezve, 4.3-at igényelve; ma mindkettő szerveroldalon renderel. A Radnóti már a katalógusban van (`sync/adapters/radnoti.ts`, kilencedik színház, 23 produkció), a Trafó pedig szerkesztői döntés kérdése, nem technikaié — lásd a T-036-ot az ISSUES.md-ben. **A tanulság a felmérés többi részére: minden oldalt ellenőrizz újra, mielőtt elhiszel róla egy feljegyzést — beleértve az ebben a fájlban lévőket is.**
  - A `jegy.hu` `robots.txt`-je csak a `/ticket/` és `/invoice/` útvonalakat tiltja, `Crawl-delay: 20` mellett — bejárható, de lassú.
  - A `sui generis` adatbázis-jogi aggály, amit a README a `port.hu` kapcsán felvet, itt kevésbé áll, mivel az InterTicket saját közlése szerint csak a jegyértékesítési platformot üzemelteti a helyszín számára. Ezt el kell dönteni és rögzíteni.
- **4.3 Fejnélküli böngésző.** Opcionális, Playwrightra épülő letöltés a `sync/lib/http.ts`-ben, amit csak az azt igénylő adapterek használnak, hogy az olcsó `cheerio` út maradjon az alapértelmezés.
- **4.4 Szinkronizáló job.** Mátrix-jobra bontva (forráscsoportonként egy futtató), eltolt ütemezéssel; a `sync_runs` marad a napló. *Szeptember 8-án kész:* a cron `0 4`-ről `47 3 * * *`-ra került, mert a GitHub az egész órára ütemezett jobot 08:20 UTC körül indította, és egy ilyen késői futás az aznap reggeli merge előtti értelmezővel építette újra a katalógust. Az első futás az új percen az ellenőrzés.
- **4.5 A pontosság mint önálló munkafolyam.**
  - ~~A váltott szereplők elvesztek.~~ **Kész.** A `sync/lib/performers.ts` a közreműködést az általa megnevezett emberekre bontja, a `run.ts` minden forrásra alkalmazza, a `sync/adapters/csokonai.ts` pedig egy sor minden előadóelemét olvassa, nem csak az elsőt — lásd a README *Egy szerep, több ember* részét. A több emberhez rendelt szerephelyek száma a két Csokonai-forrásnál 203-ról 292-re nőtt; a teljes katalógusban több mint 650 van.
  - ~~A Vígszínháznak egyáltalán nincs szereposztás-adata.~~ **Kész, 2026. szeptember 10.** Nem kellett hozzá második forrás: a színház produkciós oldalai mostanra szerveroldalon renderelnek, ahol korábban navigációs vázat adtak vissza, és a `sync/adapters/vigszinhaz.ts` az oldalról olvassa a szereposztást, miközben a katalógus továbbra is az API-ból jön. 2056 szereposztási sor egy háznál, ahol egy sem volt, és a 33 jelenlegi produkcióból 31 visz szereposztást. Amitől ez biztonságos, az a `SyncedPlay.cast` megkülönböztetése: az `undefined` azt jelenti, hogy „ez a futás nem nézte meg", és a tárolt sorok maradnak, míg a `[]` azt, hogy a forrás senkit nem tüntet fel. Lásd a T-007-et az ISSUES.md-ben.
  - Az `is_event` (`0034`) címre épülő heurisztika, ami hat sort talál el; a szókészletet újra kell ellenőrizni azon, amit az új források hoznak.
  - Figyelni kell a `genre_source` `venue_default` arányát — egy feltételezett értékek fölötti műfajszűrő aszerint particionálja a katalógust, melyik scraper írta az adott sort.
  - **Duplikátumok a források között.** A `source`/`source_key` forrásonként egyedi, ami nem akadályozza meg, hogy két forrás ugyanarra a produkcióra hivatkozzon — ez a platformadapterek és oldaladapterek egymás mellé tételének tipikus hibája. A `0007` már egyszer kézzel rendezte ezt.
  - A `person_slug()` a `0024` óta *ehhez* a katalógushoz igazítva hajtja össze a kitüntetéseket és az `m.v.`-t; az új színházak máshogy írják a titulusokat, és az egyetlen hiba, amit egy személyoldal nem él túl, az, ha valakit két oldalra vág szét.
- **4.6 Adatminőségi riport.** `npm run sync -- --report` (vagy egy SQL-nézet), ami kiírja a produkciók és időpontok számát színházanként, a szereposztás-lefedettséget színházanként, a `genre_source` megoszlását, a plakát nélküli sorokat, az elavult sorokat és a gyanús kereszt-forrás duplikátumokat. Ez teszi a „jól lefedett és pontos"-at ellenőrizhetővé.
- **4.7** Fixture-tesztek minden új adapterhez, a `sync/__fixtures__/` mintájára.
- **4.8** A `SHOW_VENUE_TYPE_FILTER` bekapcsolása (`app/(tabs)/discover.tsx`) — végponttól végpontig be van kötve, csak azért rejtett, mert ma minden játszóhely `kőszínház`. Budapesttel jön a `független` és a `szabadtéri`, Debrecennel a Nagyerdei szabadtéri.
- **4.9 Kapacitás.** A Supabase ingyenes csomagja 500MB adatbázis / 1GB tárhely / 5GB kimenő forgalom, a `sync/lib/posters.ts` pedig produkciónként egy teljes webp és egy bélyegkép tárol. A 4.6 során mérni kell; ha megerősíti, be kell tervezni a Pro csomagot (kb. 25 USD/hó).

**A 1. fázisból ide vihető tanulság:** a böngészősávok a `plays.rating_overall`
szerint rendeztek, ami eddig gyakorlatilag üres volt. Minden korábbi ítélet
arról, hogy a népszerűségi sáv „tizedesponttal ellátott zaj", olyan számok
alapján született, amik nemcsak kevesek, hanem hibásak is voltak.

**Eldőlt, 2026. szeptember — a nyilvános átlag lekerült az appról.** A számok
mostanra helyesek, de továbbra is kevesen vannak: egy két vélemény széles átlag
bizonyíték nélküli ítélet. Lekerült az előadásoldal pontszáma, a három
szempontsáv, az „Értékelések megoszlása" diagram, a Felfedezés rácscsempéin lévő
átlag és maga az értékelés szerinti rendezés is. Maradt az olvasó saját
értékelése az előadásoldalon és az „A követettek szerint" — egy ember véleménye
bármekkora mintán információ, egy maroknyi emberből számolt szám nem.

Migráció nem történt: a `recompute_play_rating()`, a `rating_overall`, a
`rating_count` és a `play_rating_histogram()` mind élnek és helyesek. **Ezt nem
egy commit fordítja vissza, hanem az értékelők száma** — visszakapcsolni felületi
munka lesz olyan oszlopokon, amik végig jók voltak. Kapcsolódik, és bármelyikük
visszatérése előtt érdemes megcsinálni: a naplózó űrlap továbbra is kitölti a
három szempontot akkor is, ha az ember hozzá sem nyúlt — ezért mutat a személyes
blokk csak összesített pontszámot.

---

## 5. fázis — Indulási készenlét

- **5.0 Hidratálás.** ~~A React egyetlen route-on sem tud hidratálni.~~ **Kész**, és a feljegyzés,
  amit ez felvált, háromból két ponton tévedett. Soha nem *minden* route volt — egyetlen egy volt,
  a `/settings` —, és nem a nézetablak vagy egy betűtípustól függő mérés okozta, hanem a
  `useColorScheme()`, amit render közben olvasunk, és ami nem egyezik önmagával a hidratálási
  határon át. A statikus exportban nincs `matchMedia`, tehát „light"-ot renderel; egy sötét módban
  lévő telefon viszont „dark"-ot renderel az első kliensoldali futáskor. A Beállítások ezt az
  értéket kétszer is kiteszi a képernyőre — a „Rendszer szerint" sor színmintájaként és néven
  nevezve a *„jelenleg: Bársony"* szövegben —, így a két futás eltérő markupot állított elő, és a
  React #418-cal eldobta az egész előre renderelt dokumentumot. A `contexts/ThemeContext.tsx` most
  a sötét alapértelmezést jelenti, amíg a tárolt beállítást ki nem olvasta — ugyanaz az őr, amit a
  szomszédos `selected={hydrated && …}` már alkalmazott a pipára. Ellenőrizve tizenkét route-on az
  éles statikus exporton, kijelentkezve, telefonszélességen, sötét módban lévő rendszerrel: a
  konzol mindegyiken üres. Az a gyanú, hogy ez számítani fog az **5.4**-nek, jó okból volt jó — a
  route-onkénti `<Head>` most már egy olyan dokumentumra kerül, ami túléli az első festést.
- **5.1 Hibafigyelés.** Semmi nincs — se Sentry, se PostHog, csak `console.log` a szinkronizáló szkriptben. Ezt *az első valódi felhasználók előtt* kell megcsinálni.
- **5.2 Termékhiányok.** Játszóhely-/színházoldal (a követett színházak ma szűrt Felfedezésre visznek, mert nincs saját oldaluk). A szerzők neve nem kattintható, pedig a színészeké és a rendezőké igen.
- **5.3 A Supabase CLI bevezetése.** 36 migráció ment fel kézzel, és a README azt mondja egy új fejlesztőnek, hogy futtassa le mindet sorban. `supabase link` + `supabase db push`, plusz generált `database.types.ts`.
- **5.4 SEO és megosztás.** Route-onkénti `<title>`/`<meta description>` és Open Graph. Az 1. fázis kiderítette, hogy az `expo-router/head` *eljut* a statikus exportba, így ez képernyőnkénti `<Head>` hozzáadása, nem új infrastruktúra. Közben **ki kell venni a `<title>`-t az `app/+html.tsx`-ből**: ma minden exportált oldal két `<title>` elemet szállít — előbb a react-helmetét, aztán a shell beégetettjét. Ártalmatlan volt, amíg ugyanazt mondták; most, hogy eltérhetnek, bármi, ami az utolsó találatot veszi, rossz címet olvas.
- **5.5 A 23 effekt, ami szinkron módon állít state-et.** A `react-hooks` 6 — az
  `eslint-config-expo` 57 újdonsága — tíz képernyőn jelzi őket, és az `.eslintrc.js`-ben a szabály
  `warn`, nem `error`, hogy a frissítésnek, ami felszínre hozta őket, ne kelljen egyben meg is
  javítania mindet. Mindegyik egy `setState` egy egyébként aszinkron effekt szinkron, korai
  kilépési ágán: egy sáv `[]`-re állítása, amikor megszűnik a munkamenet, vagy egy útvonalparaméter
  state-be másolása, miután betöltött a lista, amit indexel. Ezek valódi „származtatott érték
  state-ben" szagok, és a javítás az, hogy az értéket képernyőnként újra származtatottként fogalmazzuk
  meg, nem tároltként. Nem sürgős — egyik sem ismert hiba —, de a figyelmeztetések száma a mérőszám,
  és annak csak csökkennie szabad.
- **5.6 Felhasználói kutatás az indulás előtt · az eszköztár kész, a terepmunka
  nyitva.** A terméket még soha nem látta senki, aki nem építette. A `research/`
  mappa a módszer és az eszközök: nyolc-tíz feltáró interjú arról, hogyan járnak
  az emberek *ma* színházba, öt hangosan gondolkodós ülés az élő appon, és egy
  kérdőív a `vastaps.pages.dev/kutatas` címen, amely választásra kényszerít —
  nem 1–5-ös osztályzatot kér, amire mindenki négyest-ötöst ad: a tizenkét
  funkcióból a három legértékesebb, a maradékból a három, ami kimaradhat, és hat
  bizonytalanról az, hogy zavarna-e a hiánya az induláskor. (Az első változat
  tankönyvi, kilencképernyős MaxDiff volt; telefonon ugyanannak a kérdésnek
  hatott kilencszer, a 0040 cserélte le.) A válaszok egyetlen ellenőrző
  függvényen át kerülnek a `research_responses` táblába; az `npm run
  research:report` írja az elemzést. Az első kör barátok és ismerősök,
  ami elég az interjúkhoz és az ülésekhez, és kevés egy stabil rangsorhoz — a
  kérdőív nyitva marad egy későbbi Facebook-csoportos körre. Ami hátravan: maga
  a terepmunka, és az egyoldalas összegzés, amely eldönti az indulási
  funkciókészletet.

---

## A második felvonás — a tervezési kör · **kész**

2026. szeptember 8-án összeolvasztva és kitelepítve, a `cast-alternates` tetején.
A README *A második felvonás* része számol be arról, mi és miért változott; ez
itt az, amit maga után hagy.

| | Mi |
|---|---|
| S.1 | A Bársony újravágva (szilvafekete háttér, bordó felületek, pezsgőarany); a Színlap bordó kiemelést kapott és a világos alapértelmezés lett; a Levendula opcióvá fokozva. Minden szövegtoken mind az öt témában, mindhárom háttéren megfelel az AA-nak |
| S.2 | Két tipográfiai szerep (`numeral`, `eyebrow`), `SectionHeader`, a `Button` `text` változata, a `StatusBadge` `inline` formája és a `StatusInline`, a szakaszként szedett `EmptyState`, a `SignedOutState` |
| S.3 | Felfedezés: rögzített cím, várossor és keresőikon; Felfedezés / Műsor / Listák szöveges fülekként; a következő este mint vezérkép; `ProgramRow` a hétre és a naptárra; csempék, amik semmit sem hordanak a képen; kéthasábos vezérkép 900pt-tól |
| S.4 | Előadás oldala: cím a plakáton, egy arany cselekvés, értékelések hajszálvonalakon, időpontok táblázatban a jegypénztár linkjével, színházkövetés pirulaként, szereposztás listaként, szinopszis hajtás mögött |
| S.5 | Hírfolyam, profil, kívánságlista, alkotó-, lista- és felhasználóoldalak ugyanazokkal a fejlécekkel; a fiók nélküli látogató indításonként egyszer a Felfedezésen landol |
| S.6 | `TopBar` az `expanded` töréspontól; az elavult `shadow*` és `pointerEvents` propok lecserélve |
| S.7 | A nyitóoldal és a megosztókártya ugyanabban a palettában újravágva, a kiadott felület képernyőképeivel |

Ellenőrizve 375 és 1280 szélességen, Bársonyban és Színlapon, kijelentkezve és
bejelentkezve (egy azóta törölt eldobható fiókkal), a fejlesztői szerveren és a
Railway-buildön. Natívon nem volt kipróbálva: a `boxShadow` stringek és a
témánkénti `makeStyles` út az a két dolog, amit egy eszközön érdemes megnézni.

**Amit felszínre hozott, egyik sem blokkoló:**

- A színházoldal továbbra is a legnagyobb termékhiány (5.2): az előadás
  oldalán a színházsor és a kívánságlistán a követett színházak is szeretnének
  valahová vezetni.
- A hírfolyam kártyája megtartja a cím-a-plakáton elrendezést; egy sok
  bejegyzésű, bejelentkezett hírfolyam az egyetlen képernyő, amit nem láttunk
  valódi mennyiséggel.
- A `PremiereCard` és a `TrendingCard` továbbra is csempénként kéri le a
  színházát (`useVenue`); egy `getVenuesByIds` menet, mint a profilon, egy
  kérést spórolna csempénként.

---

## „A" rész — a boltos sáv

Ez valódi React Native alkalmazás, nem webview-burok, így az Apple 4.2-es,
„minimális funkcionalitás" irányelve — a webes eredetű alkalmazások leggyakoribb
elutasítási oka — nem ugyanúgy vonatkozik rá. Ez az út mindig is járható volt,
és soha nem próbáltuk ki. Most kipróbáltuk: a JS mindkét platformra lefordul
Hermes bytecode-dá, a natív konfiguráció megvan, Androidon pedig ellenőrizve is.

### A.1 Az SDK-frissítés és a natív konfiguráció · **kész**

Három commit a `part-a-native` ágon. A kényszerítő ok egy már lejárt határidő: a
Google Play 2026. augusztus 31. óta **API 36**-ot követel minden új feltöltéstől,
az SDK 52 pedig `targetSdk` 35-tel jár, tehát a régi fából épített semmit nem
lehetett volna beadni.

| | Mi |
|---|---|
| A.1.1 | Expo 52 → 57, React 18 → 19, React Native 0.76 → 0.86. Négy változtatás az alkalmazás kódjában, mind átnevezés — `absoluteFillObject`, a `BottomTabBarProps`/`Tabs` az `expo-router/js-tabs`-ból, `ImperativeRouter`, és egy render közben olvasott ref a `Skeleton`-ben. A `@react-navigation/*` kikerült: az expo-router 57 saját másolatot visz magával, így a közvetlen függőségek ugyanazon típusok egy második, szerkezetileg összeférhetetlen készletét jelentették |
| A.1.2 | `app.json` → `app.config.ts` — iOS adatvédelmi manifest, `usesNonExemptEncryption`, `blockedPermissions`, az `expo-splash-screen` plugin, és a mélylink-igények mindkét platformon |
| A.1.3 | `eas.json` — development / preview / production profilok, `appVersionSource: "remote"`, hogy a build számokat az EAS birtokolja |
| A.1.4 | `scripts/write-well-known.ts` és egy nginx `.well-known` blokk, a mélylink-igény domain felőli feléhez |
| A.1.5 | A `check:launch` boltos listát kap, ami mindig kiíródik, és a `--stores` kapcsolóval kényszerítő |

**Amit érdemes tudni:** a `react-hooks` 6 huszonkét `set-state-in-effect`
jelzést talált olyan kódon, amihez a frissítés hozzá sem nyúlt — ez most az 5.5.
A hidratálási hiba pedig, amit az 5.0 rögzített, egyetlen route-ról szólt, nem
mindről, és menet közben meg is lett javítva — lásd az 5.0-t.

**Ellenőrizve:** 299 teszt, tiszta típusellenőrzés és lint, a webes export
továbbra is mind a 31 route-ot kiadja és tizenkettőn üres konzollal hidratál
telefonszélességen, munkamenet nélkül, `expo-doctor` 21/21, valamint egy helyi
`expo prebuild`, ami olyan `AndroidManifest.xml`-t állít elő, amiből kikerül a
három letiltott jogosultság, benne van az `autoVerify` intent filter, és
`targetSdk`/`compileSdk` 36-ra és `minSdk` 24-re oldódik fel.

**Nincs ellenőrizve:** bármi, ami iOS. Az `expo prebuild` Windowsról nem
generál Xcode-projektet, így az adatvédelmi manifestet és az entitlementeket az
első, macOS-en futó EAS build gyakorolja be először.

### A.1b A projekt az EAS-en, és egy alkalmazás, ami feltelepül · **kész**

- Az EAS projekt a `@ottomaior/szinhaz-tracker`, a **személyes** fiókon, nem a csapatfiókon — ez illeszkedik a GitHub-repóhoz. Az EAS-projektek átvihetők fiókok között, tehát ez nem dönti el előre az üzemeltető személyének kérdését.
- Az `extra.eas.projectId` kézzel került az `app.config.ts`-be, mert az `eas init` nem hajlandó dinamikus konfigurációt szerkeszteni: létrehozza a projektet, kiírja az azonosítót, és megáll. A sor nélkül minden build új alkalmazásként regisztrálódna, és elveszne a távoli build szám, amire az `appVersionSource: "remote"` épül.
- Az `EXPO_PUBLIC_SUPABASE_URL` és az `EXPO_PUBLIC_SUPABASE_ANON_KEY` mindhárom EAS-környezetben be van állítva. `env:set`-tel, nem `env:push`-sal, mert az utóbbi egy egész `.env` fájlt olvas be, ez pedig a `SUPABASE_SERVICE_ROLE_KEY`-t is tartalmazza.
- Az Android kulcstárolót a felhőben generáltuk (helyben nincs `keytool`). Ez az a kulcs, amiből az Android mélylink-fájlhoz kellő SHA-256 származik.
- **Van telepíthető APK.** `eas build --profile preview --platform android`.

**Amit érdemes tudni:** az első build az *Install dependencies* lépésben bukott
el, és nem az EAS volt az oka. Az `npm ci` elutasít egy olyan lockfile-t, ami
nem egyezik a `package.json`-nel, a miénk pedig az SDK-frissítés óta nem egyezett
— tizenhat csomag hiányzott belőle, köztük a `react-native-gesture-handler`, a
`react-native-reanimated` és a `react-native-worklets`, amikre egy natív buildnek
szüksége van. Azért estek ki, mert a frissítés végig `--legacy-peer-deps`-szel
települt, és a későbbi `npm uninstall` megnyeste az így előállt fát. **A
`Dockerfile` is `npm ci`-t futtat, tehát ez egyetlen merge-re volt attól, hogy
eltörje a Railway-telepítést** — és telepítési hibának látszott volna, nem
valaminek, amit négy committal korábban vittünk be. Helyben semmi nem vette
észre, mert az `npm install` csendben rendbe teszi az elavult lockfile-t, és itt
minden ellenőrzés a `node_modules` ellen fut. Sima `npm install` javította, és
úgy ellenőriztük, ahogy kellett volna: `npm ci` egy üres könyvtárban, amiben csak
a `package.json` és a lockfile van — pontosan azt csinálja az EAS, a Railway és a
CI is.

### A.2 Ami hátravan

Ezen a listán semmi nem mérnöki munka.

| Akadály | Megjegyzés |
|---|---|
| A mélylinkek nincsenek igazolva | Az alkalmazás felőli igény be van állítva; a `/.well-known/apple-app-site-association`-höz és a `/.well-known/assetlinks.json`-höz kell az Apple Team ID és a Play App Signing ujjlenyomata. A kulcstároló már létezik, tehát az Android fele elérhető, amint van Play Console, ahonnan az aláíró kulcs kiolvasható. A `scripts/write-well-known.ts` megírja mindkettőt. |
| Az ikonokat bolti méretben nem látta senki | 1024×1024-esek, az iOS-es teljesen átlátszatlan, az Android előtér a 66%-os biztonságos zónán belül — tehát *érvényesek*. Azt viszont senki nem nézte meg, hogy 48 pontosan, más alkalmazások mellett a polcon hogyan festenek. |
| A megosztókártya csak webes | Canvas-alapú; natívhoz `react-native-view-shot` kell. Most már ellenőrizhető egy valódi eszközre készült buildben, ami korábban nem létezett. |
| Nincs OTA-frissítés | Az `expo-updates` nincs telepítve. Nem akadály, de egy bolti alkalmazás nélküle minden JavaScript-javításhoz egy teljes felülvizsgálati kört jelent. Érdemes az első beadás *előtt* eldönteni, nem utána. |
| Az iOS-t soha nem fordítottuk le | Az `expo prebuild` Windowsról nem generál Xcode-projektet, így az adatvédelmi manifest és az entitlementek továbbra sincsenek kipróbálva. Az első EAS iOS build az, ahol először tesztelődnek — ahhoz pedig kell az Apple fejlesztői fiók. |
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

- **A Supabase-hitelesítők build időben égnek bele.** A `Dockerfile` build `ARG`-ként veszi át az `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` értékeket, így minden olyan fázis, amihez új környezeti beállítás kell (a 2. fázis VAPID publikus kulcsa), megköveteli, hogy a Railway build változói *a push előtt* frissüljenek, különben a telepítés csendben nélküle megy ki. **Az EAS-ben ugyanez a csapda, egy második helyen.** Az `eas.json` három profilja megnevez egy `environment`-et, így ugyanannak a két `EXPO_PUBLIC_*` változónak az EAS projekt környezeteiben is léteznie kell; egy natív build, amiből hiányoznak, települ, elindul, és üres katalógust mutat — sehol semmilyen hibaüzenet nélkül.
- **A migrációk kézzel mennek fel.** A migrációt alkalmazni és ellenőrizni kell, mielőtt a rá épülő alkalmazáskód felmegy, hogy a telepített build soha ne kérdezzen le még nem létező táblát. Az 5.3 részben azért van a Supabase CLI, hogy ez a sorrendezés kevésbé legyen kézi.
