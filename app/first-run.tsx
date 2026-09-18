import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useAuth } from "@/contexts/AuthContext";
import { getCities, getFilterVenues } from "@/services/playsService";
import { followSubject } from "@/services/followService";
import {
  HANDLE_PATTERN,
  HandleTakenError,
  getFirstRunStatus,
  markOnboarded,
  patchProfile,
  type FirstRunStatus,
} from "@/services/profileService";
import { handleFromName, nameLooksDerived } from "@/utils/handle";
import type { Venue } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { StepIndicator, StepPane } from "@/components/ui/Stepper";
import { Text } from "@/components/ui/Text";
import { CheckIcon } from "@/components/icons/Icons";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";
import { makeStyles } from "@/theme/styles";

/**
 * The first run (T-083): what a new account is asked, once, before the app.
 *
 * Three short steps here (a name when the provider sent none, a city, the
 * theatres to follow), then the archive grid in `app/onboarding.tsx`, which
 * comes back here for the closing screen. Every step has a visible way past
 * it. No step answers for the reader: no city is pre-selected, no theatre is
 * pre-ticked, and the name field holds what the account already has rather
 * than a guess. The whole thing is stamped as shown the moment it opens
 * (`markOnboarded`), so whatever happens next it does not come back.
 */
type Step = "name" | "city" | "theatres";

export default function FirstRunScreen() {
  const styles = useStyles();
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ step?: string }>();
  const isDone = params.step === "done";

  const [status, setStatus] = useState<FirstRunStatus | null>();
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState<string>();
  const [venues, setVenues] = useState<Venue[]>([]);
  /** Which city the `venues` above answer for; loading is "not this one yet". */
  const [venuesFor, setVenuesFor] = useState<string>();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!authLoading && !session) router.replace("/sign-in");
  }, [authLoading, session, router]);

  // One read decides which steps exist, and the stamp goes on at the same
  // time. See the doc comment for why on opening rather than on finishing.
  useEffect(() => {
    if (!session || isDone) return;
    let cancelled = false;
    const email = session.user.email;
    Promise.all([getFirstRunStatus(), getCities().catch(() => [] as string[])])
      .then(([found, foundCities]) => {
        if (cancelled) return;
        const askName = nameLooksDerived(found?.name, email);
        setStatus(found);
        setCities(foundCities);
        setSteps(askName ? ["name", "city", "theatres"] : ["city", "theatres"]);
        setName(askName ? "" : (found?.name ?? ""));
        setHandle(found?.handle ?? "");
        if (!found?.onboardedAt) markOnboarded().catch(() => undefined);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus(null);
        setSteps(["city", "theatres"]);
      });
    return () => {
      cancelled = true;
    };
  }, [session, isDone]);

  const step = steps[index];

  // The theatres of the chosen city, or of every city when none was chosen.
  const venuesKey = city ?? "*";
  const venuesLoading = venuesFor !== venuesKey;
  useEffect(() => {
    if (step !== "theatres" || venuesFor === venuesKey) return;
    let cancelled = false;
    getFilterVenues(city)
      .then((found) => {
        if (cancelled) return;
        setVenues(found);
        setVenuesFor(venuesKey);
      })
      .catch(() => {
        if (cancelled) return;
        setVenues([]);
        setVenuesFor(venuesKey);
      });
    return () => {
      cancelled = true;
    };
  }, [step, city, venuesKey, venuesFor]);

  // The handle follows the name until the reader edits it themselves: the
  // same suggestion the database would have made (utils/handle.ts).
  const suggestedHandle = useMemo(() => handleFromName(name), [name]);
  const effectiveHandle = handleTouched ? handle : name.trim() ? suggestedHandle : handle;

  function advance() {
    setError(undefined);
    if (index + 1 < steps.length) {
      setIndex(index + 1);
    } else {
      const query = city ? `&city=${encodeURIComponent(city)}` : "";
      router.replace(`/onboarding?next=first-run${query}`);
    }
  }

  function leave() {
    closeModal(router, "/(tabs)/discover");
  }

  async function saveName() {
    if (saving) return;
    const trimmedName = name.trim();
    const cleanHandle = effectiveHandle.trim().toLowerCase();
    if (!trimmedName) {
      setError(strings.editProfile.errorNameRequired);
      return;
    }
    if (!HANDLE_PATTERN.test(cleanHandle)) {
      setError(strings.editProfile.errorHandleShape);
      return;
    }
    setSaving(true);
    try {
      await patchProfile({ name: trimmedName, handle: cleanHandle });
      advance();
    } catch (e) {
      setError(e instanceof HandleTakenError ? strings.editProfile.errorHandleTaken : strings.firstRun.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function saveCity() {
    if (saving || !city) return;
    setSaving(true);
    try {
      await patchProfile({ city });
      advance();
    } catch {
      setError(strings.firstRun.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function followPicked() {
    if (saving || picked.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...picked].map((id) => followSubject("venue", id)));
      advance();
    } catch {
      setError(strings.firstRun.saveError);
    } finally {
      setSaving(false);
    }
  }

  function togglePick(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!session) return null;

  if (isDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={strings.firstRun.headerTitle} />
        <ContentColumn style={{ padding: gutter, gap: space.lg, flex: 1, justifyContent: "center" }}>
          <StepPane>
            <View style={{ gap: space.lg }}>
              <Text variant="display">{strings.firstRun.doneTitle}</Text>
              <Text variant="body" tone="dim">
                {strings.firstRun.doneBody}
              </Text>
              <Button label={strings.firstRun.doneButton} onPress={leave} />
            </View>
          </StepPane>
        </ContentColumn>
      </View>
    );
  }

  const stepLabels = steps.length === 3 ? strings.firstRun.stepLabels : strings.firstRun.stepLabels.slice(1);
  const loadingSteps = status === undefined;

  const errorLine = !!error && (
    <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
      {error}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader
        title={strings.firstRun.headerTitle}
        action={
          <Pressable onPress={leave} hitSlop={12} accessibilityRole="button">
            <Text variant="label" tone="faint">
              {strings.firstRun.skipAll}
            </Text>
          </Pressable>
        }
      />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.xl * 2 }}>
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          {loadingSteps ? (
            <Skeleton width="100%" height={30} radius={15} />
          ) : (
            // One more disc than there are steps here: the archive grid is
            // the last act and lives on its own screen.
            <StepIndicator steps={steps.length + 1} current={index + 1} labels={stepLabels} />
          )}

          {step === "name" && (
            <StepPane key="name">
              <View style={{ gap: space.lg }}>
                <Text variant="heading">{strings.firstRun.nameTitle}</Text>
                <Text variant="bodySmall" tone="dim">
                  {strings.firstRun.nameLede}
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={strings.editProfile.namePlaceholder}
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel={strings.editProfile.nameLabel}
                  autoComplete="name"
                  autoFocus
                  style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
                />
                <View style={{ gap: space.xs }}>
                  <TextInput
                    value={effectiveHandle}
                    onChangeText={(v) => {
                      setHandleTouched(true);
                      setHandle(v);
                    }}
                    placeholder={strings.editProfile.handlePlaceholder}
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel={strings.editProfile.handleLabel}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
                  />
                  <Text variant="caption" tone="faint">
                    {strings.editProfile.handleHint}
                  </Text>
                </View>
                {errorLine}
                <Button label={strings.firstRun.next} onPress={saveName} loading={saving} disabled={saving} />
              </View>
            </StepPane>
          )}

          {step === "city" && (
            <StepPane key="city">
              <View style={{ gap: space.lg }}>
                <Text variant="heading">{strings.firstRun.cityTitle}</Text>
                <Text variant="bodySmall" tone="dim">
                  {strings.firstRun.cityLede}
                </Text>
                <View style={styles.chipRow}>
                  {cities.map((c) => (
                    <Chip key={c} label={c} active={city === c} onPress={() => setCity(city === c ? undefined : c)} />
                  ))}
                </View>
                {errorLine}
                <Button label={strings.firstRun.next} onPress={saveCity} loading={saving} disabled={saving || !city} />
                <Button label={strings.firstRun.later} variant="text" onPress={advance} disabled={saving} />
              </View>
            </StepPane>
          )}

          {step === "theatres" && (
            <StepPane key="theatres">
              <View style={{ gap: space.lg }}>
                <Text variant="heading">{strings.firstRun.theatresTitle}</Text>
                <Text variant="bodySmall" tone="dim">
                  {strings.firstRun.theatresLede}
                </Text>

                {venuesLoading && (
                  <View style={{ gap: space.sm }}>
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} width="100%" height={56} radius={radius.md} />
                    ))}
                  </View>
                )}
                {!venuesLoading && venues.length === 0 && <EmptyState title={strings.firstRun.theatresEmpty} />}
                {!venuesLoading && venues.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    {venues.map((venue) => {
                      const on = picked.has(venue.id);
                      return (
                        <Pressable
                          key={venue.id}
                          onPress={() => togglePick(venue.id)}
                          role="checkbox"
                          aria-checked={on}
                          aria-label={venue.name}
                          style={[styles.venueRow, on && styles.venueRowOn]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text variant="body" numberOfLines={1}>
                              {venue.name}
                            </Text>
                            <Text variant="caption" tone="faint" numberOfLines={1}>
                              {[venue.type, city ? undefined : venue.city].filter(Boolean).join(" · ")}
                            </Text>
                          </View>
                          <View style={[styles.tick, on && styles.tickOn]}>
                            {on && <CheckIcon size={14} color={colors.onAccent} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {errorLine}
                <Button
                  label={strings.firstRun.follow(picked.size)}
                  onPress={followPicked}
                  loading={saving}
                  disabled={saving || picked.size === 0}
                />
                <Button label={strings.firstRun.later} variant="text" onPress={advance} disabled={saving} />
              </View>
            </StepPane>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: space.lg,
    fontSize: inputFontSize,
    color: colors.text,
  },
  chipRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  venueRowOn: { borderColor: colors.gold },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  tickOn: { backgroundColor: colors.gold, borderColor: colors.gold },
}));
