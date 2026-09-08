import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";
import { BrandMark } from "@/components/icons/BrandMark";
import { CalendarIcon, TicketIcon, UserIcon } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * The two account tabs, for somebody without an account.
 *
 * Profil and Kívánságlista used to be one dim sentence and a button, centred
 * in a dark void — the second and third screens a curious visitor taps, and
 * neither said what a diary or a watchlist was for. This is the same block on
 * both, so the two tabs make one argument rather than two apologies, and the
 * tab the reader is on leads the list.
 */
export function SignedOutState({ lead }: { lead: "diary" | "watchlist" }) {
  const styles = useStyles();

  const router = useRouter();
  const items = [
    { key: "diary", icon: <CalendarIcon size={20} color={colors.gold} />, title: strings.signedOut.diaryTitle, body: strings.signedOut.diaryBody },
    { key: "watchlist", icon: <TicketIcon size={20} color={colors.gold} />, title: strings.signedOut.watchlistTitle, body: strings.signedOut.watchlistBody },
    { key: "people", icon: <UserIcon size={20} color={colors.gold} />, title: strings.signedOut.peopleTitle, body: strings.signedOut.peopleBody },
  ].sort((a, b) => (a.key === lead ? -1 : b.key === lead ? 1 : 0));

  return (
    <ContentColumn style={styles.wrap}>
      <BrandMark size={40} />
      <View style={{ gap: space.xs }}>
        <Text variant="eyebrow">{strings.signedOut.eyebrow}</Text>
        <Text variant="display">{strings.signedOut.title}</Text>
      </View>
      <View style={{ gap: space.lg }}>
        {items.map((item) => (
          <View key={item.key} style={styles.item}>
            <View style={styles.icon}>{item.icon}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading">{item.title}</Text>
              <Text variant="bodySmall" tone="dim">
                {item.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ gap: space.md }}>
        <Button label={strings.signedOut.signUp} onPress={() => router.push("/sign-up")} />
        <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "center" }}>
          <Text variant="bodySmall" tone="faint">
            {strings.signedOut.haveAccount}{" "}
            <Text variant="bodySmall" tone="accent">{strings.signedOut.signIn}</Text>
          </Text>
        </Pressable>
      </View>
    </ContentColumn>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  wrap: {
    paddingHorizontal: space["2xl"],
    paddingTop: space["5xl"],
    paddingBottom: space["4xl"],
    gap: space["2xl"],
  },
  item: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: { width: 24, paddingTop: 2, alignItems: "center" },
}));
