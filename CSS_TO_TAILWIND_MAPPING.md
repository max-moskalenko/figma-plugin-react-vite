# CSS to Tailwind Remapping Logic

This document provides a comprehensive explanation of how CSS properties are converted to Tailwind CSS utility classes in this Figma plugin.

## Overview

The plugin converts Figma design tokens and CSS properties into Tailwind utility classes. The conversion process involves:

1. **Variable Detection**: Identifying Figma variables bound to design properties
2. **Value Extraction**: Extracting semantic values from variable names (e.g., "spacing-7" → "7")
3. **Class Generation**: Mapping values to Tailwind utility classes
4. **Fallback Handling**: Using arbitrary values when no direct Tailwind class exists

## Core Conversion Functions

### Variable Name Transformation

**Function**: `figmaVariableToTailwindClass(figmaName: string)`

Converts Figma variable names to Tailwind-friendly class names by:
- Converting to lowercase
- Replacing slashes (`/`) with hyphens (`-`)
- Removing special characters

**Examples**:
- `"spacing/7"` → `"spacing-7"`
- `"fill/neutral/default"` → `"fill-neutral-default"`
- `"color/primary"` → `"color-primary"`

## Property-Specific Remapping

### 1. Spacing Properties (Padding, Gap, Width, Height)

**Extraction Function**: `extractSpacingValue(variableName: string)`

**Pattern Matching**:
- `"spacing-7"` → extracts `"7"` → generates `p-7`, `gap-7`, `w-7`, `h-7`
- `"spacing-0-5"` → extracts `"0.5"` → generates `p-0.5`, `gap-0.5`
- `"spacing-px"` → extracts `"px"` → generates `p-px`, `gap-px`

**Remapping Logic**:

#### Padding
- **With Variable**: If variable name contains spacing scale → use `pt-{value}`, `pr-{value}`, `pb-{value}`, `pl-{value}`
- **Without Variable**: 
  - Equal padding on all sides → `p-{value}` (e.g., `p-4` for 16px)
  - Different padding → arbitrary value `p-[{top}px_{right}px_{bottom}px_{left}px]`
- **Zero Padding**: Filtered out (not generated)

#### Gap
- **With Variable**: `gap-{value}` (e.g., `gap-7` for spacing-7 variable)
- **Without Variable**: 
  - Common values mapped: `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)
  - Others → `gap-[{value}px]`
- **Special Case**: Skipped when using `SPACE_BETWEEN` alignment (handled by justify-between)

#### Width/Height
- **With Variable**: `w-{value}` or `h-{value}` (e.g., `w-7`, `h-7`)
- **Without Variable**: 
  - `100%` → `w-full` or `h-full`
  - `auto` → `w-auto` or `h-auto`
  - Others → `w-[{value}px]` or `h-[{value}px]`
- **Layout Sizing**:
  - `FILL` → `w-full` or `h-full`
  - `HUG` → No class (natural sizing)
  - `FIXED` → Explicit width/height class
  - `layoutGrow === 1` → `flex-1` (fills available space)

### 2. Typography Properties

#### Font Size

**Extraction Function**: `extractFontSizeValue(variableName: string)`

**Pattern Matching**:
- `"font-size-xs"` → extracts `"xs"` → generates `text-xs`
- `"font-size-sm"` → extracts `"sm"` → generates `text-sm`
- `"font-size-lg"` → extracts `"lg"` → generates `text-lg`

**Remapping Logic**:
- **With Variable**: `text-{value}` (e.g., `text-xs`, `text-sm`, `text-lg`)
- **Without Variable**: 
  - Common sizes mapped:
    - `12px` → `text-xs`
    - `14px` → `text-sm`
    - `16px` → `text-base`
    - `18px` → `text-lg`
    - `20px` → `text-xl`
    - `24px` → `text-2xl`
    - `30px` → `text-3xl`
    - `36px` → `text-4xl`
    - `48px` → `text-5xl`
    - `60px` → `text-6xl`
  - Others → `text-[{size}px]`

#### Font Weight

**Extraction Function**: `extractFontWeightValue(variableName: string)`

**Pattern Matching**:
- `"font-weight-normal"` → extracts `"normal"` → generates `font-normal`
- `"font-weight-bold"` → extracts `"bold"` → generates `font-bold`

**Remapping Logic**:
- **With Variable**: `font-{value}` (e.g., `font-normal`, `font-bold`)
- **Without Variable**: 
  - `thin` → `font-thin` (100)
  - `extralight` → `font-extralight` (200)
  - `light` → `font-light` (300)
  - `regular` → `font-normal` (400)
  - `medium` → `font-medium` (500)
  - `semibold` → `font-semibold` (600)
  - `bold` → `font-bold` (700)
  - `extrabold` → `font-extrabold` (800)
  - `black` → `font-black` (900)
  - Others → `font-normal` (default)

#### Font Family

**Extraction Function**: `extractFontFamilyValue(variableName: string)`

**Pattern Matching**:
- `"font-sans"` → extracts `"sans"` → generates `font-sans`
- `"font-mono"` → extracts `"mono"` → generates `font-mono`
- `"font-serif"` → extracts `"serif"` → generates `font-serif`

**Remapping Logic**:
- **With Variable**: `font-{value}` (e.g., `font-sans`, `font-mono`, `font-serif`)
- **Without Variable**: 
  - Font name contains "sans" → `font-sans`
  - Font name contains "serif" → `font-serif`
  - Font name contains "mono" → `font-mono`
  - Others → `font-['{fontName}']` (arbitrary value)

#### Line Height

**Extraction Function**: `extractLineHeightValue(variableName: string)`

**Pattern Matching**:
- `"font-leading-4"` → extracts `"4"` → generates `leading-4`
- `"font-leading-5"` → extracts `"5"` → generates `leading-5`

**Remapping Logic**:
- **With Variable**: `leading-{value}` (e.g., `leading-4`, `leading-5`)
- **Without Variable**: 
  - `1` → `leading-none`
  - `1.25` → `leading-tight`
  - `1.5` → `leading-snug`
  - `1.75` → `leading-normal`
  - `2` → `leading-relaxed`
  - `2.25` → `leading-loose`
  - Others → `leading-[{value}]` (supports px and %)

#### Letter Spacing

**Remapping Logic**:
- **With Variable**: `tracking-[var(--{variableName})]` (arbitrary value with CSS variable)
- **Without Variable**: `tracking-[{value}px]` or `tracking-[{value}%]`

#### Text Decoration

**Remapping Logic**:
- `underline` → `underline`
- `line-through` → `line-through`
- `overline` → `overline`

#### Text Case

**Remapping Logic**:
- `UPPER` → `uppercase`
- `LOWER` → `lowercase`
- `TITLE` → `capitalize`

#### Text Alignment

**Remapping Logic**:
- `LEFT` → `text-left`
- `CENTER` → `text-center`
- `RIGHT` → `text-right`
- `JUSTIFIED` → `text-justify`

### 3. Color Properties (Fills & Strokes)

#### Background Colors (Fills)

**Remapping Logic**:
- **With Variable**: 
  - Variable name converted to Tailwind class → `bg-{variableName}`
  - Color value stored in `variableMap` for Tailwind config
  - Example: `"fill/neutral/default"` → `bg-fill-neutral-default`
- **Without Variable**: 
  - Solid color → `bg-[#{hex}]`
  - With opacity → `bg-[rgba(r,g,b,opacity)]`
- **Gradients**: 
  - Linear → `bg-[linear-gradient(...)]`
  - Radial → `bg-[radial-gradient(...)]`

**Special Case for Text Nodes**:
- For TEXT nodes, fills represent text color, not background
- `bg-` prefix replaced with `text-` prefix
- Example: `bg-fill-neutral-default` → `text-fill-neutral-default`

#### Border Colors (Strokes)

**Remapping Logic**:
- **With Variable**: `border-{variableName}` (e.g., `border-fill-neutral-default`)
- **Without Variable**: 
  - Solid color → `border-[#{hex}]`
  - With opacity → `border-[rgba(r,g,b,opacity)]`

#### Border Width

**Extraction Function**: `extractBorderWidthValue(variableName: string)`

**Pattern Matching**:
- `"border-width-1"` → extracts `"1"` → generates `border-1`
- `"border-width-2"` → extracts `"2"` → generates `border-2`

**Remapping Logic**:
- **With Variable**: `border-{value}` (e.g., `border-1`, `border-2`)
- **Without Variable**: 
  - Common values: `border-1` (1px), `border-2` (2px), `border-3` (3px), `border-4` (4px), `border-8` (8px)
  - Others → `border-[{value}px]`

#### Border Style

**Remapping Logic**:
- **Dotted**: When `strokeDashArray` has equal small values (≤2px) → `border-dotted`
- **Dashed**: When `strokeDashArray` has other patterns → `border-dashed`
- **Solid**: Default (no class needed)

### 4. Border Radius

**Extraction Function**: `extractRadiusValue(variableName: string)`

**Pattern Matching**:
- `"radius-full"` → extracts `"full"` → generates `rounded-full`
- `"radius-lg"` → extracts `"lg"` → generates `rounded-lg`
- `"radius-2xl"` → extracts `"2xl"` → generates `rounded-2xl`

**Remapping Logic**:
- **With Variable**: `rounded-{value}` (e.g., `rounded-full`, `rounded-lg`, `rounded-2xl`)
- **Without Variable**: 
  - `4px` → `rounded`
  - `8px` → `rounded-lg`
  - `12px` → `rounded-xl`
  - `16px` → `rounded-2xl`
  - Others → `rounded-[{value}px]`
- **Per-Corner Radius**: `rounded-[{topLeft}px_{topRight}px_{bottomRight}px_{bottomLeft}px]`

### 5. Layout Properties

#### Display & Flex Direction

**Remapping Logic**:
- `layoutMode` exists → `flex` + `flex-row` (HORIZONTAL) or `flex-col` (VERTICAL)

#### Alignment

**Remapping Logic**:
- **Primary Axis (HORIZONTAL layout)**:
  - `MIN` → `justify-start`
  - `CENTER` → `justify-center`
  - `MAX` → `justify-end`
  - `SPACE_BETWEEN` → `justify-between`
  - `SPACE_AROUND` → `justify-around`
- **Primary Axis (VERTICAL layout)**:
  - `MIN` → `items-start`
  - `CENTER` → `items-center`
  - `MAX` → `items-end`
  - `STRETCH` → `items-stretch`
- **Counter Axis (HORIZONTAL layout)**:
  - `MIN` → `items-start`
  - `CENTER` → `items-center`
  - `MAX` → `items-end`
  - `STRETCH` → `items-stretch`
- **Counter Axis (VERTICAL layout)**:
  - `MIN` → `justify-start`
  - `CENTER` → `justify-center`
  - `MAX` → `justify-end`
  - `SPACE_BETWEEN` → `justify-between`
  - `SPACE_AROUND` → `justify-around`

#### Positioning

**Remapping Logic**:
- `layoutPositioning === "ABSOLUTE"` → `absolute`
- Parent with absolutely positioned children → `relative` (added to parent)

### 6. Opacity

**Remapping Logic**:
- **With Variable**: `opacity-[var(--{variableName})]`
- **Without Variable**: 
  - `0.1` → `opacity-10`
  - `0.2` → `opacity-20`
  - `0.3` → `opacity-30`
  - `0.4` → `opacity-40`
  - `0.5` → `opacity-50`
  - `0.6` → `opacity-60`
  - `0.7` → `opacity-70`
  - `0.8` → `opacity-80`
  - `0.9` → `opacity-90`
  - Others → `opacity-[{value}]`
- **Note**: Only generated when opacity < 1

### 7. Effects (Shadows & Blurs)

#### Shadows

**Remapping Logic**:
- Drop shadows and inner shadows → `shadow-[{shadowDefinition}]`
- Shadow definition format: `{inset}{x}px {y}px {radius}px rgba(r,g,b,opacity)`
- Multiple shadows combined: `shadow-[shadow1, shadow2, ...]`

#### Blurs

**Remapping Logic**:
- **With Variable**: Not supported (effects don't use variables)
- **Without Variable**: 
  - `4px` → `blur-sm`
  - `8px` → `blur`
  - `12px` → `blur-md`
  - `16px` → `blur-lg`
  - `24px` → `blur-xl`
  - Others → `blur-[{radius}px]`

### 8. Visibility

**Remapping Logic**:
- `visible === false` → `hidden`

## Variable Map Population

The `variableMap` is populated during class generation to store CSS variable definitions for Tailwind configuration. This allows users to:

1. Add variables to their `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      'fill-neutral-default': 'var(--fill-neutral-default)',
    }
  }
}
```

2. Define CSS variables in their global CSS:
```css
:root {
  --fill-neutral-default: #0066ff;
}
```

## Fallback Strategy

When a direct Tailwind class doesn't exist, the plugin uses Tailwind's arbitrary value syntax:

- **Arbitrary Values**: `[{value}]` (e.g., `w-[123px]`, `bg-[#ff0000]`)
- **CSS Variables in Arbitrary Values**: `[var(--variable-name)]` (e.g., `w-[var(--spacing-7)]`)

## Order of Class Generation

Classes are generated in this logical order:

1. Layout (display, flex, width, height, padding, gap, alignment, positioning)
2. Typography (font family, size, weight, line height, letter spacing, decoration, case, alignment)
3. Colors (background/fills, text color for text nodes)
4. Borders (border color, width, style, radius)
5. Effects (shadows, blurs)
6. Visibility (hidden)

This order ensures proper CSS cascade and readability.

## Special Cases & Edge Cases

### 1. Text Node Color Handling
- For TEXT nodes, fills are converted to text color classes (`text-*`) instead of background classes (`bg-*`)

### 2. Layout Sizing Priority
- `layoutGrow === 1` takes precedence → uses `flex-1`
- `layoutSizingHorizontal === "FILL"` → uses `w-full`
- `layoutSizingVertical === "FILL"` → uses `h-full`
- `HUG` → no class (natural sizing)

### 3. Gap with SPACE_BETWEEN
- Gap class is skipped when using `SPACE_BETWEEN` alignment (spacing handled by `justify-between`)

### 4. Zero Value Filtering
- Zero padding, gap, and border-radius values are filtered out (not generated)

### 5. Per-Corner Border Radius
- When corners have different radii, uses arbitrary value: `rounded-[{tl}px_{tr}px_{br}px_{bl}px]`

### 6. Relative Positioning for Absolute Children
- Parent nodes with absolutely positioned children automatically get `relative` class

## Implementation Files

- **`src/common/tailwindGenerator.ts`**: Core remapping functions
- **`src/common/tailwindDomGenerator.ts`**: HTML generation with Tailwind classes
- **`src/common/cssGenerator.ts`**: CSS generation (for comparison)

## Testing the Remapping

To verify remapping logic:

1. Create a Figma component with various properties
2. Bind Figma variables to properties
3. Extract code in Tailwind format
4. Verify generated classes match expected Tailwind utilities
5. Check that CSS variables are properly defined in the output

