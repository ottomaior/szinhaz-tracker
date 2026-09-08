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
megjelennek — a Felfedezés, a Műsor naptár, a keresés, egy darab, egy alkotó,
egy nyilvános profil és egy lista —, egyetlen kivétellel: a hero hírfolyama
csak bejelentkezve látható, azt egy demófiókból fényképeztük (lásd alább). A
Profil, a Kívánságlista és az évadösszegző munkamenet nélkül bejelentkezési
felszólítást ad vissza, tehát üres képernyőként fényképeződne.

Az újrafényképezés a fenti felvétel újrafuttatását jelenti; nincs hozzá
szkript a tárházban, mert dev szerver és böngésző-binárist igényel, ami csak
fejlesztői gépen van meg.

Valódi ember egyiken sem szerepel. A szerző neve a kapcsolat szekcióba
tartozik, és sehova máshova az oldalon, az alfatesztelők pedig nem
vállalkoztak plakátra; ezért a két embert mutató kép — a hero hírfolyama
(`feed.webp`) és a nyilvános profil (`user.webp`) — három demófiókból
készült, amelyek az éles adatbázisban élnek: **Tóth Eszter**, **Kovács
Bence** és **Nagy Zsófia**. Valódi fiókok, valódi bejegyzésekkel valódi
produkciókról; követik, kedvelik és kommentelik egymást. A hírfolyam Eszter
*Követettek* füle, amelyen csak a saját köre látszik, így valódi személy nem
kerülhet a képbe. A profil az övé, kijelentkezve fényképezve. A felvétel
után egyik kép sincs szerkesztve. A fiókok demótartalomként maradnak, amíg
az alfa hírfolyama vékony; ne hozz létre továbbiakat, és valódi fiókot soha
ne fényképezz.

## Amíg az app zárt alfatesztben fut

Az oldalon nincs link az appra. Ahol korábban „megnyitom az appot” állt — a
fejléc gombja, a hero elsődleges gombja és a kapcsolat szekció gombja —, ott
most egy `mailto:` kér meghívót, előre kitöltött tárgysorral; a hero a lede
alatt kimondja, hogy ez zárt alfa; a GYIK a „ki használhatja most?” kérdéssel
nyit; a kapcsolat szekció pedig a meghívással kezd. Az app címe szándékosan
nem szerepel a markupban: néhány ember használ egy félkész buildet, és a
bejutás módja az, hogy írni kell. Amikor az app megnyílik, a három gomb
visszakapja a linkjét, a hero megjegyzése és az első GYIK-bejegyzés kikerül,
a kapcsolat szövege pedig elveszti az első bekezdését. A lábléc jogi linkjei
ezen a hoszton lévő statikus másolatokra mutatnak — `/impresszum`,
`/adatvedelem`, `/feltetelek` —, amelyeket a `scripts/render-legal.ts`
állít elő az `i18n/legal.ts`-ből, ugyanabból a szövegből, amit az app is
megjelenít; így az oldalon semmi nem nevezi meg az app címét. A
`deploy:landing` először ezeket generálja újra; kézzel az `npm run
render:legal` teszi meg. Amíg az `i18n/legal.ts` üzemeltetői adatai
nincsenek kitöltve, ugyanazt a „még készül” feliratot viselik, amit az app
saját útvonalai mutatnak.

## A közzététele

**Cloudflare Pages**-re, ebből a könyvtárból, az `npm run deploy:landing`
paranccsal. Ehhez a `CLOUDFLARE_API_TOKEN` és a `CLOUDFLARE_ACCOUNT_ID` kell
a `.env`-be — hogy melyik honnan való, az `.env.example` írja le —, és a
`vastaps` projektbe publikál. A többit a `scripts/deploy-landing.ts`
magyarázza, azt is, hogy a wrangler miért `npx`-en át fut, nem pedig
`devDependencies`-ként.

A közzététel először a `scripts/stamp-shots.ts`-t futtatja, amely az
`index.html` és az `og.html` minden `shots/*.webp` hivatkozását
`shots/nev.webp?v=<tartalomhash>` alakra írja át. A képernyőképek egy napig
gyorstárazódnak (lásd a következő bekezdést), és egy azonos fájlnéven
újrafényképezett kép a régi önmagát mutatta minden telefonon, amelyen az
oldal aznap reggel nyitva volt; a fájllal együtt változó URL-től az
újratelepítés azonnal látszik. Kézzel az `npm run stamp:shots` futtatja egy
kép cseréje után; az eredményt commitolni kell.

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
