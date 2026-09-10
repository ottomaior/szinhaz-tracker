import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, hairlineWidth, radius, space } from "@/theme/tokens";
import { getPersonCredits, getPersonProfile, getPortrait, type PersonCredit, type PersonProfile } from "@/services/peopleService";
import { getDiaryPlaysForUser, getCurrentUser, getFilterVenues, getVenuesByIds } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Portrait, Venue } from "@/data/types";
import { Avatar } from "@/components/ui/Avatar";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PlayRow } from "@/components/ui/PlayRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { FollowSubjectButton } from "@/components/ui/FollowSubjectButton";
import { ContentColumn } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { creditLabel, personInitials } from "@/utils/people";
import { makeStyles } from "@/theme/styles";

/**
 * One performer or director, and everything the catalogue has them on.
 *
 * The question a cast list exists to provoke is "what else is she in", and
 * until now the app could not answer it: 6,397 credits were searchable and
 * every search result navigated to a production. This is the page they land on.
 *
 * Reached from the cast strip and the director line on Play Detail, which are
 * the two places somebody is already looking at a name and wondering.
 */
export default function PersonScreen() {
  const styles = useStyles();

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [profile, setProfile] = useState<PersonProfile>();
  const [credits, setCredits] = useState<PersonCredit[]>([]);
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const [seenPlayIds, setSeenPlayIds] = useState<Set<string>>(new Set());
  const [covered, setCovered] = useState<string[]>([]);
  const [portrait, setPortrait] = useState<Portrait>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!slug) return;
      let active = true;
      setLoaded(false);
      setFailed(false);

      Promise.all([
        getPersonProfile(slug).then((p) => {
          if (active) setProfile(p);
        }),
        // The face, where their theatre publishes one (T-032). Most people
        // have none and keep their initials; a failure here is the same as
        // having none, and must not take the page down with it.
        getPortrait(slug)
          .then((p) => {
            if (active) setPortrait(p);
          })
          .catch(() => {}),
        getPersonCredits(slug).then(async (list) => {
          if (!active) return;
          setCredits(list);
          const venueMap = await getVenuesByIds(list.map((c) => c.play.venueId));
          if (active) setVenues(venueMap);
        }),
        // "How many of these have I seen" is the stat that makes a person page
        // personal rather than a filmography, so it is worth the extra request
        // — but only when there is somebody to ask about.
        session
          ? getCurrentUser()
              .then((u) => (u ? getDiaryPlaysForUser(u.id) : []))
              .then((plays) => {
                if (active) setSeenPlayIds(new Set(plays.map((p) => p.id)));
              })
          : Promise.resolve(),
        // The houses the coverage note names, read rather than hardcoded — a
        // list typed into the source is a list that goes stale the first time
        // a theatre is added, and quietly, because nothing compares the two.
        // `includeArchived` because a credit list runs back through productions
        // that came off long ago, so the covered set has to mean "everything we
        // ever held" and not "what is on this week". Deliberately *not* every
        // row in `venues`: two of the ten are there with no productions at all,
        // and naming them would be claiming coverage this catalogue does not
        // have — the exact failure the note exists to stop.
        //
        // Its own catch: the note is a caveat, and a caveat that cannot load is
        // not worth failing a career page over. It simply does not render.
        getFilterVenues(undefined, true)
          .then((list) => {
            if (active) setCovered(list.map((v) => v.name));
          })
          .catch(() => {
            if (active) setCovered([]);
          }),
      ])
        .catch(() => {
          if (active) setFailed(true);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });

      return () => {
        active = false;
      };
    }, [slug, session])
  );

  const seenCount = credits.filter((c) => seenPlayIds.has(c.play.id)).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={profile?.displayName ?? strings.person.headerFallback} />

      <ScrollView contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          {!loaded && <PersonSkeleton />}

          {loaded && failed && (
            <EmptyState
              title={strings.common.loadError}
              actionLabel={strings.common.retry}
              // Guarded because the param is optional: there is nothing to
              // retry without a slug, and the route will not accept one.
              onAction={() => {
                if (slug) router.replace({ pathname: "/person/[slug]", params: { slug } });
              }}
            />
          )}

          {/* A slug nobody matches. Reachable by typing a URL, and — more
              usefully — the shape this screen takes if the app's slug ever
              stops agreeing with the database's, which is the one failure mode
              that would otherwise look like a performer with no work. */}
          {loaded && !failed && !profile && (
            <EmptyState title={strings.person.notFoundTitle} body={strings.person.notFoundBody} />
          )}

          {loaded && !failed && !!profile && (
            <>
              <View style={styles.header}>
                <Avatar uri={portrait?.thumbUrl} initials={personInitials(profile.displayName)} size={64} serif />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="display">{profile.displayName}</Text>
                  <Text variant="bodySmall" tone="faint">
                    {summaryLine(profile)}
                  </Text>
                </View>
              </View>

              {/* Above the statistics rather than below the credit list: the
                  reason to be on this page at all is often "I want to know
                  when they are next on", and burying that under sixty rows of
                  past work answers a different question. */}
              {!!slug && <FollowSubjectButton type="person" subjectKey={slug} />}

              <View style={styles.statsRow}>
                <Stat value={profile.creditCount} label={strings.person.credits} />
                <View style={styles.statDivider} />
                <Stat value={profile.venueCount} label={strings.person.venues} />
                {profile.directedCount > 0 && (
                  <>
                    <View style={styles.statDivider} />
                    <Stat value={profile.directedCount} label={strings.person.directed} />
                  </>
                )}
                {/* Only once there is a diary to count against. A gold zero
                    beside somebody's name reads as a score, not as a prompt. */}
                {!!session && seenCount > 0 && (
                  <>
                    <View style={styles.statDivider} />
                    <Stat value={seenCount} label={strings.person.seenByYou} gold />
                  </>
                )}
              </View>

              <View style={{ gap: space.md }}>
                <SectionHeader
                  eyebrow={strings.person.credits}
                  title={strings.person.creditsHeading}
                  action={String(credits.length)}
                />
                {credits.map((credit) => {
                  const label = creditLabel(credit.roles, credit.directed, strings.person.director);
                  const venue = venues.get(credit.play.venueId)?.name;
                  return (
                    <PlayRow
                      key={credit.play.id}
                      play={credit.play}
                      onPress={() => router.push(`/play/${credit.play.id}`)}
                      meta={
                        <>
                          {/* The role, when the source recorded one. 814 cast
                              rows carry none, and the production alone is still
                              a true credit — an invented "Szereplő" would not
                              be. */}
                          {!!label && (
                            <Text variant="caption" tone="dim" numberOfLines={1}>
                              {label}
                            </Text>
                          )}
                          {/* The venue stays, and a marker goes beside it. This
                              row used to read as a credit at the house named,
                              which for a hosted production it is not — twelve
                              performers held a Csokonai credit for an evening
                              the Kolozsvári company brought (T-025). Naming the
                              company here instead would fight the coverage note
                              below, which counts theatres this catalogue holds
                              and would not list a visitor among them. */}
                          <Text variant="caption" tone="faint" numberOfLines={1}>
                            {[
                              venue,
                              credit.play.producedBy ? strings.person.guestRun : undefined,
                              yearOf(credit.play.premiereDate),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </>
                      }
                      trailing={
                        seenPlayIds.has(credit.play.id) ? (
                          <Text variant="caption" tone="accent">
                            {strings.person.seenBadge}
                          </Text>
                        ) : undefined
                      }
                    />
                  );
                })}

                {/* Under the list rather than under the header, because this
                    answers a question the reader only has once they have read
                    to the bottom and are wondering whether that was all of it.
                    Quiet on purpose: it is a footnote about the catalogue, not
                    a warning about this person. */}
                {covered.length > 0 && (
                  <View style={styles.coverage}>
                    <Text variant="caption" tone="faint">
                      {strings.person.coverageNote(covered.length, covered.join(", "))}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

/**
 * "2 színház · 1987–2009" — where and when, in one line.
 *
 * The span comes from premiere dates, so it is absent for somebody all of whose
 * productions are undated, and collapses to a single year when the first and
 * last coincide. Printing "2025–2025" would look like a bug.
 */
function summaryLine(profile: PersonProfile): string {
  const parts: string[] = [];
  if (profile.venueCount > 0) parts.push(strings.person.venueCount(profile.venueCount));
  if (profile.firstYear && profile.lastYear) {
    parts.push(profile.firstYear === profile.lastYear ? `${profile.firstYear}` : `${profile.firstYear}–${profile.lastYear}`);
  }
  return parts.join(" · ");
}

function yearOf(premiereDate?: string): string | undefined {
  return premiereDate ? premiereDate.slice(0, 4) : undefined;
}

function Stat({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  const styles = useStyles();

  return (
    <View style={styles.stat}>
      <Text variant="numeral" tone={gold ? "accent" : "default"}>
        {value}
      </Text>
      <Text variant="caption" tone="faint" style={{ textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

function PersonSkeleton() {
  const styles = useStyles();

  return (
    <View style={{ gap: space.xl }}>
      <View style={styles.header}>
        <Skeleton width={64} height={64} radius={32} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton width="70%" height={22} />
          <Skeleton width="45%" height={14} />
        </View>
      </View>
      <Skeleton width="100%" height={58} radius={radius.md} />
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
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.hairlineSoft },
  // A rule above it rather than a card around it: a boxed caveat at the end of
  // a credit list reads as an error message, and nothing here has gone wrong.
  coverage: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairlineSoft,
  },
}));
