import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getVenueById, getWatchlist } from "@/services/playsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, Venue } from "@/data/types";
import { CalendarIcon, PinIcon } from "@/components/icons/Icons";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Button } from "@/components/ui/Button";
import { strings } from "@/i18n/hu";

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 24, color: colors.text }}>{strings.watchlist.title}</Text>
        <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
          {strings.watchlist.subtitle(items.length)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }}>
        {items.map(({ play }) => (
          <WatchlistRow key={play.id} play={play} onPress={() => router.push(`/play/${play.id}`)} />
        ))}

        {showEmpty && (
          <View style={styles.empty}>
            <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 18, color: colors.text, textAlign: "center" }}>
              {failed ? strings.common.loadError : !session ? strings.watchlist.signInPrompt : strings.watchlist.emptyTitle}
            </Text>
            {!failed && session && (
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 13, color: colors.textFaint, textAlign: "center", lineHeight: 19 }}>
                {strings.watchlist.emptyBody}
              </Text>
            )}
            <Button
              label={failed ? strings.common.retry : !session ? strings.auth.signInButton : strings.watchlist.emptyAction}
              variant="outline"
              onPress={failed ? load : !session ? () => router.push("/sign-in") : () => router.push("/(tabs)/discover")}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function WatchlistRow({ play, onPress }: { play: Play; onPress: () => void }) {
  const fontsLoaded = useAppFonts();
  const [venue, setVenue] = useState<Venue>();
  useEffect(() => {
    getVenueById(play.venueId)
      .then(setVenue)
      .catch(() => setVenue(undefined));
  }, [play.venueId]);

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={play.title}>
      <PosterPlaceholder uri={play.posterUrl} width={64} height={96} radius={8} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text numberOfLines={2} style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 16, color: colors.text }}>
          {play.title}
        </Text>
        <View style={styles.metaRow}>
          <PinIcon size={13} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>
            {venue?.name}
          </Text>
        </View>
        {play.premiereDate && (
          <View style={styles.metaRow}>
            <CalendarIcon size={13} />
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 11.5, color: colors.textFaint }}>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  row: { flexDirection: "row", gap: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 48, paddingHorizontal: 10 },
});
