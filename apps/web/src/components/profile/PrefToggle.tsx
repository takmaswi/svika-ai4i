// An on/off control wearing the language chip grammar from screens 1 and 2
// (the same segmented pill as EN | SN). Pure server form: the pressed side
// is the state, tapping the other side submits the flip.
interface PrefToggleProps {
  action: (formData: FormData) => Promise<void>;
  pref: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
}

export function PrefToggle({ action, pref, on, onLabel, offLabel }: PrefToggleProps) {
  return (
    <form action={action} className="lang-toggle" data-testid={`pref-${pref}`}>
      <input type="hidden" name="pref" value={pref} />
      <button
        type="submit"
        name="value"
        value="on"
        aria-pressed={on}
        className={on ? "lang-on" : "lang-off"}
      >
        {onLabel}
      </button>
      <button
        type="submit"
        name="value"
        value="off"
        aria-pressed={!on}
        className={on ? "lang-off" : "lang-on"}
      >
        {offLabel}
      </button>
    </form>
  );
}
