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

**Cloudflare Pages**-re, ebből a könyvtárból, az `npm run deploy:landing`
paranccsal. Ehhez a `CLOUDFLARE_API_TOKEN` és a `CLOUDFLARE_ACCOUNT_ID` kell
a `.env`-be — hogy melyik honnan való, az `.env.example` írja le —, és a
`vastaps` projektbe publikál. A többit a `scripts/deploy-landing.ts`
magyarázza, azt is, hogy a wrangler miért `npx`-en át fut, nem pedig
`devDependencies`-ként.

Szándékosan külön tárhely. Az `nginx.conf` az `expo export` kimenetét
szolgálja ki a `dist/` könyvtárból, ez a könyvtár benne van a
`.dockerignore`-ban, a futtatókörnyezeti image pedig csak a `dist/`-et
másolja be — a marketingoldal tehát akkor sem jelenhet meg az app saját
címén, ha ide bármit becommitolunk.

A `_headers` fájlt a Cloudflare Pages a publikáláskor olvassa: magát az
oldalt mindig újraellenőrizteti, hogy egy újrapublikálás azonnal látszódjon,
a képernyőképeket viszont — amelyek tartalom-hash nélküli, sima
fájlnevek — egy napig gyorsítótárazza, nem egy évig.

Saját domain egyetlen rekord kérdése, amint van mire mutatni: a Pages
projektben kell hozzáadni, a tanúsítványt a Cloudflare állítja ki. Az
oldalon semmi nincs a kiszolgáló címéhez kötve, mert minden belső hivatkozás
relatív útvonal vagy horgony.

## Amíg a tárház privát

Az oldalon nincs hivatkozás a forráskódra, és nem is nevezi nyílt
forráskódúnak az appot. Mindkettő szerepelt rajta, és mindkettő rossz volt
egy privát tárház mellett: a gombok minden látogatónak 404-et adtak, az
állítást pedig senki nem tudta ellenőrizni. Ha a tárház egyszer nyilvános
lesz, a hero másodlagos gombja és a technikai rész címe az a két hely, ahol
voltak.
