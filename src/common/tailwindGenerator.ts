import { ExtractedStyles } from "@plugin/extractors/styleExtractor";
import { VariableMap, figmaVariableToCSSVariable } from "./cssGenerator";

export interface TailwindClass {
  classes: string[];
  variableComments?: string[];
}

/**
 * Converts a Figma variable name to a Tailwind-friendly class name.
 * Removes the leading "--" from CSS variable format and keeps the rest.
 * Preserves the original variable naming structure.
 * 
 * @param figmaName - The Figma variable name (e.g., "fill/neutral/default")
 * @returns Tailwind class name (e.g., "fill-neutral-default")
 */
export function figmaVariableToTailwindClass(figmaName: string): string {
  // Convert to kebab-case, preserving the structure
  return figmaName.toLowerCase().replace(/\//g, "-").replace(/[^a-z0-9-]/g, "-");
}

/**
 * Extracts the Tailwind scale value from a spacing variable name.
 * 
 * This function parses Figma variable names to extract numeric or semantic values
 * that can be used directly in Tailwind utility classes. It handles various
 * naming conventions used in design systems.
 * 
 * REMAPPING EXAMPLES:
 * - "spacing-7" → "7" → generates classes like "p-7", "gap-7", "w-7", "h-7"
 * - "spacing-1" → "1" → generates classes like "p-1", "gap-1"
 * - "spacing-0-5" → "0.5" → generates classes like "p-0.5", "gap-0.5"
 * - "spacing-px" → "px" → generates classes like "p-px", "gap-px" (1px in Tailwind)
 * - "spacing/7" → "7" (normalized from slash to hyphen)
 * 
 * PATTERN MATCHING:
 * 1. Special case: "spacing-px" → returns "px" (Tailwind's 1px value)
 * 2. Hyphen format: "spacing-0-5" → matches "spacing-(\d+)-(\d+)" → converts to "0.5"
 * 3. Dot format: "spacing-0.5" → matches "spacing-([\d.]+)" → returns "0.5"
 * 4. Integer format: "spacing-7" → matches "spacing-([\d.]+)" → returns "7"
 * 
 * @param variableName - The variable name (e.g., "spacing-7", "spacing/7", "spacing-0-5")
 * @returns The scale value (e.g., "7", "1", "0.5", "px") or null if not a spacing variable
 */
function extractSpacingValue(variableName: string): string | null {
  // Normalize: convert slashes to hyphens for consistent matching
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  
  // Handle special case: "spacing-px" -> "px" (1px in Tailwind)
  if (normalized === "spacing-px") {
    return "px";
  }
  
  // Match two patterns:
  // 1. Hyphen format: "spacing-0-5" (matches "spacing-(\d+)-(\d+)")
  // 2. Dot or integer format: "spacing-0.5" or "spacing-7" (matches "spacing-([\d.]+)")
  const match = normalized.match(/^spacing-(\d+)-(\d+)$/) || normalized.match(/^spacing-([\d.]+)$/);
  
  if (match) {
    // If it's the hyphen format like "0-5", convert to "0.5"
    if (match[2]) {
      return `${match[1]}.${match[2]}`;
    }
    // Otherwise return the matched value (integer or decimal)
    return match[1];
  }
  
  // Not a spacing variable
  return null;
}

/**
 * Extracts the Tailwind value from a font-size variable name.
 * Examples: "font-size-xs" → "xs", "font-size-sm" → "sm"
 * 
 * @param variableName - The variable name (e.g., "font-size-xs", "font-size/xs")
 * @returns The font size value (e.g., "xs", "sm", "lg") or null if not a font-size variable
 */
function extractFontSizeValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  const match = normalized.match(/^font-size-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extracts the Tailwind value from a font-weight variable name.
 * Examples: "font-weight-normal" → "normal", "font-weight-bold" → "bold"
 * 
 * @param variableName - The variable name (e.g., "font-weight-normal", "font-weight/normal")
 * @returns The font weight value (e.g., "normal", "bold") or null if not a font-weight variable
 */
function extractFontWeightValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  const match = normalized.match(/^font-weight-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extracts the Tailwind value from a font-family variable name.
 * Examples: "font-sans" → "sans", "font-mono" → "mono"
 * 
 * @param variableName - The variable name (e.g., "font-sans", "font/sans")
 * @returns The font family value (e.g., "sans", "mono", "serif") or null if not a font-family variable
 */
function extractFontFamilyValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  const match = normalized.match(/^font-(sans|serif|mono)$/);
  return match ? match[1] : null;
}

/**
 * Extracts the Tailwind value from a line-height variable name.
 * Examples: "font-leading-4" → "4", "font-leading-5" → "5"
 * 
 * @param variableName - The variable name (e.g., "font-leading-4", "font-leading/4")
 * @returns The line height value (e.g., "4", "5") or null if not a line-height variable
 */
function extractLineHeightValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  const match = normalized.match(/^font-leading-([\d]+)$/);
  return match ? match[1] : null;
}

/**
 * Extracts the Tailwind value from a letter-spacing (tracking) variable name.
 * Examples: "font-tracking-normal" → "normal", "font-tracking-tight" → "tight"
 * 
 * @param variableName - The variable name (e.g., "font-tracking-normal", "font-tracking/tight")
 * @returns The tracking value (e.g., "normal", "tight", "tighter", "wide", "wider", "widest") or null if not a tracking variable
 */
function extractLetterSpacingValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  const match = normalized.match(/^font-tracking-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extracts the Tailwind value from a radius variable name.
 * Examples: "radius-full" → "full", "radius-lg" → "lg", "radius-2xl" → "2xl"
 * 
 * @param variableName - The variable name (e.g., "radius-full", "radius/full")
 * @returns The radius value (e.g., "full", "lg", "2xl") or null if not a radius variable
 */
function extractRadiusValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-");
  const match = normalized.match(/^radius-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extracts the Tailwind value from a border-width variable name.
 * Examples: "border-width-1" → "1", "border-width-2" → "2"
 * 
 * @param variableName - The variable name (e.g., "border-width-1", "border-width/1")
 * @returns The border width value (e.g., "1", "2") or null if not a border-width variable
 */
function extractBorderWidthValue(variableName: string): string | null {
  const normalized = variableName.toLowerCase().replace(/\//g, "-").replace(/[^a-z0-9-]/g, "-");
  // Match patterns like: border-width-1, border-width-2, etc.
  // Also handle variations like border-width/1, border/width/1
  const match = normalized.match(/^border-width-([\d]+)$/) || normalized.match(/^border-([\d]+)$/);
  return match ? match[1] : null;
}

/**
 * Helper function to convert RGB to hex (same as in cssGenerator)
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts fill (background) properties to Tailwind background classes.
 * 
 * REMAPPING LOGIC:
 * 1. With Variable:
 *    - Converts Figma variable name to Tailwind class name (e.g., "fill/neutral/default" → "fill-neutral-default")
 *    - Generates class: bg-{variableName} (e.g., "bg-fill-neutral-default")
 *    - Stores resolved color value in variableMap for Tailwind config
 *    - Handles opacity: if opacity < 1, stores as rgba() in variableMap
 * 
 * 2. Without Variable:
 *    - Uses Tailwind arbitrary values: bg-[#{hex}] for solid colors
 *    - For colors with opacity: bg-[rgba(r,g,b,opacity)]
 * 
 * 3. Gradients:
 *    - Linear gradients: bg-[linear-gradient(...)]
 *    - Radial gradients: bg-[radial-gradient(...)]
 *    - Gradient stops converted from RGB (0-1) to hex format
 * 
 * NOTE: For TEXT nodes, this function generates background classes, but they are
 * converted to text color classes (text-*) in tailwindDomGenerator.ts
 * 
 * @param fills - Array of extracted fill objects with type, color, opacity, and optional variable
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of Tailwind class strings (e.g., ["bg-fill-neutral-default", "bg-[#ff0000]"])
 */
export function fillsToTailwind(fills: any, variableMap: VariableMap): string[] {
  if (!fills || fills.length === 0) return [];

  const classes: string[] = [];
  const fill = fills[0]; // Use first fill for now

  if (fill.type === "SOLID") {
    if (fill.variable) {
      // Use Tailwind class with variable name
      const tailwindVarName = figmaVariableToTailwindClass(fill.variable);
      // Store the resolved color value in the variableMap for Tailwind config
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
      classes.push(`bg-${tailwindVarName}`);
    } else {
      // For non-variable colors, use arbitrary values: bg-[#hex]
      const color = fill.color;
      const opacity = fill.opacity !== undefined ? fill.opacity : 1;
      if (opacity < 1) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        classes.push(`bg-[rgba(${r},${g},${b},${opacity})]`);
      } else {
        classes.push(`bg-[${color}]`);
      }
    }
  } else if (fill.type === "GRADIENT_LINEAR") {
    // Gradients need arbitrary values
    const stops = fill.gradientStops || [];
    const gradientStops = stops
      .map((stop: any) => {
        const color = rgbToHex(stop.color.r, stop.color.g, stop.color.b);
        return `${color} ${(stop.position || 0) * 100}%`;
      })
      .join(", ");
    classes.push(`bg-[linear-gradient(${gradientStops})]`);
  } else if (fill.type === "GRADIENT_RADIAL") {
    const stops = fill.gradientStops || [];
    const gradientStops = stops
      .map((stop: any) => {
        const color = rgbToHex(stop.color.r, stop.color.g, stop.color.b);
        return `${color} ${(stop.position || 0) * 100}%`;
      })
      .join(", ");
    classes.push(`bg-[radial-gradient(${gradientStops})]`);
  }

  return classes;
}

/**
 * Converts stroke (border) properties to Tailwind border classes.
 * 
 * REMAPPING LOGIC:
 * 1. Border Color:
 *    - With Variable: border-{variableName} (e.g., "border-fill-neutral-default")
 *    - Without Variable: border-[#{hex}] or border-[rgba(r,g,b,opacity)]
 *    - Stores color value in variableMap for CSS variable definition
 * 
 * 2. Border Width:
 *    - With Variable: Extracts scale value from variable name (e.g., "border-width-1" → "1")
 *      → Generates: border-{value} (e.g., "border-1")
 *    - Without Variable: Maps common values:
 *      - 1px → border-1
 *      - 2px → border-2
 *      - 3px → border-3
 *      - 4px → border-4
 *      - 8px → border-8
 *      - Others → border-[{value}px]
 * 
 * 3. Border Style:
 *    - Determined by strokeDashArray:
 *      - Equal small values (≤2px) → border-dotted
 *      - Other dash patterns → border-dashed
 *      - No dash array → solid (default, no class needed)
 * 
 * @param strokes - Extracted stroke object containing:
 *   - strokes: Array of stroke paint objects with color, opacity, and optional variable
 *   - strokeWeight: Border width in pixels
 *   - strokeWeightVariable: Optional variable name for stroke weight
 *   - strokeAlign: Border alignment (CENTER, INSIDE, OUTSIDE)
 *   - strokeDashArray: Optional array for dashed/dotted borders
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of Tailwind class strings (e.g., ["border-fill-neutral-default", "border-2", "border-dashed"])
 */
export function strokesToTailwind(strokes: any, variableMap: VariableMap): string[] {
  if (!strokes || !strokes.strokes || strokes.strokes.length === 0) return [];

  const classes: string[] = [];
  const stroke = strokes.strokes[0];
  const weight = strokes.strokeWeight || 1;
  const align = strokes.strokeAlign || "CENTER";

  if (stroke.type === "SOLID") {
    // Handle stroke color variable
    if (stroke.variable) {
      const tailwindVarName = figmaVariableToTailwindClass(stroke.variable);
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
      classes.push(`border-${tailwindVarName}`);
    } else {
      const color = stroke.color;
      const opacity = stroke.opacity !== undefined ? stroke.opacity : 1;
      if (opacity < 1) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        classes.push(`border-[rgba(${r},${g},${b},${opacity})]`);
      } else {
        classes.push(`border-[${color}]`);
      }
    }

    // Handle strokeWeight variable
    if (strokes.strokeWeightVariable) {
      const borderWidthValue = extractBorderWidthValue(strokes.strokeWeightVariable);
      if (borderWidthValue) {
        // Use Tailwind border width class - always use explicit format (border-1, border-2, etc.)
        classes.push(`border-${borderWidthValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(strokes.strokeWeightVariable);
        variableMap[strokes.strokeWeightVariable] = `${weight}px`;
        classes.push(`border-[var(--${tailwindVarName})]`);
      }
    } else {
      // Use Tailwind border width utilities - always use explicit format (border-1, border-2, etc.)
      const borderWidthMap: { [key: number]: string } = {
        1: "border-1",
        2: "border-2",
        3: "border-3",
        4: "border-4",
        8: "border-8",
      };
      const borderClass = borderWidthMap[weight] || `border-[${weight}px]`;
      classes.push(borderClass);
    }

  }

  // Handle border style based on strokeDashArray (applies to all stroke types)
  if (strokes.strokeDashArray && strokes.strokeDashArray.length > 0) {
    const dashPattern = strokes.strokeDashArray;
    // Check if it's a simple dotted pattern (equal small dash and gap values)
    if (dashPattern.length === 2 && dashPattern[0] === dashPattern[1] && dashPattern[0] <= 2) {
      classes.push("border-dotted");
    } else {
      // Use dashed for other patterns
      // Note: Tailwind/CSS borders don't support custom dash patterns directly
      // For custom patterns, we use border-dashed as the closest approximation
      classes.push("border-dashed");
    }
  }
  // Note: solid is the default, so no class needed when strokeDashArray is empty/undefined

  return classes;
}

/**
 * Converts typography properties to Tailwind typography classes.
 * 
 * REMAPPING LOGIC BY PROPERTY:
 * 
 * 1. Font Family:
 *    - With Variable: Extracts value from variable name (e.g., "font-sans" → "sans")
 *      → Generates: font-{value} (e.g., "font-sans")
 *    - Without Variable: Detects font family type:
 *      - Contains "sans" → font-sans
 *      - Contains "serif" → font-serif
 *      - Contains "mono" → font-mono
 *      - Others → font-['{fontName}'] (arbitrary value)
 * 
 * 2. Font Size:
 *    - With Variable: Extracts size value (e.g., "font-size-lg" → "lg")
 *      → Generates: text-{value} (e.g., "text-lg")
 *    - Without Variable: Maps common sizes:
 *      - 12px → text-xs, 14px → text-sm, 16px → text-base
 *      - 18px → text-lg, 20px → text-xl, 24px → text-2xl
 *      - 30px → text-3xl, 36px → text-4xl, 48px → text-5xl, 60px → text-6xl
 *      - Others → text-[{size}px]
 * 
 * 3. Font Weight:
 *    - With Variable: Extracts weight value (e.g., "font-weight-bold" → "bold")
 *      → Generates: font-{value} (e.g., "font-bold")
 *    - Without Variable: Maps weight names:
 *      - thin → font-thin, extralight → font-extralight, light → font-light
 *      - regular → font-normal, medium → font-medium, semibold → font-semibold
 *      - bold → font-bold, extrabold → font-extrabold, black → font-black
 * 
 * 4. Line Height:
 *    - With Variable: Extracts leading value (e.g., "font-leading-4" → "4")
 *      → Generates: leading-{value} (e.g., "leading-4")
 *    - Without Variable: Maps common values:
 *      - 1 → leading-none, 1.25 → leading-tight, 1.5 → leading-snug
 *      - 1.75 → leading-normal, 2 → leading-relaxed, 2.25 → leading-loose
 *      - Others → leading-[{value}] (supports px and %)
 * 
 * 5. Letter Spacing:
 *    - With Variable: Extracts tracking value (e.g., "font-tracking-normal" → "normal")
 *      → Generates: tracking-{value} (e.g., "tracking-normal")
 *    - Without Variable: tracking-[{value}px] or tracking-[{value}%]
 * 
 * 6. Text Decoration: underline, line-through, overline
 * 7. Text Case: UPPER → uppercase, LOWER → lowercase, TITLE → capitalize
 * 8. Text Alignment: LEFT → text-left, CENTER → text-center, RIGHT → text-right, JUSTIFIED → text-justify
 * 
 * @param typography - Extracted typography object with:
 *   - fontSize, fontSizeVariable
 *   - fontFamily, fontFamilyVariable
 *   - fontWeight, fontWeightVariable
 *   - lineHeight, lineHeightVariable (can be number or object with value/unit)
 *   - letterSpacing, letterSpacingVariable (can be number or object with value/unit)
 *   - textDecoration, textCase, textAlignHorizontal
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @returns Array of Tailwind class strings (e.g., ["text-lg", "font-bold", "leading-4", "text-center"])
 */
export function typographyToTailwind(typography: any, variableMap: VariableMap): string[] {
  if (!typography) return [];

  const classes: string[] = [];

  if (typography.fontFamily) {
    if (typography.fontFamilyVariable) {
      // Always store the variable value in variableMap for CSS config
      variableMap[typography.fontFamilyVariable] = `"${typography.fontFamily}"`;
      
      const fontFamilyValue = extractFontFamilyValue(typography.fontFamilyVariable);
      if (fontFamilyValue) {
        // Use Tailwind font family class directly from variable name
        classes.push(`font-${fontFamilyValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(typography.fontFamilyVariable);
        classes.push(`font-[var(--${tailwindVarName})]`);
      }
    } else {
      // Convert common font families to Tailwind classes
      const fontFamily = typography.fontFamily.toLowerCase();
      if (fontFamily.includes("sans")) classes.push("font-sans");
      else if (fontFamily.includes("serif")) classes.push("font-serif");
      else if (fontFamily.includes("mono")) classes.push("font-mono");
      else classes.push(`font-['${typography.fontFamily}']`);
    }
  }

  if (typography.fontSize) {
    if (typography.fontSizeVariable) {
      // Always store the variable value in variableMap for CSS config
      variableMap[typography.fontSizeVariable] = `${typography.fontSize}px`;
      
      const fontSizeValue = extractFontSizeValue(typography.fontSizeVariable);
      if (fontSizeValue) {
        // Use Tailwind font size class directly from variable name
        classes.push(`text-${fontSizeValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(typography.fontSizeVariable);
        classes.push(`text-[var(--${tailwindVarName})]`);
      }
    } else {
      // Map common font sizes to Tailwind classes
      const size = typography.fontSize;
      const sizeMap: { [key: number]: string } = {
        12: "text-xs",
        14: "text-sm",
        16: "text-base",
        18: "text-lg",
        20: "text-xl",
        24: "text-2xl",
        30: "text-3xl",
        36: "text-4xl",
        48: "text-5xl",
        60: "text-6xl",
      };
      classes.push(sizeMap[size] || `text-[${size}px]`);
    }
  }

  if (typography.fontWeight) {
    if (typography.fontWeightVariable) {
      // Always store the variable value in variableMap for CSS config
      variableMap[typography.fontWeightVariable] = typography.fontWeight;
      
      const fontWeightValue = extractFontWeightValue(typography.fontWeightVariable);
      if (fontWeightValue) {
        // Use Tailwind font weight class directly from variable name
        classes.push(`font-${fontWeightValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(typography.fontWeightVariable);
        classes.push(`font-[var(--${tailwindVarName})]`);
      }
    } else {
      const weightMap: { [key: string]: string } = {
        thin: "font-thin",
        extralight: "font-extralight",
        light: "font-light",
        regular: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold",
        extrabold: "font-extrabold",
        black: "font-black",
      };
      const weight = weightMap[typography.fontWeight.toLowerCase()] || "font-normal";
      classes.push(weight);
    }
  }

  if (typography.lineHeight) {
    if (typography.lineHeightVariable) {
      // Always store the variable value in variableMap for CSS config
      const value = typeof typography.lineHeight === "object" && "unit" in typography.lineHeight
        ? `${typography.lineHeight.value}${typography.lineHeight.unit === "PERCENT" ? "%" : "px"}`
        : `${typography.lineHeight}px`;
      variableMap[typography.lineHeightVariable] = value;
      
      const lineHeightValue = extractLineHeightValue(typography.lineHeightVariable);
      if (lineHeightValue) {
        // Use Tailwind line height class directly from variable name
        classes.push(`leading-${lineHeightValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(typography.lineHeightVariable);
        classes.push(`leading-[var(--${tailwindVarName})]`);
      }
    } else {
      if (typeof typography.lineHeight === "object") {
        classes.push(`leading-[${typography.lineHeight.value}${typography.lineHeight.unit === "PERCENT" ? "%" : "px"}]`);
      } else {
        // Map common line heights
        const lh = typography.lineHeight;
        const lhMap: { [key: number]: string } = {
          1: "leading-none",
          1.25: "leading-tight",
          1.5: "leading-snug",
          1.75: "leading-normal",
          2: "leading-relaxed",
          2.25: "leading-loose",
        };
        classes.push(lhMap[lh] || `leading-[${lh}]`);
      }
    }
  }

  // Check for letterSpacing OR letterSpacingVariable (value can be 0 but still have a variable)
  if (typography.letterSpacing !== undefined || typography.letterSpacingVariable) {
    if (typography.letterSpacingVariable) {
      // Always store the variable value in variableMap for CSS config
      const value = typeof typography.letterSpacing === "object" && "unit" in typography.letterSpacing
        ? `${typography.letterSpacing.value}${typography.letterSpacing.unit === "PERCENT" ? "%" : "px"}`
        : `${typography.letterSpacing}px`;
      variableMap[typography.letterSpacingVariable] = value;
      
      const letterSpacingValue = extractLetterSpacingValue(typography.letterSpacingVariable);
      if (letterSpacingValue) {
        // Use Tailwind tracking class directly from variable name
        classes.push(`tracking-${letterSpacingValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(typography.letterSpacingVariable);
        classes.push(`tracking-[var(--${tailwindVarName})]`);
      }
    } else {
      if (typeof typography.letterSpacing === "object") {
        classes.push(`tracking-[${typography.letterSpacing.value}${typography.letterSpacing.unit === "PERCENT" ? "%" : "px"}]`);
      } else {
        classes.push(`tracking-[${typography.letterSpacing}px]`);
      }
    }
  }

  if (typography.textDecoration) {
    const decoration = typography.textDecoration.toLowerCase();
    if (decoration === "underline") classes.push("underline");
    else if (decoration === "line-through") classes.push("line-through");
    else if (decoration === "overline") classes.push("overline");
  }

  if (typography.textCase) {
    if (typography.textCase === "UPPER") classes.push("uppercase");
    else if (typography.textCase === "LOWER") classes.push("lowercase");
    else if (typography.textCase === "TITLE") classes.push("capitalize");
  }

  if (typography.textAlignHorizontal) {
    const alignMap: { [key: string]: string } = {
      "LEFT": "text-left",
      "CENTER": "text-center",
      "RIGHT": "text-right",
      "JUSTIFIED": "text-justify",
    };
    const alignClass = alignMap[typography.textAlignHorizontal];
    if (alignClass) {
      classes.push(alignClass);
    }
  }

  return classes;
}

/**
 * Converts layout properties to Tailwind layout classes.
 * 
 * REMAPPING LOGIC BY PROPERTY:
 * 
 * 1. Positioning:
 *    - layoutPositioning === "ABSOLUTE" → absolute
 *    - Parent with absolute children → relative (handled in tailwindDomGenerator)
 * 
 * 2. Layout Sizing & Flex Grow:
 *    - layoutGrow === 1 → flex-1 (fills available space in flex direction)
 *    - layoutSizingHorizontal === "FILL" → w-full
 *    - layoutSizingVertical === "FILL" → h-full
 *    - layoutSizingHorizontal === "HUG" → no width class (natural sizing)
 *    - layoutSizingVertical === "HUG" → no height class (natural sizing)
 *    - Priority: layoutGrow takes precedence over layoutSizing
 * 
 * 3. Width/Height:
 *    - With Variable: Extracts spacing value → w-{value} or h-{value}
 *    - Without Variable:
 *      - 100% → w-full or h-full
 *      - auto → w-auto or h-auto
 *      - Others → w-[{value}px] or h-[{value}px]
 *    - Only set if NOT filling AND NOT hugging that dimension
 * 
 * 4. Flex Direction:
 *    - layoutMode exists → flex
 *    - layoutMode === "HORIZONTAL" → flex-row
 *    - layoutMode === "VERTICAL" → flex-col
 * 
 * 5. Padding:
 *    - With Variables: Individual side classes (pt-{value}, pr-{value}, pb-{value}, pl-{value})
 *    - Without Variables:
 *      - All sides equal → p-{value} (e.g., p-4 for 16px)
 *      - Different values → p-[{top}px_{right}px_{bottom}px_{left}px]
 *    - Zero padding filtered out
 * 
 * 6. Gap:
 *    - With Variable: gap-{value} (extracted from spacing variable)
 *    - Without Variable: gap-1 (4px), gap-2 (8px), gap-3 (12px), gap-4 (16px), etc.
 *    - Skipped when using SPACE_BETWEEN alignment (handled by justify-between)
 * 
 * 7. Alignment:
 *    - Primary Axis (HORIZONTAL): MIN → justify-start, CENTER → justify-center, MAX → justify-end
 *    - Primary Axis (VERTICAL): MIN → items-start, CENTER → items-center, MAX → items-end
 *    - Counter Axis: Similar mapping based on layout direction
 *    - SPACE_BETWEEN → justify-between, SPACE_AROUND → justify-around
 *    - STRETCH → items-stretch
 * 
 * 8. Border Radius:
 *    - With Variable: Extracts radius value → rounded-{value} (e.g., "radius-lg" → "rounded-lg")
 *    - Without Variable:
 *      - 4px → rounded, 8px → rounded-lg, 12px → rounded-xl, 16px → rounded-2xl
 *      - Others → rounded-[{value}px]
 *    - Per-corner: rounded-[{tl}px_{tr}px_{br}px_{bl}px]
 * 
 * 9. Opacity:
 *    - With Variable: opacity-[var(--{variableName})]
 *    - Without Variable: opacity-10 (0.1), opacity-20 (0.2), ..., opacity-90 (0.9)
 *    - Only generated when opacity < 1
 * 
 * @param layout - Extracted layout object with:
 *   - width, height, widthVariable, heightVariable
 *   - layoutGrow, layoutSizingHorizontal, layoutSizingVertical
 *   - layoutMode, layoutPositioning
 *   - paddingTop/Right/Bottom/Left, padding*Variable
 *   - itemSpacing, itemSpacingVariable
 *   - primaryAxisAlignItems, counterAxisAlignItems
 *   - cornerRadius, cornerRadiusVariable
 *   - opacity, opacityVariable
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 * @param positioning - Optional positioning object (currently unused, kept for compatibility)
 * @returns Array of Tailwind class strings (e.g., ["flex", "flex-row", "w-full", "p-4", "gap-2", "justify-center"])
 */
export function layoutToTailwind(layout: any, variableMap: VariableMap, positioning?: any): string[] {
  if (!layout) return [];

  const classes: string[] = [];

  // Handle absolute/relative positioning (without positioning details like left, top, etc.)
  if (layout.layoutPositioning === "ABSOLUTE") {
    classes.push("absolute");
  }
  // Note: relative positioning is handled in the DOM generator when a parent has absolutely positioned children

  // Handle layoutGrow (fill behavior) and layoutSizingHorizontal/layoutSizingVertical
  // layoutGrow === 1 means fill in the primary axis direction
  // layoutSizingHorizontal === "FILL" means fill width
  // layoutSizingVertical === "FILL" means fill height
  
  // LAYOUT SIZING LOGIC:
  // Figma has three layout sizing modes: FILL, HUG, and FIXED
  // - FILL: Element fills available space (use w-full or h-full)
  // - HUG: Element sizes to content (no width/height class needed, natural sizing)
  // - FIXED: Element has explicit dimensions (use w-[value] or h-[value])
  // 
  // layoutGrow === 1 means the element should grow to fill available space in the flex direction
  // This takes precedence over layoutSizing properties
  // 
  // PRIORITY: layoutGrow > layoutSizingHorizontal/layoutSizingVertical
  const shouldFillWidth = layout.layoutGrow === 1 || layout.layoutSizingHorizontal === "FILL";
  const shouldFillHeight = layout.layoutGrow === 1 || layout.layoutSizingVertical === "FILL";
  const shouldHugWidth = layout.layoutSizingHorizontal === "HUG";
  const shouldHugHeight = layout.layoutSizingVertical === "HUG";
  
  // Handle layoutGrow === 1: use flex-1 (fills in flex direction)
  // flex-1 is equivalent to flex: 1 1 0%, which makes the element grow to fill available space
  if (layout.layoutGrow === 1) {
    classes.push("flex-1");
    // Skip width/height when using flex-1 to fill available space
    // The flex-1 class handles sizing automatically
  } else {
    // Handle layoutSizing: use w-full or h-full for specific dimension fills
    if (layout.layoutSizingHorizontal === "FILL") {
      classes.push("w-full");
    }
    if (layout.layoutSizingVertical === "FILL") {
      classes.push("h-full");
    }
    
    // Only set explicit width/height if NOT filling AND NOT hugging that dimension
    // HUG means let it size naturally to content (default behavior, no class needed)
    if (!shouldFillWidth && !shouldHugWidth) {
      // Always store width variable if it exists (for consistency with CSS, even if not used)
      if (layout.widthVariable && layout.width !== undefined) {
        variableMap[layout.widthVariable] = `${layout.width}px`;
      }
      
      if (layout.width !== undefined) {
        if (layout.widthVariable) {
          const spacingValue = extractSpacingValue(layout.widthVariable);
          
          if (spacingValue) {
            // Use Tailwind spacing scale directly from variable name
            classes.push(`w-${spacingValue}`);
          } else {
            // Fallback to arbitrary value
            const tailwindVarName = figmaVariableToTailwindClass(layout.widthVariable);
            classes.push(`w-[var(--${tailwindVarName})]`);
          }
        } else {
          // Map common widths
          if (layout.width === "100%") classes.push("w-full");
          else if (layout.width === "auto") classes.push("w-auto");
          else {
            classes.push(`w-[${layout.width}px]`);
          }
        }
      }
    }
    
    if (!shouldFillHeight && !shouldHugHeight) {
      // Always store height variable if it exists (for consistency with CSS, even if not used)
      if (layout.heightVariable && layout.height !== undefined) {
        variableMap[layout.heightVariable] = `${layout.height}px`;
      }
      
      if (layout.height !== undefined) {
        if (layout.heightVariable) {
          const spacingValue = extractSpacingValue(layout.heightVariable);
          
          if (spacingValue) {
            // Use Tailwind spacing scale directly from variable name
            classes.push(`h-${spacingValue}`);
          } else {
            // Fallback to arbitrary value
            const tailwindVarName = figmaVariableToTailwindClass(layout.heightVariable);
            classes.push(`h-[var(--${tailwindVarName})]`);
          }
        } else {
          if (layout.height === "100%") classes.push("h-full");
          else if (layout.height === "auto") classes.push("h-auto");
          else classes.push(`h-[${layout.height}px]`);
        }
      }
    }
  }

  if (layout.layoutMode) {
    classes.push("flex");
    classes.push(layout.layoutMode === "HORIZONTAL" ? "flex-row" : "flex-col");

    // Padding
    if (layout.paddingLeft !== undefined || layout.paddingRight !== undefined || 
        layout.paddingTop !== undefined || layout.paddingBottom !== undefined) {
      const hasPaddingVariables = layout.paddingLeftVariable || layout.paddingRightVariable || 
                                  layout.paddingTopVariable || layout.paddingBottomVariable;
      
      if (hasPaddingVariables) {
        // Individual padding sides with variables
        if (layout.paddingTop !== undefined) {
          if (layout.paddingTopVariable) {
            const spacingValue = extractSpacingValue(layout.paddingTopVariable);
            // Always store the variable value in variableMap for CSS config
            variableMap[layout.paddingTopVariable] = `${layout.paddingTop}px`;
            
            if (spacingValue) {
              classes.push(`pt-${spacingValue}`);
            } else {
              const tailwindVarName = figmaVariableToTailwindClass(layout.paddingTopVariable);
              classes.push(`pt-[var(--${tailwindVarName})]`);
            }
          } else if (layout.paddingTop > 0) {
            classes.push(`pt-[${layout.paddingTop}px]`);
          }
        }
        if (layout.paddingRight !== undefined) {
          if (layout.paddingRightVariable) {
            const spacingValue = extractSpacingValue(layout.paddingRightVariable);
            // Always store the variable value in variableMap for CSS config
            variableMap[layout.paddingRightVariable] = `${layout.paddingRight}px`;
            
            if (spacingValue) {
              classes.push(`pr-${spacingValue}`);
            } else {
              const tailwindVarName = figmaVariableToTailwindClass(layout.paddingRightVariable);
              classes.push(`pr-[var(--${tailwindVarName})]`);
            }
          } else if (layout.paddingRight > 0) {
            classes.push(`pr-[${layout.paddingRight}px]`);
          }
        }
        if (layout.paddingBottom !== undefined) {
          if (layout.paddingBottomVariable) {
            const spacingValue = extractSpacingValue(layout.paddingBottomVariable);
            // Always store the variable value in variableMap for CSS config
            variableMap[layout.paddingBottomVariable] = `${layout.paddingBottom}px`;
            
            if (spacingValue) {
              classes.push(`pb-${spacingValue}`);
            } else {
              const tailwindVarName = figmaVariableToTailwindClass(layout.paddingBottomVariable);
              classes.push(`pb-[var(--${tailwindVarName})]`);
            }
          } else if (layout.paddingBottom > 0) {
            classes.push(`pb-[${layout.paddingBottom}px]`);
          }
        }
        if (layout.paddingLeft !== undefined) {
          if (layout.paddingLeftVariable) {
            const spacingValue = extractSpacingValue(layout.paddingLeftVariable);
            // Always store the variable value in variableMap for CSS config
            variableMap[layout.paddingLeftVariable] = `${layout.paddingLeft}px`;
            
            if (spacingValue) {
              classes.push(`pl-${spacingValue}`);
            } else {
              const tailwindVarName = figmaVariableToTailwindClass(layout.paddingLeftVariable);
              classes.push(`pl-[var(--${tailwindVarName})]`);
            }
          } else if (layout.paddingLeft > 0) {
            classes.push(`pl-[${layout.paddingLeft}px]`);
          }
        }
      } else {
        // Use shorthand padding if all sides are equal
        const padding = [
          layout.paddingTop || 0,
          layout.paddingRight || 0,
          layout.paddingBottom || 0,
          layout.paddingLeft || 0,
        ];
        const allEqual = padding.every(p => p === padding[0]) && padding[0] > 0;
        if (allEqual) {
          const p = padding[0];
          const paddingMap: { [key: number]: string } = {
            4: "p-1",
            8: "p-2",
            12: "p-3",
            16: "p-4",
            20: "p-5",
            24: "p-6",
          };
          classes.push(paddingMap[p] || `p-[${p}px]`);
        } else {
          // Different padding values - use arbitrary value
          const top = padding[0] || 0;
          const right = padding[1] || 0;
          const bottom = padding[2] || 0;
          const left = padding[3] || 0;
          classes.push(`p-[${top}px_${right}px_${bottom}px_${left}px]`);
        }
      }
    }

    // GAP HANDLING:
    // Gap (itemSpacing) creates space between flex children.
    // However, when using SPACE_BETWEEN alignment, justify-between handles spacing automatically,
    // so we skip the gap class to avoid double spacing.
    // 
    // Always store the variable if it exists (for consistency with CSS output),
    // even if we skip the gap class.
    if (layout.itemSpacingVariable) {
      // Always store the variable value in variableMap (for consistency with CSS)
      variableMap[layout.itemSpacingVariable] = `${layout.itemSpacing}px`;
    }
    
    // Only add gap class if not using SPACE_BETWEEN alignment
    // SPACE_BETWEEN uses justify-between which handles spacing automatically
    if (layout.itemSpacing !== undefined && 
        layout.primaryAxisAlignItems !== "SPACE_BETWEEN" && 
        layout.counterAxisAlignItems !== "SPACE_BETWEEN") {
      if (layout.itemSpacingVariable) {
        const spacingValue = extractSpacingValue(layout.itemSpacingVariable);
        
        if (spacingValue) {
          classes.push(`gap-${spacingValue}`);
        } else {
          const tailwindVarName = figmaVariableToTailwindClass(layout.itemSpacingVariable);
          classes.push(`gap-[var(--${tailwindVarName})]`);
        }
      } else if (layout.itemSpacing > 0) {
        const gapMap: { [key: number]: string } = {
          4: "gap-1",
          8: "gap-2",
          12: "gap-3",
          16: "gap-4",
          20: "gap-5",
          24: "gap-6",
        };
        classes.push(gapMap[layout.itemSpacing] || `gap-[${layout.itemSpacing}px]`);
      }
    }

    // Alignment
    if (layout.primaryAxisAlignItems) {
      if (layout.layoutMode === "HORIZONTAL") {
        const justifyMap: { [key: string]: string } = {
          "MIN": "justify-start",
          "CENTER": "justify-center",
          "MAX": "justify-end",
          "SPACE_BETWEEN": "justify-between",
          "SPACE_AROUND": "justify-around",
        };
        classes.push(justifyMap[layout.primaryAxisAlignItems] || "justify-start");
      } else {
        const alignMap: { [key: string]: string } = {
          "MIN": "items-start",
          "CENTER": "items-center",
          "MAX": "items-end",
          "STRETCH": "items-stretch",
        };
        classes.push(alignMap[layout.primaryAxisAlignItems] || "items-start");
      }
    }

    if (layout.counterAxisAlignItems) {
      if (layout.layoutMode === "HORIZONTAL") {
        const alignMap: { [key: string]: string } = {
          "MIN": "items-start",
          "CENTER": "items-center",
          "MAX": "items-end",
          "STRETCH": "items-stretch",
        };
        classes.push(alignMap[layout.counterAxisAlignItems] || "items-start");
      } else {
        const justifyMap: { [key: string]: string } = {
          "MIN": "justify-start",
          "CENTER": "justify-center",
          "MAX": "justify-end",
          "SPACE_BETWEEN": "justify-between",
          "SPACE_AROUND": "justify-around",
        };
        classes.push(justifyMap[layout.counterAxisAlignItems] || "justify-start");
      }
    }
  }

  // Border radius
  if (layout.cornerRadius !== undefined) {
    if (layout.cornerRadiusVariable) {
      const radiusValue = extractRadiusValue(layout.cornerRadiusVariable);
      // Always store the variable value in variableMap for CSS config
      if (typeof layout.cornerRadius === "number") {
        variableMap[layout.cornerRadiusVariable] = `${layout.cornerRadius}px`;
      }
      
      if (radiusValue) {
        // Use Tailwind radius class directly from variable name
        classes.push(`rounded-${radiusValue}`);
      } else {
        // Fallback to arbitrary value
        const tailwindVarName = figmaVariableToTailwindClass(layout.cornerRadiusVariable);
        if (typeof layout.cornerRadius === "number") {
          classes.push(`rounded-[var(--${tailwindVarName})]`);
        } else if (typeof layout.cornerRadius === "object") {
          const { topLeft, topRight, bottomRight, bottomLeft } = layout.cornerRadius;
          classes.push(`rounded-[${topLeft}px_${topRight}px_${bottomRight}px_${bottomLeft}px]`);
        }
      }
    } else {
      if (typeof layout.cornerRadius === "number") {
        const radiusMap: { [key: number]: string } = {
          4: "rounded",
          8: "rounded-lg",
          12: "rounded-xl",
          16: "rounded-2xl",
        };
        classes.push(radiusMap[layout.cornerRadius] || `rounded-[${layout.cornerRadius}px]`);
      } else if (typeof layout.cornerRadius === "object") {
        const { topLeft, topRight, bottomRight, bottomLeft } = layout.cornerRadius;
        classes.push(`rounded-[${topLeft}px_${topRight}px_${bottomRight}px_${bottomLeft}px]`);
      }
    }
  }

  // Opacity
  if (layout.opacity !== undefined && layout.opacity < 1) {
    if (layout.opacityVariable) {
      const tailwindVarName = figmaVariableToTailwindClass(layout.opacityVariable);
      variableMap[layout.opacityVariable] = String(layout.opacity);
      classes.push(`opacity-[var(--${tailwindVarName})]`);
    } else {
      const opacityMap: { [key: number]: string } = {
        0.1: "opacity-10",
        0.2: "opacity-20",
        0.3: "opacity-30",
        0.4: "opacity-40",
        0.5: "opacity-50",
        0.6: "opacity-60",
        0.7: "opacity-70",
        0.8: "opacity-80",
        0.9: "opacity-90",
      };
      classes.push(opacityMap[layout.opacity] || `opacity-[${layout.opacity}]`);
    }
  }
  
  return classes;
}

/**
 * Converts visual effects (shadows and blurs) to Tailwind classes.
 * 
 * REMAPPING LOGIC:
 * 
 * 1. Shadows (DROP_SHADOW, INNER_SHADOW):
 *    - Converts shadow properties to CSS shadow definition
 *    - Format: {inset}{x}px {y}px {radius}px rgba(r,g,b,opacity)
 *    - Uses arbitrary value: shadow-[{shadowDefinition}]
 *    - Multiple shadows combined: shadow-[shadow1, shadow2, ...]
 *    - Inner shadows include "inset " prefix
 * 
 * 2. Blurs (LAYER_BLUR, BACKGROUND_BLUR):
 *    - Maps blur radius to Tailwind blur classes:
 *      - 4px → blur-sm
 *      - 8px → blur
 *      - 12px → blur-md
 *      - 16px → blur-lg
 *      - 24px → blur-xl
 *      - Others → blur-[{radius}px]
 * 
 * NOTE: Effects don't support Figma variables, so all values are direct conversions.
 * 
 * @param effects - Array of extracted effect objects with:
 *   - type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR"
 *   - For shadows: color (hex), opacity, offset (x, y), radius, spread
 *   - For blurs: radius
 * @returns Array of Tailwind class strings (e.g., ["shadow-[0_2px_4px_rgba(0,0,0,0.1)]", "blur-sm"])
 */
export function effectsToTailwind(effects: any): string[] {
  if (!effects || effects.length === 0) return [];

  const classes: string[] = [];
  const shadows: string[] = [];
  const blurs: string[] = [];

  effects.forEach((effect: any) => {
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      const color = effect.color;
      const opacity = effect.opacity !== undefined ? effect.opacity : 1;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
      const shadow = `${inset}${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px rgba(${r},${g},${b},${opacity})`;
      shadows.push(shadow);
    } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
      blurs.push(`blur(${effect.radius}px)`);
    }
  });

  if (shadows.length > 0) {
    // Use arbitrary values for custom shadows
    classes.push(`shadow-[${shadows.join(", ")}]`);
  }

  if (blurs.length > 0) {
    const blurRadius = effects.find((e: any) => e.radius)?.radius || 8;
    const blurMap: { [key: number]: string } = {
      4: "blur-sm",
      8: "blur",
      12: "blur-md",
      16: "blur-lg",
      24: "blur-xl",
    };
    classes.push(blurMap[blurRadius] || `blur-[${blurRadius}px]`);
  }

  return classes;
}

/**
 * Generates Tailwind classes from extracted styles.
 * 
 * This is the main entry point for converting Figma styles to Tailwind utility classes.
 * It coordinates all the individual property converters and returns a complete
 * set of Tailwind classes for an element.
 * 
 * CLASS GENERATION ORDER:
 * 1. Layout (display, flex, width, height, padding, gap, alignment, positioning)
 * 2. Typography (font family, size, weight, line height, letter spacing, decoration, case, alignment)
 * 3. Colors (background/fills, text color for text nodes)
 * 4. Borders (border color, width, style, radius)
 * 5. Effects (shadows, blurs)
 * 6. Visibility (hidden)
 * 
 * This order ensures proper CSS cascade and class readability.
 * 
 * @param className - The CSS class name (not used for Tailwind, but kept for compatibility with CSS generator)
 * @param styles - Extracted styles object containing:
 *   - layout: Layout properties (width, height, padding, gap, flex, alignment, etc.)
 *   - typography: Typography properties (font family, size, weight, line height, etc.)
 *   - fills: Background/fill properties (colors, gradients)
 *   - strokes: Border properties (color, width, style)
 *   - effects: Visual effects (shadows, blurs)
 *   - visible: Visibility flag
 * @param variableMap - Map to store CSS variable definitions (modified in place)
 *   Variables are stored here for generating Tailwind config and CSS variable definitions
 * @returns TailwindClass object with:
 *   - classes: Array of Tailwind utility class strings
 *   - variableComments: Array of comment strings (currently unused, kept for compatibility)
 */
export function generateTailwindClasses(
  className: string,
  styles: ExtractedStyles,
  variableMap: VariableMap
): TailwindClass {
  const classes: string[] = [];

  // Add classes in logical order
  classes.push(...layoutToTailwind(styles.layout, variableMap, styles.positioning));
  classes.push(...typographyToTailwind(styles.typography, variableMap));
  classes.push(...fillsToTailwind(styles.fills, variableMap));
  classes.push(...strokesToTailwind(styles.strokes, variableMap));
  classes.push(...effectsToTailwind(styles.effects));

  if (styles.visible === false) {
    classes.push("hidden");
  }

  return {
    classes: classes.filter(c => c), // Filter out empty strings
    variableComments: [],
  };
}

