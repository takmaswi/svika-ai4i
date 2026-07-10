// Every rider-facing string lives here in English and Shona from the start. No
// hardcoded copy in components. Hwindi is the local word for conductor and is
// used deliberately. Keep entries short, second-person and concrete.
import type { AppLanguage } from "@svika/shared";

export const LANG_COOKIE = "svika_lang";

type Entry = { en: string; sn: string };

export const dict = {
  "brand.tagline": {
    en: "Ride Harare. Keep your change.",
    sn: "Famba muHarare. Chenji yako haichararasika.",
  },
  "nav.signIn": { en: "Sign in", sn: "Pinda" },

  "landing.headline": {
    en: "Digital tickets for Harare kombis.",
    sn: "Matikiti edijitari ekombi dzeHarare.",
  },
  "landing.sub": {
    en: "Plan a trip, board with a code, and stop losing your change.",
    sn: "Ronga rwendo, kwira nekodhi, urege kurasikirwa nechenji yako.",
  },
  "landing.cta": { en: "Get started", sn: "Tanga" },

  "login.title": { en: "Sign in to Svika", sn: "Pinda muSvika" },
  "login.phoneLabel": { en: "Phone number", sn: "Nhamba yefoni" },
  "login.send": { en: "Send code", sn: "Tumira kodhi" },
  "login.sending": { en: "Sending…", sn: "Kutumira…" },
  "login.codeLabel": {
    en: "Enter the 6-digit code",
    sn: "Isa kodhi yenhamba 6",
  },
  "login.verify": { en: "Verify", sn: "Simbisa" },
  "login.verifying": { en: "Verifying…", sn: "Kusimbisa…" },
  "login.resend": { en: "Send a new code", sn: "Tumira kodhi itsva" },
  "login.codeSentTo": { en: "We sent a code to", sn: "Tatumira kodhi ku" },
  "login.errPhone": {
    en: "Enter a valid phone number.",
    sn: "Isa nhamba yefoni chaiyo.",
  },
  "login.errCode": {
    en: "That code did not work. Try again.",
    sn: "Kodhi iyi haina kushanda. Edzazve.",
  },

  "app.welcome": { en: "Welcome", sn: "Mauya" },
  "app.roleLabel": { en: "Your role", sn: "Basa rako" },
  "app.phoneLabel": { en: "Phone", sn: "Foni" },
  "app.signOut": { en: "Sign out", sn: "Buda" },

  "role.rider": { en: "Rider", sn: "Mufambi" },
  "role.owner": { en: "Owner", sn: "Muridzi" },
  "role.conductor": { en: "Conductor", sn: "Hwindi" },

  "common.back": { en: "Back", sn: "Dzokera" },
  "common.minutes": { en: "min", sn: "min" },

  "rider.searchTitle": {
    en: "Where are you going?",
    sn: "Uri kuenda kupi?",
  },
  "rider.fromLabel": { en: "From", sn: "Kubva" },
  "rider.toLabel": { en: "To", sn: "Kuenda" },
  "rider.fromPlaceholder": {
    en: "e.g. Heights, UZ, Market Square",
    sn: "semuenzaniso: Heights, UZ, Market Square",
  },
  "rider.toPlaceholder": {
    en: "e.g. Avondale, Sam Levy's, town",
    sn: "semuenzaniso: Avondale, Sam Levy's, town",
  },
  "rider.planCta": { en: "Plan my trip", sn: "Ronga rwendo" },
  "rider.walletBalance": { en: "Wallet credit", sn: "Mari muchikwama" },
  "rider.tickets": { en: "Your tickets", sn: "Matikiti ako" },
  "rider.noTickets": {
    en: "No tickets yet. Plan a trip to get one.",
    sn: "Hausati une matikiti. Ronga rwendo kuti uwane.",
  },

  "plan.title": { en: "Your trip", sn: "Rwendo rwako" },
  "plan.sheetOpen": {
    en: "Show the legs of this trip",
    sn: "Ona zvikamu zverwendo",
  },
  "plan.ride": { en: "Ride", sn: "Kwira" },
  "plan.walk": { en: "Walk", sn: "Famba" },
  "plan.alightAt": { en: "Get off at", sn: "Buruka pa" },
  "plan.totalFare": { en: "Total fare", sn: "Mari yese" },
  "plan.about": { en: "About", sn: "Inenge" },
  "plan.boardings": { en: "kombis", sn: "makombi" },
  "plan.payWallet": { en: "Pay from wallet", sn: "Bhadhara nechikwama" },
  "plan.reserveCash": {
    en: "Reserve, pay cash on board",
    sn: "Chengetedza nzvimbo, ubhadhare cash mukombi",
  },
  "plan.pickFrom": {
    en: "Choose your starting stop",
    sn: "Sarudza chiteshi chaunokwira",
  },
  "plan.pickTo": {
    en: "Choose where you are going",
    sn: "Sarudza chiteshi chaunoburuka",
  },
  "plan.noMatch": {
    en: "We do not know that place yet. Pick a stop from the list.",
    sn: "Hatisati tichiziva nzvimbo iyoyo. Sarudza chiteshi pane zviripo.",
  },
  "plan.noRoute": {
    en: "No route found between those stops yet.",
    sn: "Hapasati pane nzira pakati pezviteshi izvozvo.",
  },
  "plan.insufficient": {
    en: "Not enough wallet credit. Reserve and pay cash on board.",
    sn: "Mari muchikwama haikwane. Chengetedza nzvimbo ubhadhare cash mukombi.",
  },

  "ticket.title": { en: "Board code", sn: "Kodhi yekukwira" },
  "ticket.showHwindi": {
    en: "Show this code to the hwindi when you board.",
    sn: "Ratidza hwindi kodhi iyi paunokwira.",
  },
  "ticket.fare": { en: "Fare", sn: "Mari" },
  "ticket.payment": { en: "Payment", sn: "Kubhadhara" },
  "ticket.route": { en: "Route", sn: "Nzira" },
  "ticket.validUntil": { en: "Valid until", sn: "Inoshanda kusvika" },
  "ticket.payCash": { en: "Pay cash on board", sn: "Bhadhara cash mukombi" },
  "ticket.paidWallet": { en: "Paid from wallet", sn: "Yabhadharwa nechikwama" },
  "ticket.status.issued": { en: "Ready to board", sn: "Yakamirira kukwira" },
  "ticket.status.redeemed": { en: "Cleared", sn: "Yabhadharwa" },
  "ticket.status.cancelled": { en: "Cancelled", sn: "Yakanzurwa" },
  "ticket.status.expired": { en: "Expired", sn: "Yapera" },
  "ticket.status.refunded": { en: "Refunded", sn: "Yadzorerwa" },
  "ticket.legOf": { en: "Leg", sn: "Chikamu" },
  "ticket.status.loaded": { en: "On the kombi", sn: "Wakwira kombi" },
  "ticket.status.collected": { en: "Collected", sn: "Watorwa" },

  "wallet.title": { en: "Your wallet", sn: "Chikwama chako" },
  "wallet.changeTitle": {
    en: "Change kept as credit",
    sn: "Chenji yakachengetwa semari",
  },
  "wallet.changeTotal": { en: "Kept so far", sn: "Yakachengetwa kusvika zvino" },
  "wallet.changeBody": {
    en: "When you pay cash and the hwindi cannot give change, the difference lands here as credit instead of leaving with the kombi.",
    sn: "Paunobhadhara cash uye hwindi asina chenji, mari inosara inopinda muno semari yako pane kuenda nekombi.",
  },
  "wallet.changeNone": {
    en: "No change credited yet. The first time a hwindi owes you change, it lands here.",
    sn: "Hapasati pane chenji yapinda. Kekutanga hwindi akakuomerwa nechenji, inopinda muno.",
  },
  "wallet.open": { en: "Wallet", sn: "Chikwama" },
  "wallet.history": { en: "Recent activity", sn: "Zvichangobva kuitika" },
  "wallet.sendTitle": { en: "Send credit", sn: "Tumira mari" },
  "wallet.sendAmount": { en: "Amount", sn: "Mari" },
  "wallet.sendCta": { en: "Send", sn: "Tumira" },
  "wallet.sendHint": {
    en: "You get a claim code to share. Unclaimed credit comes back when you cancel.",
    sn: "Unopiwa kodhi yekupa mumwe. Mari isina kutorwa inodzoka kana ukakanzura.",
  },
  "wallet.claimTitle": { en: "Claim credit", sn: "Tora mari" },
  "wallet.claimLabel": { en: "Claim code", sn: "Kodhi yekutora" },
  "wallet.claimCta": { en: "Claim", sn: "Tora" },
  "wallet.claimed": { en: "Credit claimed", sn: "Mari yapinda" },
  "wallet.claimInvalid": {
    en: "That code did not work.",
    sn: "Kodhi iyi haina kushanda.",
  },
  "wallet.claimAlready": {
    en: "That code was already claimed.",
    sn: "Kodhi iyi yakatotorwa.",
  },
  "wallet.claimRateLimited": {
    en: "Too many tries. Wait 10 minutes.",
    sn: "Wakaedza kakawanda. Mira maminitsi gumi.",
  },
  "wallet.sent": { en: "Share this code", sn: "Ipa mumwe kodhi iyi" },
  "wallet.pending": { en: "Waiting to be claimed", sn: "Yakamirira kutorwa" },
  "wallet.cancel": { en: "Cancel and take it back", sn: "Kanzura udzorerwe" },
  "wallet.sendErr": {
    en: "Could not send. Check your balance.",
    sn: "Hatina kukwanisa kutumira. Tarisa mari yako.",
  },
  "wallet.txn.topup": { en: "Top up", sn: "Kuisa mari" },
  "wallet.txn.ticket_purchase": { en: "Ticket", sn: "Tikiti" },
  "wallet.txn.fare_settlement": { en: "Fare settled", sn: "Mari yerwendo" },
  "wallet.txn.change_credit": { en: "Change to credit", sn: "Chenji" },
  "wallet.txn.transfer_send": { en: "Credit sent", sn: "Mari yatumirwa" },
  "wallet.txn.transfer_claim": { en: "Credit claimed", sn: "Mari yatorwa" },
  "wallet.txn.transfer_cancel": {
    en: "Transfer cancelled",
    sn: "Kutumira kwakanzurwa",
  },
  "wallet.txn.refund": { en: "Refund", sn: "Kudzorerwa" },
  "wallet.txn.adjustment": { en: "Adjustment", sn: "Kugadzirisa" },

  "parcel.title": { en: "Send a parcel", sn: "Tumira katundu" },
  "parcel.open": { en: "Parcels", sn: "Katundu" },
  "parcel.route": { en: "Route", sn: "Nzira" },
  "parcel.from": { en: "Load at", sn: "Kukwidza pa" },
  "parcel.to": { en: "Collect at", sn: "Kutora pa" },
  "parcel.payWallet": { en: "Pay from wallet", sn: "Bhadhara nechikwama" },
  "parcel.payCash": { en: "Pay cash at loading", sn: "Bhadhara cash pakukwidza" },
  "parcel.loadCode": { en: "LOAD code", sn: "Kodhi yekukwidza" },
  "parcel.collectCode": { en: "COLLECT code", sn: "Kodhi yekutora" },
  "parcel.loadHint": {
    en: "Give the LOAD code with the parcel. Send the COLLECT code to the receiver.",
    sn: "Ipa hwindi kodhi yekukwidza pamwe nekatundu. Tumira kodhi yekutora kune anogamuchira.",
  },
  "parcel.yours": { en: "Your parcels", sn: "Katundu kako" },
  "parcel.none": { en: "No parcels yet.", sn: "Hausati une katundu." },
  "parcel.err": {
    en: "Could not book the parcel.",
    sn: "Katundu hakana kubhukwa.",
  },
  "parcel.errBalance": {
    en: "Not enough wallet credit. Pay cash at loading instead.",
    sn: "Mari muchikwama haikwane. Bhadhara cash pakukwidza.",
  },

  "owner.title": { en: "Revenue", sn: "Mari yakapinda" },
  "owner.open": { en: "Owner view", sn: "Muridzi" },
  "owner.balance": { en: "Wallet balance", sn: "Mari muchikwama" },
  "owner.day": { en: "Day", sn: "Zuva" },
  "owner.route": { en: "Route", sn: "Nzira" },
  "owner.tickets": { en: "Fares", sn: "Vafambi" },
  "owner.gross": { en: "Gross", sn: "Yese" },
  "owner.commission": { en: "Hwindi", sn: "Hwindi" },
  "owner.net": { en: "Yours", sn: "Yako" },
  "owner.none": {
    en: "No settled digital fares yet.",
    sn: "Hapasati pane mari yedijitari yakapinda.",
  },
  "owner.note": {
    en: "Every figure comes straight from the ledger. Cash fares stay with the crew and are not counted here.",
    sn: "Nhamba dzese dzinobva mubhuku remari. Cash inosara nevashandi haiverengwi pano.",
  },
  "owner.watchdog": { en: "Revenue watchdog", sn: "Murindi wemari" },
  "owner.watchdogSimulated": {
    en: "Simulated history",
    sn: "Nhoroondo yakagadzirwa",
  },
  "owner.watchdogSummary": {
    en: "{count} simulated days scanned, {flagged} flagged",
    sn: "Mazuva {count} akaongororwa, {flagged} akadomwa",
  },
  "owner.watchdogNone": {
    en: "No unusual days in the scanned history.",
    sn: "Hapana zuva risina kujairika pane akaongororwa.",
  },
  "owner.watchdogEmpty": {
    en: "No simulated history loaded yet.",
    sn: "Hapasati pane nhoroondo yakagadzirwa.",
  },
  "owner.watchdogNote": {
    en: "Flags describe patterns, never a person. This card runs on clearly labelled simulated history until the network has months of real fares.",
    sn: "Zviratidzo zvinotaura maitiro, kwete munhu. Kadhi iri rinoshanda nenhoroondo yakagadzirwa kusvika network yava nemwedzi yemari chaiyo.",
  },
  "owner.netToDate": { en: "Net to date", sn: "Yako yese" },
  "owner.chartTitle": {
    en: "Digital fares, last 14 days",
    sn: "Mari yedijitari, mazuva 14 apfuura",
  },
  "owner.chartNet": { en: "Net in this window", sn: "Yako mumazuva aya" },
  "owner.routesTitle": { en: "By route", sn: "Nenzira" },
  "owner.fares": { en: "fares", sn: "vafambi" },
  "owner.taxTitle": {
    en: "ZIMRA presumptive tax",
    sn: "Mutero weZIMRA",
  },
  "owner.taxBody": {
    en: "Kombis pay a flat monthly presumptive tax of $50 to $60, collected with the ZINARA licence. It is a fixed amount, not a share of takings.",
    sn: "Makombi anobhadhara mutero wakatarwa we$50 kusvika $60 pamwedzi, unotorwa nerezinesi reZINARA. Imari yakatarwa, kwete chikamu chemari inopinda.",
  },
  "owner.taxHint": {
    en: "Your statement is the digital record of what each kombi actually earned, ready for the conversation ZIMRA actually has.",
    sn: "Statement yako ndiyo chinyorwa chedijitari chemari yakapinda pakombi imwe neimwe.",
  },
  "owner.statementOpen": {
    en: "Print a statement",
    sn: "Dhinda statement",
  },

  "statement.title": { en: "Revenue statement", sn: "Statement yemari" },
  "statement.period": { en: "Period", sn: "Nguva" },
  "statement.generated": { en: "Generated", sn: "Yagadzirwa" },
  "statement.owner": { en: "Owner", sn: "Muridzi" },
  "statement.print": { en: "Print", sn: "Dhinda" },
  "statement.totals": { en: "Totals", sn: "Zvese" },
  "statement.note": {
    en: "Every figure derives from Svika's append only ledger of settled digital fares. Cash fares stay with the crew and are not counted. Presumptive tax for kombis is a flat $50 to $60 a month collected with the ZINARA licence; this statement is the earnings record beside it.",
    sn: "Nhamba dzese dzinobva mubhuku remari reSvika risingagadziridzwe. Cash inosara nevashandi haiverengwi. Mutero wemakombi imari yakatarwa ye$50 kusvika $60 pamwedzi inotorwa nerezinesi reZINARA; statement iyi ndiyo chinyorwa chemari yakapinda parutivi pawo.",
  },

  "home.sheetHint": {
    en: "Type in Shona or English.",
    sn: "Nyora muchiShona kana chiRungu.",
  },
  "home.sheetOpen": {
    en: "Show wallet and tickets",
    sn: "Ona chikwama nematikiti",
  },
  "home.sheetClose": {
    en: "Show more of the map",
    sn: "Ona mepu yakakura",
  },

  "home.yourTrips": { en: "Your trips", sn: "Nzendo dzako" },
  "home.etaDemo": {
    en: "demo estimate",
    sn: "fungidziro yekuratidzira",
  },
  "home.etaFromRide": {
    en: "from 1 recorded ride",
    sn: "kubva parwendo 1 rwakarekodhwa",
  },
  "home.etaFromRides": {
    en: "from {count} recorded rides",
    sn: "kubva panzendo {count} dzakarekodhwa",
  },

  "plan.saveTitle": {
    en: "Save this trip for your home map",
    sn: "Chengetedza rwendo urwu pamepu yako",
  },
  "plan.savePlaceholder": {
    en: "e.g. Work trip",
    sn: "semuenzaniso: Rwendo rwebasa",
  },
  "plan.saveCta": { en: "Save", sn: "Chengetedza" },
  "plan.savedNote": {
    en: "Saved. It now lives on your home map.",
    sn: "Zvachengetedzwa. Rwava pamepu yako yekutanga.",
  },
  "plan.saveErr": {
    en: "That name did not save. Try a shorter one.",
    sn: "Zita iri harina kuchengetedzwa. Edza rakapfupika.",
  },

  "theme.toDark": {
    en: "Switch to night mode",
    sn: "Shandura kuita chiedza cheusiku",
  },
  "theme.toLight": {
    en: "Switch to day mode",
    sn: "Shandura kuita chiedza chemasikati",
  },

  "map.ariaLabel": {
    en: "Map of the Heights to Rezende corridor with kombis moving along the road. Vehicle movement is a demo, not live tracking.",
    sn: "Mepu yenzira yeHeights kusvika Rezende ine makombi ari kufamba mumugwagwa. Kufamba kwemakombi ndekwekuratidzira, hakusi live.",
  },
  "map.demoChip": { en: "Demo movement", sn: "Kuratidzira" },
  "map.unavailable": {
    en: "The map could not load. Your trips and wallet still work.",
    sn: "Mepu haina kukwanisa kuvhurika. Nzendo dzako nechikwama zvichiri kushanda.",
  },

  // consent and privacy. Shona here is machine drafted and waits for the
  // external translator pass, like every other Shona string in this file.
  "consent.title": { en: "Before you ride", sn: "Usati wafamba" },
  "consent.intro": {
    en: "Svika keeps a record of your trips, tickets and wallet credit so your change never gets lost. Here is what that means.",
    sn: "Svika inochengeta nzendo dzako, matikiti nemari yechikwama kuti chenji yako irege kurasika. Hezvino zvazvinoreva.",
  },
  "consent.point1": {
    en: "Your name, phone number and language choice are stored with your account.",
    sn: "Zita rako, nhamba yefoni nemutauro waunosarudza zvinochengetwa neakaunti yako.",
  },
  "consent.point2": {
    en: "Every ticket and wallet movement is kept. Money history is never edited or deleted.",
    sn: "Tikiti rimwe nerimwe nekufamba kwemari zvinochengetwa. Nhoroondo yemari haigadziridzwe kana kudzimwa.",
  },
  "consent.point3": {
    en: "Trip patterns improve arrival predictions. Owners see route totals, never your name.",
    sn: "Mafambiro enzendo anovandudza fungidziro dzekusvika. Varidzi vanoona huwandu hwenzira, kwete zita rako.",
  },
  "consent.point4": {
    en: "You can see everything Svika holds about you and delete your details at any time.",
    sn: "Unogona kuona zvese zvakachengetwa neSvika nezvako uye kudzima ruzivo rwako chero nguva.",
  },
  "consent.noticeLink": {
    en: "Read the full privacy notice",
    sn: "Verenga chiziviso chekuvanzika chizere",
  },
  "consent.accept": { en: "I understand and agree", sn: "Ndanzwisisa uye ndinobvuma" },
  "consent.declineHint": {
    en: "If you do not agree, sign out. Nothing beyond your sign in is stored.",
    sn: "Kana usingabvume, buda. Hapana chinochengetwa kunze kwekupinda kwako.",
  },
  "consent.err": {
    en: "That did not save. Try again.",
    sn: "Hazvina kuchengetedzwa. Edzazve.",
  },

  "privacy.title": { en: "How Svika treats your data", sn: "Svika inobata sei ruzivo rwako" },
  "privacy.collectH": { en: "What Svika stores", sn: "Zvinochengetwa neSvika" },
  "privacy.collectB": {
    en: "Your name, phone number, language, tickets, wallet credit and the trips you save. Nothing else.",
    sn: "Zita rako, nhamba yefoni, mutauro, matikiti, mari yechikwama nenzendo dzaunochengeta. Hapana zvimwe.",
  },
  "privacy.whyH": { en: "Why", sn: "Sei" },
  "privacy.whyB": {
    en: "Tickets and credit are money, so they need a full record. Trip patterns make arrival predictions better for everyone.",
    sn: "Matikiti nemari zvinoda nhoroondo izere. Mafambiro enzendo anonatsiridza fungidziro dzekusvika kune wese.",
  },
  "privacy.moneyH": { en: "The money rule", sn: "Mutemo wemari" },
  "privacy.moneyB": {
    en: "The wallet is an append only ledger. Entries are added, never edited, never deleted. That is how your change stays safe.",
    sn: "Chikwama ibhuku remari rinongowedzerwa. Zvinyorwa zvinowedzerwa, hazvigadziridzwe, hazvidzimwe. Ndiko kuchengetedzwa kwechenji yako.",
  },
  "privacy.aiH": { en: "What the AI sees", sn: "Zvinoonekwa neAI" },
  "privacy.aiB": {
    en: "Predictions and leakage checks run on our servers over patterns and totals. They never name a person and nothing runs on your phone.",
    sn: "Fungidziro nekuongorora mari zvinoshanda pamaseva edu zvichishandisa mafambiro nehuwandu. Hazvidome munhu uye hapana chinoshanda pafoni yako.",
  },
  "privacy.shareH": { en: "Who sees your data", sn: "Ndiani anoona ruzivo rwako" },
  "privacy.shareB": {
    en: "Nobody outside Svika. No selling, no adverts. Owners see route totals, conductors see board codes, neither sees who you are.",
    sn: "Hapana ari kunze kweSvika. Hakuna kutengeswa, hakuna zvishambadzo. Varidzi vanoona huwandu hwenzira, mahwindi anoona makodhi, hapana anoona kuti ndiwe ani.",
  },
  "privacy.controlH": { en: "Your controls", sn: "Masimba ako" },
  "privacy.controlB": {
    en: "The your data page shows everything held about you. Deleting removes your name, phone and saved trips; ticket and money history stays but no longer says who you are.",
    sn: "Peji reruzivo rwako rinoratidza zvese zvakachengetwa nezvako. Kudzima kunobvisa zita, foni nenzendo dzakachengetwa; nhoroondo yematikiti nemari inosara asi haichataure kuti ndiwe ani.",
  },
  "privacy.versionLabel": { en: "Notice version", sn: "Vhezheni yechiziviso" },
  "privacy.yourDataLink": { en: "Your data and privacy", sn: "Ruzivo rwako nekuvanzika" },

  "lang.english": { en: "English", sn: "Chirungu" },
  "lang.shona": { en: "Shona", sn: "ChiShona" },

  "yourdata.title": { en: "What Svika knows about you", sn: "Zvinozivikanwa neSvika nezvako" },
  "yourdata.profileH": { en: "Your profile", sn: "Ruzivo rwako" },
  "yourdata.name": { en: "Name", sn: "Zita" },
  "yourdata.language": { en: "Language", sn: "Mutauro" },
  "yourdata.none": { en: "Not set", sn: "Hapana" },
  "yourdata.countsH": { en: "Your history", sn: "Nhoroondo yako" },
  "yourdata.tickets": { en: "Tickets", sn: "Matikiti" },
  "yourdata.movements": { en: "Wallet movements", sn: "Kufamba kwemari" },
  "yourdata.savedTrips": { en: "Saved trips", sn: "Nzendo dzakachengetwa" },
  "yourdata.consents": { en: "Consent records", sn: "Zvinyorwa zvemvumo" },
  "yourdata.deleteH": { en: "Delete your details", sn: "Dzima ruzivo rwako" },
  "yourdata.deleteB": {
    en: "Money and ticket history is append only, so it cannot be erased. Deleting removes your name and phone, deletes your saved trips, and closes the app until you agree again. Your sign in stays until an operator removes it.",
    sn: "Nhoroondo yemari nematikiti inongowedzerwa, saka haigone kudzimwa. Kudzima kunobvisa zita nefoni yako, kunodzima nzendo dzakachengetwa, uye kunovhara app kusvika wabvumazve. Kupinda kwako kunosara kusvika mushandi akubvisa.",
  },
  "yourdata.deleteCta": { en: "Delete my details", sn: "Dzima ruzivo rwangu" },
  "yourdata.deleteConfirm": { en: "Yes, delete my details", sn: "Hongu, dzima ruzivo rwangu" },
  "yourdata.deleteCancel": { en: "Keep them", sn: "Zvichengete" },
  "yourdata.err": {
    en: "That did not work. Try again.",
    sn: "Hazvina kushanda. Edzazve.",
  },
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: AppLanguage, key: DictKey): string {
  return dict[key][lang];
}
