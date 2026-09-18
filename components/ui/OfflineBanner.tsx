import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnline } from "@/hooks/useOnline";
import { space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * A thin line under the chrome while there is no connection (T-088).
 *
 * A theatre foyer, a basement stúdió, a train: the app used to show a blank
 * grid or a spinner that never ended, and nothing said why. That reads as
 * broken rather than as offline. This says offline, and says that what is on
 * screen is the last thing loaded rather than the current truth — which is
 * the part a person actually needs to know before trusting a curtain time.
 *
 * In the flow, not floating: it takes its own row so nothing is covered,
 * and it is gone the moment the connection is back.
 */
export function OfflineBanner() {
  const styles = useStyles();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text variant="caption" style={styles.text} numberOfLines={2}>
        {strings.feedback.offline}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  bar: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: colors.goldTintBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    alignItems: "center",
  },
  text: { color: colors.text, textAlign: "center" },
}));
