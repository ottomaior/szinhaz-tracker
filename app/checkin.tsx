import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import {
  countUserEntriesForPlay,
  findBlankEntryForPlay,
  getPerformancesOnDay,
  getPlayById,
  getReviewById,
  getVenueById,
  submitReview,
  updateReview,
} from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import { useAuth } from "@/contexts/AuthContext";
import type { Performance, Play, Review, SeenCastMember, Venue } from "@/data/types";
import { parseTicketPrice } from "@/utils/money";
import { personSlug } from "@/utils/people";
import { foldSearchTerm } from "@/utils/search";
import { PinIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { DateField } from "@/components/ui/DateField";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { SearchField } from "@/components/ui/SearchField";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { strings } from "@/i18n/hu";
import { formatTime, todayInBudapest } from "@/utils/datetime";
import { closeModal } from "@/utils/navigation";
import { makeStyles } from "@/theme/styles";

const MOMENT_TAGS = [strings.checkin.tagStandingOvation, strings.checkin.tagCried, strings.checkin.tagRecommend];

export default function CheckInScreen() {
  const styles = useStyles();

  // `reviewId` puts the form in edit mode. One screen rather than two, because
  // logging an evening and correcting one you logged are the same set of
  // questions — and a second screen asking them slightly differently is how the
  // two drift.
  const { playId, reviewId } = useLocalSearchParams<{ playId?: string; reviewId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const { session, loading } = useAuth();
  const [play, setPlay] = useState<Play>();
  const [venue, setVenue] = useState<Venue>();
  const [saving, setSaving] = useState(false);
  const [playLoadFailed, setPlayLoadFailed] = useState(false);
  const [error, setError] = useState<string>();

  // The entry being written to. Set from the route in edit mode, and set on its
  // own when the chosen production already has a blank entry from onboarding —
  // see `adoptBlankEntry` below.
  const [editingId, setEditingId] = useState<string | undefined>(reviewId);
  // Whether that id was adopted rather than asked for, which is the only case
  // the screen has to explain itself in.
  const [adoptedBlank, setAdoptedBlank] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // The evening being logged. A new check-in starts at today, which is what
  // most of them are, and it is a real value the user can move rather than the
  // wall clock this screen used to print into a field nobody could edit.
  //
  // Undefined is "no date" — the state onboarding writes, and one the field
  // can now show and keep. It used to be unrepresentable here: an undated entry
  // opened with today already in the chip, and saving a rating on it turned
  // "I don't remember" into "tonight" without anyone choosing that (T-044).
  const [seenAt, setSeenAt] = useState<string | undefined>(todayInBudapest);
  const [showtimes, setShowtimes] = useState<Performance[]>([]);
  const [performanceId, setPerformanceId] = useState<string>();
  const [priorCount, setPriorCount] = useState(0);

  // All four unset until tapped, and saved as null if they stay that way.
  //
  // The form used to open at 4 / 4 / 3 / 4, so somebody who wrote a paragraph
  // and never touched the masks still filed four opinions they never gave —
  // and those went into the production's public averages. All four columns are
  // nullable (`rating_acting` and the two beside it since 0001, `rating_overall`
  // since 0026) precisely so that "did not answer" has somewhere to go; it just
  // was not being used.
  //
  // A null overall is a shape the rest of the app was already built for: 0026's
  // `play_rating_histogram` drops those people with `having ... is not null`,
  // and `rating_count` counts only the ones who gave a score, so an unrated
  // entry neither moves the average nor pads the tally.
  const [overall, setOverall] = useState<number | undefined>(undefined);
  const [acting, setActing] = useState<number | undefined>(undefined);
  const [directing, setDirecting] = useState<number | undefined>(undefined);
  const [setDesign, setSetDesign] = useState<number | undefined>(undefined);
  // Nothing ticked to begin with. The form used to open with "Állótapsot
  // kapott" already on, which is a claim about the evening, and one somebody
  // had to notice and untick to avoid making. The same reason the four ratings
  // now start unset: a check-in should say what the person said.
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState("");

  /**
   * The evening itself — see 0028: who was on, where you sat, what it cost, the
   * ticket. **This form no longer asks any of it**, and holds it only so that
   * editing an entry does not throw away what the entry already has.
   *
   * The four questions came off in one go. Nobody was going to name the cast
   * from memory; a seat number and a price are a receipt rather than a memory;
   * and a photograph is the wrong thing to ask for in a dark auditorium where
   * shooting is usually forbidden, while a ticket is a private document with
   * your name and booking code on it. They can come back if people ask for
   * them, which is why nothing about them is deleted here — not the columns,
   * not the services, not the copy in i18n, and above all not anybody's rows.
   *
   * So this state is now a round trip and nothing more: `applyEntry` fills it
   * from the entry being edited and `handleSave` writes the same values back.
   * `updateReview` writes every one of these columns unconditionally, so
   * dropping them from the form's state instead would quietly null a seat, a
   * price, a ticket and a cast list the moment somebody edited an old entry to
   * fix a typo. The entry screen still shows all four, so that loss would be
   * visible and unexplainable.
   *
   * Ticked cast is held as a set of slugs rather than of names, so that the
   * ticked "Máthé Zsolt m.v." and a typed-in "Máthé Zsolt" cannot both end up
   * on the same night as two people. `person_slug()` in the database folds them
   * the same way.
   */
  const [seenSlugs, setSeenSlugs] = useState<Set<string>>(new Set());
  const [alternates, setAlternates] = useState<SeenCastMember[]>([]);
  const [seat, setSeat] = useState("");
  const [price, setPrice] = useState("");
  const [stubPath, setStubPath] = useState<string>();

  useEffect(() => {
    if (!loading && !session) {
      router.replace({ pathname: "/sign-in" });
    }
  }, [loading, session, router]);

  /**
   * Edit mode: load the entry and the production it belongs to, and put the
   * form where the person left it.
   *
   * Guarded by `prefilled` rather than by the effect's deps alone, because the
   * fields below are the same state the user is now typing into — re-running
   * this would throw their edits away mid-sentence.
   */
  useEffect(() => {
    if (!reviewId || prefilled || !session) return;
    let active = true;
    getReviewById(reviewId)
      .then(async (review) => {
        if (!active || !review) {
          if (active) setPlayLoadFailed(true);
          return;
        }
        const found = await getPlayById(review.playId);
        if (!active) return;
        if (!found) {
          setPlayLoadFailed(true);
          return;
        }
        setPlay(found);
        applyEntry(review, found);
        setPrefilled(true);
      })
      .catch(() => {
        if (active) setPlayLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [reviewId, prefilled, session]);

  /**
   * Fills the form from an existing entry.
   *
   * Shared by edit mode and by the blank-entry adoption below, so the two put
   * the same review on screen the same way.
   */
  function applyEntry(review: Review, forPlay: Play) {
    // Whatever the entry holds, including nothing. Not `if (review.seenAt)`:
    // that guard left the fresh-form default of today standing for an undated
    // entry, which is exactly the claim the person never made.
    setSeenAt(review.seenAt);
    setPerformanceId(review.performanceId);
    // Checked for `undefined` and not for falsiness: a real rating is never 0.
    //
    // An entry written before the ratings became optional carries the 4/4/3/4
    // the form used to invent, and this puts those numbers back on screen
    // rather than clearing them. They are already stored and already counted in
    // the production's averages; dropping them because somebody opened the
    // entry to fix a typo would be deleting an answer they never asked to
    // delete, and the app cannot tell an invented 4 from one they meant. The
    // save writes whatever is on screen, so old numbers survive an edit and new
    // entries start from nothing — and somebody who does want the invented ones
    // gone can now tap them off, which is what the hint under the masks is for.
    if (review.ratingOverall !== undefined) setOverall(review.ratingOverall);
    if (review.ratingActing !== undefined) setActing(review.ratingActing);
    if (review.ratingDirecting !== undefined) setDirecting(review.ratingDirecting);
    if (review.ratingSetDesign !== undefined) setSetDesign(review.ratingSetDesign);
    setSelectedTags(review.tags);
    setReviewText(review.text);
    // Read back and written out again untouched: the form stopped asking these
    // four, and an edit must not be the thing that erases them. See the state
    // declarations above.
    setSeat(review.seat ?? "");
    setPrice(review.priceHuf !== undefined ? String(review.priceHuf) : "");
    setStubPath(review.stubPath);

    // The cast splits back into ticked and typed the way the form holds it.
    const published = new Map(
      (forPlay.cast ?? []).map((m) => [personSlug(m.name), m.name] as const)
    );
    const ticked = new Set<string>();
    const typed: SeenCastMember[] = [];
    for (const member of review.castSeen ?? []) {
      const slug = personSlug(member.name);
      if (!member.isAlternate && slug && published.has(slug)) ticked.add(slug);
      else typed.push(member);
    }
    setSeenSlugs(ticked);
    setAlternates(typed);
  }

  useEffect(() => {
    // No playId means the user opened this straight from the tab bar plus
    // button rather than from a play, so they pick the production below
    // instead of hitting a dead end.
    if (!playId) return;
    getPlayById(playId)
      .then((p) => {
        if (!p) {
          setPlayLoadFailed(true);
          return;
        }
        setPlay(p);
      })
      .catch(() => setPlayLoadFailed(true));
  }, [playId]);

  useEffect(() => {
    if (!play) {
      setVenue(undefined);
      return;
    }
    getVenueById(play.venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [play]);

  // Whether this is a return visit, read from what is already logged rather
  // than asked. Purely for the line shown above the ratings — the flag itself
  // is decided server-side in submitReview, so a stale count here cannot write
  // the wrong thing.
  useEffect(() => {
    if (!play) {
      setPriorCount(0);
      return;
    }
    let active = true;
    countUserEntriesForPlay(play.id)
      .then((n) => {
        if (active) setPriorCount(n);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [play]);

  /**
   * Adopt the blank entry onboarding left for this production, if there is one.
   *
   * Ticking something in the first-run flow writes a real diary row with no
   * date and no rating — "seen it, cannot say when". Logging that same
   * production properly then inserted a *second* row, so the diary and the feed
   * showed it twice and neither copy could be corrected. Filling the blank one
   * in is what the person meant.
   *
   * Not applied in edit mode, where the entry to write is already decided, and
   * not applied to a real entry: seeing a production twice is ordinary here and
   * `is_rewatch` exists for it. Only the placeholder is adopted.
   */
  useEffect(() => {
    if (!play || reviewId || !session) return;
    let active = true;
    findBlankEntryForPlay(play.id)
      .then((blank) => {
        if (!active || !blank) return;
        setEditingId(blank.id);
        setAdoptedBlank(true);
        applyEntry(blank, play);
        // The blank has no date, but the person just pressed "log a
        // performance": this is a fresh check-in filling an old placeholder,
        // and it opens where a fresh check-in opens — today, movable. Editing
        // that same entry from the diary keeps its "no date" instead.
        setSeenAt(todayInBudapest());
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [play, reviewId, session]);

  // Which of that day's showtimes it was. Asked about only when the catalogue
  // holds more than one — a production usually plays once on a given evening,
  // and a question with a single possible answer is a question not worth asking.
  useEffect(() => {
    if (!play || !seenAt) {
      setShowtimes([]);
      setPerformanceId(undefined);
      return;
    }
    let active = true;
    getPerformancesOnDay(play.id, seenAt)
      .then((found) => {
        if (!active) return;
        setShowtimes(found);
        // Preselect nothing when there is a choice to make: guessing the
        // evening show would be right most nights and silently wrong on the
        // matinees, which is the only case this control exists for.
        setPerformanceId(found.length === 1 ? found[0].id : undefined);
      })
      .catch(() => {
        if (!active) return;
        setShowtimes([]);
        setPerformanceId(undefined);
      });
    return () => {
      active = false;
    };
  }, [play, seenAt]);

  function toggleTag(tag: string) {
    setSelectedTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  }

  // The production's published cast, deduplicated by slug. `play_cast` credits
  // a person once per role, so somebody who both acts and adapts appears twice
  // — two entries for one human being, and a night that would record them twice.
  //
  // No longer a list to pick from; it is how a slug held in `seenSlugs` becomes
  // the name and role a write needs, for the ticked cast of an entry that was
  // filled in while the form still asked.
  const castOptions = useMemo(() => {
    const bySlug = new Map<string, { name: string; role?: string }>();
    for (const member of play?.cast ?? []) {
      const slug = personSlug(member.name);
      if (!slug) continue;
      const existing = bySlug.get(slug);
      if (!existing) {
        bySlug.set(slug, { name: member.name, role: member.role || undefined });
      } else if (!existing.role && member.role) {
        existing.role = member.role;
      }
    }
    return [...bySlug.entries()].map(([slug, m]) => ({ slug, ...m }));
  }, [play]);

  async function handleSave() {
    if (!play || saving) return;

    // Parsed before anything is written, and refused rather than guessed at —
    // see `utils/money.ts`, which is where the separator handling and the
    // difference between "free" and "not recorded" are pinned down.
    const parsedPrice = parseTicketPrice(price);
    if (parsedPrice.kind === "invalid") {
      setError(strings.checkin.priceInvalid);
      return;
    }
    const priceHuf = parsedPrice.kind === "value" ? parsedPrice.huf : undefined;

    // The calendar refuses tomorrow, but "today" includes tonight, and at
    // half past ten in the morning tonight's 18:00 has not happened yet. An
    // entry for it would be a claim about an evening nobody has had, and the
    // feed would publish it at once (T-064). Refused only when the catalogue
    // actually knows the curtain time — with no showtime on record there is
    // nothing to measure against, and the person is trusted.
    const chosen = showtimes.find((p) => p.id === performanceId);
    if (chosen && new Date(chosen.startsAt).getTime() > Date.now()) {
      setError(strings.checkin.notYetStarted(formatTime(chosen.startsAt)));
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      const entry = {
        seenAt,
        performanceId,
        // Undefined for any of the four they left alone; `submitReview` and
        // `updateReview` both write `?? null`, so an unanswered question is
        // stored as null and left out of the production's averages rather than
        // counted as a number nobody gave.
        ratingOverall: overall,
        ratingActing: acting,
        ratingDirecting: directing,
        ratingSetDesign: setDesign,
        text: reviewText.trim(),
        tags: selectedTags,
        // Empty on a new entry, because the form no longer asks; on an edit,
        // whatever the entry already had, handed straight back. These four
        // columns are written on every update, so passing nothing would delete
        // them — see the state declarations.
        seat,
        priceHuf,
        stubPath,
        castSeen: [
          ...castOptions
            .filter((c) => seenSlugs.has(c.slug))
            .map((c): SeenCastMember => ({ name: c.name, role: c.role, isAlternate: false })),
          ...alternates,
        ],
      };

      // One form, two writes. `editingId` is set in edit mode and when a blank
      // onboarding entry was adopted; in both cases there is already a row for
      // this evening and inserting a second is the bug, not the feature.
      if (editingId) await updateReview(editingId, entry);
      else await submitReview({ playId: play.id, ...entry });

      // Back to where the entry lives rather than wherever the modal was opened
      // from: somebody who has just corrected an entry wants to see it, and the
      // diary is where they will look.
      closeModal(router, editingId ? "/(tabs)/profile" : undefined);
    } catch (e) {
      // Without this catch the failed insert became an unhandled rejection and
      // the screen just sat there, making Save look like it did nothing.
      setError(e instanceof Error ? e.message : strings.checkin.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!session) return null;

  if (playLoadFailed) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text variant="body" tone="dim" style={{ textAlign: "center" }}>
          {strings.checkin.playNotFound}
        </Text>
        <Pressable onPress={() => closeModal(router)} accessibilityRole="button">
          <Text variant="label" tone="accent">{strings.checkin.close}</Text>
        </Pressable>
      </View>
    );
  }

  if (!play) {
    return <PlayPicker insetTop={insets.top} onCancel={() => closeModal(router)} onPick={setPlay} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader
        title={editingId ? strings.checkin.editTitle : strings.checkin.headerTitle}
        action={
          <Pressable
            onPress={handleSave}
            hitSlop={12}
            disabled={saving}
            accessibilityRole="button"
            aria-busy={saving}
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            <Text variant="label" tone="accent" style={{ opacity: saving ? 0.55 : 1 }}>
              {saving ? strings.checkin.saving : strings.checkin.save}
            </Text>
          </Pressable>
        }
      />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn style={{ padding: gutter, gap: space.xl, paddingBottom: space["4xl"] }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} width={44} height={66} radius={radius.sm} preferThumb />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">{play.title}</Text>
            <Text variant="caption" tone="faint">{venue?.name ?? ""}</Text>
            {!playId && (
              <Pressable onPress={() => setPlay(undefined)} hitSlop={6} accessibilityRole="button">
                <Text variant="caption" tone="accent" style={{ marginTop: 4 }}>
                  {strings.checkin.changePlay}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* When and where.
            The date used to be `new Date()` printed into a box with no press
            handler — so the one field that decides where an entry lands in the
            diary was both wrong for anything but tonight and impossible to
            correct. Half the catalogue is the theatres' own archives, kept
            loggable precisely so somebody can record a production they saw
            years ago. */}
        <View style={{ gap: 10 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.dateLabel}</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <DateField value={seenAt} onChange={setSeenAt} />
            <View style={[styles.field, { flex: 1, minWidth: 140 }]}>
              <PinIcon />
              {/* This was hardcoded to a single stage name for every play, no
                  matter where it actually runs. It shows the real venue now. */}
              <Text numberOfLines={1} variant="bodySmall" style={{ flex: 1 }}>
                {venue?.name ?? strings.common.noRating}
              </Text>
            </View>
          </View>

          {/* Said out loud, because the screen is quietly doing something other
              than what the button that opened it implied: this is not a new
              entry, it is the one already sitting in the diary with no date on
              it. Filling it in silently would leave somebody wondering why
              their diary did not grow. */}
          {adoptedBlank && (
            <Text variant="caption" tone="accent">{strings.checkin.completingBlank}</Text>
          )}

          {/* The rewatch line counts other entries, so it does not fire for the
              blank one this form has adopted. */}
          {!adoptedBlank && priorCount > (editingId ? 1 : 0) && (
            <Text variant="caption" tone="accent">
              {strings.checkin.rewatchNotice(priorCount - (editingId ? 1 : 0))}
            </Text>
          )}

          {showtimes.length > 1 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text variant="caption" tone="faint">{strings.checkin.whichShowtime}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {showtimes.map((p) => (
                  <Chip
                    key={p.id}
                    label={[formatTime(p.startsAt), p.room].filter(Boolean).join(" · ")}
                    active={performanceId === p.id}
                    // Tapping the chosen one again clears it: the two showings
                    // are indistinguishable in memory often enough that "I am
                    // not sure" has to stay reachable.
                    onPress={() => setPerformanceId((cur) => (cur === p.id ? undefined : p.id))}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.ratingCard}>
          <View style={styles.overallBlock}>
            <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.overallRating}</Text>
            <MaskRatingRow rating={overall} size={26} gap={6} onPressMask={setOverall} />
            {/* A readout rather than a dash, and always on screen. The sub-rows
                below can hang their "not answered" cue off the label, but this
                block is centred and stacked, so anything that appears and
                disappears here shoves the three rows under it up and down on
                the first tap. One line that always says something holds the
                height still and gives the score a figure to be read as. */}
            <Text variant="caption" tone="faint">
              {overall === undefined ? strings.common.notRated : `${overall}/5`}
            </Text>
          </View>

          <SubRatingRow label={strings.checkin.acting} value={acting} onChange={setActing} />
          <SubRatingRow label={strings.checkin.directing} value={directing} onChange={setDirecting} />
          <SubRatingRow label={strings.checkin.setAndCostume} value={setDesign} onChange={setSetDesign} />

          {/* Nothing on a filled mask suggests it can be tapped off again, and
              a rating given by accident is otherwise permanent — you can move
              it, but not take it back. Said once for all four rows. */}
          <Text variant="caption" tone="faint">{strings.checkin.clearRatingHint}</Text>
        </View>

        {/* Four questions came off here: who was on, where you sat, what it
            cost, and a photograph of the ticket. Removed from the form only —
            the columns, the services and the copy all stand, and an entry that
            answered them still shows all four on the entry screen and still
            keeps them through an edit.

            Nobody was going to name a cast from memory, a seat number and a
            price are a receipt rather than a memory, and a photograph is the
            wrong thing to ask for in a dark auditorium where shooting is
            usually forbidden — while a ticket carries your name and booking
            code, which is not what somebody uploading to a public diary means
            to publish. If people ask for any of them, they come back. */}

        <View style={{ gap: 8 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.momentTags}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {MOMENT_TAGS.map((tag) => (
              <Chip key={tag} label={tag} active={selectedTags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.reviewLabel}</Text>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder={strings.checkin.reviewPlaceholder}
            placeholderTextColor={colors.textFaint}
            multiline
            style={[styles.textArea, { fontFamily: bodyFont(fontsLoaded) }]}
          />
        </View>

        {error && (
          <Text variant="bodySmall" tone="accent" accessibilityRole="alert">
            {error}
          </Text>
        )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

/**
 * Shown when check-in is opened from the tab bar with no play in the route
 * params. Before this existed that button always landed on "play not found",
 * which made the most prominent action in the app a dead end.
 */
function PlayPicker({ insetTop, onCancel, onPick }: { insetTop: number; onCancel: () => void; onPick: (play: Play) => void }) {
  const styles = useStyles();

  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  // Twenty rows: a picker is answered by the first few, and the field stays
  // in reach above them. Debounced, deduplicated and kept in order by the hook.
  const search = useSearchQuery(trimmed ? foldSearchTerm(trimmed) : null, () => searchPlays(trimmed, { limit: 20 }));
  const results = search.data?.plays ?? [];
  const searching = search.loading && !search.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.checkin.headerTitle} />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
        <Text variant="title">
          {strings.checkin.pickPlayTitle}
        </Text>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={strings.checkin.pickPlayPlaceholder}
          accessibilityLabel={strings.checkin.pickPlayPlaceholder}
          loading={!!trimmed && search.loading}
          autoFocus
        />

        {!trimmed && (
          <Text variant="bodySmall" tone="faint">
            {strings.checkin.pickPlayHint}
          </Text>
        )}

        {results.map((p) => (
          <Pressable key={p.id} onPress={() => onPick(p)} style={styles.pickerRow} accessibilityRole="button">
            <PosterPlaceholder poster={p.poster} title={p.title} seed={p.id} width={40} height={60} radius={radius.sm} preferThumb />
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={2} variant="label">
                {p.title}
              </Text>
              <Text numberOfLines={1} variant="caption" tone="faint">
                {p.director ? `rend. ${p.director}` : p.author}
              </Text>
            </View>
          </Pressable>
        ))}

        {!!trimmed && !searching && results.length === 0 && (
          <Text variant="bodySmall" tone="faint">
            {strings.checkin.pickPlayNoResults}
          </Text>
        )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

function SubRatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  /** `undefined` until they touch it, and saved as null if it stays that way. */
  value: number | undefined;
  /** Passed `undefined` when they tap the mask they already chose. */
  onChange: (v: number | undefined) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 }}>
        <Text variant="bodySmall" tone="dim" numberOfLines={1}>{label}</Text>
        {/* Five empty masks say "nothing selected" and "zero out of five" in
            the same picture, and the second one is a verdict. The dash is the
            same answer the production page gives for an unrated production
            rather than printing a gold 0.0. It sits by the label and not by
            the masks so that the masks do not jump sideways when it goes. */}
        {value === undefined && (
          <Text variant="bodySmall" tone="faint">{strings.common.noRating}</Text>
        )}
      </View>
      <MaskRatingRow rating={value} size={16} onPressMask={onChange} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: gutter,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ratingCard: {
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: 16,
  },
  overallBlock: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  sectionLabel: {
    letterSpacing: 0.2,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 14,
    minHeight: 76,
    fontSize: inputFontSize,
    color: colors.text,
    textAlignVertical: "top",
  },
}));
