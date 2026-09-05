import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import {
  countUserEntriesForPlay,
  getPerformancesOnDay,
  getPlayById,
  getVenueById,
  submitReview,
} from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import { useAuth } from "@/contexts/AuthContext";
import type { Performance, Play, Venue } from "@/data/types";
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

const MOMENT_TAGS = [strings.checkin.tagStandingOvation, strings.checkin.tagCried, strings.checkin.tagRecommend];

export default function CheckInScreen() {
  const { playId } = useLocalSearchParams<{ playId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const { session, loading } = useAuth();
  const [play, setPlay] = useState<Play>();
  const [venue, setVenue] = useState<Venue>();
  const [saving, setSaving] = useState(false);
  const [playLoadFailed, setPlayLoadFailed] = useState(false);
  const [error, setError] = useState<string>();

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

  useEffect(() => {
    if (!loading && !session) {
      router.replace({ pathname: "/sign-in" });
    }
  }, [loading, session, router]);

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

  async function handleSave() {
    if (!play || saving) return;
    setError(undefined);
    setSaving(true);
    try {
      await submitReview({
        playId: play.id,
        seenAt,
        performanceId,
        ratingOverall: overall,
        ratingActing: acting,
        ratingDirecting: directing,
        ratingSetDesign: setDesign,
        text: reviewText.trim(),
        tags: selectedTags,
      });
      closeModal(router);
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
        title={strings.checkin.headerTitle}
        action={
          <Pressable
            onPress={handleSave}
            hitSlop={12}
            disabled={saving}
            accessibilityRole="button"
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

          {priorCount > 0 && (
            <Text variant="caption" tone="accent">{strings.checkin.rewatchNotice(priorCount)}</Text>
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

const styles = StyleSheet.create({
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
});
