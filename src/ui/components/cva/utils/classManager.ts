import { ExtractedClass, ClassCategory } from "../types";

/**
 * Class Manager Utilities
 * 
 * Provides utility functions for categorizing, grouping, filtering, and managing
 * CSS classes in the CVA tool. Used throughout the CVA tool UI for organizing
 * classes by purpose and providing helpful selection interfaces.
 * 
 * KEY FEATURES:
 * - Pattern-based class categorization (fill, stroke, typography, spacing, etc.)
 * - Grouping classes by category for UI display
 * - Counting selected vs. total classes
 * - Filtering classes by search terms
 * - Sorting classes alphabetically within categories
 * - Validating if classes can be added to base classes
 */

/**
 * Class category configuration with label and patterns
 * 
 * Each category defines:
 * - label: Human-readable name for UI display
 * - patterns: Array of RegExp patterns that match classes in this category
 * 
 * Categories are tested in order, first match wins. "other" category is the
 * fallback for classes that don't match any pattern.
 * 
 * EXTENDING CATEGORIES:
 * To add a new category:
 * 1. Add the category type to ClassCategory in types.ts
 * 2. Add an entry here with label and patterns
 * 3. Update useCVAState.ts categorizeClass() if needed
 */
export const CLASS_CATEGORIES: Record<ClassCategory, { label: string; patterns: RegExp[] }> = {
  fill: {
    label: "Fill / Background",
    patterns: [/^bg-/, /^fill-/, /^background/],
  },
  stroke: {
    label: "Stroke / Border",
    patterns: [/^border-(?!radius)/, /^stroke-/, /^outline-/, /^ring-/],
  },
  "border-radius": {
    label: "Border Radius",
    patterns: [/^rounded/, /^border-radius/],
  },
  typography: {
    label: "Typography",
    patterns: [
      /^text-/,
      /^font-/,
      /^leading-/,
      /^tracking-/,
      /^(uppercase|lowercase|capitalize|normal-case)/,
      /^(italic|not-italic)/,
      /^(underline|overline|line-through|no-underline)/,
      /^truncate/,
      /^whitespace-/,
      /^break-/,
    ],
  },
  spacing: {
    label: "Spacing",
    patterns: [
      /^p-/,
      /^px-/,
      /^py-/,
      /^pt-/,
      /^pr-/,
      /^pb-/,
      /^pl-/,
      /^m-/,
      /^mx-/,
      /^my-/,
      /^mt-/,
      /^mr-/,
      /^mb-/,
      /^ml-/,
      /^gap-/,
      /^space-/,
    ],
  },
  layout: {
    label: "Layout",
    patterns: [
      /^flex/,
      /^grid/,
      /^block/,
      /^inline/,
      /^hidden/,
      /^w-/,
      /^h-/,
      /^min-/,
      /^max-/,
      /^overflow/,
      /^(relative|absolute|fixed|sticky|static)/,
      /^z-/,
      /^(top|right|bottom|left|inset)-/,
      /^items-/,
      /^justify-/,
      /^self-/,
      /^place-/,
      /^order-/,
      /^grow/,
      /^shrink/,
      /^basis-/,
      /^col-/,
      /^row-/,
    ],
  },
  effects: {
    label: "Effects",
    patterns: [
      /^shadow/,
      /^opacity-/,
      /^blur/,
      /^backdrop-/,
      /^transition/,
      /^duration-/,
      /^ease-/,
      /^animate-/,
      /^transform/,
      /^scale-/,
      /^rotate-/,
      /^translate-/,
      /^skew-/,
      /^origin-/,
      /^cursor-/,
      /^pointer-events-/,
      /^select-/,
    ],
  },
  other: {
    label: "Other",
    patterns: [],
  },
};

/**
 * Get the category for a class name
 * 
 * Tests the class name against all category patterns and returns the first match.
 * If no patterns match, returns "other" category.
 * 
 * PROCESS:
 * 1. Convert class name to lowercase for case-insensitive matching
 * 2. Iterate through all categories (except "other")
 * 3. Test class against each pattern in the category
 * 4. Return first matching category
 * 5. If no match, return "other"
 * 
 * EXAMPLES:
 * - "bg-blue-500" → "fill"
 * - "text-lg" → "typography"
 * - "p-4" → "spacing"
 * - "flex" → "layout"
 * - "custom-class" → "other"
 * 
 * @param className - CSS class name to categorize
 * @returns The category that best matches this class
 */
export function getClassCategory(className: string): ClassCategory {
  const lowerClass = className.toLowerCase();

  for (const [category, config] of Object.entries(CLASS_CATEGORIES)) {
    if (category === "other") continue;
    
    for (const pattern of config.patterns) {
      if (pattern.test(lowerClass)) {
        return category as ClassCategory;
      }
    }
  }

  return "other";
}

/**
 * Group classes by category
 * 
 * Organizes an array of extracted classes into a Map grouped by category.
 * Used for rendering categorized class lists in the UI (e.g., in BaseClassesConfig).
 * 
 * PROCESS:
 * 1. Initialize empty arrays for all categories
 * 2. Group classes by their category property
 * 3. Remove empty categories (except "other" which may be empty)
 * 4. Return Map with category → classes[] mappings
 * 
 * USAGE:
 * ```tsx
 * const grouped = groupClassesByCategory(extractedClasses);
 * for (const [category, classes] of grouped.entries()) {
 *   renderCategorySection(category, classes);
 * }
 * ```
 * 
 * @param classes - Array of extracted classes with category metadata
 * @returns Map with categories as keys and class arrays as values
 */
export function groupClassesByCategory(
  classes: ExtractedClass[]
): Map<ClassCategory, ExtractedClass[]> {
  const grouped = new Map<ClassCategory, ExtractedClass[]>();

  // Initialize all categories
  for (const category of Object.keys(CLASS_CATEGORIES) as ClassCategory[]) {
    grouped.set(category, []);
  }

  // Group classes
  for (const cls of classes) {
    const category = cls.category;
    const existing = grouped.get(category) || [];
    existing.push(cls);
    grouped.set(category, existing);
  }

  // Remove empty categories (except "other" which might be empty)
  for (const [category, items] of grouped.entries()) {
    if (items.length === 0 && category !== "other") {
      grouped.delete(category);
    }
  }

  return grouped;
}

/**
 * Get count of selected classes in a category
 * 
 * Counts how many classes are selected for base classes, optionally filtering
 * by category. Only counts classes that are:
 * - Selected (isSelected = true)
 * - Not used in any variant (isUsedInVariant = false)
 * - In the specified category (if category parameter provided)
 * 
 * Used for displaying "5 / 10 selected" UI feedback.
 * 
 * @param classes - Array of extracted classes
 * @param category - Optional category filter; if omitted, counts all categories
 * @returns Number of selected classes matching the criteria
 */
export function getSelectedCount(
  classes: ExtractedClass[],
  category?: ClassCategory
): number {
  return classes.filter(
    cls =>
      cls.isSelected &&
      !cls.isUsedInVariant &&
      (!category || cls.category === category)
  ).length;
}

/**
 * Get total count of classes in a category
 * 
 * Counts total number of classes, optionally filtering by category.
 * Unlike getSelectedCount, this counts ALL classes regardless of selection
 * or variant usage status.
 * 
 * Used for displaying total counts in "5 / 10 selected" UI feedback.
 * 
 * @param classes - Array of extracted classes
 * @param category - Optional category filter; if omitted, counts all categories
 * @returns Total number of classes matching the criteria
 */
export function getTotalCount(
  classes: ExtractedClass[],
  category?: ClassCategory
): number {
  return classes.filter(
    cls => !category || cls.category === category
  ).length;
}

/**
 * Check if a class can be added to base classes
 * 
 * Determines if a class is eligible to be selected as a base class.
 * A class cannot be a base class if it's already used in any variant configuration,
 * as this would create conflicts (the same class applied both always and conditionally).
 * 
 * LOGIC:
 * - Returns true if class is NOT used in variants (eligible for base)
 * - Returns false if class IS used in variants (not eligible for base)
 * 
 * Used to disable checkboxes in the base classes UI for classes that are
 * already assigned to variants.
 * 
 * @param cls - Extracted class object with usage metadata
 * @returns true if class can be added to base classes, false if already used in variants
 */
export function canAddToBase(cls: ExtractedClass): boolean {
  return !cls.isUsedInVariant;
}

/**
 * Filter classes by search term
 * 
 * Performs case-insensitive substring search on class names.
 * Returns all classes if search term is empty.
 * 
 * EXAMPLES:
 * - searchTerm "bg-" matches: "bg-blue-500", "bg-red-600", "hover:bg-gray-100"
 * - searchTerm "hover" matches: "hover:bg-blue-500", "group-hover:text-white"
 * - searchTerm "" matches: all classes (no filter)
 * 
 * Used in search inputs throughout the CVA tool UI.
 * 
 * @param classes - Array of extracted classes to filter
 * @param searchTerm - Search string (case-insensitive)
 * @returns Filtered array of classes matching the search term
 */
export function filterClasses(
  classes: ExtractedClass[],
  searchTerm: string
): ExtractedClass[] {
  if (!searchTerm.trim()) {
    return classes;
  }

  const lowerSearch = searchTerm.toLowerCase();
  return classes.filter(cls =>
    cls.className.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Sort classes alphabetically within their category
 * 
 * Sorts classes using a two-level sort:
 * 1. Primary sort: By category order (fill, stroke, typography, etc.)
 * 2. Secondary sort: Alphabetically within each category
 * 
 * This ensures consistent ordering in UI lists, with related classes
 * grouped together and sorted predictably within groups.
 * 
 * SORT ORDER:
 * 1. fill (backgrounds)
 * 2. stroke (borders)
 * 3. border-radius
 * 4. typography
 * 5. spacing
 * 6. layout
 * 7. effects
 * 8. other
 * 
 * Within each category, classes are sorted alphabetically (a-z).
 * 
 * @param classes - Array of extracted classes to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortClasses(classes: ExtractedClass[]): ExtractedClass[] {
  return [...classes].sort((a, b) => {
    // First sort by category order
    const categoryOrder = Object.keys(CLASS_CATEGORIES) as ClassCategory[];
    const aIndex = categoryOrder.indexOf(a.category);
    const bIndex = categoryOrder.indexOf(b.category);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    // Then sort alphabetically within category
    return a.className.localeCompare(b.className);
  });
}

/**
 * Parse a class string into individual classes
 * 
 * Splits a space-separated class string into an array of individual class names.
 * Handles multiple spaces, trims whitespace, and filters out empty strings.
 * 
 * EXAMPLES:
 * - "p-4 bg-blue-500" → ["p-4", "bg-blue-500"]
 * - "flex  gap-2   items-center" → ["flex", "gap-2", "items-center"]
 * - "  single  " → ["single"]
 * - "" → []
 * 
 * Used when parsing user input or extracting classes from HTML.
 * 
 * @param classString - Space-separated class string
 * @returns Array of individual class names
 */
export function parseClassString(classString: string): string[] {
  return classString
    .split(/\s+/)
    .map(cls => cls.trim())
    .filter(cls => cls.length > 0);
}

/**
 * Join classes into a string
 * 
 * Combines an array of class names into a single space-separated string.
 * Inverse operation of parseClassString().
 * 
 * EXAMPLES:
 * - ["p-4", "bg-blue-500"] → "p-4 bg-blue-500"
 * - ["flex", "gap-2", "items-center"] → "flex gap-2 items-center"
 * - [] → ""
 * 
 * Used when converting class arrays back to strings for display or export.
 * 
 * @param classes - Array of class names
 * @returns Space-separated class string
 */
export function joinClasses(classes: string[]): string {
  return classes.join(" ");
}

