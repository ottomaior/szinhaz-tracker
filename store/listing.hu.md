# Google Play áruházi adatlap — Vastaps

Minden mező pontos értéke, ahogy a Play Console-ba be kell írni. Ez a fájl a
forrás; a Console csak másolatot tárol belőle. Ha a szöveg változik, itt kell
átírni és onnan átmásolni, nem fordítva — különben fél év múlva senki nem tudja
megmondani, melyik verzió az igazi.

Karakterkorlátokat a `scripts/check-store-copy.ts` ellenőrzi (`npm run check:store`).

---

## Alkalmazás adatai

| Mező | Érték |
| --- | --- |
| Alkalmazás neve | `Vastaps` |
| Csomagnév | `hu.szinhaztracker.app` |
| Alapértelmezett nyelv | `magyar (hu-HU)` |
| Alkalmazás vagy játék | Alkalmazás |
| Ingyenes vagy fizetős | Ingyenes |

> A csomagnév **véglegesen** rögzül az első feltöltéssel. `hu.szinhaztracker.app`
> — a `slug` és a `PRODUCTION_HOST` a `szinhaz-tracker` nevet őrzi, a bolti név
> viszont `Vastaps`. Ez nem hiba, csak nem szabad menet közben „rendbe tenni”.

---

## Rövid leírás

*(max. 80 karakter — a keresési találatnál ez látszik)*

```
Ami ma este megy a színházban — és a napló arról, amit már láttál.
```

## Teljes leírás

*(max. 4000 karakter)*

```
Nyolc színház műsora egy képernyőn, és egy napló arról, amit végigültél.

MI MEGY MA ESTE
A Vastaps nem darabok listája, hanem estéké. Megnézed, mi megy pénteken
Budapesten vagy Debrecenben, szűrsz műfajra, színházra, terjedelemre, és
addig szűkíted, amíg egyetlen este marad.

A NAPLÓ
Amit láttál, felírod. Öt maszk az összbenyomásnak, és három külön szempont:
színészi játék, rendezés, díszlet. Mellé egy mondat, ha van kedved — vagy
semmi, ha nincs. A hely, az ár és a jegyről készült fotó ugyanoda kerül.

Ugyanaz a darab másodszor külön bejegyzés, külön értékeléssel. Mert nem
ugyanaz az este volt.

AZ ÉVAD, NEM A NAPTÁRI ÉV
A Vastaps szeptembertől augusztusig számol, ahogy a színházak is. Az évad
végén egyben látod, hol jártál.

ALKOTÓK
Közel ezer produkció adatlapja, szereposztással. Rákeresel a színésznőre,
akit a második felvonásban láttál, és megtudod, ki volt. Ha követed, szólunk,
amikor új előadásban lép színpadra.

KERESÉS, AMI MŰKÖDIK
Ékezet nélkül is megtalálja. A „Csuja Imre” a színészre keres, nem a szavakra.
A régi, rég levett produkciók is bent maradnak: kereshetők és naplózhatók.

KÍVÁNSÁGLISTA ÉS LISTÁK
Egy koppintás a műsorból, és ott marad, amíg le nem ülsz a nézőtérre. Saját
listákat is összeállíthatsz.

HÍRFOLYAM
Ha követsz másokat, látod, mit néztek meg és mit írtak róla.

—

A Vastaps ingyenes. Nincs benne hirdetés, és nem követ téged más appokon vagy
oldalakon keresztül.

Böngészni bejelentkezés nélkül is lehet. Fiók a naplóhoz, a listákhoz és az
értesítésekhez kell.

Amit a naplódba írsz, alapesetben mások számára is olvasható — a Vastaps
közösségi napló, nem titkos füzet. Ez a regisztrációnál is ott áll, és az
adatvédelmi tájékoztató részletezi.

Most nyolc színház szerepel benne, Budapestről és Debrecenből. Több színház és
több város jön — oda megyünk legközelebb, ahonnan kérik.
```

---

## Grafikai elemek

Mind a `store/out/` könyvtárban, a `npm run store` írja őket.

| Play mező | Fájl | Méret |
| --- | --- | --- |
| Alkalmazásikon | `store/out/icon-512.png` | 512×512, átlátszóság nélkül |
| Kiemelt grafika | `store/out/feature-graphic.png` | 1024×500 |
| Telefonos képernyőképek | `store/out/screenshot-01…08.png` | 1080×1920 |

A `landing/shots/*.webp` **nem** tölthető fel közvetlenül: 810×1761, ami
magasabb a Play által elfogadott 9:16-nál, és a feltöltés elutasítja.

Tablet-képernyőkép nincs, és nem is kell: `ios.supportsTablet: false`, és az
Android-oldalon sincs tabletre szabott elrendezés. A Play emiatt a listázásnál
jelezni fogja, hogy „nem optimalizált nagy képernyőre” — ez tudatos, nem hiányzó
munka.

---

## Kategória és elérhetőségek

| Mező | Érték |
| --- | --- |
| Alkalmazás kategóriája | `Életmód` (Lifestyle) |
| Címkék | színház, kultúra, napló, előadás |
| E-mail | `ottomaior@protonmail.com` |
| Weboldal | `https://vastaps.pages.dev/` |
| Adatvédelmi tájékoztató | `https://vastaps.pages.dev/adatvedelem` |

> **Kategória.** A „Szórakozás” (Entertainment) is védhető lenne, de az a
> kategória tele van streaming-alkalmazásokkal, és a Vastaps nem tartalmat
> szolgáltat, hanem egy szokást tart nyilván. Az „Életmód” közelebb van ahhoz,
> ahogy valaki tényleg használja.

---

## App access — belépés az ellenőrnek

A Play ellenőre nem regisztrál magának: ha az app egy része bejelentkezéshez
kötött, kapnia kell egy működő fiókot, különben a beküldés elutasítható azon az
alapon, hogy a funkciók nem voltak elérhetők. Böngészni a Vastapsban
bejelentkezés nélkül is lehet, de a napló, a listák és az értesítések nem —
tehát kell a fiók.

| Mező | Érték |
| --- | --- |
| Fiók | `ottomaior+playreview@protonmail.com` |
| Név az appban | `Play Review` |
| Jelszó | **nincs itt** — a Play Console → App access mezőjében |

A jelszó szándékosan nem szerepel ebben a fájlban. A repó megosztható, a
Console nem, és egy jelszó a verziókövetésben akkor is ott marad, amikor már rég
megváltoztatták. Ha elveszik, a jelszó-visszaállítás a fenti címre megy — ez egy
plusz-címzés, tehát Ottó postaládájába érkezik.

A fiók naplója üres. Ez nem hiány: az ellenőr azt nézi, hogy a funkciók
elérhetők-e, és egy friss fiók pontosan azt mutatja meg, amit egy új felhasználó
lát. A hírfolyamban a demófiókok bejegyzései bejelentkezés nélkül is látszanak.
