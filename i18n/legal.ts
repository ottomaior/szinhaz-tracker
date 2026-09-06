/**
 * The legal documents, in Hungarian.
 *
 * Separate from `i18n/hu.ts` on purpose. That file is UI copy — labels,
 * buttons, one-line hints — and stays navigable because everything in it is
 * short. These are long-form documents with their own structure, and dropping
 * three thousand words of prose into the middle of it would bury the strings
 * every screen actually reads.
 *
 * The documents are data rather than JSX so that `components/ui/LegalDocument`
 * can render all three identically, and so a copy change never touches a
 * screen. They are also deliberately specific about what this app does: a
 * generic template would not mention that a diary entry is world-readable, and
 * that is the single most important thing a person signing up here should know.
 *
 * NOT LEGAL ADVICE. These describe the system accurately, which is the part
 * that needs someone who has read the code. Have them reviewed before launch.
 */

/**
 * Who is publishing this.
 *
 * Every one of these is required: the GDPR requires the controller's identity
 * and contact details, the Hungarian e-commerce act (Ektv. 4. §) requires the
 * service provider's name, seat and email, and the DSA requires a contact
 * point. They are collected here rather than typed into the prose so there is
 * exactly one place to fill in, and `i18n/legal.test.ts` fails while any of
 * them is still a placeholder — a privacy policy that says TODO is worse than
 * no privacy policy, and this is not the kind of mistake that shows up on
 * screen in a way anyone would notice.
 */
export const operator = {
  /** Legal name — a person's full name, or the company's registered name. */
  name: "TODO_OPERATOR_NAME",
  /** Registered seat / postal address, as it would appear on official post. */
  address: "TODO_OPERATOR_ADDRESS",
  /** The address that reaches a human. Used for privacy requests and reports. */
  email: "TODO_OPERATOR_EMAIL",
  /**
   * Company registration number, or tax number for a sole trader.
   * Set to null for a private individual publishing in a non-business
   * capacity — the impresszum then omits the line rather than showing a blank.
   */
  registrationNumber: null as string | null,
} as const;

/** Where the app is served from, named in the impresszum as the Ektv. requires. */
export const hostingProvider = {
  name: "Railway Corp.",
  address: "548 Market St PMB 68956, San Francisco, CA 94104, USA",
  email: "team@railway.app",
} as const;

/**
 * The date the documents last changed in substance.
 *
 * Written the Hungarian way, with the closing full stop that a date carries as
 * part of its spelling — so every sentence interpolating it ends there and must
 * not add one of its own.
 *
 * Bumped by hand rather than derived from the file's mtime or the git log: a
 * typo fix is not a new version, and telling people the policy changed when it
 * did not is how a change notice stops being read.
 */
export const legalLastUpdated = "2026. szeptember 6.";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  /** One or two sentences under the title, before the first heading. */
  lead: string;
  sections: LegalSection[];
};

const p = (text: string): LegalBlock => ({ kind: "p", text });
const ul = (...items: string[]): LegalBlock => ({ kind: "ul", items });

/**
 * The supervisory authority a Hungarian data subject complains to.
 *
 * Naming it — with its address — is required by Art. 13(2)(d) read with the
 * Hungarian implementing act; "you may complain to the authority" without
 * saying which one does not discharge it.
 */
const naih = {
  name: "Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)",
  address: "1055 Budapest, Falk Miksa utca 9-11.",
  postal: "1363 Budapest, Pf. 9.",
  email: "ugyfelszolgalat@naih.hu",
  web: "naih.hu",
};

export const privacyPolicy: LegalDocument = {
  title: "Adatkezelési tájékoztató",
  lead: `Ez a tájékoztató azt írja le, hogy a Színház Tracker milyen adatokat kezel rólad, miért, meddig, és mit tehetsz ezzel kapcsolatban. Utoljára frissítve: ${legalLastUpdated}`,
  sections: [
    {
      heading: "Ki kezeli az adataidat",
      blocks: [
        p(
          `Az adatkezelő ${operator.name} (székhely: ${operator.address}), a továbbiakban „mi”. Adatkezeléssel kapcsolatos bármely kérdésben a ${operator.email} címen érsz el minket.`
        ),
        p(
          "Adatvédelmi tisztviselőt nem neveztünk ki, mert a szolgáltatás nem végez nagy számban különleges adatok kezelését, és nem jár a felhasználók rendszeres, szisztematikus megfigyelésével."
        ),
      ],
    },
    {
      heading: "A legfontosabb, amit érdemes előre tudni",
      blocks: [
        p(
          "A Színház Tracker nyilvános napló. Amit egy előadásról beírsz — hogy láttad, mikor, hányra értékelted, mit írtál róla, kik léptek fel aznap este, sőt a feltöltött jegyfotó is — bárki számára olvasható, aki megnyitja az alkalmazást, akkor is, ha nincs fiókja. Ez nem mellékhatás, hanem a szolgáltatás lényege: a napló attól ér valamit, hogy mások is olvassák."
        ),
        p(
          "Két dolog következik ebből, amit érdemes elolvasni, mielőtt beírsz valamit. A jegyfotón a legtöbb magyar színházban rajta van a neved és a foglalási azonosítód — ezt a képet nyilvánosnak szánod, amikor feltöltöd. És a naplód együtt olvasva elárulja, mikor nem vagy otthon; ez ugyanaz a megfontolás, mint bármelyik közösségi oldalon."
        ),
        p(
          "Amit senki más nem lát: az e-mail-címed, a jelszavad és az értesítéseid (a postaláda tartalma a te kívánságlistád sorrendje, ezért csak neked olvasható)."
        ),
      ],
    },
    {
      heading: "Milyen adatokat kezelünk, és milyen jogalapon",
      blocks: [
        p(
          "Fiók létrehozásakor és használatakor a szerződés teljesítése a jogalap (GDPR 6. cikk (1) b) pont) — enélkül a szolgáltatás nem tud működni:"
        ),
        ul(
          "E-mail-cím és jelszó. A jelszót nem ismerjük: azt az adatfeldolgozónk sózott, egyirányú lenyomatként tárolja.",
          "Profil: megjelenített név, automatikusan képzett felhasználónév, a névből képzett monogram, valamint amit magadról megadsz — város, bemutatkozás, profilkép.",
          "Napló: melyik előadást láttad, mikor, hányra értékelted (összesítve és színészi játék / rendezés / díszlet bontásban), a szöveges kritikád, a hangulatcímkék, hogy hányadszor láttad, melyik előadásra váltottál jegyet, hol ültél, mennyit fizettél a jegyért, a feltöltött jegyfotó, és hogy aznap este kik léptek fel.",
          "Kívánságlista, saját listák, követések (más felhasználók, alkotók és színházak), kedvelések és hozzászólások.",
          "Értesítések, amelyeket az éjszakai frissítés generál neked."
        ),
        p(
          "Hozzájárulás alapján (6. cikk (1) a) pont) kezeljük a profilképet és a jegyfotót — ezek megadása önkéntes, a hozzájárulást a kép törlésével bármikor visszavonhatod, ami a jövőre nézve szünteti meg az adatkezelést."
        ),
        p(
          "Jogos érdek alapján (6. cikk (1) f) pont) kezelünk technikai naplóadatokat a szolgáltatás üzemeltetéséhez, a visszaélések és a rosszindulatú forgalom kiszűréséhez, valamint a bejelentett tartalmak elbírálásához. A jogos érdek itt a szolgáltatás működőképessége és a többi felhasználó védelme."
        ),
        p(
          "Nem végzünk automatizált döntéshozatalt és profilalkotást, nem kereskedünk az adataiddal, és nem adjuk át őket hirdetőknek."
        ),
      ],
    },
    {
      heading: "Sütik és nyomkövetés",
      blocks: [
        p(
          "Az alkalmazás nem használ hirdetési vagy analitikai sütiket, és nem épít be külső nyomkövető szkriptet. Két dolgot tárolunk a böngésződben, mindkettőt a működéshez: a bejelentkezési munkamenetet (enélkül minden oldalbetöltésnél újra be kellene jelentkezned) és a kiválasztott színvilágot. Egyik sem hagyja el az eszközödet a szolgáltatás felé, és egyikhez sem kérünk hozzájárulást, mert az elektronikus hírközlési szabályok az ilyen, feltétlenül szükséges tárolást mentesítik alóla."
        ),
      ],
    },
    {
      heading: "Kik férnek hozzá az adatokhoz",
      blocks: [
        p("Adatfeldolgozókat veszünk igénybe, akik a mi utasításunkra járnak el:"),
        ul(
          "Supabase (adatbázis, bejelentkezés, fájltárolás). Itt tárolódik gyakorlatilag minden, amit fentebb felsoroltunk.",
          `${hostingProvider.name} (tárhelyszolgáltatás) — az alkalmazást kiszolgáló szerver üzemeltetője.`,
          "GitHub (az éjszakai színházi műsorfrissítést futtató szolgáltatás). Ez a folyamat a színházak műsorát olvassa, felhasználói adatot nem."
        ),
        p(
          "Ezen kívül csak akkor adunk át adatot, ha jogszabály vagy hatósági, illetve bírósági megkeresés kötelez rá."
        ),
        p(
          "Egyes szolgáltatóink az Európai Gazdasági Térségen kívül is működtethetnek infrastruktúrát. Ahol ilyen adattovábbítás történik, az az Európai Bizottság általános szerződési feltételein alapul."
        ),
      ],
    },
    {
      heading: "Meddig őrizzük",
      blocks: [
        ul(
          "A fiókodhoz kötött adatokat addig, amíg a fiókod fennáll.",
          "Ha törlöd a fiókodat, a profilod, a naplód, az értékeléseid, a listáid, a követéseid, a kedveléseid, a hozzászólásaid, valamint a feltöltött profilképed és jegyfotóid azonnal és véglegesen törlődnek.",
          "Ami nem törlődik: az általad kézzel felvett előadások és színházak megmaradnak a katalógusban, de a szerzőségük megszűnik — a rekord többé nem kapcsolódik hozzád. Ezek ugyanis közös katalógusadatok, amelyekre mások naplóbejegyzései hivatkozhatnak.",
          "A technikai üzemeltetési naplókat legfeljebb 30 napig őrizzük."
        ),
      ],
    },
    {
      heading: "A te jogaid",
      blocks: [
        p("A GDPR alapján jogod van:"),
        ul(
          "hozzáférni a rólad kezelt adatokhoz, és másolatot kérni róluk — ezt a Beállítások képernyőn magad is megteheted, az adataid letöltésével;",
          "helyesbíteni a pontatlan adatokat — a profilodat és minden naplóbejegyzésedet bármikor szerkesztheted;",
          "töröltetni az adataidat — a Beállítások képernyőn a fiókod törlésével, közvetítő nélkül;",
          "kérni az adatkezelés korlátozását, illetve tiltakozni a jogos érdeken alapuló adatkezelés ellen;",
          "az adataidat géppel olvasható formátumban megkapni és máshová vinni;",
          "a hozzájárulásodat bármikor visszavonni, a visszavonás előtti adatkezelés jogszerűségének érintése nélkül."
        ),
        p(
          `Kérésedet a ${operator.email} címre küldd. Legkésőbb egy hónapon belül válaszolunk.`
        ),
        p(
          `Ha úgy érzed, hogy jogsértően kezeljük az adataidat, panasszal fordulhatsz a felügyeleti hatósághoz: ${naih.name}, ${naih.address} (postacím: ${naih.postal}), e-mail: ${naih.email}, honlap: ${naih.web}. Bírósághoz is fordulhatsz, a lakóhelyed vagy a tartózkodási helyed szerinti törvényszéken.`
        ),
      ],
    },
    {
      heading: "Adatbiztonság",
      blocks: [
        p(
          "A kapcsolat titkosított (HTTPS). Az adatbázisban sorszintű biztonsági szabályok érvényesülnek: a szerver oldalán van kikényszerítve, hogy ki mit írhat és olvashat, nem csak az alkalmazás felületén. A jelszavakat nem tároljuk visszafejthető formában."
        ),
        p(
          "Ezzel együtt: teljes biztonságot egyetlen internetes szolgáltatás sem tud ígérni. Ne tölts fel olyan képet vagy írj le olyat, aminek a nyilvánosságra kerülése kárt okozna neked."
        ),
      ],
    },
    {
      heading: "Kiskorúak",
      blocks: [
        p(
          "A szolgáltatás 16 éven aluliak számára nem áll rendelkezésre. Ha tudomásunkra jut, hogy 16 éven aluli hozott létre fiókot, azt töröljük."
        ),
      ],
    },
    {
      heading: "A színházi adatokról",
      blocks: [
        p(
          "A katalógusban szereplő előadások, időpontok, szereposztások és plakátok a színházak saját, nyilvánosan elérhető oldalairól származnak, és nem személyes adatnak szánt információk. Ha alkotóként azt szeretnéd, hogy egy rád vonatkozó adat ne szerepeljen itt, írj a fenti címre, és megnézzük."
        ),
      ],
    },
    {
      heading: "Ha ez a tájékoztató változik",
      blocks: [
        p(
          "Változás esetén frissítjük ezt az oldalt és a tetején szereplő dátumot. Lényeges változásról a fiókodban is értesítünk, mielőtt hatályba lépne."
        ),
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: "Felhasználási feltételek",
  lead: `Ezek a feltételek arról szólnak, mit vállalunk a Színház Trackerrel, és mit várunk tőled cserébe. Utoljára frissítve: ${legalLastUpdated}`,
  sections: [
    {
      heading: "Mi ez a szolgáltatás",
      blocks: [
        p(
          "A Színház Tracker egy ingyenes alkalmazás, amelyben magyar színházi előadásokat kereshetsz, és naplózhatod, mit láttál. Nincs előfizetés, és nem kérünk pénzt semmiért."
        ),
        p(
          `A szolgáltatást ${operator.name} üzemelteti. A használatával elfogadod ezeket a feltételeket.`
        ),
      ],
    },
    {
      heading: "Nem vagyunk kapcsolatban a színházakkal",
      blocks: [
        p(
          "A Színház Tracker független szolgáltatás. Nem áll kapcsolatban a benne szereplő színházakkal, nem képviseli őket, és nem árul jegyet. A „Jegyek” gomb a színház saját oldalára visz — onnantól a színház, illetve a jegyértékesítője feltételei érvényesek."
        ),
      ],
    },
    {
      heading: "A műsoradatok tájékoztató jellegűek",
      blocks: [
        p(
          "A műsort, az időpontokat, a szereposztásokat és a játszóhelyeket automatikusan gyűjtjük a színházak saját oldalairól, naponta egyszer. Ez azt jelenti, hogy az adat lehet elavult, hiányos vagy hibás — egy elmaradt előadásról vagy egy beugró szereplőről tipikusan nem értesülünk időben."
        ),
        p(
          "Mielőtt elindulsz egy előadásra, ellenőrizd az időpontot a színház saját oldalán. Az itt megjelenő adatokra alapozott döntésekért nem tudunk felelősséget vállalni."
        ),
      ],
    },
    {
      heading: "A fiókod",
      blocks: [
        ul(
          "16 éves elmúltál.",
          "Valós e-mail-címet adsz meg, és te felelsz a jelszavad biztonságáért.",
          "Egy ember egy fiókot használ; más nevében nem hozol létre fiókot.",
          "A fiókodat bármikor törölheted a Beállítások képernyőn."
        ),
      ],
    },
    {
      heading: "Amit írsz, az nyilvános",
      blocks: [
        p(
          "A naplóbejegyzéseid, az értékeléseid, a kritikáid, a nyilvánosnak jelölt listáid, a követéseid, a kedveléseid és a hozzászólásaid bárki számára láthatók — beleértve a feltöltött jegyfotókat is. Ezt nem lehet fiókszinten kikapcsolni. Amit nem szánsz nyilvánosnak, azt ne írd ide."
        ),
        p(
          "A tartalmad a tiéd marad. Azzal, hogy közzéteszed, nem kizárólagos, díjmentes engedélyt adsz nekünk arra, hogy a szolgáltatás működtetéséhez tároljuk és megjelenítsük. Ez az engedély a tartalom törlésével megszűnik."
        ),
      ],
    },
    {
      heading: "Amit nem tehetsz",
      blocks: [
        ul(
          "Nem teszel közzé jogsértő, gyűlölködő, zaklató, fenyegető vagy más személyt megalázó tartalmat.",
          "Nem teszel közzé olyan képet vagy szöveget, amire nincs jogod — ez a plakátokra és a produkciós fotókra is vonatkozik.",
          "Nem teszel közzé más ember személyes adatait a hozzájárulása nélkül.",
          "Nem írsz meg nem történt estékről naplóbejegyzést azért, hogy egy előadás értékelését mozgasd.",
          "Nem terheled automatizált eszközökkel a szolgáltatást, és nem próbálod megkerülni a hozzáférési korlátait."
        ),
        p(
          "A szabályokat sértő tartalmat eltávolíthatjuk, és súlyos vagy ismétlődő esetben a fiókot korlátozhatjuk vagy megszüntethetjük. Erről — ha ez ésszerűen lehetséges — tájékoztatunk, és a döntés ellen a kapcsolati címen kifogást emelhetsz."
        ),
      ],
    },
    {
      heading: "Bejelentés",
      blocks: [
        p(
          `Ha olyan tartalmat látsz, ami sérti ezeket a szabályokat vagy a jogaidat, jelentsd az alkalmazásban, vagy írj a ${operator.email} címre. A bejelentéseket ésszerű időn belül megvizsgáljuk.`
        ),
      ],
    },
    {
      heading: "Felelősség",
      blocks: [
        p(
          "A szolgáltatást ingyenesen, „adott állapotában” nyújtjuk. Nem garantáljuk, hogy folyamatosan elérhető lesz, hogy hibátlan, vagy hogy a katalógus teljes és pontos."
        ),
        p(
            "Nem vállalunk felelősséget azért a kárért, ami abból ered, hogy a szolgáltatás nem érhető el, hogy egy adat hibás volt, vagy hogy egy másik felhasználó mit írt. Ez a korlátozás nem érinti a szándékosan okozott, illetve az emberi életet, testi épséget vagy egészséget megkárosító szerződésszegésért való felelősséget, amelyet a jogszabály nem enged korlátozni."
        ),
      ],
    },
    {
      heading: "Ha ezek a feltételek változnak",
      blocks: [
        p(
          "A feltételeket módosíthatjuk. A lényeges változásokról a fiókodban értesítünk, mielőtt hatályba lépnének. Ha a módosítást nem fogadod el, a fiókod törlésével bármikor kiléphetsz."
        ),
      ],
    },
    {
      heading: "Alkalmazandó jog",
      blocks: [
        p(
          "A jogviszonyra a magyar jog irányadó. Fogyasztóként megillet az a védelem, amit a lakóhelyed szerinti jog kötelezően biztosít — ezt ez a pont nem korlátozza."
        ),
      ],
    },
  ],
};

export const imprint: LegalDocument = {
  title: "Impresszum",
  lead: "A szolgáltatás üzemeltetőjének adatai, az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a szerint.",
  sections: [
    {
      heading: "Az üzemeltető",
      blocks: [
        ul(
          `Név: ${operator.name}`,
          `Székhely / postacím: ${operator.address}`,
          `E-mail: ${operator.email}`,
          ...(operator.registrationNumber
            ? [`Nyilvántartási / adószám: ${operator.registrationNumber}`]
            : [])
        ),
      ],
    },
    {
      heading: "Kapcsolattartási pont",
      blocks: [
        p(
          `Felhasználói megkeresésekre, tartalombejelentésekre, adatvédelmi kérésekre és hatósági megkeresésekre egyaránt a ${operator.email} cím szolgál. A levelezés nyelve a magyar és az angol.`
        ),
      ],
    },
    {
      heading: "Tárhelyszolgáltató",
      blocks: [
        ul(
          `Név: ${hostingProvider.name}`,
          `Cím: ${hostingProvider.address}`,
          `E-mail: ${hostingProvider.email}`
        ),
      ],
    },
    {
      heading: "A megjelenített tartalomról",
      blocks: [
        p(
          "A katalógusban szereplő előadásadatok és plakátok a színházak saját, nyilvánosan elérhető oldalairól származnak, a forrás megjelölésével. A plakátok és produkciós fotók szerzői joga a jogosultakat illeti. Ha jogosultként azt szeretnéd, hogy egy tartalom kikerüljön innen, írj a fenti címre, és eltávolítjuk."
        ),
        p(
          "A felhasználók által közzétett kritikákért és hozzászólásokért az azokat közzétevő felhasználó felel."
        ),
      ],
    },
  ],
};

/** Every document, for the settings screen's links and for the tests. */
export const legalDocuments = {
  privacy: privacyPolicy,
  terms: termsOfService,
  imprint,
} as const;
