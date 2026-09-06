import { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useAuth } from "@/contexts/AuthContext";
import {
  COMMENT_MAX_LENGTH,
  addComment,
  deleteComment,
  getComments,
  getLikeState,
  likeReview,
  unlikeReview,
  type ReviewComment,
} from "@/services/socialService";
import { HeartIcon } from "@/components/icons/Icons";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import { formatTimeAgo, strings } from "@/i18n/hu";

/**
 * The like control and the comment thread for one diary entry.
 *
 * Both counters have existed as columns since 0001 and were drawn on every feed
 * card as a permanent zero until they were taken off, because an icon that does
 * nothing when tapped teaches a first-time visitor that the app is a mockup.
 * 0032 made them real; this is the control that makes them move.
 *
 * It lives on the evening screen rather than on the feed card because a
 * conversation needs somewhere to be read. The card carries the counts and
 * leads here.
 */
export function ReviewSocial({
  reviewId,
  reviewOwnerId,
}: {
  reviewId: string;
  /** Who owns the entry — they may remove any comment under it. */
  reviewOwnerId: string;
}) {
  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session } = useAuth();

  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [state, thread] = await Promise.all([getLikeState(reviewId), getComments(reviewId)]);
    setLikes(state.count);
    setLiked(state.likedByMe);
    setComments(thread);
  }, [reviewId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [load])
  );

  async function toggleLike() {
    if (busy) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    // Flipped straight away and rolled back on failure, like every other toggle
    // in the app: one that waits for a round trip gets pressed twice.
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    setBusy(true);
    try {
      if (next) await likeReview(reviewId);
      else await unlikeReview(reviewId);
    } catch {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > COMMENT_MAX_LENGTH) {
      setError(strings.social.tooLong(COMMENT_MAX_LENGTH));
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      await addComment(reviewId, body);
      setDraft("");
      // Re-read rather than appending locally: the row carries a server
      // timestamp and an id, and a locally invented one would sort wrongly the
      // moment two comments land in the same second.
      await load();
    } catch {
      setError(strings.social.sendFailed);
    } finally {
      setSending(false);
    }
  }

  async function remove(comment: ReviewComment) {
    try {
      await deleteComment(comment.id);
      await load();
    } catch {
      setError(strings.social.deleteFailed);
    }
  }

  const myId = session?.user?.id;
  const left = COMMENT_MAX_LENGTH - draft.trim().length;

  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.likeRow}>
        <Pressable
          onPress={toggleLike}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          aria-pressed={liked}
          accessibilityState={{ selected: liked }}
          accessibilityLabel={session ? strings.social.like : strings.social.signInToLike}
          style={styles.likeButton}
        >
          <HeartIcon size={18} color={liked ? colors.gold : colors.textFaint} />
          <Text variant="label" tone={liked ? "accent" : "dim"}>
            {strings.social.like}
          </Text>
        </Pressable>
        {likes > 0 && (
          <Text variant="caption" tone="faint">{strings.social.likeCount(likes)}</Text>
        )}
      </View>

      <View style={{ gap: space.md }}>
        <Text variant="label" tone="dim">{strings.social.commentsHeading}</Text>

        {comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Pressable
              onPress={() => router.push(`/user/${c.userId}`)}
              accessibilityRole="button"
              accessibilityLabel={c.authorName}
            >
              <Avatar uri={c.authorAvatarUrl} initials={c.authorInitials} size={30} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.commentMeta}>
                <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {c.authorName}
                </Text>
                <Text variant="caption" tone="faint">{formatTimeAgo(c.createdAt)}</Text>
                {!!c.editedAt && (
                  <Text variant="caption" tone="faint">{strings.social.edited}</Text>
                )}
              </View>
              <Text variant="bodySmall">{c.body}</Text>
              {/* Offered to the author and to whoever owns the evening. The
                  policy in 0032 is what actually decides; this only avoids
                  showing a control that would be refused. */}
              {(c.userId === myId || reviewOwnerId === myId) && (
                <Pressable onPress={() => remove(c)} hitSlop={6} accessibilityRole="button">
                  <Text variant="caption" tone="dim">{strings.social.delete}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}

        {loaded && comments.length === 0 && (
          <Text variant="bodySmall" tone="faint">{strings.social.commentsEmpty}</Text>
        )}

        {session ? (
          <View style={{ gap: space.sm }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={strings.social.commentPlaceholder}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.social.commentPlaceholder}
              multiline
              // No `maxLength`, for the reason the bio field gives: silently
              // swallowing keystrokes reads as a broken keyboard.
              style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
            />
            <View style={styles.sendRow}>
              {left <= 100 && (
                <Text variant="caption" tone={left < 0 ? "accent" : "faint"}>
                  {strings.social.remaining(left)}
                </Text>
              )}
              <Pressable
                onPress={send}
                disabled={!draft.trim() || sending}
                accessibilityRole="button"
                style={[styles.sendButton, { opacity: draft.trim() && !sending ? 1 : 0.4 }]}
              >
                <Text variant="label">
                  {sending ? strings.social.sending : strings.social.send}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="button" hitSlop={6}>
            <Text variant="bodySmall" tone="accent">{strings.social.signInToComment}</Text>
          </Pressable>
        )}

        {!!error && (
          <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  likeRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  comment: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 64,
    fontSize: inputFontSize,
    color: colors.text,
    textAlignVertical: "top",
  },
  sendRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: space.md },
  sendButton: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
