// The one-handed prompts: board a kombi, mark a point, rename a point. Each
// returns a promise that resolves to the captured value or null on cancel.

import type { Direction, MarkerType } from "../types";
import { h, openModal } from "./dom";

export interface BoardInput {
  routeName: string;
  direction: Direction;
}

export function boardModal(initial?: Partial<BoardInput>): Promise<BoardInput | null> {
  return new Promise((resolve) => {
    let direction: Direction | null = initial?.direction ?? null;

    const nameInput = h("input", {
      class: "field-input",
      attrs: {
        type: "text",
        placeholder: "e.g. Mt Pleasant Heights to Rezende",
        value: initial?.routeName ?? "",
        autocomplete: "off",
        enterkeyhint: "done",
      },
    });

    const outBtn = h("button", { class: "btn btn-lg btn-outline choice", text: "Outbound" });
    const inBtn = h("button", { class: "btn btn-lg btn-outline choice", text: "Inbound" });
    function paint(): void {
      outBtn.classList.toggle("selected", direction === "outbound");
      inBtn.classList.toggle("selected", direction === "inbound");
    }
    outBtn.addEventListener("click", () => {
      direction = "outbound";
      paint();
    });
    inBtn.addEventListener("click", () => {
      direction = "inbound";
      paint();
    });
    paint();

    const close = openModal(
      h("h2", { class: "modal-title", text: "Boarded kombi" }),
      h("div", { class: "field-label", text: "Route name" }),
      nameInput,
      h("div", { class: "field-label", text: "Direction" }),
      h("p", {
        class: "btn-sub",
        text: "Outbound = the route's start toward its end. Inbound = the reverse.",
      }),
      h("div", { class: "btn-grid" }, outBtn, inBtn),
      h("div", { class: "modal-actions" },
        h("button", {
          class: "btn btn-lg btn-riding",
          text: "Start riding leg",
          onclick: () => {
            if (!direction) {
              nameInput.blur();
              (direction === null ? outBtn : inBtn).focus();
              return;
            }
            close();
            resolve({ routeName: nameInput.value.trim(), direction });
          },
        }),
        h("button", {
          class: "btn btn-lg btn-ghost",
          text: "Cancel",
          onclick: () => {
            close();
            resolve(null);
          },
        }),
      ),
    );
    setTimeout(() => nameInput.focus(), 120);
  });
}

export interface MarkInput {
  type: MarkerType;
  name: string;
}

const MARKER_TYPES: { type: MarkerType; label: string }[] = [
  { type: "dropoff", label: "Drop-off" },
  { type: "rank", label: "Rank" },
  { type: "terminal", label: "Terminal" },
  { type: "landmark", label: "Landmark" },
];

export function markPointModal(): Promise<MarkInput | null> {
  return new Promise((resolve) => {
    let type: MarkerType = "dropoff";

    const buttons = MARKER_TYPES.map(({ type: t, label }) => {
      const btn = h("button", { class: "btn btn-lg btn-outline choice", text: label });
      btn.addEventListener("click", () => {
        type = t;
        paint();
      });
      return btn;
    });
    function paint(): void {
      buttons.forEach((b, i) => b.classList.toggle("selected", MARKER_TYPES[i]?.type === type));
    }
    paint();

    const nameInput = h("input", {
      class: "field-input",
      attrs: {
        type: "text",
        placeholder: "Name (optional, e.g. Pamachurch)",
        autocomplete: "off",
        enterkeyhint: "done",
      },
    });

    const close = openModal(
      h("h2", { class: "modal-title", text: "Mark point here" }),
      h("div", { class: "field-label", text: "Type" }),
      h("div", { class: "btn-grid" }, ...buttons),
      h("div", { class: "field-label", text: "Name" }),
      nameInput,
      h("div", { class: "modal-actions" },
        h("button", {
          class: "btn btn-lg btn-accent",
          text: "Drop point",
          onclick: () => {
            close();
            resolve({ type, name: nameInput.value.trim() });
          },
        }),
        h("button", {
          class: "btn btn-lg btn-ghost",
          text: "Cancel",
          onclick: () => {
            close();
            resolve(null);
          },
        }),
      ),
    );
    setTimeout(() => nameInput.focus(), 120);
  });
}

export function editTextModal(title: string, current: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h("input", {
      class: "field-input",
      attrs: { type: "text", value: current, autocomplete: "off", enterkeyhint: "done" },
    });
    const close = openModal(
      h("h2", { class: "modal-title", text: title }),
      input,
      h("div", { class: "modal-actions" },
        h("button", {
          class: "btn btn-lg btn-walking",
          text: "Save",
          onclick: () => {
            close();
            resolve(input.value.trim());
          },
        }),
        h("button", {
          class: "btn btn-lg btn-ghost",
          text: "Cancel",
          onclick: () => {
            close();
            resolve(null);
          },
        }),
      ),
    );
    setTimeout(() => input.focus(), 120);
  });
}
