// Narration script for the showcase deck, one entry per scene, written to
// match the on screen copy and beats. APPROVED by Mhofu 2026-07-17 exactly
// as drafted; voice is takunda-man (see the rulings in deck/NOTES.md).
// Consumed by make-audio.mjs; file names follow the scene ids.

export const SAMPLE_LINE =
  "You were given an address. Nobody told you where to get off. That ride is why Svika exists.";

export const NARRATION = [
  {
    scene: "s01",
    id: "s1-cold-open",
    text: "Harare moves by kombi. This is Svika.",
  },
  {
    scene: "s02",
    id: "s2-founding-ride",
    text: "You were given an address. Nobody told you where to get off. The kombi passed the turn off, and the walk home was long, dark, and one stop too late to fix. That ride is why Svika exists.",
  },
  {
    scene: "s03",
    id: "s3-real-today",
    text: "This part works today, on a live database. You board with a four digit code. Unreturned change becomes credit in your wallet. And arrival times are predicted from real recorded corridor rides.",
  },
  {
    scene: "s04",
    id: "s4-take-me-there",
    text: "Type any place in the city. Svika turns it into a plan. Which kombi, where to drop, how far the walk. Then the voice rides with you, so the turn off never slips past again.",
  },
  {
    scene: "s05",
    id: "s5-guardian",
    text: "Guardian mode. She gets there, and you see it. Boarded, en route, arrived. The child always sees who is watching. No silent tracking, ever.",
  },
  {
    scene: "s06",
    id: "s6-city-maps",
    text: "Every ride teaches the map. Journeys become places, places become shortcuts, and the city writes its own atlas, one trip at a time.",
  },
  {
    scene: "s07",
    id: "s7-send-a-ride",
    text: "Send a ride, not money. A ticket bought on your phone lands on hers, ready to board. One day that code could be bought in London and boarded in Chitungwiza. That part stays a slide for now.",
  },
  {
    scene: "s08",
    id: "s8-kombis-employed",
    text: "The dawn run no company car can price. An office park signs a charter. One kombi, one contract, thirty people at their desks by seven.",
  },
  {
    scene: "s09",
    id: "s9-rank-pulse",
    text: "Know before you walk down. Seats counted from cleared fares. The last kombi's usual time, from ticket history. A count, not AI, and the app says so.",
  },
  {
    scene: "s10",
    id: "s10-close",
    text: "The future of the kombi is already boarding. Team Svika. Built in Harare. Ride it today.",
  },
];

// Sound design: Vox documentary restraint. Short, quiet, mixed under
// narration. If a generated effect sounds gimmicky it gets cut; silence
// beats clutter.
export const SFX = [
  {
    name: "draw",
    text: "A single soft airy whoosh, like a pen drawing a long smooth line, subtle, low volume, clean studio recording, no music",
    seconds: 1.6,
  },
  {
    name: "stop-pop",
    text: "One soft low round pop, like a small bubble landing on a map, subtle, muted, clean, no music",
    seconds: 0.7,
  },
  {
    name: "card-deal",
    text: "A single muted playing card being dealt onto a felt table, soft, quick, clean, no music",
    seconds: 0.7,
  },
  {
    name: "type-tick",
    text: "Soft quiet phone keyboard typing ticks, steady, gentle, muffled, no music",
    seconds: 1.8,
  },
  {
    name: "chime",
    text: "A gentle warm single notification chime, soft marimba like, quiet, pleasant, no music",
    seconds: 1.4,
  },
  {
    name: "odometer",
    text: "A quiet rapid mechanical odometer counter ticking up briefly then stopping, soft, subtle, no music",
    seconds: 1.2,
  },
  {
    name: "swoosh",
    text: "A soft quick swoosh of a small card flying through the air and landing gently, subtle, clean, no music",
    seconds: 1.1,
  },
  {
    name: "swell",
    text: "A low warm soft synth swell rising gently and settling, cinematic but restrained, quiet, three seconds, no music melody",
    seconds: 3.2,
  },
];
