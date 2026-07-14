# Proposal traceability note

Every statistic in the five section drafts, traced to its source, plus the open flags Mhofu needs to close before the PDF is exported. Nothing here is invented. Where a source is external it was web verified; where it is internal it cites a repository file.

## A note on the source documents

The goal named two source files, `AI4I-RUBRIC-NOTES.md` and `COMBINED-EVIDENCE-BASE.md` section G. Neither exists on disk anywhere under the project or the owner's Documents folder. The equivalent material was found and used instead:

- The safety and trust evidence (the "section G" content) is in `docs/Kombi accident deep research/`: the primary research PDF "Safety and Trust Crisis in Harare's Kombi Transport Network" and the "Gemini Comprehensive Assessment" DOCX.
- The rubric is the actual terms of reference, `docs/AI grand challege docs Potraz/AI4I ToRs.../Terms_of_Reference_Track_3_Development.docx`.

If Mhofu has the two named files somewhere else, point me at them and I will reconcile.

## Format and cover page (from the terms of reference, Track 3, sections 6 and 6.1)

- Maximum 10 pages, PDF only. Editable Word or other formats are disqualified.
- Typography: Avenir or Arial, 11pt, 1.15 line spacing, 1 inch margins.
- File name: `[ProjectID]_AI4I_Proposal_Development.pdf`. The project ID stays a placeholder until Mhofu supplies it.
- A cover page is required and is not counted in the 10 pages: project title, track name, team name, lead innovator name, date.
- Cover eyebrow reads "TRUSTED KOMBI TRAVEL FOR HARARE" (a trust and transport forward line; ticketing is the mechanism, not the pitch). The hero promise and the rest of the cover are unchanged.
- The rubric has four criteria, not three: C1 code quality 30, C2 AI justification 30, C3 dataset 20, and **C4 business model and edge feasibility 20**. The global rubric note omitted C4; section 5 was written to carry it.

## Section 1 statistics

| Claim in the draft | Source |
| --- | --- |
| About half of Harare residents use kombis, buses and pirate taxis | Harare Master Plan 2025 to 2045 |
| About 2,000 road deaths a year in Zimbabwe | FactCheckZW, rated true against ZimStat and ZRP data |
| 52,288 crashes and 2,015 deaths in 2024 | Traffic Safety Council of Zimbabwe |
| 1,088 road deaths in H1 2025, up from 1,037 | ZRP, via The Herald |
| 94 percent of crashes caused by human error | TSCZ, via The Herald and Africanews |
| Road death rate about 41 per 100,000, among the highest in Africa; registered rate nearer 30; true toll higher because deaths go unrecorded | WHO Global status report on road safety, cross referenced with the primary research PDF (which cites the lower registered figure) |
| Harare accidents rose from 12,089 (2021) to 22,670 (2022) | Harare Master Plan |
| Kombis carry no passenger manifest | Gemini assessment and primary research PDF, section 4.1 |
| Chitungwiza crash, 17 dead, families sent to the mortuary | AP News and ZRP statement, July 2025 |
| About 13,500 of 16,500 Harare kombis unregistered, 2,950 licensed | ZRP crackdown figures, 2025, via Zimbabwe Now |
| National AI Strategy vision of AI for Development, citizen dignity | National AI Strategy 2026 to 2030, page 17 |
| Pillar 3, transport sub sector, "strengthen fleet management" | National AI Strategy, pages 24 to 25 |
| Informal sector workers a target for financial inclusion | National AI Strategy, page 24 |
| NLP in local languages, AI free from imported biases, Ubuntu | National AI Strategy, pages 9 and 32 |
| Computational sovereignty, in country data control | National AI Strategy, Pillar 2, page 22 |
| Nairobi's informal matatu network was mapped by phone into the city's first complete transit map, released 2014, and the routes entered Google Maps as a transit option, a first for an informal system | Digital Matatus project (a University of Nairobi, MIT Civic Data Design Lab, Columbia University and Groupshot alliance). Web verified: MIT News (2015), digitalmatatus.com, World Economic Forum (2015). Framed in the draft as roadmap capability for Svika, not a built product |

## Section 2 (technical, from committed repository files)

| Claim | Source |
| --- | --- |
| RLS security suite, 102 checks passing | `docs/STORY-STAGE-GATE-REPORT.md`, `docs/BUILD-LOG.md`, `pnpm db:security-test` |
| Ledger invariant tests, 8 passing, 35 transactions balance | phase 1 gate, `docs/P1-GATE-REPORT.md` |
| Offline cycle proof, 34 checks back to back | `docs/P2-GATE-REPORT.md` |
| Spine 1 metrics table (2 journeys, 96.4 s, insufficient_data, baseline serves) | `services/spine/metrics/METRICS.md` (read, not retyped) |
| Spine 2 baseline (fixed alarm clock), statistics not a model | `docs/SPINE-2-COMMUTE-ALERTS.md` |
| Spine 3 metrics table (forest F1 0.756 vs threshold never fires, promoted) | `services/spine/metrics/WATCHDOG-METRICS.md` (read, not retyped) |
| Honesty tiers 1, 2, 3 | `docs/DISCLOSURE-REGISTER.md` |

## Section 3 (deliverables, from committed repository files)

| Claim | Source |
| --- | --- |
| Everything listed as built | `docs/BUILD-LOG.md`, phases P0 to D |
| 287 unit tests across the workspace, 56 full web e2e, 102 security checks, ledger 8/8, offline 34/34, all green | `docs/STORY-STAGE-GATE-REPORT.md` and `docs/BUILD-LOG.md` (latest entries) |
| Two corridor rides recorded 7 July 2026 | `docs/DATASET-STATEMENT.md` |
| Managed Postgres in eu-west-2, no African region offered | `docs/BUILD-LOG.md`, P0 |
| Bootcamp Mutare 27 July to 1 August 2026 | project `CLAUDE.md` |
| Live demo at svika-web.vercel.app, entered through the Enter the demo door with no sign up; phone sign in limited to registered test numbers during the pilot | Deployed web app (`apps/web` on Vercel), `docs/DEPLOY.md`; demo door per `docs/DISCLOSURE-REGISTER.md` |

## Section 4 (compliance, web verified external law)

| Claim | Source |
| --- | --- |
| SI 155 of 2024, Tier 1 data controller licence USD 50 | Veritas Zimbabwe SI 155 text; MawereSibanda; Muvingi and Mugadza; Afriwise (all consistent) |
| DPO required within 90 days; threshold is personal data of 50+ individuals | Same SI 155 legal analyses |
| Breach notification to the Authority within 24 hours; affected individuals within 72 hours if high risk | Cyber and Data Protection Act [Chapter 12:07], via ZimLII and DLA Piper / Manokore guide |
| Consent gate, append only consent records, anonymise_me, privacy notice | `docs/PHASE-C-GATE-REPORT.md` |

## Section 5 (sustainability)

| Claim | Source |
| --- | --- |
| Kombi presumptive tax USD 50 a month for 8 to 14 seaters, USD 60 for 15 to 24, monthly via ZINARA, no licence renewal without a tax clearance | ZIMRA Public Notice 51 of 2025, gazetted 5 September 2025. Web verified across ZimLive, NewsDay (11 September 2025) and Equity Axis; consistent with ZIMRA's own notice |
| Conductor commission on digital fares | ledger schema `commission_rate_bps`, `packages/db/src/database.types.ts` |
| Map tiles are a licensed MapTiler display service, no third party datasets | `docs/DATASET-STATEMENT.md` |
| City planning as a second beneficiary, a municipality or planning agency as a natural second customer for anonymised aggregate insight, on the Nairobi precedent | Digital Matatus (see Section 1 traceability row). Echoed from S1; framed as roadmap, not a billed line today |
| CPU only models, no phone inference, offline conductor PWA as edge resilience, inference in country on ZCHPC | Section 2 and Section 3 model and offline descriptions; National AI Strategy Pillar 2 |
| Overall winner, GDG Harare Build with AI Hackathon 2026, a Google Developer Groups community event themed on localisation, 4.93 out of 5 from an independent judging panel | Official results email, 11 May 2026. GDG Harare (Google Developer Groups) is a developer community, not Google the company; the framing says so, and the prize amount is deliberately omitted |
| Rider convenience tier: a free tier that always carries safety, trip planning, cash and accessibility, and a low priced tier that unlocks convenience only (saved routines, commute alerts, voice guidance, offline route packs); nothing safety related is paywalled and paying riders get no queue privilege | Business model, presented as a model to price and test, not as built. Governed by the product laws in the project `CLAUDE.md` (no dark patterns, no queue privileges for digital riders, cash always accepted) and the honesty tiers in `docs/DISCLOSURE-REGISTER.md` |
| Network data engine and moat: the same custom field logger any rider or conductor runs turns routine travel into one growing record of real routes, stops and fares that no competitor and no city holds today, consented, anonymised and aggregate only | The field logger and corridor data are real and running on the Mount Pleasant Heights to Rezende corridor now (`docs/DATASET-STATEMENT.md`, Section 2 spine 1); network wide coverage is stated as the scaling plan, not present reach. Consent and anonymisation stance per `docs/PHASE-C-GATE-REPORT.md` and Section 4; the no competitor or city holds it framing rests on the Nairobi Digital Matatus precedent cited in Section 1 |

## Citation hygiene (final sweep)

The submitted prose no longer drops raw internal file paths. The routine gate report and note references (`P2-GATE-REPORT`, `STORY-STAGE-GATE-REPORT`, `PHASE-C-GATE-REPORT`, `PHASE-D-GATE-REPORT`, `BUILD-LOG`, `SPINE-2-COMMUTE-ALERTS`, `DISCLOSURE-REGISTER`, `DATASET-STATEMENT`, `SHONA-MODEL-PLAN`) are now plain narrative ("all green in CI", "the committed offline test suite", "a committed roadmap plan", and similar). The private note `docs/CHECKS-FOR-MHOFU.md` was removed from the proposal entirely; it must never appear in a submission. One clean line in S3 points to the public repository `github.com/takmaswi/svika-ai4i` as where all committed evidence lives, which is the git link the terms of reference expect. The two AI metrics pointers stay cited inline because they prove the numbers to a judge: `services/spine/metrics/METRICS.md` and `services/spine/metrics/WATCHDOG-METRICS.md`. No statistic and no external source citation was touched. The claim-to-source rows above keep their internal file pointers as the reviewer's audit trail.

## Flags

### Closed in this revision

1. **WHO per capita road death rate. Closed.** S1 now states about 41 per 100,000 (WHO estimate), among the highest in Africa, with an honest line that the registered count is nearer 30 and the WHO judges the real toll higher because many deaths go unrecorded. The [FLAG] is removed.
2. **Coach Rambo. Closed by decision.** Stays out of the written proposal. Both source documents call it unverified tabloid and social media reporting with no ZRP confirmation. Kept for the live pitch only if it is confirmed before demo day.
5. **ZIMRA presumptive tax citation. Closed.** S5 now cites ZIMRA Public Notice 51 of 2025, gazetted 5 September 2025, web verified across ZimLive, NewsDay and Equity Axis. The in app figure is confirmed correct for the kombi range.

### Still open for Mhofu (close before PDF export)

3. **AI4I submission deadline** is not in the terms of reference we hold. It must be read off the portal (https://bit.ly/AI4IChallenge26) and is one of the five inputs owed.
4. **[ProjectID]** stays a placeholder in the filename and cover page until you supply it.
6. **Infrastructure cost figures in S5** are described as a structure, not as specific monthly dollar amounts, because we do not yet have a costed hosting plan. Marked [FLAG] in the draft.
7. **Team details for the cover page** (team name, lead innovator, the 2 to 5 Zimbabwean members) are owed, along with the notarised affidavit that shortlisted teams submit.
