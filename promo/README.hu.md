[English](README.md) · **Magyarul**

> Az angol `README.md` az eredeti; ha a kettő valaha ellentmond egymásnak, az
> angol változat a mérvadó.

# A Vastaps promófilm

Harminc másodperc, 1080×1920, magyarul, narráció nélkül. Reelsre, TikTokra,
Storyba és Shortsba készült, ugyanabból a palettából és ugyanabból a két
betűtípusból, mint a landing page, ugyanazokkal a valódi képernyőképekkel a
`../landing/shots/` könyvtárból.

```bash
npm run promo -- --ffmpeg /eleres/ffmpeg
```

A kimenet a `promo/out/vastaps-promo.mp4` lesz, ami gitignore-olt: build
melléktermék, és az újrarenderelés úgy öt percbe telik.

## Miért nem animál semmit magától a jelenet

A `scene.html`-ben nincs CSS-animáció és nincs átmenet. Mindent, ami mozog, a
`setFrame(t)` ír ki: ez a függvény kap egy másodpercben mért időt, és abból
állítja be az összes átlátszóságot és transzformációt.

Ez maga a trükk. A `scripts/render-promo.ts` képkockánként lépteti ezt az
órát, és lefényképezi az eredményt — így a 417. képkocka ugyanaz marad
függetlenül attól, meddig tartott a felvétel, vagy mennyire volt terhelt a
gép. Egy magától animáló oldalt a képernyőképek épp aktuális ütemében
mintavételeznénk, és a videó akadozna — egy rossz képkocka pedig itt, a
böngészőben eldobott képkockával ellentétben, végleges.

Ráadásul így a film munka közben tekerhető: nyisd meg a `scene.html`-t, hívd
meg a konzolban a `setFrame(17.8)`-at, és pontosan azt látod, ami az a
képkocka lesz.

## A műsorrend

| -tól | -ig | Mi történik |
|---|---|---|
| 0,0 | 4,0 | Felmegy a fény, a védjegy és a szóvédjegy |
| 4,0 | 9,2 | A horog, két sorban |
| 9,2 | 15,0 | Műsor — a Felfedezés átúszik a Műsor naptárba |
| 15,0 | 21,0 | A napló — egy előadás, a három értékelési chip, aztán egy profil |
| 21,2 | 25,4 | Alkotók — egy keresés feloldódik egy színész oldalává |
| 25,8 | 30,0 | Zárókép, az utolsó képkockáig kitartva, hogy a bélyegképre az URL kerüljön |

A vágópontok a `scene.html` `CUTS` tömbjében vannak, a szövegek pedig sima
szövegként a markupban. Egy sor átírása egy szerkesztés és egy újrarenderelés,
semmi több.

## Mi kell hozzá

**Microsoft Edge**, amit a renderelő a Chrome DevTools Protocolon keresztül
vezérel, a Node beépített WebSocketjével — se Puppeteer, se Playwright, se
böngészőletöltés.

**ffmpeg**, egyetlen parancshoz a végén. Szándékosan nem függősége ennek a
tárháznak: add meg a `--ffmpeg` kapcsolóval egy statikus build elérési útját,
vagy tedd `PATH`-ra. Statikus Windows-buildek itt:
<https://github.com/BtbN/FFmpeg-Builds/releases>.

A kódolás H.264, yuv420p, `+faststart`, és van mellette egy néma sztereó AAC
sáv is — több platform hibásnak tekinti azt a videót, amiben egyáltalán nincs
hangsáv, és visszautasítja a feltöltést.

## Ha zenét teszel alá

A renderben azon a csenden kívül nincs hang, és a film úgy készült, hogy
anélkül is működjön: minden állítást a képen lévő szöveg visz. Egy alátett
zene semmivel nem fog ütközni, a vágások pedig 9,2 másodperctől nagyjából
kétmásodperces rácson vannak.
