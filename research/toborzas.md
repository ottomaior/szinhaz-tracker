# Toborzás

> Recruitment copy. First round is friends and acquaintances, by direct message. The group post is for later, when the survey needs to pass 50 responses to read as a ranking. Neither text says the app is free, and coverage is framed as Budapest and Debrecen.

## 1. Barátoknak, ismerősöknek — most

### Kérdőív (üzenetben, egyenként — nem csoportosan, mert arra senki nem válaszol)

> Szia! Egy színházi appot csinálok — egy napló arról, mit láttál, meg egy műsor, mi megy ma este Budapesten és Debrecenben. Mielőtt elindul, szeretném tudni, mi kell bele és mi nem. Ez egy hétperces kérdőív, nincs benne jó válasz, csak az, amit te gondolsz:
>
> https://vastaps.pages.dev/kutatas
>
> És ha ismersz valakit, aki jár színházba, küldd tovább neki — az ér a legtöbbet. Köszönöm!

### Interjú (annak, aki legalább kétszer volt színházban tavaly)

> Szia! Beszélnél velem fél órát arról, hogy te hogyan jársz színházba? Nem az appról kérdeznék, hanem rólad — mit néztél, hogyan választottál, mire emlékszel. Kávé, telefon vagy videó, amelyik neked jobb. Mikor lenne jó a jövő héten?

### Használhatósági teszt (annak, aki szívesen nyomkod)

> Szia! Megnéznéd velem húsz percre, hogy boldogulsz-e az appommal? Három dolgot kérnék, te meg közben mondod, mi idegesít. Nem téged tesztelünk, hanem az appot — minél több hibát találsz, annál jobb. Személyesen lenne a legjobb, a saját telefonodon.

### Emlékeztető (a 11. nap körül, annak, aki nem töltötte ki)

> Szia, csak egy emlékeztető a kérdőívről — még pár napig nyitva van, és tényleg hét perc: https://vastaps.pages.dev/kutatas Köszi!

## 2. Facebook- és Reddit-csoportoknak — később

> Post for theatregoer and ticket-exchange groups. Read the group rules first: most ban self-promotion but allow research posts if they are honest about who is asking and why. Post from Ottó's own account, not a page.

Csoportok, ahol érdemes megpróbálni (a csoportszabályokat előbb elolvasva):
- budapesti és debreceni jegycserélő csoportok (ezekben azok vannak, akik sokat járnak);
- „Színházba járók” típusú országos csoportok;
- debreceni városi csoportok, a Csokonai közönségének;
- r/hungary, egy őszinte poszttal.

### A poszt

> **Ki jár színházba, és segítene hét percet?**
>
> Egy magyar színházi appot építek egyedül — napló arról, mit láttál (mikor, ki játszott, hol ültél), és egy műsor, ami minden este a színházak saját oldaláról frissül. Most Budapest és Debrecen, aztán oda, ahonnan kérik.
>
> Mielőtt elindul, szeretném tudni, mi kell bele valójában — ezért egy rövid kérdőív, ahol nem osztályozni kell, hanem választani: https://vastaps.pages.dev/kutatas
>
> Aki kíváncsi, magát az appot is megnézheti: https://szinhaz-tracker-production.up.railway.app — kritikát ide a kommentbe, annak örülök a legjobban.

### Ha megkérdezik, mennyibe kerül

> Do not promise it is free. Describe the present and stop.

> Böngészni, naplózni és értékelni most nem kerül semmibe, és nincs benne hirdetés. Hogy hosszabb távon miből tartja el magát, még nyitott — bármi változás előre lesz bejelentve, nem visszamenőleg.

## Mit mérünk a csoportos posztnál

> This is the behavioural signal: a click beats an answer.

Nem csak a kitöltéseket. Azt is, hányan nyitják meg az appot a posztból, és hányan regisztrálnak aznap. Egy tucat kitöltés és nulla regisztráció mást jelent, mint három kitöltés és öt regisztráció. Cloudflare Pages analitikája a landing oldalra bekapcsolható a projekt beállításaiban; a regisztrációk száma a Supabase `profiles` táblájából olvasható dátum szerint.
