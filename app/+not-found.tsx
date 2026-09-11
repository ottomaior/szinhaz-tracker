import { View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/theme/styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { strings } from "@/i18n/hu";

/**
 * An address the router has no screen for.
 *
 * Without this file expo-router draws its own: "Unmatched Route — Page could
 * not be found." in white system type on black, with a link to a sitemap of
 * every route in the app (T-055). A mistyped link is the most ordinary way
 * to arrive here, and it should land in the same house as everything else,
 * with the same "nem találjuk" the person, list and entry screens already
 * use and a way back into the product.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.appName} fallbackRoute="/(tabs)/discover" />
      <ContentColumn style={{ paddingTop: 24 }}>
        <EmptyState
          title={strings.common.notFoundTitle}
          body={strings.common.notFoundBody}
          actionLabel={strings.common.notFoundAction}
          onAction={() => router.replace("/(tabs)/discover")}
        />
      </ContentColumn>
    </View>
  );
}
