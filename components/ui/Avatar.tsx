import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";

/** Initials avatar in a circle — used until real profile photos exist. */
export function Avatar({
  initials,
  size = 36,
  serif = false,
}: {
  initials: string;
  size?: number;
  serif?: boolean;
}) {
  const fontsLoaded = useAppFonts();
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text
        style={{
          fontFamily: serif ? displayFont(fontsLoaded, "semibold") : bodyFont(fontsLoaded, "bold"),
          fontSize: size * 0.34,
          color: colors.gold,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
});
