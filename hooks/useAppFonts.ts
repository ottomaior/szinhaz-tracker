import { useFonts as useBodoniModa, BodoniModa_400Regular, BodoniModa_600SemiBold } from "@expo-google-fonts/bodoni-moda";
import { useFonts as useSora, Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";

/**
 * Loads the two brand faces (Bodoni Moda for display, Sora for UI text).
 * Returns `loaded === false` until both families are ready; callers should
 * keep rendering (with fallback fonts from theme/typography.ts) rather than
 * blocking on this, except for the root layout which waits before hiding
 * the splash screen.
 */
export function useAppFonts() {
  const [bodoniLoaded] = useBodoniModa({
    BodoniModa_400Regular,
    BodoniModa_600SemiBold,
  });
  const [soraLoaded] = useSora({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  return bodoniLoaded && soraLoaded;
}
