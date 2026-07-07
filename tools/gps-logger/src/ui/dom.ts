// Tiny DOM helpers. No framework: this is a one-screen field tool and every
// kilobyte counts on a cheap Android over a slow link.

type Child = Node | string | null | undefined | false;

interface ElProps {
  class?: string;
  text?: string;
  html?: string;
  onclick?: (ev: MouseEvent) => void;
  attrs?: Record<string, string>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.onclick) el.onclick = props.onclick;
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function mount(node: Node): void {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app missing");
  app.replaceChildren(node);
}

/** A full-screen modal. Returns a function that removes it. */
export function openModal(...content: Child[]): () => void {
  const overlay = h("div", { class: "modal-overlay" });
  const sheet = h("div", { class: "modal-sheet" }, ...content);
  overlay.append(sheet);
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) close();
  });
  document.body.append(overlay);
  function close(): void {
    overlay.remove();
  }
  return close;
}

/** A big yes/no confirm. Resolves true on confirm. */
export function confirmSheet(title: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const close = openModal(
      h("h2", { class: "modal-title", text: title }),
      h("div", { class: "modal-actions" },
        h("button", {
          class: "btn btn-lg btn-danger",
          text: confirmLabel,
          onclick: () => {
            close();
            resolve(true);
          },
        }),
        h("button", {
          class: "btn btn-lg btn-ghost",
          text: "Cancel",
          onclick: () => {
            close();
            resolve(false);
          },
        }),
      ),
    );
  });
}

export function toast(message: string): void {
  const el = h("div", { class: "toast", text: message });
  document.body.append(el);
  setTimeout(() => el.classList.add("toast-in"), 10);
  setTimeout(() => {
    el.classList.remove("toast-in");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
