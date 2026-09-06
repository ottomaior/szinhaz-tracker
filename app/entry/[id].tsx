import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { getDiaryEntry } from "@/services/playsService";
import type { Performance, Play, Review, Venue } from "@/data/types";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { MaskRatingRow } from "@/components/icons/MaskIcon";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { ContentColumn } from "@/components/ui/Screen";
import { ReviewSocial } from "@/components/ui/ReviewSocial";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { formatTime } from "@/utils/datetime";
import { personSlug } from "@/utils/people";

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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const [entry, setEntry] = useState<{
    review: Review;
    play: Play;
    venue?: Venue;
    performance?: Performance;
  }>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

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
  const cast = review.castSeen ?? [];
  const hasEvening = cast.length > 0 || !!review.seat || review.priceHuf !== undefined || !!review.stubUrl;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.entry.headerTitle} fallbackRoute="/(tabs)/profile" />

      <ScrollView contentContainerStyle={{ paddingBottom: space["5xl"] }}>
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

          {/* The social half. It lives here rather than on the feed card
              because a conversation needs somewhere to be read, and the card is
              a summary — the feed's counters lead here for the same reason. */}
          <View style={styles.socialBlock}>
            <ReviewSocial reviewId={review.id} reviewOwnerId={review.userId} />
          </View>
        </ContentColumn>
      </ScrollView>
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

const styles = StyleSheet.create({
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
});
