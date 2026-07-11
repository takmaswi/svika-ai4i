// Camera paddings assume a full phone screen, but the map can render in a
// shorter box: the story stage reserves a caption band below the screen and
// frames it at 360x720 on desktop. MapLibre's fitBounds throws (and strands
// the camera on the world view) when padding meets or exceeds the container,
// so every fit clamps here first: paddings scale down together until at
// least a small visible band of map remains on each axis.

export interface FitPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The smallest strip of map that must stay visible between paddings. */
export const MIN_MAP_BAND = 90;

export function clampFitPadding(
  containerWidth: number,
  containerHeight: number,
  padding: Partial<FitPadding> | number,
): FitPadding {
  const p =
    typeof padding === "number"
      ? { top: padding, bottom: padding, left: padding, right: padding }
      : {
          top: padding.top ?? 0,
          bottom: padding.bottom ?? 0,
          left: padding.left ?? 0,
          right: padding.right ?? 0,
        };
  const vSpace = Math.max(0, containerHeight - MIN_MAP_BAND);
  const hSpace = Math.max(0, containerWidth - MIN_MAP_BAND);
  const vScale = Math.min(1, vSpace / Math.max(1, p.top + p.bottom));
  const hScale = Math.min(1, hSpace / Math.max(1, p.left + p.right));
  return {
    top: Math.floor(p.top * vScale),
    bottom: Math.floor(p.bottom * vScale),
    left: Math.floor(p.left * hScale),
    right: Math.floor(p.right * hScale),
  };
}
