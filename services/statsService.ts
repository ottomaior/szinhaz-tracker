import { supabase } from "@/services/supabase";

/**
 * The operator's numbers (T-099).
 *
 * One RPC, one document: `usage_stats()` counts sign-ups, entries, activity
 * and devices on the server and hands back a JSON object, because every figure
 * on the screen is an aggregate over rows the client is not allowed to read
 * one by one. The function raises for anyone but the operator, and the screen
 * treats that as "nothing here" rather than as an error.
 */

export type DayCount = { day: string; count: number };

export type UsageStats = {
  generatedAt: string;
  excluded: { demo: number; operator: number };
  accounts: {
    total: number;
    confirmed: number;
    onboarded: number;
    new7d: number;
    new30d: number;
    active1d: number;
    active7d: number;
    active30d: number;
  };
  signupsByDay: DayCount[];
  entries: {
    total: number;
    rated: number;
    withText: number;
    last7d: number;
    last30d: number;
    authors30d: number;
    byDay: DayCount[];
  };
  social: {
    followsAccepted: number;
    followsPending: number;
    likes: number;
    comments: number;
    watchlist: number;
    lists: number;
    subjectFollows: number;
  };
  devices: { pushExpo: number; pushWeb: number; digestEnabled: number };
  research: { responses: number; withEmail: number };
  recentAccounts: {
    handle: string | null;
    name: string | null;
    city: string | null;
    joined: string;
    lastSeen: string | null;
    entries: number;
    confirmed: boolean;
  }[];
  catalogue: {
    plays: number;
    venues: number;
    upcomingPerformances: number;
    lastSyncFinishedAt: string | null;
    syncErrors24h: number;
  };
};

/** Whether the signed-in account is the one that runs the app. */
export async function isOperator(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_operator");
  if (error) return false;
  return data === true;
}

/**
 * The numbers, or `null` when the caller is not allowed to see them.
 *
 * Postgres reports the raised `insufficient_privilege` as SQLSTATE 42501;
 * PostgREST forwards it as HTTP 403 with the code on the error. Anything else
 * is a real failure and is thrown.
 */
export async function getUsageStats(): Promise<UsageStats | null> {
  const { data, error } = await supabase.rpc("usage_stats");
  if (error) {
    if (error.code === "42501") return null;
    throw error;
  }
  return fromRow(data as RawStats);
}

type RawDay = { day: string; count: number };
type RawStats = {
  generated_at: string;
  excluded: { demo: number; operator: number };
  accounts: Record<string, number>;
  signups_by_day: RawDay[] | null;
  entries: Record<string, number> & { by_day: RawDay[] | null };
  social: Record<string, number>;
  devices: Record<string, number>;
  research: Record<string, number>;
  recent_accounts: {
    handle: string | null;
    name: string | null;
    city: string | null;
    joined: string;
    last_seen: string | null;
    entries: number;
    confirmed: boolean;
  }[];
  catalogue: Record<string, number | string | null>;
};

function fromRow(r: RawStats): UsageStats {
  return {
    generatedAt: r.generated_at,
    excluded: r.excluded,
    accounts: {
      total: r.accounts.total,
      confirmed: r.accounts.confirmed,
      onboarded: r.accounts.onboarded,
      new7d: r.accounts.new_7d,
      new30d: r.accounts.new_30d,
      active1d: r.accounts.active_1d,
      active7d: r.accounts.active_7d,
      active30d: r.accounts.active_30d,
    },
    signupsByDay: r.signups_by_day ?? [],
    entries: {
      total: r.entries.total,
      rated: r.entries.rated,
      withText: r.entries.with_text,
      last7d: r.entries.last_7d,
      last30d: r.entries.last_30d,
      authors30d: r.entries.authors_30d,
      byDay: r.entries.by_day ?? [],
    },
    social: {
      followsAccepted: r.social.follows_accepted,
      followsPending: r.social.follows_pending,
      likes: r.social.likes,
      comments: r.social.comments,
      watchlist: r.social.watchlist,
      lists: r.social.lists,
      subjectFollows: r.social.subject_follows,
    },
    devices: {
      pushExpo: r.devices.push_expo,
      pushWeb: r.devices.push_web,
      digestEnabled: r.devices.digest_enabled,
    },
    research: { responses: r.research.responses, withEmail: r.research.with_email },
    recentAccounts: (r.recent_accounts ?? []).map((a) => ({
      handle: a.handle,
      name: a.name,
      city: a.city,
      joined: a.joined,
      lastSeen: a.last_seen,
      entries: a.entries,
      confirmed: a.confirmed,
    })),
    catalogue: {
      plays: Number(r.catalogue.plays ?? 0),
      venues: Number(r.catalogue.venues ?? 0),
      upcomingPerformances: Number(r.catalogue.upcoming_performances ?? 0),
      lastSyncFinishedAt: (r.catalogue.last_sync_finished_at as string | null) ?? null,
      syncErrors24h: Number(r.catalogue.sync_errors_24h ?? 0),
    },
  };
}
