import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { rule, space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { makeStyles } from "@/theme/styles";

/**
 * A line the screen says to the reader that is not content: an error under a
 * form, a note that something could not be loaded, a fact about the state
 * the screen is in.
 *
 * Twenty-six screens rendered this as a bare gold `bodySmall` with
 * `accessibilityRole="alert"`, each deciding its own padding. Gold was the
 * wrong colour for it: in this app gold means "you can still go and see
 * this", and a failed save in the same colour reads as good news. An error is
 * set in the text colour on a rule of the accent — the eye finds it, and the
 * accent keeps its one meaning.
 *
 * `tone="info"` is the same line for something that is not wrong: "you are
 * completing an undated entry", "signed out". `tone="error"` announces itself
 * to a screen reader; info does not interrupt.
 */
export function Notice({
  children,
  tone = "error",
  style,
}: {
  children: string;
  tone?: "error" | "info";
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "error" ? "assertive" : undefined}
      style={[styles.notice, tone === "error" ? styles.error : styles.info, style]}
    >
      <Text variant="bodySmall" tone={tone === "error" ? "default" : "dim"}>
        {children}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  notice: {
    paddingVertical: space.xs,
    paddingLeft: space.md,
    borderLeftWidth: rule,
  },
  error: { borderLeftColor: colors.gold },
  info: { borderLeftColor: colors.hairline },
}));
