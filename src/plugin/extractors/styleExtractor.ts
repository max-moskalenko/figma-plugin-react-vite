// SceneNode is a global type from Figma API

export interface ExtractedStyles {
  fills?: any;
  strokes?: any;
  effects?: any;
  typography?: any;
  layout?: any;
  positioning?: any;
  opacity?: number;
  visible?: boolean;
}

export interface VariableInfo {
  name?: string;
  value: any;
  isVariable: boolean;
}

/**
 * Resolves a Figma variable binding for a node property, or returns the raw value if no variable is bound.
 * 
 * VARIABLE RESOLUTION PROCESS:
 * 1. Checks node.boundVariables[property] for variable binding
 * 2. Handles array-based bindings (common for typography properties)
 * 3. Extracts variable ID from VariableAlias object
 * 4. Looks up variable in variable collections
 * 5. Resolves value for the current mode (defaults to first mode)
 * 6. Returns VariableInfo with name and resolved value, or raw value if not bound
 * 
 * PROPERTY NAME MAPPING:
 * Figma uses different property names in boundVariables than node properties:
 * - cornerRadius → topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius
 * - strokeWeight → strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight
 * - fontSize, lineHeight, etc. → stored as arrays in boundVariables
 * 
 * ARRAY HANDLING:
 * Typography properties are often stored as arrays: [{ id: "VariableID:...", type: "VariableAlias" }]
 * This function extracts the first element from these arrays.
 * 
 * MODE RESOLUTION:
 * Variables can have different values per mode (e.g., light/dark themes).
 * This function uses the first mode from the variable collection as the default.
 * 
 * @param node - The Figma node to check for variable bindings
 * @param property - The property name to check in boundVariables (may differ from node property name)
 * @param rawValue - The raw value to return if no variable is found
 * @param variableCollections - All variable collections from the current file
 * @returns VariableInfo with the variable name and resolved value, or raw value if not bound
 */
function resolveVariable(
  node: SceneNode,
  property: string,
  rawValue: any,
  variableCollections: readonly VariableCollection[]
): VariableInfo {
  // Check if this property is bound to a variable
  // Use 'as any' to access properties that might not be in TypeScript types (like cornerRadius)
  const boundVars = node.boundVariables as any;
  
  if (boundVars && boundVars[property]) {
    let variableBinding = boundVars[property];
    
    // Handle array case (for typography properties like fontSize, lineHeight, etc.)
    if (Array.isArray(variableBinding) && variableBinding.length > 0) {
      variableBinding = variableBinding[0];
    }
    
    if (variableBinding && "id" in variableBinding) {
      const variableId = variableBinding.id;
      
      // VariableAlias has an id property that is a string
      if (typeof variableId === "string") {
        try {
          const variable = figma.variables.getVariableById(variableId);
          if (variable) {
            // Get the value for the current mode (default to first mode)
            // Find the collection that contains this variable
            let modeId = "";
            for (const collection of variableCollections) {
              if (collection.variableIds.includes(variableId)) {
                modeId = collection.modes[0]?.modeId || "";
                break;
              }
            }
          
          const value = variable.valuesByMode[modeId];
          
            return {
              name: variable.name,
              value: value,
              isVariable: true,
            };
          }
        } catch (e) {
          console.warn(`Could not resolve variable ${variableId}:`, e);
        }
      }
    }
  }

  return {
    value: rawValue,
    isVariable: false,
  };
}

/**
 * Converts RGB color values (0-1 range) to hexadecimal color string.
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
 * Extracts fill (background) properties from a node, including variable resolution.
 * 
 * Supports solid fills with variable bindings. Each fill in the fills array can have
 * its own variable binding stored in boundVariables.fills[fillIndex].
 * 
 * @param node - The Figma node to extract fills from
 * @param variables - All variable collections for resolving variable values
 * @returns Array of extracted fills with variable information, or null if no fills
 */
function extractFills(node: SceneNode, variables: readonly VariableCollection[]): any {
  if (!("fills" in node) || !node.fills || node.fills === figma.mixed) {
    return null;
  }

  const fills = node.fills as readonly Paint[];
  if (fills.length === 0) {
    return null;
  }
  const extractedFills = fills.map((fill, fillIndex) => {
    if (fill.type === "SOLID") {
      // Check if this fill has a variable binding
      // boundVariables.fills is an array of VariableAlias, one per fill
      let colorVar: VariableInfo = { value: fill.color, isVariable: false };
      
      // Try node-level binding first (standard approach)
      let fillBinding: any = null;
      if (node.boundVariables?.fills) {
        fillBinding = (node.boundVariables.fills as any)[fillIndex];
      }
      // For VECTOR nodes, check fill-level binding (fill.boundVariables.color)
      if (!fillBinding && (fill as any).boundVariables?.color) {
        fillBinding = (fill as any).boundVariables.color;
      }
      
      if (fillBinding && "id" in fillBinding) {
        const variableId = fillBinding.id;
        if (typeof variableId === "string") {
          try {
            const variable = figma.variables.getVariableById(variableId);
            if (variable) {
              // Get the value for the current mode (default to first mode)
              let modeId = "";
              for (const collection of variables) {
                if (collection.variableIds.includes(variableId)) {
                  modeId = collection.modes[0]?.modeId || "";
                  break;
                }
              }
              
              // FALLBACK: If modeId not found in collections, use first available mode from variable
              if (!modeId && variable.valuesByMode) {
                const availableModes = Object.keys(variable.valuesByMode);
                if (availableModes.length > 0) {
                  modeId = availableModes[0];
                }
              }
              
              let value = variable.valuesByMode[modeId];
              
              // RECURSIVE RESOLUTION: If value is a VariableAlias, resolve it recursively
              // This handles cases where variables reference other variables
              while (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
                const aliasId = (value as any).id;
                const aliasVariable = figma.variables.getVariableById(aliasId);
                if (!aliasVariable) break;
                
                // Find mode ID for the alias variable
                let aliasModeId = "";
                for (const collection of variables) {
                  if (collection.variableIds.includes(aliasId)) {
                    aliasModeId = collection.modes[0]?.modeId || "";
                    break;
                  }
                }
                
                // FALLBACK: If aliasModeId not found in collections, use first available mode from alias variable
                if (!aliasModeId && aliasVariable.valuesByMode) {
                  const availableModes = Object.keys(aliasVariable.valuesByMode);
                  if (availableModes.length > 0) {
                    aliasModeId = availableModes[0];
                  }
                }
                
                value = aliasVariable.valuesByMode[aliasModeId];
              }
              
              colorVar = {
                name: variable.name,
                value: value,
                isVariable: true,
              };
            }
          } catch (e) {
            console.warn(`Could not resolve fill variable ${variableId}:`, e);
          }
        }
      }
      
      const color = colorVar.isVariable ? colorVar.value : fill.color;
      
      const hex = rgbToHex(color.r, color.g, color.b);
      const opacity = fill.opacity !== undefined ? fill.opacity : 1;

      return {
        type: "SOLID",
        color: hex,
        opacity: opacity,
        variable: colorVar.isVariable ? colorVar.name : undefined,
      };
    } else if (fill.type === "GRADIENT_LINEAR" || fill.type === "GRADIENT_RADIAL" || fill.type === "GRADIENT_ANGULAR") {
      return {
        type: fill.type,
        gradientStops: fill.gradientStops,
      };
    } else if (fill.type === "IMAGE") {
      return {
        type: "IMAGE",
        imageHash: fill.imageHash,
      };
    }
    return fill;
  });

  return extractedFills;
}

/**
 * Extracts stroke (border) properties from a node, including variable resolution and individual side detection.
 * 
 * Supports stroke color and stroke weight variables. Figma stores stroke weight variables
 * using separate properties for each side: strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight.
 * 
 * INDIVIDUAL SIDE DETECTION:
 * Figma allows borders on individual sides. This function detects which sides have borders by:
 * 1. Checking if individualStrokeWeights property exists and is not figma.mixed
 * 2. Reading strokeTopWeight, strokeRightWeight, strokeBottomWeight, strokeLeftWeight
 * 3. If a side has weight > 0, that side has a border
 * 4. If individualStrokeWeights is mixed or undefined, all sides have the same border (strokeWeight)
 * 
 * @param node - The Figma node to extract strokes from
 * @param variables - All variable collections for resolving variable values
 * @returns Object with strokes array, strokeWeight, individual side weights, strokeWeightVariable, and strokeAlign, or null if no strokes
 */
function extractStrokes(node: SceneNode, variables: readonly VariableCollection[]): any {
  if (!("strokes" in node) || !node.strokes || node.strokes.length === 0) {
    return null;
  }

  const strokes = node.strokes as readonly Paint[];
  const extractedStrokes = strokes.map((stroke, strokeIndex) => {
    if (stroke.type === "SOLID") {
      // Check if this stroke has a variable binding
      // boundVariables.strokes is an array of VariableAlias, one per stroke
      let colorVar: VariableInfo = { value: stroke.color, isVariable: false };
      
      // Try node-level binding first (standard approach)
      let strokeBinding: any = null;
      if (node.boundVariables?.strokes) {
        strokeBinding = (node.boundVariables.strokes as any)[strokeIndex];
      }
      // For VECTOR nodes, check stroke-level binding (stroke.boundVariables.color)
      if (!strokeBinding && (stroke as any).boundVariables?.color) {
        strokeBinding = (stroke as any).boundVariables.color;
      }
      
      if (strokeBinding && "id" in strokeBinding) {
        const variableId = strokeBinding.id;
        if (typeof variableId === "string") {
          try {
            const variable = figma.variables.getVariableById(variableId);
            if (variable) {
              // Get the value for the current mode (default to first mode)
              let modeId = "";
              for (const collection of variables) {
                if (collection.variableIds.includes(variableId)) {
                  modeId = collection.modes[0]?.modeId || "";
                  break;
                }
              }
              
              // FALLBACK: If modeId not found in collections, use first available mode from variable
              if (!modeId && variable.valuesByMode) {
                const availableModes = Object.keys(variable.valuesByMode);
                if (availableModes.length > 0) {
                  modeId = availableModes[0];
                }
              }
              
              let value = variable.valuesByMode[modeId];
              
              // RECURSIVE RESOLUTION: If value is a VariableAlias, resolve it recursively
              // This handles cases where variables reference other variables (multiple levels)
              while (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
                const aliasId = (value as any).id;
                const aliasVariable = figma.variables.getVariableById(aliasId);
                if (!aliasVariable) break;
                
                // Find mode ID for the alias variable
                let aliasModeId = "";
                for (const collection of variables) {
                  if (collection.variableIds.includes(aliasId)) {
                    aliasModeId = collection.modes[0]?.modeId || "";
                    break;
                  }
                }
                
                // FALLBACK: If aliasModeId not found in collections, use first available mode from alias variable
                if (!aliasModeId && aliasVariable.valuesByMode) {
                  const availableModes = Object.keys(aliasVariable.valuesByMode);
                  if (availableModes.length > 0) {
                    aliasModeId = availableModes[0];
                  }
                }
                
                value = aliasVariable.valuesByMode[aliasModeId];
              }
              
              colorVar = {
                name: variable.name,
                value: value,
                isVariable: true,
              };
            }
          } catch (e) {
            console.warn(`Could not resolve stroke variable ${variableId}:`, e);
          }
        }
      }
      
      let color = colorVar.isVariable ? colorVar.value : stroke.color;
      
      // Ensure color is a valid RGB object, not still an alias or Symbol
      // If color resolution failed or returned an alias, fall back to the stroke's raw color
      if (!color || typeof color !== "object" || !("r" in color) || !("g" in color) || !("b" in color)) {
        color = stroke.color;
      }
      
      const hex = rgbToHex(color.r, color.g, color.b);
      const opacity = stroke.opacity !== undefined ? stroke.opacity : 1;

      return {
        type: "SOLID",
        color: hex,
        opacity: opacity,
        variable: colorVar.isVariable ? colorVar.name : undefined,
      };
    }
    return stroke;
  });

  let strokeWeight: number | undefined = undefined;
  const strokeAlign = "strokeAlign" in node ? node.strokeAlign : undefined;
  const strokeDashArray = "strokeDashArray" in node ? (node as any).strokeDashArray : undefined;

  // Extract individual stroke side weights
  // Figma has individualStrokeWeights property that indicates if sides have different weights
  const nodeAny = node as any;
  let individualSides: { top?: number; right?: number; bottom?: number; left?: number } | undefined;
  let hasIndividualStrokes = false;
  
  // Check if the node has individual stroke weights
  if ("strokeTopWeight" in nodeAny && "strokeRightWeight" in nodeAny && 
      "strokeBottomWeight" in nodeAny && "strokeLeftWeight" in nodeAny) {
    const topWeight = typeof nodeAny.strokeTopWeight === "number" ? nodeAny.strokeTopWeight : 0;
    const rightWeight = typeof nodeAny.strokeRightWeight === "number" ? nodeAny.strokeRightWeight : 0;
    const bottomWeight = typeof nodeAny.strokeBottomWeight === "number" ? nodeAny.strokeBottomWeight : 0;
    const leftWeight = typeof nodeAny.strokeLeftWeight === "number" ? nodeAny.strokeLeftWeight : 0;
    
    // Check if sides have different weights (individual strokes)
    const allSame = topWeight === rightWeight && rightWeight === bottomWeight && bottomWeight === leftWeight;
    const allZero = topWeight === 0 && rightWeight === 0 && bottomWeight === 0 && leftWeight === 0;
    
    if (!allSame && !allZero) {
      hasIndividualStrokes = true;
      individualSides = {};
      if (topWeight > 0) individualSides.top = topWeight;
      if (rightWeight > 0) individualSides.right = rightWeight;
      if (bottomWeight > 0) individualSides.bottom = bottomWeight;
      if (leftWeight > 0) individualSides.left = leftWeight;
    }
  }

  // Figma uses separate properties for each stroke side: strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight
  // Usually all four are bound to the same variable, so we check any of them
  let strokeWeightVariable: string | undefined;
  
  // First, get strokeWeight - it might be a Symbol if bound to a variable
  if ("strokeWeight" in node) {
    const rawStrokeWeight = node.strokeWeight;
    // Check if it's a Symbol (variable binding) or an actual number
    if (typeof rawStrokeWeight === "number") {
      strokeWeight = rawStrokeWeight;
    } else if (typeof rawStrokeWeight === "symbol") {
      // strokeWeight is bound to a variable - we need to resolve it
      // Check the boundVariables to find the actual variable
      const boundVars = node.boundVariables as any;
      const strokeWeightProperties = ["strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight", "strokeWeight"];
      
      for (const propName of strokeWeightProperties) {
        if (boundVars?.[propName]) {
          const binding = boundVars[propName];
          if (binding && "id" in binding && typeof binding.id === "string") {
            try {
              const variable = figma.variables.getVariableById(binding.id);
              if (variable) {
                // Get the value for the current mode
                let modeId = "";
                for (const collection of variables) {
                  if (collection.variableIds.includes(binding.id)) {
                    modeId = collection.modes[0]?.modeId || "";
                    break;
                  }
                }
                let value = variable.valuesByMode[modeId];
                
                // Resolve alias if needed
                if (value && typeof value === "object" && "type" in (value as any) && (value as any).type === "VARIABLE_ALIAS") {
                  const aliasId = (value as any).id;
                  if (typeof aliasId === "string") {
                    const aliasVariable = figma.variables.getVariableById(aliasId);
                    if (aliasVariable) {
                      for (const collection of variables) {
                        if (collection.variableIds.includes(aliasId)) {
                          const aliasModeId = collection.modes[0]?.modeId || "";
                          value = aliasVariable.valuesByMode[aliasModeId];
                          break;
                        }
                      }
                    }
                  }
                }
                
                if (typeof value === "number") {
                  strokeWeight = value;
                  strokeWeightVariable = variable.name;
                }
                break;
              }
            } catch (e) {
              console.warn(`Could not resolve strokeWeight variable:`, e);
            }
          }
        }
      }
      
      // Fallback: if we still don't have a strokeWeight, try to get it from the first stroke
      if (strokeWeight === undefined && extractedStrokes.length > 0) {
        strokeWeight = 1; // Default fallback
      }
    }
  }
  
  // If strokeWeight is a number but we haven't resolved a variable yet, check for bindings
  if (strokeWeight !== undefined && !strokeWeightVariable) {
    const boundVars = node.boundVariables as any;
    const strokeWeightProperties = ["strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight"];
    
    // Check instance boundVariables first - check any of the four stroke weight properties
    for (const propName of strokeWeightProperties) {
      if (boundVars?.[propName]) {
        const strokeWeightVar = resolveVariable(node, propName, strokeWeight, variables);
        if (strokeWeightVar.isVariable) {
          strokeWeightVariable = strokeWeightVar.name;
          break;
        }
      }
    }
  }

  return {
    strokes: extractedStrokes,
    strokeWeight,
    strokeWeightVariable,
    strokeAlign,
    strokeDashArray,
    individualSides, // New: individual side weights
    hasIndividualStrokes, // New: flag indicating if sides differ
  };
}

/**
 * Extracts visual effects (shadows, blurs) from a node.
 * 
 * @param node - The Figma node to extract effects from
 * @returns Array of extracted effects, or null if no effects
 */
function extractEffects(node: SceneNode): any {
  if (!("effects" in node) || !node.effects || node.effects.length === 0) {
    return null;
  }

  return node.effects.map((effect: Effect) => {
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      return {
        type: effect.type,
        color: rgbToHex(effect.color.r, effect.color.g, effect.color.b),
        opacity: effect.color.a !== undefined ? effect.color.a : 1,
        offset: {
          x: effect.offset?.x || 0,
          y: effect.offset?.y || 0,
        },
        radius: effect.radius,
        spread: effect.spread,
      };
    } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
      return {
        type: effect.type,
        radius: effect.radius,
      };
    }
    return effect;
  });
}

/**
 * Extracts typography properties from a text node, including variable resolution.
 * 
 * Typography variables in Figma are often stored as arrays in boundVariables.
 * For example, fontSize might be bound as: boundVariables.fontSize = [{ id: "VariableID:...", type: "VariableAlias" }]
 * The resolveVariable function handles extracting the first element from these arrays.
 * 
 * @param node - The Figma node (must be TEXT type)
 * @param variables - All variable collections for resolving variable values
 * @returns Object with typography properties and variable names, or null if not a text node
 */
function extractTypography(node: SceneNode, variables: readonly VariableCollection[]): any {
  if (node.type !== "TEXT") {
    return null;
  }

  const textNode = node as TextNode;
  const fontSize = textNode.fontSize;
  const fontName = textNode.fontName;
  const fontFamilyRaw = (fontName !== figma.mixed && fontName) ? fontName.family : "";
  const fontWeightRaw = (fontName !== figma.mixed && fontName) ? fontName.style : "";
  const lineHeight = textNode.lineHeight;
  const letterSpacing = textNode.letterSpacing;
  const textDecoration = textNode.textDecoration;
  const textCase = textNode.textCase;
  const textAlignHorizontal = textNode.textAlignHorizontal;

  const boundVars = node.boundVariables as any;

  // Resolve font size variable - check multiple possible property names
  // Typography properties are often stored as arrays in boundVariables
  let fontSizeVar: VariableInfo = { value: fontSize, isVariable: false };
  const fontSizePropertyNames = ["fontSize", "font-size", "size"];
  for (const propName of fontSizePropertyNames) {
    if (boundVars?.[propName]) {
      fontSizeVar = resolveVariable(node, propName, fontSize, variables);
      if (fontSizeVar.isVariable) {
        break;
      }
    }
  }

  // Handle lineHeight - it can be a number, an object with unit, or figma.mixed
  // Check for lineHeight variable - check multiple possible property names
  let lineHeightValue: number | string = 0;
  let lineHeightVariable: string | undefined;
  if (lineHeight !== figma.mixed) {
    const lineHeightPropertyNames = ["lineHeight", "line-height", "lineHeightUnit"];
    let lineHeightVar: VariableInfo = { value: lineHeight, isVariable: false };
    
    for (const propName of lineHeightPropertyNames) {
      if (boundVars?.[propName]) {
        lineHeightVar = resolveVariable(node, propName, lineHeight, variables);
        if (lineHeightVar.isVariable) {
          break;
        }
      }
    }
    
    if (lineHeightVar.isVariable) {
      lineHeightValue = typeof lineHeightVar.value === "object" && "value" in lineHeightVar.value 
        ? lineHeightVar.value.value 
        : lineHeightVar.value;
      lineHeightVariable = lineHeightVar.name;
    } else {
      if (typeof lineHeight === "object" && "value" in lineHeight) {
        lineHeightValue = lineHeight.value;
      } else if (typeof lineHeight === "number") {
        lineHeightValue = lineHeight;
      }
    }
  }

  // Handle letterSpacing - it can be a number, an object with unit, or figma.mixed
  // Check for letterSpacing variable - check multiple possible property names
  let letterSpacingValue: number | string = 0;
  let letterSpacingVariable: string | undefined;
  if (letterSpacing !== figma.mixed) {
    const letterSpacingPropertyNames = ["letterSpacing", "letter-spacing", "letterSpacingUnit"];
    let letterSpacingVar: VariableInfo = { value: letterSpacing, isVariable: false };
    
    for (const propName of letterSpacingPropertyNames) {
      if (boundVars?.[propName]) {
        letterSpacingVar = resolveVariable(node, propName, letterSpacing, variables);
        if (letterSpacingVar.isVariable) {
          break;
        }
      }
    }
    
    if (letterSpacingVar.isVariable) {
      letterSpacingValue = typeof letterSpacingVar.value === "object" && "value" in letterSpacingVar.value 
        ? letterSpacingVar.value.value 
        : letterSpacingVar.value;
      letterSpacingVariable = letterSpacingVar.name;
    } else {
      if (typeof letterSpacing === "object" && "value" in letterSpacing) {
        letterSpacingValue = letterSpacing.value;
      } else if (typeof letterSpacing === "number") {
        letterSpacingValue = letterSpacing;
      }
    }
  }

  // Check for fontFamily variable
  let fontFamily: string = fontFamilyRaw;
  let fontFamilyVariable: string | undefined;
  const fontFamilyPropertyNames = ["fontFamily", "font-family", "family"];
  for (const propName of fontFamilyPropertyNames) {
    if (boundVars?.[propName]) {
      const fontFamilyVar = resolveVariable(node, propName, fontFamilyRaw, variables);
      if (fontFamilyVar.isVariable) {
        fontFamily = fontFamilyVar.value; // Use the variable value (which might be the font family name)
        fontFamilyVariable = fontFamilyVar.name;
        break;
      }
    }
  }

  // Check for fontWeight variable
  // Font weight variables store numeric values (400, 700, etc.), but we keep the raw style string for CSS compatibility
  let fontWeight: string = fontWeightRaw;
  let fontWeightVariable: string | undefined;
  const fontWeightPropertyNames = ["fontWeight", "font-weight", "weight"];
  for (const propName of fontWeightPropertyNames) {
    if (boundVars?.[propName]) {
      const fontWeightVar = resolveVariable(node, propName, fontWeightRaw, variables);
      if (fontWeightVar.isVariable) {
        fontWeightVariable = fontWeightVar.name;
        break;
      }
    }
  }

  return {
    fontSize: fontSizeVar.isVariable ? fontSizeVar.value : fontSize,
    fontSizeVariable: fontSizeVar.isVariable ? fontSizeVar.name : undefined,
    fontFamily,
    fontFamilyVariable,
    fontWeight,
    fontWeightVariable,
    lineHeight: lineHeightValue,
    lineHeightVariable,
    letterSpacing: letterSpacingValue,
    letterSpacingVariable,
    textDecoration,
    textCase,
    textAlignHorizontal,
  };
}

/**
 * Extracts layout properties from a node, including variable resolution.
 * 
 * Handles width, height, padding, gap (itemSpacing), border radius, and opacity variables.
 * For border radius, Figma uses separate properties for each corner (topLeftRadius, topRightRadius, etc.)
 * instead of a single cornerRadius property. For INSTANCE nodes, also checks the mainComponent
 * for variable bindings.
 * 
 * @param node - The Figma node to extract layout properties from
 * @param variables - All variable collections for resolving variable values
 * @returns Object with layout properties and variable names
 */
function extractLayout(node: SceneNode, variables: readonly VariableCollection[]): any {
  // Figma's node.height and node.width exclude strokes (borders)
  // So we use them directly without adjustment
  const layout: any = {
    width: typeof node.width === "number" ? node.width : 0,
    height: typeof node.height === "number" ? node.height : 0,
  };

  // Extract layoutGrow (fill behavior) for auto-layout children
  if ("layoutGrow" in node) {
    layout.layoutGrow = (node as any).layoutGrow;
  }

  // Extract layoutSizingHorizontal and layoutSizingVertical (FILL, HUG, FIXED)
  // These indicate whether an element should fill, hug, or have fixed size
  if ("layoutSizingHorizontal" in node) {
    layout.layoutSizingHorizontal = (node as any).layoutSizingHorizontal;
  }
  if ("layoutSizingVertical" in node) {
    layout.layoutSizingVertical = (node as any).layoutSizingVertical;
  }

  // Try to resolve width/height variables
  if (node.boundVariables?.width) {
    const widthVar = resolveVariable(node, "width", node.width, variables);
    if (widthVar.isVariable) {
      layout.width = widthVar.value;
      layout.widthVariable = widthVar.name;
    }
  }

  if (node.boundVariables?.height) {
    const heightVar = resolveVariable(node, "height", node.height, variables);
    if (heightVar.isVariable) {
      layout.height = heightVar.value;
      layout.heightVariable = heightVar.name;
    }
  }

  // Auto-layout properties
  if ("layoutMode" in node) {
    layout.layoutMode = node.layoutMode;
    
    // Extract layout positioning (ABSOLUTE, AUTO)
    if ("layoutPositioning" in node) {
      layout.layoutPositioning = (node as any).layoutPositioning;
    }
    
    // Check for padding variables
    if (node.boundVariables?.paddingLeft) {
      const paddingLeftVar = resolveVariable(node, "paddingLeft", node.paddingLeft, variables);
      if (paddingLeftVar.isVariable) {
        layout.paddingLeft = paddingLeftVar.value;
        layout.paddingLeftVariable = paddingLeftVar.name;
      } else {
        layout.paddingLeft = node.paddingLeft;
      }
    } else {
      layout.paddingLeft = node.paddingLeft;
    }

    if (node.boundVariables?.paddingRight) {
      const paddingRightVar = resolveVariable(node, "paddingRight", node.paddingRight, variables);
      if (paddingRightVar.isVariable) {
        layout.paddingRight = paddingRightVar.value;
        layout.paddingRightVariable = paddingRightVar.name;
      } else {
        layout.paddingRight = node.paddingRight;
      }
    } else {
      layout.paddingRight = node.paddingRight;
    }

    if (node.boundVariables?.paddingTop) {
      const paddingTopVar = resolveVariable(node, "paddingTop", node.paddingTop, variables);
      if (paddingTopVar.isVariable) {
        layout.paddingTop = paddingTopVar.value;
        layout.paddingTopVariable = paddingTopVar.name;
      } else {
        layout.paddingTop = node.paddingTop;
      }
    } else {
      layout.paddingTop = node.paddingTop;
    }

    if (node.boundVariables?.paddingBottom) {
      const paddingBottomVar = resolveVariable(node, "paddingBottom", node.paddingBottom, variables);
      if (paddingBottomVar.isVariable) {
        layout.paddingBottom = paddingBottomVar.value;
        layout.paddingBottomVariable = paddingBottomVar.name;
      } else {
        layout.paddingBottom = node.paddingBottom;
      }
    } else {
      layout.paddingBottom = node.paddingBottom;
    }

    // Check for itemSpacing (gap) variable
    if (node.boundVariables?.itemSpacing) {
      const itemSpacingVar = resolveVariable(node, "itemSpacing", node.itemSpacing, variables);
      if (itemSpacingVar.isVariable) {
        layout.itemSpacing = itemSpacingVar.value;
        layout.itemSpacingVariable = itemSpacingVar.name;
      } else {
        layout.itemSpacing = node.itemSpacing;
      }
    } else {
      layout.itemSpacing = node.itemSpacing;
    }

    layout.primaryAxisAlignItems = node.primaryAxisAlignItems;
    layout.counterAxisAlignItems = node.counterAxisAlignItems;
  }

  // Border radius variable resolution
  // Figma uses separate properties for each corner in boundVariables: topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius
  // Usually all four corners are bound to the same variable, so we check any of them
  // For INSTANCE nodes, also check the mainComponent for variable bindings
  let nodeToCheck = node;
  if (node.type === "INSTANCE" && "mainComponent" in node && node.mainComponent) {
    nodeToCheck = node.mainComponent;
  }
  
  if ("cornerRadius" in nodeToCheck || "cornerRadius" in node) {
    // Use the actual node's cornerRadius value (instance might override mainComponent)
    const cornerRadiusValue = ("cornerRadius" in node) ? (node as any).cornerRadius : (nodeToCheck as any).cornerRadius;
    
    // Check boundVariables on both the instance and mainComponent
    const instanceBoundVars = node.boundVariables as any;
    const mainComponentBoundVars = (nodeToCheck !== node && nodeToCheck.boundVariables) ? nodeToCheck.boundVariables as any : null;
    
    const cornerRadiusProperties = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
    
    let cornerRadiusVar: VariableInfo = { value: cornerRadiusValue, isVariable: false };
    
    // Check instance boundVariables first - check any of the four corner properties
    for (const propName of cornerRadiusProperties) {
      if (instanceBoundVars?.[propName]) {
        cornerRadiusVar = resolveVariable(node, propName, cornerRadiusValue, variables);
        if (cornerRadiusVar.isVariable) {
          break;
        }
      }
    }
    
    // If not found on instance, check mainComponent
    if (!cornerRadiusVar.isVariable && nodeToCheck !== node && mainComponentBoundVars) {
      for (const propName of cornerRadiusProperties) {
        if (mainComponentBoundVars?.[propName]) {
          cornerRadiusVar = resolveVariable(nodeToCheck, propName, cornerRadiusValue, variables);
          if (cornerRadiusVar.isVariable) {
            break;
          }
        }
      }
    }
    
    if (cornerRadiusVar.isVariable) {
      layout.cornerRadius = cornerRadiusVar.value;
      layout.cornerRadiusVariable = cornerRadiusVar.name;
    } else {
      layout.cornerRadius = cornerRadiusValue;
    }
  } else {
    // Ensure cornerRadius is set even if not in node
    layout.cornerRadius = undefined;
  }

  // Opacity - check for variable
  if ("opacity" in node) {
    if (node.boundVariables?.opacity) {
      const opacityVar = resolveVariable(node, "opacity", node.opacity, variables);
      if (opacityVar.isVariable) {
        layout.opacity = opacityVar.value;
        layout.opacityVariable = opacityVar.name;
      } else {
        layout.opacity = node.opacity;
      }
    } else {
      layout.opacity = node.opacity;
    }
  }

  return layout;
}

/**
 * Extracts positioning properties (x, y, rotation) from a node.
 * 
 * @param node - The Figma node to extract positioning from
 * @returns Object with positioning properties
 */
function extractPositioning(node: SceneNode): any {
  return {
    x: node.x,
    y: node.y,
    rotation: "rotation" in node ? node.rotation : 0,
  };
}

/**
 * Extracts all style properties from a Figma node, including fills, strokes, effects,
 * typography, layout, positioning, opacity, and visibility.
 * 
 * This is the main entry point for style extraction. It coordinates all the individual
 * extractor functions and returns a complete ExtractedStyles object.
 * 
 * EXTRACTION PROCESS:
 * 1. Fills: Background colors, gradients, images (with variable resolution)
 * 2. Strokes: Border colors, widths, styles (with variable resolution)
 * 3. Effects: Shadows, blurs (no variables supported)
 * 4. Typography: Font properties, text styling (with variable resolution)
 * 5. Layout: Dimensions, padding, gap, flex properties, border radius, opacity (with variable resolution)
 * 6. Positioning: X, Y coordinates, rotation
 * 7. Visibility: Visible/hidden state
 * 
 * VARIABLE RESOLUTION:
 * All extractor functions check for Figma variable bindings and resolve them using
 * the provided variable collections. If no variable is bound, raw values are used.
 * 
 * ERROR HANDLING:
 * Individual extractor functions handle errors gracefully, returning null or default
 * values when extraction fails. This ensures partial extraction is possible even if
 * some properties cannot be extracted.
 * 
 * @param node - The Figma node to extract styles from
 * @param variables - All variable collections for resolving variable values
 * @returns ExtractedStyles object containing all extracted style information:
 *   - fills: Array of fill objects with colors, gradients, or images
 *   - strokes: Object with stroke colors, width, style, and alignment
 *   - effects: Array of shadow and blur effects
 *   - typography: Object with font properties and text styling
 *   - layout: Object with dimensions, spacing, flex, and layout properties
 *   - positioning: Object with x, y coordinates and rotation
 *   - opacity: Opacity value (0-1)
 *   - visible: Visibility flag (true/false)
 */
export function extractStyles(
  node: SceneNode,
  variables: readonly VariableCollection[]
): ExtractedStyles {
  return {
    fills: extractFills(node, variables),
    strokes: extractStrokes(node, variables),
    effects: extractEffects(node),
    typography: extractTypography(node, variables),
    layout: extractLayout(node, variables),
    positioning: extractPositioning(node),
    opacity: "opacity" in node ? node.opacity : 1,
    visible: node.visible,
  };
}

/**
 * Retrieves all local variable collections from the current Figma file.
 * 
 * @returns Array of VariableCollection objects, or empty array if retrieval fails
 */
export function getAllVariables(): readonly VariableCollection[] {
  try {
    return figma.variables.getLocalVariableCollections();
  } catch (e) {
    return [];
  }
}

/**
 * Component property definition structure
 */
export interface ExtractedComponentProperty {
  name: string;
  type: "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP";
  defaultValue: string | boolean;
  variantOptions?: string[];
}

/**
 * Variant property values structure
 */
export interface ExtractedVariantProperties {
  variantId: string;
  variantName: string;
  properties: Record<string, string | boolean>;
}

/**
 * Full component properties result
 */
export interface ExtractedComponentPropertiesResult {
  definitions: ExtractedComponentProperty[];
  variants: ExtractedVariantProperties[];
}

/**
 * Parses variant name string into property-value pairs.
 * Figma variant names use format: "property1=value1, property2=value2"
 * 
 * @param name - The variant name string from Figma
 * @returns Object with property names as keys and their values
 */
function parseVariantName(name: string): Record<string, string | boolean> {
  const properties: Record<string, string | boolean> = {};
  
  // Split by comma and parse each property=value pair
  const pairs = name.split(",").map(s => s.trim());
  
  for (const pair of pairs) {
    const [propName, propValue] = pair.split("=").map(s => s.trim());
    if (propName && propValue !== undefined) {
      // Convert boolean strings to actual booleans
      if (propValue.toLowerCase() === "true") {
        properties[propName] = true;
      } else if (propValue.toLowerCase() === "false") {
        properties[propName] = false;
      } else {
        properties[propName] = propValue;
      }
    }
  }
  
  return properties;
}

/**
 * Extracts component property definitions from a COMPONENT_SET or COMPONENT node.
 * 
 * For COMPONENT_SET nodes:
 * - Extracts componentPropertyDefinitions which contains all property types
 * - For VARIANT properties, extracts variantGroupProperties which contains all possible values
 * - For BOOLEAN, TEXT, INSTANCE_SWAP properties, extracts from componentPropertyDefinitions
 * 
 * For COMPONENT nodes that are children of COMPONENT_SET:
 * - Parses the variant name to get property values
 * 
 * @param node - The Figma node (COMPONENT_SET or COMPONENT)
 * @returns ExtractedComponentPropertiesResult with definitions and variant values
 */
export function extractComponentProperties(
  node: SceneNode
): ExtractedComponentPropertiesResult | null {
  const result: ExtractedComponentPropertiesResult = {
    definitions: [],
    variants: [],
  };

  try {
    // Handle COMPONENT_SET - the main component with all variants
    if (node.type === "COMPONENT_SET") {
      const componentSet = node as ComponentSetNode;
      
      // Extract property definitions from componentPropertyDefinitions
      if ("componentPropertyDefinitions" in componentSet) {
        const propDefs = componentSet.componentPropertyDefinitions;
        
        for (const [propName, propDef] of Object.entries(propDefs)) {
          const extractedProp: ExtractedComponentProperty = {
            name: propName,
            type: propDef.type as "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP",
            defaultValue: propDef.defaultValue as string | boolean,
          };
          
          // For VARIANT type, extract variantOptions
          if (propDef.type === "VARIANT" && "variantOptions" in propDef) {
            extractedProp.variantOptions = propDef.variantOptions as string[];
          }
          
          result.definitions.push(extractedProp);
        }
      }
      
      // Also check variantGroupProperties for variant values (older API)
      if ("variantGroupProperties" in componentSet) {
        const variantGroups = (componentSet as any).variantGroupProperties;
        if (variantGroups) {
          for (const [propName, propData] of Object.entries(variantGroups as Record<string, any>)) {
            // Check if this property is already in definitions
            const existingDef = result.definitions.find(d => d.name === propName);
            if (!existingDef) {
              result.definitions.push({
                name: propName,
                type: "VARIANT",
                defaultValue: propData.values?.[0] || "",
                variantOptions: propData.values || [],
              });
            } else if (!existingDef.variantOptions && propData.values) {
              existingDef.variantOptions = propData.values;
            }
          }
        }
      }
      
      // Extract variant property values from each child component
      if ("children" in componentSet && componentSet.children) {
        for (const child of componentSet.children) {
          if (child.type === "COMPONENT") {
            const variantProps = parseVariantName(child.name);
            result.variants.push({
              variantId: child.id,
              variantName: child.name,
              properties: variantProps,
            });
          }
        }
      }
    }
    // Handle individual COMPONENT (might be a variant or standalone)
    else if (node.type === "COMPONENT") {
      const component = node as ComponentNode;
      
      // Check if this component is part of a COMPONENT_SET
      if (component.parent && component.parent.type === "COMPONENT_SET") {
        // Get definitions from parent
        const parentResult = extractComponentProperties(component.parent);
        if (parentResult) {
          result.definitions = parentResult.definitions;
        }
        
        // Parse this variant's properties from its name
        const variantProps = parseVariantName(component.name);
        result.variants.push({
          variantId: component.id,
          variantName: component.name,
          properties: variantProps,
        });
      } else {
        // Standalone component - extract its own property definitions
        if ("componentPropertyDefinitions" in component) {
          const propDefs = component.componentPropertyDefinitions;
          
          for (const [propName, propDef] of Object.entries(propDefs)) {
            result.definitions.push({
              name: propName,
              type: propDef.type as "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP",
              defaultValue: propDef.defaultValue as string | boolean,
            });
          }
        }
      }
    }
    // Handle INSTANCE - get properties from the instance
    else if (node.type === "INSTANCE") {
      const instance = node as InstanceNode;
      
      // Get the main component to extract definitions
      if (instance.mainComponent) {
        const mainResult = extractComponentProperties(instance.mainComponent);
        if (mainResult) {
          result.definitions = mainResult.definitions;
        }
      }
      
      // Extract current instance property values
      if ("componentProperties" in instance) {
        const instanceProps = instance.componentProperties;
        const properties: Record<string, string | boolean> = {};
        
        for (const [propName, propValue] of Object.entries(instanceProps)) {
          if (typeof propValue === "object" && "value" in propValue) {
            properties[propName] = propValue.value as string | boolean;
          }
        }
        
        result.variants.push({
          variantId: instance.id,
          variantName: instance.name,
          properties,
        });
      }
    }
    
    // Return null if no properties found
    if (result.definitions.length === 0 && result.variants.length === 0) {
      return null;
    }
    
    return result;
  } catch (e) {
    console.warn("Error extracting component properties:", e);
    return null;
  }
}