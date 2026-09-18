import { Linking, StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/i18n/hu";
import { operator } from "@/i18n/legal";

/**
 * What a thrown render error shows instead of expo-router's red default (T-087).
 *
 * Exported from `app/_layout.tsx` as `ErrorBoundary`, which expo-router
 * mounts around every route, so any screen that throws lands here rather
 * than on an English stack trace in the middle of velvet and gold. It
 * renders outside the providers, and `makeStyles` falls back to the default
 * palette there, which is the right one for a screen that has lost its way. It says
 * what happened in one line, offers to try again, and gives a way to tell
 * somebody — with the error's message in the mail, since that is the one
 * fact the reader has and cannot be expected to copy out.
 *
 * `EmptyState`'s vocabulary on purpose: the app has one way of saying
 * "nothing to show here", and a failure is a kind of nothing.
 */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> | void }) {
  const styles = useStyles();
  // The address the impresszum gives, so there is one and it stays true.
  const contact = operator.email;

  function report() {
    const subject = encodeURIComponent("Vastaps: hiba egy képernyőn");
    const body = encodeURIComponent(`\n\n---\n${error.name}: ${error.message}`);
    Linking.openURL(`mailto:${contact}?subject=${subject}&body=${body}`).catch(() => undefined);
  }

  return (
    <View style={styles.screen}>
      <EmptyState
        align="center"
        title={strings.feedback.errorTitle}
        body={strings.feedback.errorBody}
        actionLabel={strings.feedback.errorRetry}
        onAction={() => void retry()}
      />
      {!!contact && (
        <Button label={strings.feedback.errorReport} variant="text" onPress={report} style={styles.report} />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: colors.bg },
  report: { marginTop: -space.xl },
}));
