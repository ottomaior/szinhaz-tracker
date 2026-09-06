import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getFollowing, searchPeople, type PersonSummary } from "@/services/followService";
import { useAuth } from "@/contexts/AuthContext";
import { SearchIcon, CloseIcon } from "@/components/icons/Icons";
import { Avatar } from "@/components/ui/Avatar";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * Finding people to follow.
 *
 * With nothing typed it lists who you already follow, so the screen is useful
 * as a "who am I following" list too rather than an empty search box.
 */
export default function PeopleScreen() {
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSummary[]>([]);
  const [following, setFollowing] = useState<PersonSummary[]>([]);
  const [searching, setSearching] = useState(false);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!session) return;
    getFollowing()
      .then(setFollowing)
      .catch(() => setFollowing([]));
  }, [session]);

  useEffect(() => {
    if (!isSearching) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    // Same 300ms debounce as the play search, for the same reason: a query per
    // keystroke is a query per keystroke.
    const handle = setTimeout(() => {
      searchPeople(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, isSearching]);

  const shown = isSearching ? results : following;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.people.searchTitle} fallbackRoute="/(tabs)" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ paddingHorizontal: gutter, gap: space.lg }}>
          <View style={styles.searchBar}>
            <SearchIcon />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={strings.people.searchPlaceholder}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.people.searchPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: inputFontSize, color: colors.text }}
            />
            {isSearching && (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.common.close}>
                <CloseIcon size={15} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          {!isSearching && (
            <Text variant="label" tone="dim">{strings.people.followingTitle}</Text>
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

          {!searching && shown.length === 0 && (
            <Text variant="bodySmall" tone="faint">
              {isSearching ? strings.people.searchEmpty : strings.people.followingEmpty}
            </Text>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginTop: space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
});
