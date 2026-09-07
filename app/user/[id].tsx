import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { getDiaryEntriesForUser, getUserById, getVenuesByIds, type DiaryEntry } from "@/services/playsService";
import { followUser, isFollowing, unfollowUser } from "@/services/followService";
import { blockUser, isBlocked, unblockUser } from "@/services/moderationService";
import { useAuth } from "@/contexts/AuthContext";
import type { User, Venue } from "@/data/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PlayRow } from "@/components/ui/PlayRow";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { ReportSheet } from "@/components/ui/ReportSheet";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * Somebody else's profile: what they have seen, and a button to follow them.
 *
 * Presented as a modal like the other pushed screens. It is the only place a
 * follow can be created, which is why the people search and every feed card's
 * author link lead here.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [user, setUser] = useState<User>();
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [blocked, setBlocked] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string>();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      setLoaded(false);
      Promise.all([
        getUserById(id).then((u) => {
          if (active) setUser(u);
        }),
        getDiaryEntriesForUser(id).then(async (entries) => {
          if (!active) return;
          setDiary(entries);
          const venueMap = await getVenuesByIds(entries.map((e) => e.play.venueId));
          if (active) setVenues(venueMap);
        }),
        // Signed-out visitors can read a profile; only the follow and block
        // states are meaningless for them.
        session
          ? isFollowing(id).then((f) => {
              if (active) setFollowing(f);
            })
          : Promise.resolve(),
        session
          ? isBlocked(id).then((b) => {
              if (active) setBlocked(b);
            })
          : Promise.resolve(),
      ])
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [id, session])
  );

  async function toggleFollow() {
    if (!id || busy) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    // Flipped straight away and rolled back on failure: a follow button that
    // waits for a round trip before changing gets pressed twice.
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      if (next) await followUser(id);
      else await unfollowUser(id);
      setUser(await getUserById(id));
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Blocking, and undoing it.
   *
   * Not optimistic, unlike follow above. A follow that flickers back costs
   * nothing; a block that appears to have worked and has not is the one case in
   * this app where being wrong for a second matters, because the whole point of
   * pressing it is to stop seeing somebody.
   *
   * The diary is re-read afterwards rather than cleared locally: the rows are
   * filtered by the policies in 0037, so what a blocked profile looks like is
   * the database's answer, not a guess made here.
   */
  async function toggleBlock() {
    if (!id || busy) return;
    setBusy(true);
    setBlockError(undefined);
    try {
      if (blocked) {
        await unblockUser(id);
        setBlocked(false);
      } else {
        await blockUser(id);
        setBlocked(true);
        // The trigger in 0037 drops the follow in both directions, so the
        // button beside this one is now wrong until it is told.
        setFollowing(false);
      }
      setConfirmingBlock(false);
      setDiary(await getDiaryEntriesForUser(id));
    } catch {
      setBlockError(blocked ? strings.moderation.unblockFailed : strings.moderation.blockFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  // Your own profile has a screen of its own, and reporting or blocking
  // yourself is only ever a mistake.
  const isMe = session?.user?.id === id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={user.name} fallbackRoute="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ paddingHorizontal: gutter, gap: space.lg }}>
          <View style={styles.profileRow}>
            <Avatar uri={user.avatarUrl} initials={user.initials} size={72} serif />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading">{user.name}</Text>
              <Text variant="bodySmall" tone="faint">
                {[`@${user.handle}`, user.city].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>

          {/* Under the row rather than beside the name: a bio runs to three
              lines often enough that squeezing it next to a 72pt avatar would
              set it two words wide. */}
          {!!user.bio && (
            <Text variant="bodySmall" tone="dim">
              {user.bio}
            </Text>
          )}

          {/* A blocked account keeps its follow button out of the way: the
              trigger in 0037 has already dropped any follow between the two,
              and offering to re-create one that the insert policy now refuses
              is a button whose only outcome is an error. */}
          {!blocked && (
            <Button
              label={
                !session
                  ? strings.people.signInToFollow
                  : following
                    ? strings.people.followingLabel
                    : strings.people.follow
              }
              variant={following ? "outline" : "primary"}
              disabled={busy}
              onPress={toggleFollow}
            />
          )}

          {blocked && (
            <View style={styles.blockedNotice}>
              <Text variant="label" tone="dim">{strings.moderation.blocked}</Text>
              <Button
                label={strings.moderation.unblock}
                variant="outline"
                disabled={busy}
                onPress={toggleBlock}
              />
            </View>
          )}

          <View style={styles.statsRow}>
            <Stat value={user.stats.playsSeen} label={strings.profile.playsSeen} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.followers} label={strings.profile.followers} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.following} label={strings.profile.following} />
          </View>

          <View style={{ gap: space.sm }}>
            <Text variant="subheading">{strings.people.diaryTitle}</Text>
            {/* A list, like the profile's own diary: a column of poster
                stand-ins tells you nothing about what someone has seen. */}
            {loaded && diary.length === 0 ? (
              <Text variant="bodySmall" tone="faint">{strings.people.diaryEmpty}</Text>
            ) : (
              <View style={{ gap: space.lg }}>
                {diary.map((entry) => (
                  <PlayRow
                    key={entry.review.id}
                    play={entry.play}
                    // Somebody else's evening is worth reading too — that is
                    // the whole point of recording who was on.
                    onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.review.id } })}
                    meta={
                      <Text variant="caption" tone="faint" numberOfLines={1}>
                        {venues.get(entry.play.venueId)?.name ?? entry.play.author}
                      </Text>
                    }
                    trailing={
                      entry.review.ratingOverall !== undefined ? (
                        <MaskRatingRow rating={entry.review.ratingOverall} size={13} />
                      ) : undefined
                    }
                  />
                ))}
              </View>
            )}
          </View>

          {/* Below the diary, not beside Follow.
              These are rare, deliberate actions and they read as quieter
              text links rather than buttons, for the same reason the delete
              control on a diary entry does: a destructive option with the
              same weight as the primary one gets pressed by accident. */}
          {!!session && !isMe && (
            <View style={styles.safetyRow}>
              <Pressable
                onPress={() => setReporting(true)}
                disabled={reported}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ disabled: reported }}
              >
                <Text variant="caption" tone={reported ? "faint" : "dim"}>
                  {reported ? strings.moderation.reported : strings.moderation.report}
                </Text>
              </Pressable>
              {!blocked && (
                <Pressable
                  onPress={() => setConfirmingBlock(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  aria-expanded={confirmingBlock}
                  accessibilityState={{ expanded: confirmingBlock }}
                >
                  <Text variant="caption" tone="dim">{strings.moderation.block}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Confirmed, and it says what it will actually do. Blocking is
              reversible, but it also silently drops a follow in both
              directions, and a control that undoes a relationship without
              mentioning it is a control people learn not to trust. */}
          {confirmingBlock && (
            <View style={styles.confirmCard}>
              <Text variant="subheading">{strings.moderation.blockConfirmTitle(user.name)}</Text>
              <Text variant="bodySmall" tone="dim">{strings.moderation.blockConfirmBody}</Text>
              {!!blockError && (
                <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                  {blockError}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Button
                  label={strings.common.cancel}
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setConfirmingBlock(false)}
                />
                <Button
                  label={strings.moderation.blockConfirm}
                  style={{ flex: 1 }}
                  disabled={busy}
                  onPress={toggleBlock}
                />
              </View>
            </View>
          )}

          {/* Sits outside the confirm card so an unblock failure has somewhere
              to be read once the card has gone. */}
          {!!blockError && !confirmingBlock && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
              {blockError}
            </Text>
          )}
        </ContentColumn>
      </ScrollView>

      {!!id && (
        <ReportSheet
          target="profile"
          targetId={id}
          visible={reporting}
          onClose={() => setReporting(false)}
          onReported={() => setReported(true)}
        />
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text variant="subheading">{value}</Text>
      <Text variant="caption" tone="faint">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
  },
  statDivider: { width: 1, height: 28, backgroundColor: colors.hairline },
  blockedNotice: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: space.md,
  },
  safetyRow: {
    flexDirection: "row",
    gap: space["2xl"],
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  confirmCard: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: space.md,
  },
});
