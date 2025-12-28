import { ExtractedClass, ClassCategory } from "../types";

/**
 * Class category configuration with label and patterns
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
 * Returns false if the class is used in any variant
 */
export function canAddToBase(cls: ExtractedClass): boolean {
  return !cls.isUsedInVariant;
}

/**
 * Filter classes by search term
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
 */
export function parseClassString(classString: string): string[] {
  return classString
    .split(/\s+/)
    .map(cls => cls.trim())
    .filter(cls => cls.length > 0);
}

/**
 * Join classes into a string
 */
export function joinClasses(classes: string[]): string {
  return classes.join(" ");
}

