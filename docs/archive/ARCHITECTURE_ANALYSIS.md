# Architecture Analysis: Figma Design-to-Code Plugin

This document provides a detailed analysis of the plugin's architecture, focusing on the two main tools and their data transformation pipelines.

## Table of Contents

1. [System Overview](#system-overview)
2. [DOM Extractor Tool](#dom-extractor-tool)
3. [CVA Mapping Tool](#cva-mapping-tool)
4. [Data Flow & Transformations](#data-flow--transformations)
5. [Key Architectural Decisions](#key-architectural-decisions)
6. [Recent Improvements](#recent-improvements)

---

## System Overview

### Architecture Pattern

The plugin uses a **dual-sandbox architecture** with strict separation between:

1. **Plugin Sandbox** (Figma API access, file system denied)
   - Extracts data from Figma nodes
   - Resolves variables and styles
   - Loads fonts
   - No UI rendering

2. **UI Sandbox** (UI rendering, Figma API denied)
   - React-based user interface
   - State management
   - Code generation
   - No direct Figma access

**Communication**: `monorepo-networker` provides type-safe message passing between sandboxes.

### Two-Tool System

```
┌─────────────────────────────────────────────────────────────┐
│                    Figma Plugin                              │
├──────────────────────────┬───────────────────────────────────┤
│   DOM Extractor Tool     │   CVA Mapping Tool                │
│   ├─ Node Traversal      │   ├─ Class Extraction             │
│   ├─ Style Extraction    │   ├─ Property Detection           │
│   ├─ Variable Resolution │   ├─ Visual Mapping UI            │
│   └─ Code Generation     │   └─ CVA Code Generation          │
│      ├─ CSS Format        │                                   │
│      ├─ Tailwind Format   │                                   │
│      └─ Raw JSON          │                                   │
└──────────────────────────┴───────────────────────────────────┘
```

**Tool Relationship**: CVA tool depends on Extractor's Tailwind output as input.

---

## DOM Extractor Tool

### Purpose

Convert Figma component designs into production-ready HTML with CSS or Tailwind classes.

### Data Transformation Pipeline

```
┌─────────────────┐
│  Figma Nodes    │
└────────┬────────┘
         │ [componentTraverser.ts]
         ▼
┌─────────────────┐
│  Node Hierarchy │ (ExtractedNode tree with structure only)
└────────┬────────┘
         │ [styleExtractor.ts]
         ▼
┌─────────────────┐
│  Enriched Nodes │ (with styles property populated)
└────────┬────────┘
         │ [plugin.network.ts: getCode]
         ▼
┌─────────────────┐
│ Font Loading    │ (async font loading for TEXT nodes)
└────────┬────────┘
         │
         ▼
┌───────────────────────────────────────┐
│  Multi-Format Code Generation         │
├─────────────┬─────────────┬───────────┤
│ CSS Format  │ Tailwind    │ Raw JSON  │
│ (domGen)    │ (tailGen)   │ (rawGen)  │
└─────────────┴─────────────┴───────────┘
```

### Key Transformations

#### 1. Node Traversal (Figma → ExtractedNode)

**Input**: `SceneNode` (Figma's node type)  
**Output**: `ExtractedNode` (our internal structure)

```typescript
interface ExtractedNode {
  id: string;              // Figma node ID
  name: string;            // Layer name
  type: string;            // FRAME, TEXT, COMPONENT, etc.
  annotations: string[];   // Comments/notes
  styles?: ExtractedStyles; // Populated in next step
  children?: ExtractedNode[]; // Child nodes
}
```

**Process**:
- Recursively walks the Figma node tree
- Preserves parent-child relationships
- Extracts metadata (id, name, type, annotations)
- **Does NOT extract styles** (done separately)

#### 2. Style Extraction (Figma Properties → ExtractedStyles)

**Input**: `SceneNode` + `VariableCollection[]`  
**Output**: `ExtractedStyles` (comprehensive style object)

```typescript
interface ExtractedStyles {
  fills: Array<{type, color, opacity, variable?}>;
  strokes: {colors, weight, style, alignment, variable?};
  effects: Array<{type, offset, blur, spread, color}>;
  typography: {fontSize, fontFamily, fontWeight, lineHeight, ...};
  layout: {width, height, padding, gap, borderRadius, ...};
  positioning: {x, y, rotation};
  opacity: number;
  visible: boolean;
}
```

**Key Features**:
- **Variable Resolution**: Checks `node.boundVariables` for each property
- **Array Handling**: Typography variables often stored as arrays
- **Fallback**: Uses raw values when no variable is bound
- **Mode Resolution**: Uses first mode from variable collections

#### 3. Variable Resolution Process

**The Challenge**: Figma stores variable bindings separately from values.

```typescript
// Node has both raw value and variable binding
node.width = 100;
node.boundVariables.width = { id: "VariableID:123", type: "VariableAlias" };
```

**Resolution Steps**:
1. Check if `node.boundVariables[propertyName]` exists
2. Handle array bindings (extract first element)
3. Get variable ID from `VariableAlias` object
4. Lookup variable using `figma.variables.getVariableById()`
5. Find variable's collection
6. Get first mode ID from collection
7. Resolve value using `variable.valuesByMode[modeId]`
8. Return `{ name, value, isVariable: true }`

**Property Name Mapping**:
- Figma uses different names in `boundVariables`
- Example: `cornerRadius` → checks `topLeftRadius`, `topRightRadius`, etc.
- Example: `strokeWeight` → checks `strokeTopWeight`, `strokeBottomWeight`, etc.

#### 4. CSS Generation (ExtractedStyles → CSS)

**Input**: `ExtractedNode[]` with populated styles  
**Output**: HTML with inline styles

```html
<div style="padding: var(--spacing-4); background-color: var(--color-primary);">
  <p style="font-size: 16px; color: #ffffff;">Click me</p>
</div>
```

**Features**:
- CSS custom property references (`var(--name)`)
- `:root` block with variable definitions
- Zero-value filtering
- Data attributes for semantics

#### 5. Tailwind Generation (ExtractedStyles → Tailwind Classes)

**Input**: `ExtractedNode[]` with populated styles  
**Output**: HTML with Tailwind utility classes

**Transformation Chain**:
```
ExtractedStyles
  ↓ [fillsToTailwind]
bg-fill-primary text-foreground-on-accent
  ↓ [layoutToTailwind]
flex flex-row p-4 gap-2 rounded-lg
  ↓ [typographyToTailwind]
font-sans text-base font-medium leading-5
  ↓ [strokesToTailwind]
border-2 border-stroke-neutral
  ↓ [combine all]
<div className="flex flex-row p-4 gap-2 bg-fill-primary rounded-lg">
```

**Remapping Strategy**:
1. **Variable Detection**: Check if property has Figma variable
2. **Value Extraction**: Parse variable name for semantic values
3. **Class Generation**: Map to Tailwind utility class
4. **Fallback**: Use arbitrary values when no direct class exists

See [CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md) for complete remapping rules.

---

## CVA Mapping Tool

### Purpose

Generate type-safe CVA (Class Variance Authority) configuration from Figma component variants.

### Data Transformation Pipeline

```
┌────────────────────────┐
│  Extractor Output      │ (Tailwind HTML + Raw JSON + Component Properties)
└───────────┬────────────┘
            │ [useCVAState.ts: setExtractorResult]
            ▼
┌────────────────────────┐
│  Class Extraction      │ Parse all classes from Tailwind output
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  Categorization        │ Group by fill, typography, spacing, etc.
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  DOM Mapping           │ Associate classes with DOM elements
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  Property Detection    │ Extract variant properties from code + Figma API
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  Variant Name Filter   │ Remove Figma-generated variant names
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  User Mapping          │ Visual UI for mapping classes to variants
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  CVA Code Generation   │ TypeScript output
└────────────────────────┘
```

### Key Transformations

#### 1. Class Extraction & Categorization

**Input**: Tailwind stylesheet (HTML string)  
**Process**: Regex-based extraction  
**Output**: `ExtractedClass[]`

```typescript
interface ExtractedClass {
  id: string;
  className: string;        // e.g., "bg-fill-primary"
  category: ClassCategory;  // fill, typography, spacing, etc.
  domElements: string[];    // Which DOM elements use this class
  isSelected: boolean;      // For base class selection
  usedInVariants: boolean;  // Prevents duplicate in base classes
}
```

**Categorization Rules**:
- Pattern-based matching using regex
- Categories: fill, stroke, border-radius, typography, spacing, layout, effects, other
- Implemented in `classManager.ts`

#### 2. DOM-to-Classes Mapping

**The Problem**: Need to filter classes by which DOM element they belong to.

**Solution**: Two-pass extraction from Tailwind output

**Pass 1: Build DOM Hierarchy from RAW JSON**
```typescript
interface DOMElement {
  name: string;    // Normalized kebab-case name
  depth: number;   // Nesting level for visual hierarchy
}

// Example hierarchy:
[
  { name: "button-root", depth: 0 },          // Variant root
  { name: "left-list-item-slot", depth: 1 },  // Child
  { name: "acorn", depth: 2 },                // Nested child
  { name: "vector", depth: 3 },               // Deep child
]
```

**Pass 2: Map Classes from Tailwind HTML**
```typescript
// Parse: <div className="button-root flex flex-row p-4">
// Result: classToDOMMap
{
  "flex": Set(["button-root"]),
  "flex-row": Set(["button-root"]),
  "p-4": Set(["button-root"]),
}
```

**Key Algorithm**:
1. Parse RAW JSON to build complete DOM hierarchy
2. For each variant, create `childElementsHierarchy: DOMElement[]`
3. Parse Tailwind HTML to extract classes per element
4. The first class in `className` is the element identifier
5. Remaining classes are styling utilities
6. Map styling classes to element names in `classToDOMMap`

**Why This Approach**:
- **RAW JSON** provides reliable structure (names, hierarchy)
- **Tailwind HTML** provides actual CSS classes
- **Separation** prevents fragile string parsing
- **Single source of truth**: RAW for structure, Tailwind for classes

#### 3. Property Detection

**Sources**:
1. **Code Snippet Parsing**: Extract `property=value` pairs from comments/HTML
2. **Figma Component Properties API**: Get complete property definitions

**Extraction Pattern**:
```typescript
const propValueRegex = /([a-zA-Z][\w-]*)=([^,\s"<>]+)/g;

// Example: "vis-height=h-28, interaction=Default, vis-sentiment=Brand"
// Extracts:
{
  "vis-height": ["h-28"],
  "interaction": ["Default", "Hover", "Pressed"],
  "vis-sentiment": ["Brand", "Neutral"]
}
```

**Normalization**:
- Boolean values: `True`/`False` → `true`/`false`
- Duplicate removal after merge
- Skip: `data-*`, `class`, `className` properties

**Merging Logic**:
```typescript
// 1. Get properties from code snippet
const snippetProps = extractPropertiesFromSnippet(code);

// 2. Get properties from Figma API
const figmaProps = componentProperties?.variants || [];

// 3. Merge: Figma's variantOptions provide complete lists
for (const figmaProp of figmaProps) {
  if (snippetProps.has(figmaProp.name)) {
    // Add Figma's values to snippet values
    snippetProps.get(figmaProp.name).add(...figmaProp.variantOptions);
  }
}
```

#### 4. Variant Name Filtering

**The Problem**: Figma generates variant names like:
```
vis-height-h-28-vis-iconbutton-false-interaction-hover-vis-sentiment-brand
```

These appear in class lists but aren't real CSS classes.

**Detection Algorithm**:
```typescript
function isFigmaVariantName(className: string): boolean {
  // Must be at least 20 chars
  if (className.length < 20) return false;
  
  // Must have at least 5 segments
  if (className.split('-').length < 5) return false;
  
  // Must match 2+ of these patterns:
  const patterns = [
    /^vis-/,              // Starts with vis-
    /-vis-/,              // Contains -vis-
    /-(true|false)(-|$)/, // Contains boolean
    /-interaction-/,      // Contains common property
    /-disabled-/,
    /-sentiment-/,
  ];
  
  let matchCount = 0;
  for (const pattern of patterns) {
    if (pattern.test(className)) matchCount++;
  }
  
  return matchCount >= 2;
}
```

**Why This Works**:
- Real utility classes are short (e.g., `bg-primary`, `p-4`, `flex`)
- Variant names are long and contain multiple property references
- Pattern-based detection is more reliable than length alone

#### 5. CVA Code Generation

**Input**: `CVAConfig` (base classes, variants, compound, defaults)  
**Output**: TypeScript code string

**Generation Process**:
```typescript
// 1. Variable name from component name
"Button Component" → "buttonComponentVariants"

// 2. Base classes (joined with spaces)
["flex", "items-center", "rounded-lg"]

// 3. Variants object
{
  sentiment: {
    brand: ["bg-fill-accent", "hover:bg-fill-accent-hover"],
    neutral: "bg-fill-neutral text-foreground-default"
  }
}

// 4. Compound variants (conditional classes)
[
  {
    sentiment: "brand",
    size: "lg",
    class: "shadow-lg"
  }
]

// 5. Default variants
{
  sentiment: "brand",
  size: "md"
}

// 6. VariantProps type export
export type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
```

**Formatting Rules**:
- 2-space indentation
- Multiline arrays for multiple prefix slots
- Single-line strings for single values
- Proper trailing commas
- Empty objects/arrays when sections unused

---

## Data Flow & Transformations

### Complete Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         Figma Selection                         │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   EXTRACTOR: Node Traversal │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │  EXTRACTOR: Style Extraction│
         │  + Variable Resolution       │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │  EXTRACTOR: Font Loading    │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │  EXTRACTOR: Code Generation │
         │  ├─ CSS Format               │
         │  ├─ Tailwind Format          │
         │  └─ Raw JSON                 │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │  MultiFormatExtractionResult│
         │  ├─ css.stylesheet           │
         │  ├─ tailwind.stylesheet      │
         │  ├─ raw.stylesheet           │
         │  └─ componentProperties      │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │    CVA: Class Extraction     │
         │    (parse Tailwind HTML)     │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   CVA: DOM Mapping           │
         │   (RAW + Tailwind)           │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   CVA: Property Detection    │
         │   (snippet + Figma API)      │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   CVA: Categorization        │
         │   (pattern matching)         │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   CVA: Variant Name Filter   │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   CVA: User Mapping (UI)     │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   CVA: Code Generation       │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   TypeScript CVA Code        │
         └─────────────────────────────┘
```

### Critical Data Structures

#### 1. ExtractedNode (Extractor output)
```typescript
{
  id: "1918:218",
  name: "sentiment=neutral, interaction=default",
  type: "COMPONENT",
  styles: {
    fills: [...],
    layout: {...},
    typography: {...}
  },
  children: [...]
}
```

#### 2. MultiFormatExtractionResult (Extractor → CVA)
```typescript
{
  css: {
    stylesheet: "<div style=\"...\">...",
    variableMap: {"--color-primary": "#0066ff"}
  },
  tailwind: {
    stylesheet: "<div className=\"flex p-4\">...",
    variableMap: {"fill-primary": "#0066ff"}
  },
  raw: {
    stylesheet: "[{id, name, type, styles, children}]",
    variableMap: {}
  },
  componentProperties: {
    variants: [{name, values}],
    properties: {...}
  }
}
```

#### 3. ExtractedClass (CVA internal)
```typescript
{
  id: "class-123",
  className: "bg-fill-primary",
  category: "fill",
  domElements: ["button-root"],
  isSelected: false,
  usedInVariants: false
}
```

#### 4. CVAConfig (CVA → Code generation)
```typescript
{
  componentName: "Button",
  baseClasses: ["flex", "items-center"],
  variants: [
    {
      id: "variant-1",
      name: "sentiment",
      properties: [
        {
          name: "sentiment",
          values: [
            {
              name: "brand",
              prefixedClasses: [
                {prefix: "", classes: ["bg-fill-accent"]},
                {prefix: "hover:", classes: ["bg-fill-accent-hover"]}
              ]
            }
          ]
        }
      ]
    }
  ],
  compoundVariants: [...],
  defaultVariants: {...}
}
```

---

## Key Architectural Decisions

### 1. Two-Pass DOM Extraction

**Decision**: Use RAW JSON for structure, Tailwind HTML for classes  
**Rationale**: 
- RAW provides reliable node hierarchy
- Tailwind provides actual CSS classes
- Prevents fragile HTML string parsing
- Maintains single source of truth for each aspect

### 2. Variable Resolution in Plugin Sandbox

**Decision**: Resolve all variables during extraction  
**Rationale**:
- Figma API only available in plugin sandbox
- UI sandbox cannot access variables
- Resolves once, uses many times
- Reduces complexity in UI code

### 3. Class Categorization

**Decision**: Pattern-based categorization  
**Rationale**:
- Tailwind classes follow predictable patterns
- Regex matching is fast and reliable
- Easy to extend with new categories
- Helps users organize and find classes

### 4. Variant Name Filtering

**Decision**: Multi-pattern heuristic approach  
**Rationale**:
- No single pattern identifies variant names
- Length + segment count + pattern matching is robust
- False positives are rare
- Better than blacklist approach

### 5. CVA Code Generation Format

**Decision**: Multiline arrays for multi-prefix values  
**Rationale**:
- Improves code readability
- Clearly shows interactive states
- Follows CVA documentation examples
- Easy to modify generated code

---

## Recent Improvements

### ClassSelectionModal Enhancements

#### Problem 1: Duplicate DOM Elements
**Issue**: Variant root element appeared twice in DOM list  
**Cause**: Calling `collectElementNames(variantNode)` included the node itself, then manually adding it as root  
**Solution**: Iterate over `variantNode.children` directly, skip the node itself  
**Impact**: Clean DOM hierarchy, no duplicates

#### Problem 2: Incorrect DOM Hierarchy
**Issue**: All elements showed at same depth level  
**Cause**: Depth calculation `depth > 0 ? depth - 1 : 0` was compensating incorrectly  
**Solution**: Use `depth` directly, add variant root explicitly at depth 0  
**Impact**: Proper visual nesting with indentation

#### Problem 3: Horizontal Scrollbar in Sidebar
**Issue**: Long element names caused horizontal scroll  
**Cause**: Indentation pushing content beyond container width  
**Solution**: Added `overflow-x: hidden` and `min-width: 0` for text truncation  
**Impact**: Clean UI, text properly truncates with ellipsis

#### Problem 4: Scrollbar Overlapping Counters
**Issue**: Scrollbar covered class count badges  
**Cause**: No padding between scrollbar and content  
**Solution**: Added `padding-right` to sidebar list, `margin-left` to counters  
**Impact**: Counters always visible, no overlap

#### Problem 5: Missing Fixed Height
**Issue**: Modal height changed based on content  
**Cause**: Changed from `height: 520px` to `max-height: 90vh` only  
**Solution**: Restored `height: 600px` with `max-height: 90vh` as safety  
**Impact**: Stable UI, no jumping between selections

### Architecture Impact

**Separation of Concerns**:
- RAW JSON → Structure only
- Tailwind HTML → Classes only
- Clear responsibility boundaries

**Data Integrity**:
- Single source of truth per data type
- No conflicting information between sources
- Predictable transformation pipeline

**User Experience**:
- Hierarchical DOM visualization
- Accurate class filtering
- Stable, non-jumping UI
- Smooth resizable sidebar

---

## Future Considerations

### Potential Enhancements

1. **Extractor Tool**:
   - Support for gradient variables
   - Image export as data URLs
   - Variable mode switching
   - Mixed text style handling

2. **CVA Tool**:
   - Responsive variant support (sm:, md:, lg:)
   - Dark mode variant generation
   - Custom prefix management
   - Import statement configuration

3. **Architecture**:
   - WebAssembly for faster parsing
   - Incremental extraction (delta updates)
   - Caching layer for repeated extractions
   - Plugin API for extensibility

### Known Limitations

1. **Extractor**:
   - First variable mode only
   - Gradient fills not converted to classes
   - Absolute positioning needs parent context
   - Font loading requires Figma access

2. **CVA Tool**:
   - Manual mapping required (no auto-inference)
   - Limited to Tailwind utility classes
   - Compound variants must be manually created
   - No validation of class combinations

---

## Conclusion

The plugin's architecture successfully separates concerns between:
- **Extraction** (Figma → Structured Data)
- **Transformation** (Data → Code Formats)
- **Configuration** (Visual Mapping → CVA)
- **Generation** (Configuration → TypeScript)

Each layer has clear inputs, outputs, and responsibilities, making the system maintainable and extensible while providing a solid foundation for future enhancements.

