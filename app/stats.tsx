import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Head from "expo-router/head";
import { useFocusEffect, useRouter } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { strings } from "@/i18n/hu";
import {
  getResearchStats,
  getUsageStats,
  type DayCount,
  type ResearchStats,
  type UsageStats,
} from "@/services/statsService";
import {
  BEHAVIOUR,
  MISSING_ANSWERS,
  MISSING_FEATURES,
  VERSION as RESEARCH_VERSION,
  scorePicks,
  type MissingAnswer,
} from "@/scripts/research-design";
import { makeStyles, useColors } from "@/theme/styles";
import { gutter, radius, space } from "@/theme/tokens";
import { elapsedSince, formatShortDate, formatShortDayForSuffix, formatTime } from "@/utils/datetime";

/**
 * The operator's dashboard (T-099).
 *
 * Page views live in Cloudflare and installs in the Play Console; this is
 * the third number, the one that says whether anybody *used* the thing:
 * sign-ups, entries, who came back, which devices are listening. Everything
 * is counted on the server by `usage_stats()`, which answers only the
 * operator's account — for anyone else the RPC raises and this screen shows
 * the same "nothing here" it would for a bad URL. The route is not linked
 * from anywhere a visitor sees; Settings shows it only to the operator.
 *
 * Deliberately a single page with no filters: the question it answers each
 * evening is "did anyone come today", and the fourteen-day bars answer it
 * before the eye reaches the totals.
 */
export default function StatsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [research, setResearch] = useState<ResearchStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      // Two documents, one screen. The questionnaire is fetched alongside
      // rather than folded into usage_stats(): it is a different subject,
      // answers a different question, and has a version the client owns.
      const [usage, questionnaire] = await Promise.all([getUsageStats(), getResearchStats(RESEARCH_VERSION)]);
      setStats(usage);
      setResearch(questionnaire);
    } catch {
      setFailed(true);
      setStats(null);
      setResearch(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setStats(null);
        setResearch(null);
        setLoaded(true);
        return;
      }
      load();
    }, [session, load])
  );

  const t = strings.stats;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Head>
        <title>{`${t.headerTitle} · ${strings.appName}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <ModalHeader title={t.headerTitle} fallbackRoute="/settings" />

      <ScrollView contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
          {!session && loaded && (
            <EmptyState
              title={t.signInPrompt}
              actionLabel={strings.profile.signInButton}
              onAction={() => router.push("/sign-in")}
            />
          )}

          {!!session && loaded && !stats && (
            <EmptyState
              title={failed ? strings.common.loadError : t.notForYou}
              body={failed ? undefined : t.notForYouBody}
              actionLabel={failed ? strings.common.retry : undefined}
              onAction={failed ? load : undefined}
            />
          )}

          {!!session && !loaded && !loading && (
            <Text variant="caption" tone="faint">
              {t.loading}
            </Text>
          )}

          {stats && <Dashboard stats={stats} onReload={load} />}
          {stats && research && <Questionnaire research={research} />}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

function Dashboard({ stats, onReload }: { stats: UsageStats; onReload: () => void }) {
  const styles = useStyles();
  const t = strings.stats;
  const { accounts, entries, social, devices, catalogue } = stats;

  return (
    <>
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="faint">
          {t.generatedAt(formatShortDate(stats.generatedAt), formatTime(stats.generatedAt))}
          {" · "}
          <Text variant="caption" tone="accent" onPress={onReload} accessibilityRole="button">
            {t.reload}
          </Text>
        </Text>
        <Text variant="caption" tone="faint">
          {t.excluded(stats.excluded.demo + stats.excluded.operator)}
        </Text>
      </View>

      {/* The question of the evening first. */}
      <Section title={t.today}>
        <View style={styles.tiles}>
          <Tile value={accounts.active1d} label={t.active1d} gold />
          <Tile value={accounts.new7d} label={t.new7d} />
          <Tile value={entries.last7d} label={t.entries7d} />
        </View>
      </Section>

      <Section title={t.signups} hint={t.signupsHint}>
        <Bars series={stats.signupsByDay} />
        <View style={styles.tiles}>
          <Tile value={accounts.total} label={t.accountsTotal} gold />
          <Tile value={accounts.confirmed} label={t.accountsConfirmed} />
          <Tile value={accounts.onboarded} label={t.accountsOnboarded} />
        </View>
        <View style={styles.tiles}>
          <Tile value={accounts.new30d} label={t.new30d} />
          <Tile value={accounts.active7d} label={t.active7d} />
          <Tile value={accounts.active30d} label={t.active30d} />
        </View>
      </Section>

      <Section title={t.entries} hint={t.entriesHint}>
        <Bars series={entries.byDay} />
        <View style={styles.tiles}>
          <Tile value={entries.total} label={t.entriesTotal} gold />
          <Tile value={entries.rated} label={t.entriesRated} />
          <Tile value={entries.withText} label={t.entriesWithText} />
        </View>
        <View style={styles.tiles}>
          <Tile value={entries.last30d} label={t.entries30d} />
          <Tile value={entries.authors30d} label={t.authors30d} />
          <Tile value={social.watchlist} label={t.watchlist} />
        </View>
      </Section>

      <Section title={t.social}>
        <View style={styles.tiles}>
          <Tile value={social.followsAccepted} label={t.followsAccepted} gold />
          <Tile value={social.followsPending} label={t.followsPending} />
          <Tile value={social.subjectFollows} label={t.subjectFollows} />
        </View>
        <View style={styles.tiles}>
          <Tile value={social.likes} label={t.likes} />
          <Tile value={social.comments} label={t.comments} />
          <Tile value={social.lists} label={t.lists} />
        </View>
      </Section>

      <Section title={t.devices} hint={t.devicesHint}>
        <View style={styles.tiles}>
          <Tile value={devices.pushExpo} label={t.pushExpo} gold />
          <Tile value={devices.pushWeb} label={t.pushWeb} />
          <Tile value={devices.digestEnabled} label={t.digestEnabled} />
        </View>
      </Section>

      <Section title={t.recent} hint={t.recentHint}>
        <View style={styles.card}>
          {stats.recentAccounts.length === 0 && (
            <Text variant="bodySmall" tone="faint">
              {t.recentEmpty}
            </Text>
          )}
          {stats.recentAccounts.map((a, i) => (
            <View key={`${a.handle ?? "?"}-${i}`} style={[styles.personRow, i > 0 && styles.personRowBorder]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subheading" numberOfLines={1}>
                  {a.name || t.noName}
                  {a.handle ? (
                    <Text variant="caption" tone="faint">
                      {`  @${a.handle}`}
                    </Text>
                  ) : null}
                </Text>
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {[
                    a.city,
                    t.joinedOn(formatShortDate(a.joined)),
                    a.lastSeen ? t.lastSeen(elapsedLabel(a.lastSeen)) : t.neverSeen,
                    a.confirmed ? null : t.unconfirmed,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Text variant="numeral" tone={a.entries > 0 ? "accent" : "faint"}>
                {a.entries}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t.catalogue}>
        <View style={styles.tiles}>
          <Tile value={catalogue.plays} label={t.plays} />
          <Tile value={catalogue.venues} label={t.venues} />
          <Tile value={catalogue.upcomingPerformances} label={t.upcoming} />
        </View>
        <Text variant="caption" tone={catalogue.syncErrors24h > 0 ? "accent" : "faint"}>
          {catalogue.lastSyncFinishedAt
            ? t.lastSync(elapsedLabel(catalogue.lastSyncFinishedAt), catalogue.syncErrors24h)
            : t.noSync}
        </Text>
      </Section>
    </>
  );
}

/**
 * The questionnaire, as the report prints it.
 *
 * The server hands back tallies by id; the ranking, the labels and the
 * verdicts come from `scripts/research-design.ts`, the same module the
 * Markdown report uses, so a card is called the same thing in both places
 * and the "alap / későbbre" thresholds cannot drift between them. Below
 * thirty answers only counts are shown, for the reason the report gives:
 * a two-decimal score over three answers claims a precision it does not have.
 */
function Questionnaire({ research }: { research: ResearchStats }) {
  const styles = useStyles();
  const t = strings.stats;
  const n = research.current;

  // scorePicks() wants one Picks per respondent; the server sends counts.
  // Expand the counts into the same shape rather than re-implementing the
  // ranking here, so the order is the report's order, ties and all.
  const expanded = expandPicks(research.best, research.worst);
  const scores = scorePicks(expanded);
  const mostNet = Math.max(...scores.map((s) => Math.abs(s.net)), 1);

  const sources = Object.entries(research.sources)
    .map(([s, c]) => `${s || t.researchNoSource} ${c}`)
    .join(" · ");

  return (
    <Section title={t.research} hint={t.researchHint(research.version)}>
      <View style={styles.tiles}>
        <Tile value={n} label={t.researchAnswers} gold />
        <Tile value={research.older} label={t.researchOlder} />
        <Tile value={research.withEmail} label={t.researchEmails} />
      </View>
      {n > 0 && research.firstAt && research.lastAt ? (
        <Text variant="caption" tone="faint">
          {t.researchRange(formatShortDate(research.firstAt), formatShortDate(research.lastAt))}
          {sources ? ` · ${t.researchSources(sources)}` : ""}
        </Text>
      ) : null}

      {n === 0 ? (
        <View style={styles.card}>
          <Text variant="bodySmall" tone="faint">
            {t.researchEmpty}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="subheading">{t.researchPicks}</Text>
          <Text variant="caption" tone="faint">
            {t.researchPicksHint}
          </Text>
          <View style={styles.card}>
            {scores.map((s, i) => (
              <View key={s.id} style={[styles.rankRow, i > 0 && styles.personRowBorder]}>
                <Text variant="caption" tone="faint" style={styles.rankIndex}>
                  {i + 1}
                </Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="bodySmall" numberOfLines={2}>
                    {s.label}
                  </Text>
                  {/* One track, zero in the middle: net to the right is
                      wanted, to the left is expendable. */}
                  <View style={styles.netTrack}>
                    <View style={styles.netHalf}>
                      {s.net < 0 ? (
                        <View style={[styles.netFillLeft, { width: `${(Math.abs(s.net) / mostNet) * 100}%` }]} />
                      ) : null}
                    </View>
                    <View style={styles.netHalf}>
                      {s.net > 0 ? <View style={[styles.netFillRight, { width: `${(s.net / mostNet) * 100}%` }]} /> : null}
                    </View>
                  </View>
                </View>
                <Text variant="caption" tone={s.net > 0 ? "accent" : "faint"} style={styles.rankCells}>
                  {t.researchPickCells(s.best, s.worst, s.net)}
                </Text>
              </View>
            ))}
          </View>

          <Text variant="subheading">{t.researchMissing}</Text>
          <Text variant="caption" tone="faint">
            {t.researchMissingHint}
          </Text>
          <View style={styles.card}>
            {MISSING_FEATURES.map((f, i) => {
              const counts = research.missing[f.id] ?? {};
              const c = (k: MissingAnswer) => counts[k] ?? 0;
              const answered = MISSING_ANSWERS.reduce((sum, k) => sum + c(k), 0);
              return (
                <View key={f.id} style={[styles.rankRow, i > 0 && styles.personRowBorder]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodySmall" numberOfLines={2}>
                      {f.label}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {`${c("zavarna")} · ${c("mindegy")} · ${c("jobb_nelkule")}`}
                    </Text>
                  </View>
                  <Text variant="caption" tone={verdictTone(c("zavarna"), c("jobb_nelkule"), answered)}>
                    {verdictLabel(c("zavarna"), c("jobb_nelkule"), answered)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text variant="subheading">{t.researchBehaviour}</Text>
          <View style={{ gap: space.sm }}>
            {BEHAVIOUR.map((q) => {
              const counts = research.behaviour[q.key] ?? {};
              const other = research.behaviourOther[`${q.key}_mas`] ?? [];
              const most = Math.max(...Object.values(counts), 1);
              return (
                <View key={q.key} style={styles.card}>
                  <Text variant="bodySmall">{q.title}</Text>
                  {Object.entries(q.options).map(([id, label]) => {
                    const c = counts[id] ?? 0;
                    return (
                      <View key={id} style={{ gap: 3 }}>
                        <View style={styles.optionRow}>
                          <Text variant="caption" tone={c > 0 ? "default" : "faint"} numberOfLines={1} style={{ flex: 1 }}>
                            {label}
                          </Text>
                          <Text variant="caption" tone="faint">
                            {c}
                            {n > 0 ? ` · ${Math.round((100 * c) / n)}%` : ""}
                          </Text>
                        </View>
                        <View style={styles.optionTrack}>
                          <View style={[styles.optionFill, { width: `${(c / most) * 100}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                  {other.length > 0 ? (
                    <Text variant="caption" tone="faint">
                      {`${t.researchOther} ${other.map((x) => `„${x.trim()}”`).join(", ")}`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Text variant="subheading">{t.researchOpen}</Text>
          <View style={styles.card}>
            {research.openAnswers.length === 0 ? (
              <Text variant="bodySmall" tone="faint">
                {t.researchOpenEmpty}
              </Text>
            ) : (
              research.openAnswers.map((o, i) => (
                <Text key={i} variant="bodySmall" style={styles.quote}>
                  {o.replace(/\n+/g, " ")}
                </Text>
              ))
            )}
          </View>
        </>
      )}
    </Section>
  );
}

/** Counts back into per-respondent picks, so scorePicks() can rank them. */
function expandPicks(best: Record<string, number>, worst: Record<string, number>) {
  const out: { best: string[]; worst: string[] }[] = [];
  for (const [id, c] of Object.entries(best)) for (let i = 0; i < c; i++) out.push({ best: [id], worst: [] });
  for (const [id, c] of Object.entries(worst)) for (let i = 0; i < c; i++) out.push({ best: [], worst: [id] });
  return out;
}

/** The report's thresholds, verbatim: 50% "zavarna" is a launch feature. */
function verdictLabel(zavarna: number, jobb: number, answered: number): string {
  const v = strings.stats.researchVerdict;
  if (answered === 0) return v.none;
  const z = zavarna / answered;
  const j = jobb / answered;
  return z >= 0.5 ? v.base : j >= 0.5 ? v.no : z >= 0.3 ? v.wanted : v.later;
}

function verdictTone(zavarna: number, jobb: number, answered: number): "accent" | "default" | "faint" {
  if (answered === 0) return "faint";
  return zavarna / answered >= 0.5 ? "accent" : "default";
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {hint ? (
          <Text variant="caption" tone="faint">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Tile({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <Text variant="title" tone={gold ? "accent" : "default"}>
        {value}
      </Text>
      <Text variant="caption" tone="faint" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Fourteen days as bars.
 *
 * Scaled against the busiest day rather than any fixed axis: with numbers this
 * small the shape is the information, and a day with two sign-ups next to
 * twelve empty ones should look exactly like that. A zero day still gets a
 * hairline so the row reads as fourteen days and not as a gap.
 */
function Bars({ series }: { series: DayCount[] }) {
  const styles = useStyles();
  const most = Math.max(...series.map((d) => d.count), 1);
  const total = series.reduce((n, d) => n + d.count, 0);
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <View style={styles.card}>
      <View style={styles.bars} accessibilityLabel={strings.stats.barsLabel(total)}>
        {series.map((d) => (
          <View key={d.day} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                { height: d.count > 0 ? `${Math.max(12, (d.count / most) * 100)}%` : 2 },
                d.count === 0 && styles.barEmpty,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.barsAxis}>
        <Text variant="caption" tone="faint">
          {first ? formatShortDayForSuffix(first.day) : ""}
        </Text>
        <Text variant="caption" tone="faint">
          {strings.stats.barsTotal(total)}
        </Text>
        <Text variant="caption" tone="faint">
          {last ? formatShortDayForSuffix(last.day) : ""}
        </Text>
      </View>
    </View>
  );
}

function elapsedLabel(iso: string): string {
  const e = elapsedSince(iso);
  const t = strings.stats;
  switch (e.unit) {
    case "now":
      return t.elapsedNow;
    case "hours":
      return t.elapsedHours(e.value);
    case "yesterday":
      return t.elapsedYesterday;
    case "days":
      return t.elapsedDays(e.value);
  }
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    tiles: { flexDirection: "row", gap: space.sm },
    tile: {
      flex: 1,
      gap: 2,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    card: {
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      gap: space.sm,
    },
    bars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 72 },
    barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
    bar: { borderRadius: 3, backgroundColor: colors.gold },
    barEmpty: { backgroundColor: colors.hairline },
    barsAxis: { flexDirection: "row", justifyContent: "space-between" },
    personRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
    personRowBorder: { borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
    rankRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
    rankIndex: { width: 18, textAlign: "right" },
    rankCells: { minWidth: 72, textAlign: "right" },
    netTrack: { flexDirection: "row", height: 4 },
    netHalf: { flex: 1, height: "100%", justifyContent: "center" },
    netFillLeft: { alignSelf: "flex-end", height: "100%", borderRadius: 2, backgroundColor: colors.textFaint },
    netFillRight: { alignSelf: "flex-start", height: "100%", borderRadius: 2, backgroundColor: colors.gold },
    optionRow: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
    optionTrack: { height: 4, borderRadius: 2, backgroundColor: colors.hairlineSoft, overflow: "hidden" },
    optionFill: { height: "100%", borderRadius: 2, backgroundColor: colors.gold },
    quote: { borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: space.sm },
  })
);
