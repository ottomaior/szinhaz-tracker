import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { gutter, maxWidth, radius, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUser } from "@/services/playsService";
import type { User } from "@/data/types";
import { BrandMark } from "@/components/icons/BrandMark";
import { PlusIcon } from "@/components/icons/Icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * The navigation on a wide screen.
 *
 * The bottom tab bar is a phone's: four thumb-sized targets and a raised
 * "+" where a thumb rests. Stretched across a 1280pt browser window it put
 * four 10px labels a foot apart under a content column half the width, and
 * the "+" floated in the middle of nowhere. From the `expanded` breakpoint
 * app/(tabs)/_layout.tsx renders this instead: the brand, the four sections,
 * the one gold action and the reader's face, in a bar the width of the
 * content. The tab bar and the screens underneath are untouched.
 */
const SECTIONS = [
  { path: "/", href: "/(tabs)", label: strings.tabs.feed },
  { path: "/discover", href: "/(tabs)/discover", label: strings.tabs.discover },
  { path: "/watchlist", href: "/(tabs)/watchlist", label: strings.tabs.watchlist },
  { path: "/profile", href: "/(tabs)/profile", label: strings.tabs.profile },
] as const;

export function TopBar() {
  const styles = useStyles();

  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const [viewer, setViewer] = useState<User>();

  // The reader's face, refreshed on focus for the reason the feed header gives:
  // the screen that changes it returns here.
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setViewer(undefined);
        return;
      }
      let active = true;
      getCurrentUser()
        .then((u) => {
          if (active) setViewer(u);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [session])
  );

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.push("/(tabs)/discover")} style={styles.brand} accessibilityRole="link" accessibilityLabel={strings.appName}>
          <BrandMark size={22} />
          <Text variant="heading">{strings.appName}</Text>
        </Pressable>

        <View style={styles.nav} accessibilityRole="tablist">
          {SECTIONS.map(({ path, href, label }) => {
            const active = path === "/" ? pathname === "/" || pathname === "/index" : pathname.startsWith(path);
            return (
              <Pressable
                key={path}
                onPress={() => router.push(href)}
                style={[styles.navItem, active && styles.navItemActive]}
                accessibilityRole="tab"
                aria-selected={active}
                accessibilityState={{ selected: active }}
              >
                <Text variant="label" tone={active ? "default" : "faint"}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.checkin.headerTitle}
            icon={<PlusIcon size={15} />}
            onPress={() => router.push("/checkin")}
            style={styles.logButton}
          />
          {session ? (
            <Pressable onPress={() => router.push("/(tabs)/profile")} accessibilityRole="button" accessibilityLabel={strings.tabs.profile}>
              <Avatar uri={viewer?.avatarUrl} initials={viewer?.initials ?? ""} size={34} />
            </Pressable>
          ) : (
            <Button label={strings.auth.signInButton} variant="text" onPress={() => router.push("/sign-in")} />
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  bar: {
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: maxWidth.content,
    height: 60,
    paddingHorizontal: gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: space["3xl"],
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  nav: { flexDirection: "row", gap: space["2xl"], flex: 1, height: "100%" },
  navItem: { justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  navItemActive: { borderBottomColor: colors.gold },
  actions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  logButton: { paddingVertical: 8, paddingHorizontal: space.lg, borderRadius: radius.pill },
}));
