import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { getCurrentUser, getDiaryPlaysForUser } from "@/services/playsService";
import { signOut } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import type { Play, User } from "@/data/types";
import { SettingsIcon } from "@/components/icons/Icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { strings } from "@/i18n/hu";

const TABS = [strings.profile.tabDiary, strings.profile.tabWatchlists, strings.profile.tabReviews] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [user, setUser] = useState<User>();
  const [diary, setDiary] = useState<Play[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(strings.profile.tabDiary);

  useEffect(() => {
    if (!session) {
      setUser(undefined);
      setDiary([]);
      return;
    }
    getCurrentUser().then((u) => {
      setUser(u);
      if (u) getDiaryPlaysForUser(u.id).then(setDiary);
    });
  }, [session]);

  if (loading) return null;

  if (!session) {
    return (
      <View style={[styles.emptyState, { flex: 1, justifyContent: "center", paddingTop: insets.top, backgroundColor: colors.bg }]}>
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 13, color: colors.textFaint, marginBottom: 14 }}>
          {strings.profile.signInPrompt}
        </Text>
        <Button label={strings.profile.signInButton} onPress={() => router.push("/sign-in")} />
      </View>
    );
  }

  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.cover, { paddingTop: insets.top + 16 }]}>
          <Pressable style={styles.settingsBtn} onPress={() => signOut()}>
            <SettingsIcon />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.profileRow}>
            <Avatar initials={user.initials} size={78} serif />
            <Pressable style={styles.editBtn}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12, color: colors.text }}>{strings.profile.editProfile}</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 12, gap: 2 }}>
            <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 21, color: colors.text }}>{user.name}</Text>
            <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
              @{user.handle} · {user.city}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <Stat value={user.stats.playsSeen} label={strings.profile.playsSeen} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.thisYear} label={strings.profile.thisYear} gold />
            <View style={styles.statDivider} />
            <Stat value={user.stats.followers} label={strings.profile.followers} />
            <View style={styles.statDivider} />
            <Stat value={user.stats.following} label={strings.profile.following} />
          </View>

          <View style={styles.tabsRow}>
            {TABS.map((t) => (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabItem, activeTab === t && styles.tabItemActive]}>
                <Text
                  style={{
                    fontFamily: bodyFont(fontsLoaded, activeTab === t ? "bold" : "semibold"),
                    fontSize: 12.5,
                    color: activeTab === t ? colors.text : colors.textFaint,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === strings.profile.tabDiary && (
            <View style={styles.grid}>
              {diary.map((p) => (
                <Pressable key={p.id} style={styles.gridItem} onPress={() => router.push(`/play/${p.id}`)}>
                  <PosterPlaceholder uri={p.posterUrl} height="100%" radius={6} />
                </Pressable>
              ))}
            </View>
          )}
          {activeTab !== strings.profile.tabDiary && (
            <View style={styles.emptyState}>
              <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 12.5, color: colors.textFaint }}>
                {strings.profile.comingSoon(activeTab)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  const fontsLoaded = useAppFonts();
  return (
    <View style={styles.stat}>
      <Text style={{ fontFamily: displayFont(fontsLoaded, "semibold"), fontSize: 19, fontWeight: "700", color: gold ? colors.gold : colors.text }}>
        {value}
      </Text>
      <Text style={{ fontFamily: bodyFont(fontsLoaded), fontSize: 10.5, color: colors.textFaint }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 118,
    backgroundColor: colors.surface2,
    paddingHorizontal: 18,
    alignItems: "flex-end",
  },
  settingsBtn: { padding: 4 },
  profileRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -40,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.hairlineSoft },
  tabsRow: {
    flexDirection: "row",
    gap: 22,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  tabItem: { paddingBottom: 10 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  grid: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "23%", aspectRatio: 2 / 3 },
  emptyState: { marginTop: 24, alignItems: "center", paddingVertical: 30 },
});
