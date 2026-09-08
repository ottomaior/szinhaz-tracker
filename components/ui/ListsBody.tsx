import { useCallback, useState } from "react";
import { View, StyleSheet, TextInput, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { createList, getLists, type ListSummary } from "@/services/listsService";
import { getCurrentUser, getPlaysByIds } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListCard } from "@/components/ui/ListCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * Lists: the ones written here, and the ones you have made.
 *
 * The editorial lists come first and are shown to everybody, signed in or not.
 * That is the point of them — a brand-new account's Discover is otherwise
 * ranked by an average over four reviews, which is not a popularity signal, and
 * ten hand-made lists over 1,214 productions is a better first thing to read.
 *
 * The body of the screen, without a scroll view or a header, so it can be
 * both the Listák modal (still reachable from the profile and by URL) and the
 * Listák tab on Discover, which is where somebody browsing actually meets it.
 */
export function ListsBody() {
  const styles = useStyles();

  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session } = useAuth();

  const [featured, setFeatured] = useState<ListSummary[]>([]);
  const [mine, setMine] = useState<ListSummary[]>([]);
  const [playsById, setPlaysById] = useState<Map<string, Play>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isRanked, setIsRanked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const user = session ? await getCurrentUser() : undefined;
      const [featuredLists, myLists] = await Promise.all([
        getLists({ featuredOnly: true }),
        user ? getLists({ ownerId: user.id }) : Promise.resolve([] as ListSummary[]),
      ]);
      setFeatured(featuredLists);
      // A featured list of your own would otherwise appear in both sections.
      setMine(myLists.filter((l) => !l.isFeatured));

      // One lookup for every cover on the screen rather than four per card.
      const coverIds = [...featuredLists, ...myLists].flatMap((l) => l.coverPlayIds);
      const plays = await getPlaysByIds([...new Set(coverIds)]);
      setPlaysById(new Map(plays.map((p) => [p.id, p])));
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setError(undefined);
    setSaving(true);
    try {
      const created = await createList({ title: trimmed, description, isRanked });
      setComposing(false);
      setTitle("");
      setDescription("");
      setIsRanked(false);
      // Straight into the new list: it is empty, and the next thing anybody
      // wants is to put something in it.
      router.push({ pathname: "/list/[id]", params: { id: created.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.lists.createError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: space["2xl"] }}>
      {loaded && failed && (
        <EmptyState title={strings.common.loadError} actionLabel={strings.common.retry} onAction={load} />
      )}

      {featured.length > 0 && (
        <View style={{ gap: space.sm }}>
          <SectionHeader eyebrow={strings.lists.featuredEyebrow} title={strings.lists.featuredHeading} />
          {featured.map((list) => (
            <ListCard key={list.id} list={list} playsById={playsById} onPress={() => router.push({ pathname: "/list/[id]", params: { id: list.id } })} />
          ))}
        </View>
      )}

      {!session ? (
        <EmptyState
          eyebrow={strings.lists.mineHeading}
          title={strings.lists.signInTitle}
          body={strings.lists.signInBody}
          actionLabel={strings.profile.signInButton}
          onAction={() => router.push("/sign-in")}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          <SectionHeader
            eyebrow={strings.lists.mineEyebrow}
            title={strings.lists.mineHeading}
            action={composing ? undefined : strings.lists.newList}
            onAction={() => setComposing(true)}
          />

          {composing && (
            <View style={styles.composer}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={strings.lists.titlePlaceholder}
                placeholderTextColor={colors.textFaint}
                maxLength={120}
                style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={strings.lists.descriptionPlaceholder}
                placeholderTextColor={colors.textFaint}
                multiline
                style={[styles.input, styles.textArea, { fontFamily: bodyFont(fontsLoaded) }]}
              />

              {/* Whether the order is a judgement. Recorded rather than
                  inferred, because numbering a list its author never
                  ranked asserts something they did not say. */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall">{strings.lists.rankedLabel}</Text>
                  <Text variant="caption" tone="faint">{strings.lists.rankedHint}</Text>
                </View>
                <Switch
                  value={isRanked}
                  onValueChange={setIsRanked}
                  trackColor={{ false: colors.surface2, true: colors.goldDeep }}
                  thumbColor={isRanked ? colors.gold : colors.textFaint}
                />
              </View>

              {!!error && (
                <Text accessibilityRole="alert" variant="bodySmall" tone="accent">{error}</Text>
              )}

              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button
                  label={strings.common.cancel}
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setComposing(false);
                    setError(undefined);
                  }}
                />
                <Button
                  label={saving ? strings.lists.creating : strings.lists.create}
                  style={{ flex: 1 }}
                  disabled={saving || !title.trim()}
                  onPress={handleCreate}
                />
              </View>
            </View>
          )}

          {loaded && !failed && mine.length === 0 && !composing && (
            <EmptyState
              title={strings.lists.emptyTitle}
              body={strings.lists.emptyBody}
              actionLabel={strings.lists.newList}
              onAction={() => setComposing(true)}
            />
          )}

          {mine.map((list) => (
            <ListCard key={list.id} list={list} playsById={playsById} onPress={() => router.push({ pathname: "/list/[id]", params: { id: list.id } })} />
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  composer: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.text,
    // 16px: iOS Safari zooms the page whenever a focused field's text is
    // smaller. See the note in README's design system section.
    fontSize: inputFontSize,
  },
  textArea: { minHeight: 68, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
}));
