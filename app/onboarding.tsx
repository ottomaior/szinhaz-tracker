import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, overlay, radius, space } from "@/theme/tokens";
import {
  getCities,
  getCurrentUser,
  getDiaryPlaysForUser,
  getOnboardingCandidates,
  getVenuesByIds,
  markManyAsSeen,
} from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Venue } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { CheckIcon } from "@/components/icons/Icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Grid } from "@/components/ui/Grid";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";
import { makeStyles } from "@/theme/styles";

/**
 * "Which of these have you seen?" — the first thing a new account should do.
 *
 * A diary that starts empty is a form. The theatres' own archives are what make
 * the alternative possible: 0005_archive_and_reconcile.sql keeps hundreds of
 * closed productions loggable, and until now nothing in the app ever offered
 * them to anybody.
 *
 * Every tick writes a review row with **no date and no rating** — see
 * 0026_seen_without_a_date.sql. Both omissions are deliberate. Today's date is
 * the exact mistake 0022 exists to undo, and a rating nobody gave would move
 * `plays.rating_overall`, the number Play Detail publishes about a real
 * production.
 */
export default function OnboardingScreen() {
  const styles = useStyles();

  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState<string>();
  const [candidates, setCandidates] = useState<Play[]>([]);
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!authLoading && !session) router.replace("/sign-in");
  }, [authLoading, session, router]);

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setFailed(false);
    try {
      const user = await getCurrentUser();
      const [found, alreadyLogged] = await Promise.all([
        getOnboardingCandidates({ city }),
        user ? getDiaryPlaysForUser(user.id) : Promise.resolve([] as Play[]),
      ]);

      // Anything already in the diary is not a question worth asking again.
      const logged = new Set(alreadyLogged.map((p) => p.id));
      const offer = found.filter((p) => !logged.has(p.id));
      setCandidates(offer);
      setVenues(await getVenuesByIds(offer.map((p) => p.venueId)));
    } catch {
      setFailed(true);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [session, city]);

  useEffect(() => {
    load();
  }, [load]);

  // Kept across a city change on purpose: somebody who ticks four in Budapest
  // and then looks at Debrecen has not changed their mind about the four.
  function toggle(playId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playId)) next.delete(playId);
      else next.add(playId);
      return next;
    });
  }

  async function handleSave() {
    if (saving) return;
    setError(undefined);
    setSaving(true);
    try {
      await markManyAsSeen([...selected]);
      closeModal(router, "/(tabs)/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.onboarding.saveError);
      setSaving(false);
    }
  }

  if (!session) return null;

  const count = selected.size;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader
        title={strings.onboarding.headerTitle}
        action={
          <Pressable onPress={() => closeModal(router, "/(tabs)/profile")} hitSlop={12} accessibilityRole="button">
            <Text variant="label" tone="faint">{strings.onboarding.skip}</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
          <Text variant="body" tone="dim">
            {strings.onboarding.lede}
          </Text>

          {/* Hidden when the catalogue only covers one city, on the same
              principle as Discover's theatre row: a filter that cannot change
              the result reads as broken. */}
          {cities.length > 1 && (
            <View style={styles.cityRow}>
              <Chip label={strings.discover.filterAll} active={!city} onPress={() => setCity(undefined)} />
              {cities.map((c) => (
                <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />
              ))}
            </View>
          )}

          {loading && (
            <Grid columns={{ compact: 3, medium: 4, expanded: 5, wide: 6 }} gap={space.md}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} width="100%" height={190} radius={radius.md} />
              ))}
            </Grid>
          )}

          {!loading && failed && (
            <EmptyState title={strings.common.loadError} actionLabel={strings.common.retry} onAction={load} />
          )}

          {!loading && !failed && candidates.length === 0 && (
            <EmptyState title={strings.onboarding.nothingLeftTitle} body={strings.onboarding.nothingLeftBody} />
          )}

          {!loading && !failed && candidates.length > 0 && (
            <Grid columns={{ compact: 3, medium: 4, expanded: 5, wide: 6 }} gap={space.md}>
              {candidates.map((play) => {
                const isSelected = selected.has(play.id);
                return (
                  <Pressable
                    key={play.id}
                    onPress={() => toggle(play.id)}
                    /*
                     * ARIA props throughout.
                     *
                     * `accessibilityState={{ checked }}` renders nothing on web:
                     * react-native-web 0.19 has no handling for the object at
                     * all, so the DOM came out as role="checkbox" with no
                     * checked state, and the only thing saying a tile was ticked
                     * was the gold overlay — visible, and invisible to a screen
                     * reader.
                     *
                     * This comment used to claim that mixing `aria-*` with the
                     * `accessibility*` props made it drop the role and label too.
                     * That is not what this version does: createDOMProps resolves
                     * every pair as `aria ?? accessibility`, so the two spellings
                     * coexist and the ARIA one simply wins. The rest of the app
                     * now passes both, because React Native 0.71+ accepts
                     * `aria-*` natively and the legacy props still carry native.
                     */
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={play.title}
                    style={{ gap: 6 }}
                  >
                    <View>
                      <PosterPlaceholder
                        poster={play.poster}
                        title={play.title}
                        seed={play.id}
                        height={150}
                        radius={radius.md}
                        preferThumb
                        portraitFrame
                      />
                      {/* The tick sits on the artwork rather than beside the
                          title: the poster is what is being recognised, and at
                          this size it is also the whole tap target. */}
                      {isSelected && (
                        <View style={styles.tickOverlay}>
                          <View style={styles.tick}>
                            <CheckIcon size={18} color={colors.onAccent} />
                          </View>
                        </View>
                      )}
                    </View>
                    <Text variant="caption" numberOfLines={2} tone={isSelected ? "accent" : "default"}>
                      {play.title}
                    </Text>
                    <Text variant="caption" tone="faint" numberOfLines={1}>
                      {[venues.get(play.venueId)?.name, play.premiereDate?.slice(0, 4)].filter(Boolean).join(" · ")}
                    </Text>
                  </Pressable>
                );
              })}
            </Grid>
          )}

          {!!error && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
              {error}
            </Text>
          )}
        </ContentColumn>
      </ScrollView>

      {/* Pinned rather than at the end of the scroll: the grid is sixty tiles
          long, and a save button below it is a button nobody finds. */}
      <View style={styles.footer}>
        <ContentColumn>
          <Button
            label={saving ? strings.onboarding.saving : strings.onboarding.save(count)}
            disabled={saving || count === 0}
            onPress={handleSave}
          />
        </ContentColumn>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  cityRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  tickOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    backgroundColor: overlay.onImageVeil,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: space.xl,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
}));
