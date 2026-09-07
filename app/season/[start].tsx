import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSeasonGenres,
  getSeasonPeople,
  getSeasonStats,
  getUndatedCount,
  getUserSeasons,
  type SeasonGenre,
  type SeasonPerson,
  type SeasonStats,
  type SeasonSummary,
} from "@/services/seasonService";
import { getPlayById } from "@/services/playsService";
import type { Play } from "@/data/types";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatLongDate } from "@/utils/datetime";
import { currentSeasonStart, seasonLabel, seasonLabelWithSuffix } from "@/utils/season";
import { makeStyles } from "@/theme/styles";

/**
 * The évad in review.
 *
 * The profile has shown a `thisYear` stat since 0001, counted on the calendar
 * year — a split that cuts every Hungarian season in half, putting the
 * November premiere and the February one in different totals. This is that stat
 * grown into a screen and given the right calendar; 0031 does the counting.
 *
 * Deliberately not a "Year in Review" behind a threshold. Letterboxd needs ten
 * diary entries before it will generate one; this screen is worth opening with
 * two, because at two it is still the only place that says which theatres you
 * went to and who you kept seeing.
 */
export default function SeasonScreen() {
  const styles = useStyles();

  const { start } = useLocalSearchParams<{ start?: string }>();
  const router = useRouter();
  const { session, loading } = useAuth();

  // A season named in the URL, falling back to the one we are in. Parsed rather
  // than trusted: `/season/nonsense` should open this season, not NaN.
  const parsed = Number(start);
  const seasonStart = Number.isInteger(parsed) ? parsed : currentSeasonStart();

  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [stats, setStats] = useState<SeasonStats>();
  const [genres, setGenres] = useState<SeasonGenre[]>([]);
  const [people, setPeople] = useState<SeasonPerson[]>([]);
  const [topPlay, setTopPlay] = useState<Play>();
  const [undated, setUndated] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setLoaded(true);
        return;
      }
      let active = true;
      setLoaded(false);
      setFailed(false);
      Promise.all([
        getUserSeasons(),
        getSeasonStats(seasonStart),
        getSeasonGenres(seasonStart),
        getSeasonPeople(seasonStart),
        getUndatedCount(),
      ])
        .then(async ([allSeasons, s, g, p, u]) => {
          if (!active) return;
          setSeasons(allSeasons);
          setStats(s);
          setGenres(g);
          setPeople(p);
          setUndated(u);
          // Fetched after the rest rather than alongside it: there is no play
          // to fetch until the stats say which one it was.
          const top = s?.topPlayId ? await getPlayById(s.topPlayId).catch(() => undefined) : undefined;
          if (active) setTopPlay(top);
        })
        .catch(() => {
          if (active) setFailed(true);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [session, seasonStart])
  );

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const label = seasonLabelWithSuffix(seasonStart);
  const empty = !!stats && stats.entries === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.season.headerTitle} fallbackRoute="/(tabs)/profile" />

      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          {!session ? (
            <EmptyState
              title={strings.season.signInPrompt}
              actionLabel={strings.profile.signInButton}
              onAction={() => router.push("/sign-in")}
            />
          ) : (
            <>
              <Text variant="title">{strings.season.title(label)}</Text>

              {/* Only when there is more than one to choose between. A single
                  chip that cannot be switched away from is a control that does
                  nothing, which is the pattern the feed's dead counters were. */}
              {seasons.length > 1 && (
                <View style={styles.seasonRow}>
                  {seasons.map((s) => (
                    <Chip
                      key={s.seasonStart}
                      label={seasonLabel(s.seasonStart)}
                      active={s.seasonStart === seasonStart}
                      onPress={() =>
                        router.replace({
                          pathname: "/season/[start]",
                          params: { start: String(s.seasonStart) },
                        })
                      }
                    />
                  ))}
                </View>
              )}

              {loaded && failed && <EmptyState title={strings.common.loadError} />}

              {loaded && !failed && empty && (
                <EmptyState
                  title={strings.season.empty}
                  actionLabel={strings.season.emptyAction}
                  onAction={() => router.push("/(tabs)/discover")}
                />
              )}

              {!!stats && !empty && (
                <>
                  <View style={styles.statsCard}>
                    <Stat value={stats.entries} label={strings.season.entries} gold />
                    <View style={styles.divider} />
                    <Stat value={stats.venues} label={strings.season.venues} />
                    <View style={styles.divider} />
                    <Stat value={stats.cities} label={strings.season.cities} />
                    {stats.rewatches > 0 && (
                      <>
                        <View style={styles.divider} />
                        <Stat value={stats.rewatches} label={strings.season.rewatches} />
                      </>
                    )}
                  </View>

                  {/* First and last night. Two dates rather than a span,
                      because "szept. 12. – jún. 4." reads as a run of shows;
                      these are the two ends of your own year. */}
                  {!!stats.firstNight && !!stats.lastNight && (
                    <View style={styles.factsRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label" tone="dim">{strings.season.firstNight}</Text>
                        <Text variant="body">{formatLongDate(`${stats.firstNight}T12:00:00Z`)}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label" tone="dim">{strings.season.lastNight}</Text>
                        <Text variant="body">{formatLongDate(`${stats.lastNight}T12:00:00Z`)}</Text>
                      </View>
                    </View>
                  )}

                  {!!topPlay && (
                    <View style={{ gap: space.sm }}>
                      <Text variant="label" tone="dim">{strings.season.topHeading}</Text>
                      <Pressable
                        onPress={() => router.push(`/play/${topPlay.id}`)}
                        style={styles.topRow}
                        accessibilityRole="button"
                        accessibilityLabel={topPlay.title}
                      >
                        <PosterPlaceholder
                          poster={topPlay.poster}
                          title={topPlay.title}
                          seed={topPlay.id}
                          width={48}
                          height={72}
                          radius={radius.sm}
                          preferThumb
                        />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text variant="subheading" numberOfLines={2}>{topPlay.title}</Text>
                          {stats.topRating !== undefined && (
                            <MaskRatingRow rating={stats.topRating} size={14} />
                          )}
                        </View>
                        <ChevronRightIcon size={15} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  )}

                  <View style={{ gap: space.sm }}>
                    <Text variant="label" tone="dim">{strings.season.spendHeading}</Text>
                    {stats.pricedEntries > 0 ? (
                      <>
                        <Text variant="heading">{strings.season.spendTotal(stats.spendHuf)}</Text>
                        <Text variant="bodySmall" tone="dim">
                          {strings.season.spendAverage(
                            Math.round(stats.spendHuf / stats.pricedEntries)
                          )}
                        </Text>
                        {/* The denominator, said out loud. An average over
                            three priced entries out of twenty is a different
                            claim from an average over twenty, and only one of
                            them is "your average ticket this season". */}
                        <Text variant="caption" tone="faint">
                          {strings.season.spendCoverage(stats.pricedEntries, stats.entries)}
                        </Text>
                      </>
                    ) : (
                      <Text variant="bodySmall" tone="faint">{strings.season.spendEmpty}</Text>
                    )}
                    {stats.seatedEntries > 0 && (
                      <Text variant="caption" tone="faint">
                        {strings.season.seatCount(stats.seatedEntries)}
                      </Text>
                    )}
                  </View>

                  {genres.length > 0 && (
                    <View style={{ gap: space.sm }}>
                      <Text variant="label" tone="dim">{strings.season.genresHeading}</Text>
                      <GenreBars genres={genres} total={stats.entries} />
                    </View>
                  )}

                  {people.length > 0 && (
                    <View style={{ gap: space.sm }}>
                      <Text variant="label" tone="dim">{strings.season.peopleHeading}</Text>
                      {people.map((p) => (
                        <Pressable
                          key={p.slug}
                          onPress={() =>
                            router.push({ pathname: "/person/[slug]", params: { slug: p.slug } })
                          }
                          style={styles.personRow}
                          accessibilityRole="button"
                          accessibilityLabel={p.name}
                        >
                          <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{p.name}</Text>
                          <Text variant="caption" tone="faint">
                            {strings.season.peopleNights(p.nights)}
                          </Text>
                          <ChevronRightIcon size={15} color={colors.textFaint} />
                        </Pressable>
                      ))}
                      <Text variant="caption" tone="faint">{strings.season.peopleSource}</Text>
                    </View>
                  )}
                </>
              )}

              {/* Outside every season, and said so. Somebody who ticked fifteen
                  productions during onboarding and then opened this page would
                  otherwise see a zero and conclude it was broken. */}
              {loaded && undated > 0 && (
                <Text variant="caption" tone="faint">{strings.season.undated(undated)}</Text>
              )}
            </>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

/**
 * The genre split as proportional bars rather than a pie.
 *
 * A pie of four slices is harder to read than four lines, and this one is
 * usually two or three: at this size the useful comparison is "mostly próza,
 * some opera", which a length answers directly.
 */
function GenreBars({ genres, total }: { genres: SeasonGenre[]; total: number }) {
  const styles = useStyles();

  const most = Math.max(...genres.map((g) => g.entries), 1);
  return (
    <View style={{ gap: space.sm }}>
      {genres.map((g) => (
        <View key={g.genre} style={{ gap: 4 }}>
          <View style={styles.genreLabelRow}>
            <Text variant="bodySmall">{strings.genres[g.genre] ?? g.genre}</Text>
            <Text variant="caption" tone="faint">
              {g.entries}
              {total > 0 ? ` · ${Math.round((g.entries / total) * 100)}%` : ""}
            </Text>
          </View>
          {/* Scaled against the largest genre, not against the total: with one
              genre at 90% every other bar would be a sliver too short to read. */}
          <View style={styles.genreTrack}>
            <View style={[styles.genreFill, { width: `${(g.entries / most) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Stat({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text variant="heading" tone={gold ? "accent" : "default"}>
        {value}
      </Text>
      <Text variant="caption" tone="faint" style={{ textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  seasonRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
  },
  divider: { width: 1, height: 28, backgroundColor: colors.hairlineSoft },
  factsRow: {
    flexDirection: "row",
    gap: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  genreLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  genreTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  genreFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
}));
