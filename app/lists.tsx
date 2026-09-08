import { View, ScrollView } from "react-native";
import { useColors } from "@/theme/styles";
import { gutter, space } from "@/theme/tokens";
import { ListsBody } from "@/components/ui/ListsBody";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { strings } from "@/i18n/hu";

/**
 * Lists, as a screen of their own.
 *
 * Since September 2026 the same content is a tab on Discover, which is where
 * somebody browsing meets it. This route stays for the two ways in that are
 * not Discover — the link on the profile, and a URL — and is nothing but a
 * header around the shared body.
 */
export default function ListsScreen() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.lists.headerTitle} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter }}>
          <ListsBody />
        </ContentColumn>
      </ScrollView>
    </View>
  );
}
