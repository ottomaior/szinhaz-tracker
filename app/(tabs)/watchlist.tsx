import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, space } from "@/theme/tokens";
import { getVenueById, getWatchlist } from "@/services/playsService";
import { getFollowedSubjects, type FollowedSubject } from "@/services/followService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Venue } from "@/data/types";
import { CalendarIcon, PinIcon } from "@/components/icons/Icons";
import { PlayRow } from "@/components/ui/PlayRow";
import { LinkRow } from "@/components/ui/Rows";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SignedOutState } from "@/components/ui/SignedOutState";
import { Text } from "@/components/ui/Text";
import { SplitText } from "@/components/motion/SplitText";
import { useDockInset } from "@/components/ui/TabBar";
import { strings } from "@/i18n/hu";
import { formatLongDate, formatShowtime } from "@/utils/datetime";
import { makeStyles } from "@/theme/styles";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { PushPrimer } from "@/components/ui/PushPrimer";

export default function WatchlistScreen() {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const dockInset = useDockInset();
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
  const [refreshing, setRefreshing] = useState(false);

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

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

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
          <SplitText text={strings.watchlist.title} />
          {!!session && (
            <Text variant="bodySmall" tone="faint">
              {strings.watchlist.subtitle(items.length)}
            </Text>
          )}
        </View>

        {!session && !authLoading ? (
          <ScrollView contentContainerStyle={{ paddingBottom: dockInset }}>
            <SignedOutState lead="watchlist" />
          </ScrollView>
        ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: dockInset }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
        >
          {/* The rows' shape while the first load is out, so the tab does
              not open on a blank body that could equally be "nothing saved"
              (T-093). */}
          {loading && (
            <View>
              {[0, 1, 2].map((i) => (
                <RowSkeleton key={i} />
              ))}
            </View>
          )}
          {/* Above the rows once there are rows: the person has just said
              which evenings they care about, and this asks whether the app
              may say when one of them is tomorrow (T-089). */}
          {!loading && items.length > 0 && <PushPrimer />}

          {items.length > 0 && (
            <View>
              {items.map(({ play }) => (
                <WatchlistRow key={play.id} play={play} onPress={() => router.push(`/play/${play.id}`)} />
              ))}
            </View>
          )}

          {/* Under the productions, because a saved production is a decision
              about a specific evening and a follow is an open question. */}
          {!!session && followed.length > 0 && (
            <View style={{ gap: space.lg, marginTop: items.length > 0 ? space.sm : 0 }}>
              <SectionHeader title={strings.watchlist.followingHeading} />

              {people.length > 0 && (
                <View style={{ gap: space.xs }}>
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
                <View style={{ gap: space.xs }}>
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
            <Notice tone="info">{strings.watchlist.emptyBody}</Notice>
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
    <PlayRow
      play={play}
      onPress={onPress}
      meta={
        <>
          <View style={styles.metaRow}>
            <PinIcon />
            <Text variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
              {venue?.name}
            </Text>
          </View>
          {when && (
            <View style={styles.metaRow}>
              <CalendarIcon />
              <Text variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
                {when}
              </Text>
            </View>
          )}
        </>
      }
    />
  );
}

/**
 * A followed performer or theatre: the text row, since these have no
 * poster to show, and inventing a monogram tile for a theatre would give
 * six rows more visual weight than the productions above them.
 */
function SubjectRow({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return <LinkRow label={label} blurb={detail} onPress={onPress} />;
}

const useStyles = makeStyles(() => StyleSheet.create({
  // No hairline under the header: the feed and Discover open on a bare
  // title too, and this was the one tab that ruled its own off.
  header: {
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
    gap: space.xs,
  },
  body: { padding: gutter, gap: space.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
}));
