import { useCallback, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { avatar, gutter, hairlineWidth, icon, mask, overlay, space } from "@/theme/tokens";
import { getCurrentUser, getDiaryEntriesForUser, getVenuesByIds, getWatchlist, type DiaryEntry } from "@/services/playsService";
import { signOut } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, User, Venue } from "@/data/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PlayRow } from "@/components/ui/PlayRow";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { SettingsIcon } from "@/components/icons/Icons";
import { ConfirmCard } from "@/components/ui/Cards";
import { LinkRow } from "@/components/ui/Rows";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { RowSkeleton, ScreenSkeleton } from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { SignedOutState } from "@/components/ui/SignedOutState";
import { Text } from "@/components/ui/Text";
import { HoloCard } from "@/components/ui/HoloCard";
import { PillTabs } from "@/components/ui/PillTabs";
import { useDockInset } from "@/components/ui/TabBar";
import { CountUp } from "@/components/motion/CountUp";
import { AnimatedList } from "@/components/motion/Reveal";
import { strings } from "@/i18n/hu";
import { currentSeasonStart } from "@/utils/season";
import { makeStyles, useColors } from "@/theme/styles";
import { countFollowRequests } from "@/services/followService";

const TABS = [strings.profile.tabDiary, strings.profile.tabWatchlists, strings.profile.tabReviews] as const;

export default function ProfileScreen() {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const dockInset = useDockInset();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [user, setUser] = useState<User>();
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [watchlist, setWatchlist] = useState<Play[]>([]);
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [diaryLoaded, setDiaryLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(strings.profile.tabDiary);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  /** Requests waiting for an answer (T-095); the header says so when there are any. */
  const [pendingRequests, setPendingRequests] = useState(0);
  const [signOutError, setSignOutError] = useState<string>();

  const [refreshing, setRefreshing] = useState(false);
  // Which load is the current one. A focus, a pull and a sign-out can all
  // start a load; only the newest may write, or a slow older answer would
  // paint over a fresh one.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    const fresh = () => mine === generation.current;
    if (!session) {
      setUser(undefined);
      setDiary([]);
      setWatchlist([]);
      setDiaryLoaded(false);
      return;
    }
    try {
      const u = await getCurrentUser();
      if (!fresh()) return;
      setUser(u);
      if (!u) return;
      countFollowRequests()
        .then((n) => {
          if (fresh()) setPendingRequests(n);
        })
        .catch(() => undefined);
      const [entries, wl] = await Promise.all([getDiaryEntriesForUser(u.id), getWatchlist()]);
      if (!fresh()) return;
      const watchlistPlays = wl.map((e) => e.play);
      setDiary(entries);
      setWatchlist(watchlistPlays);
      // One lookup for every venue on the screen rather than one per row.
      const venueMap = await getVenuesByIds([
        ...entries.map((e) => e.play.venueId),
        ...watchlistPlays.map((p) => p.venueId),
      ]);
      if (fresh()) setVenues(venueMap);
    } catch {
      // The tabs below say what an empty list means; a failed load reads as
      // one until the next focus tries again.
    } finally {
      if (fresh()) setDiaryLoaded(true);
    }
  }, [session]);

  // Refreshed on focus so a performance logged in the check-in modal shows up
  // in the diary as soon as the user lands back here.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        generation.current++;
      };
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSignOut() {
    setSignOutError(undefined);
    try {
      await signOut();
      setConfirmingSignOut(false);
    } catch (e) {
      setSignOutError(e instanceof Error ? e.message : strings.auth.genericError);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md, paddingHorizontal: gutter }}>
        <ScreenSkeleton />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        {/* The gear belongs here too. Appearance is a property of the device
            somebody is reading on, not of an account, so gating it behind a
            session left a signed-out visitor with a theme they could not
            change and no way to find out one existed. */}
        <View style={styles.signedOutBar}>
          <SettingsButton onPress={() => router.push("/settings")} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: dockInset }}>
          <SignedOutState lead="diary" />
        </ScrollView>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md, paddingHorizontal: gutter }}>
        <ScreenSkeleton />
      </View>
    );
  }

  const written = diary.filter((e) => e.review.text.trim().length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen width="reading">
      <ScrollView
        contentContainerStyle={{ paddingBottom: dockInset }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <View style={{ paddingHorizontal: gutter }}>
          {/* No cover band. There was one for a while — 118pt of `surface2`
              holding nothing, with the avatar pulled back up into it — which
              is a cover-photo slot for a cover photo the schema has nowhere to
              store. On a phone it cost most of what is above the fold before a
              single word about you appeared. The public profile in
              `app/user/[id].tsx` never had one, so this is the two screens
              agreeing rather than a new idea. The top inset lands here now,
              the way the feed, Discover and the watchlist all carry it on
              their own header row. Those three add `space.md` to the inset,
              but they open with a line of text; this screen opens with a 78pt
              circle hard against the top edge, so it takes the gutter instead
              and the avatar's top and left spacing agree. */}
          <View style={{ paddingTop: insets.top + space.md }} />

          {/* The reader as a season ticket — see components/ui/HoloCard. The
              name, the handle and the four counts used to sit on the page as
              a column of text between two hairlines; on the card they are one
              object, and the one the diary belongs to. Everything on it takes
              `overlay` colours: the card is dark in every theme. */}
          <HoloCard>
            <View style={styles.cardHead}>
              <Avatar uri={user.avatarUrl} initials={user.initials} size={avatar.hero} serif />
              {/* Kept clear of the crest stamped in the card's corner (HoloCard). */}
              <View style={{ flex: 1, gap: space["2xs"], paddingRight: space["4xl"] + space.sm }}>
                <Text variant="title" numberOfLines={2} style={{ color: overlay.onImageHeading }}>{user.name}</Text>
                <Text variant="bodySmall" numberOfLines={1} style={{ color: overlay.onImageText }}>
                  {[`@${user.handle}`, user.city].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
            {!!user.bio && (
              <Text variant="bodySmall" style={{ marginTop: space.md, color: overlay.onImageText }}>
                {user.bio}
              </Text>
            )}
            <Text variant="eyebrow" style={{ marginTop: space.lg, color: overlay.onImageAccent }}>
              {strings.profile.seasonEyebrow(currentSeasonStart())}
            </Text>
            <View style={styles.statsRow}>
              <Stat value={user.stats.playsSeen} label={strings.profile.playsSeen} />
              {/* The one stat that opens something. It used to count the calendar
                  year, which cuts every Hungarian season in half; it now counts
                  the évad and leads to the screen that breaks it down. */}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/season/[start]",
                    params: { start: String(currentSeasonStart()) },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={strings.profile.thisSeason}
                style={{ flex: 1 }}
              >
                <Stat value={user.stats.thisSeason} label={strings.profile.thisSeason} />
              </Pressable>
              {/* The two numbers open the lists behind them (T-096). */}
              <Pressable
                onPress={() => router.push({ pathname: "/followers", params: { tab: "followers" } })}
                accessibilityRole="button"
                accessibilityLabel={strings.profile.followers}
                style={{ flex: 1 }}
              >
                <Stat value={user.stats.followers} label={strings.profile.followers} />
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: "/followers", params: { tab: "following" } })}
                accessibilityRole="button"
                accessibilityLabel={strings.profile.following}
                style={{ flex: 1 }}
              >
                <Stat value={user.stats.following} label={strings.profile.following} />
              </Pressable>
            </View>
            {pendingRequests > 0 && (
              <Pressable
                onPress={() => router.push({ pathname: "/followers", params: { tab: "requests" } })}
                accessibilityRole="button"
                style={{ marginTop: space.md }}
              >
                <Text variant="label" style={{ color: overlay.onImageAccent }}>
                  {strings.people.pendingRequests(pendingRequests)} →
                </Text>
              </Pressable>
            )}
          </HoloCard>

          {/* The account's controls under the card rather than above it: the
              card is what the screen is about, and a row of pills over it put
              "Kijelentkezés" before the reader's own name. A ticket does not
              carry its own edit button, so they sit beside it, not on it. */}
          <View style={styles.headerActions}>
            <Button variant="outline" size="sm" label={strings.profile.edit} onPress={() => router.push("/edit-profile")} />
            <SettingsButton onPress={() => router.push("/settings")} />
            <View style={{ flex: 1 }} />
            <Button
              variant="text"
              size="sm"
              label={strings.auth.signOut}
              onPress={() => setConfirmingSignOut((s) => !s)}
              style={styles.signOut}
            />
          </View>

          {confirmingSignOut && (
            <ConfirmCard
              title={strings.auth.signOutConfirmTitle}
              body={strings.auth.signOutConfirmBody}
              confirmLabel={strings.auth.signOut}
              cancelLabel={strings.common.cancel}
              onConfirm={handleSignOut}
              onCancel={() => setConfirmingSignOut(false)}
              notice={signOutError ? <Notice>{signOutError}</Notice> : undefined}
              style={styles.confirm}
            />
          )}

          {/* Lists are a screen of their own rather than a fourth tab here.
              The three tabs are all "productions, filtered" and read as one
              control; a list is a different kind of object, and burying it as a
              fourth option would make it look like another view of the diary. */}
          <LinkRow label={strings.lists.headerTitle} onPress={() => router.push("/lists")} style={styles.listsLink} />

          <PillTabs
            tabs={TABS.map((t) => ({ key: t, label: t }))}
            value={activeTab}
            onChange={setActiveTab}
            style={{ marginTop: space.lg }}
          />

          {/* All three tabs are lists rather than poster grids. A grid of cover
              art is unreadable the moment a production has no poster, and half
              the catalogue's stand-ins carry only a monogram — a diary you
              cannot read the titles of is not a diary. */}
          {activeTab === strings.profile.tabDiary && (
            <TabBody
              loaded={diaryLoaded}
              isEmpty={diary.length === 0}
              emptyLabel={strings.profile.diaryEmpty}
              // An empty diary is the one place onboarding is worth offering:
              // it is a doorway rather than an apology, and the catalogue's
              // archives are what make it answerable.
              emptyAction={
                <Button label={strings.onboarding.prompt} onPress={() => router.push("/onboarding")} />
              }
            >
              {diary.map((entry) => (
                <PlayRow
                  key={entry.review.id}
                  play={entry.play}
                  // The evening, not the production. A diary row is a record of
                  // a night out — which cast, which seat, what it cost — and
                  // sending it to the catalogue page threw all of that away and
                  // landed you on a screen about everybody's opinion instead.
                  onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.review.id } })}
                  meta={
                    <>
                      <Text variant="caption" tone="faint" numberOfLines={1}>
                        {venues.get(entry.play.venueId)?.name ?? entry.play.author}
                      </Text>
                      {/* "Dátum nélkül" for an entry ticked during onboarding.
                          Saying so is the point — an invented date would make
                          the diary unreliable everywhere it is counted. */}
                      <Text variant="caption" tone="faint">
                        {entry.review.seenAt
                          ? strings.profile.seenOn(formatDate(entry.review.seenAt))
                          : strings.profile.seenUndated}
                      </Text>
                    </>
                  }
                  trailing={
                    entry.review.ratingOverall !== undefined ? (
                      <MaskRatingRow rating={entry.review.ratingOverall} size={mask.inline} />
                    ) : undefined
                  }
                />
              ))}
            </TabBody>
          )}

          {/* The watchlist tab used to say "hamarosan" while the Kívánságlista
              tab in the nav bar showed the very same entries — so adding a play
              appeared in the feed and then seemed to vanish from the profile. */}
          {activeTab === strings.profile.tabWatchlists && (
            <TabBody loaded={diaryLoaded} isEmpty={watchlist.length === 0} emptyLabel={strings.profile.watchlistEmpty}>
              {watchlist.map((play) => (
                <PlayRow
                  key={play.id}
                  play={play}
                  onPress={() => router.push(`/play/${play.id}`)}
                  meta={
                    <Text variant="caption" tone="faint" numberOfLines={1}>
                      {venues.get(play.venueId)?.name ?? play.author}
                    </Text>
                  }
                />
              ))}
            </TabBody>
          )}
          {/* The written ones only. Check-in makes the text optional, so most
              diary entries carry a rating and nothing else; listing those here
              too would make this tab a duplicate of the diary. */}
          {activeTab === strings.profile.tabReviews && (
            <TabBody loaded={diaryLoaded} isEmpty={written.length === 0} emptyLabel={strings.profile.reviewsEmpty}>
              {written.map((entry) => (
                <PlayRow
                  key={entry.review.id}
                  play={entry.play}
                  onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.review.id } })}
                  meta={
                    <>
                      <View style={styles.reviewMeta}>
                        {entry.review.ratingOverall !== undefined && (
                          <MaskRatingRow rating={entry.review.ratingOverall} size={mask.inline} />
                        )}
                        <Text variant="caption" tone="faint">
                          {entry.review.seenAt ? formatDate(entry.review.seenAt) : strings.profile.seenUndated}
                        </Text>
                      </View>
                      <Text variant="bodySmall" tone="dim">
                        {entry.review.text}
                      </Text>
                    </>
                  }
                />
              ))}
            </TabBody>
          )}
        </View>
      </ScrollView>
      </Screen>
    </View>
  );
}

/**
 * A tab's list, or its empty line once loading has settled.
 *
 * Kept as one component so the three tabs cannot drift into disagreeing about
 * what "empty" looks like.
 */
function TabBody({
  loaded,
  isEmpty,
  emptyLabel,
  emptyAction,
  children,
}: {
  loaded: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  /** Optional way out of the empty state — an empty screen should be a door. */
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = useStyles();

  if (loaded && isEmpty) {
    return (
      <View style={styles.emptyState}>
        <EmptyState align="center" title={emptyLabel} />
        {emptyAction}
      </View>
    );
  }
  // The tab's own rows arrive after the screen does — switching to a tab
  // whose list has not loaded showed an empty column, which is the last
  // thing T-093 left open. Three rows in the shape of the real ones.
  if (!loaded) {
    return (
      <View style={styles.tabList}>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </View>
    );
  }
  return (
    <AnimatedList style={styles.tabList} stagger={50} initialDelay={120}>
      {children}
    </AnimatedList>
  );
}

/**
 * A diary date, from the `YYYY-MM-DD` the review carries.
 *
 * Parsed at midday rather than midnight: a bare date string is midnight UTC,
 * which is still the previous evening in Budapest, so every entry would be
 * labelled with the day before the one the person actually chose.
 */
function formatDate(dayKey: string) {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Stat({ value, label }: { value: number; label: string }) {
  const styles = useStyles();

  return (
    <View style={styles.stat}>
      <CountUp value={value} style={{ color: overlay.onImageAccent }} />
      <Text variant="caption" style={{ textAlign: "center", color: overlay.onImageText }}>
        {label}
      </Text>
    </View>
  );
}

/** The way into Settings, identical whether or not anybody is signed in. */
function SettingsButton({ onPress }: { onPress: () => void }) {
  const palette = useColors();
  return (
    <IconButton onPress={onPress} accessibilityLabel={strings.settings.title}>
      <SettingsIcon size={icon.inline} color={palette.textDim} />
    </IconButton>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  signOut: { marginRight: -space.sm },
  confirm: { marginTop: space.lg },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  signedOutBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: gutter, paddingTop: space.md },
  statsRow: {
    flexDirection: "row",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: hairlineWidth,
    borderTopColor: overlay.onImageRule,
  },
  stat: { flex: 1, alignItems: "center", gap: space["2xs"] },
  listsLink: { marginTop: space.md },
  // The rows draw their own hairlines; the list only needs a step of air
  // after the tabs before the first one.
  tabList: { marginTop: space.sm },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  emptyState: { marginTop: space["2xl"], alignItems: "center", gap: space.lg },
}));
