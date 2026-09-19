import type { ReactNode } from "react";
import { isShareCardSupported, shareCard } from "@/services/shareCardService";
import type { ShareCardInput } from "@/services/shareCardSpec";

/**
 * The one door to the share card, whichever platform is behind it.
 *
 * Metro resolves `ShareCardProvider.native.tsx` on a phone, where the card
 * is laid out as views and captured by `react-native-view-shot`, and this
 * file on the web, where it is painted on a canvas. Callers see the same two
 * things either way — is a card possible here, and a function that makes one
 * and hands it to the share sheet — and never import a native module or a
 * canvas directly. That is what keeps `html2canvas`, which view-shot's web
 * shim would pull in, out of the static export.
 *
 * The web needs no provider component: the canvas is created and thrown away
 * inside `shareCard()`. It is kept as a pass-through so the root layout
 * mounts the same tree on both platforms.
 */
export type ShareCardApi = {
  supported: boolean;
  /**
   * Renders the card and hands it to the share sheet. Resolves false when it
   * managed neither a share nor a download, so the caller can say so.
   */
  share: (input: ShareCardInput) => Promise<boolean>;
};

export function ShareCardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useShareCard(): ShareCardApi {
  return { supported: isShareCardSupported(), share: shareCard };
}
