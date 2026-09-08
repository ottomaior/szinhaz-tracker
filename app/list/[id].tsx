import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { deleteList, getList, removeFromList, type ListDetail } from "@/services/listsService";
import { getCurrentUser, getVenuesByIds } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Venue } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PlayRow } from "@/components/ui/PlayRow";
import { ContentColumn } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * One list, and what is on it.
 *
 * Numbering appears only when the list `is_ranked`. An unranked list is a
 * gathering, not a verdict, and putting "1." beside its first entry would
 * publish a judgement its author never made.
 */
export default function ListScreen() {
  const styles = useStyles();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [list, setList] = useState<ListDetail>();
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    if (!id) return;
    setFailed(false);
    try {
      const detail = await getList(id);
      setList(detail);
      if (detail) {
        const [venueMap, user] = await Promise.all([
          getVenuesByIds(detail.entries.map((e) => e.play.venueId)),
          session ? getCurrentUser() : Promise.resolve(undefined),
        ]);
        setVenues(venueMap);
        setIsOwner(!!user && user.id === detail.ownerId);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRemove(playId: string) {
    if (!list || busy) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await removeFromList(list.id, playId);
      await load();
    } catch {
      setNotice(strings.lists.removeError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!list || busy) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await deleteList(list.id);
      router.back();
    } catch {
      setNotice(strings.lists.deleteError);
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={list?.title ?? strings.lists.headerFallback} />

      <ScrollView contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          {!loaded && (
            <View style={{ gap: space.lg }}>
              <Skeleton width="70%" height={26} />
              <Skeleton width="90%" height={14} />
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flexDirection: "row", gap: space.md }}>
                  <Skeleton width={56} height={84} radius={radius.sm} />
                  <View style={{ flex: 1, gap: space.sm }}>
                    <Skeleton width="80%" height={16} />
                    <Skeleton width="50%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {loaded && failed && (
            <EmptyState title={strings.common.loadError} actionLabel={strings.common.retry} onAction={load} />
          )}

          {/* Private, deleted, or never there: all the same "not for you" from
              out here, and worth saying once rather than three ways. */}
          {loaded && !failed && !list && (
            <EmptyState title={strings.lists.notFoundTitle} body={strings.lists.notFoundBody} />
          )}

          {loaded && !failed && !!list && (
            <>
              <View style={{ gap: space.sm }}>
                <Text variant="display">{list.title}</Text>
                {!!list.description && (
                  <Text variant="body" tone="dim">
                    {list.description}
                  </Text>
                )}
                <Text variant="caption" tone="faint">
                  {[
                    strings.lists.itemCount(list.itemCount),
                    list.isRanked ? strings.lists.rankedBadge : undefined,
                    list.isFeatured ? strings.lists.featuredBadge : undefined,
                    list.isPublic ? undefined : strings.lists.privateBadge,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>

              {!!notice && (
                <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                  {notice}
                </Text>
              )}

              {list.entries.length === 0 && (
                <EmptyState
                  title={strings.lists.emptyListTitle}
                  body={isOwner ? strings.lists.emptyListBodyOwner : strings.lists.emptyListBody}
                  actionLabel={isOwner ? strings.lists.browseToAdd : undefined}
                  onAction={isOwner ? () => router.push("/(tabs)/discover") : undefined}
                />
              )}

              <View style={{ gap: space.md }}>
                {list.entries.map((entry, i) => (
                  <PlayRow
                    key={entry.play.id}
                    play={entry.play}
                    onPress={() => router.push(`/play/${entry.play.id}`)}
                    meta={
                      <>
                        <Text variant="caption" tone="faint" numberOfLines={1}>
                          {[venues.get(entry.play.venueId)?.name, entry.play.premiereDate?.slice(0, 4)]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                        {/* The sentence about why this one is here. Often the
                            most interesting thing on the row, so it gets the
                            readable tone rather than the metadata one. */}
                        {!!entry.note && (
                          <Text variant="caption" tone="dim">
                            {entry.note}
                          </Text>
                        )}
                      </>
                    }
                    trailing={
                      <View style={{ alignItems: "flex-end", gap: space.sm }}>
                        {list.isRanked && (
                          <Text variant="numeral">
                            {i + 1}
                          </Text>
                        )}
                        {isOwner && (
                          <Pressable
                            onPress={() => handleRemove(entry.play.id)}
                            hitSlop={8}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel={strings.lists.removeEntry}
                          >
                            <Text variant="caption" tone="faint">
                              {strings.lists.removeEntry}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    }
                  />
                ))}
              </View>

              {isOwner && (
                <View style={styles.ownerZone}>
                  {confirmingDelete ? (
                    <>
                      <Text variant="subheading">{strings.lists.deleteConfirmTitle}</Text>
                      <Text variant="bodySmall" tone="dim">
                        {strings.lists.deleteConfirmBody(list.itemCount)}
                      </Text>
                      <View style={{ flexDirection: "row", gap: space.sm }}>
                        <Button
                          label={strings.common.cancel}
                          variant="outline"
                          style={{ flex: 1 }}
                          onPress={() => setConfirmingDelete(false)}
                        />
                        <Button label={strings.lists.deleteList} style={{ flex: 1 }} disabled={busy} onPress={handleDelete} />
                      </View>
                    </>
                  ) : (
                    <Pressable onPress={() => setConfirmingDelete(true)} accessibilityRole="button" hitSlop={8}>
                      <Text variant="label" tone="faint">
                        {strings.lists.deleteList}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  ownerZone: {
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.lg,
  },
}));
