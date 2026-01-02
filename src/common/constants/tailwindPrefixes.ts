/**
 * @file Tailwind CSS class prefixes and utilities
 * @module constants/tailwindPrefixes
 * 
 * Centralized constants for Tailwind CSS class generation.
 * These prefixes are used when converting Figma styles to Tailwind classes.
 */

// ============================================================================
// COLOR PREFIXES
// ============================================================================

/** Prefixes for color-related Tailwind classes */
export const ColorPrefix = {
  BACKGROUND: "bg-",
  TEXT: "text-",
  BORDER: "border-",
  RING: "ring-",
  DIVIDE: "divide-",
  PLACEHOLDER: "placeholder-",
  FROM: "from-",
  VIA: "via-",
  TO: "to-",
} as const;

// ============================================================================
// SPACING PREFIXES
// ============================================================================

/** Prefixes for spacing-related Tailwind classes */
export const SpacingPrefix = {
  PADDING: "p-",
  PADDING_X: "px-",
  PADDING_Y: "py-",
  PADDING_TOP: "pt-",
  PADDING_RIGHT: "pr-",
  PADDING_BOTTOM: "pb-",
  PADDING_LEFT: "pl-",
  MARGIN: "m-",
  MARGIN_X: "mx-",
  MARGIN_Y: "my-",
  MARGIN_TOP: "mt-",
  MARGIN_RIGHT: "mr-",
  MARGIN_BOTTOM: "mb-",
  MARGIN_LEFT: "ml-",
  GAP: "gap-",
  GAP_X: "gap-x-",
  GAP_Y: "gap-y-",
  SPACE_X: "space-x-",
  SPACE_Y: "space-y-",
} as const;

// ============================================================================
// SIZING PREFIXES
// ============================================================================

/** Prefixes for size-related Tailwind classes */
export const SizingPrefix = {
  WIDTH: "w-",
  HEIGHT: "h-",
  MIN_WIDTH: "min-w-",
  MIN_HEIGHT: "min-h-",
  MAX_WIDTH: "max-w-",
  MAX_HEIGHT: "max-h-",
  SIZE: "size-",
} as const;

// ============================================================================
// TYPOGRAPHY PREFIXES
// ============================================================================

/** Prefixes for typography-related Tailwind classes */
export const TypographyPrefix = {
  FONT_SIZE: "text-",
  FONT_WEIGHT: "font-",
  FONT_FAMILY: "font-",
  LINE_HEIGHT: "leading-",
  LETTER_SPACING: "tracking-",
} as const;

// ============================================================================
// LAYOUT PREFIXES
// ============================================================================

/** Prefixes for layout-related Tailwind classes */
export const LayoutPrefix = {
  FLEX: "flex-",
  GRID: "grid-",
  JUSTIFY: "justify-",
  ITEMS: "items-",
  CONTENT: "content-",
  SELF: "self-",
} as const;

// ============================================================================
// BORDER & RADIUS PREFIXES
// ============================================================================

/** Prefixes for border-related Tailwind classes */
export const BorderPrefix = {
  BORDER: "border-",
  BORDER_T: "border-t-",
  BORDER_R: "border-r-",
  BORDER_B: "border-b-",
  BORDER_L: "border-l-",
  ROUNDED: "rounded-",
  ROUNDED_T: "rounded-t-",
  ROUNDED_R: "rounded-r-",
  ROUNDED_B: "rounded-b-",
  ROUNDED_L: "rounded-l-",
  ROUNDED_TL: "rounded-tl-",
  ROUNDED_TR: "rounded-tr-",
  ROUNDED_BL: "rounded-bl-",
  ROUNDED_BR: "rounded-br-",
} as const;

// ============================================================================
// EFFECT PREFIXES
// ============================================================================

/** Prefixes for effect-related Tailwind classes */
export const EffectPrefix = {
  SHADOW: "shadow-",
  BLUR: "blur-",
  DROP_SHADOW: "drop-shadow-",
  OPACITY: "opacity-",
} as const;

// ============================================================================
// COMMON TAILWIND VALUES
// ============================================================================

/** Common Tailwind size values */
export const TailwindSize = {
  FULL: "full",
  AUTO: "auto",
  MIN: "min",
  MAX: "max",
  FIT: "fit",
  SCREEN: "screen",
  PX: "px",
} as const;

/** Common flex values */
export const FlexValue = {
  NONE: "none",
  ROW: "row",
  COL: "col",
  ROW_REVERSE: "row-reverse",
  COL_REVERSE: "col-reverse",
  WRAP: "wrap",
  NOWRAP: "nowrap",
  WRAP_REVERSE: "wrap-reverse",
  GROW: "grow",
  SHRINK: "shrink",
} as const;

/** Alignment values for justify and items */
export const AlignValue = {
  START: "start",
  END: "end",
  CENTER: "center",
  BETWEEN: "between",
  AROUND: "around",
  EVENLY: "evenly",
  STRETCH: "stretch",
  BASELINE: "baseline",
} as const;

// ============================================================================
// ARBITRARY VALUE WRAPPERS
// ============================================================================

/**
 * Wraps a value in Tailwind's arbitrary value syntax.
 * @example wrapArbitrary("100px") => "[100px]"
 */
export function wrapArbitrary(value: string | number): string {
  return `[${value}]`;
}

/**
 * Creates an arbitrary CSS variable reference.
 * @example arbitraryVar("--spacing-4") => "[var(--spacing-4)]"
 */
export function arbitraryVar(varName: string): string {
  const cleanName = varName.startsWith("--") ? varName : `--${varName}`;
  return `[var(${cleanName})]`;
}

