import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { VariableMap, figmaVariableToCSSVariable } from "./cssGenerator";
import { ExtractedStyles } from "@plugin/extractors/styleExtractor";
import {
  layoutToTailwind,
  typographyToTailwind,
  fillsToTailwind,
  strokesToTailwind,
  effectsToTailwind,
  figmaVariableToTailwindClass,
} from "./tailwindGenerator";

export interface GeneratedTailwindDOM {
  html: string;
  css: string;
  stylesheet: string;
  usedVariables: string[]; // List of unique variable names used
}

/**
 * Maps a Figma node type to an appropriate HTML element.
 */
function nodeTypeToHTMLElement(nodeType: string, isText: boolean = false): string {
  if (isText) {
    return "p";
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
 * Converts a node name to a Tailwind-friendly class name.
 * Examples: "Slider.Root" → "slider-root", "Label.Root" → "label-root"
 * 
 * @param nodeName - The node name (e.g., "Slider.Root", "Label.Root")
 * @returns Tailwind-friendly class name (e.g., "slider-root", "label-root")
 */
function nodeNameToTailwindClass(nodeName: string): string {
  return nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates HTML attributes for a node with Tailwind classes.
 * For Tailwind format: only className attribute with all classes including node name.
 */
function generateAttributes(
  nodeName: string,
  nodeType: string,
  tailwindClasses: string[],
  indent: number
): string {
  const indentStr = "  ".repeat(indent);
  const attrs: string[] = [];
  
  // Convert node name to a class and add it to the classes array
  const nodeNameClass = nodeNameToTailwindClass(nodeName);
  const allClasses = [nodeNameClass, ...tailwindClasses].filter(c => c);
  
  if (allClasses.length > 0) {
    const classValue = allClasses.join(" ");
    attrs.push(`className="${classValue}"`);
  }

  return `\n${indentStr}  ${attrs.join(`\n${indentStr}  `)}`;
}

/**
 * Recursively generates HTML from an extracted node tree with Tailwind classes.
 */
function generateHTMLRecursive(
  node: ExtractedNode & { styles?: ExtractedStyles },
  variableMap: VariableMap,
  indent: number = 0
): string {
  try {
    const indentStr = "  ".repeat(indent);
    let tailwindClasses: string[] = [];

    // Check if this node has absolutely positioned children - if so, add relative class
    const hasAbsoluteChildren = node.children?.some((child: any) => 
      child.styles?.layout?.layoutPositioning === "ABSOLUTE"
    ) || false;

    // Generate Tailwind classes if styles exist
    if (node.styles) {
      try {
        const classes: string[] = [];
        
        // Add relative class if this node has absolutely positioned children
        if (hasAbsoluteChildren) {
          classes.push("relative");
        }
        
        classes.push(...layoutToTailwind(node.styles.layout, variableMap, node.styles.positioning));
        classes.push(...typographyToTailwind(node.styles.typography, variableMap));
        
        // For text nodes, fills represent text color, not background
        if (node.type === "TEXT" && node.styles.fills) {
          // Convert fills to text color classes for text nodes
          const fillClasses = fillsToTailwind(node.styles.fills, variableMap);
          // Replace bg- with text- for text color
          const textColorClasses = fillClasses.map(cls => {
            if (cls.startsWith("bg-")) {
              return cls.replace("bg-", "text-");
            }
            return cls;
          });
          classes.push(...textColorClasses);
        } else {
          // For non-text nodes, fills are background
          classes.push(...fillsToTailwind(node.styles.fills, variableMap));
        }
        
        classes.push(...strokesToTailwind(node.styles.strokes, variableMap));
        classes.push(...effectsToTailwind(node.styles.effects));
        
        if (node.styles.visible === false) {
          classes.push("hidden");
        }
        
        tailwindClasses = classes.filter(c => c); // Filter out empty strings
      } catch (error) {
        console.warn("Error generating Tailwind classes", { 
          nodeType: node.type,
          nodeName: node.name,
          error: error instanceof Error ? error.message : String(error)
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
    const attributes = generateAttributes(node.name, node.type, tailwindClasses, indent);

    const openingTag = `${indentStr}<${element}${attributes}\n${indentStr}`;
    html += openingTag;

    const hasChildren = node.children && node.children.length > 0;
    const hasText = node.type === "TEXT" && ((node as any).characters || node.name);

    if (hasChildren || hasText) {
      html += `>`;
      
      if (hasText) {
        const textContent = (node as any).characters || node.name || "";
        html += escapeHTML(textContent);
      }

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
 * Escapes HTML special characters.
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
 * Generates Tailwind config snippet with CSS variables.
 */
function generateTailwindConfig(variableMap: VariableMap): string {
  if (Object.keys(variableMap).length === 0) {
    return "";
  }

  let config = "// Add this to your tailwind.config.js\n";
  config += "module.exports = {\n";
  config += "  theme: {\n";
  config += "    extend: {\n";
  config += "      colors: {\n";
  
  // Separate colors from other variables
  const colorVars: string[] = [];
  const otherVars: string[] = [];
  
  Object.entries(variableMap).forEach(([figmaVarName, cssValue]) => {
    const tailwindVarName = figmaVariableToTailwindClass(figmaVarName);
    const cssVarName = figmaVariableToCSSVariable(figmaVarName);
    
    // Check if it's likely a color (starts with # or rgba/rgb)
    if (typeof cssValue === "string" && (cssValue.startsWith("#") || cssValue.startsWith("rgb"))) {
      colorVars.push(`        '${tailwindVarName}': 'var(${cssVarName})',`);
    } else {
      otherVars.push(`        '${tailwindVarName}': 'var(${cssVarName})',`);
    }
  });
  
  colorVars.forEach(line => config += line + "\n");
  config += "      },\n";
  
  if (otherVars.length > 0) {
    config += "      // Other variables can be added to spacing, fontSize, etc.\n";
  }
  
  config += "    },\n";
  config += "  },\n";
  config += "}\n\n";
  config += "// CSS Variables (add to your global CSS file)\n";
  config += ":root {\n";
  
  Object.entries(variableMap).forEach(([figmaVarName, cssValue]) => {
    const cssVarName = figmaVariableToCSSVariable(figmaVarName);
    config += `  ${cssVarName}: ${cssValue};\n`;
  });
  
  config += "}\n";
  
  return config;
}

/**
 * Generates complete DOM structure from extracted nodes with Tailwind classes.
 */
export function generateTailwindDOM(
  nodes: (ExtractedNode & { styles?: ExtractedStyles })[]
): GeneratedTailwindDOM {
  const variableMap: VariableMap = {};

  // First pass: collect all variables by generating Tailwind classes
  nodes.forEach((node) => {
    if (node.styles) {
      layoutToTailwind(node.styles.layout, variableMap, node.styles.positioning);
      typographyToTailwind(node.styles.typography, variableMap);
      fillsToTailwind(node.styles.fills, variableMap);
      strokesToTailwind(node.styles.strokes, variableMap);
      effectsToTailwind(node.styles.effects); // Note: effects don't store variables, but included for completeness
    }
  });

  // Generate HTML for all nodes with Tailwind classes
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
  
  // Output only HTML, no config header
  const stylesheet = html;

  // Extract unique variable names
  const usedVariables = Object.keys(variableMap)
    .map(figmaVarName => figmaVariableToCSSVariable(figmaVarName))
    .sort();

  return {
    html,
    css: "", // No config needed
    stylesheet: stylesheet,
    usedVariables: usedVariables,
  };
}

