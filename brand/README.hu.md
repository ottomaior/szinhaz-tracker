[English](README.md) · **Magyarul**

> Az angol `README.md` az eredeti; ha a kettő valaha eltér, az angol a mérvadó.

# Márkagrafika

Generált képanyag a Vastapshoz: a landing oldalhoz, az app üres állapotaihoz,
az áruházi adatlapokhoz és a megosztási kártyákhoz. Minden itt lévő kép
Higgsfielden készült mesterséges intelligenciával, majd helyben lett kivágva
és újrakódolva; a generátorból kapott eredetik a származékok mellett
maradnak, hogy új méretet újragenerálás nélkül lehessen vágni.

Ebből a mappából még semmi nincs bekötve sem az appba, sem a landing
oldalba. Könyvtár, amiből meríteni lehet, nem build-bemenet: az `expo export`
figyelmen kívül hagyja, a landing oldal nem hivatkozik rá.

A megjelenés az app saját identitása — bársonyos tintafekete alap, antik
arany, metszetszerű vonalak —, úgyhogy ami ide kerül, annak látható varrat
nélkül kell megülnie az `assets/logo-source.svg` meglévő jele mellett. A
kifelé néző anyagokra vonatkozó szabályok ezekre a fájlokra is érvényesek:
nincs név, nincs a képbe égetett szöveg, sehol nem szerepel, hogy „ingyenes”.

## Tartalom

### `hero/`

Két jelölt háttér a landing oldal hero szekciójához, mindkettő egy üres,
történelmi nézőtér a színpad felől nézve, egyetlen meleg fénnyel
megvilágítva, a bal oldal árnyékba fut, hogy a főcím ráülhessen.

| Fájl | Mi ez |
|---|---|
| `hero-auditorium-cinema-studio.png` | Eredeti, 3168×1344 (21:9). Cinema Studio Image 2.5, 2k. Az erősebb: filmszemcse, aranyozott erkély, a bal harmad sötét függöny. |
| `hero-auditorium-2400.webp`, `hero-auditorium-1200.webp` | Webre kész vágatok a fentiből, 2400 és 1200 px szélesek, WebP q82/q80. |
| `hero-auditorium-soul.png` | Eredeti, 2048×1152 (16:9). Higgsfield Soul 2.0, 2k. Szemcsésebb, analógabb, erkélyizzókkal és lencsefénnyel. Alternatíva. |
| `hero-auditorium-soul-1600.webp` | Webre kész vágat a Soul-jelöltből. |

### `icons/`

Arany-a-tintán spot illusztrációk a landing oldal funkciókártyáihoz és
GYIK-jéhez, az app üres állapotaihoz, és bárhová, ahol egy szekciónak
díszre van szüksége, nem UI-ikonra. **Nem** helyettesítik az app 20 px-es
vonalikonjait a `components/icons/` alatt — azok kézzel rajzolt SVG-k
maradnak.

Két kezelés jött ki a munkamenetből:

- **`spot-*`** — egyetlen tárgy sima `#0a0507` négyzeten, 2048×2048,
  egytárgyú promptból. `spot-mask.png` (a komédia/tragédia maszk
  metszetszerű indákkal) és `spot-curtain.png` (vékony vonalú színpad
  reflektorfolttal). A `*-512.png` fájlok 512 px-es vágatok.
- **`badge-*`** — kerek tintafekete jelvények, a `spot-sheet-2x2.png`-ből
  kivágva, ami egyetlen négytárgyú generálás. `badge-mask`, `badge-ticket`,
  `badge-curtain`, `badge-diary`, 828×828, átlátszó sarkokkal (kör alakú
  alfa-maszk 3 px-szel a jelvény széle alatt), plusz `*-512.png` vágatok.
  Ez a négy egy kézből és egy vonalvastagsággal való, úgyhogy készletként
  együtt használandók; a két `spot-` fájl díszesebb, és nagyobb méretben,
  önmagában működik jobban.

A `spot-sheet-2x2.png` a nyers ív, amiből a jelvények ki lettek vágva;
tartsd meg arra az esetre, ha egy jelvényt más méretben kell újravágni.

## Hogyan készültek

| Anyag | Modell | Job id | Kredit |
|---|---|---|---|
| Hero, Cinema Studio | `cinematic_studio_2_5`, 21:9, 2k | `7049afb1-9f56-42cd-bcd8-37b515e31928` | 2 |
| Hero, Soul | `soul_2`, 16:9, 2k | `d4533587-b6d2-4e60-9811-0276a3e6bf09` | 0,12 |
| Spot maszk | `nano_banana_pro`, 1:1 | `559d6808-db73-4b3f-98a9-c4167101f475` | 2 |
| Spot függöny | `nano_banana_pro`, 1:1 | `bd3d5e2d-f90b-4b3d-8873-636175c04c24` | 2 |
| Jelvényív (4 tárgy) | `nano_banana_pro`, 1:1 | `ea53451d-e1ca-496b-9705-535e66c5c21f` | 2 |

A job id-k a Higgsfield könyvtárban (a fiók privát munkaterületén) újra
megnyithatók, és referenciabemenetként használhatók további
generálásokhoz; így lehet ugyanabból a kézből több képet kapni: a job id-t
`image` referenciaként kell átadni, nem a stílust újra leírni.

A Recraft V4.1 (valódi vektoros kimenet, ideális lenne ezekhez az
ikonokhoz) fizetős Higgsfield-csomaghoz kötött, az ingyenes csomagon
elutasította; helyette a Nano Banana Pro készült, ami raszteres kimenetet
ad. Ha később valódi SVG kell, vagy előfizetés után Recrafton kell
újragenerálni, vagy a 2048 px-es PNG-t kell vektorizálni.

### Promptok

A promptok angolul íródtak, és az angol `README.md`-ben szerepelnek szó
szerint; itt csak a lényegük: üres, történelmi közép-európai nézőtér a
színpad felől, bordó bársonyülések, aranyozott erkély, egyetlen meleg
reflektor jobb fentről, 35 mm-es filmszemcse, a bal harmad tintafekete
árnyék a főcímnek, emberek és szöveg nélkül; illetve egy-egy antik arany
(`#e4bf72`) spot illusztráció tintafekete (`#0a0507`) alapon, metszetszerű
vonalakkal, kevés sík aranykitöltéssel, középre igazítva, bő margóval,
szöveg és átmenet nélkül.

A jelvényívnél a modell nem vette figyelembe a sima alapot, és minden
tárgyat kerek tintafekete jelvénybe rakott szürke háttéren; ezért a
jelvények kör alakú maszkkal vannak kivágva, nem négyzetre vágva.

## Újravágás

A származékok `sharp`-pal készülnek (már dev-függőség, a landing
képernyőképek is ezt használják). Új hero-méret vágása:

```bash
node -e "require('sharp')('brand/hero/hero-auditorium-cinema-studio.png').resize({width:1600}).webp({quality:82}).toFile('brand/hero/hero-auditorium-1600.webp')"
```

A jelvények ívről mért középpontjai és sugarai újravágáshoz: mind a négy
kör sugara nagyjából 413 px; a befoglaló négyzetek a (111, 113),
(1110, 113), (112, 1109) és (1109, 1109) pontokban kezdődnek a maszk, a
jegy, a függöny és a napló sorrendjében, mindegyik 828 px-es négyzet.
