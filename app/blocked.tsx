import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useColors } from "@/theme/styles";
import { gutter, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { getBlockedUsers, unblockUser, type BlockedPerson } from "@/services/moderationService";
import { PersonRow } from "@/components/ui/Rows";
import { Button } from "@/components/ui/Button";
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

  const colors = useColors();

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
                <EmptyState align="center" title={strings.moderation.blockedListEmpty} />
              )}

              <View>
                {people.map((person) => (
                  // Their profile still opens — `profiles` stays readable when
                  // a block hides the writing, precisely so this list is not a
                  // column of blanks.
                  <PersonRow
                    key={person.id}
                    name={person.name}
                    meta={person.handle ? `@${person.handle}` : undefined}
                    avatarUri={person.avatarUrl}
                    initials={person.initials}
                    onPress={() => router.push(`/user/${person.id}`)}
                    action={
                      <Button
                        variant="text"
                        size="sm"
                        label={strings.moderation.unblock}
                        onPress={() => unblock(person)}
                        disabled={!!busyId}
                        loading={busyId === person.id}
                      />
                    }
                  />
                ))}
              </View>
            </>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}


