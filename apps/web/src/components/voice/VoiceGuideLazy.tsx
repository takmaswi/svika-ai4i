"use client";

// The voice guide shares the sim and corridor modules with the map; loading
// it lazily keeps the home shell payload unchanged for riders without an
// active boarded trip.
import dynamic from "next/dynamic";
import type { VoiceGuideProps } from "./VoiceGuide";

const Inner = dynamic(() => import("./VoiceGuide").then((m) => m.VoiceGuide), {
  ssr: false,
});

export function VoiceGuideLazy(props: VoiceGuideProps) {
  return <Inner {...props} />;
}
