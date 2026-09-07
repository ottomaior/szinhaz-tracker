import type { ReactNode } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, space } from "@/theme/tokens";
import { CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { ContentColumn } from "@/components/ui/Screen";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";

/**
 * The bar across the top of every modal: a close control, a title, and a
 * balancing spacer so the title stays optically centred.
 *
 * All four modals had their own copy of this, which is how they drifted to
 * three different title sizes for the same piece of chrome.
 */
export function ModalHeader({
  title,
  fallbackRoute,
  action,
}: {
  title: string;
  /** Where to land when the modal was opened directly and has no history. */
  fallbackRoute?: Parameters<typeof closeModal>[1];
  /** Trailing control, e.g. the check-in modal's save. Replaces the spacer. */
  action?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <ContentColumn width="content">
        <View style={styles.row}>
          <Pressable
            onPress={() => closeModal(router, fallbackRoute)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={strings.common.close}
          >
            <CloseIcon />
          </Pressable>
          <Text variant="subheading">{title}</Text>
          {/* Matches the close icon's width so the title sits centred. */}
          {action ?? <View style={{ width: 18 }} />}
        </View>
      </ContentColumn>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
    backgroundColor: colors.bg,
  },
  row: {
    height: 56,
    paddingHorizontal: gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
});
