import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { avatar, bar, gutter, hairlineWidth, icon, maxWidth, space } from "@/theme/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUser } from "@/services/playsService";
import type { User } from "@/data/types";
import { BrandMark } from "@/components/icons/BrandMark";
import { BellIcon, PlusIcon } from "@/components/icons/Icons";
import { CountBadge } from "@/components/ui/Badges";
import { IconButton } from "@/components/ui/Button";
import { getUnreadCount } from "@/services/notificationService";
import { pressStyle } from "@/components/ui/pressable";
import { useColors } from "@/theme/styles";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { PillTabs } from "@/components/ui/PillTabs";
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
  const palette = useColors();
  const [viewer, setViewer] = useState<User>();
  const [unread, setUnread] = useState(0);

  // The reader's face, refreshed on focus for the reason the feed header gives:
  // the screen that changes it returns here.
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setViewer(undefined);
        setUnread(0);
        return;
      }
      let active = true;
      getCurrentUser()
        .then((u) => {
          if (active) setViewer(u);
        })
        .catch(() => undefined);
      // The bell's count, for the same reason the phone's feed header
      // refreshes it on focus: it clears when the reader comes back from
      // the inbox having read everything.
      getUnreadCount()
        .then((n) => {
          if (active) setUnread(n);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [session])
  );

  // Which section the address is in, for the pill. "/" only matches itself:
  // every other path starts with it too.
  const activePath =
    SECTIONS.find(({ path }) => (path === "/" ? pathname === "/" || pathname === "/index" : pathname.startsWith(path)))?.path ?? "/";

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable
          onPress={() => router.push("/(tabs)/discover")}
          style={pressStyle("quiet", palette, styles.brand)}
          accessibilityRole="link"
          accessibilityLabel={strings.appName}
        >
          <BrandMark size={22} />
          <Text variant="heading">{strings.appName}</Text>
        </Pressable>

        <View style={styles.nav}>
          <PillTabs
            variant="bar"
            tabs={SECTIONS.map(({ path, label }) => ({ key: path, label }))}
            value={activePath}
            onChange={(path) => {
              const section = SECTIONS.find((s) => s.path === path);
              if (section) router.push(section.href);
            }}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.checkin.headerTitle}
            icon={<PlusIcon size={icon.inline} />}
            size="sm"
            onPress={() => router.push("/checkin")}
          />
          {/* The inbox lives here on a wide screen. It used to be on the
              feed's own header, which meant the notifications were somewhere
              different depending on which tab the reader was on. */}
          {!!session && (
            <View style={styles.bell}>
              <IconButton onPress={() => router.push("/inbox")} accessibilityLabel={strings.inbox.openNotifications}>
                <BellIcon />
              </IconButton>
              {unread > 0 && <CountBadge count={unread} style={styles.badge} />}
            </View>
          )}
          {session ? (
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={pressStyle("quiet", palette, undefined)}
              accessibilityRole="button"
              accessibilityLabel={strings.tabs.profile}
            >
              <Avatar uri={viewer?.avatarUrl} initials={viewer?.initials ?? ""} size={avatar.byline} />
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
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairlineSoft,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: maxWidth.content,
    height: bar,
    paddingHorizontal: gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: space["3xl"],
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  nav: { flex: 1, flexDirection: "row", alignItems: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md },
  // `overflow: visible` matters: the badge is positioned outside the bell's
  // own box, and clipping it would leave a bell that never looks like it has
  // anything in it.
  bell: { position: "relative", overflow: "visible" },
  badge: { position: "absolute", top: 0, right: 0 },
}));
