import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareCardView } from "@/components/share/ShareCardView";
import { SHARE_CARD_FORMATS, type ShareCardInput } from "@/services/shareCardSpec";
import type { ShareCardApi } from "@/components/share/ShareCardProvider";

export type { ShareCardApi } from "@/components/share/ShareCardProvider";

/**
 * The share card on a phone (T-009).
 *
 * There is no canvas here. What there is: `react-native-view-shot`, which
 * rasterises any view that has been laid out, and `expo-sharing`, which hands
 * a file to the system share sheet — Instagram, Messenger, the camera roll
 * and everything else that takes a PNG. So the provider keeps a stage: a view
 * parked far off the left edge of the screen, into which `share()` mounts a
 * `ShareCardView`, waits for it to say it is ready, captures it at the
 * card's true size and shares the file. The stage is empty except during
 * those few hundred milliseconds.
 *
 * Off-screen rather than hidden: a view at `opacity: 0` is drawn at opacity
 * zero, and one with `display: "none"` is not laid out at all. A view at
 * `left: -10000` is laid out and painted in full and simply falls outside the
 * window — Android's `View.draw()` and iOS's `drawViewHierarchyInRect` both
 * render it from its own coordinates. Android is what the closed test runs;
 * iOS has never been built (BACKLOG Part A), so that half is by the book
 * rather than by a device.
 *
 * Rendered at half the card's size and captured with the card's own `width`
 * and `height`, which view-shot scales the bitmap to. Half of 1080 points on
 * a 2× or 3× phone is still at least 1080 pixels, and a third of the memory.
 */
const STAGE_SCALE = 0.5;

/** How long to wait for the poster before capturing the card without it. */
const READY_TIMEOUT_MS = 6000;

type Job = {
  id: number;
  input: ShareCardInput;
  resolve: (ok: boolean) => void;
};

const ShareCardContext = createContext<ShareCardApi>({
  supported: false,
  share: async () => false,
});

export function useShareCard(): ShareCardApi {
  return useContext(ShareCardContext);
}

export function ShareCardProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<Job | null>(null);
  const counter = useRef(0);

  const share = useCallback(
    (input: ShareCardInput) =>
      new Promise<boolean>((resolve) => {
        // One at a time. A second request while the stage is busy replaces
        // the first, which resolves as not shared — the person tapped again
        // because nothing seemed to happen, and two share sheets is worse.
        setJob((current) => {
          current?.resolve(false);
          return { id: ++counter.current, input, resolve };
        });
      }),
    []
  );

  const api = useMemo<ShareCardApi>(() => ({ supported: true, share }), [share]);

  return (
    <ShareCardContext.Provider value={api}>
      {children}
      {job && <Stage key={job.id} job={job} onDone={() => setJob((j) => (j?.id === job.id ? null : j))} />}
    </ShareCardContext.Provider>
  );
}

function Stage({ job, onDone }: { job: Job; onDone: () => void }) {
  const ref = useRef<View>(null);
  const started = useRef(false);
  const done = useRef(false);
  const format = SHARE_CARD_FORMATS[job.input.format];

  const finish = useCallback(
    (ok: boolean) => {
      if (done.current) return;
      done.current = true;
      job.resolve(ok);
      onDone();
    },
    [job, onDone]
  );

  const capture = useCallback(async () => {
    // Reached twice at most — once by the card saying it is ready and once
    // by the timeout below — and only the first one captures.
    if (started.current) return;
    started.current = true;
    // One frame after "ready": the image has decoded and the layout has
    // settled, but the native view is painted on the next pass.
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    if (done.current || !ref.current) return finish(false);
    try {
      // Left in the cache directory afterwards rather than released: on
      // Android the app that took the file may still be reading it after the
      // chooser has returned, and the cache is the OS's to clear.
      const uri = await captureRef(ref.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: format.width,
        height: format.height,
      });
      if (!(await Sharing.isAvailableAsync())) return finish(false);
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: job.input.title });
      // A dismissed share sheet resolves the same as a completed one on both
      // platforms, and either way the person saw the card and decided.
      finish(true);
    } catch {
      finish(false);
    }
  }, [finish, format.height, format.width, job.input.title]);

  // The poster is the only thing the card waits on, and a poster that never
  // loads must not hold the share sheet hostage: after this long the card
  // goes out with the velvet where the picture would have been.
  useEffect(() => {
    const handle = setTimeout(capture, READY_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, [capture]);

  return (
    <View
      ref={ref}
      // Not flattened away: view-shot needs a real native view to capture,
      // and React Native removes a plain `View` that only positions its child.
      collapsable={false}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: -10000,
        width: format.width * STAGE_SCALE,
        height: format.height * STAGE_SCALE,
      }}
    >
      <ShareCardView input={job.input} scale={STAGE_SCALE} onReady={capture} />
    </View>
  );
}
