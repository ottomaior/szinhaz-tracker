import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { BRAND_PATHS, BRAND_VIEWBOX } from "@/components/icons/brandGeometry";
import { MaskIcon } from "@/components/icons/MaskIcon";
import { fillPaint } from "@/components/icons/svgPaint";
import { useAppFonts } from "@/hooks/useAppFonts";
import { strings } from "@/i18n/hu";
import {
  SHARE_CARD,
  SHARE_CARD_FORMATS,
  cardPalette as card,
  formatReviewText,
  formatTagsLine,
  showsPoster,
  withAlpha,
  type ShareCardInput,
} from "@/services/shareCardSpec";
import { bodyFont, displayFont } from "@/theme/typography";

/**
 * The share card as native views — the phone's renderer.
 *
 * `services/shareCardService.ts` paints the same card onto a canvas on the
 * web. A phone has no canvas but has `react-native-view-shot`, which
 * rasterises any laid-out view, so here the card is an ordinary column of
 * `Text`, an `expo-image` and a few SVGs, and `ShareCardProvider.native.tsx`
 * mounts it off-screen and captures it. Every number comes from
 * `shareCardSpec.ts`, in card pixels, multiplied by `scale`: a 1080-point
 * view on a 3× phone would be a 3240-pixel bitmap for nothing, so the stage
 * renders it at half size and view-shot resizes the capture back to 1080.
 *
 * Laid out bottom-up like the canvas: `justifyContent: "flex-end"` with the
 * poster taking `flex: 1` at the top, so a long title eats into the
 * photograph rather than into the wordmark.
 *
 * `onReady` fires once there is nothing left to wait for — the poster has
 * loaded or failed (or there was none) and the column has been laid out — so
 * the capture never rasterises a blurhash placeholder where the picture
 * should be, or a story whose velvet has not been measured yet.
 */
export function ShareCardView({
  input,
  scale,
  onReady,
}: {
  input: ShareCardInput;
  scale: number;
  onReady: () => void;
}) {
  const fontsLoaded = useAppFonts();
  const format = SHARE_CARD_FORMATS[input.format];
  const s = (n: number) => n * scale;
  const { margin, gap } = SHARE_CARD;

  const hasPoster = showsPoster(input);
  const [posterDone, setPosterDone] = useState(!hasPoster);
  // Where the photograph ends, in the card's own pixels. A story's velvet
  // starts there rather than at the top — see the background below — and
  // only the layout can say where that is, since the title's line count
  // decides it.
  const [posterBottom, setPosterBottom] = useState<number>();
  const needsLayout = format.posterBleed && hasPoster;
  const ready = posterDone && (!needsLayout || posterBottom !== undefined);

  useEffect(() => {
    if (ready) onReady();
    // Fires once, on the render that became ready; the stage unmounts the
    // card after the capture, so there is no second time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const subtitle = [input.venue, input.dateLabel].filter(Boolean).join(" · ");
  const opinion = input.opinion;
  const reviewText = opinion?.text?.trim() ? formatReviewText(opinion.text) : undefined;
  const tagsLine = opinion?.tags?.length ? formatTagsLine(opinion.tags) : undefined;
  const castLine = opinion?.cast?.length
    ? `${strings.shareCard.castPrefix}${opinion.cast.join(", ")}`
    : undefined;
  const hasOpinion = !!(reviewText || tagsLine || castLine);

  const display = displayFont(fontsLoaded);
  const body = bodyFont(fontsLoaded);
  const bodySemibold = bodyFont(fontsLoaded, "semibold");

  const width = s(format.width);
  const height = s(format.height);

  /** One line of the card's type, sized from the spec. */
  const type = (
    family: string,
    face: { size: number; lineHeight: number },
    color: string,
    extra?: TextStyle
  ): TextStyle => ({
    fontFamily: family,
    fontSize: s(face.size),
    lineHeight: s(face.lineHeight),
    color,
    // Android pads a line to its font's ascender and descender on top of the
    // line height, which would put every block a few pixels lower than the
    // canvas puts it.
    includeFontPadding: false,
    ...extra,
  });

  // Velvet, warmed towards the top where the poster sits. On a story the
  // photograph runs edge to edge and dissolves into the curtain where the
  // type begins, so the gradient starts under the fade rather than at the
  // top: the fade ends on `surface`, and the velvet takes over from there.
  let background: ReactNode;
  if (needsLayout && posterBottom !== undefined) {
    background = (
      <>
        <Rect x="0" y="0" width={width} height={posterBottom} fill={card.surface} />
        <Rect x="0" y={posterBottom} width={width} height={height - posterBottom} fill="url(#velvet)" />
      </>
    );
  } else {
    background = <Rect x="0" y="0" width={width} height={height} fill="url(#velvet)" />;
  }

  return (
    <View style={{ width, height, backgroundColor: card.bg, overflow: "hidden" }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="velvet" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={card.surface} />
            <Stop offset="1" stopColor={card.bg} />
          </LinearGradient>
        </Defs>
        {background}
      </Svg>

      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingTop: format.posterBleed ? 0 : s(format.top),
          paddingBottom: s(format.bottom),
          paddingHorizontal: s(margin),
        }}
      >
        {/* Whatever room the title left: a short title gets a tall photograph
            and a long one gets a band. */}
        {hasPoster && (
          <View
            onLayout={(e: LayoutChangeEvent) =>
              setPosterBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
            }
            style={{
              flex: 1,
              minHeight: s(160),
              marginBottom: s(gap.posterToTitle),
              marginHorizontal: format.posterBleed ? -s(margin) : 0,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: input.posterUrl }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
              // A cached hit fires `onLoad` just the same, so the capture
              // waits on it either way.
              onLoad={() => setPosterDone(true)}
              onError={() => setPosterDone(true)}
            />
            {format.posterBleed && (
              <Svg
                width={width}
                height={s(SHARE_CARD.posterFade)}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
              >
                <Defs>
                  <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={withAlpha(card.surface, 0)} />
                    <Stop offset="1" stopColor={card.surface} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width={width} height={s(SHARE_CARD.posterFade)} fill="url(#fade)" />
              </Svg>
            )}
          </View>
        )}

        <Text numberOfLines={format.titleLines} style={type(display, SHARE_CARD.title, card.text)}>
          {input.title}
        </Text>

        {!!subtitle && (
          <Text
            numberOfLines={1}
            style={type(body, SHARE_CARD.subtitle, card.textDim, { marginTop: s(gap.titleToSubtitle) })}
          >
            {subtitle}
          </Text>
        )}

        {input.rating !== undefined && (
          <View
            style={{
              flexDirection: "row",
              gap: s(SHARE_CARD.mask.gap),
              marginTop: s(gap.subtitleToMasks),
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <MaskIcon
                key={i}
                size={s(SHARE_CARD.mask.size)}
                state={i < Math.round(input.rating as number) ? "on" : "off"}
                // All three tones given, because `MaskIcon` would otherwise
                // read the reader's theme and the card is pinned to one.
                color={card.gold}
                offColor={card.hairline}
                punchColor={card.onAccent}
              />
            ))}
          </View>
        )}

        {hasOpinion && (
          <View style={{ marginTop: s(gap.masksToOpinion) }}>
            {!!reviewText && (
              <Text numberOfLines={format.reviewLines} style={type(body, SHARE_CARD.review, card.text)}>
                {reviewText}
              </Text>
            )}
            {!!tagsLine && (
              <Text
                numberOfLines={1}
                style={type(bodySemibold, SHARE_CARD.tags, card.gold, {
                  marginTop: reviewText ? s(gap.reviewToTags) : 0,
                })}
              >
                {tagsLine}
              </Text>
            )}
            {!!castLine && (
              <Text
                numberOfLines={SHARE_CARD.cast.lines}
                style={type(body, SHARE_CARD.cast, card.textDim, {
                  marginTop: reviewText || tagsLine ? s(gap.tagsToCast) : 0,
                })}
              >
                {castLine}
              </Text>
            )}
          </View>
        )}

        {/* The footer — see `SHARE_CARD.wordmark` in the spec for why it
            says what it says. A hairline, then the domain left and the
            tagline right on one line. */}
        <View
          style={{
            marginTop: s(gap.opinionToRule),
            height: s(SHARE_CARD.rule),
            backgroundColor: card.hairline,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(16),
            marginTop: s(gap.ruleToWordmark),
            height: s(SHARE_CARD.wordmark.lineHeight),
          }}
        >
          <Svg
            width={s(SHARE_CARD.wordmark.mark)}
            height={s(SHARE_CARD.wordmark.mark)}
            viewBox={`0 0 ${BRAND_VIEWBOX} ${BRAND_VIEWBOX}`}
          >
            {BRAND_PATHS.map((d) => (
              <Path key={d} d={d} {...fillPaint(card.gold)} />
            ))}
          </Svg>
          <Text style={type(bodySemibold, SHARE_CARD.wordmark, card.gold)}>
            {strings.shareCard.domain}
          </Text>
          <Text
            numberOfLines={1}
            style={type(body, SHARE_CARD.tagline, card.textDim, { flex: 1, textAlign: "right" })}
          >
            {strings.shareCard.tagline}
          </Text>
        </View>
      </View>
    </View>
  );
}
