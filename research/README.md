**English notes are in `>` blocks; the instruments themselves are Hungarian, because the people we talk to are.**

# Vastaps — felhasználói kutatás az indulás előtt

Mit akarunk megtudni, és miért éppen így.

## A két kérdés

1. **Számít-e ez az app** a budapesti és debreceni színházba járóknak — van-e olyan visszatérő helyzetük, amit ma rosszul vagy sehogy nem oldanak meg, és amire a Vastaps válasz lehet?
2. **Melyik funkció kell, melyik nem** — mi az, ami nélkül nem használnák, mi az, ami csak szép, és mi az, amit hiába építettünk?

## Miért nem egy „mennyire fontos?” kérdőív

> Why not a plain importance survey: asked to rate twelve features 1–5, respondents rate nine of them 4 or 5. The scale does not discriminate. And stated opinions about hypothetical features predict actual use poorly, while questions about *past behaviour* are reliable.

Egy 1–5-ös fontossági skálán mindenki mindent fontosnak mond. Tizenkét funkcióból kilenc kap négyest vagy ötöst, és a skála nem különböztet meg semmit. Ráadásul az emberek rosszul jósolják meg, mit fognak használni — de megbízhatóan elmondják, mit *csináltak* legutóbb.

Ezért három forrásból dolgozunk, és a súlyuk nem egyforma:

| Forrás | Mit ad | Súly |
|---|---|---|
| **Interjúk** (8–10 beszélgetés) | A valódi helyzeteket: hogyan választanak, hogyan emlékeznek, kivel beszélik meg. Ez dönti el, hogy létezik-e a probléma. | elsődleges |
| **Használhatósági tesztek** (5 ülés az élő appon) | Mi működik és mi akad el, amikor valaki ténylegesen használja. Öt ember többet mond a funkciókról, mint ötven kérdőív. | elsődleges |
| **Kérdőív** (`vastaps.pages.dev/kutatas`) | Rangsort a funkciók között — nem osztályzatot, hanem kényszerű választást —, és a viselkedési alapadatokat. | támogató |

## A kérdőív módszere

> The questionnaire uses two trade-off methods instead of ratings.

**MaxDiff (best–worst scaling).** Tizenkét funkció, kilenc képernyő, minden képernyőn négy funkció, és a válaszoló mindig a *legértékesebbet* és a *legkevésbé értékeset* jelöli meg. Minden funkció pontosan háromszor szerepel, és semelyik pár nem kerül kétszer egy képernyőre. Ebből rangsor lesz, távolságokkal — egy osztályzatból sosem.

**Kano-párok.** Hat bizonytalan funkcióról két kérdés: „mit éreznél, ha lenne?” és „mit éreznél, ha nem lenne?”. A két válasz együtt sorolja be a funkciót: *alap* (elvárt, hiánya bosszant), *teljesítmény* (minél több, annál jobb), *vonzó* (meglepetés, hiánya nem fáj), *közömbös*, vagy *fordított* (inkább ne legyen).

**Viselkedés előbb, vélemény utóbb.** A kérdőív azzal kezd, hogy hányszor, hol, honnan tudja meg, hogyan jegyzi fel — és csak aztán kérdez funkciókról.

## Hogyan olvassuk az eredményt kevés válasznál

> How to read the results honestly at 15–30 responses.

Az első körben barátok és ismerősök válaszolnak, ez 15–30 kitöltés. Ez **kevés** egy stabil MaxDiff-rangsorhoz (ahhoz 50+ kell), ezért:

- A jelentés 30 válasz alatt **darabszámot** ír, nem tizedes pontszámot. „Kilencszer volt a legjobb, egyszer a legrosszabb” — ez őszinte; „0,73” azt sugallná, hogy pontos.
- A rangsor **teteje és alja** használható: ami a lista elején van, azt valóban értékelik; ami az alján, azt nem. A középső hat sorrendje zaj.
- A Kano-besorolás akkor mondható ki, ha egy kategória a válaszok **legalább felét** viszi. Ha 40/35/25-ös a megoszlás, az „vegyes”, és úgy is kell írni.
- A viselkedési kérdések már 15 válasznál is mondanak valamit — de a válaszolók színházrajongók, mert azok vállalnak egy hétperces kérdőívet. A „hányszor jársz” eloszlás tehát felfelé torzít.
- Az interjúk és a tesztek erre nem érzékenyek: ott öt–tíz ember is elég, mert nem számolunk, hanem megfigyelünk.

A kérdőív nyitva marad. Ha később Facebook-csoportokba is kikerül, ugyanaz az eszköz 50–100 válasznál már rangsorként is olvasható, és a jelentés magától átvált pontszámra.

## Menetrend — két hét

| Nap | Mi történik |
|---|---|
| 1–2. | Kérdőív kiküldése a barátoknak (`toborzas.md`, első üzenet). Interjúidőpontok egyeztetése. |
| 3–9. | Interjúk, napi egy–kettő (`interju-vezerfonal.md`). Minden interjú után **még aznap** kitölteni a szintézislapot (`szintezis-sablon.md`). |
| 6–10. | Használhatósági tesztek, ötször (`hasznalhatosagi-teszt.md`). |
| 11. | Emlékeztető a kérdőívről annak, aki nem töltötte ki. |
| 13–14. | `npm run research:report`, a tíz szintézislap egymás mellé téve, és egy egyoldalas összegzés: mi bizonyosodott be, mi dőlt meg, mi legyen az indulási funkciókészlet. |

## Fájlok

- `interju-vezerfonal.md` — az interjú menete, kérdésről kérdésre, és amit nem szabad kérdezni.
- `hasznalhatosagi-teszt.md` — három feladat az élő appon, és a megfigyelőlap.
- `toborzas.md` — üzenetek: barátoknak most, csoportoknak később.
- `szintezis-sablon.md` — egy oldal interjúnként, hogy tíz összehasonlítható legyen.
- `jelentes-<dátum>.md` — a kérdőív jelentése, a `scripts/research-report.ts` írja.

## Amit a kérdőív tárol

> What the questionnaire stores, for the privacy page and for anyone asking.

A válaszok névtelenek. Egy véletlen azonosító kerül a böngésző tárolójába, hogy egy ember ne tudja kétszer beküldeni — ez nem köthető személyhez. E-mail-cím csak akkor kerül tárolásra, ha valaki bepipálja, hogy szólunk neki az indulásról, és azt csak arra használjuk. Az adatvédelmi tájékoztató (`i18n/legal.ts`) külön bekezdésben mondja ezt el.
