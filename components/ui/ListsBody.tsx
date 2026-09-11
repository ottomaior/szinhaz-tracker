import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { space } from "@/theme/tokens";
import { addToList, createList, getLists, type ListSummary } from "@/services/listsService";
import { getCurrentUser, getPlaysByIds } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play } from "@/data/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListCard } from "@/components/ui/ListCard";
import { ListForm, type ListFormValues } from "@/components/ui/ListForm";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { strings } from "@/i18n/hu";

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
 *
 * `attachPlayId` is how a production travels here from its own page: "Új
 * lista" on the add-to-list sheet used to land on this screen empty-handed,
 * and the list got made without the play the reader had in mind (T-062). With
 * it set the composer opens at once, says which production is coming along,
 * and puts it on the list the moment the list exists.
 */
export function ListsBody({ attachPlayId, attachTitle }: { attachPlayId?: string; attachTitle?: string } = {}) {
  const router = useRouter();
  const { session } = useAuth();

  const [featured, setFeatured] = useState<ListSummary[]>([]);
  const [mine, setMine] = useState<ListSummary[]>([]);
  const [playsById, setPlaysById] = useState<Map<string, Play>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const [composing, setComposing] = useState(!!attachPlayId);

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

  async function handleCreate(values: ListFormValues) {
    let created: ListSummary;
    try {
      created = await createList(values);
    } catch (e) {
      throw new Error(e instanceof Error && e.message ? e.message : strings.lists.createError);
    }
    if (attachPlayId) {
      // The list exists now, so a failure here is not worth stopping for:
      // the list screen's owner empty state says how to add by hand.
      await addToList(created.id, attachPlayId).catch(() => {});
    }
    setComposing(false);
    // Straight into the new list: it is empty — or holds the one production
    // it was made for — and the next thing anybody wants is to look at it.
    // `replace` when a play brought us here, so Back returns to that play
    // rather than to a composer with nothing left to compose.
    const target = { pathname: "/list/[id]" as const, params: { id: created.id } };
    if (attachPlayId) router.replace(target);
    else router.push(target);
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
            <ListForm
              key={attachPlayId ?? "new"}
              notice={attachPlayId && attachTitle ? strings.lists.attachNotice(attachTitle) : undefined}
              submitLabel={strings.lists.create}
              submittingLabel={strings.lists.creating}
              onSubmit={handleCreate}
              onCancel={() => setComposing(false)}
            />
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

