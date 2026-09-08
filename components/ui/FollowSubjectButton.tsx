import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import {
  countSubjectFollowers,
  followSubject,
  isFollowingSubject,
  unfollowSubject,
  type FollowSubjectType,
} from "@/services/followService";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * "Tell me when this performer, or this theatre, has something new."
 *
 * One component for both subjects because the interaction is identical and the
 * two pages that host it are otherwise unrelated — keeping it in one place is
 * what stops the person page and Play Detail drifting into two different
 * answers to the same question.
 *
 * It is deliberately honest about what it does today: 0029 records the
 * subscription, and nothing sends anything yet. A hint under the button says
 * so, because a control that promises mail nobody will receive teaches people
 * the app is a mockup — which is the same reasoning that removed the feed's
 * like and comment counters.
 */
export function FollowSubjectButton({
  type,
  subjectKey,
  /** Rendered under the button. Omitted where the surrounding screen is tight. */
  showHint = true,
  /**
   * A small outlined pill with no hint or count, for a row where the subject
   * is named beside it — the theatre line on play detail. A follow is a
   * secondary commitment, and a full-width gold bar for it competed with the
   * one action that screen is built around.
   */
  compact = false,
}: {
  type: FollowSubjectType;
  subjectKey: string;
  showHint?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // The count is public — `subject_follows` is readable by everyone, the
      // same way `follows` is — so it loads for signed-out visitors too.
      countSubjectFollowers(type, subjectKey)
        .then((n) => {
          if (active) setFollowers(n);
        })
        .catch(() => undefined);
      if (session) {
        isFollowingSubject(type, subjectKey)
          .then((f) => {
            if (active) setFollowing(f);
          })
          .catch(() => undefined);
      } else {
        setFollowing(false);
      }
      return () => {
        active = false;
      };
    }, [type, subjectKey, session])
  );

  async function toggle() {
    if (busy) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    // Flipped straight away and rolled back on failure, like the account
    // follow button: one that waits for a round trip gets pressed twice.
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    setBusy(true);
    try {
      if (next) await followSubject(type, subjectKey);
      else await unfollowSubject(type, subjectKey);
    } catch {
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  const label = !session
    ? strings.follow.signInToFollow
    : following
      ? type === "person"
        ? strings.follow.followingPerson
        : strings.follow.followingVenue
      : type === "person"
        ? strings.follow.followPerson
        : strings.follow.followVenue;

  if (compact) {
    return (
      <Button
        label={session ? label : strings.follow.followVenue}
        variant={following ? "outline" : "primary"}
        disabled={busy}
        onPress={toggle}
        accessibilityLabel={label}
        style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 }}
      />
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <Button label={label} variant={following ? "outline" : "primary"} disabled={busy} onPress={toggle} />
      {showHint && (
        <Text variant="caption" tone="dim">
          {following
            ? strings.follow.notYetSending
            : type === "person"
              ? strings.follow.personHint
              : strings.follow.venueHint}
        </Text>
      )}
      {followers > 0 && (
        <Text variant="caption" tone="faint">{strings.follow.followerCount(followers)}</Text>
      )}
    </View>
  );
}
