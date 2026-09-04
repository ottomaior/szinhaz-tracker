import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { getDiaryPlaysForUser, getUserById } from "@/services/playsService";
import { followUser, isFollowing, unfollowUser } from "@/services/followService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, User } from "@/data/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { Grid } from "@/components/ui/Grid";
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
  const [diary, setDiary] = useState<Play[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      setLoaded(false);
      Promise.all([
        getUserById(id).then((u) => {
          if (active) setUser(u);
        }),
        getDiaryPlaysForUser(id).then((plays) => {
          if (active) setDiary(plays);
        }),
        // Signed-out visitors can read a profile; only the follow state is
        // meaningless for them.
        session
          ? isFollowing(id).then((f) => {
              if (active) setFollowing(f);
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

  if (!user) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={user.name} fallbackRoute="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ paddingHorizontal: gutter, gap: space.lg }}>
          <View style={styles.profileRow}>
            <Avatar initials={user.initials} size={72} serif />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading">{user.name}</Text>
              <Text variant="bodySmall" tone="faint">
                {[`@${user.handle}`, user.city].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>

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

          <View style={styles.statsRow}>
            <Stat value={user.stats.playsSeen} label={strings.profile.playsSeen} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.followers} label={strings.profile.followers} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.following} label={strings.profile.following} />
          </View>

          <View style={{ gap: space.sm }}>
            <Text variant="subheading">{strings.people.diaryTitle}</Text>
            {loaded && diary.length === 0 ? (
              <Text variant="bodySmall" tone="faint">{strings.people.diaryEmpty}</Text>
            ) : (
              <Grid gap={space.sm} columns={{ compact: 4, medium: 5, expanded: 6, wide: 8 }}>
                {diary.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.gridItem}
                    onPress={() => router.push(`/play/${p.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={p.title}
                  >
                    <PosterPlaceholder poster={p.poster} title={p.title} seed={p.id} height="100%" radius={radius.sm} preferThumb />
                  </Pressable>
                ))}
              </Grid>
            )}
          </View>
        </ContentColumn>
      </ScrollView>
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
  gridItem: { aspectRatio: 3 / 4 },
});
