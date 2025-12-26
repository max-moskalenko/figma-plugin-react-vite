import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { VariableMap, layoutToCSS, typographyToCSS, fillsToCSS, strokesToCSS, effectsToCSS, figmaVariableToCSSVariable } from "./cssGenerator";
import { ExtractedStyles } from "@plugin/extractors/styleExtractor";

export interface GeneratedDOM {
  html: string;
  css: string;
  stylesheet: string;
  usedVariables: string[]; // List of unique variable names used
}

/**
 * Maps a Figma node type to an appropriate HTML element.
 * 
 * @param nodeType - The Figma node type (e.g., "FRAME", "TEXT", "RECTANGLE")
 * @param isText - Whether this is a text node (currently unused, defaults to paragraph)
 * @returns HTML element name (e.g., "div", "p", "svg")
 */
function nodeTypeToHTMLElement(nodeType: string, isText: boolean = false): string {
  if (isText) {
    // Determine heading level or paragraph
    return "p"; // Default to paragraph, can be enhanced
  }

  switch (nodeType) {
    case "FRAME":
    case "GROUP":
    case "COMPONENT":
    case "INSTANCE":
      return "div";
    case "RECTANGLE":
    case "ELLIPSE":
    case "POLYGON":
    case "STAR":
      return "div";
    case "VECTOR":
      return "svg";
    case "TEXT":
      return "p";
    default:
      return "div";
  }
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
 * Generates HTML attributes for a node, with data-name as the first attribute.
 * 
 * Formats attributes for readability, with each attribute on a new line.
 * Long style attributes are broken into multiple lines for better readability.
 * 
 * @param nodeName - The Figma node name (used for data-name attribute)
 * @param nodeType - The Figma node type (used for data-type attribute)
 * @param inlineStyle - The inline style string to include
 * @param indent - Indentation level for formatting
 * @returns Formatted attributes string with proper indentation
 */
function generateAttributes(
  nodeName: string,
  nodeType: string,
  inlineStyle: string,
  indent: number
): string {
  const indentStr = "  ".repeat(indent);
  const attrs: string[] = [];
  
  // data-name first (as requested)
  attrs.push(`data-name="${nodeName.replace(/"/g, "&quot;")}"`);
  
  // data-type second
  attrs.push(`data-type="${nodeType.toLowerCase()}"`);
  
  // style last - format it nicely if it's long
  if (inlineStyle) {
    const escapedStyle = inlineStyle.replace(/"/g, "&quot;");
    // If style is long, break it into multiple lines
    if (escapedStyle.length > 60) {
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

  // Always use multi-line format for better readability
  return `\n${indentStr}  ${attrs.join(`\n${indentStr}  `)}`;
}

/**
 * Recursively generates HTML from an extracted node tree with inline styles.
 * 
 * Converts Figma nodes to HTML elements, applies inline styles, and preserves
 * the hierarchical structure. Handles text content, children, and self-closing tags.
 * 
 * @param node - The extracted node with optional styles
 * @param variableMap - Map of variable names to CSS values (populated during generation)
 * @param indent - Current indentation level for formatting (default: 0)
 * @returns HTML string for this node and its children
 */
function generateHTMLRecursive(
  node: ExtractedNode & { styles?: ExtractedStyles },
  variableMap: VariableMap,
  indent: number = 0
): string {
  try {
    const indentStr = "  ".repeat(indent);
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

    // Add annotations as HTML comments before the element
    let html = "";
    if (node.annotations && node.annotations.length > 0) {
      node.annotations.forEach((annotation) => {
        // Escape HTML in annotation text and format as comment
        const escapedAnnotation = annotation
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        html += `${indentStr}<!-- ${escapedAnnotation} -->\n`;
      });
    }

    const element = nodeTypeToHTMLElement(node.type, node.type === "TEXT");
    const attributes = generateAttributes(node.name, node.type, inlineStyle, indent);

    // Always use multi-line format for attributes
    const openingTag = `${indentStr}<${element}${attributes}\n${indentStr}`;
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

      // Add children with proper indentation
      if (hasChildren && node.children) {
        if (!hasText) {
          html += "\n";
        }
        node.children.forEach((child, i) => {
          try {
            if (hasText && i === 0) {
              html += "\n";
            }
            html += generateHTMLRecursive(
              child as ExtractedNode & { styles?: ExtractedStyles },
              variableMap,
              indent + 1
            );
            if (node.children && i < node.children.length - 1) {
              html += "\n";
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
        html += `\n${indentStr}`;
      }
      
      html += `</${element}>`;
    } else {
      html += ` />`;
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
 * Generates complete DOM structure from extracted nodes with inline styles.
 * 
 * This is the main entry point for HTML generation. It:
 * 1. Collects all CSS variables by processing styles (populates variableMap)
 * 2. Generates HTML for each node with inline styles using CSS variables
 * 3. Returns HTML with formatted structure (no style block header)
 * 
 * The output is HTML elements with inline styles. CSS variables are used in inline
 * styles (e.g., `var(--variable-name)`). Zero-value properties are filtered out.
 * 
 * @param nodes - Array of extracted nodes with styles
 * @returns GeneratedDOM object with html, css (variables block), and stylesheet (combined output)
 */
export function generateDOM(
  nodes: (ExtractedNode & { styles?: ExtractedStyles })[]
): GeneratedDOM {
  const variableMap: VariableMap = {};

  // First pass: collect all CSS variables by generating styles
  // This populates variableMap which is used for CSS variable references in inline styles
  nodes.forEach((node) => {
    if (node.styles) {
      layoutToCSS(node.styles.layout, variableMap);
      typographyToCSS(node.styles.typography, variableMap);
      fillsToCSS(node.styles.fills, variableMap);
      strokesToCSS(node.styles.strokes, variableMap);
      effectsToCSS(node.styles.effects); // Note: effects don't store variables, but included for completeness
    }
  });

  // Generate HTML for all nodes with inline styles
  const htmlParts = nodes.map((node, index) => {
    try {
      const html = generateHTMLRecursive(node, variableMap, 0);
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

  const html = htmlParts.join("\n\n");
  
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

