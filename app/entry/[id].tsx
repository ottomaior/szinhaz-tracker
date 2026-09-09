import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { deleteReview, getDiaryEntry } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import type { Performance, Play, Review, Venue } from "@/data/types";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { ReportSheet } from "@/components/ui/ReportSheet";
import { ReviewSocial } from "@/components/ui/ReviewSocial";
import { isShareCardSupported, shareCard } from "@/services/shareCardService";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatTime } from "@/utils/datetime";
import { personSlug } from "@/utils/people";
import { makeStyles } from "@/theme/styles";

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
  const { session } = useAuth();

  const [entry, setEntry] = useState<{
    review: Review;
    play: Play;
    venue?: Venue;
    performance?: Performance;
  }>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string>();
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
      // Straight to the diary, which is the list this row has just left — going
      // "back" would land on whatever opened the screen, possibly a feed still
      // showing the card that no longer exists.
      router.replace("/(tabs)/profile");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : strings.entry.deleteFailed);
      setDeleting(false);
    }
  }

  async function handleShare() {
    if (!entry || sharing) return;
    setShareError(undefined);
    setSharing(true);
    try {
      const ok = await shareCard({
        title: entry.play.title,
        venue: entry.venue?.name,
        dateLabel: entry.review.seenAt ? formatDate(entry.review.seenAt) : undefined,
        rating: entry.review.ratingOverall,
        // The mirrored copy, not the theatre's own URL: a hotlinked image taints
        // the canvas and `toBlob` then throws, losing the card rather than the
        // picture.
        posterUrl: entry.play.poster?.mirrored ? entry.play.poster.url : undefined,
      });
      if (!ok) setShareError(strings.entry.shareFailed);
    } catch {
      setShareError(strings.entry.shareFailed);
    } finally {
      setSharing(false);
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

  if (!entry) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const { review, play, venue, performance } = entry;
  const isMine = !!session && session.user?.id === review.userId;
  const cast = review.castSeen ?? [];
  const hasEvening = cast.length > 0 || !!review.seat || review.priceHuf !== undefined || !!review.stubUrl;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader
        title={strings.entry.headerTitle}
        fallbackRoute="/(tabs)/profile"
        // Offered only where it can actually produce the image. On native the
        // control would need a native view-shot module and a rebuild, and a
        // share button that silently degrades to a link is the same lie as a
        // counter that never moves.
        action={
          isShareCardSupported() ? (
            <Pressable
              onPress={handleShare}
              hitSlop={12}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel={strings.entry.share}
            >
              <Text variant="label" tone="accent" style={{ opacity: sharing ? 0.55 : 1 }}>
                {sharing ? strings.entry.sharing : strings.entry.share}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
        {!!shareError && (
          <ContentColumn style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
              {shareError}
            </Text>
          </ContentColumn>
        )}
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          {/* What was seen, and the way back to it. */}
          <Pressable
            onPress={() => router.push(`/play/${play.id}`)}
            accessibilityRole="button"
            accessibilityLabel={play.title}
            style={styles.playRow}
          >
            <PosterPlaceholder
              poster={play.poster}
              title={play.title}
              seed={play.id}
              width={56}
              height={84}
              radius={radius.sm}
              preferThumb
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="subheading">{play.title}</Text>
              <Text variant="caption" tone="faint" numberOfLines={1}>
                {venue?.name ?? play.author}
              </Text>
              <Text variant="caption" tone="accent">{strings.entry.openPlay}</Text>
            </View>
            <ChevronRightIcon size={15} color={colors.textFaint} />
          </Pressable>

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
              <MaskRatingRow rating={review.ratingOverall} size={20} gap={4} />
            )}
          </View>

          {/* Everything this reader is not entitled to has already been emptied
              by `reviews_readable` — the rating above, the cast, the note, the
              tags, the seat and the ticket all arrive blank, so the blocks
              below simply do not render. Which would leave a screen that
              trails off looking like an entry nobody finished.

              This is the sentence that says otherwise. The page does not know
              the author's name — it never needed it — so the generic wording
              is the honest one here, and the way to their profile is the
              avatar and name in the header above. */}
          {!review.canSeeOpinion && (
            <Text variant="bodySmall" tone="faint">{strings.feed.followToSeeGeneric}</Text>
          )}

          {cast.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="dim">{strings.entry.castHeading}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
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
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" tone="dim">{strings.entry.seatHeading}</Text>
                  <Text variant="body">{review.seat}</Text>
                </View>
              )}
              {review.priceHuf !== undefined && (
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" tone="dim">{strings.entry.priceHeading}</Text>
                  <Text variant="body">{strings.entry.priceValue(review.priceHuf)}</Text>
                </View>
              )}
            </View>
          )}

          {!!review.stubUrl && (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="dim">{strings.entry.stubHeading}</Text>
              <Image
                source={{ uri: review.stubUrl }}
                style={styles.stub}
                contentFit="cover"
                transition={200}
                accessibilityIgnoresInvertColors
              />
            </View>
          )}

          {!!review.text.trim() && (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="dim">{strings.entry.reviewHeading}</Text>
              <Text variant="body">{review.text}</Text>
            </View>
          )}

          {review.tags.length > 0 && (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {review.tags.map((tag) => (
                <Chip key={tag} label={tag} active />
              ))}
            </View>
          )}

          {/* Said plainly rather than left as a screen that trails off. Every
              one of these fields arrived in 0028, so every entry written before
              it answers none of them. */}
          {!hasEvening && (
            <Text variant="bodySmall" tone="faint">{strings.entry.nothingRecorded}</Text>
          )}

          {/* Yours to change. The app could write a diary entry from three
              places and unwrite one from none — the watchlist has had a remove
              control since the beginning, and the diary, which is the harder
              thing to undo, had none. */}
          {isMine && (
            <View style={styles.ownerActions}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/checkin", params: { reviewId: review.id } })
                }
                accessibilityRole="button"
                style={styles.ownerButton}
              >
                <Text variant="label">{strings.entry.edit}</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmingDelete((s) => !s)}
                accessibilityRole="button"
                aria-expanded={confirmingDelete}
                accessibilityState={{ expanded: confirmingDelete }}
                style={styles.ownerButton}
              >
                <Text variant="label" tone="dim">{strings.entry.delete}</Text>
              </Pressable>
            </View>
          )}

          {/* Confirmed, unlike the watchlist's remove. A watchlist entry is one
              row you can re-add in a tap; a diary entry can carry a date, a
              cast, a seat, a price, a photograph and a conversation, and
              deleting it takes all of them. */}
          {isMine && confirmingDelete && (
            <View style={styles.confirmCard}>
              <Text variant="subheading">{strings.entry.deleteConfirmTitle}</Text>
              <Text variant="bodySmall" tone="dim">{strings.entry.deleteConfirmBody}</Text>
              {!!deleteError && (
                <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                  {deleteError}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Button
                  label={strings.common.cancel}
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setConfirmingDelete(false)}
                />
                <Button
                  label={deleting ? strings.entry.deleting : strings.entry.delete}
                  style={{ flex: 1 }}
                  disabled={deleting}
                  onPress={handleDelete}
                />
              </View>
            </View>
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
              <Pressable
                onPress={() => setReporting(true)}
                disabled={reported}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ disabled: reported }}
              >
                <Text variant="caption" tone={reported ? "faint" : "dim"}>
                  {reported ? strings.moderation.reported : strings.moderation.report}
                </Text>
              </Pressable>
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
  playRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  factsRow: {
    flexDirection: "row",
    gap: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
  },
  ownerActions: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  ownerButton: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  confirmCard: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: space.md,
  },
  reportRow: {
    flexDirection: "row",
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  socialBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.lg,
  },
  stub: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
}));
