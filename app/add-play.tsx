import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useAuth } from "@/contexts/AuthContext";
import { createPlay, createVenue, searchVenues } from "@/services/playsService";
import type { CastMember, Venue, VenueType } from "@/data/types";
import { CloseIcon } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { strings } from "@/i18n/hu";

const VENUE_TYPES: VenueType[] = ["kőszínház", "független", "befogadó tér", "szabadtéri"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function AddPlayScreen() {
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [director, setDirector] = useState("");
  const [genre, setGenre] = useState("");
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [intermissions, setIntermissions] = useState("1");
  const [premiereDate, setPremiereDate] = useState("");
  const [cast, setCast] = useState<CastMember[]>([{ name: "", role: "" }]);

  const [venueQuery, setVenueQuery] = useState("");
  const [venueResults, setVenueResults] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue>();
  const [showNewVenueForm, setShowNewVenueForm] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueCity, setNewVenueCity] = useState("");
  const [newVenueType, setNewVenueType] = useState<VenueType>("kőszínház");
  const [creatingVenue, setCreatingVenue] = useState(false);

  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/sign-in");
    }
  }, [loading, session, router]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (venueQuery.trim().length > 1) {
        searchVenues(venueQuery)
          .then(setVenueResults)
          .catch(() => setVenueResults([]));
      } else {
        setVenueResults([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [venueQuery]);

  function updateCastMember(index: number, patch: Partial<CastMember>) {
    setCast((cur) => cur.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCastMember(index: number) {
    setCast((cur) => cur.filter((_, i) => i !== index));
  }

  async function handleCreateVenue() {
    if (creatingVenue) return;
    if (!newVenueName.trim() || !newVenueCity.trim()) {
      setError(strings.addPlay.errorVenueNameRequired);
      return;
    }
    setError(undefined);
    setCreatingVenue(true);
    try {
      const venue = await createVenue({ name: newVenueName.trim(), type: newVenueType, city: newVenueCity.trim() });
      setSelectedVenue(venue);
      setShowNewVenueForm(false);
      setNewVenueName("");
      setNewVenueCity("");
      setVenueQuery("");
      setVenueResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.auth.genericError);
    } finally {
      setCreatingVenue(false);
    }
  }

  async function handleSave() {
    if (submitting) return;
    // These used to fall through to the database (or, for the venue, set the
    // error line to the literal field label "Játszóhely", which read as
    // nonsense rather than as an instruction).
    if (!title.trim()) {
      setError(strings.addPlay.errorTitleRequired);
      return;
    }
    if (!selectedVenue) {
      setError(strings.addPlay.errorVenueRequired);
      return;
    }
    if (premiereDate.trim() && !ISO_DATE.test(premiereDate.trim())) {
      setError(strings.addPlay.errorPremiereDate);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const play = await createPlay({
        title: title.trim(),
        author: author.trim(),
        director: director.trim(),
        venueId: selectedVenue.id,
        genre: genre.trim(),
        runtimeMinutes: runtimeMinutes.trim() ? Number(runtimeMinutes) : undefined,
        intermissions: intermissions.trim() ? Number(intermissions) : 0,
        premiereDate: premiereDate.trim() || undefined,
        cast: cast.filter((c) => c.name.trim() && c.role.trim()),
      });
      router.replace(`/play/${play.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.auth.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader
        title={strings.addPlay.headerTitle}
        action={
          <Pressable
            onPress={handleSave}
            hitSlop={12}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            <Text variant="label" tone="accent" style={{ opacity: submitting ? 0.55 : 1 }}>
              {submitting ? strings.addPlay.saving : strings.addPlay.save}
            </Text>
          </Pressable>
        }
      />

      <ScrollView keyboardShouldPersistTaps="handled">
        <ContentColumn style={{ padding: gutter, gap: space.lg, paddingBottom: space["5xl"] }}>
        <LabeledInput label={strings.addPlay.titleLabel} value={title} onChangeText={setTitle} />
        <LabeledInput label={strings.addPlay.authorLabel} value={author} onChangeText={setAuthor} />
        <LabeledInput label={strings.addPlay.directorLabel} value={director} onChangeText={setDirector} />
        <LabeledInput label={strings.addPlay.genreLabel} value={genre} onChangeText={setGenre} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <LabeledInput label={strings.addPlay.runtimeLabel} value={runtimeMinutes} onChangeText={setRuntimeMinutes} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <LabeledInput label={strings.addPlay.intermissionsLabel} value={intermissions} onChangeText={setIntermissions} keyboardType="number-pad" />
          </View>
        </View>
        <LabeledInput label={strings.addPlay.premiereDateLabel} value={premiereDate} onChangeText={setPremiereDate} placeholder="2026-09-01" />

        <View style={{ gap: 8 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.addPlay.venueLabel}</Text>
          {selectedVenue ? (
            <Pressable
              style={styles.selectedVenue}
              onPress={() => setSelectedVenue(undefined)}
              accessibilityRole="button"
              accessibilityHint={strings.addPlay.clearVenue}
            >
              <Text variant="label">{selectedVenue.name}</Text>
              <Text variant="caption" tone="faint">{selectedVenue.city}</Text>
              {/* Tapping the card cleared the selection with nothing on screen
                  saying so. */}
              <Text variant="caption" tone="accent" style={{ marginTop: 4 }}>
                {strings.addPlay.clearVenue}
              </Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                value={venueQuery}
                onChangeText={setVenueQuery}
                placeholder={strings.addPlay.venueSearchPlaceholder}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={strings.addPlay.venueSearchPlaceholder}
                style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
              />
              {venueResults.map((v) => (
                <Pressable key={v.id} style={styles.venueResultRow} onPress={() => setSelectedVenue(v)} accessibilityRole="button">
                  <Text variant="bodySmall">{v.name}</Text>
                  <Text variant="caption" tone="faint">{v.city}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setShowNewVenueForm((s) => !s)} accessibilityRole="button">
                <Text variant="label" tone="accent">
                  {strings.addPlay.venueNotFound} {strings.addPlay.createVenue}
                </Text>
              </Pressable>
              {showNewVenueForm && (
                <View style={{ gap: 8 }}>
                  <LabeledInput label={strings.addPlay.venueNameLabel} value={newVenueName} onChangeText={setNewVenueName} />
                  <LabeledInput label={strings.addPlay.venueCityLabel} value={newVenueCity} onChangeText={setNewVenueCity} />
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {VENUE_TYPES.map((t) => (
                      <Chip key={t} label={t} active={newVenueType === t} onPress={() => setNewVenueType(t)} />
                    ))}
                  </View>
                  <Button
                    label={strings.addPlay.createVenue}
                    variant="outline"
                    onPress={handleCreateVenue}
                    loading={creatingVenue}
                    disabled={creatingVenue}
                  />
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" tone="dim" style={styles.sectionLabel}>{strings.addPlay.castLabel}</Text>
          {cast.map((member, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={member.name}
                onChangeText={(v) => updateCastMember(i, { name: v })}
                placeholder={strings.addPlay.castNamePlaceholder}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={strings.addPlay.castNamePlaceholder}
                style={[styles.input, { flex: 1, fontFamily: bodyFont(fontsLoaded) }]}
              />
              <TextInput
                value={member.role}
                onChangeText={(v) => updateCastMember(i, { role: v })}
                placeholder={strings.addPlay.castRolePlaceholder}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={strings.addPlay.castRolePlaceholder}
                style={[styles.input, { flex: 1, fontFamily: bodyFont(fontsLoaded) }]}
              />
              <Pressable
                onPress={() => removeCastMember(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.addPlay.removeCastMember}
              >
                <CloseIcon size={14} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setCast((c) => [...c, { name: "", role: "" }])} accessibilityRole="button">
            <Text variant="label" tone="accent">{strings.addPlay.addCastMember}</Text>
          </Pressable>
        </View>

        {error && (
          <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
            {error}
          </Text>
        )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
}) {
  const fontsLoaded = useAppFonts();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" tone="dim" style={styles.sectionLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The brand face is applied per-instance like everywhere else in the app;
  // this style used to pin itself to "System" and skip Sora entirely.
  sectionLabel: {
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 14,
    fontSize: inputFontSize,
    color: colors.text,
  },
  selectedVenue: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 14,
    gap: 2,
  },
  venueResultRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.md,
    gap: 2,
  },
});
