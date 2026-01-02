# API Reference

Quick reference for key functions, interfaces, and types in the Figma Design-to-Code Plugin.

---

## Table of Contents

1. [Extraction Functions](#extraction-functions)
2. [Generator Functions](#generator-functions)
3. [Key Interfaces](#key-interfaces)
4. [Utility Functions](#utility-functions)
5. [Constants](#constants)

---

## Extraction Functions

### Component Traverser

`src/plugin/extractors/componentTraverser.ts`

#### `traverseComponent(node)`

Recursively traverses a Figma node and builds a tree structure.

```typescript
async function traverseComponent(node: SceneNode): Promise<ExtractedNode>
```

**Parameters:**
- `node` - Figma SceneNode to traverse

**Returns:** `ExtractedNode` - Tree structure representing the node and children

**Example:**
```typescript
const selection = figma.currentPage.selection[0];
const tree = await traverseComponent(selection);
```

---

### Style Extractor

`src/plugin/extractors/styleExtractor.ts`

#### `extractStyles(node, variables)`

Extracts all visual styles from a Figma node with variable resolution.

```typescript
async function extractStyles(
  node: SceneNode,
  variables: readonly VariableCollection[]
): Promise<ExtractedStyles>
```

**Parameters:**
- `node` - Figma node to extract from
- `variables` - Variable collections for resolution

**Returns:** `ExtractedStyles` - Complete style information

#### `getAllVariables()`

Fetches all variable collections from the document.

```typescript
async function getAllVariables(): Promise<readonly VariableCollection[]>
```

#### `extractComponentProperties(node)`

Extracts variant properties from a component or component set.

```typescript
async function extractComponentProperties(
  node: SceneNode
): Promise<ComponentPropertyDefinitions | null>
```

---

## Generator Functions

### CSS Generator

`src/common/cssGenerator.ts`

#### `fillsToCSS(fills, variableMap)`

Converts fill properties to CSS background properties.

```typescript
function fillsToCSS(
  fills: ExtractedFill[],
  variableMap: VariableMap
): string[]
```

**Returns:** Array of CSS property strings (e.g., `["background-color: var(--fill-primary)"]`)

#### `strokesToCSS(strokes, variableMap)`

Converts stroke properties to CSS border properties.

```typescript
function strokesToCSS(
  strokes: ExtractedStrokes,
  variableMap: VariableMap
): string[]
```

#### `typographyToCSS(typography, variableMap)`

Converts typography properties to CSS font properties.

```typescript
function typographyToCSS(
  typography: ExtractedTypography,
  variableMap: VariableMap
): string[]
```

#### `layoutToCSS(layout, variableMap)`

Converts layout properties to CSS flexbox/sizing properties.

```typescript
function layoutToCSS(
  layout: ExtractedLayout,
  variableMap: VariableMap
): string[]
```

#### `effectsToCSS(effects, variableMap)`

Converts effects to CSS box-shadow and filter properties.

```typescript
function effectsToCSS(
  effects: ExtractedEffect[],
  variableMap: VariableMap
): string[]
```

---

### Tailwind Generator

`src/common/tailwindGenerator.ts`

#### `fillsToTailwind(fills, variableMap)`

Converts fills to Tailwind background classes.

```typescript
function fillsToTailwind(
  fills: ExtractedFill[],
  variableMap: VariableMap
): string[]
```

**Returns:** Array of class strings (e.g., `["bg-fill-primary"]`)

#### `strokesToTailwind(strokes, variableMap)`

Converts strokes to Tailwind border classes.

```typescript
function strokesToTailwind(
  strokes: ExtractedStrokes,
  variableMap: VariableMap
): string[]
```

#### `typographyToTailwind(typography, variableMap)`

Converts typography to Tailwind text classes.

```typescript
function typographyToTailwind(
  typography: ExtractedTypography,
  variableMap: VariableMap
): string[]
```

#### `layoutToTailwind(layout, variableMap)`

Converts layout to Tailwind flex/sizing classes.

```typescript
function layoutToTailwind(
  layout: ExtractedLayout,
  variableMap: VariableMap
): string[]
```

#### `effectsToTailwind(effects, variableMap)`

Converts effects to Tailwind shadow/blur classes.

```typescript
function effectsToTailwind(
  effects: ExtractedEffect[],
  variableMap: VariableMap
): string[]
```

#### `buildClassToDOMMap(nodes, variables)`

Builds a map of Tailwind classes to DOM element names.

```typescript
function buildClassToDOMMap(
  nodes: ExtractedNode[],
  variables: readonly VariableCollection[]
): { [className: string]: string[] }
```

**Returns:** Map where keys are class names and values are arrays of element names

---

### DOM Generators

#### `generateDOM(nodes, variableMap, options)`

Generates HTML with inline CSS styles.

```typescript
function generateDOM(
  nodes: ExtractedNode[],
  variableMap: VariableMap,
  options: DOMGeneratorOptions
): GeneratedDOM
```

**Returns:**
```typescript
interface GeneratedDOM {
  html: string;
  css: string;
  stylesheet: string;
  usedVariables: string[];
}
```

#### `generateTailwindDOM(nodes, variableMap, options)`

Generates JSX with Tailwind classes.

```typescript
function generateTailwindDOM(
  nodes: ExtractedNode[],
  variableMap: VariableMap,
  options: TailwindDOMGeneratorOptions
): GeneratedTailwindDOM
```

---

### CVA Generator

`src/common/cvaGenerator.ts`

#### `generateCVACode(config, componentName?)`

Generates CVA TypeScript code from configuration.

```typescript
function generateCVACode(
  config: CVAConfig,
  componentName?: string
): string
```

**Parameters:**
- `config` - CVA configuration object
- `componentName` - Optional component name for the export

**Returns:** Generated TypeScript code string

---

### RAW JSON Generator

`src/common/rawJsonGenerator.ts`

#### `generateRawJSON(nodes)`

Generates prettified JSON representation.

```typescript
function generateRawJSON(nodes: ExtractedNode[]): string
```

---

## Key Interfaces

### ExtractedNode

Node structure from component traversal.

```typescript
interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  componentSetName?: string;
  annotations: string[];
  icon?: {
    isIcon: boolean;
    iconName: string;
  };
  children?: ExtractedNode[];
  styles?: ExtractedStyles;
  characters?: string;
}
```

### ExtractedStyles

Complete style information for a node.

```typescript
interface ExtractedStyles {
  fills: ExtractedFill[] | null;
  strokes: ExtractedStrokes | null;
  effects: ExtractedEffect[] | null;
  typography: ExtractedTypography | null;
  layout: ExtractedLayout | null;
  positioning: ExtractedPositioning | null;
  opacity: number;
  visible: boolean;
}
```

### ExtractedFill

Fill/background color information.

```typescript
interface ExtractedFill {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: string;
  opacity?: number;
  variable?: string;
  gradientStops?: GradientStop[];
}
```

### ExtractedStrokes

Border/stroke information.

```typescript
interface ExtractedStrokes {
  strokes: ExtractedStroke[];
  strokeWeight: number;
  strokeWeightVariable?: string;
  strokeAlign: "INSIDE" | "OUTSIDE" | "CENTER";
  hasIndividualStrokes?: boolean;
  individualSides?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  strokeDashArray?: number[];
}
```

### ExtractedTypography

Typography/font information.

```typescript
interface ExtractedTypography {
  fontSize: number;
  fontSizeVariable?: string;
  fontFamily: string;
  fontFamilyVariable?: string;
  fontWeight: string;
  fontWeightVariable?: string;
  lineHeight: number;
  lineHeightVariable?: string;
  letterSpacing: number;
  letterSpacingVariable?: string;
  textDecoration: string;
  textCase: string;
  textAlignHorizontal: string;
}
```

### ExtractedLayout

Layout/sizing information.

```typescript
interface ExtractedLayout {
  width: number;
  height: number;
  widthVariable?: string;
  heightVariable?: string;
  minWidth?: number;
  minWidthVariable?: string;
  maxWidth?: number;
  maxWidthVariable?: string;
  minHeight?: number;
  minHeightVariable?: string;
  maxHeight?: number;
  maxHeightVariable?: string;
  layoutGrow: number;
  layoutSizingHorizontal: "FILL" | "HUG" | "FIXED";
  layoutSizingVertical: "FILL" | "HUG" | "FIXED";
  layoutMode: "HORIZONTAL" | "VERTICAL" | "NONE";
  layoutWrap: "NO_WRAP" | "WRAP";
  layoutPositioning: "AUTO" | "ABSOLUTE";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  // ... padding variables
  itemSpacing: number;
  itemSpacingVariable?: string;
  counterAxisSpacing?: number;
  counterAxisSpacingVariable?: string;
  primaryAxisAlignItems: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems: "MIN" | "CENTER" | "MAX" | "BASELINE";
  cornerRadius: number | number[];
  // ... corner radius variables
  opacity: number;
}
```

### ExtractedEffect

Shadow/blur effect information.

```typescript
interface ExtractedEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  color?: string;
  opacity?: number;
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  variable?: string;
  // Individual variable bindings
  colorVariable?: string;
  radiusVariable?: string;
  spreadVariable?: string;
  offsetXVariable?: string;
  offsetYVariable?: string;
}
```

### MultiFormatExtractionResult

Complete extraction result sent to UI.

```typescript
interface MultiFormatExtractionResult {
  // Node information
  nodes: ExtractedNode[];
  nodeType: string;
  nodeName: string;
  nodeId: string;
  
  // Generated outputs
  cssSheet: string;
  cssCode: string;
  tailwindSheet: string;
  tailwindCode: string;
  rawJSON: string;
  
  // Variable information
  usedVariables: string[];
  classToDOMMap: { [className: string]: string[] };
  
  // Component properties
  componentProperties?: ComponentPropertyDefinitions;
}
```

### CVAConfig

CVA tool configuration.

```typescript
interface CVAConfig {
  base: string[];
  variants: Record<string, Record<string, CVAPrefixedClasses>>;
  compoundVariants: CompoundVariantRule[];
  defaultVariants: Record<string, string>;
}

interface CVAPrefixedClasses {
  default: string[];
  hover: string[];
  active: string[];
  focus: string[];
  disabled: string[];
}

interface CompoundVariantRule {
  id: string;
  conditions: CompoundCondition[];
  classes: CVAPrefixedClasses;
}
```

### VariableMap

Map of variable names to resolved values.

```typescript
type VariableMap = { [variableName: string]: string };
```

---

## Utility Functions

### Element Naming

`src/common/utils/elementNaming.ts`

#### `sanitizeForReact(nodeName, componentSetName?)`

Sanitizes name for React/JSX (preserves dots).

```typescript
function sanitizeForReact(
  nodeName: string,
  componentSetName?: string
): string
```

#### `sanitizeForHTML(nodeName, componentSetName?)`

Sanitizes name for HTML (removes dots).

```typescript
function sanitizeForHTML(
  nodeName: string,
  componentSetName?: string
): string
```

#### `normalizeForMatching(name)`

Normalizes name for internal matching (lowercase, special chars removed).

```typescript
function normalizeForMatching(name: string): string
```

---

### Property Filters

`src/common/utils/propertyFilters.ts`

#### `isZeroValueClass(className)`

Checks if a Tailwind class has a zero value.

```typescript
function isZeroValueClass(className: string): boolean
```

**Example:**
```typescript
isZeroValueClass("rounded-[0px]") // true
isZeroValueClass("rounded-lg")    // false
```

#### `filterZeroValueClasses(classes)`

Filters out zero-value classes from an array.

```typescript
function filterZeroValueClasses(classes: string[]): string[]
```

#### `isUselessCSSProperty(property)`

Checks if a CSS property should be filtered.

```typescript
function isUselessCSSProperty(property: string): boolean
```

---

### Variable Patterns

`src/common/constants/variablePatterns.ts`

#### `normalizeVariableName(variableName)`

Normalizes a Figma variable name for pattern matching.

```typescript
function normalizeVariableName(variableName: string): string
```

**Example:**
```typescript
normalizeVariableName("spacing/4")   // "spacing-4"
normalizeVariableName("Font/Size/LG") // "font-size-lg"
```

#### `toCSSVariable(figmaName)`

Converts Figma variable name to CSS custom property.

```typescript
function toCSSVariable(figmaName: string): string
```

**Example:**
```typescript
toCSSVariable("spacing/4") // "--spacing-4"
```

#### `toTailwindClass(figmaName)`

Converts Figma variable name to Tailwind class name.

```typescript
function toTailwindClass(figmaName: string): string
```

**Example:**
```typescript
toTailwindClass("fill/primary") // "fill-primary"
```

---

## Constants

### Figma Types

`src/common/constants/figmaTypes.ts`

```typescript
// Layout sizing modes
const LayoutSizing = {
  FILL: "FILL",
  HUG: "HUG",
  FIXED: "FIXED",
};

// Layout modes (flex direction)
const LayoutMode = {
  HORIZONTAL: "HORIZONTAL",
  VERTICAL: "VERTICAL",
  NONE: "NONE",
};

// Fill types
const FillType = {
  SOLID: "SOLID",
  GRADIENT_LINEAR: "GRADIENT_LINEAR",
  GRADIENT_RADIAL: "GRADIENT_RADIAL",
  IMAGE: "IMAGE",
};

// Effect types
const EffectType = {
  DROP_SHADOW: "DROP_SHADOW",
  INNER_SHADOW: "INNER_SHADOW",
  LAYER_BLUR: "LAYER_BLUR",
  BACKGROUND_BLUR: "BACKGROUND_BLUR",
};
```

### Tailwind Prefixes

`src/common/constants/tailwindPrefixes.ts`

```typescript
// Color prefixes
const ColorPrefix = {
  BACKGROUND: "bg-",
  TEXT: "text-",
  BORDER: "border-",
};

// Spacing prefixes
const SpacingPrefix = {
  PADDING: "p-",
  MARGIN: "m-",
  GAP: "gap-",
};

// Sizing prefixes
const SizingPrefix = {
  WIDTH: "w-",
  HEIGHT: "h-",
  MIN_WIDTH: "min-w-",
  MAX_WIDTH: "max-w-",
};
```

### Variable Patterns

`src/common/constants/variablePatterns.ts`

```typescript
// Regex patterns for variable parsing
const VariablePattern = {
  SPACING: /^spacing-(?:(\d+)-(\d+)|px|([\d.]+))$/,
  FONT_SIZE: /^font-size-(.+)$/,
  FONT_WEIGHT: /^font-weight-(.+)$/,
  BORDER_RADIUS: /^(?:radius|rounded)-(.+)$/,
  SHADOW: /^shadow-(.+)$/,
};
```

---

## Related Documentation

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development setup and extending
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [USER_GUIDE.md](./USER_GUIDE.md) - End user documentation

