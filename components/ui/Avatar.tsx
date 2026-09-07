import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/theme/colors";
import { bodyFont, displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { makeStyles } from "@/theme/styles";

/**
 * Somebody's picture in a circle, falling back to their initials.
 *
 * The monogram is not a placeholder to be embarrassed about: most accounts will
 * never upload anything, and a grey silhouette says less about a person than
 * two letters do. So the fallback stays the same mark it has always been, and
 * `uri` simply covers it when there is a photograph.
 *
 * expo-image rather than the RN one, for the same reason the poster component
 * uses it: a feed of twenty cards remounts the same handful of avatars
 * constantly, and the plain image re-fetches every time.
 */
export function Avatar({
  uri,
  initials,
  size = 36,
  serif = false,
}: {
  /** Public URL of the profile picture. Omitted or broken falls back to initials. */
  uri?: string;
  initials: string;
  size?: number;
  serif?: boolean;
}) {
  const styles = useStyles();

  const fontsLoaded = useAppFonts();
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt — otherwise replacing a picture that
  // once failed to load leaves the monogram showing until the screen remounts.
  useEffect(() => setFailed(false), [uri]);

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          style={{
            fontFamily: serif ? displayFont(fontsLoaded, "semibold") : bodyFont(fontsLoaded, "bold"),
            fontSize: size * 0.34,
            color: colors.gold,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
}));
