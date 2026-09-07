import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { addToList, getListIdsContaining, getLists, removeFromList, type ListSummary } from "@/services/listsService";
import { getCurrentUser } from "@/services/playsService";
import { CheckIcon, CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * "Which of my lists does this belong on?"
 *
 * A sheet of the signed-in user's lists with a tick beside the ones that
 * already hold this production, and tapping one toggles it. Built on the same
 * sheet as SelectChip and DateField — the third place in the app where the
 * answer is "tap to choose", and a third idiom would read as a third kind of
 * thing.
 *
 * The state is read fresh each time it opens rather than passed in. Lists can
 * change on another screen between openings, and a tick that is a frame behind
 * is a tick that lies about what is saved.
 */
export function AddToListSheet({
  playId,
  visible,
  onClose,
  onCreateList,
}: {
  playId: string;
  visible: boolean;
  onClose: () => void;
  /** Escape hatch when there is nowhere to put it yet. */
  onCreateList: () => void;
}) {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<ListSummary[]>();
  const [contained, setContained] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError(undefined);
    setLists(undefined);

    getCurrentUser()
      .then((user) => (user ? getLists({ ownerId: user.id }) : []))
      .then(async (owned) => {
        if (!active) return;
        setLists(owned);
        setContained(await getListIdsContaining(playId));
      })
      .catch(() => {
        if (active) {
          setLists([]);
          setError(strings.common.loadError);
        }
      });

    return () => {
      active = false;
    };
  }, [visible, playId]);

  async function toggle(list: ListSummary) {
    if (busyId) return;
    setBusyId(list.id);
    setError(undefined);
    const wasIn = contained.has(list.id);
    try {
      if (wasIn) await removeFromList(list.id, playId);
      else await addToList(list.id, playId);

      setContained((current) => {
        const next = new Set(current);
        if (wasIn) next.delete(list.id);
        else next.add(list.id);
        return next;
      });
    } catch {
      setError(wasIn ? strings.lists.removeError : strings.lists.addError);
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      {/* Pinned with absoluteFill rather than `flex: 1` — on
          react-native-web a Modal's child inherits no definite height and the
          sheet otherwise collapses into the corner with no backdrop. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={strings.common.close}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => {}}>
          <View style={styles.grabber} />

          <View style={styles.sheetHeader}>
            <Text variant="subheading">{strings.lists.addToListTitle}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.common.close}>
              <CloseIcon size={17} color={colors.textDim} />
            </Pressable>
          </View>

          {!!error && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent" style={{ paddingVertical: space.sm }}>
              {error}
            </Text>
          )}

          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingBottom: space.sm }}>
            {lists?.length === 0 && (
              <Text variant="bodySmall" tone="dim" style={{ paddingVertical: space.md }}>
                {strings.lists.noListsYet}
              </Text>
            )}

            {lists?.map((list) => {
              const isIn = contained.has(list.id);
              return (
                <Pressable
                  key={list.id}
                  onPress={() => toggle(list)}
                  disabled={!!busyId}
                  accessibilityRole="button"
                  aria-pressed={isIn}
                  aria-busy={busyId === list.id}
                  accessibilityState={{ selected: isIn, busy: busyId === list.id }}
                  style={[styles.option, busyId === list.id && { opacity: 0.5 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="body" tone={isIn ? "accent" : "default"}>
                      {list.title}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {strings.lists.itemCount(list.itemCount)}
                    </Text>
                  </View>
                  {isIn && <CheckIcon size={16} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={onCreateList} style={styles.createRow} accessibilityRole="button">
            <Text variant="label" tone="accent">
              {strings.lists.newList}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    ...elevation.floating,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    marginBottom: space.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: space.sm,
    marginBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouchTarget,
    paddingVertical: space.sm,
  },
  createRow: {
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.md,
    alignItems: "center",
  },
}));
