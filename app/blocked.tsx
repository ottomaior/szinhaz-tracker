import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, minTouchTarget, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { getBlockedUsers, unblockUser, type BlockedPerson } from "@/services/moderationService";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * Everyone this account has blocked, and the way to undo it.
 *
 * A block has to be reversible somewhere that does not require finding the
 * person again — which is the one thing the block has just made hard, since
 * their profile no longer surfaces in search and their writing is gone from
 * every screen. Without this list a block is effectively permanent, and a
 * permanent block is one people are afraid to use.
 *
 * Reached from Settings rather than from the profile for that reason, and
 * signed-in only: there is no such list without an account.
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [people, setPeople] = useState<BlockedPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let active = true;
      getBlockedUsers()
        .then((rows) => {
          if (active) setPeople(rows);
        })
        .catch(() => {
          if (active) setError(strings.common.loadError);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [session])
  );

  async function unblock(person: BlockedPerson) {
    if (busyId) return;
    setBusyId(person.id);
    setError(undefined);
    try {
      await unblockUser(person.id);
      // Removed from the list rather than re-fetched: the row is gone from the
      // table, and a round trip to confirm it would leave the name sitting
      // there looking as though the press did nothing.
      setPeople((current) => current.filter((p) => p.id !== person.id));
    } catch {
      setError(strings.moderation.unblockFailed);
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.moderation.blockedListTitle} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
          {!session ? (
            <EmptyState title={strings.moderation.blockedListEmpty} />
          ) : (
            <>
              <Text variant="bodySmall" tone="dim">
                {strings.moderation.blockedListLead}
              </Text>

              {!!error && (
                <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                  {error}
                </Text>
              )}

              {loaded && people.length === 0 && (
                <Text variant="bodySmall" tone="faint">
                  {strings.moderation.blockedListEmpty}
                </Text>
              )}

              <View style={{ gap: space.md }}>
                {people.map((person) => (
                  <View key={person.id} style={styles.row}>
                    {/* Their profile still opens — `profiles` stays readable
                        when a block hides the writing, precisely so this list
                        is not a column of blanks. */}
                    <Pressable
                      onPress={() => router.push(`/user/${person.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={person.name}
                      style={styles.person}
                    >
                      <Avatar uri={person.avatarUrl} initials={person.initials} size={36} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label" numberOfLines={1}>
                          {person.name}
                        </Text>
                        {!!person.handle && (
                          <Text variant="caption" tone="faint" numberOfLines={1}>
                            {`@${person.handle}`}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => unblock(person)}
                      disabled={!!busyId}
                      hitSlop={8}
                      accessibilityRole="button"
                      aria-busy={busyId === person.id}
                      accessibilityState={{ busy: busyId === person.id, disabled: !!busyId }}
                      style={{ opacity: busyId === person.id ? 0.5 : 1 }}
                    >
                      <Text variant="caption" tone="accent">
                        {strings.moderation.unblock}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouchTarget,
  },
  person: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
});
