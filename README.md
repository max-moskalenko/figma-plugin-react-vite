# Figma Design-to-Code Plugin

A comprehensive Figma plugin for extracting component styles and generating production-ready code. The plugin includes two powerful tools:

1. **DOM Extractor** - Extracts complete DOM structure with styles in CSS or Tailwind format
2. **CVA Mapping Tool** - Generates type-safe [Class Variance Authority](https://cva.style/) configurations from component variants

## Features

### DOM Extractor
- **Complete Component Extraction**: Extracts full DOM structure with hierarchical node relationships
- **Variable Detection**: Automatically detects and uses Figma variables for colors, spacing, typography, borders, and more
- **Component Set Support**: Extracts all variants when a COMPONENT_SET is selected
- **Dual Output Formats**: 
  - **CSS Format**: Generates clean HTML with inline styles and CSS custom properties
  - **Tailwind Format**: Generates HTML with Tailwind utility classes (see [CSS to Tailwind Remapping](#css-to-tailwind-remapping))
- **Zero-Value Filtering**: Automatically filters out useless properties (e.g., `border-radius: 0px`, `padding: 0px`)
- **Text Content Extraction**: Preserves text content from TEXT nodes with proper font loading
- **Intelligent Class Mapping**: Converts Figma design tokens to semantic Tailwind classes (e.g., `spacing-7` → `p-7`, `gap-7`)

### CVA Mapping Tool
- **Visual Variant Mapping**: Map CSS classes to component variant properties visually
- **Automatic Property Detection**: Extracts variant properties from Figma component definitions
- **Class Categorization**: Organizes classes by purpose (fill, typography, spacing, etc.)
- **Pseudo-class Support**: Configure hover, active, focus, and disabled states per variant value
- **Compound Variants**: Create conditional class combinations based on multiple properties
- **Type-safe Output**: Generates TypeScript code with proper VariantProps types
- **See [CVA Mapping Documentation](./CVA_MAPPING.md)** for detailed technical documentation

## How It Works

### Quick Overview

The plugin uses a two-side architecture (plugin code and UI) that communicate via `monorepo-networker`:

```
┌─────────────┐         ┌──────────────┐
│  UI (React) │◄───────►│ Plugin Code  │
│   (iframe)  │         │  (main.js)   │
└─────────────┘         └──────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Figma API      │
                    │  - Nodes        │
                    │  - Variables    │
                    │  - Styles       │
                    └─────────────────┘
```

The extraction process extracts node hierarchies, resolves Figma variables, loads fonts, and generates output in CSS or Tailwind format.

**For comprehensive documentation, see:**
- **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** - Complete system architecture, data transformations, and design decisions
- **[EXTRACTOR_DOCUMENTATION.md](./EXTRACTOR_DOCUMENTATION.md)** - DOM Extractor technical documentation
- **[CVA_MAPPING.md](./CVA_MAPPING.md)** - CVA Mapping Tool technical documentation

## What It Extracts

### Visual Properties

- **Fills**: Background colors (with opacity), gradients, images
- **Strokes**: Border colors, widths, alignment
- **Effects**: Drop shadows, inner shadows, blur effects
- **Typography**: Font family, size, weight, line height, letter spacing, text decoration, text case
- **Layout**: Width, height, padding, gap (itemSpacing), border radius, opacity
- **Positioning**: X, Y coordinates, rotation, constraints

### Structural Information

- **Node Hierarchy**: Complete parent-child relationships
- **Node Types**: FRAME, COMPONENT, INSTANCE, TEXT, RECTANGLE, etc.
- **Text Content**: Actual text from TEXT nodes
- **Data Attributes**: `data-name` and `data-type` for each element

### Variable Bindings

The plugin detects variables for:
- Colors (fills, strokes)
- Spacing (padding, gap)
- Typography (font size, weight, family, line height, letter spacing)
- Borders (width, radius)
- Layout (width, height)
- Opacity

## Variable Detection and Resolution

### How Variables Are Detected

Figma stores variable bindings in the `boundVariables` property of nodes. The plugin:

1. Checks `node.boundVariables[propertyName]` for each property
2. Handles array-based bindings (common for typography properties)
3. Resolves variable values from variable collections
4. Falls back to raw values when no variable is bound

### Property Name Mapping

Figma uses different property names in `boundVariables` than the node properties:

| Node Property | boundVariables Property |
|--------------|------------------------|
| `cornerRadius` | `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` |
| `strokeWeight` | `strokeTopWeight`, `strokeBottomWeight`, `strokeLeftWeight`, `strokeRightWeight` |
| `fontSize` | `fontSize` (may be array) |
| `fills[0]` | `boundVariables.fills[0]` |
| `strokes[0]` | `boundVariables.strokes[0]` |

The plugin automatically checks these alternative property names.

### Array-Based Bindings

Typography properties are often stored as arrays in `boundVariables`:

```javascript
boundVariables.fontSize = [{ id: "VariableID:...", type: "VariableAlias" }]
```

The plugin extracts the first element from these arrays.

### CSS Custom Property Generation

Figma variable names are converted to CSS custom properties:

- `"spacing/7"` → `"--spacing-7"`
- `"color/primary"` → `"--color-primary"`

The plugin generates a `:root` block with all CSS variables:

```css
<style>
  :root {
    --spacing-7: 28px;
    --color-primary: #0066ff;
  }
</style>
```

## Output Format

The plugin supports two output formats:

### CSS Format (Default)

Generates HTML with inline styles and CSS custom properties:

```html
<div
  data-name="Button"
  data-type="component"
  style="padding: var(--spacing-4); background-color: var(--color-primary);"
>
  <p
    data-name="Label"
    data-type="text"
    style="font-size: 16px; color: #ffffff;"
  >
    Click me
  </p>
</div>
```

**Features**:
- Inline styles with CSS custom property references
- CSS variables defined in `:root` block (when using variables)
- Zero-value properties automatically filtered out

### Tailwind Format

Generates HTML with Tailwind utility classes:

```html
<div className="button-root flex flex-row p-4 bg-fill-primary">
  <p className="label-root text-base text-white">
    Click me
  </p>
</div>
```

**Features**:
- Tailwind utility classes (e.g., `p-4`, `bg-fill-primary`, `text-base`)
- Semantic class mapping from Figma variables (e.g., `spacing-7` → `p-7`)
- CSS variable definitions for Tailwind config integration
- See [CSS to Tailwind Remapping](#css-to-tailwind-remapping) for detailed conversion rules

### Filtered Properties

The plugin automatically filters out useless properties:
- `border-radius: 0px` or `border-radius: 0`
- `padding: 0px 0px 0px 0px` or `padding: 0`
- `gap: 0px` or `gap: 0`
- Individual padding properties with zero values

## Usage Instructions

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. In Figma:
   - Right-click in a design file
   - Go to `Plugins > Development > Import plugin from manifest...`
   - Select `dist/manifest.json`

### Using the Plugin

1. **Select a component** (or multiple components) in Figma
2. **Open the plugin** from the plugins menu
3. **Click "Get code"** to extract the DOM structure
4. **Review the output** in the code snippet area
5. **Click "Copy"** to copy the generated HTML/CSS to your clipboard

### Component Set Handling

When you select a **COMPONENT_SET**, the plugin automatically extracts **all component variants** from the set. Each variant is generated as a separate HTML structure in the output.

### Copy Functionality

The copy button:
- Uses the modern Clipboard API when available
- Falls back to `document.execCommand('copy')` for compatibility
- Shows "Copied" feedback for 2 seconds after successful copy

## CSS to Tailwind Remapping

The plugin intelligently converts CSS properties and Figma variables to Tailwind utility classes. This conversion process involves:

1. **Variable Name Parsing**: Extracts semantic values from Figma variable names
2. **Scale Value Extraction**: Maps spacing/typography variables to Tailwind scale values
3. **Class Generation**: Converts values to appropriate Tailwind utility classes
4. **Fallback Handling**: Uses arbitrary values when no direct Tailwind class exists

### Key Remapping Examples

#### Spacing Properties
- `spacing-7` variable → `p-7`, `gap-7`, `w-7`, `h-7`
- `spacing-0-5` variable → `p-0.5`, `gap-0.5`
- `spacing-px` variable → `p-px`, `gap-px`

#### Typography
- `font-size-lg` variable → `text-lg`
- `font-weight-bold` variable → `font-bold`
- `font-leading-4` variable → `leading-4`
- `font-sans` variable → `font-sans`

#### Colors
- `fill/neutral/default` variable → `bg-fill-neutral-default` (or `text-fill-neutral-default` for text nodes)
- `border-width-2` variable → `border-2`
- `radius-lg` variable → `rounded-lg`

#### Layout
- `layoutGrow === 1` → `flex-1`
- `layoutSizingHorizontal === "FILL"` → `w-full`
- `layoutMode === "HORIZONTAL"` → `flex flex-row`

### Complete Remapping Documentation

For a comprehensive guide to all CSS-to-Tailwind remapping rules, see **[CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md)**. This document covers:

- All property-specific remapping logic
- Variable extraction patterns
- Fallback strategies
- Special cases and edge cases
- Implementation details

### Variable Map for Tailwind Config

When using Tailwind format, the plugin generates CSS variable definitions that can be added to your Tailwind configuration:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'fill-neutral-default': 'var(--fill-neutral-default)',
        'fill-primary': 'var(--fill-primary)',
      }
    }
  }
}
```

```css
/* global.css */
:root {
  --fill-neutral-default: #0066ff;
  --fill-primary: #ff0000;
}
```

## Technical Details

### Supported Node Types

- `FRAME` → `<div>`
- `COMPONENT` → `<div>`
- `INSTANCE` → `<div>`
- `GROUP` → `<div>`
- `TEXT` → `<p>`
- `RECTANGLE` → `<div>`
- `ELLIPSE` → `<div>`
- `POLYGON` → `<div>`
- `STAR` → `<div>`
- `VECTOR` → `<svg>`

### Variable Property Mappings

The plugin checks these property names when resolving variables:

**Layout:**
- `width`, `height`
- `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`
- `itemSpacing`
- `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius`
- `opacity`

**Typography:**
- `fontSize`, `font-size`, `size`
- `lineHeight`, `line-height`, `lineHeightUnit`
- `letterSpacing`, `letter-spacing`, `letterSpacingUnit`
- `fontFamily`, `font-family`, `family`
- `fontWeight`, `font-weight`, `weight`

**Strokes:**
- `strokeTopWeight`, `strokeBottomWeight`, `strokeLeftWeight`, `strokeRightWeight`
- `strokes[0]`, `strokes[1]`, etc. (for stroke colors)

**Fills:**
- `fills[0]`, `fills[1]`, etc. (for fill colors)

### Limitations

- **Gradients**: Gradient fills are extracted but not converted to CSS variables
- **Images**: Image fills are detected but not exported (imageHash is included)
- **Complex Effects**: Some advanced effects may not be fully supported
- **Font Loading**: Requires fonts to be available in Figma for text extraction
- **Variable Modes**: Currently uses the first mode from variable collections

## Documentation

**📚 Not sure where to start? See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a complete guide to navigating all documentation.**

This project includes comprehensive documentation organized by topic:

### Overview & Architecture
- **[README.md](./README.md)** (this file) - Plugin overview, features, and usage instructions
- **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** - Complete system architecture, data flow, and transformation pipelines

### Tool-Specific Documentation
- **[EXTRACTOR_DOCUMENTATION.md](./EXTRACTOR_DOCUMENTATION.md)** - Complete technical documentation for the DOM Extractor Tool
- **[CVA_MAPPING.md](./CVA_MAPPING.md)** - Complete technical documentation for the CVA Mapping Tool

### Mapping & Transformation Documentation
- **[CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md)** - Detailed Tailwind remapping rules and patterns
- **[DOM_TO_CLASSES_MAPPING.md](./DOM_TO_CLASSES_MAPPING.md)** - DOM-to-Classes association system and filtering

### Development History
- **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** - Development milestones and project history

## Development

### Project Structure

```
src/
├── common/                         # Shared code between plugin and UI
│   ├── cssGenerator.ts             # CSS generation with variable support
│   ├── cvaGenerator.ts             # CVA code generation
│   ├── tailwindGenerator.ts        # Tailwind class generation with remapping logic
│   ├── domGenerator.ts             # HTML generation with inline styles (CSS format)
│   ├── tailwindDomGenerator.ts     # HTML generation with Tailwind classes
│   ├── rawJsonGenerator.ts         # Raw JSON output generation
│   └── networkSides.ts             # Communication channel definitions
├── plugin/                         # Plugin-side code (runs in Figma)
│   ├── extractors/
│   │   ├── componentTraverser.ts   # Node tree traversal
│   │   └── styleExtractor.ts       # Style extraction with variable resolution
│   ├── plugin.network.ts           # Message handlers and extraction orchestration
│   └── plugin.ts                   # Plugin entry point
└── ui/                             # UI-side code (React app)
    ├── app.tsx                     # Main UI component with tool switching
    ├── app.network.tsx             # UI communication setup
    └── components/
        ├── cva/                    # CVA Mapping Tool
        │   ├── CVATool.tsx         # Main CVA tool container
        │   ├── CVAContext.tsx      # React Context for CVA state
        │   ├── types.ts            # TypeScript type definitions
        │   ├── hooks/
        │   │   └── useCVAState.ts  # State management and extraction logic
        │   ├── utils/
        │   │   └── classManager.ts # Class categorization utilities
        │   └── components/         # UI components (VariantCard, BaseClasses, etc.)
        ├── shared/
        │   └── LeftNavigation.tsx  # Tool navigation sidebar
        └── OutputDisplay.tsx       # Code output display component
```

### Key Files

#### DOM Extractor

- **`src/common/tailwindGenerator.ts`**: Core CSS-to-Tailwind remapping logic
  - Property-specific conversion functions (spacing, typography, colors, layout, etc.)
  - Variable name parsing and value extraction
  - Tailwind class generation with fallback handling

- **`src/common/cssGenerator.ts`**: CSS property generation
  - Converts extracted styles to CSS properties
  - Generates CSS custom property references
  - Used for CSS format output

- **`src/plugin/extractors/styleExtractor.ts`**: Style extraction with variable resolution
  - Extracts all style properties from Figma nodes
  - Resolves Figma variable bindings
  - Handles special cases (array bindings, per-corner properties, etc.)

- **`src/plugin/plugin.network.ts`**: Main extraction handler
  - Orchestrates the extraction pipeline
  - Handles COMPONENT_SET nodes
  - Coordinates style extraction and DOM generation

#### CVA Mapping Tool

- **`src/common/cvaGenerator.ts`**: CVA code generation
  - Generates properly formatted CVA TypeScript code
  - Handles variants, compound variants, and default variants
  - Exports VariantProps types

- **`src/ui/components/cva/hooks/useCVAState.ts`**: CVA state management
  - Class extraction from Tailwind output
  - Property detection from code snippets and Figma API
  - Variant name filtering logic
  - DOM element mapping

- **`src/ui/components/cva/utils/classManager.ts`**: Class categorization
  - Pattern-based class categorization
  - Category grouping utilities
  - Search and filter functions

- **`src/ui/components/cva/types.ts`**: Type definitions
  - CVA configuration interfaces
  - Pseudo-class prefix definitions
  - State and action types

### Build Commands

- `npm run build` - Build for production
- `npm run dev` - Watch mode for development
- `npm run types` - Type check TypeScript

## License

This project is based on the [figma-plugin-react-vite](https://github.com/iGoodie/figma-plugin-react-vite) boilerplate.

© 2024 - Licensed under [Attribution-ShareAlike 4.0 International](http://creativecommons.org/licenses/by-sa/4.0/)
