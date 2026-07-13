# Section 1: Problem definition and strategic alignment

*AI4I Challenge 2026, Track 3 Development. Draft for review. Final file: [ProjectID]_AI4I_Proposal_Development.pdf. Page budget: 1 to 2 pages.*

## The problem: Harare's kombi network is unsafe, and no one is accountable

Half of Harare gets to work in a kombi. The city's own master plan puts about half of residents on kombis, buses and pirate taxis for the daily commute (Harare Master Plan 2025 to 2045). That network moves the city, and it is dangerous in a way that is now measurable.

Zimbabwe loses about 2,000 people on its roads every year. FactCheckZW rated that figure true against ZimStat and Zimbabwe Republic Police data, and the Traffic Safety Council of Zimbabwe records 52,288 crashes and 2,015 deaths for 2024 alone. The trend is worsening, not settling: road deaths in the first half of 2025 rose to 1,088, up from 1,037 in the same half the year before (ZRP, via The Herald). The Traffic Safety Council attributes 94 percent of crashes to human error (TSCZ, via The Herald and Africanews). The World Health Organization estimates Zimbabwe's road death rate at about 41 per 100,000 people, among the highest in Africa; the officially registered count is lower, nearer 30 per 100,000, and the WHO judges the real toll higher because many road deaths are never recorded (WHO, Global status report on road safety). In Harare specifically, recorded accidents jumped from 12,089 in 2021 to 22,670 in 2022 (Harare Master Plan).

Behind the numbers is a network that keeps no record of itself. Passengers board and step off at random points, pay cash, and get no ticket. Kombis carry no passenger manifest, so no one holds a record of who is aboard any vehicle at any moment (Gemini assessment and primary research, section 4.1). That gap turns an ordinary crash into a search. When a minibus and a haulage truck collided head on near Chitungwiza in July 2025 and 17 people died at the scene, police could only appeal to families to come to the mortuary and identify the remains themselves (AP News and ZRP statement, July 2025). There was no list to check against, because the system never made one.

So the daily experience of a Harare commuter is not only the fare and the wait. It is boarding a vehicle that may not be registered, driven by someone the network cannot name, with no record that you were ever on it. About 13,500 of roughly 16,500 kombis in Harare are unregistered, with only about 2,950 officially licensed (ZRP crackdown figures, 2025). The trust deficit is rational. People ride because they have no alternative, not because the arrangement is safe.

## The user: the everyday rider, and the owner who wants a clean record

Svika is passenger first. The primary user is the commuter who needs to get across Harare and wants to know, before and during the ride, that the trip is predictable and that someone would know they were on it. The second user is the kombi owner who wants an honest record of what their vehicles earn and carry. The conductor sits between them, clearing fares and earning a fair share on digital ones.

The promise Svika makes to them is safety, trust and predictability. A rider plans a trip in Shona or English, boards with a short code that ties them to a specific vehicle and route, and can share a live trip with someone who would notice if it went wrong. The digital ticket is the manifest the network has never had. Digital ticketing, board codes and wallet credit are the mechanisms that produce the record and the trust; they are not the pitch.

## Strategic alignment: National AI Strategy, Pillar 3

Zimbabwe's National Artificial Intelligence Strategy 2026 to 2030, issued by the Ministry of ICT, Postal and Courier Services with POTRAZ, sets a national vision of "AI for Development" that elevates citizen dignity (National AI Strategy, page 17). Svika sits directly inside Pillar 3, AI adoption and service transformation, whose transport sub sector commits the country to "strengthen fleet management" and "improve public transport services" through intelligent systems (National AI Strategy, pages 24 to 25).

The fit runs wider than one pillar. The strategy names informal sector workers as a target for financial inclusion and mobile money (page 24); Svika's wallet and conductor commission bring the informal kombi trade a digital record and a payment rail. The strategy commits to natural language processing in local languages and to AI "free from imported biases" aligned with Ubuntu (pages 9 and 32); Svika is bilingual Shona and English from the first screen, with Ndebele next so Bulawayo and the Ndebele speaking south are included, and with Zimbabwean voice guidance for low literacy and blind riders. A purpose built Shona model, trained on the ZCHPC national compute, is on the roadmap to replace the current machine drafted strings with real modern nuance (`docs/SHONA-MODEL-PLAN.md`). The strategy prioritises computational sovereignty and in country data control (Pillar 2, page 22); every Svika model runs server side, deployable to the ZCHPC national compute, with no rider inference sent off device and no dependence on a foreign vendor in the ride path.

Beyond the rider, Svika's aggregated and consented movement data is a planning asset Harare has never had: because kombis thread the whole city, its main roads and its unmapped feeder routes alike, the network sees where people actually travel, where stops form and where a route or a lane is missing. In Nairobi, GPS data from the informal matatu network became the city's first complete transit map and entered Google Maps, a first for an informal system (Digital Matatus, MIT and the University of Nairobi); Svika can give Harare's municipalities the same, as anonymised aggregate insight under the consent and data protection rules in Section 4. That makes the city a second beneficiary and a partner, and it is a roadmap capability, not a feature we claim today.

Svika is not a general road safety programme, and it does not claim to be. It is a product that closes one specific, measurable gap: an informal network that carries half the city and keeps no record of who it carries. Closing that gap is where the safety, the trust and the national strategy meet.

---

*Statistics in this section are traced in `docs/proposal/TRACEABILITY.md`.*
