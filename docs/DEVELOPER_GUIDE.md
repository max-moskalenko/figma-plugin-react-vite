# Developer Guide

A complete guide for developers extending and maintaining the Figma Design-to-Code Plugin.

---

## Table of Contents

1. [Onboarding](#onboarding)
2. [Architecture Overview](#architecture-overview)
3. [Code Organization](#code-organization)
4. [Plugin Side (Figma API)](#plugin-side-figma-api)
5. [Generators (Common Code)](#generators-common-code)
6. [UI Side (React)](#ui-side-react)
7. [Extending the Plugin](#extending-the-plugin)
8. [Common Tasks](#common-tasks)
9. [Reference](#reference)

---

## Onboarding

### Development Environment Setup

**Prerequisites:**
- Node.js 18+ 
- npm or pnpm
- Figma Desktop App

**Setup:**
```bash
# Clone and install
git clone <repository-url>
cd figma-api
npm install

# Development mode (watch for changes)
npm run dev

# Production build
npm run build

# Type checking
npm run types
```

### Project Structure Overview

```
figma-api/
├── src/
│   ├── common/           # Shared code (plugin + UI)
│   │   ├── constants/    # Type constants, prefixes, patterns
│   │   ├── utils/        # Shared utilities
│   │   ├── cssGenerator.ts
│   │   ├── tailwindGenerator.ts
│   │   ├── domGenerator.ts
│   │   ├── tailwindDomGenerator.ts
│   │   ├── cvaGenerator.ts
│   │   ├── rawJsonGenerator.ts
│   │   └── networkSides.ts
│   │
│   ├── plugin/           # Figma plugin code
│   │   ├── extractors/
│   │   │   ├── componentTraverser.ts
│   │   │   └── styleExtractor.ts
│   │   ├── plugin.network.ts
│   │   └── plugin.ts
│   │
│   └── ui/               # React UI
│       ├── components/
│       │   ├── cva/      # CVA Mapping Tool
│       │   ├── shared/   # Shared components
│       │   └── OutputDisplay.tsx
│       ├── constants/    # UI text constants
│       ├── styles/       # SCSS styles
│       ├── app.tsx
│       └── main.tsx
│
├── docs/                 # Documentation
│   ├── archive/          # Historical docs
│   ├── USER_GUIDE.md
│   ├── DEVELOPER_GUIDE.md
│   ├── ARCHITECTURE.md
│   └── API_REFERENCE.md
│
└── dist/                 # Build output
    ├── manifest.json
    ├── plugin.js
    └── index.html
```

### Build and Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode - rebuilds on file changes |
| `npm run build` | Production build |
| `npm run types` | TypeScript type checking |
| `npm run clean` | Remove build artifacts |

### Debugging Tips

**Figma Console:**
1. In Figma, open `Plugins > Development > Open Console`
2. `console.log` from plugin code appears here
3. Useful for debugging extraction issues

**UI Debugging:**
1. Right-click plugin UI → "Inspect Element"
2. Standard browser DevTools
3. React DevTools extension works here

**Common Issues:**
- **Plugin not loading**: Check `dist/manifest.json` exists
- **Type errors**: Run `npm run types` to see all errors
- **UI not updating**: Check for React key warnings

---

## Architecture Overview

### High-Level Design

The plugin uses a **two-process architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                       FIGMA SANDBOX                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Plugin Code                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ Traverser   │  │ Extractor   │  │ Generators   │  │  │
│  │  │             │→ │             │→ │ (CSS/TW)     │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │ postMessage                      │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │                     UI (iframe)                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ React App   │  │ CVA Tool    │  │ Output       │  │  │
│  │  │             │  │             │  │ Display      │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Communication Layer

Uses `monorepo-networker` for type-safe messaging:

```typescript
// Plugin side
PLUGIN_CHANNEL.registerMessageHandler("extractComponent", async (params) => {
  const result = await extractComponent(params);
  return result;
});

// UI side
const result = await UI_CHANNEL.sendMessage("extractComponent", params);
```

### Data Flow

```
User Selection → Traverser → Style Extractor → Generators → UI Display
                    │              │                │
                    ▼              ▼                ▼
              ExtractedNode   ExtractedStyles   HTML/CSS/JSON
```

**Key Interfaces:**
- `ExtractedNode`: Tree structure of Figma nodes
- `ExtractedStyles`: Style properties with variable bindings
- `MultiFormatExtractionResult`: All output formats

---

## Code Organization

### Module Responsibilities

**`src/common/` - Shared Code**
- Constants and utilities used by both sides
- All generators (CSS, Tailwind, DOM, CVA, RAW)
- Network interface definitions

**`src/plugin/` - Figma API Code**
- Runs in Figma's sandbox
- Has access to `figma` global API
- Cannot use browser APIs

**`src/ui/` - React Application**
- Runs in iframe (browser environment)
- Standard React/SCSS application
- Cannot access Figma API directly

### Import Aliases

Configured in `tsconfig.json`:
```json
{
  "paths": {
    "@common/*": ["./src/common/*"],
    "@ui/*": ["./src/ui/*"],
    "@plugin/*": ["./src/plugin/*"]
  }
}
```

Usage:
```typescript
import { ExtractedNode } from "@plugin/extractors/componentTraverser";
import { generateTailwindDOM } from "@common/tailwindDomGenerator";
import { useCVAState } from "@ui/components/cva/hooks/useCVAState";
```

---

## Plugin Side (Figma API)

### Component Traversal

`src/plugin/extractors/componentTraverser.ts`

Recursively builds a tree structure from Figma nodes:

```typescript
interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  componentSetName?: string;  // For variants
  annotations: string[];
  icon?: IconMetadata;
  children?: ExtractedNode[];
  styles?: ExtractedStyles;
  characters?: string;        // For TEXT nodes
}
```

**Key Function:**
```typescript
async function traverseComponent(node: SceneNode): Promise<ExtractedNode>
```

### Style Extraction

`src/plugin/extractors/styleExtractor.ts`

Extracts all visual properties with variable resolution:

```typescript
interface ExtractedStyles {
  fills: ExtractedFill[];
  strokes: ExtractedStrokes;
  effects: ExtractedEffect[];
  typography: ExtractedTypography;
  layout: ExtractedLayout;
  positioning: ExtractedPositioning;
  opacity: number;
  visible: boolean;
}
```

**Key Functions:**
- `extractStyles(node, variables)` - Main extraction
- `extractFills(node, variables)` - Fill/background colors
- `extractStrokes(node, variables)` - Borders
- `extractTypography(node, variables)` - Font properties
- `extractLayout(node, variables)` - Size, padding, flex
- `extractEffects(node, variables)` - Shadows, blur

### Variable Resolution

Variables are resolved using Figma's `boundVariables` API:

```typescript
// Check for variable binding
const binding = node.boundVariables?.['paddingLeft'];
if (binding) {
  const variable = await figma.variables.getVariableByIdAsync(binding.id);
  return variable.name; // e.g., "spacing/4"
}
```

---

## Generators (Common Code)

### CSS Generator

`src/common/cssGenerator.ts`

Converts extracted styles to CSS properties:

```typescript
// Input: ExtractedStyles
// Output: CSS property strings

fillsToCSS(fills, variableMap)
// → ["background-color: var(--fill-primary)"]

layoutToCSS(layout, variableMap)
// → ["display: flex", "width: 100px", "padding: 16px"]

typographyToCSS(typography, variableMap)
// → ["font-size: 14px", "font-weight: 700"]
```

### Tailwind Generator

`src/common/tailwindGenerator.ts`

Converts extracted styles to Tailwind classes:

```typescript
// Input: ExtractedStyles
// Output: Tailwind class strings

fillsToTailwind(fills, variableMap)
// → ["bg-fill-primary"]

layoutToTailwind(layout, variableMap)
// → ["flex", "flex-row", "w-full", "p-4"]

typographyToTailwind(typography, variableMap)
// → ["text-sm", "font-bold", "leading-5"]
```

**Variable Remapping:**
```typescript
// Figma variable → Tailwind class
"spacing/4" → "p-4", "gap-4"
"font/size/sm" → "text-sm"
"fill/primary" → "bg-fill-primary"
```

### DOM Generators

**`domGenerator.ts`** - HTML with inline CSS:
```html
<Button style="display: flex; padding: 16px;">
  <Label style="font-size: 14px;">Click</Label>
</Button>
```

**`tailwindDomGenerator.ts`** - JSX with Tailwind:
```jsx
<Button className="flex p-4">
  <Label className="text-sm">Click</Label>
</Button>
```

### CVA Generator

`src/common/cvaGenerator.ts`

Generates Class Variance Authority code:

```typescript
generateCVACode(config: CVAConfig): string
```

Input:
```typescript
{
  base: ["flex", "rounded-lg"],
  variants: {
    variant: {
      primary: ["bg-blue-500", "text-white"],
      secondary: ["bg-gray-200"]
    }
  },
  defaultVariants: { variant: "primary" }
}
```

Output:
```typescript
export const componentVariants = cva("flex rounded-lg", {
  variants: {
    variant: {
      primary: "bg-blue-500 text-white",
      secondary: "bg-gray-200",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});
```

---

## UI Side (React)

### Main Application

`src/ui/app.tsx`

- Tool switching (DOM Extractor / CVA Mapping)
- Global state management
- Settings panel
- Output tabs (Tailwind, CSS, RAW)

### CVA Tool Structure

```
src/ui/components/cva/
├── CVATool.tsx           # Main container
├── CVAContext.tsx        # React Context
├── types.ts              # Type definitions
├── hooks/
│   └── useCVAState.ts    # State management
├── utils/
│   └── classManager.ts   # Class categorization
└── components/
    ├── BaseClassesConfig.tsx
    ├── ClassSelectionModal.tsx
    ├── VariantCard.tsx
    ├── CompoundVariantsConfig.tsx
    └── DefaultVariantsConfig.tsx
```

### State Management

`useCVAState.ts` is the core state hook:

```typescript
const {
  // State
  extractedClasses,    // All extracted classes
  config,              // CVA configuration
  componentProperties, // Figma variant properties
  
  // Actions
  setExtractorResult,  // Set extraction data
  toggleBaseClass,     // Toggle base class selection
  addClassesToSlot,    // Add classes to variant slot
  // ... more actions
} = useCVAState();
```

### Class Categorization

`classManager.ts` categorizes Tailwind classes:

```typescript
const CLASS_CATEGORIES = {
  fill: { label: "Fill / Background", patterns: [/^bg-/, /^fill-/] },
  typography: { label: "Typography", patterns: [/^text-/, /^font-/] },
  spacing: { label: "Spacing", patterns: [/^p-/, /^m-/, /^gap-/] },
  // ...
};

getClassCategory("bg-blue-500") // → "fill"
getClassCategory("text-lg")     // → "typography"
getClassCategory("p-4")         // → "spacing"
```

---

## Extending the Plugin

### Adding New Style Properties

1. **Extract in `styleExtractor.ts`:**
```typescript
// In extractStyles function
const newProperty = extractNewProperty(node, variables);
return {
  ...styles,
  newProperty,
};
```

2. **Generate CSS in `cssGenerator.ts`:**
```typescript
export function newPropertyToCSS(prop: NewProp, variableMap: VariableMap): string[] {
  if (!prop) return [];
  // Generate CSS properties
  return [`new-prop: ${prop.value}`];
}
```

3. **Generate Tailwind in `tailwindGenerator.ts`:**
```typescript
export function newPropertyToTailwind(prop: NewProp, variableMap: VariableMap): string[] {
  if (!prop) return [];
  // Generate Tailwind classes
  return [`new-${prop.value}`];
}
```

4. **Use in DOM generators:**
```typescript
// In generateAttributes()
const newPropClasses = newPropertyToTailwind(styles.newProperty, variableMap);
classes.push(...newPropClasses);
```

### Adding New Tailwind Remapping Rules

In `tailwindGenerator.ts`, modify the relevant function:

```typescript
// Example: Add new spacing variable pattern
function extractSpacingValue(variableName: string): string | null {
  // Existing patterns...
  
  // Add new pattern
  const newMatch = normalized.match(/^my-custom-spacing-(.+)$/);
  if (newMatch) return newMatch[1];
  
  return null;
}
```

### Adding New CVA Class Categories

1. **Update types in `types.ts`:**
```typescript
export type ClassCategory = 
  | "fill" 
  | "typography" 
  // Add new category
  | "newCategory"
  | "other";
```

2. **Add patterns in `classManager.ts`:**
```typescript
export const CLASS_CATEGORIES = {
  // ...existing categories
  newCategory: {
    label: "New Category",
    patterns: [/^new-/, /^custom-/],
  },
};
```

### Adding New Output Formats

1. **Create generator in `src/common/`:**
```typescript
// newFormatGenerator.ts
export function generateNewFormat(nodes: ExtractedNode[]): string {
  // Generate output
}
```

2. **Add to extraction result in `networkSides.ts`:**
```typescript
interface MultiFormatExtractionResult {
  // ...existing
  newFormat: string;
}
```

3. **Generate in `plugin.network.ts`:**
```typescript
const newFormat = generateNewFormat(nodes);
return { ...result, newFormat };
```

4. **Display in UI:**
```typescript
// Add tab in app.tsx
<Tab label="New Format">{extractorResult?.newFormat}</Tab>
```

---

## Common Tasks

### How to Add a New Figma Property Extraction

1. Check Figma Plugin API for property access
2. Add extraction in `styleExtractor.ts`
3. Add type to `ExtractedStyles` interface
4. Add CSS generation
5. Add Tailwind generation
6. Test with various components

### How to Add a New UI Setting

1. Add state in `app.tsx`:
```typescript
const [newSetting, setNewSetting] = useState(false);
```

2. Add UI control:
```typescript
<label>
  <input 
    type="checkbox" 
    checked={newSetting} 
    onChange={(e) => setNewSetting(e.target.checked)} 
  />
  New Setting
</label>
```

3. Pass to extraction:
```typescript
UI_CHANNEL.sendMessage("extractComponent", { ...params, newSetting });
```

4. Use in plugin:
```typescript
PLUGIN_CHANNEL.registerMessageHandler("extractComponent", async ({ newSetting }) => {
  // Use newSetting
});
```

### How to Debug Extraction Issues

1. **Check RAW output** - Shows exactly what's extracted
2. **Add console.log** in plugin code:
```typescript
console.log("Extracted node:", node.name, styles);
```
3. **View in Figma console** - `Plugins > Development > Open Console`
4. **Compare with Figma API** - Check `node.boundVariables` directly

---

## Reference

### Key Interfaces

```typescript
// Node structure
interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  componentSetName?: string;
  children?: ExtractedNode[];
  styles?: ExtractedStyles;
}

// Style structure
interface ExtractedStyles {
  fills: ExtractedFill[];
  strokes: ExtractedStrokes;
  effects: ExtractedEffect[];
  typography: ExtractedTypography;
  layout: ExtractedLayout;
}

// CVA configuration
interface CVAConfig {
  base: string[];
  variants: Record<string, Record<string, CVAPrefixedClasses>>;
  compoundVariants: CompoundVariantRule[];
  defaultVariants: Record<string, string>;
}
```

### Important Utility Functions

```typescript
// Element naming
sanitizeForReact(name, componentSetName?)  // Preserves dots
sanitizeForHTML(name, componentSetName?)   // Removes dots
normalizeForMatching(name)                 // Lowercase, for comparison

// Property filtering
isZeroValueClass(className)                // Check if class is zero-value
filterZeroValueClasses(classes)            // Filter array of classes

// Variable conversion
toCSSVariable(figmaName)                   // "spacing/4" → "--spacing-4"
toTailwindClass(figmaName)                 // "fill/primary" → "fill-primary"
```

### Constants

```typescript
// Figma types
import { LayoutSizing, LayoutMode, FillType } from "@common/constants";

// Tailwind prefixes
import { ColorPrefix, SpacingPrefix, BorderPrefix } from "@common/constants";

// Variable patterns
import { VariablePattern, normalizeVariableName } from "@common/constants";
```

---

## Getting Help

- See [ARCHITECTURE.md](./ARCHITECTURE.md) for system diagrams
- See [API_REFERENCE.md](./API_REFERENCE.md) for function documentation
- Check `docs/archive/` for historical documentation
- Review inline code comments for implementation details

