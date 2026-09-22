import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptFollowRequest,
  declineFollowRequest,
  getFollowRequests,
  getFollowers,
  getFollowing,
  removeFollower,
  unfollowUser,
  type PersonSummary,
} from "@/services/followService";
import { PersonRow } from "@/components/ui/Rows";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PillTabs } from "@/components/ui/PillTabs";
import { ContentColumn } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/utils/haptics";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * Who follows you, who you follow, and who is asking (T-096, T-095).
 *
 * Opened from the two numbers on your own profile, which used to open
 * nothing. Three tabs on one screen rather than three screens, because the
 * question behind all of them is the same — who are the people around this
 * diary — and because the third tab is the one that needs answering: a
 * follow is a request now, and this is where it is accepted or declined.
 *
 * Every row leads to the person. The trailing action is the one thing you
 * can do about them from here: accept or decline a request, remove a
 * follower, or stop following. All three are immediate and answered with a
 * toast; none of them notifies the other person, because being told you
 * were removed is itself a form of contact.
 */
type Tab = "followers" | "following" | "requests";

export default function FollowersScreen() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<Tab>(
    params.tab === "following" || params.tab === "requests" ? params.tab : "followers"
  );
  const [followers, setFollowers] = useState<PersonSummary[]>();
  const [following, setFollowing] = useState<PersonSummary[]>();
  const [requests, setRequests] = useState<PersonSummary[]>();
  const [busyId, setBusyId] = useState<string>();

  const load = useCallback(async () => {
    if (!session) return;
    const me = session.user.id;
    const [a, b, c] = await Promise.all([
      getFollowers(me).catch(() => []),
      getFollowing(me).catch(() => []),
      getFollowRequests().catch(() => []),
    ]);
    setFollowers(a);
    setFollowing(b);
    setRequests(c);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().then(() => {
        if (!active) return;
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  async function act(personId: string, fn: () => Promise<void>, message: string) {
    if (busyId) return;
    setBusyId(personId);
    try {
      await fn();
      haptic("selection");
      toast.show({ message });
      await load();
    } catch {
      toast.show({ message: strings.common.loadError });
    } finally {
      setBusyId(undefined);
    }
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={strings.people.followersTitle} fallbackRoute="/(tabs)/profile" />
        <ContentColumn style={{ padding: gutter }}>
          <EmptyState title={strings.people.signInPrompt} actionLabel={strings.auth.signInButton} onAction={() => router.push("/sign-in")} />
        </ContentColumn>
      </View>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "followers", label: `${strings.people.followersTitle}${followers ? ` · ${followers.length}` : ""}` },
    { key: "following", label: `${strings.people.followingTitle}${following ? ` · ${following.length}` : ""}` },
    { key: "requests", label: `${strings.people.requestsTitle}${requests && requests.length > 0 ? ` · ${requests.length}` : ""}` },
  ];

  const list = tab === "followers" ? followers : tab === "following" ? following : requests;
  const emptyTitle =
    tab === "followers" ? strings.people.followersEmpty : tab === "following" ? strings.people.followingEmpty : strings.people.requestsEmpty;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.people.followersTitle} fallbackRoute="/(tabs)/profile" />
      <ScrollView contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
          <PillTabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === "requests" && (
            <Text variant="bodySmall" tone="dim">
              {strings.people.requestsHint}
            </Text>
          )}

          {!list && (
            <View style={{ gap: space.sm }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
                  <Skeleton width={44} height={44} radius={22} />
                  <View style={{ flex: 1, gap: space.xs }}>
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="40%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {list && list.length === 0 && <EmptyState title={emptyTitle} />}

          {list && list.length > 0 && (
            <View>
              {list.map((person) => {
                const busy = busyId === person.id;
                return (
                  <PersonRow
                    key={person.id}
                    name={person.name}
                    meta={[`@${person.handle}`, person.city].filter(Boolean).join(" · ")}
                    avatarUri={person.avatarUrl}
                    initials={person.initials}
                    onPress={() => router.push(`/user/${person.id}`)}
                    action={
                      tab === "requests" ? (
                        <View style={styles.actions}>
                          <Button
                            label={strings.people.accept}
                            size="sm"
                            disabled={busy}
                            onPress={() =>
                              act(person.id, () => acceptFollowRequest(person.id), strings.people.acceptedToast(person.name))
                            }
                          />
                          <Button
                            label={strings.people.decline}
                            variant="text"
                            size="sm"
                            disabled={busy}
                            onPress={() =>
                              act(person.id, () => declineFollowRequest(person.id), strings.people.declinedToast(person.name))
                            }
                          />
                        </View>
                      ) : tab === "followers" ? (
                        <Button
                          label={strings.people.removeFollower}
                          variant="text"
                          size="sm"
                          disabled={busy}
                          onPress={() => act(person.id, () => removeFollower(person.id), strings.people.removedToast(person.name))}
                        />
                      ) : (
                        <Button
                          label={strings.people.unfollow}
                          variant="text"
                          size="sm"
                          disabled={busy}
                          onPress={() => act(person.id, () => unfollowUser(person.id), strings.feedback.unfollowed(person.name))}
                        />
                      )
                    }
                  />
                );
              })}
            </View>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: space.xs },
}));
