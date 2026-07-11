// The permanent Simulation stamp every vision scene wears: same pill family
// as the map's demo movement chip (svika-glass, 11px 600), but without the
// signal dot, because signal red marks live truth only (DESIGN.md section 13
// rule 3) and nothing on a vision scene is live. Scenes must never render
// without it.
export function SimStamp({ label }: { label: string }) {
  return (
    <span className="sim-stamp svika-glass" data-testid="sim-stamp">
      {label}
    </span>
  );
}
