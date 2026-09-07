import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import {
  countUserEntriesForPlay,
  findBlankEntryForPlay,
  getPerformancesOnDay,
  getPlayById,
  getReviewById,
  getVenueById,
  submitReview,
  updateReview,
  uploadStub,
} from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import { useAuth } from "@/contexts/AuthContext";
import type { Performance, Play, Review, SeenCastMember, Venue } from "@/data/types";
import { parseTicketPrice } from "@/utils/money";
import { personSlug } from "@/utils/people";
import { PinIcon, SearchIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { DateField } from "@/components/ui/DateField";
import { ModalHeader } from "@/components/ui/ModalHeader";
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

  // The evening being logged. Defaults to today, which is what most check-ins
  // are, and is now a real value the user can move rather than the wall clock
  // this screen used to print into a field nobody could edit.
  const [seenAt, setSeenAt] = useState(todayInBudapest);
  const [showtimes, setShowtimes] = useState<Performance[]>([]);
  const [performanceId, setPerformanceId] = useState<string>();
  const [priorCount, setPriorCount] = useState(0);

  const [overall, setOverall] = useState(4);
  const [acting, setActing] = useState(4);
  const [directing, setDirecting] = useState(3);
  const [setDesign, setSetDesign] = useState(4);
  const [selectedTags, setSelectedTags] = useState<string[]>([strings.checkin.tagStandingOvation]);
  const [reviewText, setReviewText] = useState("");

  // The evening itself — see 0028. All four are optional, and an entry that
  // answers none of them is still a perfectly good entry.
  //
  // Ticked cast is held as a set of slugs rather than of names, so that the
  // ticked "Máthé Zsolt m.v." and a typed-in "Máthé Zsolt" cannot both end up
  // on the same night as two people. `person_slug()` in the database folds them
  // the same way.
  const [seenSlugs, setSeenSlugs] = useState<Set<string>>(new Set());
  const [alternates, setAlternates] = useState<SeenCastMember[]>([]);
  const [alternateDraft, setAlternateDraft] = useState("");
  const [seat, setSeat] = useState("");
  const [price, setPrice] = useState("");
  const [stubPath, setStubPath] = useState<string>();
  const [stubPreview, setStubPreview] = useState<string>();
  const [uploadingStub, setUploadingStub] = useState(false);

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
    if (review.seenAt) setSeenAt(review.seenAt);
    setPerformanceId(review.performanceId);
    // `?? ` and not `||`: a real rating is never 0, but leaving these at the
    // form's defaults for an entry that deliberately has none is the honest
    // starting point — the save writes whatever is on screen.
    if (review.ratingOverall !== undefined) setOverall(review.ratingOverall);
    if (review.ratingActing !== undefined) setActing(review.ratingActing);
    if (review.ratingDirecting !== undefined) setDirecting(review.ratingDirecting);
    if (review.ratingSetDesign !== undefined) setSetDesign(review.ratingSetDesign);
    setSelectedTags(review.tags);
    setReviewText(review.text);
    setSeat(review.seat ?? "");
    setPrice(review.priceHuf !== undefined ? String(review.priceHuf) : "");
    if (review.stubUrl) setStubPreview(review.stubUrl);

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
    if (!play) {
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
  // — two tiles for one human being, and a night that would record them twice.
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

  function toggleSeen(slug: string) {
    setSeenSlugs((cur) => {
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function addAlternate() {
    const name = alternateDraft.trim();
    if (!name) return;
    const slug = personSlug(name);
    // Somebody who is in the published cast is not a beugró, however they were
    // typed. Ticking them instead keeps the one meaningful flag meaningful.
    const listed = slug ? castOptions.find((c) => c.slug === slug) : undefined;
    if (listed) {
      setSeenSlugs((cur) => new Set(cur).add(listed.slug));
      setAlternateDraft("");
      return;
    }
    if (slug && alternates.some((a) => personSlug(a.name) === slug)) {
      setAlternateDraft("");
      return;
    }
    setAlternates((cur) => [...cur, { name, isAlternate: true }]);
    setAlternateDraft("");
  }

  function removeAlternate(name: string) {
    setAlternates((cur) => cur.filter((a) => a.name !== name));
  }

  async function handlePickStub() {
    if (uploadingStub) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(strings.checkin.stubPermission);
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      // No fixed aspect: a ticket stub is a long thin thing and a curtain call
      // is landscape, and cropping either to a square loses the half that
      // matters.
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setStubPreview(asset.uri);
    setError(undefined);
    setUploadingStub(true);
    try {
      setStubPath(await uploadStub(asset.uri));
    } catch {
      setStubPreview(undefined);
      setStubPath(undefined);
      setError(strings.checkin.stubUploadFailed);
    } finally {
      setUploadingStub(false);
    }
  }

  function removeStub() {
    setStubPreview(undefined);
    setStubPath(undefined);
  }

  const seenCount = seenSlugs.size + alternates.length;

  async function handleSave() {
    if (!play || saving || uploadingStub) return;

    // Parsed before anything is written, and refused rather than guessed at —
    // see `utils/money.ts`, which is where the separator handling and the
    // difference between "free" and "not recorded" are pinned down.
    const parsedPrice = parseTicketPrice(price);
    if (parsedPrice.kind === "invalid") {
      setError(strings.checkin.priceInvalid);
      return;
    }
    const priceHuf = parsedPrice.kind === "value" ? parsedPrice.huf : undefined;

    setError(undefined);
    setSaving(true);
    try {
      const entry = {
        seenAt,
        performanceId,
        ratingOverall: overall,
        ratingActing: acting,
        ratingDirecting: directing,
        ratingSetDesign: setDesign,
        text: reviewText.trim(),
        tags: selectedTags,
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
          </View>

          <SubRatingRow label={strings.checkin.acting} value={acting} onChange={setActing} />
          <SubRatingRow label={strings.checkin.directing} value={directing} onChange={setDirecting} />
          <SubRatingRow label={strings.checkin.setAndCostume} value={setDesign} onChange={setSetDesign} />
        </View>

        {/* Who was on. The single most-asked question in theatre logging, and
            the reason understudies.org exists as a site of its own: a cast
            sheet is posted in the foyer on the night and published nowhere
            afterwards, so an audience record is the only record there is. */}
        <View style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.castLabel}</Text>
            {seenCount > 0 && (
              <Text variant="caption" tone="accent">{strings.checkin.castSelectedCount(seenCount)}</Text>
            )}
          </View>
          <Text variant="caption" tone="dim">
            {castOptions.length > 0 ? strings.checkin.castHint : strings.checkin.castNoneKnown}
          </Text>

          {castOptions.length > 0 && (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {castOptions.map((member) => (
                <Chip
                  key={member.slug}
                  label={member.name}
                  active={seenSlugs.has(member.slug)}
                  onPress={() => toggleSeen(member.slug)}
                />
              ))}
            </View>
          )}

          {alternates.length > 0 && (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {alternates.map((a) => (
                <Chip
                  key={a.name}
                  label={`${a.name} · ${strings.checkin.castAlternateBadge}`}
                  active
                  // Tapping it takes it off again: the only way back out of a
                  // name typed by mistake.
                  onPress={() => removeAlternate(a.name)}
                />
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              value={alternateDraft}
              onChangeText={setAlternateDraft}
              placeholder={strings.checkin.castAlternatePlaceholder}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.checkin.castAddAlternate}
              onSubmitEditing={addAlternate}
              returnKeyType="done"
              style={[styles.field, { flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }]}
            />
            <Pressable
              onPress={addAlternate}
              disabled={!alternateDraft.trim()}
              accessibilityRole="button"
              style={[styles.addButton, { opacity: alternateDraft.trim() ? 1 : 0.4 }]}
            >
              <Text variant="label">{strings.checkin.castAdd}</Text>
            </Pressable>
          </View>
        </View>

        {/* Seat and price. Two nullable columns with a surprising payoff: the
            season page can eventually say what the évad cost and which part of
            the house you always end up in. */}
        <View style={{ gap: 10 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.seatLabel}</Text>
          <TextInput
            value={seat}
            onChangeText={setSeat}
            placeholder={strings.checkin.seatPlaceholder}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={strings.checkin.seatLabel}
            style={[styles.field, { fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }]}
          />

          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.priceLabel}</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder={strings.checkin.pricePlaceholder}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={strings.checkin.priceLabel}
            keyboardType="number-pad"
            style={[styles.field, { fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }]}
          />
          <Text variant="caption" tone="dim">{strings.checkin.priceHint}</Text>
        </View>

        {/* The stub. The plumbing was already built and pointed elsewhere:
            expo-image-picker is a dependency and 0013 gave uploads a
            per-user policy — this is a second bucket, not new infrastructure. */}
        <View style={{ gap: 10 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.checkin.stubLabel}</Text>
          {stubPreview && (
            <Image
              source={{ uri: stubPreview }}
              style={styles.stubPreview}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
            />
          )}
          <View style={{ flexDirection: "row", gap: space.lg, alignItems: "center" }}>
            <Pressable
              onPress={handlePickStub}
              disabled={uploadingStub}
              accessibilityRole="button"
              style={styles.addButton}
            >
              <Text variant="label">
                {uploadingStub
                  ? strings.checkin.stubUploading
                  : stubPreview
                    ? strings.checkin.stubReplace
                    : strings.checkin.stubAdd}
              </Text>
            </Pressable>
            {stubPreview && !uploadingStub && (
              <Pressable onPress={removeStub} hitSlop={8} accessibilityRole="button">
                <Text variant="label" tone="dim">{strings.checkin.stubRemove}</Text>
              </Pressable>
            )}
          </View>
          <Text variant="caption" tone="dim">{strings.checkin.stubHint}</Text>
        </View>

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

  const fontsLoaded = useAppFonts();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Play[]>([]);
  const [searching, setSearching] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchPlays(trimmed)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [trimmed]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.checkin.headerTitle} />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
        <Text variant="title">
          {strings.checkin.pickPlayTitle}
        </Text>

        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={strings.checkin.pickPlayPlaceholder}
            placeholderTextColor={colors.textFaint}
            autoFocus
            style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }}
          />
        </View>

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

function SubRatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text variant="bodySmall" tone="dim">{label}</Text>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  // 3:2, like the add-play preview: what people photograph is a ticket on a
  // table or a lit stage, and neither belongs in a 2:3 poster slot.
  stubPreview: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
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
