import { supabase } from "@/services/supabase";
import { getPlaysByIds } from "@/services/playsService";
import type { Play } from "@/data/types";

/**
 * Lists — the productions somebody has gathered under a title.
 *
 * Two things share these tables. A list a person makes for themselves, and an
 * editorial list written from the SQL editor and marked `is_featured`, which is
 * how Discover gets something worth reading in front of an account on its first
 * run. `lists_guard_featured` in 0025 is what keeps the second kind from being
 * something anyone can declare about their own row.
 */

export type ListSummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  /** The order carries a judgement, so the detail screen numbers the entries. */
  isRanked: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  updatedAt: string;
  itemCount: number;
  /** Up to four productions, for the cover stack on the card. */
  coverPlayIds: string[];
};

export type ListEntry = {
  play: Play;
  /** Why this one is here — most of what makes a list worth reading. */
  note: string;
  position: number;
  addedAt: string;
};

export type ListDetail = ListSummary & { entries: ListEntry[] };

type SummaryRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  is_ranked: boolean;
  is_public: boolean;
  is_featured: boolean;
  updated_at: string;
  item_count: number;
  cover_play_ids: string[] | null;
};

function toSummary(row: SummaryRow): ListSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? "",
    isRanked: row.is_ranked,
    isPublic: row.is_public,
    isFeatured: row.is_featured,
    updatedAt: row.updated_at,
    itemCount: row.item_count ?? 0,
    coverPlayIds: row.cover_play_ids ?? [],
  };
}

/**
 * Lists, newest activity first.
 *
 * Row Level Security decides what comes back — a private list reaches nobody
 * but its owner, including in the counts — so this never filters on `is_public`
 * itself. `owner` and `featuredOnly` only narrow what the policy already allows.
 */
export async function getLists(options: { ownerId?: string; featuredOnly?: boolean } = {}): Promise<ListSummary[]> {
  const { data, error } = await supabase.rpc("list_summaries", {
    owner: options.ownerId ?? null,
    featured_only: options.featuredOnly ?? false,
  });
  if (error) throw error;
  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

export async function getList(id: string): Promise<ListDetail | undefined> {
  const [{ data: listRows, error: listError }, { data: itemRows, error: itemError }] = await Promise.all([
    supabase.rpc("list_summaries", { owner: null, featured_only: false }),
    supabase.from("list_items").select("play_id, note, position, added_at").eq("list_id", id),
  ]);
  if (listError) throw listError;
  if (itemError) throw itemError;

  const summary = ((listRows ?? []) as SummaryRow[]).find((r) => r.id === id);
  // Absent rather than an error: a list that is private, deleted, or never
  // existed is the same "not for you" from out here, and the screen says so
  // once rather than in three different ways.
  if (!summary) return undefined;

  const items = (itemRows ?? []) as { play_id: string; note: string; position: number; added_at: string }[];
  const plays = await getPlaysByIds(items.map((i) => i.play_id));
  const byId = new Map(plays.map((p) => [p.id, p]));

  const entries = items
    .map((i) => {
      const play = byId.get(i.play_id);
      return play ? { play, note: i.note ?? "", position: i.position ?? 0, addedAt: i.added_at } : undefined;
    })
    .filter((e): e is ListEntry => !!e)
    .sort((a, b) => {
      // Ranked lists obey their positions. Unranked ones stay in the order
      // their author added them, which is the order they were thinking in —
      // sorting those alphabetically would throw that away.
      if (summary.is_ranked && a.position !== b.position) return a.position - b.position;
      return a.addedAt.localeCompare(b.addedAt);
    });

  return { ...toSummary(summary), entries };
}

export async function createList(input: {
  title: string;
  description?: string;
  isRanked?: boolean;
  isPublic?: boolean;
}): Promise<ListSummary> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");

  const { data, error } = await supabase
    .from("lists")
    .insert({
      owner_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      is_ranked: input.isRanked ?? false,
      is_public: input.isPublic ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;

  const row = data as Omit<SummaryRow, "item_count" | "cover_play_ids">;
  return toSummary({ ...row, item_count: 0, cover_play_ids: [] });
}

export async function updateList(
  id: string,
  patch: { title?: string; description?: string; isRanked?: boolean; isPublic?: boolean }
): Promise<void> {
  const { error } = await supabase
    .from("lists")
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.isRanked !== undefined ? { is_ranked: patch.isRanked } : {}),
      ...(patch.isPublic !== undefined ? { is_public: patch.isPublic } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await supabase.from("lists").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Put a production on a list.
 *
 * `position` goes to the end. That is right for both kinds: on an unranked list
 * order is only chronology, and on a ranked one a new entry starting last is a
 * claim its author can then move rather than one made on their behalf.
 */
export async function addToList(listId: string, playId: string, note = ""): Promise<void> {
  const { data, error: countError } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1);
  if (countError) throw countError;

  const nextPosition = ((data?.[0]?.position as number | undefined) ?? -1) + 1;

  const { error } = await supabase
    .from("list_items")
    .upsert({ list_id: listId, play_id: playId, note, position: nextPosition }, { onConflict: "list_id,play_id" });
  if (error) throw error;
}

export async function removeFromList(listId: string, playId: string): Promise<void> {
  const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("play_id", playId);
  if (error) throw error;
}

/** Which of the signed-in user's lists already hold this production. */
export async function getListIdsContaining(playId: string): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("list_items")
    .select("list_id, lists!inner(owner_id)")
    .eq("play_id", playId)
    .eq("lists.owner_id", user.id);
  if (error) throw error;
  return new Set(((data ?? []) as { list_id: string }[]).map((r) => r.list_id));
}
