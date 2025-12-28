import { PLUGIN, UI, AnnotationFormat } from "@common/networkSides";
import { traverseSelection } from "@plugin/extractors/componentTraverser";
import { extractStyles, getAllVariables, extractComponentProperties } from "@plugin/extractors/styleExtractor";
import { generateDOM } from "@common/domGenerator";
import { generateTailwindDOM } from "@common/tailwindDomGenerator";
import { generateRawJSON } from "@common/rawJsonGenerator";

export const PLUGIN_CHANNEL = PLUGIN.channelBuilder()
  .emitsTo(UI, (message) => {
    figma.ui.postMessage(message);
  })
  .receivesFrom(UI, (next) => {
    const listener: MessageEventHandler = (event) => next(event);
    figma.ui.on("message", listener);
    return () => figma.ui.off("message", listener);
  })
  .startListening();

// ---------- Message handlers

PLUGIN_CHANNEL.registerMessageHandler("ping", () => {
  return "pong";
});

PLUGIN_CHANNEL.registerMessageHandler("hello", (text) => {
  console.log("UI side said:", text);
});

/**
 * Determines the type label for a Figma node.
 */
function getNodeTypeLabel(node: SceneNode): string {
  // Check for component-related types first
  if (node.type === "COMPONENT_SET") {
    return "Component Set";
  }
  
  if (node.type === "COMPONENT") {
    // Check if it's a variant (has a parent that is a COMPONENT_SET)
    if (node.parent && node.parent.type === "COMPONENT_SET") {
      return "Variant";
    }
    return "Component";
  }
  
  if (node.type === "INSTANCE") {
    return "Instance";
  }
  
  // Frame types
  if (node.type === "FRAME") {
    return "Frame";
  }
  
  if (node.type === "GROUP") {
    return "Group";
  }
  
  // Shape types
  if (node.type === "RECTANGLE") {
    return "Rectangle";
  }
  
  if (node.type === "ELLIPSE") {
    return "Ellipse";
  }
  
  if (node.type === "POLYGON") {
    return "Polygon";
  }
  
  if (node.type === "STAR") {
    return "Star";
  }
  
  if (node.type === "LINE") {
    return "Line";
  }
  
  if (node.type === "VECTOR") {
    return "Vector";
  }
  
  // Text
  if (node.type === "TEXT") {
    return "Text";
  }
  
  // Boolean operations
  if (node.type === "BOOLEAN_OPERATION") {
    return "Boolean";
  }
  
  // Section
  if (node.type === "SECTION") {
    return "Section";
  }
  
  // Slice
  if (node.type === "SLICE") {
    return "Slice";
  }
  
  // Fallback to the raw type
  return node.type.charAt(0) + node.type.slice(1).toLowerCase().replace(/_/g, " ");
}

/**
 * Gets the name and type of the currently selected node(s) in Figma.
 * Used to update the UI when selection changes.
 * 
 * @returns Object with name and type of the first selected node
 */
PLUGIN_CHANNEL.registerMessageHandler("getSelectionName", async () => {
  const selectedNodes = figma.currentPage.selection;
  
  if (selectedNodes.length === 0) {
    return { name: "No selection", type: "" };
  }
  
  const node = selectedNodes[0];
  return {
    name: node.name || "Unnamed",
    type: getNodeTypeLabel(node)
  };
});

/**
 * Resizes the plugin window
 */
PLUGIN_CHANNEL.registerMessageHandler("resizeWindow", (width, height) => {
  // Clamp to min/max bounds
  const minWidth = 600;
  const maxWidth = 1400;
  const minHeight = 400;
  const maxHeight = 900;
  
  const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width));
  const clampedHeight = Math.max(minHeight, Math.min(maxHeight, height));
  
  figma.ui.resize(clampedWidth, clampedHeight);
});

PLUGIN_CHANNEL.registerMessageHandler("createRect", (width, height) => {
  if (figma.editorType === "figma") {
    const rect = figma.createRectangle();
    rect.x = 0;
    rect.y = 0;
    rect.name = "Plugin Rectangle # " + Math.floor(Math.random() * 9999);
    rect.fills = [
      {
        type: "SOLID",
        color: {
          r: Math.random(),
          g: Math.random(),
          b: Math.random(),
        },
      },
    ];
    rect.resize(width, height);
    figma.currentPage.appendChild(rect);
    figma.viewport.scrollAndZoomIntoView([rect]);
    figma.closePlugin();
  }
});

PLUGIN_CHANNEL.registerMessageHandler("exportSelection", async () => {
  const selectedNodes = figma.currentPage.selection;
  if (selectedNodes.length === 0) {
    throw new Error("No selection is present.");
  }

  const selection = selectedNodes[0];
  const bytes = await selection.exportAsync({
    format: "PNG",
    contentsOnly: false,
  });

  return "data:image/png;base64," + figma.base64Encode(bytes);
});

/**
 * Main extraction handler: extracts component DOM structure from selected Figma nodes.
 * 
 * Extraction process:
 * 1. Handles COMPONENT_SET nodes by extracting all component variants
 * 2. Traverses nodes to build tree structure
 * 3. Recursively extracts styles (with variable resolution) and text content
 * 4. Generates all three output formats at once: CSS, Tailwind, and Raw JSON
 * 
 * @param annotationFormat - Format for annotations: "html", "tsx", or "none"
 * @param prettify - Whether to prettify the output (true) or use compact format (false)
 * @returns Object with css, tailwind, and raw outputs, plus componentName and variableMappings
 */
PLUGIN_CHANNEL.registerMessageHandler("extractComponent", async (annotationFormat: AnnotationFormat = "html", prettify: boolean = true) => {
  const selectedNodes = figma.currentPage.selection;
  
  if (selectedNodes.length === 0) {
    throw new Error("Please select at least one component to extract.");
  }

  try {
    // Step 1: Handle COMPONENT_SET nodes - extract all component variants from the set
    // When a COMPONENT_SET is selected, we extract all individual component variants
    // instead of just the set itself, so users get all variants in the output
    let nodesToExtract: SceneNode[] = [];
    for (const node of selectedNodes) {
      if (node.type === "COMPONENT_SET") {
        // Get all component variants from the set
        if ("children" in node && node.children.length > 0) {
          node.children.forEach((child) => {
            if (child.type === "COMPONENT") {
              nodesToExtract.push(child);
            }
          });
        } else {
          // Fallback: if no children, use the node itself (shouldn't happen in normal cases)
          nodesToExtract.push(node);
        }
      } else {
        nodesToExtract.push(node);
      }
    }
    
    // Step 2: Get all variable collections for resolving variable bindings
    const variables = getAllVariables();

    // Step 3: Traverse the selected components to build node tree structure
    // This creates a hierarchical representation of the component structure
    const extractedNodes = traverseSelection(nodesToExtract);

    /**
     * Recursively extracts styles for a node and its children.
     * 
     * This function is async because font loading is required before accessing
     * text content from TEXT nodes. The function:
     * - Extracts styles (with variable resolution) for the current node
     * - Loads fonts and extracts text content for TEXT nodes
     * - Recursively processes all children
     * 
     * @param node - The extracted node structure (will be populated with styles)
     * @param figmaNode - The original Figma node to extract from
     */
    async function extractStylesRecursive(node: any, figmaNode: SceneNode) {
      // Extract styles for current node (includes variable resolution)
      try {
        node.styles = extractStyles(figmaNode, variables);
      } catch (styleError) {
        // Continue with empty styles rather than failing completely
        // This allows partial extraction if some nodes have issues
        node.styles = null;
      }

      // Extract text content if it's a text node
      // Font loading is required before accessing characters property
      if (figmaNode.type === "TEXT") {
        const textNode = figmaNode as TextNode;
        try {
          // Load font if needed (required before accessing characters)
          if (textNode.fontName !== figma.mixed && textNode.fontName) {
            await figma.loadFontAsync(textNode.fontName as FontName);
          }
          (node as any).characters = textNode.characters;
        } catch (e) {
          console.warn(`Could not load text content for ${textNode.name}:`, e);
          // Fallback to node name if text extraction fails
          (node as any).characters = textNode.name || "";
        }
      }

      // Recursively extract styles for children
      if (node.children && "children" in figmaNode) {
        const figmaChildren = (figmaNode as ChildrenMixin).children;
        
        // Process each child, maintaining the same order
        for (let index = 0; index < node.children.length; index++) {
          if (figmaChildren[index]) {
            try {
              await extractStylesRecursive(node.children[index], figmaChildren[index]);
            } catch (childError) {
              throw childError;
            }
          }
        }
      }
    }

    // Step 4: Extract styles for all root nodes recursively
    // This processes the entire tree structure, extracting styles and text content
    for (let index = 0; index < nodesToExtract.length; index++) {
      if (extractedNodes[index]) {
        try {
          await extractStylesRecursive(extractedNodes[index], nodesToExtract[index]);
        } catch (styleError) {
          throw new Error(`Failed to extract styles for ${nodesToExtract[index].name}: ${styleError instanceof Error ? styleError.message : "Unknown error"}`);
        }
      }
    }

    // Step 5: Generate all three output formats from extracted nodes with styles
    // CSS: HTML with inline styles using CSS variables
    // Tailwind: HTML with Tailwind utility classes
    // Raw: JSON representation of the extracted node structure
    let cssDom;
    let tailwindDom;
    let rawJson;
    
    try {
      cssDom = generateDOM(extractedNodes, annotationFormat, prettify);
    } catch (domError) {
      throw new Error(`Failed to generate CSS DOM: ${domError instanceof Error ? domError.message : "Unknown error"}`);
    }
    
    try {
      tailwindDom = generateTailwindDOM(extractedNodes, annotationFormat, prettify);
    } catch (domError) {
      throw new Error(`Failed to generate Tailwind DOM: ${domError instanceof Error ? domError.message : "Unknown error"}`);
    }
    
    try {
      rawJson = generateRawJSON(extractedNodes, prettify);
    } catch (jsonError) {
      throw new Error(`Failed to generate Raw JSON: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}`);
    }
    
    // Get component name from first selected node (use original selection for naming)
    const componentName = selectedNodes.length > 0 
      ? selectedNodes[0].name || "Component"
      : "Component";

    // Collect variable mappings for reference (optional metadata)
    const variableMappings: Array<{ name: string; value: any }> = [];
    variables.forEach((collection) => {
      collection.variableIds.forEach((variableId) => {
        try {
          const variable = figma.variables.getVariableById(variableId);
          if (variable) {
            const modeId = collection.modes[0]?.modeId || "";
            const value = variable.valuesByMode[modeId];
            variableMappings.push({
              name: variable.name,
              value: value,
            });
          }
        } catch (e) {
          console.warn(`Could not get variable ${variableId}:`, e);
        }
      });
    });

    // Combine all used variables from all formats (deduplicated)
    const allUsedVariables = [...new Set([
      ...cssDom.usedVariables,
      ...tailwindDom.usedVariables,
      ...rawJson.usedVariables,
    ])].sort();

    // Extract component properties if available
    // Use the original selection (which may be a COMPONENT_SET) for property extraction
    let componentProperties = null;
    for (const node of selectedNodes) {
      const props = extractComponentProperties(node);
      if (props) {
        componentProperties = {
          definitions: props.definitions.map(d => ({
            name: d.name,
            type: d.type,
            defaultValue: d.defaultValue,
            variantOptions: d.variantOptions,
          })),
          variants: props.variants.map(v => ({
            variantId: v.variantId,
            variantName: v.variantName,
            properties: v.properties,
          })),
        };
        break; // Use the first node with component properties
      }
    }

    const result = {
      // CSS format output
      css: {
        html: cssDom.html,
        stylesheet: cssDom.stylesheet,
        usedVariables: cssDom.usedVariables,
      },
      // Tailwind format output
      tailwind: {
        html: tailwindDom.html,
        stylesheet: tailwindDom.stylesheet,
        usedVariables: tailwindDom.usedVariables,
      },
      // Raw JSON format output
      raw: {
        json: rawJson.json,
        stylesheet: rawJson.stylesheet,
        usedVariables: rawJson.usedVariables,
      },
      // Shared metadata
      componentName: componentName,
      variableMappings: variableMappings.length > 0 ? variableMappings : undefined,
      usedVariables: allUsedVariables.length > 0 ? allUsedVariables : undefined,
      componentProperties: componentProperties || undefined,
    };
    
    return result;
  } catch (error) {
    console.error("Error extracting component:", error);
    throw new Error(`Failed to extract component: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});
