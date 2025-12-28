/**
 * CVA Code Generator
 * Generates class-variance-authority (CVA) configuration code from CVA config
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
 * For multi-line arrays (multiple prefix slots), formats as an array
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
 * Returns array of formatted class strings (one per prefix slot)
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
 * Handles multiple prefix slots per value by outputting arrays
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
