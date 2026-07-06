// P0 placeholder shell for the conductor (hwindi) surface. Fat-finger first:
// one big action per screen, high contrast, works in sunlight. The real
// offline redemption keypad and queue land in P2.

export default function App() {
  return (
    <main className="hwindi-shell">
      <header className="hwindi-header">
        <span className="svika-meta">SVIKA · HWINDI</span>
        <h1 className="svika-headline">Clear a fare</h1>
        <p className="svika-body">Bhadhara / redeem a board code</p>
      </header>

      <button className="hwindi-cta touch-target" type="button" disabled>
        Enter code · Isa kodhi
      </button>

      <p className="svika-meta hwindi-note">
        Offline redemption arrives in P2. This is the branded shell only.
      </p>
    </main>
  );
}
