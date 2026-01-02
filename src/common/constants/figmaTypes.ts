/**
 * @file Figma API type constants
 * @module constants/figmaTypes
 * 
 * Centralized constants for Figma API types and values.
 * These constants match the Figma Plugin API specifications.
 */

// ============================================================================
// LAYOUT SIZING MODES
// ============================================================================

/** Layout sizing mode values from Figma API */
export const LayoutSizing = {
  FILL: "FILL",
  HUG: "HUG",
  FIXED: "FIXED",
} as const;

export type LayoutSizingType = (typeof LayoutSizing)[keyof typeof LayoutSizing];

// ============================================================================
// LAYOUT MODES (FLEX DIRECTION)
// ============================================================================

/** Layout mode values determining flex direction */
export const LayoutMode = {
  HORIZONTAL: "HORIZONTAL",
  VERTICAL: "VERTICAL",
  NONE: "NONE",
} as const;

export type LayoutModeType = (typeof LayoutMode)[keyof typeof LayoutMode];

// ============================================================================
// LAYOUT WRAP
// ============================================================================

/** Layout wrap modes for auto-layout */
export const LayoutWrap = {
  NO_WRAP: "NO_WRAP",
  WRAP: "WRAP",
} as const;

export type LayoutWrapType = (typeof LayoutWrap)[keyof typeof LayoutWrap];

// ============================================================================
// LAYOUT POSITIONING
// ============================================================================

/** Layout positioning modes */
export const LayoutPositioning = {
  AUTO: "AUTO",
  ABSOLUTE: "ABSOLUTE",
} as const;

export type LayoutPositioningType = (typeof LayoutPositioning)[keyof typeof LayoutPositioning];

// ============================================================================
// ALIGNMENT
// ============================================================================

/** Primary axis alignment values */
export const PrimaryAxisAlign = {
  MIN: "MIN",
  CENTER: "CENTER",
  MAX: "MAX",
  SPACE_BETWEEN: "SPACE_BETWEEN",
} as const;

export type PrimaryAxisAlignType = (typeof PrimaryAxisAlign)[keyof typeof PrimaryAxisAlign];

/** Counter axis alignment values */
export const CounterAxisAlign = {
  MIN: "MIN",
  CENTER: "CENTER",
  MAX: "MAX",
  BASELINE: "BASELINE",
} as const;

export type CounterAxisAlignType = (typeof CounterAxisAlign)[keyof typeof CounterAxisAlign];

/** Counter axis content alignment for wrapped layouts */
export const CounterAxisAlignContent = {
  AUTO: "AUTO",
  SPACE_BETWEEN: "SPACE_BETWEEN",
} as const;

export type CounterAxisAlignContentType = (typeof CounterAxisAlignContent)[keyof typeof CounterAxisAlignContent];

// ============================================================================
// FILL TYPES
// ============================================================================

/** Fill type values */
export const FillType = {
  SOLID: "SOLID",
  GRADIENT_LINEAR: "GRADIENT_LINEAR",
  GRADIENT_RADIAL: "GRADIENT_RADIAL",
  GRADIENT_ANGULAR: "GRADIENT_ANGULAR",
  GRADIENT_DIAMOND: "GRADIENT_DIAMOND",
  IMAGE: "IMAGE",
} as const;

export type FillTypeType = (typeof FillType)[keyof typeof FillType];

// ============================================================================
// EFFECT TYPES
// ============================================================================

/** Effect type values */
export const EffectType = {
  DROP_SHADOW: "DROP_SHADOW",
  INNER_SHADOW: "INNER_SHADOW",
  LAYER_BLUR: "LAYER_BLUR",
  BACKGROUND_BLUR: "BACKGROUND_BLUR",
} as const;

export type EffectTypeType = (typeof EffectType)[keyof typeof EffectType];

// ============================================================================
// TEXT PROPERTIES
// ============================================================================

/** Text horizontal alignment values */
export const TextAlignHorizontal = {
  LEFT: "LEFT",
  CENTER: "CENTER",
  RIGHT: "RIGHT",
  JUSTIFIED: "JUSTIFIED",
} as const;

export type TextAlignHorizontalType = (typeof TextAlignHorizontal)[keyof typeof TextAlignHorizontal];

/** Text decoration values */
export const TextDecoration = {
  NONE: "NONE",
  UNDERLINE: "UNDERLINE",
  STRIKETHROUGH: "STRIKETHROUGH",
} as const;

export type TextDecorationType = (typeof TextDecoration)[keyof typeof TextDecoration];

/** Text case/transform values */
export const TextCase = {
  ORIGINAL: "ORIGINAL",
  UPPER: "UPPER",
  LOWER: "LOWER",
  TITLE: "TITLE",
  SMALL_CAPS: "SMALL_CAPS",
  SMALL_CAPS_FORCED: "SMALL_CAPS_FORCED",
} as const;

export type TextCaseType = (typeof TextCase)[keyof typeof TextCase];

// ============================================================================
// NODE TYPES
// ============================================================================

/** Common Figma node types */
export const NodeType = {
  FRAME: "FRAME",
  COMPONENT: "COMPONENT",
  COMPONENT_SET: "COMPONENT_SET",
  INSTANCE: "INSTANCE",
  GROUP: "GROUP",
  TEXT: "TEXT",
  RECTANGLE: "RECTANGLE",
  ELLIPSE: "ELLIPSE",
  POLYGON: "POLYGON",
  STAR: "STAR",
  VECTOR: "VECTOR",
  LINE: "LINE",
  BOOLEAN_OPERATION: "BOOLEAN_OPERATION",
  SECTION: "SECTION",
} as const;

export type NodeTypeType = (typeof NodeType)[keyof typeof NodeType];

// ============================================================================
// STROKE ALIGNMENT
// ============================================================================

/** Stroke alignment values */
export const StrokeAlign = {
  INSIDE: "INSIDE",
  OUTSIDE: "OUTSIDE",
  CENTER: "CENTER",
} as const;

export type StrokeAlignType = (typeof StrokeAlign)[keyof typeof StrokeAlign];

