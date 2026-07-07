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

  "map.ariaLabel": {
    en: "Map of the Heights to Rezende corridor with kombis moving along the road. Vehicle movement is a demo, not live tracking.",
    sn: "Mepu yenzira yeHeights kusvika Rezende ine makombi ari kufamba mumugwagwa. Kufamba kwemakombi ndekwekuratidzira, hakusi live.",
  },
  "map.demoChip": { en: "Demo movement", sn: "Kuratidzira" },
  "map.unavailable": {
    en: "The map could not load. Your trips and wallet still work.",
    sn: "Mepu haina kukwanisa kuvhurika. Nzendo dzako nechikwama zvichiri kushanda.",
  },
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: AppLanguage, key: DictKey): string {
  return dict[key][lang];
}
