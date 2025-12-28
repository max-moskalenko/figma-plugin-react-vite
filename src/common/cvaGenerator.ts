/**
 * CVA Code Generator
 * 
 * Generates production-ready TypeScript code for class-variance-authority (CVA)
 * configurations from the CVA tool's internal configuration structure.
 * 
 * OVERVIEW:
 * This module transforms the visual mapping configuration into properly formatted
 * TypeScript code that can be directly used in React components with CVA.
 * 
 * GENERATION PROCESS:
 * 1. Convert component name to valid camelCase variable name
 * 2. Format base classes as a space-separated string
 * 3. Generate variants object with property→value→classes mappings
 * 4. Generate compound variants array with conditional class rules
 * 5. Generate default variants object with initial values
 * 6. Generate VariantProps TypeScript type export
 * 
 * OUTPUT FORMAT:
 * ```typescript
 * import { cva, type VariantProps } from "class-variance-authority";
 * 
 * export const componentVariants = cva(
 *   "base classes here",
 *   {
 *     variants: { ... },
 *     compoundVariants: [ ... ],
 *     defaultVariants: { ... },
 *   }
 * );
 * 
 * export type ComponentVariantsProps = VariantProps<typeof componentVariants>;
 * ```
 * 
 * FEATURES:
 * - Handles multiple prefix slots (outputs arrays for multiple states)
 * - Properly formats nested objects with correct indentation
 * - Applies prefixes to classes (hover:, active:, disabled:, etc.)
 * - Merges properties from multiple variant configs
 * - Validates and filters invalid compound variant rules
 * - Generates TypeScript type exports for type safety
 * 
 * @see https://cva.style/ for CVA documentation
 */

interface CVAPrefixedClasses {
  id: string;
  prefix: string; // Empty string for no prefix
  classes: string[];
}

interface CVAPropertyValue {
  id: string;
  name: string;
  prefixedClasses: CVAPrefixedClasses[];
}

interface CVAVariantProperty {
  id: string;
  name: string;
  values: CVAPropertyValue[];
}

interface CVAVariantConfig {
  id: string;
  name: string;
  properties: CVAVariantProperty[];
}

interface CompoundCondition {
  id: string;
  propertyName: string;
  propertyValue: string;
}

interface CompoundVariantRule {
  id: string;
  conditions: CompoundCondition[];
  classes: string[];
}

interface DefaultVariants {
  [propertyName: string]: string;
}

interface CVAConfig {
  componentName: string;
  baseClasses: string[];
  variants: CVAVariantConfig[];
  compoundVariants: CompoundVariantRule[];
  defaultVariants: DefaultVariants;
}

/**
 * Convert component name to valid variable name (camelCase)
 * 
 * Transforms a Figma component name into a valid JavaScript variable name
 * following camelCase convention with "Variants" suffix.
 * 
 * RULES:
 * - Remove all non-alphanumeric characters (except spaces)
 * - Split into words by spaces
 * - First word is lowercase
 * - Subsequent words have first letter capitalized
 * - Append "Variants" suffix
 * 
 * EXAMPLES:
 * - "My Button" → "myButtonVariants"
 * - "Card-Header" → "CardHeaderVariants"
 * - "nav/item" → "navitemVariants"
 * - "" → "componentVariants" (fallback)
 * 
 * @param name - The component name from Figma
 * @returns Valid JavaScript variable name in camelCase with "Variants" suffix
 */
function toVariableName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  
  if (!cleaned) return "componentVariants";
  
  const words = cleaned.split(/\s+/);
  const camelCase = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  
  return camelCase + "Variants";
}

/**
 * Format classes as a properly formatted string or array
 * 
 * Converts an array of class names into a formatted string representation
 * for use in generated CVA code. Can output as a single string (default)
 * or as a multiline array (for readability with many classes).
 * 
 * SINGLE STRING MODE (asArray = false):
 * ["p-4", "bg-blue-500"] → "p-4 bg-blue-500"
 * 
 * ARRAY MODE (asArray = true):
 * ["p-4", "hover:bg-blue-600"] → 
 * ```
 * "p-4",
 * "hover:bg-blue-600"
 * ```
 * 
 * @param classes - Array of CSS class names
 * @param asArray - If true, formats as multiline array; if false, formats as single string
 * @returns Formatted string representation (wrapped in quotes)
 */
function formatClasses(classes: string[], asArray = false): string {
  if (classes.length === 0) return '""';
  
  if (asArray) {
    // Format as array with each item on its own line
    return classes.map(c => `"${c}"`).join(",\n");
  }
  
  // Join with single space
  const classString = classes.join(" ");
  return `"${classString}"`;
}

/**
 * Get all classes from a value with prefixes applied
 * 
 * Extracts and formats all class strings from a property value's prefix slots.
 * Each prefix slot contains a set of classes and an optional prefix (like "hover:").
 * The function applies the prefix to each class and returns an array of
 * formatted class strings (one per prefix slot).
 * 
 * PROCESS:
 * 1. Iterate through each prefix slot
 * 2. Skip empty slots (no classes)
 * 3. If prefix exists, prepend it to each class
 * 4. Join classes within each slot with spaces
 * 5. Return array of formatted strings
 * 
 * EXAMPLE:
 * Value with two prefix slots:
 * - Slot 1: prefix="", classes=["p-4", "bg-blue-500"]
 * - Slot 2: prefix="hover:", classes=["bg-blue-600"]
 * 
 * Output: ["p-4 bg-blue-500", "hover:bg-blue-600"]
 * 
 * This array is then used to generate either a string (single slot) or
 * an array (multiple slots) in the final CVA code.
 * 
 * @param value - Property value with prefixed classes configuration
 * @returns Array of formatted class strings (one per non-empty prefix slot)
 */
function getAllPrefixedClasses(value: CVAPropertyValue): string[] {
  const result: string[] = [];
  
  value.prefixedClasses.forEach(slot => {
    if (slot.classes.length === 0) return;
    
    if (slot.prefix) {
      // Apply prefix to each class
      const prefixed = slot.classes.map(c => `${slot.prefix}${c}`).join(" ");
      result.push(prefixed);
    } else {
      // No prefix - join classes normally
      result.push(slot.classes.join(" "));
    }
  });
  
  return result;
}

/**
 * Generate variants object with proper formatting
 * 
 * Creates the variants object section of CVA code, which maps variant property
 * names to their possible values and associated CSS classes.
 * 
 * STRUCTURE:
 * ```typescript
 * variants: {
 *   size: {
 *     sm: "h-8 px-3 text-sm",
 *     md: "h-10 px-4 text-base",
 *   },
 *   variant: {
 *     brand: [
 *       "bg-blue-500 text-white",
 *       "hover:bg-blue-600",
 *     ],
 *   },
 * }
 * ```
 * 
 * HANDLING MULTIPLE PREFIX SLOTS:
 * - Single prefix slot → outputs as string
 * - Multiple prefix slots → outputs as array (one item per slot)
 * 
 * This allows different interactive states (default, hover, active, etc.)
 * to be defined separately and combined into an array.
 * 
 * PROPERTY MERGING:
 * If multiple variant configs define the same property name, their values
 * are merged and deduplicated.
 * 
 * @param variants - Array of variant configurations to generate code from
 * @param indentLevel - Current indentation level for proper code formatting
 * @returns Formatted TypeScript code for the variants object
 */
function generateVariantsObject(variants: CVAVariantConfig[], indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  const innerIndent = "  ".repeat(indentLevel + 1);
  const valueIndent = "  ".repeat(indentLevel + 2);
  const arrayItemIndent = "  ".repeat(indentLevel + 3);
  
  // Merge all properties from all variant configs
  const mergedProperties = new Map<string, Map<string, string[]>>();
  
  variants.forEach(variant => {
    variant.properties.forEach(prop => {
      if (!mergedProperties.has(prop.name)) {
        mergedProperties.set(prop.name, new Map());
      }
      const propMap = mergedProperties.get(prop.name)!;
      
      prop.values.forEach(val => {
        // Get all prefixed class groups
        const prefixedClassGroups = getAllPrefixedClasses(val);
        const existing = propMap.get(val.name) || [];
        // Merge and deduplicate
        const merged = [...new Set([...existing, ...prefixedClassGroups])];
        propMap.set(val.name, merged);
      });
    });
  });

  if (mergedProperties.size === 0) {
    return `${indent}variants: {},`;
  }

  const lines: string[] = [`${indent}variants: {`];
  
  const propEntries = Array.from(mergedProperties.entries());
  propEntries.forEach(([propName, values], propIndex) => {
    lines.push(`${innerIndent}${propName}: {`);
    
    const valueEntries = Array.from(values.entries());
    valueEntries.forEach(([valueName, classGroups], valueIndex) => {
      const comma = valueIndex < valueEntries.length - 1 ? "," : "";
      
      if (classGroups.length === 0) {
        // No classes
        lines.push(`${valueIndent}${valueName}: ""${comma}`);
      } else if (classGroups.length === 1) {
        // Single class group - output as string
        lines.push(`${valueIndent}${valueName}: "${classGroups[0]}"${comma}`);
      } else {
        // Multiple class groups (different prefixes) - output as array
        lines.push(`${valueIndent}${valueName}: [`);
        classGroups.forEach((group, groupIndex) => {
          const groupComma = groupIndex < classGroups.length - 1 ? "," : "";
          lines.push(`${arrayItemIndent}"${group}"${groupComma}`);
        });
        lines.push(`${valueIndent}]${comma}`);
      }
    });
    
    const propComma = propIndex < propEntries.length - 1 ? "," : "";
    lines.push(`${innerIndent}}${propComma}`);
  });
  
  lines.push(`${indent}},`);
  return lines.join("\n");
}

/**
 * Generate compound variants array with proper formatting
 * 
 * Creates the compoundVariants array section of CVA code, which defines
 * conditional class combinations based on multiple property values.
 * 
 * COMPOUND VARIANTS:
 * Apply specific classes when multiple variant properties have specific values.
 * 
 * STRUCTURE:
 * ```typescript
 * compoundVariants: [
 *   {
 *     size: "sm",
 *     variant: "brand",
 *     class: "font-bold shadow-sm",
 *   },
 *   {
 *     size: "lg",
 *     disabled: "true",
 *     class: "opacity-50 cursor-not-allowed",
 *   },
 * ]
 * ```
 * 
 * VALIDATION:
 * Only valid rules are included in the output. A rule is valid if:
 * - It has at least one condition
 * - All conditions have non-empty propertyName and propertyValue
 * - It has at least one class
 * 
 * Invalid rules are filtered out to prevent CVA errors.
 * 
 * @param compoundVariants - Array of compound variant rules
 * @param indentLevel - Current indentation level for proper code formatting
 * @returns Formatted TypeScript code for the compoundVariants array
 */
function generateCompoundVariantsArray(compoundVariants: CompoundVariantRule[], indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  const itemIndent = "  ".repeat(indentLevel + 1);
  const propIndent = "  ".repeat(indentLevel + 2);

  const validRules = compoundVariants.filter(rule => 
    rule.conditions.length > 0 && 
    rule.conditions.every(c => c.propertyName && c.propertyValue) &&
    rule.classes.length > 0
  );

  if (validRules.length === 0) {
    return `${indent}compoundVariants: [],`;
  }

  const lines: string[] = [`${indent}compoundVariants: [`];
  
  validRules.forEach((rule, ruleIndex) => {
    lines.push(`${itemIndent}{`);
    
    // Add conditions
    rule.conditions.forEach(condition => {
      lines.push(`${propIndent}${condition.propertyName}: "${condition.propertyValue}",`);
    });
    
    // Add class (use 'class' as per CVA convention)
    const classString = rule.classes.join(" ");
    lines.push(`${propIndent}class: "${classString}",`);
    
    const ruleComma = ruleIndex < validRules.length - 1 ? "," : "";
    lines.push(`${itemIndent}}${ruleComma}`);
  });
  
  lines.push(`${indent}],`);
  return lines.join("\n");
}

/**
 * Generate default variants object with proper formatting
 * 
 * Creates the defaultVariants object section of CVA code, which specifies
 * the initial/default values for variant properties.
 * 
 * STRUCTURE:
 * ```typescript
 * defaultVariants: {
 *   size: "md",
 *   variant: "brand",
 *   disabled: "false",
 * }
 * ```
 * 
 * DEFAULT VALUES:
 * When a component is used without specifying a variant prop, CVA will
 * use the value defined in defaultVariants. This is useful for establishing
 * sensible defaults that match the most common use case.
 * 
 * FILTERING:
 * Only entries with truthy values are included in the output.
 * Empty strings or undefined values are excluded.
 * 
 * @param defaultVariants - Object mapping property names to default values
 * @param indentLevel - Current indentation level for proper code formatting
 * @returns Formatted TypeScript code for the defaultVariants object
 */
function generateDefaultVariantsObject(defaultVariants: DefaultVariants, indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  const propIndent = "  ".repeat(indentLevel + 1);
  
  const entries = Object.entries(defaultVariants).filter(([_, value]) => value);
  
  if (entries.length === 0) {
    return `${indent}defaultVariants: {},`;
  }

  const lines: string[] = [`${indent}defaultVariants: {`];
  
  entries.forEach(([propName, value], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    lines.push(`${propIndent}${propName}: "${value}"${comma}`);
  });
  
  lines.push(`${indent}},`);
  return lines.join("\n");
}

/**
 * Generate complete CVA code from configuration
 * 
 * Main entry point for generating production-ready CVA TypeScript code.
 * Takes a CVA configuration object and returns formatted code with:
 * - Import statement for CVA
 * - Variable declaration with cva() call
 * - Base classes (always included, even if empty)
 * - Variants object (if any variants defined)
 * - CompoundVariants array (if any compound rules defined)
 * - DefaultVariants object (if any defaults defined)
 * - TypeScript type export for VariantProps
 * 
 * OUTPUT STRUCTURE:
 * ```typescript
 * import { cva, type VariantProps } from "class-variance-authority";
 * 
 * export const myComponentVariants = cva(
 *   "base-class-1 base-class-2",
 *   {
 *     variants: { ... },
 *     compoundVariants: [ ... ],
 *     defaultVariants: { ... },
 *   }
 * );
 * 
 * export type MyComponentVariantsProps = VariantProps<typeof myComponentVariants>;
 * ```
 * 
 * CONDITIONAL SECTIONS:
 * - If no variants, compound variants, or default variants are defined,
 *   the second argument to cva() is omitted entirely
 * - Each section (variants, compoundVariants, defaultVariants) is only
 *   included if it has valid content
 * 
 * TYPE EXPORT:
 * The generated VariantProps type can be used in React components:
 * ```tsx
 * interface ButtonProps extends MyComponentVariantsProps {
 *   onClick?: () => void;
 * }
 * ```
 * 
 * @param config - Complete CVA configuration from the mapping tool
 * @returns Formatted TypeScript code as a string
 */
export function generateCVACode(config: CVAConfig): string {
  const variableName = toVariableName(config.componentName);
  const baseClasses = config.baseClasses.length > 0 
    ? `"${config.baseClasses.join(" ")}"` 
    : '""';

  const hasVariants = config.variants.length > 0 && 
    config.variants.some(v => v.properties.length > 0);
  const hasCompoundVariants = config.compoundVariants.length > 0 &&
    config.compoundVariants.some(r => r.conditions.length > 0 && r.classes.length > 0);
  const hasDefaultVariants = Object.values(config.defaultVariants).some(v => v);

  const lines: string[] = [
    `import { cva, type VariantProps } from "class-variance-authority";`,
    ``,
    `export const ${variableName} = cva(`,
    `  ${baseClasses},`,
  ];

  if (hasVariants || hasCompoundVariants || hasDefaultVariants) {
    lines.push(`  {`);
    
    if (hasVariants) {
      lines.push(generateVariantsObject(config.variants, 2));
    }
    
    if (hasCompoundVariants) {
      lines.push(generateCompoundVariantsArray(config.compoundVariants, 2));
    }
    
    if (hasDefaultVariants) {
      lines.push(generateDefaultVariantsObject(config.defaultVariants, 2));
    }
    
    lines.push(`  }`);
  }
  
  lines.push(`);`);
  lines.push(``);
  
  // Generate TypeScript type export
  const typeName = variableName.charAt(0).toUpperCase() + variableName.slice(1) + "Props";
  lines.push(`export type ${typeName} = VariantProps<typeof ${variableName}>;`);

  return lines.join("\n");
}

/**
 * Generate CVA code as a downloadable TypeScript file content
 * 
 * Wraps the generated CVA code with file header comments for better
 * documentation when saved as a .ts file.
 * 
 * Adds a header comment block with:
 * - Component name
 * - Generation tool attribution
 * - @generated tag (useful for IDE tools)
 * 
 * OUTPUT:
 * ```typescript
 * /**
 *  * Generated CVA configuration for MyComponent
 *  * @generated by Figma CVA Mapping Tool
 *  *\/
 * 
 * import { cva, type VariantProps } from "class-variance-authority";
 * ...
 * ```
 * 
 * @param config - Complete CVA configuration from the mapping tool
 * @returns Complete file content with header and CVA code
 */
export function generateCVAFile(config: CVAConfig): string {
  const code = generateCVACode(config);
  return `/**
 * Generated CVA configuration for ${config.componentName}
 * @generated by Figma CVA Mapping Tool
 */

${code}
`;
}
