import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/theme/styles";
import { gutter, space } from "@/theme/tokens";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { operatorDetailsComplete, pendingNotice, type LegalDocument } from "@/i18n/legal";

/**
 * One legal document, rendered.
 *
 * All three — the privacy policy, the terms and the impresszum — are the same
 * shape and get the same layout, so the route files are three lines each and
 * the copy lives entirely in `i18n/legal.ts`. Nothing here is document-specific
 * on purpose: the moment one of them needs its own layout, that is a sign the
 * copy is doing something it should not.
 *
 * `width="reading"` rather than the default, for the reason `Screen` documents:
 * these are the longest continuous prose in the app, and a paragraph set the
 * full width of a desktop window is the case that cap exists for.
 *
 * These screens deliberately do not read `session`. A privacy policy that is
 * only reachable behind a sign-in is not a privacy policy — the person who most
 * needs to read it is the one deciding whether to create an account, and the
 * Play Console's account-deletion URL requirement later needs the same thing:
 * a page a former user can open from the open web.
 *
 * What they do read is whether the operator details exist yet. Until somebody
 * has decided whether this is published by a person or a company, every
 * document would name `TODO_OPERATOR_NAME` as its data controller, so the
 * screen says the document is still being drafted instead of showing it. The
 * route stays; only the contents wait.
 */
export function LegalScreen({ document }: { document: LegalDocument }) {
  const colors = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={document.title} fallbackRoute="/(tabs)/profile" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <ContentColumn style={{ gap: space["2xl"] }}>
          {!operatorDetailsComplete() ? (
            <View style={{ gap: space.md }}>
              <Text variant="heading" accessibilityRole="header">
                {pendingNotice.heading}
              </Text>
              <Text variant="body" tone="dim">
                {pendingNotice.body}
              </Text>
            </View>
          ) : (
            <>
              <Text variant="bodySmall" tone="faint">
                {document.lead}
              </Text>

              {document.sections.map((section) => (
                <View key={section.heading} style={{ gap: space.md }}>
                  {/* `accessibilityRole="header"` is what lets a screen-reader user
                      jump between sections instead of reading three thousand words
                      in a straight line — which is the only realistic way anyone
                      navigates a document this long. */}
                  <Text variant="heading" accessibilityRole="header">
                    {section.heading}
                  </Text>

                  {section.blocks.map((block, i) =>
                    block.kind === "p" ? (
                      <Text key={i} variant="body" tone="dim">
                        {block.text}
                      </Text>
                    ) : (
                      <View key={i} style={{ gap: space.sm }}>
                        {block.items.map((item) => (
                          // A real two-column row rather than a "• " prefix inside
                          // the string: with the bullet in the text, a wrapped line
                          // returns to the left margin and the list stops looking
                          // like a list.
                          <View key={item} style={styles.bulletRow}>
                            <Text variant="body" tone="faint" style={styles.bullet}>
                              •
                            </Text>
                            <Text variant="body" tone="dim" style={{ flex: 1 }}>
                              {item}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )
                  )}
                </View>
              ))}
            </>
          )}
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: gutter,
    paddingTop: space.xl,
    paddingBottom: space["5xl"],
  },
  bulletRow: {
    flexDirection: "row",
    gap: space.md,
  },
  /** Fixed width so every bullet lines up regardless of the glyph's advance. */
  bullet: {
    width: 10,
  },
});
