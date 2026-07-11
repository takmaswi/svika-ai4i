import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, type AppLanguage } from "@svika/shared";
import {
  deleteSavedTrip,
  removeEmergencyDetails,
  renameSavedTrip,
  saveEmergencyDetails,
  setPref,
  updateIdentity,
} from "@/lib/profile-actions";
import { BackIcon } from "@/components/icons";
import { PrefToggle } from "@/components/profile/PrefToggle";

interface SavedTripRow {
  id: string;
  nickname: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
}

interface RideRow {
  fare_cents: number;
  purchased_at: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  routes: { name: string } | null;
}

function monthLabel(lang: AppLanguage, iso: string): string {
  return new Intl.DateTimeFormat(lang === "sn" ? "sn" : "en-ZW", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function dayLabel(lang: AppLanguage, iso: string): string {
  return new Intl.DateTimeFormat(lang === "sn" ? "sn" : "en-ZW", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

// The rider's home for themselves (unreferenced screen, composed from the
// numbered patterns: flow screen head, bordered cards, inline forms, the
// language chip grammar for toggles). Identity, saved trips, ride history,
// alert and voice prefs, and the consent gated emergency details.
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : "";
  const err = typeof params.err === "string" ? params.err : "";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, tripsRes, ridesRes, prefsRes, emergencyRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("saved_trips")
        .select(
          "id, nickname, from_stop:stops!saved_trips_from_stop_id_fkey(name), to_stop:stops!saved_trips_to_stop_id_fkey(name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("tickets")
        .select(
          "fare_cents, purchased_at, routes(name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name)",
        )
        .eq("kind", "fare")
        .order("purchased_at", { ascending: true }),
      supabase.from("rider_prefs").select("*").maybeSingle(),
      supabase.from("emergency_details").select("*").maybeSingle(),
    ]);

  const profile = profileRes.data;
  const trips = (tripsRes.data ?? []) as unknown as SavedTripRow[];
  const rides = (ridesRes.data ?? []) as unknown as RideRow[];
  const prefs = prefsRes.data;
  const emergency = emergencyRes.data;
  const toWord = t(lang, "common.to");
  const recentRides = rides.slice(-6).reverse();

  const errKey: DictKey | null =
    err === "consent"
      ? "profile.errConsent"
      : err === "empty"
        ? "profile.errEmpty"
        : err
          ? "profile.errGeneric"
          : null;

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "profile.title")}</h1>
      </header>

      <section
        className="svika-card wallet-panel svika-animate-fade-up"
        data-testid="profile-identity"
      >
        <h2 className="svika-title">{t(lang, "profile.youH")}</h2>
        <form action={updateIdentity} className="profile-form">
          <label className="svika-meta profile-label" htmlFor="full_name">
            {t(lang, "profile.nameLabel")}
          </label>
          <input
            id="full_name"
            name="full_name"
            className="auth-input"
            defaultValue={profile?.full_name ?? ""}
            maxLength={80}
            required
          />
          <label className="svika-meta profile-label" htmlFor="phone">
            {t(lang, "profile.phoneLabel")}
          </label>
          <input
            id="phone"
            name="phone"
            className="auth-input"
            inputMode="tel"
            defaultValue={profile?.phone ?? ""}
            maxLength={30}
          />
          <button className="auth-submit touch-target" type="submit">
            {t(lang, "profile.saveCta")}
          </button>
        </form>
        {saved === "identity" && (
          <p className="wallet-ok svika-body" data-testid="identity-saved">
            {t(lang, "profile.savedNote")}
          </p>
        )}
        {(err === "name" || err === "phone" || err === "identity") && (
          <p className="auth-error svika-body">{t(lang, "profile.errGeneric")}</p>
        )}
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-2"
        data-testid="profile-trips"
      >
        <h2 className="svika-title">{t(lang, "profile.tripsH")}</h2>
        {trips.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "profile.tripsNone")}</p>
        ) : (
          <ul className="profile-trip-list">
            {trips.map((trip) => (
              <li key={trip.id} className="profile-trip">
                <p className="svika-meta">
                  {trip.from_stop?.name} {toWord} {trip.to_stop?.name}
                </p>
                <form action={renameSavedTrip} className="wallet-inline-form">
                  <input type="hidden" name="trip" value={trip.id} />
                  <input
                    name="nickname"
                    className="auth-input"
                    defaultValue={trip.nickname}
                    maxLength={40}
                    aria-label={t(lang, "profile.renameCta")}
                    required
                  />
                  <button
                    className="auth-submit touch-target wallet-inline-cta"
                    type="submit"
                  >
                    {t(lang, "profile.renameCta")}
                  </button>
                </form>
                <form action={deleteSavedTrip}>
                  <input type="hidden" name="trip" value={trip.id} />
                  <button className="auth-link touch-target" type="submit">
                    {t(lang, "profile.removeCta")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-3"
        data-testid="profile-rides"
      >
        <h2 className="svika-title">{t(lang, "profile.historyH")}</h2>
        {rides.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "profile.historyNone")}</p>
        ) : (
          <>
            <p className="svika-body">
              {rides.length === 1
                ? t(lang, "profile.historyFirst")
                : t(lang, "profile.historySummary")
                    .replace("{count}", String(rides.length))
                    .replace("{month}", monthLabel(lang, rides[0]!.purchased_at))}
            </p>
            <ul className="history-list">
              {recentRides.map((ride, i) => (
                <li key={i} className="history-item">
                  <span className="history-kind">
                    {ride.from_stop && ride.to_stop
                      ? `${ride.from_stop.name} ${toWord} ${ride.to_stop.name}`
                      : (ride.routes?.name ?? "")}
                    <span className="svika-meta svika-mono-code profile-ride-date">
                      {" "}
                      {dayLabel(lang, ride.purchased_at)}
                    </span>
                  </span>
                  <span className="history-amount">{formatUsd(ride.fare_cents)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-4"
        data-testid="profile-alerts"
      >
        <div className="pref-row">
          <h2 className="svika-title">{t(lang, "profile.alertsH")}</h2>
          <PrefToggle
            action={setPref}
            pref="commute_alerts"
            on={prefs?.commute_alerts ?? false}
            onLabel={t(lang, "profile.on")}
            offLabel={t(lang, "profile.off")}
          />
        </div>
        <p className="svika-body">{t(lang, "profile.alertsB")}</p>
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-5"
        data-testid="profile-voice"
      >
        <h2 className="svika-title">{t(lang, "profile.voiceH")}</h2>
        <p className="svika-body">{t(lang, "profile.voiceB")}</p>
        <div className="pref-row">
          <span className="svika-body">{t(lang, "profile.voiceEn")}</span>
          <PrefToggle
            action={setPref}
            pref="voice_en"
            on={prefs?.voice_en ?? false}
            onLabel={t(lang, "profile.on")}
            offLabel={t(lang, "profile.off")}
          />
        </div>
        <div className="pref-row">
          <span className="svika-body">{t(lang, "profile.voiceSn")}</span>
          <PrefToggle
            action={setPref}
            pref="voice_sn"
            on={prefs?.voice_sn ?? false}
            onLabel={t(lang, "profile.on")}
            offLabel={t(lang, "profile.off")}
          />
        </div>
        <p className="svika-meta">{t(lang, "profile.voiceNote")}</p>
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-6"
        data-testid="profile-emergency"
      >
        <h2 className="svika-title">{t(lang, "profile.emergencyH")}</h2>
        <p className="svika-body">{t(lang, "profile.emergencyWhy")}</p>

        {emergency && (
          <>
            <dl className="yourdata-list" data-testid="emergency-details">
              {emergency.next_of_kin_name && (
                <div className="yourdata-row">
                  <dt className="svika-meta">{t(lang, "profile.kinName")}</dt>
                  <dd className="svika-body">{emergency.next_of_kin_name}</dd>
                </div>
              )}
              {emergency.next_of_kin_phone && (
                <div className="yourdata-row">
                  <dt className="svika-meta">{t(lang, "profile.kinPhone")}</dt>
                  <dd className="svika-mono-code">{emergency.next_of_kin_phone}</dd>
                </div>
              )}
              {emergency.medical_aid_name && (
                <div className="yourdata-row">
                  <dt className="svika-meta">{t(lang, "profile.aidName")}</dt>
                  <dd className="svika-body">{emergency.medical_aid_name}</dd>
                </div>
              )}
              {emergency.medical_aid_number && (
                <div className="yourdata-row">
                  <dt className="svika-meta">{t(lang, "profile.aidNumber")}</dt>
                  <dd className="svika-mono-code">{emergency.medical_aid_number}</dd>
                </div>
              )}
            </dl>
            <form action={removeEmergencyDetails}>
              <button
                className="auth-link touch-target"
                type="submit"
                data-testid="emergency-remove"
              >
                {t(lang, "profile.emergencyRemove")}
              </button>
            </form>
          </>
        )}

        <form action={saveEmergencyDetails} className="profile-form">
          <label className="svika-meta profile-label" htmlFor="kin_name">
            {t(lang, "profile.kinName")}
          </label>
          <input
            id="kin_name"
            name="kin_name"
            className="auth-input"
            defaultValue={emergency?.next_of_kin_name ?? ""}
            maxLength={80}
          />
          <label className="svika-meta profile-label" htmlFor="kin_phone">
            {t(lang, "profile.kinPhone")}
          </label>
          <input
            id="kin_phone"
            name="kin_phone"
            className="auth-input"
            inputMode="tel"
            defaultValue={emergency?.next_of_kin_phone ?? ""}
            maxLength={30}
          />
          <label className="svika-meta profile-label" htmlFor="aid_name">
            {t(lang, "profile.aidName")}
          </label>
          <input
            id="aid_name"
            name="aid_name"
            className="auth-input"
            defaultValue={emergency?.medical_aid_name ?? ""}
            maxLength={80}
          />
          <label className="svika-meta profile-label" htmlFor="aid_number">
            {t(lang, "profile.aidNumber")}
          </label>
          <input
            id="aid_number"
            name="aid_number"
            className="auth-input"
            defaultValue={emergency?.medical_aid_number ?? ""}
            maxLength={40}
          />
          {/* No checkbox exists in the numbered references: this native box
              tinted forest is a flagged spec gap, see the checklist notes. */}
          <label className="consent-check svika-body touch-target">
            <input type="checkbox" name="consent" required data-testid="emergency-consent" />
            <span>{t(lang, "profile.emergencyConsent")}</span>
          </label>
          <button
            className="auth-submit touch-target"
            type="submit"
            data-testid="emergency-save"
          >
            {t(lang, "profile.emergencySave")}
          </button>
        </form>
        {saved === "emergency" && (
          <p className="wallet-ok svika-body" data-testid="emergency-saved">
            {t(lang, "profile.emergencySaved")}
          </p>
        )}
        {saved === "removed" && (
          <p className="wallet-ok svika-body" data-testid="emergency-removed">
            {t(lang, "profile.emergencyRemoved")}
          </p>
        )}
        {errKey && <p className="auth-error svika-body">{t(lang, errKey)}</p>}
      </section>

      <footer className="home-sheet-footer">
        <Link className="auth-link touch-target" href="/app/privacy">
          {t(lang, "privacy.yourDataLink")}
        </Link>
      </footer>
    </main>
  );
}
