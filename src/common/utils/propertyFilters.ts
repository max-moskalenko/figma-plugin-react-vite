/**
 * @file Property filtering utilities
 * @module utils/propertyFilters
 * 
 * Shared utilities for filtering out useless or zero-value CSS properties
 * and Tailwind classes. This helps reduce clutter in the generated output.
 */

// ============================================================================
// CSS PROPERTY FILTERING
// ============================================================================

/**
 * Regular expressions for detecting zero/useless CSS values.
 * These patterns identify properties that have no visual effect.
 */
const ZERO_VALUE_PATTERNS = {
  /** border-radius: 0px or border-radius: 0 */
  borderRadius: /^border-radius:\s*0(px)?$/i,
  
  /** padding: 0px, padding: 0, or padding: 0px 0px 0px 0px */
  padding: /^padding(-\w+)?:\s*0(px)?(\s+0(px)?)*$/i,
  
  /** gap: 0px or gap: 0 */
  gap: /^gap:\s*0(px)?$/i,
  
  /** margin: 0px or margin: 0 */
  margin: /^margin(-\w+)?:\s*0(px)?(\s+0(px)?)*$/i,
  
  /** individual corner radius: 0px */
  cornerRadius: /^border-(top|bottom)-(left|right)-radius:\s*0(px)?$/i,
};

/**
 * Determines if a CSS property has a useless (zero or default) value
 * that should be filtered out.
 * 
 * Filters properties like `border-radius: 0px`, `padding: 0px`, `gap: 0px`
 * to reduce clutter in the output. These properties don't affect the visual result.
 * 
 * @param property - CSS property string (e.g., "border-radius: 0px")
 * @returns true if the property should be filtered out, false otherwise
 * 
 * @example
 * isUselessCSSProperty("border-radius: 0px") => true
 * isUselessCSSProperty("border-radius: 8px") => false
 * isUselessCSSProperty("padding: 0") => true
 * isUselessCSSProperty("padding: 16px") => false
 */
export function isUselessCSSProperty(property: string): boolean {
  const trimmed = property.trim();
  
  // Check against all zero-value patterns
  for (const pattern of Object.values(ZERO_VALUE_PATTERNS)) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// TAILWIND CLASS FILTERING
// ============================================================================

/**
 * Regular expressions for detecting zero-value Tailwind classes.
 */
const ZERO_CLASS_PATTERNS = [
  // Border radius: rounded-[0px], rounded-0, rounded-none (none is semantically meaningful, so not filtered)
  /^rounded(?:-[a-z]+)?-\[0(?:px)?\]$/,
  /^rounded-0$/,
  
  // Padding: p-0, px-0, py-0, pt-0, pr-0, pb-0, pl-0
  /^p[xytblr]?-0$/,
  /^p[xytblr]?-\[0(?:px)?\]$/,
  
  // Margin: m-0, mx-0, my-0, mt-0, mr-0, mb-0, ml-0
  /^m[xytblr]?-0$/,
  /^m[xytblr]?-\[0(?:px)?\]$/,
  
  // Gap: gap-0, gap-x-0, gap-y-0
  /^gap(?:-[xy])?-0$/,
  /^gap(?:-[xy])?-\[0(?:px)?\]$/,
  
  // Width/Height: w-0, h-0, min-w-0, min-h-0, max-w-0, max-h-0
  /^[wh]-0$/,
  /^[wh]-\[0(?:px)?\]$/,
  /^min-[wh]-0$/,
  /^max-[wh]-0$/,
  
  // Border width: border-0
  /^border-0$/,
  /^border-[trbl]-0$/,
  
  // Opacity: opacity-0 (keep this one as it's semantically meaningful)
  // Don't filter opacity-0 since invisible elements might be intentional
];

/**
 * Determines if a Tailwind class has a zero value that should be filtered out.
 * 
 * Filters classes like `rounded-[0px]`, `p-0`, `gap-0` to reduce clutter.
 * These classes don't affect the visual result in most cases.
 * 
 * @param className - Tailwind class name (e.g., "rounded-[0px]")
 * @returns true if the class should be filtered out, false otherwise
 * 
 * @example
 * isZeroValueClass("rounded-[0px]") => true
 * isZeroValueClass("rounded-lg") => false
 * isZeroValueClass("p-0") => true
 * isZeroValueClass("p-4") => false
 */
export function isZeroValueClass(className: string): boolean {
  const trimmed = className.trim();
  
  for (const pattern of ZERO_CLASS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filters out zero-value classes from an array of Tailwind classes.
 * 
 * @param classes - Array of Tailwind class names
 * @returns Filtered array without zero-value classes
 * 
 * @example
 * filterZeroValueClasses(["p-4", "rounded-[0px]", "bg-red-500"]) => ["p-4", "bg-red-500"]
 */
export function filterZeroValueClasses(classes: string[]): string[] {
  return classes.filter(cls => !isZeroValueClass(cls));
}

/**
 * Filters a class-to-DOM map, removing zero-value classes.
 * 
 * @param classToDOMMap - Map of class names to element names
 * @returns Filtered map without zero-value classes
 */
export function filterClassToDOMMap(
  classToDOMMap: { [className: string]: string[] }
): { [className: string]: string[] } {
  const filtered: { [className: string]: string[] } = {};
  
  for (const [className, elements] of Object.entries(classToDOMMap)) {
    if (!isZeroValueClass(className)) {
      filtered[className] = elements;
    }
  }
  
  return filtered;
}

// ============================================================================
// COMBINED FILTERS
// ============================================================================

/**
 * Filters an array of CSS properties, removing useless/zero-value properties.
 * 
 * @param properties - Array of CSS property strings
 * @returns Filtered array without useless properties
 */
export function filterUselessCSSProperties(properties: string[]): string[] {
  return properties.filter(prop => !isUselessCSSProperty(prop));
}

