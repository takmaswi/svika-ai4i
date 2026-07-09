# Owner watchdog gate evidence

Captured 2026-07-10 against the live database after `pnpm watchdog:run`.

- `owner-watchdog-card.png`: the watchdog card on the owner page at 390px,
  labelled "Simulated history", showing 90 scanned days, 8 flags, and the
  bilingual pattern narratives (English shown; Shona serves when the app
  language is Shona).
- `owner-page-full.png`: the full owner page with the revenue ledger view
  above the watchdog card.

The detector evaluation lives at `services/spine/metrics/WATCHDOG-METRICS.md`
(isolation forest F1 0.756 versus fixed threshold F1 0 on held out labelled
days). The bad demo day command is `pnpm watchdog:bad-day`; it regenerates
the history with an unambiguous heavy skim on yesterday and prints the flag
and its explanation.
