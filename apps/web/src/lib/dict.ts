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
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: AppLanguage, key: DictKey): string {
  return dict[key][lang];
}
