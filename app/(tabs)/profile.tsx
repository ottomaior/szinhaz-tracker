import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, space } from "@/theme/tokens";
import { getCurrentUser, getDiaryEntriesForUser, getVenuesByIds, getWatchlist, type DiaryEntry } from "@/services/playsService";
import { signOut } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, User, Venue } from "@/data/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PlayRow } from "@/components/ui/PlayRow";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

const TABS = [strings.profile.tabDiary, strings.profile.tabWatchlists, strings.profile.tabReviews] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [user, setUser] = useState<User>();
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [watchlist, setWatchlist] = useState<Play[]>([]);
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [diaryLoaded, setDiaryLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(strings.profile.tabDiary);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();

  // Refreshed on focus so a performance logged in the check-in modal shows up
  // in the diary as soon as the user lands back here.
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setUser(undefined);
        setDiary([]);
        setWatchlist([]);
        setDiaryLoaded(false);
        return;
      }
      let active = true;
      getCurrentUser()
        .then((u) => {
          if (!active) return;
          setUser(u);
          if (!u) return;
          return Promise.all([getDiaryEntriesForUser(u.id), getWatchlist()]).then(async ([entries, wl]) => {
            if (!active) return;
            const watchlistPlays = wl.map((e) => e.play);
            setDiary(entries);
            setWatchlist(watchlistPlays);
            // One lookup for every venue on the screen rather than one per row.
            const venueMap = await getVenuesByIds([
              ...entries.map((e) => e.play.venueId),
              ...watchlistPlays.map((p) => p.venueId),
            ]);
            if (active) setVenues(venueMap);
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setDiaryLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [session])
  );

  async function handleSignOut() {
    setSignOutError(undefined);
    try {
      await signOut();
      setConfirmingSignOut(false);
    } catch (e) {
      setSignOutError(e instanceof Error ? e.message : strings.auth.genericError);
    }
  }

  if (loading) return null;

  if (!session) {
    return (
      <View style={[styles.emptyState, { flex: 1, justifyContent: "center", paddingTop: insets.top, backgroundColor: colors.bg }]}>
        <Text variant="body" tone="dim" style={{ marginBottom: space.lg }}>
          {strings.profile.signInPrompt}
        </Text>
        <Button label={strings.profile.signInButton} onPress={() => router.push("/sign-in")} />
      </View>
    );
  }

  if (!user) return null;

  const written = diary.filter((e) => e.review.text.trim().length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.cover, { paddingTop: insets.top + 16 }]} />

        <View style={{ paddingHorizontal: gutter }}>
          <View style={styles.profileRow}>
            <Avatar initials={user.initials} size={78} serif />
            {/* This used to be a "Profil szerkesztése" pill with no press
                handler, next to a settings gear that signed the user out on a
                single tap with no confirmation. One real, clearly labelled,
                confirmed control replaces both. */}
            <Pressable
              style={styles.signOutBtn}
              onPress={() => setConfirmingSignOut((s) => !s)}
              accessibilityRole="button"
              accessibilityState={{ expanded: confirmingSignOut }}
            >
              <Text variant="label">{strings.auth.signOut}</Text>
            </Pressable>
          </View>

          {confirmingSignOut && (
            <View style={styles.confirmCard}>
              <Text variant="subheading">{strings.auth.signOutConfirmTitle}</Text>
              <Text variant="bodySmall" tone="dim">{strings.auth.signOutConfirmBody}</Text>
              {!!signOutError && (
                <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                  {signOutError}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label={strings.common.cancel} variant="outline" style={{ flex: 1 }} onPress={() => setConfirmingSignOut(false)} />
                <Button label={strings.auth.signOut} style={{ flex: 1 }} onPress={handleSignOut} />
              </View>
            </View>
          )}

          <View style={{ marginTop: 12, gap: 2 }}>
            <Text variant="title">{user.name}</Text>
            <Text variant="bodySmall" tone="faint">
              {[`@${user.handle}`, user.city].filter(Boolean).join(" · ")}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <Stat value={user.stats.playsSeen} label={strings.profile.playsSeen} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.thisYear} label={strings.profile.thisYear} gold />
            <View style={styles.statDivider} />
            <Stat value={user.stats.followers} label={strings.profile.followers} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.following} label={strings.profile.following} />
          </View>

          <View style={styles.tabsRow}>
            {TABS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setActiveTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === t }}
                style={[styles.tabItem, activeTab === t && styles.tabItemActive]}
              >
                <Text variant="label" tone={activeTab === t ? "default" : "faint"}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* All three tabs are lists rather than poster grids. A grid of cover
              art is unreadable the moment a production has no poster, and half
              the catalogue's stand-ins carry only a monogram — a diary you
              cannot read the titles of is not a diary. */}
          {activeTab === strings.profile.tabDiary && (
            <TabBody loaded={diaryLoaded} isEmpty={diary.length === 0} emptyLabel={strings.profile.diaryEmpty}>
              {diary.map((entry) => (
                <PlayRow
                  key={entry.review.id}
                  play={entry.play}
                  onPress={() => router.push(`/play/${entry.play.id}`)}
                  meta={
                    <>
                      <Text variant="caption" tone="faint" numberOfLines={1}>
                        {venues.get(entry.play.venueId)?.name ?? entry.play.author}
                      </Text>
                      <Text variant="caption" tone="faint">
                        {strings.profile.seenOn(formatDate(entry.review.createdAt))}
                      </Text>
                    </>
                  }
                  trailing={<MaskRatingRow rating={entry.review.ratingOverall} size={13} />}
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
                  onPress={() => router.push(`/play/${entry.play.id}`)}
                  meta={
                    <>
                      <View style={styles.reviewMeta}>
                        <MaskRatingRow rating={entry.review.ratingOverall} size={13} />
                        <Text variant="caption" tone="faint">
                          {formatDate(entry.review.createdAt)}
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
  children,
}: {
  loaded: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (loaded && isEmpty) {
    return (
      <View style={styles.emptyState}>
        <Text variant="bodySmall" tone="faint">{emptyLabel}</Text>
      </View>
    );
  }
  return <View style={styles.tabList}>{children}</View>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
}

function Stat({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text variant="heading" tone={gold ? "accent" : "default"}>
        {value}
      </Text>
      <Text variant="caption" tone="faint" style={{ textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 118,
    backgroundColor: colors.surface2,
    paddingHorizontal: 18,
    alignItems: "flex-end",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -40,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  confirmCard: {
    marginTop: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    padding: 14,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.hairlineSoft },
  tabsRow: {
    flexDirection: "row",
    gap: 22,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  tabItem: { paddingBottom: 10 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabList: { marginTop: space.lg, gap: space.lg },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  emptyState: { marginTop: 24, alignItems: "center", paddingVertical: 30 },
});
