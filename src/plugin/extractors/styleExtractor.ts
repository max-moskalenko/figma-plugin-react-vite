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
      
      if (node.boundVariables?.fills) {
        const fillBinding = (node.boundVariables.fills as any)[fillIndex];
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
                const value = variable.valuesByMode[modeId];
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
 * Extracts stroke (border) properties from a node, including variable resolution.
 * 
 * Supports stroke color and stroke weight variables. Figma stores stroke weight variables
 * using separate properties for each side: strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight.
 * Usually all four are bound to the same variable, so we check any of them.
 * 
 * @param node - The Figma node to extract strokes from
 * @param variables - All variable collections for resolving variable values
 * @returns Object with strokes array, strokeWeight, strokeWeightVariable, and strokeAlign, or null if no strokes
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
      
      if (node.boundVariables?.strokes) {
        const strokeBinding = (node.boundVariables.strokes as any)[strokeIndex];
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
                const value = variable.valuesByMode[modeId];
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
      }
      
      const color = colorVar.isVariable ? colorVar.value : stroke.color;
      
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

  const strokeWeight = "strokeWeight" in node ? node.strokeWeight : undefined;
  const strokeAlign = "strokeAlign" in node ? node.strokeAlign : undefined;
  const strokeDashArray = "strokeDashArray" in node ? (node as any).strokeDashArray : undefined;

  // Figma uses separate properties for each stroke side: strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight
  // Usually all four are bound to the same variable, so we check any of them
  let strokeWeightVariable: string | undefined;
  if (strokeWeight !== undefined) {
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
