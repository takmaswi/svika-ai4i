# Map camera policy

Decided 2026-07-11 as part of the map excellence pass. The rider map is
judged against e hailing apps, so the camera behaves like one: open close,
answer the question the rider is actually asking, keep the whole picture one
tap away. Reference device is 360px wide.

## The three cameras

### 1. Rider home: the boarding view

The question on the home screen is "where is my kombi and where do I get
on". The old camera fit the entire 13.5 km corridor into the container,
including the 396px band under the peek sheet: kombis rendered tiny, their
motion read as ticking, and the answer was nowhere.

The home map now opens on the rank the peek card quotes ("From 2nd boom
gate") plus the kombi currently nearest to it, with the first two stops in
frame. Concretely: bounds around the rank, the next two stops and the
nearest kombi, padded 150px top (clears the chip rows), 420px bottom (clears
the peeking sheet), 40px sides, capped at zoom 15. Every opening frame holds
a moving kombi, the rank and the stops around it, in the band of map the
sheet never covers.

The full corridor is one tap away: a "Whole route" glass chip sits opposite
the demo chip and swings the camera to the corridor bounds with the same
sheet aware padding ("Boarding area" swings back). Pinch and drag stay live
the whole time; under reduced motion the swing is a jump.

### 2. Planned trip: frame the journey

When a trip is planned (`/app/plan`), the camera fits the trip overlay
(origin, destination, every leg) into the band above the plan sheet: 72px
top, 356px bottom, 48px sides. The rider sees their whole journey and the
fare at once. This was already the behaviour; it is now policy. An active
(booked) trip keeps this camera on the plan screen; the ticket screen is a
boarding card by design and carries no map.

### 3. Landing: the whole corridor

The logged out landing map keeps the whole corridor fit (48px padding all
round). It sits in a card mid page as proof the product is real, and the
full route is the story there.

## The entrance (DESIGN.md section 12)

On map screens the sequence is: route draws, then pins, then kombis.
Implemented on the live map itself: the dotted route grows from the rank
along the real road (1.3 s ease out after a 0.4 s beat), stop pins and their
labels fade in as the draw lands, and the kombis fade in and start moving
last. On the plan screen the trip legs draw instead and the corridor stays
muted context. Under reduced motion there is no sequence: everything is
present immediately and kombis step once a second.

## Attribution

MapLibre's attribution moved to the top right, below the chip row: bottom
corners belong to the sheet and the demo chip, and attribution must stay
readable without overlapping either.

## Spec gaps flagged (not improvised)

DESIGN.md has no camera section: the reference screens are static frames
with no opening zoom, no entrance camera and no trip framing rule. This
policy is proposed as the spec addition; the section 12 order was applied to
the camera as the nearest existing law. Flagged for Mhofu:

1. A "Camera" subsection in DESIGN.md recording the three cameras above.
2. The "Whole route" / "Boarding area" toggle chip is a new control not in
   any numbered screen; it borrows the demo chip's glass grammar. Needs a
   blessing or a redesign in the spec.
3. The view toggle labels ("Whole route", "Boarding area") are new copy,
   bilingual from the translation file, Shona machine drafted like the rest
   (translator pass owed).
