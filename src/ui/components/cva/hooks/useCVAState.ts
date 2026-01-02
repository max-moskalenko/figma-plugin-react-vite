import { useState, useCallback, useMemo } from "react";
import { MultiFormatExtractionResult } from "@common/networkSides";
import {
  CVAState,
  CVAActions,
  CVAMode,
  CVAConfig,
  ExtractedClass,
  ClassCategory,
  CVAVariantConfig,
  CVAVariantProperty,
  CVAPropertyValue,
  CVAPrefixedClasses,
  CompoundVariantRule,
  CompoundCondition,
} from "../types";

/**
 * CVA State Management Hook
 * 
 * This hook is the core state management system for the CVA Mapping Tool.
 * It handles all state, actions, and business logic for:
 * 
 * 1. CLASS EXTRACTION AND CATEGORIZATION:
 *    - Extracts CSS classes from Tailwind output
 *    - Categorizes classes by purpose (fill, typography, spacing, etc.)
 *    - Associates classes with DOM elements for filtering
 *    - Filters out Figma variant names (which aren't real CSS classes)
 * 
 * 2. PROPERTY DETECTION:
 *    - Parses property=value pairs from raw code snippets
 *    - Extracts properties from Figma's componentProperties API
 *    - Merges and normalizes boolean values (True/False → true/false)
 *    - Auto-creates variant configs from detected properties
 * 
 * 3. VARIANT CONFIGURATION:
 *    - Manages variant cards (add, remove, duplicate, rename)
 *    - Manages properties and values within variants
 *    - Handles prefix slots for interactive states (hover, active, etc.)
 *    - Tracks which classes are used in variants vs. base classes
 * 
 * 4. BASE CLASS SELECTION:
 *    - Toggle individual classes for base classes
 *    - Bulk select/deselect by category
 *    - Prevents classes used in variants from being base classes
 * 
 * 5. COMPOUND VARIANTS:
 *    - Create rules with multiple conditions
 *    - Assign classes to compound variant rules
 * 
 * 6. DEFAULT VARIANTS:
 *    - Set default values for variant properties
 * 
 * 7. CLASS MODAL:
 *    - Manages modal state for class selection
 *    - Tracks which prefix slot is being edited
 * 
 * STATE STRUCTURE:
 * - mode: "mapping" | "code" (current view mode)
 * - extractorResult: Data from DOM Extractor tool
 * - componentProperties: Figma properties and variants
 * - extractedClasses: All classes with metadata (category, DOM elements, usage)
 * - config: CVA configuration (base, variants, compound, defaults)
 * - classModalTarget: Currently open modal target
 * 
 * All actions are memoized with useCallback for performance.
 * Base classes are computed from extractedClasses selection state.
 */

/**
 * Generate a unique ID for variant configs, properties, values, etc.
 * 
 * Uses timestamp + random string to ensure uniqueness across:
 * - Variant configs
 * - Properties
 * - Property values
 * - Prefix slots
 * - Compound variant rules
 * - Compound conditions
 * 
 * @returns Unique ID string (e.g., "1704123456789-abc123def")
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Strip Figma internal ID suffixes from property/element names
 * 
 * Figma sometimes appends internal IDs to names in format "#nodeId:index"
 * Examples:
 * - "textLabel#1918:5" → "textLabel"
 * - "Button Icon#2280:0" → "Button Icon"
 * - "normalName" → "normalName" (unchanged)
 * 
 * @param name - Name that may contain Figma ID suffix
 * @returns Cleaned name without ID suffix
 */
function stripFigmaIdSuffix(name: string): string {
  // Remove #nodeId:index pattern from the end
  return name.replace(/#\d+:\d+$/, '').trim();
}

/**
 * Check if a class represents a zero/empty value that can be filtered
 * 
 * Zero-value classes don't add visual styling and often clutter the output.
 * Examples:
 * - "rounded-[0px]" → true (no rounding)
 * - "p-[0px_0px_0px_0px]" → true (no padding)
 * - "m-0" → true (no margin)
 * - "gap-0" → true (no gap)
 * - "p-4" → false (has padding)
 * 
 * @param className - Class name to check
 * @returns true if this is a zero-value class
 */
function isZeroValueClass(className: string): boolean {
  // Arbitrary zero values: rounded-[0px], p-[0px], m-[0px_0px_0px_0px], etc.
  if (/\[0(px)?(_0(px)?)*\]/.test(className)) return true;
  
  // Standard Tailwind zero values: m-0, p-0, gap-0, space-x-0, etc.
  if (/^(m|p|gap|space-[xy]|inset|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h)-0$/.test(className)) return true;
  
  // Rounded zero
  if (className === 'rounded-none' || className === 'rounded-[0]') return true;
  
  return false;
}

/**
 * Categorize a class name based on patterns
 * 
 * Determines which category a CSS class belongs to by testing against
 * various Tailwind utility class patterns. This is used to organize classes
 * in the UI for easier selection.
 * 
 * CATEGORIES:
 * - fill: Backgrounds and fill colors (bg-, fill-, background)
 * - stroke: Borders and outlines (border-, stroke-, outline-)
 * - border-radius: Border radius utilities (rounded, border-radius)
 * - typography: Text styling (text-, font-, leading-, tracking-, transforms, decorations)
 * - spacing: Padding, margin, gap (p-, m-, gap-, space-)
 * - layout: Display, positioning, sizing, flex/grid (flex, grid, w-, h-, position, alignment)
 * - effects: Shadows, opacity, blur, transitions, transforms
 * - other: Everything else that doesn't match a pattern
 * 
 * The function tests patterns in order. First match wins.
 * 
 * @param className - CSS class name to categorize
 * @returns ClassCategory enum value
 */
function categorizeClass(className: string): ClassCategory {
  const lowerClass = className.toLowerCase();
  
  // Fill/Background patterns
  if (/^(bg-|fill-|background)/.test(lowerClass)) {
    return "fill";
  }
  
  // Stroke/Border color patterns
  if (/^(border-|stroke-|outline-)/.test(lowerClass) && !/^(border-radius|rounded)/.test(lowerClass)) {
    return "stroke";
  }
  
  // Border radius patterns
  if (/^(rounded|border-radius)/.test(lowerClass)) {
    return "border-radius";
  }
  
  // Typography patterns
  if (/^(text-|font-|leading-|tracking-|uppercase|lowercase|capitalize|italic|underline|line-through|truncate)/.test(lowerClass)) {
    return "typography";
  }
  
  // Spacing patterns
  if (/^(p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|gap-|space-)/.test(lowerClass)) {
    return "spacing";
  }
  
  // Layout patterns
  if (/^(flex|grid|block|inline|hidden|w-|h-|min-|max-|overflow|relative|absolute|fixed|sticky|z-|top-|right-|bottom-|left-|items-|justify-|self-|place-|order-)/.test(lowerClass)) {
    return "layout";
  }
  
  // Effects patterns
  if (/^(shadow|opacity|blur|backdrop|ring|transition|animate|transform|scale|rotate|translate|skew)/.test(lowerClass)) {
    return "effects";
  }
  
  return "other";
}

/**
 * Check if a class name is actually a Figma variant name (should be excluded)
 * 
 * Figma generates variant names by concatenating all property-value pairs with hyphens.
 * These look like CSS classes but aren't - they're just identifiers.
 * 
 * EXAMPLE VARIANT NAMES:
 * - "vis-height-h-28-vis-iconbutton-false-interaction-hover-vis-sentiment-brand"
 * - "size-small-variant-primary-disabled-true"
 * 
 * DETECTION ALGORITHM:
 * 1. Must be at least 20 characters (variant combos are long)
 * 2. Must have at least 5 hyphen-separated segments
 * 3. Must match 2+ of these patterns:
 *    - Starts with "vis-"
 *    - Contains "-vis-"
 *    - Contains boolean values: "-(true|false)-" or ends with "-(true|false)"
 *    - Contains "-interaction-"
 *    - Contains "-disabled-"
 *    - Contains "-sentiment-"
 * 
 * WHY FILTER THESE OUT:
 * Variant names appear in className attributes when extracting component sets,
 * but they're not actual CSS classes and shouldn't be selectable in the CVA tool.
 * 
 * @param className - Potential class name to check
 * @returns true if this looks like a Figma variant name, false if it's a real CSS class
 */
function isFigmaVariantName(className: string): boolean {
  // Variant names are typically long and contain multiple property-value patterns
  // Common patterns: vis-property-value, interaction-state, disabled-bool
  
  // Must be reasonably long to be a variant combo
  if (className.length < 15) return false;
  
  // Count how many property-like segments exist
  const segments = className.split('-');
  if (segments.length < 4) return false;
  
  // Check for common Figma variant patterns (start, middle, or end positions)
  const variantPatterns = [
    /^vis-/,                      // starts with vis-
    /-vis-/,                      // contains -vis-
    /-(true|false)(-|$)/,         // contains boolean values
    /^(true|false)-/,             // starts with boolean
    /-interaction(-|$)/,          // interaction state (start, middle, end)
    /^interaction-/,              // starts with interaction
    /-disabled(-|$)/,             // disabled state
    /^disabled-/,                 // starts with disabled
    /-sentiment(-|$)/,            // sentiment property
    /^sentiment-/,                // starts with sentiment
    /-height-h-\d+/,              // height value pattern
    /-state(-|$)/,                // state property
    /^state-/,                    // starts with state
    /-default(-|$)/,              // default state
    /-hover(-|$)/,                // hover state
    /-pressed(-|$)/,              // pressed state
    /-active(-|$)/,               // active state
  ];
  
  let matchCount = 0;
  for (const pattern of variantPatterns) {
    if (pattern.test(className)) {
      matchCount++;
    }
  }
  
  // If it matches multiple patterns, it's likely a variant name
  return matchCount >= 2;
}

/**
 * Check if a class is likely a DOM element name (not a utility class)
 * 
 * Distinguishes between semantic element names (like "slider-root", "Label.Root")
 * and Tailwind utility classes (like "flex", "p-4").
 * 
 * ELEMENT NAME PATTERNS:
 * - Contains dots (e.g., "Label.Root", "Button.Icon")
 * - Starts with uppercase (e.g., "ComponentName")
 * - Common HTML element names (e.g., "div", "span", "button")
 * - Hyphenated lowercase names (e.g., "slider-root", "label-div")
 * 
 * UTILITY CLASS PATTERNS (excluded):
 * - Starts with common Tailwind prefixes (flex, grid, w-, h-, p-, m-, bg-, text-, etc.)
 * 
 * This is used to identify element names in className attributes, which are
 * then associated with CSS classes for filtering in the class selection modal.
 * 
 * @param className - Class name to check
 * @returns true if it looks like an element name, false if it looks like a utility class
 */
function isElementName(className: string): boolean {
  // Element names: slider-root, Label.Root, div, label-div
  const looksLikeElement = /^[a-zA-Z][\w.-]*$/.test(className) && 
    (className.includes('.') || // Label.Root
     /^[A-Z]/.test(className) || // Component names
     ['div', 'span', 'p', 'button', 'input', 'label'].includes(className.toLowerCase()) ||
     // Common element naming patterns like slider-root, label-div
     /^[a-z]+-[a-z]+$/.test(className) ||
     /^[a-z]+-[a-z]+-[a-z]+$/.test(className));
  
  // Exclude common utility class patterns
  const isUtilityClass = /^(flex|grid|w-|h-|p-|m-|bg-|text-|border-|rounded|gap-|items-|justify-|relative|absolute|font-|overflow|cursor|transition|shadow|ring)/.test(className);
  
  return looksLikeElement && !isUtilityClass;
}

interface ClassWithDOMElements {
  className: string;
  domElements: string[];
}

/**
 * Normalize element name to match Tailwind format
 * Same logic as ClassSelectionModal: lowercase kebab-case
 */
function normalizeElementName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
}

/**
 * Extract classes from Tailwind stylesheet with DOM element associations
 * 
 * Parses RAW JSON to build a map of normalized element names, then associates
 * Tailwind classes with their actual DOM elements (not generic "variant"/"root" labels).
 * 
 * EXTRACTION PROCESS:
 * 1. Parse RAW JSON to get actual DOM element names
 * 2. Build a map of normalized names (matching Tailwind's first-class convention)
 * 3. Parse Tailwind HTML to extract classes
 * 4. Match each element (first class) to its normalized name from RAW
 * 5. Associate utility classes with their actual element names
 * 
 * ELEMENT IDENTIFICATION:
 * - First class in className → normalized element name from RAW JSON
 * - Matches against actual element names (not generic labels)
 * 
 * RESULT:
 * Each class is mapped to actual element names from the DOM structure.
 * Example: "p-4" might appear on ["button-slot-left", "leftslotwithlabel"]
 * 
 * @param tailwindSheet - HTML+classes string from Tailwind generator
 * @param rawSheet - JSON string from RAW extractor
 * @returns Array of {className, domElements[]} objects
 */
function extractClassesWithDOMElements(tailwindSheet: string, rawSheet: string): ClassWithDOMElements[] {
  const classMap = new Map<string, Set<string>>(); // className -> Set of domElements
  
  // Step 1: Parse RAW JSON to build element name map
  const elementNameMap = new Map<string, string>(); // normalized -> original name
  
  try {
    const rawNodes = JSON.parse(rawSheet);
    
    // Helper: recursively collect element names from RAW structure
    const collectElementNames = (node: any, depth: number = 0): void => {
      if (!node || !node.name) return;
      
      // Skip top-level containers
      const shouldInclude = node.type !== "COMPONENT_SET" && !(node.type === "COMPONENT" && depth === 0);
      
      if (shouldInclude) {
        const normalized = normalizeElementName(node.name);
        if (normalized && !elementNameMap.has(normalized)) {
          elementNameMap.set(normalized, node.name);
        }
      }
      
      // Recurse into children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          collectElementNames(child, depth + 1);
        });
      }
    };
    
    // Process all root nodes
    if (Array.isArray(rawNodes)) {
      rawNodes.forEach(node => collectElementNames(node, 0));
    }
  } catch (e) {
    console.warn("Failed to parse RAW JSON for element names:", e);
  }
  
  // Step 2: Parse Tailwind HTML and map classes to elements
  // Updated regex to also capture the tag name (for icon components like <Acorn />)
  const classNameRegex = /<(\w+)\s+(?:className|class)="([^"]+)"/g;
  let match;
  
  while ((match = classNameRegex.exec(tailwindSheet)) !== null) {
    const tagName = match[1]; // e.g., "div", "Acorn", "p"
    const classString = match[2];
    const allClasses = classString.split(/\s+/).filter(c => c.trim());
    
    if (allClasses.length === 0) continue;
    
    // Check if this is a React component (PascalCase tag = icon component)
    const isReactComponent = /^[A-Z]/.test(tagName);
    
    let elementName: string;
    let styleClasses: string[];
    
    if (isReactComponent) {
      // For icon components like <Acorn />, the tag name IS the element identifier
      // All classes are style classes (we removed the element name class earlier)
      elementName = tagName.toLowerCase(); // "Acorn" → "acorn"
      styleClasses = allClasses;
    } else {
      // For regular HTML elements, first class is the element identifier
      const firstClass = allClasses[0];
      styleClasses = allClasses.slice(1);
      
      // Determine the actual element name from our map
      elementName = elementNameMap.get(firstClass) || firstClass;
      
      // If first class is a Figma variant name, use its normalized form as element
      if (isFigmaVariantName(firstClass)) {
        elementName = firstClass; // Use the variant wrapper name itself
      } else if (elementNameMap.has(firstClass)) {
        // Use the normalized name for matching (keep it lowercase kebab-case)
        elementName = firstClass;
      }
      
      // Also add first class if it's a utility class (not an element identifier)
      if (!isElementName(firstClass) && !isFigmaVariantName(firstClass)) {
        if (!classMap.has(firstClass)) {
          classMap.set(firstClass, new Set());
        }
        classMap.get(firstClass)!.add(elementName);
      }
    }
    
    // Map style classes to this element
    styleClasses.forEach(cls => {
      const trimmed = cls.trim();
      if (trimmed && !isFigmaVariantName(trimmed)) {
        if (!classMap.has(trimmed)) {
          classMap.set(trimmed, new Set());
        }
        classMap.get(trimmed)!.add(elementName);
      }
    });
  }
  
  // Convert to array
  return Array.from(classMap.entries()).map(([className, elements]) => ({
    className,
    domElements: Array.from(elements).sort(),
  }));
}

/**
 * Extract DOM element names from the stylesheet
 * 
 * Extracts unique DOM element names from data-name attributes in the HTML.
 * These names come from Figma layer names and are used for filtering classes
 * by element in the class selection modal.
 * 
 * EXAMPLE:
 * ```html
 * <div data-name="Button Root">...</div>
 * <p data-name="Label">...</p>
 * ```
 * → Returns: ["Button Root", "Label"]
 * 
 * @param stylesheet - HTML string from extractor
 * @returns Array of unique element names
 */
function extractDOMElements(stylesheet: string): string[] {
  const elements: Set<string> = new Set();
  
  // Match data-name="..." attributes
  const dataNameRegex = /data-name="([^"]+)"/g;
  let match;
  
  while ((match = dataNameRegex.exec(stylesheet)) !== null) {
    // Strip Figma ID suffixes from element names
    elements.add(stripFigmaIdSuffix(match[1]));
  }
  
  return Array.from(elements);
}

/**
 * Extract property-value pairs from code snippet
 * 
 * Parses the raw output to find property=value patterns, which represent
 * Figma component properties and their values. These are used to auto-create
 * variant configs.
 * 
 * PATTERN MATCHING:
 * Looks for: property=value
 * - Property name must start with letter, can contain letters, numbers, hyphens
 * - Value continues until comma, space, or special character
 * 
 * EXAMPLES:
 * - "vis-height=h-28" → property: "vis-height", value: "h-28"
 * - "interaction=Default" → property: "interaction", value: "Default"
 * - "disabled=False" → property: "disabled", values: ["true", "false"] (both added)
 * 
 * BOOLEAN HANDLING:
 * When a boolean value (True/False, true/false) is detected, BOTH "true" and "false"
 * are added to the value set. This ensures the variant has both options even if
 * only one is present in the current component variant.
 * 
 * FILTERING:
 * Skips properties starting with "data-", "class", or "className" as these
 * aren't variant properties.
 * 
 * @param rawStylesheet - Raw JSON/HTML string from extractor
 * @returns Map of property name → Set of values
 */
function extractPropertiesFromSnippet(rawStylesheet: string): Map<string, Set<string>> {
  const properties = new Map<string, Set<string>>();
  
  // Pattern for property=value pairs
  const propValueRegex = /([a-zA-Z][\w-]*)=([^,\s"<>]+)/g;
  let match;
  
  while ((match = propValueRegex.exec(rawStylesheet)) !== null) {
    let propName = match[1];
    const propValue = match[2];
    
    // Skip certain prefixes that aren't variant properties
    if (propName.startsWith('data-') || propName === 'class' || propName === 'className') {
      continue;
    }
    
    // Strip Figma ID suffixes from property names
    propName = stripFigmaIdSuffix(propName);
    
    if (!properties.has(propName)) {
      properties.set(propName, new Set());
    }
    
    // Check if it's a boolean value - if so, add both true and false
    const lowerValue = propValue.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'false') {
      properties.get(propName)!.add('true');
      properties.get(propName)!.add('false');
    } else {
      properties.get(propName)!.add(propValue);
    }
  }
  
  return properties;
}

/**
 * Extract DOM element names from the raw JSON output
 * 
 * Alternative method for extracting element names, used as fallback or
 * in addition to extractDOMElements(). Parses "name" fields from the
 * raw JSON structure.
 * 
 * FILTERING:
 * - Skips names containing "=" (these are variant combinations, not element names)
 * - Skips names longer than 50 characters (likely not real element names)
 * 
 * @param rawStylesheet - Raw JSON string from extractor
 * @returns Array of unique element names
 */
function extractDOMElementsFromRaw(rawStylesheet: string): string[] {
  const elements = new Set<string>();
  
  // Pattern for "name": "element-name" in JSON
  const nameRegex = /"name":\s*"([^"]+)"/g;
  let match;
  
  while ((match = nameRegex.exec(rawStylesheet)) !== null) {
    const name = match[1];
    // Skip names that look like variant combinations (contain =)
    if (!name.includes('=') && name.length < 50) {
      // Strip Figma ID suffixes from element names
      elements.add(stripFigmaIdSuffix(name));
    }
  }
  
  return Array.from(elements);
}

/**
 * Check if a property name suggests it should have prefix mode enabled
 * 
 * Some properties (like "interaction", "state") typically have values that
 * correspond to pseudo-class states (hover, active, focus, etc.). For these
 * properties, prefix mode is useful for organizing classes by state.
 * 
 * Currently not used in the codebase, but kept for potential future
 * auto-detection features.
 * 
 * @param propName - Property name to check
 * @returns true if this property should default to prefix mode
 */
function shouldHavePrefixes(propName: string): boolean {
  const interactiveProps = ['interaction', 'state'];
  return interactiveProps.some(p => propName.toLowerCase() === p);
}

/**
 * Get suggested prefix for a value name
 * 
 * Returns a suggested Tailwind prefix based on the value name.
 * Used for auto-suggesting prefixes when a value name matches
 * a common interaction state.
 * 
 * Currently not used in the codebase, but kept for potential future
 * auto-suggestion features.
 * 
 * MAPPINGS:
 * - "hover" → "hover:"
 * - "active"/"pressed" → "active:"
 * - "focus"/"focused" → "focus:"
 * - "disabled" → "disabled:"
 * - default → "" (no prefix)
 * 
 * @param valueName - Property value name (e.g., "hover", "active")
 * @returns Suggested Tailwind prefix (e.g., "hover:", "active:")
 */
function getSuggestedPrefix(valueName: string): string {
  const lower = valueName.toLowerCase();
  if (lower === 'hover') return 'hover:';
  if (lower === 'active' || lower === 'pressed') return 'active:';
  if (lower === 'focus' || lower === 'focused') return 'focus:';
  if (lower === 'disabled') return 'disabled:';
  return ''; // Default/normal state has no prefix
}

/**
 * Create a default prefixed classes entry (base state with no prefix)
 * 
 * Creates an empty prefix slot with:
 * - Unique ID
 * - Empty prefix (base/default state)
 * - Empty classes array
 * 
 * This is used when creating new property values. Each value starts
 * with one empty prefix slot that the user can populate with classes.
 * 
 * @returns New CVAPrefixedClasses object with empty values
 */
function createDefaultPrefixedClasses(): CVAPrefixedClasses {
  return {
    id: generateId(),
    prefix: '',
    classes: [],
  };
}

/**
 * Create variant configs from extracted properties
 * 
 * Auto-generates variant card configurations from the detected property-value
 * pairs. This provides a starting point for users to map classes to variants.
 * 
 * PROCESS:
 * 1. For each property name, create a variant config
 * 2. Create a single property within the variant (name matches variant name)
 * 3. For each value, create a property value with one empty prefix slot
 * 4. Sort values alphabetically
 * 5. Set showPrefixes to false (hidden by default)
 * 
 * STRUCTURE:
 * Each variant config has:
 * - Unique ID
 * - Property name as variant name
 * - One property with matching name
 * - Array of values (each with empty prefix slot)
 * - Empty DOM mappings array
 * 
 * This structure is then displayed as variant cards in the mapping UI,
 * where users can add classes to each value.
 * 
 * @param properties - Map of property name → Set of values
 * @returns Array of CVAVariantConfig objects ready for display
 */
function createVariantsFromProperties(properties: Map<string, Set<string>>): CVAVariantConfig[] {
  const variants: CVAVariantConfig[] = [];
  
  properties.forEach((values, propName) => {
    const variant: CVAVariantConfig = {
      id: generateId(),
      name: propName,
      showPrefixes: false, // Prefix column hidden by default
      properties: [{
        id: generateId(),
        name: propName,
        values: Array.from(values).sort().map(value => ({
          id: generateId(),
          name: value,
          prefixedClasses: [createDefaultPrefixedClasses()],
        })),
      }],
      domMappings: [],
    };
    variants.push(variant);
  });
  
  return variants;
}

/**
 * Create initial CVA config
 * 
 * Creates an empty CVA configuration structure with default values.
 * Used when initializing state or resetting configuration.
 * 
 * @returns Empty CVAConfig object
 */
function createInitialConfig(): CVAConfig {
  return {
    componentName: "Component",
    baseClasses: [],
    variants: [],
    compoundVariants: [],
    defaultVariants: {},
  };
}

/**
 * Create initial CVA state
 * 
 * Creates the initial state for the CVA tool with:
 * - Mode set to "mapping"
 * - Null extractor result and component properties
 * - Empty extracted classes array
 * - Empty initial config
 * - Class modal closed
 * 
 * @returns Initial CVAState object
 */
function createInitialState(): CVAState {
  return {
    mode: "mapping",
    extractorResult: null,
    componentProperties: null,
    extractedClasses: [],
    config: createInitialConfig(),
    isClassModalOpen: false,
    classModalTarget: null,
  };
}

/**
 * Hook for managing CVA tool state
 * 
 * Main state management hook for the CVA tool. Returns both state and actions
 * for managing all aspects of CVA configuration.
 * 
 * STATE:
 * - mode: Current view mode (mapping or code)
 * - extractorResult: Data from extractor tool
 * - componentProperties: Figma component properties
 * - extractedClasses: All CSS classes with metadata
 * - config: CVA configuration (base, variants, compound, defaults)
 * - classModalTarget: Currently editing target
 * 
 * ACTIONS:
 * - Mode: setMode
 * - Data: setExtractorResult
 * - Base classes: toggleBaseClass, selectAllBaseClasses, deselectAllBaseClasses
 * - Variants: addVariant, removeVariant, duplicateVariant, renameVariant, toggleVariantPrefixes
 * - Properties: addProperty, removeProperty, renameProperty, setPropertyValues
 * - Values: addPropertyValue, removePropertyValue, renamePropertyValue
 * - Prefix slots: addPrefixSlot, removePrefixSlot, setPrefixSlotPrefix, setPrefixSlotClasses
 * - Compound: addCompoundVariant, removeCompoundVariant, addCompoundCondition, etc.
 * - Defaults: setDefaultVariant, removeDefaultVariant
 * - Modal: openClassModal, closeClassModal
 * - Config: setComponentName, resetConfig
 * 
 * All actions are memoized with useCallback for optimal performance.
 * 
 * @returns Combined state and actions object
 */
export function useCVAState(): CVAState & CVAActions {
  const [state, setState] = useState<CVAState>(createInitialState);

  // Mode
  const setMode = useCallback((mode: CVAMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  // Extractor data
  const setExtractorResult = useCallback((result: MultiFormatExtractionResult | null) => {
    setState(prev => {
      if (!result) {
        return {
          ...prev,
          extractorResult: null,
          componentProperties: null,
          extractedClasses: [],
        };
      }

      // Use pre-built classToDOMMap from plugin (single source of truth)
      // This is generated using the same logic as the Tailwind output
      let extractedClasses: ExtractedClass[];
      
      // Helper to check if a class is a zero-value class (like rounded-[0px], p-[0px])
      const isZeroValueClass = (className: string): boolean => {
        // Match patterns like: rounded-[0px], p-[0px_0px_0px_0px], m-[0px], etc.
        return /^[\w-]+\[0(px)?(_0(px)?)*\]$/.test(className);
      };
      
      if (result.classToDOMMap && Object.keys(result.classToDOMMap).length > 0) {
        // New approach: Use the pre-built mapping from the plugin
        // Filter out zero-value classes to match the stylesheet filtering
        extractedClasses = Object.entries(result.classToDOMMap)
          .filter(([className]) => !isZeroValueClass(className))
          .map(([className, domElements], index) => ({
            id: `class-${index}-${className}`,
            className,
            category: categorizeClass(className),
            domElements,
            isSelected: true,
            isUsedInVariant: false,
          }));
      } else {
        // Fallback: Parse HTML (for backwards compatibility)
        const classesWithDOM = extractClassesWithDOMElements(
          result.tailwind.stylesheet,
          result.raw?.stylesheet || "[]"
        );
        
        extractedClasses = classesWithDOM.map((item, index) => ({
          id: `class-${index}-${item.className}`,
          className: item.className,
          category: categorizeClass(item.className),
          domElements: item.domElements,
          isSelected: true,
          isUsedInVariant: false,
        }));
      }

      // Extract properties from raw code snippet
      const snippetProperties = extractPropertiesFromSnippet(result.raw?.stylesheet || "");
      
      // Also merge properties from componentProperties (works better for instances)
      const componentProps = result.componentProperties;
      if (componentProps?.definitions) {
        for (const def of componentProps.definitions) {
          // Strip Figma ID suffixes from property names
          const propName = stripFigmaIdSuffix(def.name);
          
          // Only add if not already extracted from snippet
          if (!snippetProperties.has(propName)) {
            const values = new Set<string>();
            
            // Add variant options if available
            if (def.variantOptions) {
              def.variantOptions.forEach(v => {
                const lower = v.toLowerCase();
                if (lower === 'true' || lower === 'false') {
                  values.add('true');
                  values.add('false');
                } else {
                  values.add(v);
                }
              });
            }
            // For boolean type, add true/false
            else if (def.type === 'BOOLEAN') {
              values.add('true');
              values.add('false');
            }
            // Use default value if no options
            else if (def.defaultValue !== undefined) {
              values.add(String(def.defaultValue));
            }
            
            if (values.size > 0) {
              snippetProperties.set(propName, values);
            }
          } else {
            // Merge variant options into existing property
            if (def.variantOptions) {
              const existing = snippetProperties.get(propName)!;
              def.variantOptions.forEach(v => {
                const lower = v.toLowerCase();
                if (lower === 'true' || lower === 'false') {
                  existing.add('true');
                  existing.add('false');
                } else {
                  existing.add(v);
                }
              });
            }
          }
        }
      }
      
      const autoVariants = createVariantsFromProperties(snippetProperties);

      return {
        ...prev,
        extractorResult: result,
        componentProperties: result.componentProperties || null,
        extractedClasses,
        config: {
          ...prev.config,
          componentName: result.componentName || "Component",
          // Always recreate variants from new extraction
          variants: autoVariants,
          // Reset compound and default variants on new extraction
          compoundVariants: [],
          defaultVariants: {},
        },
      };
    });
  }, []);

  // Base classes
  const toggleBaseClass = useCallback((classId: string) => {
    setState(prev => ({
      ...prev,
      extractedClasses: prev.extractedClasses.map(cls =>
        cls.id === classId && !cls.isUsedInVariant
          ? { ...cls, isSelected: !cls.isSelected }
          : cls
      ),
    }));
  }, []);

  const selectAllBaseClasses = useCallback((category?: ClassCategory) => {
    setState(prev => ({
      ...prev,
      extractedClasses: prev.extractedClasses.map(cls =>
        (!category || cls.category === category) && !cls.isUsedInVariant
          ? { ...cls, isSelected: true }
          : cls
      ),
    }));
  }, []);

  const deselectAllBaseClasses = useCallback((category?: ClassCategory) => {
    setState(prev => ({
      ...prev,
      extractedClasses: prev.extractedClasses.map(cls =>
        (!category || cls.category === category)
          ? { ...cls, isSelected: false }
          : cls
      ),
    }));
  }, []);

  // Helper to create empty variant
  const createEmptyVariant = useCallback((): CVAVariantConfig => ({
    id: generateId(),
    name: "variant",
    showPrefixes: false,
    properties: [{
      id: generateId(),
      name: "value",
      values: [{
        id: generateId(),
        name: "default",
        prefixedClasses: [createDefaultPrefixedClasses()],
      }],
    }],
    domMappings: [],
  }), []);

  // Variants
  const addVariant = useCallback(() => {
    setState(prev => {
      const newVariant = createEmptyVariant();
      return {
        ...prev,
        config: {
          ...prev.config,
          variants: [...prev.config.variants, newVariant],
        },
      };
    });
  }, [createEmptyVariant]);

  const removeVariant = useCallback((variantId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.filter(v => v.id !== variantId),
      },
    }));
  }, []);

  const duplicateVariant = useCallback((variantId: string) => {
    setState(prev => {
      const variantToDuplicate = prev.config.variants.find(v => v.id === variantId);
      if (!variantToDuplicate) return prev;

      const newVariant: CVAVariantConfig = {
        ...JSON.parse(JSON.stringify(variantToDuplicate)),
        id: generateId(),
        name: `${variantToDuplicate.name} (copy)`,
      };

      // Regenerate IDs for nested objects
      newVariant.properties = newVariant.properties.map(prop => ({
        ...prop,
        id: generateId(),
        values: prop.values.map(val => ({ ...val, id: generateId() })),
      }));

      return {
        ...prev,
        config: {
          ...prev.config,
          variants: [...prev.config.variants, newVariant],
        },
      };
    });
  }, []);

  const renameVariant = useCallback((variantId: string, name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId 
            ? { 
                ...v, 
                name,
                // Also update the first property name to match (they should stay in sync)
                properties: v.properties.map((prop, idx) => 
                  idx === 0 ? { ...prop, name } : prop
                )
              } 
            : v
        ),
      },
    }));
  }, []);

  const toggleVariantPrefixes = useCallback((variantId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? { ...v, showPrefixes: !v.showPrefixes }
            : v
        ),
      },
    }));
  }, []);

  // Variant properties
  const addProperty = useCallback((variantId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: [
                  ...v.properties,
                  {
                    id: generateId(),
                    name: "property",
                    values: [{ 
                      id: generateId(), 
                      name: "default", 
                      prefixedClasses: [createDefaultPrefixedClasses()] 
                    }],
                  },
                ],
              }
            : v
        ),
      },
    }));
  }, []);

  const removeProperty = useCallback((variantId: string, propertyId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? { ...v, properties: v.properties.filter(p => p.id !== propertyId) }
            : v
        ),
      },
    }));
  }, []);

  const renameProperty = useCallback((variantId: string, propertyId: string, name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId ? { ...p, name } : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  // Set all values for a property (when switching property name)
  const setPropertyValues = useCallback((variantId: string, propertyId: string, valueNames: string[]) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: valueNames.map(name => ({
                          id: generateId(),
                          name,
                          prefixedClasses: [createDefaultPrefixedClasses()],
                        })),
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  // Property values
  const addPropertyValue = useCallback((variantId: string, propertyId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: [
                          ...p.values,
                          { 
                            id: generateId(), 
                            name: "value", 
                            prefixedClasses: [createDefaultPrefixedClasses()] 
                          },
                        ],
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  const removePropertyValue = useCallback((variantId: string, propertyId: string, valueId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? { ...p, values: p.values.filter(val => val.id !== valueId) }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  const duplicatePropertyValue = useCallback((variantId: string, propertyId: string, valueId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: (() => {
                          const originalValue = p.values.find(val => val.id === valueId);
                          if (!originalValue) return p.values;
                          
                          // Create deep copy of the value with all its prefixed classes
                          const duplicatedValue: CVAPropertyValue = {
                            id: generateId(), // New unique ID
                            name: `${originalValue.name} copy`, // Append "copy" to name
                            prefixedClasses: originalValue.prefixedClasses.map(pc => ({
                              id: generateId(), // New unique ID for each prefix slot
                              prefix: pc.prefix, // Keep same prefix
                              classes: [...pc.classes], // Deep copy of classes array
                            })),
                          };
                          
                          // Insert duplicated value right after the original
                          const originalIndex = p.values.findIndex(val => val.id === valueId);
                          const newValues = [...p.values];
                          newValues.splice(originalIndex + 1, 0, duplicatedValue);
                          return newValues;
                        })(),
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  const renamePropertyValue = useCallback((variantId: string, propertyId: string, valueId: string, name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        variants: prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: p.values.map(val =>
                          val.id === valueId ? { ...val, name } : val
                        ),
                      }
                    : p
                ),
              }
            : v
        ),
      },
    }));
  }, []);

  // Helper to collect all used classes from variants
  const collectUsedClasses = useCallback((variants: CVAVariantConfig[]): Set<string> => {
    const usedClasses = new Set<string>();
    variants.forEach(v => {
      v.properties.forEach(p => {
        p.values.forEach(val => {
          val.prefixedClasses.forEach(pc => {
            pc.classes.forEach(cls => usedClasses.add(cls));
          });
        });
      });
    });
    return usedClasses;
  }, []);

  // Add a new prefix slot to a value
  const addPrefixSlot = useCallback((variantId: string, propertyId: string, valueId: string) => {
    setState(prev => {
      const newVariants = prev.config.variants.map(v =>
        v.id === variantId
          ? {
              ...v,
              properties: v.properties.map(p =>
                p.id === propertyId
                  ? {
                      ...p,
                      values: p.values.map(val =>
                        val.id === valueId
                          ? {
                              ...val,
                              prefixedClasses: [
                                ...val.prefixedClasses,
                                createDefaultPrefixedClasses(),
                              ],
                            }
                          : val
                      ),
                    }
                  : p
              ),
            }
          : v
      );

      return {
        ...prev,
        config: {
          ...prev.config,
          variants: newVariants,
        },
      };
    });
  }, []);

  // Remove a prefix slot from a value
  const removePrefixSlot = useCallback((variantId: string, propertyId: string, valueId: string, prefixSlotId: string) => {
    setState(prev => {
      const newVariants = prev.config.variants.map(v =>
        v.id === variantId
          ? {
              ...v,
              properties: v.properties.map(p =>
                p.id === propertyId
                  ? {
                      ...p,
                      values: p.values.map(val =>
                        val.id === valueId
                          ? {
                              ...val,
                              prefixedClasses: val.prefixedClasses.filter(pc => pc.id !== prefixSlotId),
                            }
                          : val
                      ),
                    }
                  : p
              ),
            }
          : v
      );

      // Update used classes
      const usedClasses = collectUsedClasses(newVariants);
      const newExtractedClasses = prev.extractedClasses.map(cls => ({
        ...cls,
        isUsedInVariant: usedClasses.has(cls.className),
        isSelected: usedClasses.has(cls.className) ? false : cls.isSelected,
      }));

      return {
        ...prev,
        config: {
          ...prev.config,
          variants: newVariants,
        },
        extractedClasses: newExtractedClasses,
      };
    });
  }, [collectUsedClasses]);

  // Set prefix for a specific prefix slot
  const setPrefixSlotPrefix = useCallback(
    (variantId: string, propertyId: string, valueId: string, prefixSlotId: string, prefix: string) => {
      setState(prev => ({
        ...prev,
        config: {
          ...prev.config,
          variants: prev.config.variants.map(v =>
            v.id === variantId
              ? {
                  ...v,
                  properties: v.properties.map(p =>
                    p.id === propertyId
                      ? {
                          ...p,
                          values: p.values.map(val =>
                            val.id === valueId
                              ? {
                                  ...val,
                                  prefixedClasses: val.prefixedClasses.map(pc =>
                                    pc.id === prefixSlotId ? { ...pc, prefix } : pc
                                  ),
                                }
                              : val
                          ),
                        }
                      : p
                  ),
                }
              : v
          ),
        },
      }));
    },
    []
  );

  // Set classes for a specific prefix slot
  const setPrefixSlotClasses = useCallback(
    (variantId: string, propertyId: string, valueId: string, prefixSlotId: string, classes: string[]) => {
      setState(prev => {
        const newVariants = prev.config.variants.map(v =>
          v.id === variantId
            ? {
                ...v,
                properties: v.properties.map(p =>
                  p.id === propertyId
                    ? {
                        ...p,
                        values: p.values.map(val =>
                          val.id === valueId
                            ? {
                                ...val,
                                prefixedClasses: val.prefixedClasses.map(pc =>
                                  pc.id === prefixSlotId ? { ...pc, classes } : pc
                                ),
                              }
                            : val
                        ),
                      }
                    : p
                ),
              }
            : v
        );

        // Update used classes
        const usedClasses = collectUsedClasses(newVariants);
        const newExtractedClasses = prev.extractedClasses.map(cls => ({
          ...cls,
          isUsedInVariant: usedClasses.has(cls.className),
          isSelected: usedClasses.has(cls.className) ? false : cls.isSelected,
        }));

        return {
          ...prev,
          config: {
            ...prev.config,
            variants: newVariants,
          },
          extractedClasses: newExtractedClasses,
        };
      });
    },
    [collectUsedClasses]
  );

  // Compound variants
  const addCompoundVariant = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: [
          ...prev.config.compoundVariants,
          {
            id: generateId(),
            conditions: [{ id: generateId(), propertyName: "", propertyValue: "" }],
            classes: [],
          },
        ],
      },
    }));
  }, []);

  const removeCompoundVariant = useCallback((ruleId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.filter(r => r.id !== ruleId),
      },
    }));
  }, []);

  const addCompoundCondition = useCallback((ruleId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId
            ? {
                ...r,
                conditions: [
                  ...r.conditions,
                  { id: generateId(), propertyName: "", propertyValue: "" },
                ],
              }
            : r
        ),
      },
    }));
  }, []);

  const removeCompoundCondition = useCallback((ruleId: string, conditionId: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId
            ? { ...r, conditions: r.conditions.filter(c => c.id !== conditionId) }
            : r
        ),
      },
    }));
  }, []);

  const updateCompoundCondition = useCallback((ruleId: string, conditionId: string, propertyName: string, propertyValue: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId
            ? {
                ...r,
                conditions: r.conditions.map(c =>
                  c.id === conditionId ? { ...c, propertyName, propertyValue } : c
                ),
              }
            : r
        ),
      },
    }));
  }, []);

  const setCompoundVariantClasses = useCallback((ruleId: string, classes: string[]) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        compoundVariants: prev.config.compoundVariants.map(r =>
          r.id === ruleId ? { ...r, classes } : r
        ),
      },
    }));
  }, []);

  // Default variants
  const setDefaultVariant = useCallback((propertyName: string, value: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        defaultVariants: {
          ...prev.config.defaultVariants,
          [propertyName]: value,
        },
      },
    }));
  }, []);

  const removeDefaultVariant = useCallback((propertyName: string) => {
    setState(prev => {
      const { [propertyName]: _, ...rest } = prev.config.defaultVariants;
      return {
        ...prev,
        config: {
          ...prev.config,
          defaultVariants: rest,
        },
      };
    });
  }, []);

  // Class modal
  const openClassModal = useCallback((variantId: string, propertyId: string, valueId: string, prefixSlotId: string) => {
    setState(prev => ({
      ...prev,
      isClassModalOpen: true,
      classModalTarget: { variantId, propertyId, valueId, prefixSlotId },
    }));
  }, []);

  const closeClassModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isClassModalOpen: false,
      classModalTarget: null,
    }));
  }, []);

  // Component name
  const setComponentName = useCallback((name: string) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        componentName: name,
      },
    }));
  }, []);

  // Reset
  const resetConfig = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: createInitialConfig(),
      extractedClasses: prev.extractedClasses.map(cls => ({
        ...cls,
        isSelected: true,
        isUsedInVariant: false,
      })),
    }));
  }, []);

  // Computed: base classes (selected and not used in variants)
  const computedBaseClasses = useMemo(() => {
    return state.extractedClasses
      .filter(cls => cls.isSelected && !cls.isUsedInVariant)
      .map(cls => cls.className);
  }, [state.extractedClasses]);

  // Update config.baseClasses whenever computed changes
  useMemo(() => {
    setState(prev => {
      if (JSON.stringify(prev.config.baseClasses) === JSON.stringify(computedBaseClasses)) {
        return prev;
      }
      return {
        ...prev,
        config: {
          ...prev.config,
          baseClasses: computedBaseClasses,
        },
      };
    });
  }, [computedBaseClasses]);

  return {
    ...state,
    setMode,
    setExtractorResult,
    toggleBaseClass,
    selectAllBaseClasses,
    deselectAllBaseClasses,
    addVariant,
    removeVariant,
    duplicateVariant,
    renameVariant,
    toggleVariantPrefixes,
    addProperty,
    removeProperty,
    renameProperty,
    setPropertyValues,
    addPropertyValue,
    removePropertyValue,
    duplicatePropertyValue,
    renamePropertyValue,
    addPrefixSlot,
    removePrefixSlot,
    setPrefixSlotPrefix,
    setPrefixSlotClasses,
    addCompoundVariant,
    removeCompoundVariant,
    addCompoundCondition,
    removeCompoundCondition,
    updateCompoundCondition,
    setCompoundVariantClasses,
    setDefaultVariant,
    removeDefaultVariant,
    openClassModal,
    closeClassModal,
    setComponentName,
    resetConfig,
  };
}

