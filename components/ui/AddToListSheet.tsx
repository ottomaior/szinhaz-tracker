import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { space } from "@/theme/tokens";
import { addToList, getListIdsContaining, getLists, removeFromList, type ListSummary } from "@/services/listsService";
import { getCurrentUser } from "@/services/playsService";
import { CheckIcon } from "@/components/icons/Icons";
import { Sheet, SheetFooter, SheetOption, sheetScroll } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

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
    <Sheet visible={visible} onClose={onClose} title={strings.lists.addToListTitle}>
          {!!error && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent" style={{ paddingVertical: space.sm }}>
              {error}
            </Text>
          )}

          <ScrollView {...sheetScroll}>
            {lists?.length === 0 && (
              <Text variant="bodySmall" tone="dim" style={{ paddingVertical: space.md }}>
                {strings.lists.noListsYet}
              </Text>
            )}

            {lists?.map((list) => {
              const isIn = contained.has(list.id);
              return (
                <SheetOption
                  key={list.id}
                  onPress={() => toggle(list)}
                  disabled={!!busyId && busyId !== list.id}
                  selected={isIn}
                  busy={busyId === list.id}
                  trailing={isIn ? <CheckIcon /> : undefined}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="body" tone={isIn ? "accent" : "default"}>
                      {list.title}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {strings.lists.itemCount(list.itemCount)}
                    </Text>
                  </View>
                </SheetOption>
              );
            })}
          </ScrollView>

          <SheetFooter>
            <Pressable onPress={onCreateList} accessibilityRole="button">
              <Text variant="label" tone="accent">
                {strings.lists.newList}
              </Text>
            </Pressable>
          </SheetFooter>
    </Sheet>
  );
}


