/**
 * @file RAW JSON Generator
 * @module common/rawJsonGenerator
 * 
 * Generates prettified JSON representation of extracted Figma nodes.
 * Used for debugging and as the single source of truth for DOM mapping.
 * 
 * Key exports:
 * - generateRawJSON() - Main generation function
 */

import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { ExtractedStyles } from "@plugin/extractors/styleExtractor";
import { IconExportSettings } from "@common/networkSides";

export interface GeneratedRawJSON {
  json: string;
  stylesheet: string;
  usedVariables: string[];
}

/**
 * Cleans icon metadata by removing svgContent (to keep JSON output smaller).
 * Only includes isIcon and iconName in the output.
 */
function cleanIconMetadata(node: any): any {
  if (!node) return node;
  
  const cleaned = { ...node };
  
  // Clean icon metadata - remove svgContent to keep output smaller
  if (cleaned.icon) {
    cleaned.icon = {
      isIcon: cleaned.icon.isIcon,
      iconName: cleaned.icon.iconName,
    };
  }
  
  // Recursively clean children
  if (cleaned.children && Array.isArray(cleaned.children)) {
    cleaned.children = cleaned.children.map(cleanIconMetadata);
  }
  
  return cleaned;
}

/**
 * Generates a formatted JSON representation of extracted Figma nodes.
 * 
 * This output shows the raw data structure from the Figma API before any
 * CSS or Tailwind conversion, useful for debugging and tracing conversion logic.
 * Icon metadata (isIcon, iconName) is included for detected icons.
 * 
 * @param nodes - Array of extracted nodes with styles
 * @param prettify - Whether to format with indentation (true) or keep compact (false)
 * @param iconSettings - Settings for icon export (used for consistency, metadata is always included)
 * @returns GeneratedRawJSON object with formatted JSON output
 */
export function generateRawJSON(
  nodes: (ExtractedNode & { styles?: ExtractedStyles; characters?: string })[],
  prettify: boolean = true,
  iconSettings: IconExportSettings = { mode: 'none' }
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
      if (layout.minWidthVariable) usedVariables.add(layout.minWidthVariable);
      if (layout.maxWidthVariable) usedVariables.add(layout.maxWidthVariable);
      if (layout.minHeightVariable) usedVariables.add(layout.minHeightVariable);
      if (layout.maxHeightVariable) usedVariables.add(layout.maxHeightVariable);
      if (layout.paddingLeftVariable) usedVariables.add(layout.paddingLeftVariable);
      if (layout.paddingRightVariable) usedVariables.add(layout.paddingRightVariable);
      if (layout.paddingTopVariable) usedVariables.add(layout.paddingTopVariable);
      if (layout.paddingBottomVariable) usedVariables.add(layout.paddingBottomVariable);
      if (layout.itemSpacingVariable) usedVariables.add(layout.itemSpacingVariable);
      if (layout.counterAxisSpacingVariable) usedVariables.add(layout.counterAxisSpacingVariable);
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

    // Effect variables (shadows, blurs)
    const effects = node.styles.effects;
    if (effects && Array.isArray(effects)) {
      effects.forEach((effect: any) => {
        // Effect Style variable (primary method - complete shadow/blur style)
        if (effect.variable) usedVariables.add(effect.variable);
        // Individual property variables (fallback method)
        if (effect.colorVariable) usedVariables.add(effect.colorVariable);
        if (effect.radiusVariable) usedVariables.add(effect.radiusVariable);
        if (effect.spreadVariable) usedVariables.add(effect.spreadVariable);
        if (effect.offsetXVariable) usedVariables.add(effect.offsetXVariable);
        if (effect.offsetYVariable) usedVariables.add(effect.offsetYVariable);
      });
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

  // Clean icon metadata (remove svgContent to keep JSON smaller)
  const cleanedNodes = nodes.map(cleanIconMetadata);

  // Format the JSON - prettified with 2-space indentation or compact
  const json = prettify 
    ? JSON.stringify(cleanedNodes, null, 2)
    : JSON.stringify(cleanedNodes);

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

