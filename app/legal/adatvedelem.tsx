import Head from "expo-router/head";
import { LegalScreen } from "@/components/ui/LegalDocument";
import { privacyPolicy } from "@/i18n/legal";
import { strings } from "@/i18n/hu";

/**
 * A pre-rendered, publicly reachable document — see the note in
 * `components/ui/LegalDocument` about why this must not sit behind a session.
 */
export default function PrivacyPolicyScreen() {
  return (
    <>
      {/* The root layout claims a single app-wide title after hydration, so a
          document that wants its own has to say so here. It matters more for
          these three than for any other screen: they are the pages that get
          linked to from outside the app. */}
      <Head>
        <title>{`${privacyPolicy.title} · ${strings.appName}`}</title>
      </Head>
      <LegalScreen document={privacyPolicy} />
    </>
  );
}
