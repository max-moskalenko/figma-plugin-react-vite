import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { ExtractedStyles } from "@plugin/extractors/styleExtractor";

export interface GeneratedRawJSON {
  json: string;
  stylesheet: string;
  usedVariables: string[];
}

/**
 * Generates a formatted JSON representation of extracted Figma nodes.
 * 
 * This output shows the raw data structure from the Figma API before any
 * CSS or Tailwind conversion, useful for debugging and tracing conversion logic.
 * 
 * @param nodes - Array of extracted nodes with styles
 * @param prettify - Whether to format with indentation (true) or keep compact (false)
 * @returns GeneratedRawJSON object with formatted JSON output
 */
export function generateRawJSON(
  nodes: (ExtractedNode & { styles?: ExtractedStyles; characters?: string })[],
  prettify: boolean = true
): GeneratedRawJSON {
  // Collect all variable names used across all nodes
  const usedVariables: Set<string> = new Set();

  /**
   * Recursively extracts variable names from a node's styles
   */
  function collectVariables(node: ExtractedNode & { styles?: ExtractedStyles }) {
    if (!node.styles) return;

    const { layout, typography, fills, strokes } = node.styles;

    // Layout variables
    if (layout) {
      if (layout.widthVariable) usedVariables.add(layout.widthVariable);
      if (layout.heightVariable) usedVariables.add(layout.heightVariable);
      if (layout.paddingLeftVariable) usedVariables.add(layout.paddingLeftVariable);
      if (layout.paddingRightVariable) usedVariables.add(layout.paddingRightVariable);
      if (layout.paddingTopVariable) usedVariables.add(layout.paddingTopVariable);
      if (layout.paddingBottomVariable) usedVariables.add(layout.paddingBottomVariable);
      if (layout.itemSpacingVariable) usedVariables.add(layout.itemSpacingVariable);
      if (layout.cornerRadiusVariable) usedVariables.add(layout.cornerRadiusVariable);
      if (layout.opacityVariable) usedVariables.add(layout.opacityVariable);
    }

    // Typography variables
    if (typography) {
      if (typography.fontSizeVariable) usedVariables.add(typography.fontSizeVariable);
      if (typography.lineHeightVariable) usedVariables.add(typography.lineHeightVariable);
      if (typography.letterSpacingVariable) usedVariables.add(typography.letterSpacingVariable);
      if (typography.fontFamilyVariable) usedVariables.add(typography.fontFamilyVariable);
      if (typography.fontWeightVariable) usedVariables.add(typography.fontWeightVariable);
    }

    // Fill variables
    if (fills && Array.isArray(fills)) {
      fills.forEach((fill: any) => {
        if (fill.variable) usedVariables.add(fill.variable);
      });
    }

    // Stroke variables
    if (strokes) {
      if (strokes.strokeWeightVariable) usedVariables.add(strokes.strokeWeightVariable);
      if (strokes.strokes && Array.isArray(strokes.strokes)) {
        strokes.strokes.forEach((stroke: any) => {
          if (stroke.variable) usedVariables.add(stroke.variable);
        });
      }
    }

    // Recurse into children
    if (node.children) {
      node.children.forEach((child) => {
        collectVariables(child as ExtractedNode & { styles?: ExtractedStyles });
      });
    }
  }

  // Collect all variables
  nodes.forEach(collectVariables);

  // Format the JSON - prettified with 2-space indentation or compact
  const json = prettify 
    ? JSON.stringify(nodes, null, 2)
    : JSON.stringify(nodes);

  // Convert variable names to CSS variable format for consistency with other generators
  const usedVariablesArray = Array.from(usedVariables)
    .map(name => `--${name.replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase()}`)
    .sort();

  return {
    json,
    stylesheet: json,
    usedVariables: usedVariablesArray,
  };
}

