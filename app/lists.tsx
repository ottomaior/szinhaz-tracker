import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
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
  // Set when a production's page sent the reader here to make a list for it.
  const { attach, attachTitle } = useLocalSearchParams<{ attach?: string; attachTitle?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.lists.headerTitle} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space["4xl"] }}>
        <ContentColumn style={{ padding: gutter }}>
          <ListsBody attachPlayId={attach} attachTitle={attachTitle} />
        </ContentColumn>
      </ScrollView>
    </View>
  );
}
