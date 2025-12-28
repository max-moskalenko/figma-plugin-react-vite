# CVA Mapping Tool Documentation

This document provides comprehensive documentation for the CVA (Class Variance Authority) Mapping Tool, which extends the Figma Plugin to generate type-safe variant configurations from Figma components.

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Class Categorization Rules](#class-categorization-rules)
4. [Property Extraction](#property-extraction)
5. [Variant Name Filtering](#variant-name-filtering)
6. [DOM Element Extraction](#dom-element-extraction)
7. [Prefix/Pseudo-class Handling](#prefixpseudo-class-handling)
8. [CVA Code Generation](#cva-code-generation)
9. [Configuration Types](#configuration-types)
10. [Extending the Tool](#extending-the-tool)

---

## Overview

The CVA Mapping Tool solves a fundamental problem: **Figma components have properties (variants, booleans, text) but no connection between those properties and the CSS classes they affect**. This tool provides a visual interface to:

1. Extract all CSS/Tailwind classes from a Figma component
2. Categorize them by purpose (fill, typography, spacing, etc.)
3. Map classes to variant property values
4. Configure pseudo-class prefixes for interactive states
5. Generate production-ready CVA code

### What is CVA?

[Class Variance Authority (CVA)](https://cva.style/) is a library for creating type-safe component variants with Tailwind CSS. Instead of manually concatenating class strings, CVA provides:

- Type-safe variant props
- Compound variant support
- Default variant values
- Clean, maintainable code

### Example Output

```typescript
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "flex items-center justify-center rounded-lg font-medium",
  {
    variants: {
      sentiment: {
        brand: [
          "bg-fill-accent-default text-foreground-on-accent",
          "hover:bg-fill-accent-hover",
          "active:bg-fill-accent-pressed",
          "disabled:bg-fill-accent-disabled",
        ],
        neutral: [
          "bg-fill-neutral-default text-foreground-default",
          "hover:bg-fill-neutral-hover",
        ],
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      sentiment: "brand",
      size: "md",
    },
  }
);

export type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
```

---

## How It Works

### Architecture Flow

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Extractor Tool     │────►│  CVA Mapping     │────►│  Generated CVA  │
│  (HTML + Classes)   │     │  (Configuration) │     │  (TypeScript)   │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌──────────────────┐
│  - CSS classes      │     │  - Base classes  │
│  - DOM structure    │     │  - Variants      │
│  - Properties       │     │  - Compound      │
│  - Component name   │     │  - Defaults      │
└─────────────────────┘     └──────────────────┘
```

### Data Flow

1. **Extraction**: The Extractor tool generates HTML with Tailwind classes from the selected Figma component
2. **Parsing**: Classes are extracted and categorized from the generated stylesheet
3. **Property Detection**: Component properties and values are extracted from raw output and Figma API
4. **Mapping**: User maps classes to variant property values via the visual interface
5. **Generation**: CVA code is generated from the mapping configuration

---

## Class Categorization Rules

Classes are automatically categorized by their Tailwind prefix patterns. This categorization helps organize the class selection UI.

### Category Definitions

| Category | Label | Patterns |
|----------|-------|----------|
| `fill` | Fill / Background | `^bg-`, `^fill-`, `^background` |
| `stroke` | Stroke / Border | `^border-` (excluding radius), `^stroke-`, `^outline-`, `^ring-` |
| `border-radius` | Border Radius | `^rounded`, `^border-radius` |
| `typography` | Typography | `^text-`, `^font-`, `^leading-`, `^tracking-`, text transforms, decorations |
| `spacing` | Spacing | `^p-`, `^px-`, `^py-`, `^pt-`, `^pr-`, `^pb-`, `^pl-`, `^m-`, margin variants, `^gap-`, `^space-` |
| `layout` | Layout | `^flex`, `^grid`, `^block`, `^inline`, `^hidden`, dimensions, positioning, alignment |
| `effects` | Effects | `^shadow`, `^opacity-`, `^blur`, transitions, transforms, cursor |
| `other` | Other | Everything else |

### Implementation

The categorization is implemented in `src/ui/components/cva/utils/classManager.ts`:

```typescript
export const CLASS_CATEGORIES: Record<ClassCategory, { label: string; patterns: RegExp[] }> = {
  fill: {
    label: "Fill / Background",
    patterns: [/^bg-/, /^fill-/, /^background/],
  },
  stroke: {
    label: "Stroke / Border",
    patterns: [/^border-(?!radius)/, /^stroke-/, /^outline-/, /^ring-/],
  },
  // ... other categories
};
```

### Extending Categories

To add a new category:

1. Add the category type to `ClassCategory` in `src/ui/components/cva/types.ts`
2. Add the category configuration to `CLASS_CATEGORIES` in `classManager.ts`
3. Update the `categorizeClass()` function in `useCVAState.ts` if needed

---

## Property Extraction

Properties and their values are automatically extracted from two sources:

### 1. Raw Code Snippet Parsing

The tool parses the raw JSON/HTML output for `property=value` patterns:

```
vis-height=h-28, vis-iconbutton=False, interaction=Default, vis-sentiment=Brand
```

**Extraction Pattern:**
```typescript
const propValueRegex = /([a-zA-Z][\w-]*)=([^,\s"<>]+)/g;
```

**Rules:**
- Property names must start with a letter
- Values continue until comma, space, or special characters
- Boolean values (`True`/`False`, `true`/`false`) are normalized to lowercase
- Properties starting with `data-`, `class`, or `className` are skipped

### 2. Figma Component Properties API

For instances and component sets, the tool also uses Figma's `componentProperties`:

```typescript
interface ComponentPropertyDefinition {
  name: string;
  type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP';
  defaultValue: any;
  variantOptions?: string[]; // For VARIANT type
}
```

**Merging Logic:**
- Properties from both sources are merged
- Figma's `variantOptions` provide complete value lists for VARIANT types
- BOOLEAN types automatically get `true` and `false` values
- Duplicate values are removed after normalization

### Implementation

See `extractPropertiesFromSnippet()` in `src/ui/components/cva/hooks/useCVAState.ts`

---

## Variant Name Filtering

Figma generates variant names by concatenating all property-value pairs:

```
vis-height-h-28-vis-iconbutton-false-interaction-hover-vis-sentiment-brand
```

These are **NOT** CSS classes and must be filtered out from the selectable class list.

### Detection Algorithm

A class is identified as a Figma variant name if:

1. **Length check**: Must be at least 20 characters
2. **Segment check**: Must have at least 5 hyphen-separated segments
3. **Pattern matching**: Must match 2+ of these patterns:
   - Starts with `vis-`
   - Contains `-vis-`
   - Contains `-(true|false)-` or ends with `-(true|false)`
   - Contains `-interaction-`
   - Contains `-disabled-`
   - Contains `-sentiment-`

### Implementation

```typescript
function isFigmaVariantName(className: string): boolean {
  if (className.length < 20) return false;
  
  const segments = className.split('-');
  if (segments.length < 5) return false;
  
  const variantPatterns = [
    /^vis-/,
    /-vis-/,
    /-(true|false)(-|$)/,
    /-interaction-/,
    /-disabled-/,
    /-sentiment-/,
  ];
  
  let matchCount = 0;
  for (const pattern of variantPatterns) {
    if (pattern.test(className)) matchCount++;
  }
  
  return matchCount >= 2;
}
```

### Extending the Filter

To add new variant name patterns, update the `variantPatterns` array in `useCVAState.ts`.

---

## DOM Element Extraction

Classes are mapped to their DOM elements to enable filtering in the class selection modal.

### Extraction Logic

1. **Parse className attributes**: Extract all `className="..."` or `class="..."` from the stylesheet
2. **Identify element names**: The first class in a className attribute is often the element name
3. **Element name detection**: Check if a class looks like an element name vs utility class

### Element Name Detection

```typescript
function isElementName(className: string): boolean {
  const looksLikeElement = /^[a-zA-Z][\w.-]*$/.test(className) && 
    (className.includes('.') ||        // Label.Root
     /^[A-Z]/.test(className) ||       // Component names
     ['div', 'span', 'p', 'button'].includes(className.toLowerCase()) ||
     /^[a-z]+-[a-z]+$/.test(className)); // slider-root
  
  const isUtilityClass = /^(flex|grid|w-|h-|p-|m-|bg-|text-)/.test(className);
  
  return looksLikeElement && !isUtilityClass;
}
```

### Modal Filtering Structure

For component sets, the Class Selection Modal provides hierarchical filtering:

1. **Variant Selector**: Choose a specific variant (e.g., `vis-height-h-28-...`) or "All Variants"
2. **DOM Element List**: Shows child elements within the selected variant
3. **Class Filtering**: Classes are filtered based on both selections

---

## Prefix/Pseudo-class Handling

The tool supports Tailwind pseudo-class prefixes for interactive states.

### Supported Prefixes

| Prefix | Use Case |
|--------|----------|
| (none) | Default/base state |
| `hover:` | Mouse hover state |
| `active:` | Active/pressed state |
| `focus:` | Focus state |
| `focus-visible:` | Keyboard focus |
| `focus-within:` | Child has focus |
| `disabled:` | Disabled state |
| `aria-disabled:` | ARIA disabled |
| `group-hover:` | Parent group hover |
| `peer-focus:` | Sibling peer focus |

### Multiple Prefix Slots

Each variant value can have multiple prefix slots, allowing you to define different classes for different states:

```typescript
interface CVAPropertyValue {
  id: string;
  name: string; // e.g., "brand"
  prefixedClasses: CVAPrefixedClasses[]; // Multiple slots
}

interface CVAPrefixedClasses {
  id: string;
  prefix: string;   // e.g., "hover:"
  classes: string[]; // e.g., ["bg-fill-accent-hover"]
}
```

### Generated Output

Multiple prefix slots generate an array in the CVA output:

```typescript
sentiment: {
  brand: [
    "bg-fill-accent-default text-foreground-on-accent",
    "hover:bg-fill-accent-hover",
    "active:bg-fill-accent-pressed",
    "disabled:bg-fill-accent-disabled",
  ],
}
```

### Adding Custom Prefixes

The prefix dropdown includes a "+ Custom..." option. Custom prefixes should end with a colon (`:`) - the tool auto-appends it if missing.

---

## CVA Code Generation

The code generator transforms the mapping configuration into valid CVA TypeScript code.

### Generation Process

1. **Variable Name**: Component name → camelCase + "Variants" (e.g., "My Button" → "myButtonVariants")
2. **Base Classes**: All selected base classes joined with spaces
3. **Variants Object**: Properties with their value→classes mappings
4. **Compound Variants**: Conditional class combinations
5. **Default Variants**: Initial variant values
6. **Type Export**: VariantProps type for TypeScript

### Implementation

See `src/common/cvaGenerator.ts` for the full implementation.

### Code Formatting Rules

- 2-space indentation
- Multiline arrays when a value has multiple prefix slots
- Single-line strings for single prefix slots
- Proper trailing commas
- Empty objects/arrays for missing sections

### Output Structure

```typescript
import { cva, type VariantProps } from "class-variance-authority";

export const componentVariants = cva(
  "base classes here",
  {
    variants: {
      propertyName: {
        value1: "classes for value1",
        value2: ["array", "for", "multiple", "prefix-slots"],
      },
    },
    compoundVariants: [
      {
        propertyName: "value",
        anotherProperty: "value",
        class: "compound classes",
      },
    ],
    defaultVariants: {
      propertyName: "defaultValue",
    },
  }
);

export type ComponentVariantsProps = VariantProps<typeof componentVariants>;
```

---

## Configuration Types

### CVAConfig

The main configuration object:

```typescript
interface CVAConfig {
  componentName: string;
  baseClasses: string[];
  variants: CVAVariantConfig[];
  compoundVariants: CompoundVariantRule[];
  defaultVariants: DefaultVariants;
}
```

### CVAVariantConfig

A single variant card configuration:

```typescript
interface CVAVariantConfig {
  id: string;
  name: string;              // Variant property name
  showPrefixes: boolean;     // Toggle prefix column visibility
  properties: CVAVariantProperty[];
  domMappings: DOMElementMapping[];
}
```

### CVAVariantProperty

A property within a variant:

```typescript
interface CVAVariantProperty {
  id: string;
  name: string;              // e.g., "size", "variant"
  values: CVAPropertyValue[];
}
```

### CVAPropertyValue

A value with its prefix slots:

```typescript
interface CVAPropertyValue {
  id: string;
  name: string;              // e.g., "sm", "brand"
  prefixedClasses: CVAPrefixedClasses[];
}
```

### CompoundVariantRule

A compound variant rule:

```typescript
interface CompoundVariantRule {
  id: string;
  conditions: CompoundCondition[];
  classes: string[];
}

interface CompoundCondition {
  id: string;
  propertyName: string;
  propertyValue: string;
}
```

---

## Extending the Tool

### Adding New Class Categories

1. **Update types**: Add to `ClassCategory` type in `types.ts`
2. **Add patterns**: Update `CLASS_CATEGORIES` in `classManager.ts`
3. **Update categorization**: Modify `categorizeClass()` in `useCVAState.ts`

### Adding New Pseudo-class Prefixes

Update `PSEUDO_CLASS_PREFIXES` in `types.ts`:

```typescript
export const PSEUDO_CLASS_PREFIXES = [
  { value: '', label: 'None' },
  { value: 'hover:', label: 'hover:' },
  // Add new prefixes here
  { value: 'data-[state=open]:', label: 'data-[state=open]:' },
] as const;
```

### Modifying Variant Name Detection

Update the `variantPatterns` array and logic in `isFigmaVariantName()` function in `useCVAState.ts`.

### Adding New Property Sources

To add additional property extraction sources:

1. Add parsing logic in `setExtractorResult` callback
2. Merge with existing `snippetProperties` Map
3. Handle value normalization (especially for booleans)

### Customizing Code Generation

Modify functions in `cvaGenerator.ts`:

- `toVariableName()`: Component name → variable name conversion
- `generateVariantsObject()`: Variant property structure
- `generateCompoundVariantsArray()`: Compound variant format
- `generateDefaultVariantsObject()`: Default values format
- `generateCVACode()`: Overall code structure

---

## File Reference

### Core Files

| File | Purpose |
|------|---------|
| `src/ui/components/cva/types.ts` | TypeScript type definitions |
| `src/ui/components/cva/hooks/useCVAState.ts` | State management and extraction logic |
| `src/ui/components/cva/utils/classManager.ts` | Class categorization utilities |
| `src/common/cvaGenerator.ts` | CVA code generation |
| `src/ui/utils/cvaExport.ts` | File export utilities |

### UI Components

| File | Purpose |
|------|---------|
| `CVATool.tsx` | Main container component |
| `CVAContext.tsx` | React Context provider |
| `CVARightSidebar.tsx` | Mode toggle, summary, actions |
| `MappingMode.tsx` | Mapping interface container |
| `CodeMode.tsx` | Code preview display |
| `BaseClassesConfig.tsx` | Base class selection UI |
| `VariantCard.tsx` | Individual variant configuration |
| `DefaultVariantsConfig.tsx` | Default variants UI |
| `CompoundVariantsConfig.tsx` | Compound variants UI |
| `ClassSelectionModal.tsx` | Class picker modal |

---

## Debugging Tips

### Classes Not Appearing

1. Check if classes are being extracted: Look at `extractedClasses` in React DevTools
2. Verify categorization: Check if patterns match in `categorizeClass()`
3. Check for variant name filtering: The class might be detected as a Figma variant name

### Properties Not Pre-creating

1. Check raw output: Verify `property=value` patterns exist
2. Check Figma properties: Ensure component has defined properties
3. Check normalization: Boolean values should be normalized

### Code Generation Issues

1. Check `config` state: Verify the CVA config has correct structure
2. Check prefix slots: Each value needs at least one prefix slot
3. Check for empty arrays: Empty class arrays are filtered out

### Console Logging

Add debug logging in `useCVAState.ts`:

```typescript
console.log('Extracted classes:', classesWithDOM);
console.log('Properties found:', snippetProperties);
console.log('Generated variants:', autoVariants);
```

