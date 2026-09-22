import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, hairlineWidth, mask, space } from "@/theme/tokens";
import { deleteReview, getDiaryEntry, getUserById } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import type { Performance, Play, Review, User, Venue } from "@/data/types";
import { PersonRow } from "@/components/ui/Rows";
import { PlayRow } from "@/components/ui/PlayRow";
import { ConfirmCard } from "@/components/ui/Cards";
import { Notice } from "@/components/ui/Notice";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { ReportSheet } from "@/components/ui/ReportSheet";
import { ReviewSocial } from "@/components/ui/ReviewSocial";
import { useShareCard } from "@/components/share/ShareCardProvider";
import { ShareSheet } from "@/components/share/ShareSheet";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatTime } from "@/utils/datetime";
import { personSlug } from "@/utils/people";
import { makeStyles } from "@/theme/styles";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/utils/haptics";
import { RowSkeleton, Skeleton } from "@/components/ui/Skeleton";

/**
 * One evening, read back.
 *
 * The diary has known which night since 0022 and, since 0028, who was on it,
 * where you sat and what it cost — and none of that was worth writing while
 * nothing anywhere would show it to you again. A row in the diary list cannot:
 * it is a title, a venue and a date, which is the right size for a list and
 * the wrong size for a night.
 *
 * Public, like the entry itself. The diary is readable by anyone in this app —
 * `reviews_select_all` since 0001 — so this screen makes no distinction
 * between its author and a visitor beyond what it offers to do next.
 */
export default function DiaryEntryScreen() {
  const styles = useStyles();

  const { id, compose } = useLocalSearchParams<{ id?: string; compose?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const shareCard = useShareCard();

  const [entry, setEntry] = useState<{
    review: Review;
    play: Play;
    venue?: Venue;
    performance?: Performance;
  }>();
  // Whose evening this is. The screen used to show none of this — not a
  // name, not a face — so somebody arriving from a link or the feed was
  // reading an entry with no author on it (T-057). Loaded after the entry,
  // separately, so a slow profile never holds the evening back.
  const [author, setAuthor] = useState<User>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      setLoaded(false);
      setFailed(false);
      getDiaryEntry(id)
        .then((found) => {
          if (!active) return;
          setEntry(found);
          setFailed(!found);
          if (found) {
            getUserById(found.review.userId)
              .then((u) => {
                if (active) setAuthor(u);
              })
              .catch(() => undefined);
          }
        })
        .catch(() => {
          if (active) setFailed(true);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [id])
  );

  async function handleDelete() {
    if (!entry || deleting) return;
    setDeleteError(undefined);
    setDeleting(true);
    try {
      await deleteReview(entry.review.id);
      haptic("warning");
      // Said, not undone: putting the row back would mint a new id and drop
      // its likes and comments on the floor, and the confirmation card above
      // has already asked. A toast without an undo is still the difference
      // between "did that work" and knowing.
      toast.show({ message: strings.feedback.entryDeleted });
      // Straight to the diary, which is the list this row has just left — going
      // "back" would land on whatever opened the screen, possibly a feed still
      // showing the card that no longer exists.
      router.replace("/(tabs)/profile");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : strings.entry.deleteFailed);
      setDeleting(false);
    }
  }

  if (loaded && (failed || !entry)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={strings.entry.headerTitle} fallbackRoute="/(tabs)/profile" />
        <ContentColumn style={{ padding: gutter }}>
          <EmptyState title={strings.entry.notFound} />
        </ContentColumn>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={strings.entry.headerTitle} fallbackRoute="/(tabs)/profile" />
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
          <RowSkeleton />
          <Skeleton width="100%" height={space.lg} />
          <Skeleton width="85%" height={space.lg} />
          <Skeleton width="70%" height={space.lg} />
        </ContentColumn>
      </View>
    );
  }

  const { review, play, venue, performance } = entry;
  const isMine = !!session && session.user?.id === review.userId;
  const cast = review.castSeen ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader
        title={strings.entry.headerTitle}
        fallbackRoute="/(tabs)/profile"
        // Offered only where it can actually produce the image — which since
        // T-009 is everywhere the app runs, but the gate stays: a share
        // button that silently degrades to a link is the same lie as a
        // counter that never moves.
        action={
          shareCard.supported ? (
            <Pressable
              onPress={() => setSharing(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={strings.entry.share}
            >
              <Text variant="label" tone="accent">{strings.entry.share}</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          {/* Whose evening, and the way to them. Your own opens your profile
              tab rather than a second copy of it. */}
          {!!author && (
            <PersonRow
              name={author.name}
              meta={`@${author.handle}`}
              avatarUri={author.avatarUrl}
              initials={author.initials}
              onPress={() => (isMine ? router.push("/(tabs)/profile") : router.push(`/user/${author.id}`))}
            />
          )}

          {/* What was seen, and the way back to it. */}
          <PlayRow
            play={play}
            onPress={() => router.push(`/play/${play.id}`)}
            meta={
              <>
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {venue?.name ?? play.author}
                </Text>
                <Text variant="caption" tone="accent">{strings.entry.openPlay}</Text>
              </>
            }
          />

          {/* The night. The curtain time comes from the performance the entry
              points at, when it points at one — the date alone cannot say
              whether it was the matinee. */}
          <View style={{ gap: space.sm }}>
            <Text variant="heading">
              {review.seenAt ? strings.entry.seenOn(formatDate(review.seenAt)) : strings.entry.seenUndated}
            </Text>
            <View style={styles.metaRow}>
              {!!performance && (
                <Text variant="bodySmall" tone="dim">
                  {[formatTime(performance.startsAt), performance.room].filter(Boolean).join(" · ")}
                </Text>
              )}
              {review.isRewatch && (
                <Text variant="bodySmall" tone="accent">{strings.entry.rewatch}</Text>
              )}
            </View>
            {review.ratingOverall !== undefined && (
              <MaskRatingRow rating={review.ratingOverall} size={mask.row} gap={space.xs} />
            )}
          </View>

          {/* Everything this reader is not entitled to has already been emptied
              by `reviews_readable` — the rating above, the cast, the note, the
              tags, the seat and the ticket all arrive blank, so the blocks
              below simply do not render. Which would leave a screen that
              trails off looking like an entry nobody finished.

              This is the sentence that says otherwise, named once the author
              has loaded; the byline above is the way to their profile and the
              follow button on it. */}
          {!review.canSeeOpinion && (
            <Notice tone="info">
              {author ? strings.feed.followToSee(author.name) : strings.feed.followToSeeGeneric}
            </Notice>
          )}

          {cast.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="dim">{strings.entry.castHeading}</Text>
              <View style={styles.chipRow}>
                {cast.map((member) => {
                  const slug = personSlug(member.name);
                  return (
                    <Chip
                      key={member.name}
                      label={
                        member.isAlternate
                          ? `${member.name} · ${strings.entry.castAlternateBadge}`
                          : member.name
                      }
                      // Straight through to their page, which is the payoff of
                      // recording this at all. A name that slugs to nothing has
                      // no page to go to, so it stays a plain chip rather than
                      // a control that does nothing.
                      onPress={
                        slug
                          ? () => router.push({ pathname: "/person/[slug]", params: { slug } })
                          : undefined
                      }
                    />
                  );
                })}
              </View>
            </View>
          )}

          {(!!review.seat || review.priceHuf !== undefined) && (
            <View style={styles.factsRow}>
              {!!review.seat && (
                <View style={{ flex: 1, gap: space["2xs"] }}>
                  <Text variant="label" tone="dim">{strings.entry.seatHeading}</Text>
                  <Text variant="body">{review.seat}</Text>
                </View>
              )}
              {review.priceHuf !== undefined && (
                <View style={{ flex: 1, gap: space["2xs"] }}>
                  <Text variant="label" tone="dim">{strings.entry.priceHeading}</Text>
                  <Text variant="body">{strings.entry.priceValue(review.priceHuf)}</Text>
                </View>
              )}
            </View>
          )}

          {!!review.text.trim() && (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="dim">{strings.entry.reviewHeading}</Text>
              <Text variant="body">{review.text}</Text>
            </View>
          )}

          {review.tags.length > 0 && (
            <View style={styles.chipRow}>
              {review.tags.map((tag) => (
                <Chip key={tag} label={tag} active />
              ))}
            </View>
          )}

          {/* Yours to change. The app could write a diary entry from three
              places and unwrite one from none — the watchlist has had a remove
              control since the beginning, and the diary, which is the harder
              thing to undo, had none. */}
          {isMine && (
            <View style={styles.ownerActions}>
              <Button
                variant="outline"
                size="sm"
                label={strings.entry.edit}
                onPress={() => router.push({ pathname: "/checkin", params: { reviewId: review.id } })}
              />
              <Button
                variant="text"
                size="sm"
                label={strings.entry.delete}
                onPress={() => setConfirmingDelete((s) => !s)}
              />
            </View>
          )}

          {/* Confirmed, unlike the watchlist's remove. A watchlist entry is one
              row you can re-add in a tap; a diary entry can carry a date, a
              cast, a seat, a price, a photograph and a conversation, and
              deleting it takes all of them. */}
          {isMine && confirmingDelete && (
            <ConfirmCard
              title={strings.entry.deleteConfirmTitle}
              body={strings.entry.deleteConfirmBody}
              confirmLabel={deleting ? strings.entry.deleting : strings.entry.delete}
              cancelLabel={strings.common.cancel}
              onConfirm={handleDelete}
              onCancel={() => setConfirmingDelete(false)}
              busy={deleting}
              notice={deleteError ? <Notice>{deleteError}</Notice> : undefined}
            />
          )}

          {/* The social half. It lives here rather than on the feed card
              because a conversation needs somewhere to be read, and the card is
              a summary — the feed's counters lead here for the same reason.

              Not mounted at all when the opinion is closed to this reader. The
              policies in 0042 would return an empty thread and a zero count
              anyway, but mounting it would draw a composer inviting somebody to
              answer writing they cannot read. */}
          {review.canSeeOpinion && (
          <View style={styles.socialBlock}>
            <ReviewSocial
              reviewId={review.id}
              reviewOwnerId={review.userId}
              // Set by the comment icon on a feed card, which is somebody
              // asking to write rather than to read.
              autoFocusComposer={compose === "1"}
            />
          </View>
          )}

          {/* Somebody else's evening, and something is wrong with it.
              Last on the screen and set as quiet caption text: this is the
              least-used control here and should not compete with reading the
              entry. Absent on your own, where it would only ever be a mistake,
              and absent without a session, since `reports.reporter_id` has to
              be somebody. */}
          {!!session && !isMine && (
            <View style={styles.reportRow}>
              <Button
                variant="text"
                size="sm"
                label={reported ? strings.moderation.reported : strings.moderation.report}
                onPress={() => setReporting(true)}
                disabled={reported}
              />
            </View>
          )}
        </ContentColumn>
      </ScrollView>

      <ReportSheet
        target="review"
        targetId={review.id}
        visible={reporting}
        onClose={() => setReporting(false)}
        onReported={() => setReported(true)}
      />

      <ShareSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        card={{
          title: play.title,
          venue: venue?.name,
          dateLabel: review.seenAt ? formatDate(review.seenAt) : undefined,
          rating: review.ratingOverall,
          // The mirrored copy, not the theatre's own URL: a hotlinked image
          // taints the web canvas and `toBlob` then throws, losing the card
          // rather than the picture — and a story travels further than a
          // diary entry, so the rule that the card draws only what is ours
          // to redraw holds all the more.
          posterUrl: play.poster?.mirrored ? play.poster.url : undefined,
        }}
        // The words are the author's to put on a card, and nobody else's. A
        // visitor — even a follower who can read them — gets the evening
        // without them, and the sheet shows no switch.
        opinion={
          isMine
            ? { text: review.text, tags: review.tags, cast: cast.map((m) => m.name) }
            : undefined
        }
      />
    </View>
  );
}

/**
 * Parsed at midday rather than midnight, for the reason the profile's diary
 * gives: a bare date string is midnight UTC, which is still the previous
 * evening in Budapest.
 */
function formatDate(dayKey: string) {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  chipRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  factsRow: { flexDirection: "row", gap: space.lg },
  ownerActions: { flexDirection: "row", gap: space.sm, alignSelf: "flex-start" },
  socialBlock: {
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.xl,
  },
  reportRow: { alignItems: "center" },
}));

