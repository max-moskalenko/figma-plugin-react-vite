import { ExtractedStyles } from "@plugin/extractors/styleExtractor";

export interface CSSRule {
  selector: string;
  properties: string[];
  variableComments?: string[];
}

/**
 * Map to store CSS variables: variable name -> CSS value
 */
export interface VariableMap {
  [variableName: string]: string;
}

/**
 * Converts a Figma variable name to a CSS custom property name.
 * 
 * Transforms Figma's naming convention (e.g., "spacing/7") to CSS custom property format
 * (e.g., "--spacing-7"). Replaces slashes and special characters with hyphens.
 * 
 * @param figmaName - The Figma variable name (e.g., "spacing/7", "color/primary")
 * @returns CSS custom property name (e.g., "--spacing-7", "--color-primary")
 */
export function figmaVariableToCSSVariable(figmaName: string): string {
  return `--${figmaName.toLowerCase().replace(/\//g, "-").replace(/[^a-z0-9-]/g, "-")}`;
}

/**
 * Converts a Figma variable value to a CSS-compatible string.
 * 
 * Handles different value types:
 * - Numbers: converted to pixels (e.g., 16 -> "16px")
 * - RGB color objects: converted to rgb() or rgba() format
 * - Objects with value and unit: converted with appropriate unit (px or %)
 * - Other types: converted to string
 * 
 * @param value - The variable value from Figma (can be number, RGB object, or unit object)
 * @returns CSS-compatible string representation
 */
function variableValueToCSS(value: any): string {
  if (typeof value === "number") {
    return `${value}px`;
  } else if (typeof value === "object" && value !== null) {
    // Handle RGB color objects
    if ("r" in value && "g" in value && "b" in value) {
      const r = Math.round(value.r * 255);
      const g = Math.round(value.g * 255);
      const b = Math.round(value.b * 255);
      const a = value.a !== undefined ? value.a : 1;
      if (a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    }
    // Handle other object types (e.g., line height with unit)
    if ("value" in value && "unit" in value) {
      return `${value.value}${value.unit === "PERCENT" ? "%" : "px"}`;
    }
  }
  return String(value);
}

/**
 * Generates a unique, valid CSS class name from a Figma node name and type.
 * 
 * Cleans the node name by removing special characters and converting to kebab-case.
 * Prefixes with the node type for clarity.
 * 
 * @param nodeName - The Figma node name
 * @param nodeType - The Figma node type (e.g., "FRAME", "TEXT")
 * @param index - Optional index suffix for uniqueness (default: 0)
 * @returns Valid CSS class name (e.g., "frame-button-primary", "text-heading-1")
 */
export function generateClassName(nodeName: string, nodeType: string, index: number = 0): string {
  // Clean the node name: remove special chars, convert to kebab-case
  const cleanName = nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  const typePrefix = nodeType.toLowerCase().replace("_", "-");
  const suffix = index > 0 ? `-${index}` : "";
  
  return `${typePrefix}-${cleanName}${suffix}`;
}

/**
 * Converts fill (background) properties to CSS color properties with semantic detection.
 * 
 * CSS GENERATION LOGIC:
 * 1. With Variable:
 *    - Converts Figma variable name to CSS custom property (e.g., "fill/neutral/default" → "--fill-neutral-default")
 *    - SEMANTIC PROPERTY DETECTION: Analyzes variable name to determine correct CSS property:
 *      * Variables with "foreground", "text-color", "text/" → color: var(...)
 *      * Variables with "stroke", "border-color", "border/" → border-color: var(...)
 *      * Variables with "fill", "background", "bg-" → background-color: var(...)
 *    - This prevents semantic errors like "background-color: var(--foreground-neutral)"
 *    - Stores resolved color value in variableMap for :root block generation
 *    - Handles opacity: if opacity < 1, stores as rgba() in variableMap
 * 
 * 2. Without Variable:
 *    - Solid colors: background-color: #{hex}
 *    - Colors with opacity: background-color: rgba(r, g, b, opacity)
 * 
 * 3. Gradients:
 *    - Linear gradients: background: linear-gradient(...)
 *    - Radial gradients: background: radial-gradient(...)
 *    - Gradient stops converted from RGB (0-1) to hex format
 * 
 * NOTE: This function generates CSS properties, not Tailwind classes.
 * For Tailwind output, see fillsToTailwind() in tailwindGenerator.ts
 * 
 * @param fills - Array of extracted fill objects with type, color, opacity, and optional variable
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of CSS property strings (e.g., ["background-color: var(--fill-neutral-default)", "color: var(--foreground-neutral)"])
 */
export function fillsToCSS(fills: any, variableMap: VariableMap): string[] {
  if (!fills || fills.length === 0) return [];

  const properties: string[] = [];
  const fill = fills[0]; // Use first fill for now

  if (fill.type === "SOLID") {
    if (fill.variable) {
      // Use CSS variable - convert Figma variable name to CSS custom property name
      const cssVarName = figmaVariableToCSSVariable(fill.variable);
      // Store the resolved color value in the variableMap for the :root block
      const color = fill.color;
      const opacity = fill.opacity !== undefined ? fill.opacity : 1;
      if (opacity < 1) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        variableMap[fill.variable] = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      } else {
        variableMap[fill.variable] = color;
      }
      
      // SEMANTIC PROPERTY DETECTION:
      // Detect the correct CSS property based on variable name semantics
      // to avoid issues like "background-color: var(--foreground-*)"
      const varNameLower = fill.variable.toLowerCase();
      let cssProperty = 'background-color'; // Default
      
      if (varNameLower.includes('foreground') || varNameLower.includes('text-color') || varNameLower.startsWith('text/')) {
        // Variables with "foreground" or "text" semantics should use color property
        cssProperty = 'color';
      } else if (varNameLower.includes('stroke') || varNameLower.includes('border-color') || varNameLower.startsWith('border/')) {
        // Variables with "stroke" or "border" semantics should use border-color
        cssProperty = 'border-color';
      }
      // Otherwise keep default 'background-color' for fill/background variables
      
      properties.push(`${cssProperty}: var(${cssVarName})`);
    } else {
      // Use raw value
      const color = fill.color;
      const opacity = fill.opacity !== undefined ? fill.opacity : 1;
      if (opacity < 1) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        properties.push(`background-color: rgba(${r}, ${g}, ${b}, ${opacity})`);
      } else {
        properties.push(`background-color: ${color}`);
      }
    }
  } else if (fill.type === "GRADIENT_LINEAR") {
    // Convert gradient stops to CSS gradient
    const stops = fill.gradientStops || [];
    const gradientStops = stops
      .map((stop: any) => {
        const color = rgbToHex(stop.color.r, stop.color.g, stop.color.b);
        return `${color} ${(stop.position || 0) * 100}%`;
      })
      .join(", ");
    properties.push(`background: linear-gradient(${gradientStops})`);
  } else if (fill.type === "GRADIENT_RADIAL") {
    const stops = fill.gradientStops || [];
    const gradientStops = stops
      .map((stop: any) => {
        const color = rgbToHex(stop.color.r, stop.color.g, stop.color.b);
        return `${color} ${(stop.position || 0) * 100}%`;
      })
      .join(", ");
    properties.push(`background: radial-gradient(${gradientStops})`);
  }

  return properties;
}

/**
 * Converts stroke (border) properties to CSS border properties.
 * 
 * Handles both stroke color and stroke weight variables. If variables are bound,
 * generates CSS custom property references and stores resolved values in variableMap.
 * 
 * INDIVIDUAL SIDE SUPPORT:
 * When hasIndividualStrokes is true, generates side-specific border properties:
 * - border-top, border-right, border-bottom, border-left (only for sides that have strokes)
 * Otherwise, generates a single border property for all sides.
 * 
 * @param strokes - Extracted stroke object with strokes array, strokeWeight, individualSides, and variable info
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of CSS property strings (e.g., ["border-bottom: 1px solid #000", "border-left: 2px solid #000"])
 */
export function strokesToCSS(strokes: any, variableMap: VariableMap): string[] {
  if (!strokes || !strokes.strokes || strokes.strokes.length === 0) return [];

  const properties: string[] = [];
  const stroke = strokes.strokes[0];
  const weight = strokes.strokeWeight || 1;
  const align = strokes.strokeAlign || "CENTER";

  if (stroke.type === "SOLID") {
    // Handle stroke color variable
    let borderColor: string;
    if (stroke.variable) {
      // Use CSS variable for color
      const cssVarName = figmaVariableToCSSVariable(stroke.variable);
      const color = stroke.color;
      const opacity = stroke.opacity !== undefined ? stroke.opacity : 1;
      if (opacity < 1) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        variableMap[stroke.variable] = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      } else {
        variableMap[stroke.variable] = color;
      }
      borderColor = `var(${cssVarName})`;
    } else {
      // Use raw value for color
      const color = stroke.color;
      const opacity = stroke.opacity !== undefined ? stroke.opacity : 1;
      if (opacity < 1) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        borderColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      } else {
        borderColor = color;
      }
    }

    // Determine border style based on strokeDashArray
    let borderStyle: string = "solid";
    if (strokes.strokeDashArray && strokes.strokeDashArray.length > 0) {
      // If dash array exists, it's a dashed border
      // Check if it's a simple pattern that could be "dotted" (equal dash and gap)
      const dashPattern = strokes.strokeDashArray;
      if (dashPattern.length === 2 && dashPattern[0] === dashPattern[1] && dashPattern[0] <= 2) {
        borderStyle = "dotted";
      } else {
        borderStyle = "dashed";
      }
      // Note: CSS borders don't support custom dash patterns directly
      // For custom patterns, we use dashed as the closest approximation
    }

    // Check if we have individual side strokes
    if (strokes.hasIndividualStrokes && strokes.individualSides) {
      // Generate side-specific border properties
      const sides = strokes.individualSides;
      
      if (sides.top !== undefined) {
        let sideWidth: string;
        if (strokes.strokeWeightVariable) {
          const cssVarName = figmaVariableToCSSVariable(strokes.strokeWeightVariable);
          variableMap[strokes.strokeWeightVariable] = `${sides.top}px`;
          sideWidth = `var(${cssVarName})`;
        } else {
          sideWidth = `${sides.top}px`;
        }
        properties.push(`border-top: ${sideWidth} ${borderStyle} ${borderColor}`);
      }
      
      if (sides.right !== undefined) {
        let sideWidth: string;
        if (strokes.strokeWeightVariable) {
          const cssVarName = figmaVariableToCSSVariable(strokes.strokeWeightVariable);
          sideWidth = `var(${cssVarName})`;
        } else {
          sideWidth = `${sides.right}px`;
        }
        properties.push(`border-right: ${sideWidth} ${borderStyle} ${borderColor}`);
      }
      
      if (sides.bottom !== undefined) {
        let sideWidth: string;
        if (strokes.strokeWeightVariable) {
          const cssVarName = figmaVariableToCSSVariable(strokes.strokeWeightVariable);
          sideWidth = `var(${cssVarName})`;
        } else {
          sideWidth = `${sides.bottom}px`;
        }
        properties.push(`border-bottom: ${sideWidth} ${borderStyle} ${borderColor}`);
      }
      
      if (sides.left !== undefined) {
        let sideWidth: string;
        if (strokes.strokeWeightVariable) {
          const cssVarName = figmaVariableToCSSVariable(strokes.strokeWeightVariable);
          sideWidth = `var(${cssVarName})`;
        } else {
          sideWidth = `${sides.left}px`;
        }
        properties.push(`border-left: ${sideWidth} ${borderStyle} ${borderColor}`);
      }
    } else {
      // All sides have the same border - use shorthand property
      // Handle strokeWeight variable
      let borderWidth: string;
      if (strokes.strokeWeightVariable) {
        const cssVarName = figmaVariableToCSSVariable(strokes.strokeWeightVariable);
        variableMap[strokes.strokeWeightVariable] = `${weight}px`;
        borderWidth = `var(${cssVarName})`;
      } else {
        borderWidth = `${weight}px`;
      }

      properties.push(`border: ${borderWidth} ${borderStyle} ${borderColor}`);
    }
  }

  // Handle border style for non-SOLID stroke types (if any)
  // Note: Currently only SOLID strokes are fully supported for border color

  return properties;
}

/**
 * Converts visual effects (shadows, blurs) to CSS box-shadow and filter properties.
 * 
 * VARIABLE SUPPORT:
 * Effects can have variable fields (colorVariable, radiusVariable, spreadVariable, etc.)
 * When a shadow has variables, the CSS output uses var(--variable-name) syntax.
 * 
 * @param effects - Array of extracted effect objects with optional variable fields
 * @returns Array of CSS property strings (e.g., ["box-shadow: var(--shadow-dropdown)"])
 */
export function effectsToCSS(effects: any): string[] {
  if (!effects || effects.length === 0) return [];

  const properties: string[] = [];
  const shadows: string[] = [];
  const blurs: string[] = [];
  
  // Check if effects have a style variable (Effect Style)
  const effectStyleVariable = effects.find((e: any) => e.variable)?.variable;
  
  // Collect any shadow-related individual property variables (fallback)
  const shadowVariables: string[] = [];

  effects.forEach((effect: any) => {
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      // Collect any individual property variables from this effect
      if (effect.colorVariable) shadowVariables.push(effect.colorVariable);
      if (effect.radiusVariable) shadowVariables.push(effect.radiusVariable);
      if (effect.spreadVariable) shadowVariables.push(effect.spreadVariable);
      
      const color = effect.color;
      const opacity = effect.opacity !== undefined ? effect.opacity : 1;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
      const shadow = `${inset}${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px rgba(${r}, ${g}, ${b}, ${opacity})`;
      shadows.push(shadow);
    } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
      // Check for Effect Style variable first
      if (effect.variable) {
        const cssVarName = figmaVariableToCSSVariable(effect.variable);
        blurs.push(`blur(var(${cssVarName}))`);
      } else if (effect.radiusVariable) {
        // Fallback to individual property variable
        const cssVarName = figmaVariableToCSSVariable(effect.radiusVariable);
        blurs.push(`blur(var(${cssVarName}))`);
      } else {
        blurs.push(`blur(${effect.radius}px)`);
      }
    }
  });

  if (shadows.length > 0) {
    // Prefer Effect Style variable (e.g., "shadow/lg")
    if (effectStyleVariable) {
      const cssVarName = figmaVariableToCSSVariable(effectStyleVariable);
      properties.push(`box-shadow: var(${cssVarName})`);
    } else if (shadowVariables.length > 0) {
      // Fallback: Use individual property variables
      const shadowToken = shadowVariables.find(v => 
        v.toLowerCase().includes('shadow') || 
        v.toLowerCase().includes('elevation')
      );
      
      if (shadowToken) {
        const cssVarName = figmaVariableToCSSVariable(shadowToken);
        properties.push(`box-shadow: var(${cssVarName})`);
      } else {
        const cssVarName = figmaVariableToCSSVariable(shadowVariables[0]);
        properties.push(`box-shadow: var(${cssVarName})`);
      }
    } else {
      // No variables - use raw shadow values
      properties.push(`box-shadow: ${shadows.join(", ")}`);
    }
  }

  if (blurs.length > 0) {
    properties.push(`filter: ${blurs.join(" ")}`);
  }

  return properties;
}

/**
 * Converts typography properties to CSS font properties.
 * 
 * Handles font family, size, weight, line height, and letter spacing variables.
 * For variable values, generates CSS custom property references and stores resolved
 * values in variableMap. Handles both numeric and object-based values (with units).
 * 
 * @param typography - Extracted typography object with properties and variable names
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of CSS property strings (e.g., ["font-size: var(--font-size-lg)", "font-weight: 700"])
 */
export function typographyToCSS(typography: any, variableMap: VariableMap): string[] {
  if (!typography) return [];

  const properties: string[] = [];

  if (typography.fontFamily) {
    if (typography.fontFamilyVariable) {
      const cssVarName = figmaVariableToCSSVariable(typography.fontFamilyVariable);
      // Store the variable value - fontFamily variable value is usually a string (font family name)
      variableMap[typography.fontFamilyVariable] = `"${typography.fontFamily}"`;
      properties.push(`font-family: var(${cssVarName}), sans-serif`);
    } else {
      properties.push(`font-family: "${typography.fontFamily}", sans-serif`);
    }
  }

  if (typography.fontSize) {
    if (typography.fontSizeVariable) {
      // Use CSS variable
      const cssVarName = figmaVariableToCSSVariable(typography.fontSizeVariable);
      variableMap[typography.fontSizeVariable] = `${typography.fontSize}px`;
      properties.push(`font-size: var(${cssVarName})`);
    } else {
      // Use raw value
      properties.push(`font-size: ${typography.fontSize}px`);
    }
  }

      if (typography.fontWeight) {
        if (typography.fontWeightVariable) {
          const cssVarName = figmaVariableToCSSVariable(typography.fontWeightVariable);
          // Font weight variable values are typically numeric (400, 700, etc.) and can be used directly in CSS
          variableMap[typography.fontWeightVariable] = typography.fontWeight;
          properties.push(`font-weight: var(${cssVarName})`);
        } else {
          // Extract numeric weight from style string (e.g., "Bold" -> "700")
          const weightMap: { [key: string]: string } = {
            thin: "100",
            extralight: "200",
            light: "300",
            regular: "400",
            medium: "500",
            semibold: "600",
            bold: "700",
            extrabold: "800",
            black: "900",
          };
          const weight = weightMap[typography.fontWeight.toLowerCase()] || typography.fontWeight || "400";
          properties.push(`font-weight: ${weight}`);
        }
      }

  if (typography.lineHeight) {
    if (typography.lineHeightVariable) {
      const cssVarName = figmaVariableToCSSVariable(typography.lineHeightVariable);
      // Store the value - handle both number and object formats
      const value = typeof typography.lineHeight === "object" && "unit" in typography.lineHeight
        ? `${typography.lineHeight.value}${typography.lineHeight.unit === "PERCENT" ? "%" : "px"}`
        : `${typography.lineHeight}px`;
      variableMap[typography.lineHeightVariable] = value;
      properties.push(`line-height: var(${cssVarName})`);
    } else {
      if (typeof typography.lineHeight === "object") {
        properties.push(`line-height: ${typography.lineHeight.value}${typography.lineHeight.unit === "PERCENT" ? "%" : "px"}`);
      } else {
        properties.push(`line-height: ${typography.lineHeight}`);
      }
    }
  }

  // Check for letterSpacing OR letterSpacingVariable (value can be 0 but still have a variable)
  if (typography.letterSpacing || typography.letterSpacingVariable) {
    if (typography.letterSpacingVariable) {
      const cssVarName = figmaVariableToCSSVariable(typography.letterSpacingVariable);
      // Store the value - handle both number and object formats
      const value = typeof typography.letterSpacing === "object" && "unit" in typography.letterSpacing
        ? `${typography.letterSpacing.value}${typography.letterSpacing.unit === "PERCENT" ? "%" : "px"}`
        : `${typography.letterSpacing}px`;
      variableMap[typography.letterSpacingVariable] = value;
      properties.push(`letter-spacing: var(${cssVarName})`);
    } else {
      if (typeof typography.letterSpacing === "object") {
        properties.push(`letter-spacing: ${typography.letterSpacing.value}${typography.letterSpacing.unit === "PERCENT" ? "%" : "px"}`);
      } else {
        properties.push(`letter-spacing: ${typography.letterSpacing}px`);
      }
    }
  }

  if (typography.textDecoration) {
    properties.push(`text-decoration: ${typography.textDecoration.toLowerCase()}`);
  }

  if (typography.textCase) {
    if (typography.textCase === "UPPER") {
      properties.push(`text-transform: uppercase`);
    } else if (typography.textCase === "LOWER") {
      properties.push(`text-transform: lowercase`);
    } else if (typography.textCase === "TITLE") {
      properties.push(`text-transform: capitalize`);
    }
  }

  if (typography.textAlignHorizontal) {
    const alignMap: { [key: string]: string } = {
      "LEFT": "left",
      "CENTER": "center",
      "RIGHT": "right",
      "JUSTIFIED": "justify",
    };
    const align = alignMap[typography.textAlignHorizontal] || "left";
    properties.push(`text-align: ${align}`);
  }

  return properties;
}

/**
 * Converts layout properties to CSS layout properties.
 * 
 * CSS GENERATION LOGIC:
 * 
 * 1. Layout Sizing & Flex:
 *    - layoutGrow === 1 → flex: 1 (fills available space)
 *    - layoutSizingHorizontal === "FILL" → flex-grow: 1 or width: 100%
 *    - layoutSizingVertical === "FILL" → height: 100%
 *    - layoutSizing === "HUG" → no property (natural sizing)
 * 
 * 2. Width/Height:
 *    - With Variable: width: var(--width-variable) or height: var(--height-variable)
 *    - Without Variable: width: {value}px or height: {value}px
 *    - Only set if NOT filling AND NOT hugging that dimension
 * 
 * 3. Flex Direction:
 *    - layoutMode exists → display: flex
 *    - layoutMode === "HORIZONTAL" → flex-direction: row
 *    - layoutMode === "VERTICAL" → flex-direction: column
 * 
 * 4. Padding:
 *    - With Variables: Individual properties (padding-top, padding-right, etc.) with var() references
 *    - Without Variables: Shorthand padding: {top}px {right}px {bottom}px {left}px
 *    - Zero padding filtered out
 * 
 * 5. Gap:
 *    - With Variable: gap: var(--itemSpacing-variable)
 *    - Without Variable: gap: {value}px
 *    - Skipped when using SPACE_BETWEEN alignment
 * 
 * 6. Alignment:
 *    - Primary/Counter axis alignment converted to justify-content or align-items
 *    - Values: min → start, center → center, max → end, space-between → space-between
 * 
 * 7. Border Radius:
 *    - With Variable: border-radius: var(--radius-variable)
 *    - Without Variable: border-radius: {value}px
 *    - Per-corner: border-radius: {tl}px {tr}px {br}px {bl}px
 * 
 * 8. Opacity:
 *    - With Variable: opacity: var(--opacity-variable)
 *    - Without Variable: opacity: {value}
 *    - Only generated when opacity < 1
 * 
 * NOTE: This function generates CSS properties, not Tailwind classes.
 * For Tailwind output, see layoutToTailwind() in tailwindGenerator.ts
 * 
 * @param layout - Extracted layout object with properties and variable names
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of CSS property strings (e.g., ["display: flex", "width: var(--width-lg)", "padding: 16px"])
 */
export function layoutToCSS(layout: any, variableMap: VariableMap): string[] {
  if (!layout) return [];

  const properties: string[] = [];

  // Handle layoutGrow (fill behavior) and layoutSizingHorizontal/layoutSizingVertical
  // layoutGrow === 1 means fill in the primary axis direction
  // layoutSizingHorizontal === "FILL" means fill width
  // layoutSizingVertical === "FILL" means fill height
  
  // Always store width/height variables if they exist (for consistency, even if not used when flex: 1)
  if (layout.widthVariable && layout.width !== undefined) {
    variableMap[layout.widthVariable] = `${layout.width}px`;
  }
  if (layout.heightVariable && layout.height !== undefined) {
    variableMap[layout.heightVariable] = `${layout.height}px`;
  }
  
  // Determine if element should fill or hug based on layoutGrow OR layoutSizing properties
  // layoutSizingHorizontal === "FILL" means fill width
  // layoutSizingHorizontal === "HUG" means hug content (skip width, let it be auto)
  // layoutSizingHorizontal === "FIXED" means fixed width (set explicit width)
  // Same logic applies to layoutSizingVertical for height
  const shouldFillWidth = layout.layoutGrow === 1 || layout.layoutSizingHorizontal === "FILL";
  const shouldFillHeight = layout.layoutGrow === 1 || layout.layoutSizingVertical === "FILL";
  const shouldHugWidth = layout.layoutSizingHorizontal === "HUG";
  const shouldHugHeight = layout.layoutSizingVertical === "HUG";
  
  if (shouldFillWidth && shouldFillHeight) {
    properties.push("flex: 1");
  } else if (shouldFillWidth) {
    properties.push("flex-grow: 1"); // Use flex-grow for horizontal fill
  } else if (shouldFillHeight) {
    properties.push("flex-shrink: 0"); // Prevent shrinking, allow height to fill
    properties.push("flex-basis: auto"); // Reset flex-basis
    properties.push("height: 100%"); // Explicitly set height to fill
  }
  
  // Only set width/height if NOT filling AND NOT hugging that dimension
  // HUG means let it size naturally to content (default behavior, no property needed)
  if (!shouldFillWidth && !shouldHugWidth && layout.width !== undefined) {
    if (layout.widthVariable) {
      // Use CSS variable
      const cssVarName = figmaVariableToCSSVariable(layout.widthVariable);
      properties.push(`width: var(${cssVarName})`);
    } else {
      // Use raw value
      properties.push(`width: ${layout.width}px`);
    }
  }

  if (!shouldFillHeight && !shouldHugHeight && layout.height !== undefined) {
    if (layout.heightVariable) {
      // Use CSS variable
      const cssVarName = figmaVariableToCSSVariable(layout.heightVariable);
      properties.push(`height: var(${cssVarName})`);
    } else {
      // Use raw value
      properties.push(`height: ${layout.height}px`);
    }
  }

  // Min/Max width properties
  if (layout.minWidth !== undefined && layout.minWidth !== null) {
    if (layout.minWidthVariable) {
      const cssVarName = figmaVariableToCSSVariable(layout.minWidthVariable);
      variableMap[layout.minWidthVariable] = `${layout.minWidth}px`;
      properties.push(`min-width: var(${cssVarName})`);
    } else {
      properties.push(`min-width: ${layout.minWidth}px`);
    }
  }

  if (layout.maxWidth !== undefined && layout.maxWidth !== null) {
    if (layout.maxWidthVariable) {
      const cssVarName = figmaVariableToCSSVariable(layout.maxWidthVariable);
      variableMap[layout.maxWidthVariable] = `${layout.maxWidth}px`;
      properties.push(`max-width: var(${cssVarName})`);
    } else {
      properties.push(`max-width: ${layout.maxWidth}px`);
    }
  }

  // Min/Max height properties
  if (layout.minHeight !== undefined && layout.minHeight !== null) {
    if (layout.minHeightVariable) {
      const cssVarName = figmaVariableToCSSVariable(layout.minHeightVariable);
      variableMap[layout.minHeightVariable] = `${layout.minHeight}px`;
      properties.push(`min-height: var(${cssVarName})`);
    } else {
      properties.push(`min-height: ${layout.minHeight}px`);
    }
  }

  if (layout.maxHeight !== undefined && layout.maxHeight !== null) {
    if (layout.maxHeightVariable) {
      const cssVarName = figmaVariableToCSSVariable(layout.maxHeightVariable);
      variableMap[layout.maxHeightVariable] = `${layout.maxHeight}px`;
      properties.push(`max-height: var(${cssVarName})`);
    } else {
      properties.push(`max-height: ${layout.maxHeight}px`);
    }
  }

  if (layout.layoutMode) {
    properties.push(`display: flex`);
    properties.push(`flex-direction: ${layout.layoutMode === "HORIZONTAL" ? "row" : "column"}`);

    // Add flex-wrap if wrap is enabled
    if (layout.layoutWrap === "WRAP") {
      properties.push(`flex-wrap: wrap`);
    }

    if (layout.paddingLeft !== undefined || layout.paddingRight !== undefined || layout.paddingTop !== undefined || layout.paddingBottom !== undefined) {
      // Check if any padding has variables
      const hasPaddingVariables = layout.paddingLeftVariable || layout.paddingRightVariable || layout.paddingTopVariable || layout.paddingBottomVariable;
      
      if (hasPaddingVariables) {
        // Use individual padding properties with variables
        if (layout.paddingTop !== undefined) {
          if (layout.paddingTopVariable) {
            const cssVarName = figmaVariableToCSSVariable(layout.paddingTopVariable);
            variableMap[layout.paddingTopVariable] = `${layout.paddingTop}px`;
            properties.push(`padding-top: var(${cssVarName})`);
          } else {
            properties.push(`padding-top: ${layout.paddingTop}px`);
          }
        }
        if (layout.paddingRight !== undefined) {
          if (layout.paddingRightVariable) {
            const cssVarName = figmaVariableToCSSVariable(layout.paddingRightVariable);
            variableMap[layout.paddingRightVariable] = `${layout.paddingRight}px`;
            properties.push(`padding-right: var(${cssVarName})`);
          } else {
            properties.push(`padding-right: ${layout.paddingRight}px`);
          }
        }
        if (layout.paddingBottom !== undefined) {
          if (layout.paddingBottomVariable) {
            const cssVarName = figmaVariableToCSSVariable(layout.paddingBottomVariable);
            variableMap[layout.paddingBottomVariable] = `${layout.paddingBottom}px`;
            properties.push(`padding-bottom: var(${cssVarName})`);
          } else {
            properties.push(`padding-bottom: ${layout.paddingBottom}px`);
          }
        }
        if (layout.paddingLeft !== undefined) {
          if (layout.paddingLeftVariable) {
            const cssVarName = figmaVariableToCSSVariable(layout.paddingLeftVariable);
            variableMap[layout.paddingLeftVariable] = `${layout.paddingLeft}px`;
            properties.push(`padding-left: var(${cssVarName})`);
          } else {
            properties.push(`padding-left: ${layout.paddingLeft}px`);
          }
        }
      } else {
        // Use shorthand padding if no variables
        const padding = [
          layout.paddingTop || 0,
          layout.paddingRight || 0,
          layout.paddingBottom || 0,
          layout.paddingLeft || 0,
        ];
        properties.push(`padding: ${padding.join("px ")}px`);
      }
    }

    // Always store spacing variables if they exist (for consistency)
    if (layout.itemSpacingVariable && layout.itemSpacing !== undefined) {
      variableMap[layout.itemSpacingVariable] = `${layout.itemSpacing}px`;
    }
    if (layout.counterAxisSpacingVariable && layout.counterAxisSpacing !== undefined) {
      variableMap[layout.counterAxisSpacingVariable] = `${layout.counterAxisSpacing}px`;
    }
    
    // GAP HANDLING:
    // When wrapping is enabled, use separate row-gap and column-gap
    // When not wrapping, use single gap property
    const isHorizontal = layout.layoutMode === "HORIZONTAL";
    const hasCounterAxisSpacing = layout.counterAxisSpacing !== undefined && layout.counterAxisSpacing !== null;
    const isWrapping = layout.layoutWrap === "WRAP";
    const skipGapForSpaceBetween = layout.primaryAxisAlignItems === "SPACE_BETWEEN" || layout.counterAxisAlignItems === "SPACE_BETWEEN";
    
    if (isWrapping && hasCounterAxisSpacing && layout.itemSpacing !== undefined && !skipGapForSpaceBetween) {
      // Separate row-gap and column-gap for wrap mode
      if (isHorizontal) {
        // itemSpacing = column-gap, counterAxisSpacing = row-gap
        if (layout.itemSpacingVariable) {
          const cssVarName = figmaVariableToCSSVariable(layout.itemSpacingVariable);
          properties.push(`column-gap: var(${cssVarName})`);
        } else {
          properties.push(`column-gap: ${layout.itemSpacing}px`);
        }
        if (layout.counterAxisSpacingVariable) {
          const cssVarName = figmaVariableToCSSVariable(layout.counterAxisSpacingVariable);
          properties.push(`row-gap: var(${cssVarName})`);
        } else {
          properties.push(`row-gap: ${layout.counterAxisSpacing}px`);
        }
      } else {
        // Vertical: itemSpacing = row-gap, counterAxisSpacing = column-gap
        if (layout.itemSpacingVariable) {
          const cssVarName = figmaVariableToCSSVariable(layout.itemSpacingVariable);
          properties.push(`row-gap: var(${cssVarName})`);
        } else {
          properties.push(`row-gap: ${layout.itemSpacing}px`);
        }
        if (layout.counterAxisSpacingVariable) {
          const cssVarName = figmaVariableToCSSVariable(layout.counterAxisSpacingVariable);
          properties.push(`column-gap: var(${cssVarName})`);
        } else {
          properties.push(`column-gap: ${layout.counterAxisSpacing}px`);
        }
      }
    } else if (layout.itemSpacing !== undefined && !skipGapForSpaceBetween) {
      // Single gap property (non-wrap mode or no counter axis spacing)
      if (layout.itemSpacingVariable) {
        const cssVarName = figmaVariableToCSSVariable(layout.itemSpacingVariable);
        properties.push(`gap: var(${cssVarName})`);
      } else {
        properties.push(`gap: ${layout.itemSpacing}px`);
      }
    }
    
    // Add align-content for wrapped layouts
    if (isWrapping && layout.counterAxisAlignContent) {
      if (layout.counterAxisAlignContent === "SPACE_BETWEEN") {
        properties.push(`align-content: space-between`);
      }
      // AUTO doesn't need explicit property (default behavior)
    }

    if (layout.primaryAxisAlignItems) {
      if (layout.layoutMode === "HORIZONTAL") {
        properties.push(`justify-content: ${layout.primaryAxisAlignItems.toLowerCase().replace("_", "-")}`);
      } else {
        properties.push(`align-items: ${layout.primaryAxisAlignItems.toLowerCase().replace("_", "-")}`);
      }
    }

    if (layout.counterAxisAlignItems) {
      if (layout.layoutMode === "HORIZONTAL") {
        properties.push(`align-items: ${layout.counterAxisAlignItems.toLowerCase().replace("_", "-")}`);
      } else {
        properties.push(`justify-content: ${layout.counterAxisAlignItems.toLowerCase().replace("_", "-")}`);
      }
    }
  }

  if (layout.cornerRadius !== undefined) {
    if (layout.cornerRadiusVariable) {
      const cssVarName = figmaVariableToCSSVariable(layout.cornerRadiusVariable);
      if (typeof layout.cornerRadius === "number") {
        variableMap[layout.cornerRadiusVariable] = `${layout.cornerRadius}px`;
        properties.push(`border-radius: var(${cssVarName})`);
      } else if (typeof layout.cornerRadius === "object") {
        // For object corner radius, we can't use a single variable, so use raw values
        const { topLeft, topRight, bottomRight, bottomLeft } = layout.cornerRadius;
        properties.push(`border-radius: ${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`);
      }
    } else {
      if (typeof layout.cornerRadius === "number") {
        properties.push(`border-radius: ${layout.cornerRadius}px`);
      } else if (typeof layout.cornerRadius === "object") {
        // Handle different radius per corner
        const { topLeft, topRight, bottomRight, bottomLeft } = layout.cornerRadius;
        properties.push(`border-radius: ${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`);
      }
    }
  }

  if (layout.opacity !== undefined && layout.opacity < 1) {
    if (layout.opacityVariable) {
      const cssVarName = figmaVariableToCSSVariable(layout.opacityVariable);
      variableMap[layout.opacityVariable] = String(layout.opacity);
      properties.push(`opacity: var(${cssVarName})`);
    } else {
      properties.push(`opacity: ${layout.opacity}`);
    }
  }

  return properties;
}

/**
 * Converts RGB color values (0-1 range) to hexadecimal color string.
 * Used internally for gradient stops and effects.
 * 
 * @param r - Red component (0-1)
 * @param g - Green component (0-1)
 * @param b - Blue component (0-1)
 * @returns Hexadecimal color string (e.g., "#ff0000")
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generates a CSS rule from extracted styles for a given class name.
 * 
 * Combines all style categories (layout, typography, fills, strokes, effects) into
 * a single CSS rule. Properties are added in logical order for readability.
 * 
 * @param className - The CSS class name to generate
 * @param styles - Extracted styles object
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns CSSRule object with selector and properties array
 */
export function generateCSSRules(
  className: string,
  styles: ExtractedStyles,
  variableMap: VariableMap
): CSSRule {
  const properties: string[] = [];
  const variableComments: string[] = [];

  // Add properties in logical order
  properties.push(...layoutToCSS(styles.layout, variableMap));
  properties.push(...typographyToCSS(styles.typography, variableMap));
  properties.push(...fillsToCSS(styles.fills, variableMap));
  properties.push(...strokesToCSS(styles.strokes, variableMap));
  properties.push(...effectsToCSS(styles.effects));

  if (styles.visible === false) {
    properties.push("display: none");
  }

  return {
    selector: `.${className}`,
    properties,
    variableComments,
  };
}

/**
 * Generates a complete CSS stylesheet from multiple CSS rules.
 * 
 * Creates a :root block with all CSS custom properties from variableMap,
 * followed by all CSS rules. This is used for the standalone CSS output.
 * 
 * @param rules - Array of CSSRule objects to include in the stylesheet
 * @param variableMap - Map of variable names to CSS values for the :root block
 * @returns Complete CSS stylesheet string wrapped in <style> tags
 */
export function generateStylesheet(rules: CSSRule[], variableMap: VariableMap): string {
  // Generate :root section with CSS custom properties
  let rootSection = "";
  if (Object.keys(variableMap).length > 0) {
    rootSection = "  :root {\n";
    for (const [figmaVarName, cssValue] of Object.entries(variableMap)) {
      const cssVarName = figmaVariableToCSSVariable(figmaVarName);
      rootSection += `    ${cssVarName}: ${cssValue};\n`;
    }
    rootSection += "  }\n\n";
  }

  // Generate regular CSS rules
  const cssRules = rules.map((rule) => {
    const props = rule.properties.filter((p) => !p.startsWith("/*"));
    const comments = rule.properties.filter((p) => p.startsWith("/*"));
    
    let css = `  ${rule.selector} {\n`;
    props.forEach((prop) => {
      css += `    ${prop};\n`;
    });
    if (comments.length > 0) {
      css += `    ${comments.join("\n    ")}\n`;
    }
    css += `  }\n`;
    return css;
  });

  return `<style>\n${rootSection}${cssRules.join("\n")}</style>`;
}

