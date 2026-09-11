import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, space } from "@/theme/tokens";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { getFollowing, searchPeople, type PersonSummary } from "@/services/followService";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { SearchField } from "@/components/ui/SearchField";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";
import { foldSearchTerm } from "@/utils/search";

/**
 * Finding people to follow.
 *
 * With nothing typed it lists who you already follow, so the screen is useful
 * as a "who am I following" list too rather than an empty search box.
 */
export default function PeopleScreen() {
  const styles = useStyles();

  const router = useRouter();
  const { session } = useAuth();

  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<PersonSummary[]>([]);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;
  // Debounced, deduplicated and kept in order by the hook; a handle typed
  // with a stray accent folds to the same key as one typed without.
  const search = useSearchQuery(isSearching ? foldSearchTerm(trimmed) : null, () => searchPeople(trimmed));
  const results = search.data ?? [];
  const searching = search.loading && !search.data;

  useEffect(() => {
    if (!session) return;
    getFollowing()
      .then(setFollowing)
      .catch(() => setFollowing([]));
  }, [session]);

  const shown = isSearching ? results : following;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.people.searchTitle} fallbackRoute="/(tabs)" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ paddingHorizontal: gutter, gap: space.lg }}>
          <View style={styles.searchRow}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={strings.people.searchPlaceholder}
              loading={isSearching && search.loading}
              handleMode
            />
          </View>

          {!isSearching && !!session && (
            <Text variant="label" tone="dim">{strings.people.followingTitle}</Text>
          )}

          {/* Search works without an account; the list of who you follow
              does not exist without one. This used to show a signed-in
              user's empty state — "Még senkit nem követ." — to a visitor who
              had nobody to follow with (T-063). */}
          {!isSearching && !session && (
            <View style={{ gap: space.md, alignItems: "flex-start" }}>
              <Text variant="body" tone="dim">{strings.people.signInPrompt}</Text>
              <Button label={strings.auth.signInButton} onPress={() => router.push("/sign-in")} />
            </View>
          )}

          <View style={{ gap: space.xs }}>
            {shown.map((person) => (
              <Pressable
                key={person.id}
                style={styles.row}
                onPress={() => router.push(`/user/${person.id}`)}
                accessibilityRole="button"
                accessibilityLabel={person.name}
              >
                <Avatar uri={person.avatarUrl} initials={person.initials} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{person.name}</Text>
                  <Text variant="caption" tone="faint">
                    {[`@${person.handle}`, person.city].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {!searching && shown.length === 0 && (isSearching || !!session) && (
            <Text variant="bodySmall" tone="faint">
              {isSearching ? strings.people.searchEmpty : strings.people.followingEmpty}
            </Text>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  searchRow: { marginTop: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
}));
