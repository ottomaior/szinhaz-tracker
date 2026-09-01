import { useFonts as useBodoniModa, BodoniModa_400Regular, BodoniModa_600SemiBold } from "@expo-google-fonts/bodoni-moda";
import { useFonts as useSora, Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";

function useFontState() {
  const [bodoniLoaded, bodoniError] = useBodoniModa({
    BodoniModa_400Regular,
    BodoniModa_600SemiBold,
  });
  const [soraLoaded, soraError] = useSora({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  return {
    loaded: bodoniLoaded && soraLoaded,
    failed: !!bodoniError || !!soraError,
  };
}

/**
 * Loads the two brand faces (Bodoni Moda for display, Sora for UI text).
 * Returns `false` until both families are ready; callers should keep
 * rendering (with fallback fonts from theme/typography.ts) rather than
 * blocking on this.
 */
export function useAppFonts() {
  return useFontState().loaded;
}

/**
 * True once font loading has *settled* — either both families loaded, or at
 * least one failed. The root layout waits on this rather than on `loaded`,
 * because a font that fails to download leaves `loaded` false forever, which
 * used to pin the splash screen open and make the app look frozen.
 */
export function useAppFontsSettled() {
  const { loaded, failed } = useFontState();
  return loaded || failed;
}
