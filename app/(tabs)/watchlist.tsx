import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { getVenueById, getWatchlist } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Venue } from "@/data/types";
import { CalendarIcon, PinIcon } from "@/components/icons/Icons";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ play: Play; addedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems(await getWatchlist());
    } catch {
      setFailed(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reloading on focus rather than only on mount: adding a play from the
  // detail screen and coming back here used to show a stale list until the
  // whole app was restarted.
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setItems([]);
        setLoading(false);
        return;
      }
      load();
    }, [session, load])
  );

  const showEmpty = !loading && !authLoading && items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen width="reading">
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <Text variant="title">{strings.watchlist.title}</Text>
          <Text variant="bodySmall" tone="faint">
            {strings.watchlist.subtitle(items.length)}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {items.map(({ play }) => (
            <WatchlistRow key={play.id} play={play} onPress={() => router.push(`/play/${play.id}`)} />
          ))}

          {showEmpty && (
            <EmptyState
              title={failed ? strings.common.loadError : !session ? strings.watchlist.signInPrompt : strings.watchlist.emptyTitle}
              body={!failed && session ? strings.watchlist.emptyBody : undefined}
              actionLabel={failed ? strings.common.retry : !session ? strings.auth.signInButton : strings.watchlist.emptyAction}
              onAction={failed ? load : !session ? () => router.push("/sign-in") : () => router.push("/(tabs)/discover")}
            />
          )}
        </ScrollView>
      </Screen>
    </View>
  );
}

function WatchlistRow({ play, onPress }: { play: Play; onPress: () => void }) {
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [play.venueId]);

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={play.title}>
      <PosterPlaceholder poster={play.poster} title={play.title} seed={play.id} width={64} height={96} radius={radius.sm} preferThumb />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="subheading" numberOfLines={2}>
          {play.title}
        </Text>
        <View style={styles.metaRow}>
          <PinIcon size={13} />
          <Text variant="caption" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
            {venue?.name}
          </Text>
        </View>
        {play.premiereDate && (
          <View style={styles.metaRow}>
            <CalendarIcon size={13} />
            <Text variant="caption" tone="faint">
              {strings.watchlist.premiereLabel}: {formatDate(play.premiereDate)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: gutter,
    paddingBottom: space.lg,
    gap: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  body: { padding: gutter, paddingBottom: 100, gap: space.lg },
  row: { flexDirection: "row", gap: space.md },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
