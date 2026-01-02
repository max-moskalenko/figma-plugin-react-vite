/**
 * @file DOM Generator (CSS Format)
 * @module common/domGenerator
 * 
 * Generates HTML output with inline CSS styles.
 * Uses layer names as semantic tag names (dots removed for HTML compatibility).
 * 
 * Key exports:
 * - generateDOM() - Main generation function
 * 
 * Output format:
 * <Button style="display: flex; padding: 16px;">
 *   <Label style="font-size: 14px;">Click</Label>
 * </Button>
 */

import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { VariableMap, layoutToCSS, typographyToCSS, fillsToCSS, strokesToCSS, effectsToCSS, figmaVariableToCSSVariable } from "./cssGenerator";
import { ExtractedStyles } from "@plugin/extractors/styleExtractor";
import { AnnotationFormat, IconExportSettings } from "@common/networkSides";

export interface GeneratedDOM {
  html: string;
  css: string;
  stylesheet: string;
  usedVariables: string[]; // List of unique variable names used
}

/**
 * Formats an annotation string based on the specified format.
 * 
 * @param annotation - The annotation text to format
 * @param format - The annotation format: "html", "tsx", or "none"
 * @param indent - The indentation string
 * @returns Formatted annotation string or empty string if format is "none"
 */
function formatAnnotation(annotation: string, format: AnnotationFormat, indent: string): string {
  if (format === "none") {
    return "";
  }
  
  // Escape special characters
  const escapedAnnotation = annotation
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  if (format === "tsx") {
    return `${indent}{/* ${escapedAnnotation} */}\n`;
  }
  
  // Default to HTML format
  return `${indent}<!-- ${escapedAnnotation} -->\n`;
}

/**
 * Sanitizes a Figma layer name for use as an HTML/JSX tag name.
 * Preserves the original casing (for React component style), removes invalid characters.
 * 
 * For variant components, uses the parent COMPONENT_SET name instead of the variant
 * property string (e.g., "Checkbox" instead of "type=checkbox, state=default, ...").
 * 
 * @param nodeName - The original Figma layer name
 * @param componentSetName - Optional parent COMPONENT_SET name (for variants)
 * @returns Sanitized tag name safe for HTML/JSX
 */
function sanitizeTagName(nodeName: string, componentSetName?: string): string {
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
  
  // Remove characters invalid in tag names (keep letters, numbers, hyphens, underscores)
  // Preserve original casing for React component style
  cleanedName = cleanedName.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Tag names can't start with a number or hyphen
  if (/^[0-9-]/.test(cleanedName)) {
    cleanedName = 'Element' + cleanedName;
  }
  
  return cleanedName || "div";
}

/**
 * Determines if a CSS property has a useless (zero or default) value that should be filtered out.
 * 
 * Filters properties like `border-radius: 0px`, `padding: 0px`, `gap: 0px` to reduce
 * clutter in the output. These properties don't affect the visual result.
 * 
 * @param property - CSS property string (e.g., "border-radius: 0px")
 * @returns true if the property should be filtered out, false otherwise
 */
function isUselessProperty(property: string): boolean {
  // Remove whitespace and check the value part
  const trimmed = property.trim();
  
  // Check for border-radius: 0px or border-radius: 0
  if (trimmed.match(/^border-radius:\s*0(px)?$/i)) {
    return true;
  }
  
  // Check for gap: 0px or gap: 0
  if (trimmed.match(/^gap:\s*0(px)?$/i)) {
    return true;
  }
  
  // Check for padding shorthand: padding: 0px 0px 0px 0px or padding: 0 0 0 0 or padding: 0px
  // This regex matches padding with 1-4 zero values (with or without px)
  if (trimmed.match(/^padding:\s*(0(px)?\s*){1,4}$/i)) {
    return true;
  }
  
  // Check for individual padding properties with 0
  if (trimmed.match(/^padding-(top|right|bottom|left):\s*0(px)?$/i)) {
    return true;
  }
  
  return false;
}

/**
 * Filters out CSS properties with useless (zero/default) values.
 * 
 * @param properties - Array of CSS property strings
 * @returns Filtered array with useless properties removed
 */
function filterUselessProperties(properties: string[]): string[] {
  return properties.filter(prop => !isUselessProperty(prop));
}

/**
 * Converts an array of CSS properties to an inline style string.
 * 
 * Filters out useless properties and joins them with semicolons.
 * 
 * @param properties - Array of CSS property strings
 * @returns Inline style string (e.g., "width: 100px; height: 50px") or empty string
 */
function propertiesToInlineStyle(properties: string[]): string {
  if (properties.length === 0) return "";
  const filtered = filterUselessProperties(properties);
  if (filtered.length === 0) return "";
  return filtered.join("; ");
}

/**
 * Generates HTML attributes for a node (layer name is now the tag, not an attribute).
 * 
 * @param inlineStyle - The inline style string to include
 * @param indent - Indentation level for formatting
 * @param prettify - Whether to format with newlines or keep compact
 * @returns Formatted attributes string
 */
function generateAttributes(
  inlineStyle: string,
  indent: number,
  prettify: boolean
): string {
  const indentStr = "  ".repeat(indent);
  const attrs: string[] = [];
  
  // style attribute (layer name is now the tag)
  if (inlineStyle) {
    const escapedStyle = inlineStyle.replace(/"/g, "&quot;");
    if (prettify && escapedStyle.length > 60) {
      // Split by semicolon and format each property on a new line
      const styleProps = escapedStyle.split("; ").filter(p => p.trim());
      const formattedStyle = styleProps
        .map((prop, i) => i === 0 ? prop : `    ${prop}`)
        .join(";\n    ");
      attrs.push(`style="${formattedStyle};"`);
    } else {
      attrs.push(`style="${escapedStyle}"`);
    }
  }

  if (prettify) {
    // Multi-line format for readability
    return attrs.length > 0 ? `\n${indentStr}  ${attrs.join(`\n${indentStr}  `)}` : "";
  } else {
    // Compact single-line format
    return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  }
}

/**
 * Recursively generates HTML from an extracted node tree with inline styles.
 * 
 * Converts Figma nodes to HTML elements, applies inline styles, and preserves
 * the hierarchical structure. Handles text content, children, and self-closing tags.
 * Handles icon nodes based on iconSettings (npm-package mode transforms to component imports).
 * 
 * @param node - The extracted node with optional styles
 * @param variableMap - Map of variable names to CSS values (populated during generation)
 * @param annotationFormat - Format for annotations: "html", "tsx", or "none"
 * @param prettify - Whether to format with indentation or keep compact
 * @param indent - Current indentation level for formatting (default: 0)
 * @param iconSettings - Settings for icon export
 * @param imports - Set to collect icon imports (for npm-package mode)
 * @returns HTML string for this node and its children
 */
function generateHTMLRecursive(
  node: ExtractedNode & { styles?: ExtractedStyles },
  variableMap: VariableMap,
  annotationFormat: AnnotationFormat,
  prettify: boolean,
  indent: number = 0,
  iconSettings: IconExportSettings = { mode: 'none' },
  imports: Set<string> = new Set()
): string {
  try {
    const indentStr = prettify ? "  ".repeat(indent) : "";
    const newline = prettify ? "\n" : "";
    let inlineStyle = "";

    // Generate inline styles if styles exist
    if (node.styles) {
      try {
        const properties: string[] = [];
        properties.push(...layoutToCSS(node.styles.layout, variableMap));
        properties.push(...typographyToCSS(node.styles.typography, variableMap));
        properties.push(...fillsToCSS(node.styles.fills, variableMap));
        properties.push(...strokesToCSS(node.styles.strokes, variableMap));
        properties.push(...effectsToCSS(node.styles.effects));
        
        if (node.styles.visible === false) {
          properties.push("display: none");
        }
        
        inlineStyle = propertiesToInlineStyle(properties);
      } catch (cssError) {
        console.warn("Error generating inline styles", { 
          nodeType: node.type,
          nodeName: node.name,
          error: cssError instanceof Error ? cssError.message : String(cssError)
        });
      }
    }

    // Add annotations before the element (format depends on annotationFormat)
    let html = "";
    if (node.annotations && node.annotations.length > 0) {
      node.annotations.forEach((annotation) => {
        html += formatAnnotation(annotation, annotationFormat, indentStr);
      });
    }

    // Handle icon nodes - NPM package mode transforms icons to component imports
    if (node.icon?.isIcon && iconSettings.mode === 'npm-package') {
      const packageName = iconSettings.packageName || '@phosphor-icons/react';
      imports.add(`import { ${node.icon.iconName} } from '${packageName}';`);
      return indentStr + generateIconComponent(node.icon.iconName, inlineStyle);
    }

    const element = sanitizeTagName(node.name, (node as any).componentSetName);
    const attributes = generateAttributes(inlineStyle, indent, prettify);

    // Build opening tag
    const openingTag = prettify 
      ? `${indentStr}<${element}${attributes}${newline}${indentStr}`
      : `${indentStr}<${element}${attributes}`;
    html += openingTag;

    // Check if element has children or text content
    const hasChildren = node.children && node.children.length > 0;
    const hasText = node.type === "TEXT" && ((node as any).characters || node.name);

    if (hasChildren || hasText) {
      html += `>`;
      
      // Add text content if it's a text node
      if (hasText) {
        const textContent = (node as any).characters || node.name || "";
        html += escapeHTML(textContent);
      }

      // Add children
      if (hasChildren && node.children) {
        if (prettify && !hasText) {
          html += newline;
        }
        node.children.forEach((child, i) => {
          try {
            if (prettify && hasText && i === 0) {
              html += newline;
            }
            html += generateHTMLRecursive(
              child as ExtractedNode & { styles?: ExtractedStyles },
              variableMap,
              annotationFormat,
              prettify,
              indent + 1,
              iconSettings,
              imports
            );
            if (prettify && node.children && i < node.children.length - 1) {
              html += newline;
            }
          } catch (childError) {
            console.warn("Error generating HTML for child", { 
              childIndex: i,
              childType: child.type,
              childName: child.name,
              error: childError instanceof Error ? childError.message : String(childError)
            });
          }
        });
        if (prettify) {
          html += `${newline}${indentStr}`;
        }
      }
      
      html += `</${element}>`;
    } else {
      html += prettify ? ` />` : `/>`;
    }

    return html;
  } catch (error) {
    console.error("Error in generateHTMLRecursive", { 
      nodeType: node.type,
      nodeName: node.name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Escapes HTML special characters to prevent XSS and ensure valid HTML.
 * 
 * @param text - Text content to escape
 * @returns Escaped text with HTML entities (e.g., "&" -> "&amp;")
 */
function escapeHTML(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generates icon component code for npm-package mode.
 * 
 * @param iconName - Name of the icon component
 * @param style - Inline style string
 * @returns HTML string for the icon component
 */
function generateIconComponent(iconName: string, style: string): string {
  const styleAttr = style ? ` style="${style}"` : '';
  return `<${iconName}${styleAttr} />`;
}

/**
 * Generates complete DOM structure from extracted nodes with inline styles.
 * 
 * This is the main entry point for HTML generation. It:
 * 1. Collects all CSS variables by processing styles (populates variableMap)
 * 2. Generates HTML for each node with inline styles using CSS variables
 * 3. Handles icon nodes based on iconSettings
 * 4. Returns HTML with formatted structure (no style block header)
 * 
 * The output is HTML elements with inline styles. CSS variables are used in inline
 * styles (e.g., `var(--variable-name)`). Zero-value properties are filtered out.
 * 
 * @param nodes - Array of extracted nodes with styles
 * @param annotationFormat - Format for annotations: "html", "tsx", or "none"
 * @param prettify - Whether to format with indentation (true) or keep compact (false)
 * @param iconSettings - Settings for icon export
 * @returns GeneratedDOM object with html, css (variables block), and stylesheet (combined output)
 */
export function generateDOM(
  nodes: (ExtractedNode & { styles?: ExtractedStyles })[],
  annotationFormat: AnnotationFormat = "html",
  prettify: boolean = true,
  iconSettings: IconExportSettings = { mode: 'none' }
): GeneratedDOM {
  const variableMap: VariableMap = {};
  const imports: Set<string> = new Set();

  // First pass: collect all CSS variables by generating styles
  // This populates variableMap which is used for CSS variable references in inline styles
  nodes.forEach((node) => {
    if (node.styles) {
      layoutToCSS(node.styles.layout, variableMap);
      typographyToCSS(node.styles.typography, variableMap);
      fillsToCSS(node.styles.fills, variableMap);
      strokesToCSS(node.styles.strokes, variableMap);
      effectsToCSS(node.styles.effects);
    }
  });

  // Generate HTML for all nodes with inline styles
  const htmlParts = nodes.map((node, index) => {
    try {
      const html = generateHTMLRecursive(node, variableMap, annotationFormat, prettify, 0, iconSettings, imports);
      return html;
    } catch (error) {
      console.error("Error generating HTML for node", { 
        index, 
        nodeType: node.type, 
        nodeName: node.name,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });

  let html = htmlParts.join(prettify ? "\n\n" : "");
  
  // Prepend imports if any (for npm-package mode)
  if (imports.size > 0) {
    const importsBlock = Array.from(imports).sort().join('\n');
    html = `${importsBlock}\n\n${html}`;
  }
  
  // Final output: HTML with inline styles only (no style block)
  const stylesheet = html;

  // Extract unique variable names from variableMap and convert to CSS variable format
  // Format: "var(--variable-name)" for display in UI
  const usedVariables = Object.keys(variableMap)
    .map(figmaVarName => figmaVariableToCSSVariable(figmaVarName))
    .sort();

  return {
    html,
    css: "", // No CSS block needed
    stylesheet: stylesheet,
    usedVariables: usedVariables,
  };
}

