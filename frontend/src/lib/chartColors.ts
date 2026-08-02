/**
 * Validated categorical palette (dataviz skill reference palette) - fixed
 * hue order, never cycled/reassigned per-render. Slots 3 (aqua), 4 (yellow),
 * and 5 (magenta) fall below 3:1 contrast on a light surface, so charts
 * using them must carry visible direct labels rather than relying on color
 * alone (see relief rule).
 */
export const CATEGORICAL_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const

export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const

export function categoricalColor(index: number, isDark = false): string {
  const palette = isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
  return palette[index % palette.length]
}
