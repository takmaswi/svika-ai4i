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

  "landing.headline1": { en: "Beyond the", sn: "Kupfuura" },
  "landing.headlineWord": { en: "Kombi", sn: "Kombi" },
  "landing.body": {
    en: "Plan every trip, get smart suggestions before you leave, and ride with your safety looked after.",
    sn: "Ronga rwendo rwega rwega, uwane mazano usati wasimuka, uye ufambe takachengetedza kuchengeteka kwako.",
  },
  "landing.cta": { en: "Find your kombi", sn: "Tsvaga kombi yako" },
  "landing.statChange": { en: "Change kept", sn: "Chenji yakachengetwa" },
  "landing.statWeek": { en: "this week", sn: "svondo rino" },
  "landing.signinHint": {
    en: "Hwindi or fleet owner?",
    sn: "Uri hwindi kana muridzi?",
  },
  "landing.signinLink": { en: "Sign in here", sn: "Pinda pano" },
  "landing.demoLead": {
    en: "Walk straight in as Tariro, a demo rider on the live system. No sign up.",
    sn: "Pinda pakarepo saTariro, mufambi wekuratidzira pane system chaiyo. Hapana kunyoresa.",
  },
  "landing.demoEnter": { en: "Enter the demo", sn: "Pinda mudemo" },
  "landing.demoOwner": { en: "Owner dashboard", sn: "Dashboard yemuridzi" },
  "landing.shelfReal": {
    en: "Real stories, real money on the live system",
    sn: "Nyaya chaidzo, mari chaiyo pasisitimu mhenyu",
  },
  "landing.shelfIntel": {
    en: "The intelligence, three spines with their evidence",
    sn: "Njere dzacho, misana mitatu neuchapupu hwayo",
  },
  "landing.intelEta": {
    en: "How Svika knows your arrival",
    sn: "Svika inoziva sei kusvika kwako",
  },
  "landing.intelTakunda": {
    en: "Takunda's alert, the learned routine",
    sn: "Yeuchidzo yaTakunda, tsika yakadzidzwa",
  },
  "landing.intelWatchdog": {
    en: "The watchdog catches a leak",
    sn: "Murindi anobata kuvhaya",
  },
  "landing.shelfVision": {
    en: "Vision scenes, simulations of what ships next",
    sn: "Zviratidzo zveramangwana, kufananidzira kwezvinotevera",
  },
  "landing.visionTinashe": { en: "The crash flow, Tinashe", sn: "Tsaona, Tinashe" },
  "landing.visionGogo": { en: "Gogo's mbudzi", sn: "Mbudzi yaGogo" },
  "landing.visionCapacity": { en: "Kombi capacity", sn: "Kuzara kwekombi" },
  "landing.demoStory1": {
    en: "Change becomes credit",
    sn: "Chenji inova mari",
  },
  "landing.demoStory2": {
    en: "Two kombis and a walk",
    sn: "Makombi maviri nekufamba",
  },
  "landing.demoStory4": {
    en: "Rudo's night ride",
    sn: "Rwendo rwehusiku rwaRudo",
  },
  "landing.demoErr": {
    en: "The demo door is busy. Try again in a minute.",
    sn: "Mukova wedemo wakabatikana. Edzazve munguva pfupi.",
  },

  "demo.chip": { en: "Demo account", sn: "Akaunti yekuratidzira" },

  "story.next": { en: "Next", sn: "Enderera" },
  "story.back": { en: "Back a step", sn: "Dzokera danho" },
  "story.stay": { en: "Stay and explore", sn: "Gara uzvionere" },
  "story.shelf": { en: "Back to the stories", sn: "Dzokera kunyaya" },
  "story.live": {
    en: "Now try it yourself. Everything on this screen is live.",
    sn: "Zviedze wega manje. Zvese zviri pano zvinoshanda.",
  },
  "story.liveVision": {
    en: "Now try it yourself. This scene is a simulation and touches no real account.",
    sn: "Zviedze wega manje. Ichi chiratidzo chekufananidzira, hachibate akaunti chaiyo.",
  },
  "story.exit": { en: "Exit story", sn: "Buda munyaya" },
  "story.err": {
    en: "That step could not run. Try next again, or exit the story.",
    sn: "Danho iri harina kushanda. Edzazve, kana kubuda munyaya.",
  },
  "story.town.0": {
    en: "Meet Tariro. She rides this corridor into town most mornings. Watch one normal trip.",
    sn: "Uyu ndiTariro. Anokwira nzira iyi achienda kutown mangwanani mazhinji. Ona rwendo rumwe chete.",
  },
  "story.town.1": {
    en: "She types where she is going. The planner quotes the real corridor fare: $1.50, one kombi.",
    sn: "Anonyora kwaari kuenda. Planner inomupa mutengo chaiwo: $1.50, kombi imwe.",
  },
  "story.town.2": {
    en: "She reserves her seat now and will pay cash on board. Next books it through the real engine.",
    sn: "Anochengetedza nzvimbo yake, obhadhara cash mukombi. Enderera inobhuka nesystem chaiyo.",
  },
  "story.town.3": {
    en: "Her boarding card is ready. On the kombi she shows the 4 digit code and hands over a $2 note.",
    sn: "Kadhi rake rekukwira ragadzirira. Mukombi anoratidza kodhi ye4 obva apa $2.",
  },
  "story.town.4": {
    en: "The hwindi clears her code and keys in the $2 note. The hwindi here is simulated; the money moves through the real ledger.",
    sn: "Hwindi anobvisa kodhi yake onyora $2. Hwindi pano ndeyekuratidzira; mari inofamba nebhuku remari chairo.",
  },
  "story.town.5": {
    en: "Her 50 cents of change is wallet credit now, not a promise on a moving kombi. Story over.",
    sn: "Chenji yake yemasendi 50 yava mari muchikwama, kwete vimbiso mukombi inofamba. Nyaya yapera.",
  },
  "story.transfer.0": {
    en: "Not every trip is one kombi. Heights to Avondale takes two, with a short walk between them.",
    sn: "Haisi nzendo dzese dzine kombi imwe. Heights kusvika Avondale inoda mbiri, nekufamba kupfupi pakati.",
  },
  "story.transfer.1": {
    en: "The walking leg is drawn dashed on the real map, and one quote covers both kombis: $3.00.",
    sn: "Chikamu chekufamba chakadhirowewa nemadota pamepu chaiyo, uye mutengo mumwe unobata makombi ese: $3.00.",
  },
  "story.transfer.2": {
    en: "One tap bought both legs from her wallet. Two boarding codes, one per kombi. Story over.",
    sn: "Kubaya kamwe kwatenga zvikamu zvese kubva muchikwama. Makodhi maviri, imwe pakombi imwe neimwe. Nyaya yapera.",
  },

  "story.tk.0": {
    en: "Meet Takunda. He rides this corridor to work every morning, and his alert is live: the usual kombi is close, with today's real minutes from the live feed. A fixed alarm cannot know that.",
    sn: "Uyu ndiTakunda. Anokwira nzira iyi kubasa mangwanani ega ega, uye yeuchidzo yake iri kushanda: kombi yaanogara achikwira yaswedera, nemaminitsi echokwadi anhasi. Alarm yakagadzikwa haigone kuzviziva.",
  },
  "story.tk.1": {
    en: "His trip lives as a quick pick. Next books it from his wallet through the real engine.",
    sn: "Rwendo rwake rwakachengetwa. Enderera inorubhuka kubva muchikwama chake nesystem chaiyo.",
  },
  "story.tk.2": {
    en: "His boarding card is ready. The hwindi here is simulated; the clearing and the money move through the real ledger.",
    sn: "Kadhi rake rekukwira ragadzirira. Hwindi pano ndeyekuratidzira; kubvisa nemari zvinofamba nebhuku remari chairo.",
  },
  "story.tk.3": {
    en: "He is on board. Watch: the voice speaks as his stop nears. The last stretch of the ride is fast forwarded; the triggers are the real engine.",
    sn: "Ava mukombi. Tarisa: inzwi rinotaura chiteshi chake chava pedyo. Chikamu chekupedzisira cherwendo chakakurumidziswa; zvinomutsa inzwi ndezvechokwadi.",
  },

  "story.ru.0": {
    en: "It is late and Rudo's wallet was stolen in town. Her Svika balance reads zero. Watch what her people can do about it.",
    sn: "Kwadoka uye chikwama chaRudo chakabiwa mutown. Mari yake muSvika iri pazero. Ona zvinogona kuitwa nevanhu vake.",
  },
  "story.ru.1": {
    en: "A friend sends her credit from their own wallet. The friend is simulated; the escrow is the real ledger.",
    sn: "Shamwari inomutumira mari kubva muchikwama chayo. Shamwari ndeyekuratidzira; mari inochengetwa mubhuku remari chairo.",
  },
  "story.ru.2": {
    en: "A claim code reaches her phone (simulated SMS). Next types it in for her.",
    sn: "Kodhi yekutora inosvika pafoni yake (SMS yekuratidzira). Enderera inoinyora.",
  },
  "story.ru.3": {
    en: "The credit landed in her wallet. She books the kombi home with it.",
    sn: "Mari yapinda muchikwama chake. Anobhuka kombi yekuenda kumba nayo.",
  },
  "story.ru.4": {
    en: "Her boarding card is ready and the simulated hwindi clears her code. She is on her way.",
    sn: "Kadhi rake ragadzirira uye hwindi yekuratidzira yabvisa kodhi yake. Ava munzira.",
  },
  "story.ru.5": {
    en: "Her mother worries. Next creates a live share link, straight from her ticket.",
    sn: "Amai vake vanofunganya. Enderera inogadzira link yekuona rwendo, kubva patikiti rake.",
  },
  "story.ru.6": {
    en: "This is exactly what her mother sees, no account needed: the trip, the arrival estimate, never the code or the wallet. The link dies when the trip ends.",
    sn: "Izvi ndizvo chaizvo zvinoonekwa naamai vake, pasina akaunti: rwendo, fungidziro yekusvika, kwete kodhi kana chikwama. Link inofa kana rwendo rwapera.",
  },

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
  "common.to": { en: "to", sn: "kusvika" },

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
  "ticket.screenTitle": { en: "Your ticket", sn: "Tikiti rako" },
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
  "wallet.balanceLabel": { en: "Balance", sn: "Mari iripo" },
  "wallet.changeChip": { en: "Change kept", sn: "Chenji yakachengetwa" },
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
  "owner.wdForest": {
    en: "Forest flagged this day",
    sn: "Sango rakadoma zuva iri",
  },
  "owner.wdThresholdSilent": {
    en: "the fixed threshold rule stayed silent",
    sn: "mutemo wakagadzikwa wakaramba wakanyarara",
  },
  "owner.wdThresholdFired": {
    en: "the fixed threshold rule also fired",
    sn: "mutemo wakagadzikwa wakadomawo",
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

  "home.peekArrives": { en: "Arrives", sn: "Inosvika" },
  "home.peekFrom": { en: "from", sn: "kubva pa" },

  "nav.home": { en: "Home", sn: "Kumba" },
  "nav.rides": { en: "Rides", sn: "Nzendo" },
  "nav.wallet": { en: "Wallet", sn: "Chikwama" },
  "nav.you": { en: "You", sn: "Iwe" },

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

  "eta.cardAria": {
    en: "Where this number comes from",
    sn: "Kunobva nhamba iyi",
  },
  "eta.cardTitle": {
    en: "Where this number comes from",
    sn: "Kunobva nhamba iyi",
  },
  "eta.cardMeasured": {
    en: "It is measured from {count} real rides we recorded on this road, phone in hand.",
    sn: "Yakayerwa kubva panzendo {count} chaidzo dzatakarekodha munzira ino, nefoni muruoko.",
  },
  "eta.cardModel": {
    en: "A trained model waits behind a promotion rule. It serves only when committed numbers prove it beats this measured average on held out rides.",
    sn: "Modhi yakadzidziswa yakamirira mutemo wekukwidziridzwa. Inoshanda chete kana nhamba dzakachengetwa dzichiratidza kuti inokunda avhareji iyi.",
  },
  "eta.cardImprove": {
    en: "Every new recorded ride sharpens it.",
    sn: "Rwendo rwega rwega rutsva rwakarekodhwa runoinatsa.",
  },
  "eta.cardDemo": {
    en: "This is a demo estimate from the offline twin, not a measurement.",
    sn: "Iyi ifungidziro yekuratidzira kubva kumbeu yekumira, kwete chiyero.",
  },
  "eta.cardDemoWhen": {
    en: "It serves when the arrival engine is unreachable or the trip is off the recorded corridor.",
    sn: "Inoshanda kana injini yekusvika isingawanikwe kana rwendo rusiri munzira yakarekodhwa.",
  },
  "eta.cardClose": { en: "Close", sn: "Vhara" },
  "eta.cardMore": {
    en: "See how Svika knows",
    sn: "Ona kuti Svika inoziva sei",
  },

  "intel.title": {
    en: "How Svika knows your arrival",
    sn: "Svika inoziva sei kusvika kwako",
  },
  "intel.intro": {
    en: "No kombi runs on a timetable. The number on your screen stands on a ladder you can check, rung by rung.",
    sn: "Hapana kombi inofamba netimetable. Nhamba iri pascreen yako yakamira padanho raunogona kuongorora.",
  },
  "intel.rung1H": {
    en: "Measured, serving today",
    sn: "Yakayerwa, iri kushanda nhasi",
  },
  "intel.rung1B": {
    en: "The number you see is a plain average over segment times from {count} real rides recorded on this road, phone in hand. Its label on every screen says so.",
    sn: "Nhamba yaunoona iavhareji yenguva dzezvikamu kubva panzendo {count} chaidzo dzakarekodhwa munzira ino. Chiratidzo chayo pascreen yega yega chinozvitaura.",
  },
  "intel.rung2H": { en: "Trained, waiting", sn: "Yakadzidziswa, yakamirira" },
  "intel.rung2B": {
    en: "A model that learns how each hour of the day moves is trained on the same rides. It does not serve yet.",
    sn: "Modhi inodzidza mafambiro eawa rega rega yakadzidziswa nenzendo dzimwe chetedzo. Haisati yashanda.",
  },
  "intel.rung3H": { en: "One rule decides", sn: "Mutemo mumwe ndiwo unosarudza" },
  "intel.rung3B": {
    en: "The model serves only when there are at least {min} recorded journeys and it beats the average on rides it never saw. The verdict lives in a committed file; nothing else decides.",
    sn: "Modhi inoshanda chete kana pane nzendo {min} kana kupfuura dzakarekodhwa uye ichikunda avhareji panzendo yaisati yamboona. Mutongo unogara mufaira yakachengetwa; hapana chimwe chinosarudza.",
  },
  "intel.tableH": { en: "The committed evidence", sn: "Uchapupu hwakachengetwa" },
  "intel.rowJourneys": { en: "Recorded journeys", sn: "Nzendo dzakarekodhwa" },
  "intel.rowSegments": { en: "Segment observations", sn: "Zvikamu zvakaonekwa" },
  "intel.rowBaseline": {
    en: "Baseline error, held out",
    sn: "Kukanganisa kweavhareji",
  },
  "intel.rowModel": { en: "Model error, held out", sn: "Kukanganisa kwemodhi" },
  "intel.rowServed": { en: "Serving now", sn: "Iri kushanda" },
  "intel.verdictPromoted": {
    en: "The model beat the baseline on held out rides, so it serves.",
    sn: "Modhi yakakunda avhareji panzendo dzayaisati yaona, saka iri kushanda.",
  },
  "intel.verdictHeld": {
    en: "Verdict: not enough rides to trust any evaluation (the rule asks for {min}), so the plain average serves and every estimate says how many rides it stands on.",
    sn: "Mutongo: nzendo hadzisati dzakwana kuvimba nechiyero (mutemo unoda {min}), saka avhareji ndiyo inoshanda uye fungidziro yega yega inotaura nzendo dzainomira padziri.",
  },
  "intel.note": {
    en: "This table is the training run's own committed file, not retyped numbers. It updates when new rides are recorded.",
    sn: "Tafura iyi ifaira rakachengetwa rekudzidziswa pachako, kwete nhamba dzakanyorwazve. Inovandudzwa kana nzendo itsva dzarekodhwa.",
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
  "map.viewWhole": { en: "Whole route", sn: "Nzira yose" },
  "map.viewNear": { en: "Boarding area", sn: "Panokwirwa" },
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

  "privacy.title": {
    en: "How Svika treats your data",
    sn: "Svika inobata sei ruzivo rwako",
  },
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
  "privacy.yourDataLink": {
    en: "Your data and privacy",
    sn: "Ruzivo rwako nekuvanzika",
  },

  "lang.english": { en: "English", sn: "Chirungu" },
  "lang.shona": { en: "Shona", sn: "ChiShona" },

  "yourdata.title": {
    en: "What Svika knows about you",
    sn: "Zvinozivikanwa neSvika nezvako",
  },
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
  "yourdata.deleteConfirm": {
    en: "Yes, delete my details",
    sn: "Hongu, dzima ruzivo rwangu",
  },
  "yourdata.deleteCancel": { en: "Keep them", sn: "Zvichengete" },
  "yourdata.err": {
    en: "That did not work. Try again.",
    sn: "Hazvina kushanda. Edzazve.",
  },
  "profile.open": { en: "Profile and settings", sn: "Profile nemarongero" },
  "profile.title": { en: "Your Svika", sn: "Svika yako" },

  // welcome header (unreferenced screen, spec gap proposal): greeting in Harare
  // time, the rider's name, and honest ride stats.
  "profile.greetMorning": { en: "Good morning", sn: "Mangwanani" },
  "profile.greetAfternoon": { en: "Good afternoon", sn: "Masikati" },
  "profile.greetEvening": { en: "Good evening", sn: "Manheru" },
  "profile.welcomeNoName": { en: "Welcome to Svika", sn: "Mauya kuSvika" },
  "profile.statTotal": { en: "Total rides", sn: "Nzendo dzese" },
  "profile.statMonth": { en: "This month", sn: "Mwedzi uno" },
  "profile.statFave": { en: "Top trip", sn: "Rwendo rukuru" },
  "profile.statsEmpty": {
    en: "No rides yet. Plan a trip and your count starts here.",
    sn: "Hapana nzendo. Ronga rwendo uye kuverenga kwako kunotangira pano.",
  },
  "profile.statsDemo": {
    en: "Some of these rides are simulated demo history.",
    sn: "Dzimwe nzendo idzi inhoroondo yekuratidzira.",
  },
  "profile.settingsH": { en: "Settings", sn: "Marongero" },
  "profile.appearanceH": { en: "Look and language", sn: "Chitarisiko nemutauro" },
  "profile.languageH": { en: "Language", sn: "Mutauro" },
  "profile.themeH": { en: "Day or night", sn: "Masikati kana usiku" },

  "profile.youH": { en: "Your details", sn: "Ruzivo rwako" },
  "profile.nameLabel": { en: "Your name", sn: "Zita rako" },
  "profile.phoneLabel": { en: "Phone", sn: "Foni" },
  "profile.saveCta": { en: "Save", sn: "Chengeta" },
  "profile.savedNote": { en: "Saved.", sn: "Zvachengetwa." },
  "profile.tripsH": { en: "Saved trips", sn: "Nzendo dzakachengetwa" },
  "profile.tripsNone": {
    en: "No saved trips yet. Plan a trip and give it a name.",
    sn: "Hapana nzendo dzakachengetwa. Ronga rwendo urwupe zita.",
  },
  "profile.renameCta": { en: "Rename", sn: "Shandura zita" },
  "profile.removeCta": { en: "Remove", sn: "Bvisa" },
  "profile.historyH": { en: "Your rides", sn: "Nzendo dzako" },
  "profile.historySummary": {
    en: "{count} rides with Svika since {month}.",
    sn: "Nzendo {count} neSvika kubva {month}.",
  },
  "profile.historyFirst": {
    en: "Your first ride with Svika.",
    sn: "Rwendo rwako rwekutanga neSvika.",
  },
  "profile.historyNone": {
    en: "Your rides will appear here after your first trip.",
    sn: "Nzendo dzako dzichaonekwa pano mushure merwendo rwekutanga.",
  },
  "profile.alertsH": { en: "Commute alerts", sn: "Yeuchidzo dzerwendo" },
  "profile.alertsB": {
    en: "When your usual kombi is getting close in your usual travel window, Svika tells you. Built only from your own ride history.",
    sn: "Kana kombi yaunogara uchikwira yaswedera panguva yaunowanzofamba, Svika inokuudza. Zvinobva munhoroondo yenzendo dzako chete.",
  },
  "profile.voiceH": { en: "Voice guide", sn: "Inzwi rinotungamira" },
  "profile.voiceB": {
    en: "A voice that tells you when your stop is near and when to get off. Turn it on per language.",
    sn: "Inzwi rinokuudza kana chiteshi chako chaswedera uye pekuburuka. Batidza pamutauro waunoda.",
  },
  "profile.voiceNote": {
    en: "The current voice is a placeholder until recorded Zimbabwean voices land.",
    sn: "Inzwi ririko nderekumbomira kusvika manzwi echiZimbabwe akarekodhwa asvika.",
  },
  "profile.voiceEn": { en: "English voice", sn: "Inzwi reChirungu" },
  "profile.voiceSn": { en: "Shona voice", sn: "Inzwi reChiShona" },
  "profile.on": { en: "On", sn: "Rakabatidzwa" },
  "profile.off": { en: "Off", sn: "Rakadzimwa" },
  "profile.emergencyH": { en: "Emergency details", sn: "Ruzivo rwepakaoma" },
  "profile.emergencyWhy": {
    en: "If something happens on the road, the person you name here is who gets called, and your medical aid details speed up help. Svika asks so that help is one tap away, never for marketing. This is optional, only you can see it, and you can remove it any time.",
    sn: "Kana chimwe chikaitika murwendo, munhu waunonyora pano ndiye anofonerwa, uye ruzivo rwemedical aid rwako runokurumidzisa rubatsiro. Svika inokumbira kuti rubatsiro rive pedyo, kwete zvekushambadza. Izvi ndezvekuzvisarudzira, ndiwe wega unozviona, uye unogona kuzvibvisa chero nguva.",
  },
  "profile.kinName": { en: "Next of kin name", sn: "Zita rehama yepedyo" },
  "profile.kinPhone": { en: "Next of kin phone", sn: "Foni yehama yepedyo" },
  "profile.aidName": { en: "Medical aid name", sn: "Zita remedical aid" },
  "profile.aidNumber": { en: "Medical aid number", sn: "Nhamba yemedical aid" },
  "profile.emergencyConsent": {
    en: "I agree that Svika stores these details for emergencies. I can remove them at any time.",
    sn: "Ndinobvuma kuti Svika ichengete ruzivo urwu rwepakaoma. Ndinogona kuzvibvisa chero nguva.",
  },
  "profile.emergencySave": {
    en: "Save emergency details",
    sn: "Chengeta ruzivo rwepakaoma",
  },
  "profile.emergencyRemove": { en: "Remove these details", sn: "Bvisa ruzivo urwu" },
  "profile.emergencySaved": {
    en: "Saved. Only you can see these details.",
    sn: "Zvachengetwa. Ndiwe wega unoona ruzivo urwu.",
  },
  "profile.emergencyRemoved": {
    en: "Removed, and the withdrawal is recorded.",
    sn: "Zvabviswa, uye kubvisa kwacho kwanyorwa.",
  },
  "profile.errConsent": {
    en: "Tick the consent box first.",
    sn: "Tanga wabvuma mubhokisi remvumo.",
  },
  "profile.errEmpty": {
    en: "Add at least one detail before saving.",
    sn: "Isa ruzivo rumwe chete kana kupfuura usati wachengeta.",
  },
  "profile.errGeneric": {
    en: "That did not save. Try again.",
    sn: "Hazvina kuchengetedzwa. Edzazve.",
  },
  "voice.approaching": {
    en: "Your stop is coming up.",
    sn: "Wakusvika pachiteshi chako.",
  },
  "voice.getOff": {
    en: "This is your stop. Get off here.",
    sn: "Chiteshi chako ndechichi. Chiburuka pano.",
  },
  "voice.walk": {
    en: "Your walking leg starts here.",
    sn: "Kufamba netsoka kunotangira pano.",
  },

  "alert.title": {
    en: "Your usual kombi is close",
    sn: "Kombi yaunogara uchikwira yaswedera",
  },

  "share.sectionH": { en: "Share my ride", sn: "Govera rwendo rwangu" },
  "share.sectionB": {
    en: "Send this link to someone who worries about you. They follow the trip on a map, never your code or your money.",
    sn: "Tumira link iyi kune anokufungira. Vanoona rwendo pamepu, kwete kodhi yako kana mari yako.",
  },
  "share.createCta": { en: "Create the link", sn: "Gadzira link" },
  "share.linkLabel": {
    en: "Anyone with this link can follow the trip",
    sn: "Ane link iyi anogona kuona rwendo",
  },
  "share.revokeCta": { en: "Stop sharing", sn: "Mira kugovera" },
  "share.revokedNote": {
    en: "Sharing stopped. The link is dead now.",
    sn: "Kugovera kwamira. Link haichashande.",
  },
  "share.err": {
    en: "That did not work. Try again.",
    sn: "Hazvina kushanda. Edzazve.",
  },
  "share.expiryNote": {
    en: "The link stops working when the trip ends.",
    sn: "Link inomira kushanda kana rwendo rwapera.",
  },
  "share.viewerTitle": { en: "Following a trip", sn: "Kuona rwendo" },
  "share.statusWaiting": { en: "Waiting to board", sn: "Kumirira kukwira" },
  "share.statusOnBoard": { en: "On board", sn: "Vari mukombi" },
  "share.arrives": { en: "Arrives", sn: "Vanosvika" },
  "share.canSeeH": { en: "What you can see", sn: "Zvaunogona kuona" },
  "share.canSee1": {
    en: "The route this trip rides and where the kombis on it are right now.",
    sn: "Nzira yerwendo urwu uye pari makombi ayo izvozvi.",
  },
  "share.canSee2": {
    en: "The stop the trip ends at and the arrival estimate.",
    sn: "Chiteshi chinopera rwendo nefungidziro yekusvika.",
  },
  "share.cannotSeeH": { en: "What you cannot see", sn: "Zvausingakwanise kuona" },
  "share.cannotSee1": {
    en: "Who is riding, their phone number, their boarding code or their wallet.",
    sn: "Ari kufamba, nhamba yefoni yake, kodhi yake kana chikwama chake.",
  },
  "share.deadH": { en: "This link is no longer live", sn: "Link iyi haichashande" },
  "share.deadB": {
    en: "The trip has ended or the rider stopped sharing it.",
    sn: "Rwendo rwapera kana kuti mufambi amira kurugovera.",
  },

  // --- the intelligence doors: the three spines with their evidence -------
  "story.eta.0": {
    en: "Watch the arrives number on the card, and the label under it. That label always says what the number stands on: rides we recorded on this road with a phone, or plainly a demo estimate if the engine is ever unreachable. Tap any basis label in the app and it explains itself.",
    sn: "Tarisa nhamba yekusvika pakadhi, nechiratidzo chiri pasi payo. Chiratidzo icho chinogara chichitaura painomira nhamba: nzendo dzatakarekodha munzira ino nefoni, kana kuti fungidziro yekuratidzira pachena kana injini isingawanikwe. Baya chiratidzo chipi zvacho muapp chinozvitsanangura.",
  },
  "story.eta.1": {
    en: "The whole ladder: a measured average serves today, a trained model waits, and one committed rule promotes it only when it beats the average on rides it never saw. This table is the evidence itself.",
    sn: "Danho rese: avhareji yakayerwa iri kushanda nhasi, modhi yakadzidziswa yakamirira, uye mutemo mumwe wakachengetwa unoikwidza chete kana ichikunda avhareji panzendo yaisati yaona. Tafura iyi ndihwo uchapupu pachahwo.",
  },

  "story.wd.0": {
    en: "This is the owner's view. Every money figure comes from the real ledger. The watchdog card scans a simulated history, labelled as such, because a watchdog needs months and this network is days old.",
    sn: "Uku ndiko kuona kwemuridzi. Nhamba yega yega yemari inobva mubhuku remari chairo. Kadhi remurindi rinoongorora nhoroondo yakagadzirwa, yakanyorwa saizvozvo, nekuti murindi anoda mwedzi uye network iyi ine mazuva.",
  },
  "story.wd.1": {
    en: "Now the test. Next plants a heavy skim on yesterday inside that simulated history: one kombi of four hands over far less than it took. The route total barely moves.",
    sn: "Zvino muedzo. Enderera inoisa kubiwa kukuru pazuro munhoroondo yakagadzirwa iya: kombi imwe pana ina inopa zvishoma kupfuura zvayakatora. Mari yese yenzira haizununguke zvakanyanya.",
  },
  "story.wd.2": {
    en: "Read the flag. The fixed threshold rule stayed silent, exactly as its committed score said it would: one kombi's skim dilutes to a few percent at route level. The isolation forest flagged the day.",
    sn: "Verenga chiratidzo. Mutemo wakagadzikwa wakaramba wakanyarara, sekutaura kwakaita zvibodzwa zvawo zvakachengetwa: kubiwa kwekombi imwe kunoderera kusvika pazvikamu zvishoma panzira yese. Sango rekupatsanura rakadoma zuva iri.",
  },
  "story.wd.3": {
    en: "The explanation reads in English or Shona, and it names a day, a route and an unnamed vehicle, never a person. That rule is enforced by a unit test, not a promise.",
    sn: "Tsanangudzo inoverengeka muChirungu kana muchiShona, uye inodoma zuva, nzira nekombi isina zita, kwete munhu. Mutemo uyu unosimbiswa nebvunzo yekodhi, kwete vimbiso.",
  },

  // --- vision scenes: simulations of what ships next, always stamped ------
  "vision.stamp": { en: "Simulation", sn: "Kufananidzira" },

  // Tinashe's crash flow
  "story.tin.0": {
    en: "Tinashe is riding home from a job interview when his kombi stops hard. This moment is staged: nothing detects crashes in this web app today.",
    sn: "Tinashe ari kudzokera kumba achibva kuinterview yebasa apo kombi yake inomira zvakaoma. Chiitiko ichi ndechekufananidzira: hapana chinobata tsaona muapp iyi nhasi.",
  },
  "story.tin.1": {
    en: "His mother's phone gets the auto message with a live location link. The link grammar is Svika's real share my ride feature.",
    sn: "Foni yaamai vake inogamuchira meseji nelink yekuona paari. Link iyi inoshanda semashandiro eshare my ride chaiyo yeSvika.",
  },
  "story.tin.2": {
    en: "A responder opens the link and sees what Tinashe chose to store: next of kin and medical aid. These are the real profile fields from the app today, shown with demo persona values.",
    sn: "Mubatsiri anovhura link oona zvakasarudzwa naTinashe kuchengetwa: hama yepedyo nemedical aid. Ndiwo minda chaiyo yeprofile iripo nhasi, ichiratidzwa neruzivo rwemuenzaniso.",
  },
  "story.tin.3": {
    en: "Plainly: crash detection ships with the native app, not this build. What is live today is the profile's emergency details, consented and protected, one tap from help.",
    sn: "Zviri pachena: kubata tsaona kunouya neapp yepafoni, kwete build ino. Chiripo nhasi ndicho ruzivo rwepakaoma rwepaprofile, rwakabvumirwa uye rwakachengetedzwa, padyo nerubatsiro.",
  },
  "vision.tin.alertH": {
    en: "Sudden stop on the corridor",
    sn: "Kumira kwakaoma munzira",
  },
  "vision.tin.alertNear": { en: "near", sn: "pedyo ne" },
  "vision.tin.alertSent": {
    en: "The auto message with his live location is on its way to Amai Moyo.",
    sn: "Meseji ine paari izvozvi iri kuenda kuna Amai Moyo.",
  },
  "vision.tin.kinPhone": { en: "Amai Moyo's phone", sn: "Foni yaAmai Moyo" },
  "vision.tin.kinMsg": {
    en: "Tinashe's kombi stopped suddenly near Copacabana. Follow his live location:",
    sn: "Kombi yaTinashe yamira nekukurumidza pedyo neCopacabana. Ona paari izvozvi:",
  },
  "vision.tin.kinFrom": {
    en: "Auto message from Svika",
    sn: "Meseji inozvitumira kubva kuSvika",
  },
  "vision.tin.responderWhy": {
    en: "What a responder sees through the emergency link: only what Tinashe chose to store.",
    sn: "Zvinoonekwa nemubatsiri kuburikidza nelink yepakaoma: zvakasarudzwa naTinashe chete.",
  },
  "vision.tin.responderNote": {
    en: "These fields are live in the product today. Only the rider can store them, with consent recorded, and removal is one tap on the profile.",
    sn: "Minda iyi inoshanda muapp nhasi. Mufambi chete ndiye anoichengeta, nemvumo yakanyorwa, uye kubvisa kuri padyo paprofile.",
  },

  // Gogo on her mbudzi
  "story.gogo.0": {
    en: "Gogo does not own a smartphone and never will. Her mbudzi's keypad works: dial *123# and press OK.",
    sn: "Gogo havana smartphone uye havazombovi nayo. Makiyi embudzi yavo anoshanda: dhayira *123# wobaya OK.",
  },
  "story.gogo.1": {
    en: "Every menu here is real tested code, and the how far answer comes from the same eta engine the app uses. What waits is a telco aggregator agreement: a contract, not a build.",
    sn: "Menyu imwe neimwe pano icode chaiyo yakaedzwa, uye mhinduro yekuti kombi iri kure sei inobva kuinjini imwe chete yeeta inoshandiswa neapp. Chakamirirwa chibvumirano nemakambani emafoni: kondirakiti, kwete kuvaka.",
  },
  "vision.gogo.menu1": { en: "1. My credit", sn: "1. Mari yangu" },
  "vision.gogo.menu2": { en: "2. Book my usual trip", sn: "2. Bhuka rwendo rwangu" },
  "vision.gogo.menu3": {
    en: "3. How far is my kombi",
    sn: "3. Kombi yangu iri kure sei",
  },
  "vision.gogo.menu4": { en: "4. Claim my change", sn: "4. Tora chenji yangu" },
  "vision.gogo.invalid": {
    en: "That choice is not on the menu.",
    sn: "Sarudzo iyoyo haipo pamenyu.",
  },
  "vision.gogo.claimPrompt": {
    en: "Enter the 4 digit change code from your ride. 0 goes back.",
    sn: "Isa kodhi yechenji ine nhamba 4 yerwendo rwako. 0 inodzokera shure.",
  },
  "vision.gogo.balance": { en: "Your credit:", sn: "Mari yako:" },
  "vision.gogo.booked": { en: "Booked:", sn: "Zvabhukwa:" },
  "vision.gogo.bookedCode": { en: "Show the hwindi code", sn: "Ratidza hwindi kodhi" },
  "vision.gogo.eta": { en: "Your kombi is about", sn: "Kombi yako iri angangoita" },
  "vision.gogo.etaDemo": { en: "(demo estimate)", sn: "(fungidziro yekuratidzira)" },
  "vision.gogo.claimed": {
    en: "Change kept as credit. New balance:",
    sn: "Chenji yachengetwa semari. Yasvika:",
  },
  "vision.gogo.claimRejected": {
    en: "That code did not match a ride.",
    sn: "Kodhi iyoyo haina kuwirirana nerwendo.",
  },
  "vision.gogo.unavailable": {
    en: "Service not available now. Try again.",
    sn: "Sevhisi haipo izvozvi. Edzazve.",
  },
  "vision.gogo.idleHint": { en: "Dial", sn: "Dhayira" },
  "vision.gogo.endedHint": {
    en: "Session ended. Dial again:",
    sn: "Zvapera. Dhayirazve:",
  },
  "vision.gogo.waiting": { en: "Please wait", sn: "Mirira zvishoma" },
  "vision.gogo.keyOk": { en: "OK", sn: "OK" },
  "vision.gogo.keyClear": { en: "C", sn: "C" },
  // Kombi capacity
  "story.cap.0": {
    en: "Every kombi on the corridor wears how full its conductor declares it. The card holds that number against what redeemed tickets and check ins prove.",
    sn: "Kombi imwe neimwe munzira inoratidza kuzara kwainotaurwa nahwindi wayo. Kadhi rinoenzanisa nhamba iyoyo nezvinoratidzwa nematikiti akashandiswa nekupinda kwakanyorwa.",
  },
  "story.cap.1": {
    en: "When declared and proven drift apart, that is flagged as a pattern to review, never a person to accuse. This ships when real vehicles stream data.",
    sn: "Kana zvakataurwa nezvakaratidzwa zvikasiyana, zvinongoratidzwa semaitiro ekuongorora, kwete munhu wekupomera. Izvi zvinouya kana mota chaidzo dzotumira ruzivo.",
  },
  "vision.cap.heading": {
    en: "How full, honestly",
    sn: "Kuzara chaiko, pachokwadi",
  },
  "vision.cap.colDeclared": { en: "Declares", sn: "Zvinotaurwa" },
  "vision.cap.colProven": { en: "Proven", sn: "Zvakaratidzwa" },
  "vision.cap.drift": {
    en: "drifts today. A pattern to review, never an accusation.",
    sn: "iri kusiyana nhasi. Maitiro ekuongorora, kwete mhosva.",
  },

  "vision.gogo.note": {
    en: "The menus on this phone are real code with unit tests beside them, and the how far answer calls the live arrival engine. Reaching real handsets waits on a telco aggregator agreement, which is a contract, not a build. The money menus here move nothing.",
    sn: "Menyu dziri pafoni iyi icode chaiyo ine miedzo padyo payo, uye mhinduro yekure kwekombi inodana injini chaiyo yekusvika. Kusvika pamafoni chaiwo kwakamirira chibvumirano nemakambani emafoni, kondirakiti kwete kuvaka. Menyu dzemari pano hadzifambisi chinhu.",
  },
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: AppLanguage, key: DictKey): string {
  return dict[key][lang];
}
