import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Share, Platform, Linking } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, overlay, space } from "@/theme/tokens";
import {
  addToWatchlist,
  getPlayById,
  getReviewsForPlay,
  getUpcomingPerformances,
  getUserById,
  getVenueById,
  isInWatchlist,
  removeFromWatchlist,
} from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import { useAtLeast } from "@/hooks/useBreakpoint";
import type { Performance, Play, Poster, Review, User, Venue } from "@/data/types";
import { IconButton, Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { ChevronLeftIcon, ListPlusIcon, ShareIcon, TicketIcon, PlusIcon } from "@/components/icons/Icons";
import { StatusInline } from "@/components/ui/StatusBadge";
import { ShowtimeList } from "@/components/ui/ShowtimeList";
import { AddToListSheet } from "@/components/ui/AddToListSheet";
import { FollowSubjectButton } from "@/components/ui/FollowSubjectButton";
import { getFriendRatings, type FriendRating } from "@/services/friendsService";
import { formatLongDate, formatShowtime } from "@/utils/datetime";
import { personSlug } from "@/utils/people";
import { strings } from "@/i18n/hu";
import { pickOwnRating } from "@/utils/ownRating";
import { closeModal } from "@/utils/navigation";
import { makeStyles } from "@/theme/styles";

/**
 * The hero honours the poster's real proportions, within limits.
 *
 * There is one image here and room to show it, so unlike the browsing grids
 * this does not force a single ratio — the catalogue is close to half
 * landscape production stills and half portrait artwork, and cropping either
 * into the other's shape loses the part worth looking at. The clamp keeps a
 * panorama from becoming a letterbox slit and a tall poster from pushing the
 * title off a phone screen entirely.
 *
 * The upper bound is tighter than it was, because the title now sits *on* the
 * image: a 16:9 still on a phone is 210pt tall, which is not enough for a
 * scrim, two lines of Bodoni and a credit line. 4:3 gives the caption room and
 * still shows most of a wide production photograph.
 */
const MIN_HERO_ASPECT = 4 / 5;
const MAX_HERO_ASPECT = 4 / 3;
const FALLBACK_HERO_ASPECT = 4 / 4.2;

/** How many lines of synopsis are shown before "Tovább". */
const SYNOPSIS_COLLAPSED_LINES = 6;

function heroAspect(poster?: Poster): number {
  if (!poster?.width || !poster?.height) return FALLBACK_HERO_ASPECT;
  return Math.min(MAX_HERO_ASPECT, Math.max(MIN_HERO_ASPECT, poster.width / poster.height));
}

export default function PlayDetailScreen() {
  const styles = useStyles();

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useAtLeast("expanded");
  const { session } = useAuth();
  const [play, setPlay] = useState<Play>();
  const [venue, setVenue] = useState<Venue>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [listSheetOpen, setListSheetOpen] = useState(false);
  const [friendRatings, setFriendRatings] = useState<FriendRating[]>([]);
  const [synopsisOpen, setSynopsisOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoadFailed(true);
      return;
    }
    getPlayById(id)
      .then((p) => {
        if (!p) {
          setLoadFailed(true);
          return;
        }
        setPlay(p);
        getVenueById(p.venueId).then(setVenue).catch(() => setVenue(undefined));
      })
      .catch(() => setLoadFailed(true));
    // An empty list on failure is the right fallback: ShowtimeList then says
    // why there is nothing to show rather than rendering a broken section.
    getUpcomingPerformances(id)
      .then(setPerformances)
      .catch(() => setPerformances([]));
  }, [id]);

  /**
   * The reviews, re-read every time this screen comes back into focus.
   *
   * On mount alone would do for a list of other people's opinions, and did
   * while that was all this was for. It will not do now that the reader's own
   * rating is drawn from the same rows: "Előadás naplózása" pushes a route,
   * so this screen stays mounted underneath it, and somebody who logs the
   * evening and comes straight back would find nothing where their rating
   * should be.
   */
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      getReviewsForPlay(id)
        .then((rows) => {
          if (active) setReviews(rows);
        })
        .catch(() => {
          if (active) setReviews([]);
        });
      return () => {
        active = false;
      };
    }, [id])
  );

  // Keyed on the session as well as the production: "the people you follow" is
  // a different answer for a different account, and the same screen is reached
  // by signing in from it.
  useEffect(() => {
    if (!id || !session) {
      setFriendRatings([]);
      return;
    }
    let active = true;
    getFriendRatings(id)
      .then((rows) => {
        if (active) setFriendRatings(rows);
      })
      .catch(() => {
        if (active) setFriendRatings([]);
      });
    return () => {
      active = false;
    };
  }, [id, session]);

  useEffect(() => {
    if (!id || !session) {
      setInWatchlist(false);
      return;
    }
    isInWatchlist(id)
      .then(setInWatchlist)
      .catch(() => setInWatchlist(false));
  }, [id, session]);

  /**
   * Which of the reader's own evenings this page quotes back at them.
   *
   * Free of a query: `getReviewsForPlay` returns every review for the
   * production with no limit, so the reader's own entries are already here.
   * The rule for choosing between several of them is in `utils/ownRating.ts`
   * with a test, because getting it wrong shows somebody last year's verdict
   * and looks entirely correct on screen.
   */
  const own = useMemo(() => pickOwnRating(reviews, session?.user?.id), [reviews, session]);
  // The ones with an opinion this reader is allowed to read. `reviews` itself
  // stays whole, because `pickOwnRating` above and the count of who has been
  // are both about attendance, which is nobody's secret.
  const readableReviews = useMemo(() => reviews.filter((r) => r.canSeeOpinion), [reviews]);
  // Whether that evening answered any of the three dimensions at all. Checked
  // for `undefined` rather than for falsiness, because 0.5 is a rating and 0 is
  // not a value anything stores.
  const hasOwnSubRatings =
    own !== undefined &&
    (own.entry.ratingActing !== undefined ||
      own.entry.ratingDirecting !== undefined ||
      own.entry.ratingSetDesign !== undefined);

  async function toggleWatchlist() {
    if (!play) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(play.id);
        setInWatchlist(false);
      } else {
        await addToWatchlist(play.id);
        setInWatchlist(true);
      }
    } catch {
      setNotice(strings.common.loadError);
    } finally {
      setWatchlistBusy(false);
    }
  }

  /**
   * Open a performer's or director's page.
   *
   * The slug is built here rather than fetched, using the same rule the
   * database applies — see `utils/people.ts` for why the two have to agree.
   * A name that slugs to nothing (a stray separator the scraper kept) has no
   * page to open, so the tap does nothing rather than navigating to /person/.
   */
  function openPerson(name: string) {
    const slug = personSlug(name);
    if (slug) router.push({ pathname: "/person/[slug]", params: { slug } });
  }

  async function openTickets(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      // A blocked pop-up or a dead scheme leaves the person on this screen with
      // no idea the tap registered, which is the one failure worth naming here.
      setNotice(strings.playDetail.ticketsFailed);
    }
  }

  async function handleShare() {
    if (!play) return;
    try {
      const url = Platform.OS === "web" ? window.location.href : undefined;
      await Share.share({ message: url ? `${play.title} — ${url}` : play.title, title: play.title });
    } catch {
      setNotice(strings.playDetail.shareFailed);
    }
  }

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <Text variant="body" tone="dim" style={{ textAlign: "center" }}>
          {strings.checkin.playNotFound}
        </Text>
        <Pressable onPress={() => closeModal(router, "/(tabs)")} accessibilityRole="button" hitSlop={8}>
          <Text variant="label" tone="accent">
            {strings.checkin.close}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!play) return null;

  const scheduling = schedulingParts(play);
  const genreLabel = play.genreNormalized ? strings.genres[play.genreNormalized] ?? play.genreNormalized : undefined;
  // What goes on the eyebrow over the poster: where, what kind, how long.
  const heroFacts = [venue?.name, genreLabel, play.runtimeMinutes != null ? formatRuntime(play.runtimeMinutes) : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        {/* The title block lives on the poster, under the scrim the feed card
            already uses. Everything on the image takes its colour from
            `overlay`, never from the palette: the scrim under it is the dark
            stage in every theme, and a printed theme's near-black text would
            vanish into it. */}
        <View style={[styles.hero, { aspectRatio: heroAspect(play.poster) }, wide && styles.heroWide]}>
          <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} height="100%" radius={0} scrim priority="high" />
          <View style={[styles.heroTop, { top: insets.top + space.lg }]}>
            <IconButton translucent onPress={() => closeModal(router, "/(tabs)")} accessibilityLabel={strings.playDetail.back}>
              <ChevronLeftIcon color={overlay.onImageHeading} />
            </IconButton>
            <IconButton translucent onPress={handleShare} accessibilityLabel={strings.playDetail.share}>
              <ShareIcon color={overlay.onImageHeading} />
            </IconButton>
          </View>
          {/* These are working photographers' production stills; the credit
              belongs with the image wherever it is shown at size. Under the
              share button rather than in the corner the caption now owns. */}
          {!!play.poster?.credit && (
            <Text variant="caption" style={[styles.posterCredit, { top: insets.top + space.lg + 44 }]}>
              {play.poster.credit}
            </Text>
          )}
          {/* Pinned to the bottom edge, then centred to the same reading
              column the text below uses, so the title on the image and the
              paragraphs under it share a left edge on a wide screen. */}
          <View style={[styles.heroCaptionWrap, { pointerEvents: "box-none" }]}>
          <ContentColumn style={styles.heroCaption}>
            {!!heroFacts && (
              <Text variant="eyebrow" numberOfLines={1} style={{ color: overlay.onImageAccent }}>
                {heroFacts}
              </Text>
            )}
            <Text variant="display" style={{ color: overlay.onImageHeading }}>
              {play.title}
            </Text>
            {/* The director's name is a link; the author's is not. That is not
                an oversight — `play_cast` and `plays.director` are what a
                person page is built from, and nothing in the catalogue indexes
                the playwright, so a Shakespeare link would open an empty page.
                The credit line stays one sentence either way. */}
            {(!!play.author || !!play.director) && (
              <Text variant="bodySmall" style={{ color: overlay.onImageText }}>
                {play.author}
                {!!play.author && !!play.director && " · "}
                {!!play.director && (
                  <>
                    {"rend. "}
                    <Text
                      variant="bodySmall"
                      accessibilityRole="link"
                      onPress={() => openPerson(play.director)}
                      style={{ color: overlay.onImageAccent, fontWeight: "600" }}
                    >
                      {play.director}
                    </Text>
                  </>
                )}
              </Text>
            )}
          </ContentColumn>
          </View>
        </View>

        <ContentColumn style={{ paddingHorizontal: gutter, gap: space["2xl"], marginTop: space.lg }}>
          <View style={{ gap: space.sm }}>
            {/* One line: is it on, and when next. The badge used to be a pill
                on its own row with the date in dim text underneath; as a
                sentence the two facts read together, which is how they are
                asked. */}
            <Text variant="bodySmall" tone="dim">
              <StatusInline status={play.status} />
              {!!scheduling && (
                <>
                  {play.status !== "unknown" && " · "}
                  {scheduling.label}
                  {": "}
                  <Text variant="bodySmall">{scheduling.value}</Text>
                </>
              )}
            </Text>

            {/* Why the badge says what it says — in Hungarian, and only when
                it is not already said above. `plays.status_reason` is written
                by `recompute_play_status()` in English for whoever is reading
                the database, so the note is derived here from the same facts
                and returns nothing in the cases the line above has covered. */}
            {!!statusNote(play) && (
              <Text variant="caption" tone="faint">
                {statusNote(play)}
              </Text>
            )}

            {play.isArchived && (
              <Text variant="caption" tone="faint">
                {strings.playDetail.archivedNote}
              </Text>
            )}

            {play.isFestival && !!play.festivalName && (
              <Text variant="caption" tone="faint">
                {play.festivalName}
              </Text>
            )}
          </View>

          {/* One filled gold control, and the two toggles that already have a
              home beside it as icons. "Felvétel egy listára" used to be a
              second full-width bar, and the venue follow a third — three
              stacked bars, two of them gold, before the showtimes. */}
          <View style={styles.actions}>
            <Button
              label={strings.playDetail.logButton}
              icon={<PlusIcon size={16} />}
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: "/checkin", params: { playId: play.id } })}
            />
            <IconButton
              onPress={toggleWatchlist}
              active={inWatchlist}
              disabled={watchlistBusy}
              accessibilityLabel={inWatchlist ? strings.playDetail.removeFromWatchlist : strings.playDetail.addToWatchlist}
            >
              <TicketIcon size={18} color={inWatchlist ? colors.onAccent : colors.text} />
            </IconButton>
            {/* Separate from the watchlist on purpose. The watchlist answers
                "am I going to this", which is one question with one answer; a
                list answers "what does this belong with", which is open-ended
                and can be several at once. */}
            <IconButton
              onPress={() => (session ? setListSheetOpen(true) : router.push("/sign-in"))}
              accessibilityLabel={strings.playDetail.addToList}
            >
              <ListPlusIcon size={18} color={colors.text} />
            </IconButton>
          </View>

          <AddToListSheet
            playId={play.id}
            visible={listSheetOpen}
            onClose={() => setListSheetOpen(false)}
            onCreateList={() => {
              setListSheetOpen(false);
              router.push("/lists");
            }}
          />

          {!!notice && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
              {notice}
            </Text>
          )}

          {/* What the public average used to be.

              The average, the three per-dimension bars and the distribution
              chart under them all came off together: with the platform this
              early, an average two people wide has the authority of a figure
              and none of the evidence, and the chart spent a third of the
              screen saying the same thing in bars. The column is still
              maintained in the database — see the README — so this comes back
              as a component when there are enough people to mean something.

              What stands here instead is the one rating on this screen that is
              not a claim about a crowd: yours. Absent for a signed-out reader
              and for anybody who has not rated the production, rather than
              drawn empty — the block it replaced used to render a bold gold
              "0.0" that read as a terrible score rather than as no answer.

              The three per-dimension bars are back, and they are the other
              half of the same rule. They came off because check-in seeded them
              and saved them whether or not the person touched those rows, so
              drawing them would have handed somebody a "Rendezés 3.0" they
              never chose. Since a4c777d the form leaves them unset unless they
              are answered, and null means "did not answer" all the way to the
              screen — so what is drawn here is now what this person said, the
              same as the figure beside it, and never a number filled in for
              them. They are their own scores and not an average, which is why
              they belong on this side of the line the block draws. */}
          {own && (
            <View style={{ gap: space.sm }}>
              <SectionHeader
                title={strings.playDetail.yourRatingTitle}
                action={own.entries > 1 ? strings.playDetail.yourRatingEntries(own.entries) : strings.playDetail.yourRatingOpen}
                onAction={() => router.push({ pathname: "/entry/[id]", params: { id: own.entry.id } })}
              />
              {/* On hairlines rather than in a box: a card here made the rating
                  the heaviest object on the screen, above the title. */}
              <View style={styles.ratingBlock}>
                <View style={styles.ratingSummary}>
                  <Text variant="display" tone="accent">{own.rating.toFixed(1)}</Text>
                  <MaskRatingRow rating={own.rating} size={12} gap={2} />
                </View>
                <View style={{ flex: 1, gap: space.md }}>
                  {/* Dropped entirely when they answered none of the three,
                      which is now the ordinary case for a quick check-in. A
                      column of three dashes is not information, and it would
                      make an entry that said one honest thing look like one
                      that failed to say four. */}
                  {hasOwnSubRatings && (
                    <View style={{ gap: space.md }}>
                      <RatingBar label={strings.playDetail.acting} value={own.entry.ratingActing} />
                      <RatingBar label={strings.playDetail.directing} value={own.entry.ratingDirecting} />
                      <RatingBar label={strings.playDetail.setDesign} value={own.entry.ratingSetDesign} />
                    </View>
                  )}
                  <Text variant="caption" tone="faint">
                    {own.entry.seenAt
                      ? strings.playDetail.yourRatingSeen(formatLongDate(`${own.entry.seenAt}T12:00:00Z`))
                      : strings.playDetail.yourRatingUndated}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Above the synopsis and the showtimes, below the ratings: this is
              the one opinion on the screen that is about people the reader
              actually chose, and burying it under the cast list would put it
              below every stranger's average. Hidden entirely when nobody you
              follow has been — an empty "your friends" block is a reminder that
              you have none, which is not what a listing is for. */}
          {friendRatings.length > 0 && (
            <View style={{ gap: space.sm }}>
              <SectionHeader
                eyebrow={strings.playDetail.followingEyebrow}
                title={strings.friends.playHeading}
                action={strings.friends.seenBy(friendRatings.length)}
              />
              {friendRatings.map((f) => (
                <Pressable
                  key={f.userId}
                  onPress={() => router.push(`/user/${f.userId}`)}
                  style={styles.personRow}
                  accessibilityRole="button"
                  accessibilityLabel={f.name}
                >
                  <Avatar uri={f.avatarUrl} initials={f.initials} size={34} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" numberOfLines={1}>{f.name}</Text>
                    {!!f.seenAt && (
                      <Text variant="caption" tone="faint">
                        {formatLongDate(`${f.seenAt}T12:00:00Z`)}
                      </Text>
                    )}
                  </View>
                  {f.rating !== undefined ? (
                    <MaskRatingRow rating={f.rating} size={13} />
                  ) : (
                    <Text variant="caption" tone="faint">{strings.friends.unrated}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Where somebody who has just decided to go actually needs to end
              up. Every adapter fetches this page and used to discard the
              address; the link sits on the showtimes' baseline because that is
              where the decision is made. Absent for hand-added plays and for
              Örkény, whose API publishes no slug to build a route from. */}
          <ShowtimeList
            performances={performances}
            play={play}
            action={play.sourceUrl ? strings.playDetail.ticketsShort : undefined}
            onAction={play.sourceUrl ? () => openTickets(play.sourceUrl!) : undefined}
          />

          {/* The theatre, not the production. This is the one place in the app
              a house can be subscribed to, and it belongs here rather than on
              a venue page of its own: there is no such screen, and the moment
              somebody wants "more like this" is while they are looking at one
              of its productions. A row with a small pill — a follow is a
              secondary commitment and reads as one. */}
          {!!venue && (
            <View style={styles.venueRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="eyebrow" tone="faint">{strings.playDetail.venueEyebrow}</Text>
                <Text variant="subheading" numberOfLines={2}>{venue.name}</Text>
              </View>
              <FollowSubjectButton type="venue" subjectKey={venue.id} showHint={false} compact />
            </View>
          )}

          {!!play.synopsis && (
            <View style={{ gap: space.sm }}>
              <SectionHeader title={strings.playDetail.aboutHeading} />
              <Text variant="body" tone="dim" numberOfLines={synopsisOpen ? undefined : SYNOPSIS_COLLAPSED_LINES}>
                {play.synopsis}
              </Text>
              {play.synopsis.length > 420 && (
                <Pressable onPress={() => setSynopsisOpen((s) => !s)} hitSlop={8} accessibilityRole="button">
                  <Text variant="label" tone="accent">
                    {synopsisOpen ? strings.playDetail.readLess : strings.playDetail.readMore}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* A list rather than a strip of circles: at 64pt a role like
              "Zoltán, a narrátor" was cut after one word, and the strip hid
              everyone past the fourth name. A cast list exists to provoke
              "what else is she in", so every row opens the person page. */}
          {play.cast.length > 0 && (
            <View>
              <SectionHeader
                eyebrow={strings.playDetail.castCount(play.cast.length)}
                title={strings.playDetail.castCrew}
                style={{ marginBottom: space.xs }}
              />
              {play.cast.map((c, i) => (
                // Keyed by index: the same performer legitimately appears
                // twice when they cover two roles in one production.
                <Pressable
                  key={`${c.name}-${i}`}
                  style={styles.castRow}
                  onPress={() => openPerson(c.name)}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                >
                  <Avatar initials={initialsOf(c.name)} size={34} serif />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="label" numberOfLines={1}>{c.name}</Text>
                    {!!c.role && (
                      <Text variant="caption" tone="faint" numberOfLines={2}>
                        {c.role}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Yours and the people you follow, and nobody else — see 0041.
              A stranger's entry arrives with its rating and its note already
              emptied by the database, so listing it would put a name over a
              blank and invite the reader to wonder what was wrong with it.
              The count follows the list rather than the query for the same
              reason: a heading promising eight opinions above two of them is
              the sort of number that is technically true and reads as a bug. */}
          <View style={{ gap: space.md }}>
            <SectionHeader title={strings.playDetail.fromFollowing} action={strings.playDetail.reviewsCount(readableReviews.length)} />
            {readableReviews.length === 0 ? (
              <Text variant="bodySmall" tone="faint">
                {strings.playDetail.noReviewsYet}
              </Text>
            ) : (
              readableReviews.map((r) => <ReviewRow key={r.id} review={r} />)
            )}
          </View>
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

/**
 * The one line a reader actually wants under the title: when can I see this,
 * or when was the last chance. Split into a label and a value so the date can
 * be set a shade brighter than the words around it. Silence rather than filler
 * when neither date is known.
 */
function schedulingParts(play: Play): { label: string; value: string } | undefined {
  if (play.nextPerformanceAt) {
    return { label: strings.status.nextPerformance, value: formatShowtime(play.nextPerformanceAt) };
  }
  if (play.lastPerformanceAt) {
    return { label: strings.status.lastPerformance, value: formatLongDate(play.lastPerformanceAt) };
  }
  return undefined;
}

/**
 * The sentence under the badge, when there is one worth adding.
 *
 * Derived from the play rather than from `plays.status_reason`, which is
 * written in English for whoever is reading the database and duplicates what
 * the line above already says. Each branch answers a question the rest of the
 * block leaves open, and every other case returns nothing rather than repeating
 * itself in a fainter colour.
 */
function statusNote(play: Play): string {
  // The archive note below already says this, at length.
  if (play.isArchived) return "";

  switch (play.status) {
    case "dormant":
      // The one case with nothing else on screen: the scheduling line is
      // silent for a dormant production with no dates at all, so the badge
      // would be the only thing saying anything.
      return strings.playDetail.dormantNote;
    case "announced":
      // The premiere date appears nowhere else on this screen, and "when does
      // it open" is the whole question a pre-premiere listing raises.
      return play.premiereDate
        ? strings.playDetail.premiereNote(formatLongDate(`${play.premiereDate}T12:00:00Z`))
        : "";
    case "running":
      // "Running" with no dates at all is the same situation as dormant from
      // the reader's side, and the status line above has nothing to say.
      return play.nextPerformanceAt || play.lastPerformanceAt ? "" : strings.status.noUpcoming;
    // `ended` is fully covered by the scheduling line above — the last one.
    default:
      return "";
  }
}

/** Cast avatars were empty circles; initials at least identify the performer. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ${strings.playDetail.minutes}`;
  if (!rest) return `${hours} ${strings.playDetail.hours}`;
  return `${hours} ${strings.playDetail.hours} ${rest} ${strings.playDetail.minutes}`;
}

/**
 * One dimension of a rating, as a label, a bar and a figure.
 *
 * Restored from before 08e9bb0, which took it off with the public averages,
 * and narrower than it was: it drew an average then and draws one person's
 * answer now, so the only reason left to mute a row is that the question was
 * not answered. That is `undefined` and not a number, which is why the old
 * separate `muted` flag is gone — there is nothing else it could have meant.
 *
 * An unanswered dimension prints the same dash the check-in form shows for an
 * untouched row, never a 0.0. A gold figure reading zero is a verdict, and the
 * whole point of the change that made these nullable is that not answering is
 * not a verdict.
 */
function RatingBar({ label, value }: { label: string; value?: number }) {
  const styles = useStyles();

  const pct = value === undefined ? 0 : Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <View style={styles.bar}>
      <Text variant="caption" tone="dim" style={styles.barLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text variant="label" tone={value === undefined ? "faint" : "default"} style={styles.barValue}>
        {value === undefined ? strings.common.noRating : value.toFixed(1)}
      </Text>
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const styles = useStyles();

  const [user, setUser] = useState<User>();
  useEffect(() => {
    getUserById(review.userId)
      .then(setUser)
      .catch(() => setUser(undefined));
  }, [review]);
  if (!user) return null;

  return (
    <View style={styles.reviewRow}>
      <Avatar uri={user.avatarUrl} initials={user.initials} size={32} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="label">{user.name}</Text>
        {review.ratingOverall !== undefined && <MaskRatingRow rating={review.ratingOverall} size={11} gap={2} />}
        {!!review.text && (
          <Text variant="bodySmall" tone="dim">{`„${review.text}”`}</Text>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: {
    width: "100%",
    backgroundColor: colors.surface2,
    justifyContent: "flex-end",
  },
  // On a desktop the image spans the window, so its height is what needs
  // bounding rather than its ratio; `cover` in PosterPlaceholder crops the
  // sides of a portrait poster, which is the lesser loss on a wide screen.
  heroWide: { maxHeight: 500 },
  heroTop: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  posterCredit: {
    position: "absolute",
    right: space.lg,
    color: overlay.onImageText,
  },
  heroCaptionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  heroCaption: {
    paddingHorizontal: gutter,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  actions: { flexDirection: "row", alignItems: "stretch", gap: space.sm },
  ratingBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xl,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  ratingSummary: { alignItems: "center", gap: space.xs, width: 96 },
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm },
  barLabel: { width: 84 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface2, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.gold },
  barValue: { width: 28, textAlign: "right" },


  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  castRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  reviewRow: { flexDirection: "row", gap: space.md },

  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: gutter,
  },
}));
