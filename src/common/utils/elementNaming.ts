/**
 * @file Element naming utilities
 * @module utils/elementNaming
 * 
 * Shared utilities for sanitizing and normalizing Figma layer names
 * for use as HTML/JSX tag names and for internal matching operations.
 * 
 * This module consolidates element naming logic that was previously
 * duplicated across multiple files (tailwindDomGenerator, domGenerator,
 * tailwindGenerator, ClassSelectionModal).
 */

// ============================================================================
// TAG NAME SANITIZATION
// ============================================================================

/**
 * Sanitizes a Figma layer name for use as an HTML/JSX tag name.
 * 
 * This is the base sanitization function used by both CSS and Tailwind output.
 * It preserves the original casing for React component style naming.
 * 
 * @param nodeName - The original Figma layer name
 * @param componentSetName - Optional parent COMPONENT_SET name (for variants)
 * @param preserveDots - Whether to preserve dots in the name (for React component namespacing)
 * @returns Sanitized tag name safe for HTML/JSX
 * 
 * @example
 * sanitizeTagName("Button", undefined, false) => "Button"
 * sanitizeTagName("Icon.Close", undefined, true) => "Icon.Close"
 * sanitizeTagName("Icon.Close", undefined, false) => "IconClose"
 * sanitizeTagName("type=checkbox, state=default", "Checkbox", false) => "Checkbox"
 * sanitizeTagName("123Button") => "Element123Button"
 */
export function sanitizeTagName(
  nodeName: string,
  componentSetName?: string,
  preserveDots: boolean = false
): string {
  // For variant components, use the parent COMPONENT_SET name
  const nameToUse = componentSetName || nodeName;
  
  if (!nameToUse || !nameToUse.trim()) {
    return "div"; // Fallback for empty names
  }
  
  // Remove isIcon property from the name (e.g., "isIcon=True, Size=md" → "Size=md")
  let cleanedName = nameToUse
    .replace(/,?\s*isIcon\s*=\s*(true|false)\s*,?/gi, ',')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim();
  
  if (!cleanedName) {
    return "div"; // Fallback if only isIcon property was present
  }
  
  // Remove invalid characters based on output format
  // - For React/JSX (Tailwind): preserve dots for component namespacing
  // - For standard HTML (CSS): remove dots
  const charPattern = preserveDots
    ? /[^a-zA-Z0-9_.-]/g  // Keep dots for React
    : /[^a-zA-Z0-9_-]/g;  // Remove dots for HTML
  
  cleanedName = cleanedName.replace(charPattern, '');
  
  // Tag names can't start with a number or hyphen
  if (/^[0-9-]/.test(cleanedName)) {
    cleanedName = 'Element' + cleanedName;
  }
  
  return cleanedName || "div";
}

/**
 * Sanitizes a name for React/JSX output (preserves dots).
 * Use this for Tailwind/React output where component namespacing is desired.
 * 
 * @param nodeName - The original Figma layer name
 * @param componentSetName - Optional parent COMPONENT_SET name (for variants)
 * @returns Sanitized tag name for React/JSX
 */
export function sanitizeForReact(nodeName: string, componentSetName?: string): string {
  return sanitizeTagName(nodeName, componentSetName, true);
}

/**
 * Sanitizes a name for standard HTML output (removes dots).
 * Use this for CSS/HTML output where standard tag names are required.
 * 
 * @param nodeName - The original Figma layer name
 * @param componentSetName - Optional parent COMPONENT_SET name (for variants)
 * @returns Sanitized tag name for HTML
 */
export function sanitizeForHTML(nodeName: string, componentSetName?: string): string {
  return sanitizeTagName(nodeName, componentSetName, false);
}

// ============================================================================
// NAME NORMALIZATION FOR MATCHING
// ============================================================================

/**
 * Normalizes a name for internal matching operations.
 * 
 * This is used when comparing element names between different parts of the system
 * (e.g., matching DOM elements in the UI with class-to-DOM mappings from the plugin).
 * 
 * The normalization:
 * 1. Removes special characters (except letters, numbers, hyphens, underscores, dots)
 * 2. Converts to lowercase for case-insensitive matching
 * 
 * @param name - The name to normalize
 * @returns Normalized name for matching
 * 
 * @example
 * normalizeForMatching("Button") => "button"
 * normalizeForMatching("Icon.Close") => "icon.close"
 * normalizeForMatching("My Component!") => "mycomponent"
 */
export function normalizeForMatching(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_.-]/g, '')  // Remove special chars (keep dots for React namespacing)
    .toLowerCase();                    // Lowercase for case-insensitive matching
}

/**
 * Normalizes a Figma element name for use in class-to-DOM mapping.
 * 
 * This matches the sanitization logic used in the DOM generators,
 * ensuring consistent element identification across the system.
 * 
 * @param name - The Figma layer name
 * @returns Normalized element name
 */
export function normalizeElementName(name: string): string {
  return normalizeForMatching(name);
}

