import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { VariableMap, figmaVariableToCSSVariable } from "./cssGenerator";
import { ExtractedStyles } from "@plugin/extractors/styleExtractor";
import { AnnotationFormat, IconExportSettings } from "@common/networkSides";
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
 * Formats an annotation string based on the specified format.
 */
function formatAnnotation(annotation: string, format: AnnotationFormat, indent: string): string {
  if (format === "none") {
    return "";
  }
  
  const escapedAnnotation = annotation
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  if (format === "tsx") {
    return `${indent}{/* ${escapedAnnotation} */}\n`;
  }
  
  return `${indent}<!-- ${escapedAnnotation} -->\n`;
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
 * Filters out utilitarian properties like "isIcon" that shouldn't appear as classes.
 * 
 * @param nodeName - The node name (e.g., "Slider.Root", "Label.Root")
 * @returns Tailwind-friendly class name (e.g., "slider-root", "label-root")
 */
function nodeNameToTailwindClass(nodeName: string): string {
  // Remove isIcon property from the name (e.g., "isIcon=True, Size=md" → "Size=md")
  const cleanedName = nodeName
    .replace(/,?\s*isIcon\s*=\s*(true|false)\s*,?/gi, ',')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim();
  
  return cleanedName
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
  indent: number,
  prettify: boolean
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

  if (prettify) {
    return `\n${indentStr}  ${attrs.join(`\n${indentStr}  `)}`;
  } else {
    return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  }
}

/**
 * Recursively generates HTML from an extracted node tree with Tailwind classes.
 * Handles icon nodes based on iconSettings (npm-package mode transforms to component imports).
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
        
        // SPECIAL CASE: Text node color handling
        // In Figma, TEXT nodes use "fills" for text color, not background color.
        // We need to convert bg-* classes to text-* classes for text nodes.
        // Example: bg-fill-neutral-default → text-fill-neutral-default
        if (node.type === "TEXT" && node.styles.fills) {
          // Convert fills to text color classes for text nodes
          const fillClasses = fillsToTailwind(node.styles.fills, variableMap);
          // Replace bg- prefix with text- prefix for text color
          const textColorClasses = fillClasses.map(cls => {
            if (cls.startsWith("bg-")) {
              return cls.replace("bg-", "text-");
            }
            return cls;
          });
          classes.push(...textColorClasses);
        } else {
          // For non-text nodes, fills are background colors
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

    // Add annotations before the element (format depends on annotationFormat)
    let html = "";
    if (node.annotations && node.annotations.length > 0) {
      node.annotations.forEach((annotation) => {
        html += formatAnnotation(annotation, annotationFormat, indentStr);
      });
    }

    // Handle icon nodes - NPM package mode transforms icons to component imports
    // Don't include node name as a class since the component name already identifies it
    if (node.icon?.isIcon && iconSettings.mode === 'npm-package') {
      const packageName = iconSettings.packageName || '@phosphor-icons/react';
      imports.add(`import { ${node.icon.iconName} } from '${packageName}';`);
      const classes = tailwindClasses.filter(c => c).join(' ');
      return indentStr + generateTailwindIconComponent(node.icon.iconName, classes);
    }

    const element = nodeTypeToHTMLElement(node.type, node.type === "TEXT");
    const attributes = generateAttributes(node.name, node.type, tailwindClasses, indent, prettify);

    const openingTag = prettify
      ? `${indentStr}<${element}${attributes}${newline}${indentStr}`
      : `${indentStr}<${element}${attributes}`;
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
 * Generates icon component code for npm-package mode with Tailwind classes.
 * 
 * @param iconName - Name of the icon component
 * @param className - Tailwind class string
 * @returns HTML string for the icon component
 */
function generateTailwindIconComponent(iconName: string, className: string): string {
  const classAttr = className ? ` className="${className}"` : '';
  return `<${iconName}${classAttr} />`;
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
 * Handles icon nodes based on iconSettings.
 */
export function generateTailwindDOM(
  nodes: (ExtractedNode & { styles?: ExtractedStyles })[],
  annotationFormat: AnnotationFormat = "html",
  prettify: boolean = true,
  iconSettings: IconExportSettings = { mode: 'none' }
): GeneratedTailwindDOM {
  const variableMap: VariableMap = {};
  const imports: Set<string> = new Set();

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

