import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getPlayById, getVenueById, submitReview } from "@/services/playsService";
import { searchPlays } from "@/services/searchService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Venue } from "@/data/types";
import { CloseIcon, CalendarIcon, PinIcon, SearchIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Chip } from "@/components/ui/Chip";
import { strings } from "@/i18n/hu";
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
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 13, color: colors.textFaint, textAlign: "center" }}>
          {strings.checkin.playNotFound}
        </Text>
        <Pressable onPress={() => closeModal(router)} accessibilityRole="button">
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.gold }}>{strings.checkin.close}</Text>
        </Pressable>
      </View>
    );
  }

  if (!play) {
    return <PlayPicker insetTop={insets.top} onCancel={() => closeModal(router)} onPick={setPlay} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Pressable onPress={() => closeModal(router)} hitSlop={8} accessibilityRole="button" accessibilityLabel={strings.common.close}>
          <CloseIcon />
        </Pressable>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14.5, color: colors.text }}>{strings.checkin.headerTitle}</Text>
        <Pressable
          onPress={handleSave}
          hitSlop={8}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13, color: colors.gold, opacity: saving ? 0.55 : 1 }}>
            {saving ? strings.checkin.saving : strings.checkin.save}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <PosterPlaceholder uri={play.posterUrl} width={44} height={66} radius={6} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 17, color: colors.text }}>{play.title}</Text>
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>{venue?.name ?? ""}</Text>
            {!playId && (
              <Pressable onPress={() => setPlay(undefined)} hitSlop={6} accessibilityRole="button">
                <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 11.5, color: colors.gold, marginTop: 4 }}>
                  {strings.checkin.changePlay}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={styles.field}>
            <CalendarIcon />
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.text }}>
              {new Date().toLocaleDateString("hu-HU", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          </View>
          <View style={styles.field}>
            <PinIcon />
            {/* This was hardcoded to a single stage name for every play, no
                matter where it actually runs. It shows the real venue now. */}
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.text }}>
              {venue?.name ?? strings.common.noRating}
            </Text>
          </View>
        </View>

        <View style={styles.ratingCard}>
          <View style={styles.overallBlock}>
            <Text style={[styles.sectionLabel, { fontFamily: bodyFont(fontsLoaded, "semibold") }]}>{strings.checkin.overallRating}</Text>
            <MaskRatingRow rating={overall} size={26} gap={6} onPressMask={setOverall} />
          </View>

          <SubRatingRow label={strings.checkin.acting} value={acting} onChange={setActing} />
          <SubRatingRow label={strings.checkin.directing} value={directing} onChange={setDirecting} />
          <SubRatingRow label={strings.checkin.setAndCostume} value={setDesign} onChange={setSetDesign} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.sectionLabel, { fontFamily: bodyFont(fontsLoaded, "semibold") }]}>{strings.checkin.momentTags}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {MOMENT_TAGS.map((tag) => (
              <Chip key={tag} label={tag} active={selectedTags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.sectionLabel, { fontFamily: bodyFont(fontsLoaded, "semibold") }]}>{strings.checkin.reviewLabel}</Text>
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
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12, color: colors.gold }} accessibilityRole="alert">
            {error}
          </Text>
        )}
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
      <View style={[styles.topBar, { paddingTop: insetTop }]}>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel={strings.common.close}>
          <CloseIcon />
        </Pressable>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14.5, color: colors.text }}>{strings.checkin.headerTitle}</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 20, color: colors.text }}>
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
            style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: 13.5, color: colors.text }}
          />
        </View>

        {!trimmed && (
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
            {strings.checkin.pickPlayHint}
          </Text>
        )}

        {results.map((p) => (
          <Pressable key={p.id} onPress={() => onPick(p)} style={styles.pickerRow} accessibilityRole="button">
            <PosterPlaceholder uri={p.posterUrl} width={40} height={60} radius={6} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={2} style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 13, color: colors.text }}>
                {p.title}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>
                {p.director ? `rend. ${p.director}` : p.author}
              </Text>
            </View>
          </Pressable>
        ))}

        {!!trimmed && !searching && results.length === 0 && (
          <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
            {strings.checkin.pickPlayNoResults}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function SubRatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const fontsLoaded = useAppFonts();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.textDim }}>{label}</Text>
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
    gap: 14,
    padding: 20,
  },
  topBar: {
    paddingHorizontal: 20,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
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
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ratingCard: {
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
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
    fontSize: 11.5,
    color: colors.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.06,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    minHeight: 76,
    fontSize: 13,
    color: colors.text,
    textAlignVertical: "top",
  },
});
