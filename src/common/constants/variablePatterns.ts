/**
 * @file Variable name patterns and regex utilities
 * @module constants/variablePatterns
 * 
 * Centralized patterns for parsing Figma variable names.
 * These patterns are used to extract values and convert variable names
 * to CSS custom properties and Tailwind classes.
 */

// ============================================================================
// VARIABLE NAME PREFIXES
// ============================================================================

/** Common prefixes found in Figma variable names */
export const VariablePrefix = {
  SPACING: "spacing",
  FONT: "font",
  FONT_SIZE: "font-size",
  FONT_WEIGHT: "font-weight",
  FONT_FAMILY: "font-family",
  LEADING: "leading",
  TRACKING: "tracking",
  FILL: "fill",
  STROKE: "stroke",
  FOREGROUND: "foreground",
  BACKGROUND: "background",
  BORDER: "border",
  BORDER_WIDTH: "border-width",
  RADIUS: "radius",
  SHADOW: "shadow",
  BLUR: "blur",
  OPACITY: "opacity",
} as const;

// ============================================================================
// REGEX PATTERNS FOR VARIABLE PARSING
// ============================================================================

/**
 * Patterns for extracting values from variable names.
 * All patterns expect normalized (lowercase, slashes to hyphens) input.
 */
export const VariablePattern = {
  /**
   * Matches spacing variables in format: spacing-{value}
   * @example "spacing-7" matches "7"
   * @example "spacing-0-5" matches ["0", "5"] -> "0.5"
   * @example "spacing-px" matches "px"
   */
  SPACING: /^spacing-(?:(\d+)-(\d+)|px|([\d.]+))$/,
  
  /**
   * Matches font-size variables
   * @example "font-size-sm" matches "sm"
   * @example "font-size-lg" matches "lg"
   */
  FONT_SIZE: /^font-size-(.+)$/,
  
  /**
   * Matches font-weight variables
   * @example "font-weight-bold" matches "bold"
   * @example "font-weight-normal" matches "normal"
   */
  FONT_WEIGHT: /^font-weight-(.+)$/,
  
  /**
   * Matches font-family variables
   * @example "font-sans" matches "sans"
   * @example "font-mono" matches "mono"
   */
  FONT_FAMILY: /^font-(.+)$/,
  
  /**
   * Matches line-height (leading) variables
   * @example "leading-5" matches "5"
   * @example "leading-tight" matches "tight"
   * @example "font-leading-5" matches "5"
   */
  LINE_HEIGHT: /^(?:font-)?leading-(.+)$/,
  
  /**
   * Matches letter-spacing (tracking) variables
   * @example "tracking-normal" matches "normal"
   * @example "tracking-wide" matches "wide"
   * @example "font-tracking-normal" matches "normal"
   */
  LETTER_SPACING: /^(?:font-)?tracking-(.+)$/,
  
  /**
   * Matches border-width variables
   * @example "border-width-2" matches "2"
   * @example "border-2" matches "2"
   */
  BORDER_WIDTH: /^border(?:-width)?-(\d+)$/,
  
  /**
   * Matches border-radius variables
   * @example "radius-lg" matches "lg"
   * @example "rounded-lg" matches "lg"
   */
  BORDER_RADIUS: /^(?:radius|rounded)-(.+)$/,
  
  /**
   * Matches shadow/effect style variables
   * @example "shadow-lg" matches "lg"
   * @example "shadow/lg" (after normalization) matches "lg"
   */
  SHADOW: /^shadow-(.+)$/,
  
  /**
   * Matches blur effect variables
   * @example "blur-md" matches "md"
   */
  BLUR: /^blur-(.+)$/,
  
  /**
   * Matches opacity variables
   * @example "opacity-50" matches "50"
   */
  OPACITY: /^opacity-(\d+)$/,
} as const;

// ============================================================================
// SEMANTIC DETECTION PATTERNS
// ============================================================================

/**
 * Patterns for detecting semantic meaning from variable names.
 * Used to determine correct Tailwind prefix (bg- vs text- vs border-).
 */
export const SemanticPattern = {
  /** Patterns indicating text/foreground color */
  FOREGROUND: /foreground|text-color|^text\//i,
  
  /** Patterns indicating border/stroke color */
  STROKE: /stroke|border-color|^border\//i,
  
  /** Patterns indicating background/fill color */
  BACKGROUND: /fill|background|^bg\//i,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalizes a variable name for consistent pattern matching.
 * Converts slashes to hyphens and lowercases the string.
 * 
 * @param variableName - Raw variable name from Figma
 * @returns Normalized variable name
 * @example normalizeVariableName("spacing/7") => "spacing-7"
 * @example normalizeVariableName("Font/Size/LG") => "font-size-lg"
 */
export function normalizeVariableName(variableName: string): string {
  return variableName.toLowerCase().replace(/\//g, "-");
}

/**
 * Converts a Figma variable name to a CSS custom property name.
 * 
 * @param figmaName - Figma variable name (e.g., "spacing/7")
 * @returns CSS custom property name (e.g., "--spacing-7")
 */
export function toCSSVariable(figmaName: string): string {
  const normalized = figmaName.replace(/\//g, "-").replace(/[^a-zA-Z0-9-]/g, "-");
  return `--${normalized}`;
}

/**
 * Converts a Figma variable name to a Tailwind-friendly class name.
 * 
 * @param figmaName - Figma variable name (e.g., "fill/neutral/default")
 * @returns Tailwind class name (e.g., "fill-neutral-default")
 */
export function toTailwindClass(figmaName: string): string {
  return figmaName.toLowerCase().replace(/\//g, "-").replace(/[^a-z0-9-]/g, "-");
}

/**
 * Extracts a spacing scale value from a normalized variable name.
 * 
 * @param normalizedName - Normalized variable name (lowercase, hyphens)
 * @returns Tailwind spacing scale value or null
 * @example extractSpacingScale("spacing-7") => "7"
 * @example extractSpacingScale("spacing-0-5") => "0.5"
 * @example extractSpacingScale("spacing-px") => "px"
 */
export function extractSpacingScale(normalizedName: string): string | null {
  if (normalizedName === "spacing-px") return "px";
  
  const match = normalizedName.match(VariablePattern.SPACING);
  if (!match) return null;
  
  // Hyphen format: spacing-0-5 -> 0.5
  if (match[1] && match[2]) {
    return `${match[1]}.${match[2]}`;
  }
  
  // Direct value: spacing-7 or spacing-0.5
  return match[3] || null;
}

/**
 * Detects the semantic color type from a variable name.
 * Used to determine the correct Tailwind prefix for color classes.
 * 
 * @param variableName - Variable name to check
 * @returns "text" | "border" | "bg" based on semantic meaning
 */
export function detectColorSemantic(variableName: string): "text" | "border" | "bg" {
  if (SemanticPattern.FOREGROUND.test(variableName)) return "text";
  if (SemanticPattern.STROKE.test(variableName)) return "border";
  return "bg"; // Default to background
}

