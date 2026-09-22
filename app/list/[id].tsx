import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, hairlineWidth, space } from "@/theme/tokens";
import { deleteList, getList, removeFromList, updateList, type ListDetail, addToList } from "@/services/listsService";
import { getCurrentUser, getVenuesByIds } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Venue } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListForm, type ListFormValues } from "@/components/ui/ListForm";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ConfirmCard } from "@/components/ui/Cards";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { PlayRow } from "@/components/ui/PlayRow";
import { ContentColumn } from "@/components/ui/Screen";
import { RowSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { typeScale } from "@/theme/type";
import { makeStyles } from "@/theme/styles";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/utils/haptics";

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
  const toast = useToast();
  const { session } = useAuth();

  const [list, setList] = useState<ListDetail>();
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
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

  async function handleRemove(playId: string, title: string, note?: string) {
    if (!list || busy) return;
    const listId = list.id;
    setBusy(true);
    setNotice(undefined);
    try {
      await removeFromList(listId, playId);
      await load();
      haptic("warning");
      // A tap meant for the row used to remove the play with no way back
      // (T-078). The undo puts it back with its note; a ranked list's order
      // is the one thing that does not survive, and the row lands last.
      toast.show({
        message: strings.feedback.listEntryRemoved(title),
        action: {
          label: strings.feedback.undo,
          onPress: async () => {
            await addToList(listId, playId, note ?? "");
            await load();
          },
        },
      });
    } catch {
      setNotice(strings.lists.removeError);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The four things a list is, changed in place. No refetch: the row came
   * back from the update, and the entries have not moved.
   */
  async function handleEdit(values: ListFormValues) {
    if (!list) return;
    try {
      await updateList(list.id, values);
    } catch {
      throw new Error(strings.lists.updateError);
    }
    setList({ ...list, ...values });
    setEditing(false);
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
              <Skeleton width="70%" height={typeScale.title.lineHeight} />
              <Skeleton width="90%" height={space.lg} />
              <View>
                {[0, 1, 2].map((i) => (
                  <RowSkeleton key={i} />
                ))}
              </View>
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
                {/* What kind of list this is, as tags rather than as a
                    joined caption: "12 előadás · Rangsorolt · Privát" read as
                    one sentence about the count. */}
                <View style={styles.tagRow}>
                  <Text variant="caption" tone="faint">{strings.lists.itemCount(list.itemCount)}</Text>
                  {list.isRanked && <Chip label={strings.lists.rankedBadge} />}
                  {list.isFeatured && <Chip label={strings.lists.featuredBadge} />}
                  {!list.isPublic && <Chip label={strings.lists.privateBadge} />}
                </View>
              </View>

              {!!notice && <Notice>{notice}</Notice>}

              {list.entries.length === 0 && (
                <EmptyState
                  title={strings.lists.emptyListTitle}
                  body={isOwner ? strings.lists.emptyListBodyOwner : strings.lists.emptyListBody}
                  actionLabel={isOwner ? strings.lists.browseToAdd : undefined}
                  onAction={isOwner ? () => router.push("/(tabs)/discover") : undefined}
                />
              )}

              <View>
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
                        {/* Only while editing (T-078): a control that is
                            always live inside a tappable row is the one a
                            tap meant for the row hits. */}
                        {isOwner && editing && (
                          <Button
                            variant="text"
                            size="sm"
                            label={strings.lists.removeEntry}
                            onPress={() => handleRemove(entry.play.id, entry.play.title, entry.note)}
                            disabled={busy}
                          />
                        )}
                      </View>
                    }
                  />
                ))}
              </View>

              {isOwner && (
                <View style={styles.ownerZone}>
                  {editing ? (
                    <ListForm
                      initial={list}
                      submitLabel={strings.lists.save}
                      submittingLabel={strings.lists.saving}
                      onSubmit={handleEdit}
                      onCancel={() => setEditing(false)}
                    />
                  ) : confirmingDelete ? (
                    <ConfirmCard
                      title={strings.lists.deleteConfirmTitle}
                      body={strings.lists.deleteConfirmBody(list.itemCount)}
                      confirmLabel={strings.lists.deleteList}
                      cancelLabel={strings.common.cancel}
                      onConfirm={handleDelete}
                      onCancel={() => setConfirmingDelete(false)}
                      busy={busy}
                    />
                  ) : (
                    <View style={styles.ownerActions}>
                      <Button variant="outline" size="sm" label={strings.lists.editList} onPress={() => setEditing(true)} />
                      <Button variant="text" size="sm" label={strings.lists.deleteList} onPress={() => setConfirmingDelete(true)} />
                    </View>
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
  tagRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  ownerZone: {
    gap: space.md,
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.lg,
  },
  ownerActions: { flexDirection: "row", gap: space.sm },
}));
