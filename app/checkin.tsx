import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getPlayById, getVenueById } from "@/services/playsService";
import type { Play, Venue } from "@/data/types";
import { CloseIcon, CalendarIcon, PinIcon, CameraIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Chip } from "@/components/ui/Chip";
import { strings } from "@/i18n/hu";

const MOMENT_TAGS = [strings.checkin.tagStandingOvation, strings.checkin.tagCried, strings.checkin.tagRecommend];

export default function CheckInScreen() {
  const { playId } = useLocalSearchParams<{ playId?: string }>();
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const [play, setPlay] = useState<Play>();
  const [venue, setVenue] = useState<Venue>();

  const [overall, setOverall] = useState(4);
  const [acting, setActing] = useState(4);
  const [directing, setDirecting] = useState(3);
  const [setDesign, setSetDesign] = useState(4);
  const [selectedTags, setSelectedTags] = useState<string[]>([strings.checkin.tagStandingOvation]);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    const id = playId ?? "p1";
    getPlayById(id).then((p) => {
      setPlay(p);
      if (p) getVenueById(p.venueId).then(setVenue);
    });
  }, [playId]);

  function toggleTag(tag: string) {
    setSelectedTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  }

  function handleSave() {
    // MVP: no persistence yet — logging closes the modal. Wire this to a
    // real mutation (services/playsService -> submitReview) once the data
    // layer is backed by a server.
    router.back();
  }

  if (!play) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <CloseIcon />
        </Pressable>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 14.5, color: colors.text }}>{strings.checkin.headerTitle}</Text>
        <Pressable onPress={handleSave} hitSlop={8}>
          <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13, color: colors.gold }}>{strings.checkin.save}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <PosterPlaceholder width={44} height={60} radius={6} />
          <View>
            <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 17, color: colors.text }}>{play.title}</Text>
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>{venue?.name}</Text>
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
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.text }}>Nagyszínpad</Text>
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
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CameraIcon />
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12, color: colors.textFaint }}>{strings.checkin.addPhoto}</Text>
          </Pressable>
        </View>
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
  topBar: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
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
