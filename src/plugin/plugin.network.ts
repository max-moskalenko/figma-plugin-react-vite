import { PLUGIN, UI } from "@common/networkSides";
import { traverseSelection } from "@plugin/extractors/componentTraverser";
import { extractStyles, getAllVariables } from "@plugin/extractors/styleExtractor";
import { generateDOM } from "@common/domGenerator";
import { generateTailwindDOM } from "@common/tailwindDomGenerator";

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
 * Gets the name of the currently selected node(s) in Figma.
 * Used to update the UI when selection changes.
 * 
 * @returns The name of the first selected node, or "No selection" if nothing is selected
 */
PLUGIN_CHANNEL.registerMessageHandler("getSelectionName", async () => {
  const selectedNodes = figma.currentPage.selection;
  
  if (selectedNodes.length === 0) {
    return "No selection";
  }
  
  // Return the name of the first selected node
  return selectedNodes[0].name || "Unnamed";
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
 * 4. Generates HTML with inline styles and CSS variables (CSS format) or Tailwind classes (Tailwind format)
 * 
 * @param format - Output format: "css" (default) for inline styles, "tailwind" for utility classes
 * @returns Object with html, css (variables block), stylesheet (combined), componentName, and variableMappings
 */
PLUGIN_CHANNEL.registerMessageHandler("extractComponent", async (format: "css" | "tailwind" = "css") => {
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

    // Step 5: Generate DOM from extracted nodes with styles
    // This creates HTML with inline styles and CSS variables (CSS format) or Tailwind classes (Tailwind format)
    let dom;
    try {
      if (format === "tailwind") {
        dom = generateTailwindDOM(extractedNodes);
      } else {
        dom = generateDOM(extractedNodes);
      }
    } catch (domError) {
      throw new Error(`Failed to generate DOM: ${domError instanceof Error ? domError.message : "Unknown error"}`);
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

    const result = {
      html: dom.html,
      css: dom.css,
      stylesheet: dom.stylesheet,
      componentName: componentName,
      variableMappings: variableMappings.length > 0 ? variableMappings : undefined,
      usedVariables: dom.usedVariables.length > 0 ? dom.usedVariables : undefined,
    };
    
    return result;
  } catch (error) {
    console.error("Error extracting component:", error);
    throw new Error(`Failed to extract component: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});
