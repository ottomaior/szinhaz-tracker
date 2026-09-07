[English](README.md) · **Magyarul**

> Az angol `README.md` az eredeti; ha a kettő valaha ellentmond egymásnak, az
> angol változat a mérvadó.

# A Vastaps egyoldalas bemutatója

Egyetlen önálló marketingoldal az apphoz: az `index.html` és a `shots/`
mappában lévő képernyőképek. Szándékosan nem része az Expo buildnek — semmit
nem oszt meg az `app/` könyvtárral, és az `expo export` nem exportálja, így
innen semmi nem tudja elrontani az appot.

A magyar szöveg maga a dokumentum, nem egy fordítás. Minden látható szöveg
magyarul van megírva a markupban, az angolt pedig a fájl végén lévő szkript
teszi rá szótárként; visszaváltáskor az eredeti csomópontok állnak vissza,
nem egy második fordítás készül. Emiatt az oldal kikapcsolt JavaScript
mellett is helyesen olvasható magyarul — és a keresők meg a
linkelőnézetek is ezt látják. Az olvasó választását a `localStorage` őrzi
`vastaps-lang` néven.

A paletta az app saját `velvetDark` témája (`theme/themes.ts`), az oldal
alapja egy árnyalattal mélyebbre véve, hogy a telefonos képernyőképek
megvilágított tárgyként olvassanak a sötét színpadon; a két betűtípus az app
saját Bodoni Modája és Sorája, a Google Fontsról betöltve. Az oldalnak
szándékosan egyetlen témája van — a nézőtér sötét —, ezért minden szín
kifejezetten ki van festve, nem örökölt.

## A képernyőképek

A `shots/*.webp` fájlok a futó app valódi felvételei, nem makettek. Az
`npx expo start --web` ellen készültek, fej nélküli böngészőben, a Chrome
DevTools Protocolon keresztül vezérelve, 402×874 méretben, 3-as
eszközskálázással, majd 810 képpont szélesre átméretezve és WebP formátumba
kódolva a `sharp` segítségével.

Csak olyan képernyők kerültek bele, amelyek **kijelentkezve** is
megjelennek — ezért áll a készlet a Felfedezésből, a Műsor naptárból, a
keresésből, egy darabból, egy alkotóból, egy nyilvános profilból és egy
listából. A Profil, a Kívánságlista és az évadösszegző munkamenet nélkül
bejelentkezési felszólítást ad vissza, tehát üres képernyőként fényképeződne.

Az újrafényképezés a fenti felvétel újrafuttatását jelenti; nincs hozzá
szkript a tárházban, mert dev szerver és böngésző-binárist igényel, ami csak
fejlesztői gépen van meg.

## A közzététele

Egyelőre sehogy. Az `nginx.conf` az `expo export` kimenetét szolgálja ki a
`dist/` könyvtárból, és ez a könyvtár nem része annak. A lehetőségek,
nagyjából ráfordítás szerint:

- A `landing/` mappa feltöltése bármelyik statikus tárhelyre (GitHub Pages,
  Netlify, Cloudflare Pages), saját domain alatt.
- Egy nginx `location` blokk, ami ezt a könyvtárat szolgálja ki például az
  `/about` útvonalon, és a `landing/` bemásolása az image-be a
  `Dockerfile`-ban.
- Kiszolgálás a `/` gyökéren, az appot pedig aldomainre költöztetve — ez a
  legnagyobb változás, és ez rontaná el az `app.config.ts` mélylink-igényeit
  is, mivel a `PRODUCTION_HOST` bele van fordítva a natív binárisokba.
