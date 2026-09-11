import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { getVenueById, getWatchlist } from "@/services/playsService";
import { getFollowedSubjects, type FollowedSubject } from "@/services/followService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Venue } from "@/data/types";
import { CalendarIcon, ChevronRightIcon, PinIcon } from "@/components/icons/Icons";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SignedOutState } from "@/components/ui/SignedOutState";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatLongDate, formatShowtime } from "@/utils/datetime";
import { makeStyles } from "@/theme/styles";

export default function WatchlistScreen() {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ play: Play; addedAt: string }[]>([]);
  // The standing half of this screen: performers and theatres rather than
  // productions. Same tab because it answers the same question — what am I
  // waiting on — and a second tab for six rows would be a navigation problem
  // invented to hold them.
  const [followed, setFollowed] = useState<FollowedSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      // Fetched together: one of them being empty is the normal case, and two
      // sequential round trips would show the screen filling in twice.
      const [watchlist, subjects] = await Promise.all([getWatchlist(), getFollowedSubjects()]);
      setItems(watchlist);
      setFollowed(subjects);
    } catch {
      setFailed(true);
      setItems([]);
      setFollowed([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reloading on focus rather than only on mount: adding a play from the
  // detail screen and coming back here used to show a stale list until the
  // whole app was restarted.
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setItems([]);
        setFollowed([]);
        setLoading(false);
        return;
      }
      load();
    }, [session, load])
  );

  // The empty state belongs to the whole screen, not to the watchlist alone:
  // somebody following two theatres and saving no productions has not arrived
  // at an empty screen, and telling them it is empty would be wrong.
  const showEmpty = !loading && !authLoading && items.length === 0 && followed.length === 0;
  const people = followed.filter((f) => f.type === "person");
  const venues = followed.filter((f) => f.type === "venue");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen width="reading">
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <Text variant="display">{strings.watchlist.title}</Text>
          {!!session && (
            <Text variant="bodySmall" tone="faint">
              {strings.watchlist.subtitle(items.length)}
            </Text>
          )}
        </View>

        {!session && !authLoading ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
            <SignedOutState lead="watchlist" />
          </ScrollView>
        ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {items.map(({ play }) => (
            <WatchlistRow key={play.id} play={play} onPress={() => router.push(`/play/${play.id}`)} />
          ))}

          {/* Under the productions, because a saved production is a decision
              about a specific evening and a follow is an open question. */}
          {!!session && followed.length > 0 && (
            <View style={{ gap: space.lg, marginTop: items.length > 0 ? space.xl : 0 }}>
              <SectionHeader title={strings.watchlist.followingHeading} />

              {people.length > 0 && (
                <View style={{ gap: space.md }}>
                  <Text variant="eyebrow" tone="faint">{strings.watchlist.followingPeople}</Text>
                  {people.map((f) => (
                    <SubjectRow
                      key={`${f.type}:${f.key}`}
                      label={f.label}
                      detail={strings.watchlist.personItems(f.itemCount)}
                      onPress={() => router.push({ pathname: "/person/[slug]", params: { slug: f.key } })}
                    />
                  ))}
                </View>
              )}

              {venues.length > 0 && (
                <View style={{ gap: space.md }}>
                  <Text variant="eyebrow" tone="faint">{strings.watchlist.followingVenues}</Text>
                  {venues.map((f) => (
                    <SubjectRow
                      key={`${f.type}:${f.key}`}
                      label={f.label}
                      detail={[f.detail, strings.watchlist.venueItems(f.itemCount)].filter(Boolean).join(" · ")}
                      // There is no venue screen, so this opens Discover
                      // filtered to the house — which is what a theatre page
                      // would have shown anyway.
                      onPress={() =>
                        router.push({ pathname: "/(tabs)/discover", params: { venueId: f.key } })
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Only once the productions list is empty too — a screen with two
              theatres on it is not empty. */}
          {!!session && !loading && items.length === 0 && followed.length > 0 && (
            <Text variant="bodySmall" tone="faint" style={{ marginTop: space.lg }}>
              {strings.watchlist.emptyBody}
            </Text>
          )}

          {showEmpty && (
            <EmptyState
              eyebrow={strings.watchlist.title}
              title={failed ? strings.common.loadError : strings.watchlist.emptyTitle}
              body={!failed ? strings.watchlist.emptyBody : undefined}
              actionLabel={failed ? strings.common.retry : strings.watchlist.emptyAction}
              onAction={failed ? load : () => router.push("/(tabs)/discover")}
            />
          )}
        </ScrollView>
        )}
      </Screen>
    </View>
  );
}

function WatchlistRow({ play, onPress }: { play: Play; onPress: () => void }) {
  const styles = useStyles();

  // The next date, which is what the signed-out pitch for this screen
  // promises ("a következő időponttal"). The premiere only when nothing is
  // scheduled — and then with its year, because the row used to print a 2021
  // premiere as "Bemutató: szept. 17." and read as news (T-056). Same rule as
  // the feed's watchlist card.
  const when = play.nextPerformanceAt
    ? `${strings.status.nextPerformance}: ${formatShowtime(play.nextPerformanceAt)}`
    : play.premiereDate
      ? `${strings.watchlist.premiereLabel}: ${formatLongDate(`${play.premiereDate}T12:00:00Z`)}`
      : undefined;

  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [play.venueId]);

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={play.title}>
      <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} width={64} height={96} radius={radius.sm} preferThumb />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="subheading" numberOfLines={2}>
          {play.title}
        </Text>
        <View style={styles.metaRow}>
          <PinIcon size={13} />
          <Text variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
            {venue?.name}
          </Text>
        </View>
        {when && (
          <View style={styles.metaRow}>
            <CalendarIcon size={13} />
            <Text variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
              {when}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * A followed performer or theatre. Deliberately plainer than `WatchlistRow`:
 * these have no poster to show, and inventing a monogram tile for a theatre
 * would give six rows more visual weight than the productions above them.
 */
function SubjectRow({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  const styles = useStyles();

  return (
    <Pressable onPress={onPress} style={styles.subjectRow} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>{label}</Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>{detail}</Text>
      </View>
      <ChevronRightIcon size={15} color={colors.textFaint} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: {
    paddingHorizontal: gutter,
    paddingBottom: space.lg,
    gap: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  body: { padding: gutter, paddingBottom: 100, gap: space.lg },
  row: { flexDirection: "row", gap: space.md },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
}));
