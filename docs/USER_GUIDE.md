# User Guide

A complete guide to using the Figma Design-to-Code Plugin for designers and developers.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [DOM Extractor Tool](#dom-extractor-tool)
3. [CVA Mapping Tool](#cva-mapping-tool)
4. [Understanding Variables](#understanding-variables)
5. [Tips & Best Practices](#tips--best-practices)
6. [FAQ](#faq)

---

## Getting Started

### Installation

1. **Download the plugin** or build from source:
   ```bash
   git clone <repository-url>
   cd figma-api
   npm install
   npm run build
   ```

2. **Import into Figma**:
   - Open any Figma design file
   - Right-click anywhere on the canvas
   - Navigate to `Plugins > Development > Import plugin from manifest...`
   - Select the `dist/manifest.json` file from the build output

3. **Run the plugin**:
   - Right-click in your design file
   - Go to `Plugins > Development > Figma Design-to-Code`

### First Extraction Walkthrough

1. **Select a component** in your Figma file:
   - Click on a Frame, Component, Instance, or Component Set
   - The plugin works with any selection

2. **Open the plugin** from the Plugins menu

3. **Click "Get code"** to extract the design

4. **Review the output**:
   - **Tailwind tab**: JSX with Tailwind utility classes
   - **CSS tab**: HTML with inline CSS styles
   - **RAW tab**: Raw JSON structure

5. **Copy the code** using the Copy button

### Understanding the Output

The plugin generates semantic HTML/JSX where **Figma layer names become tag names**:

```jsx
// Your Figma structure:
// Frame: "Card"
//   ├── Frame: "Header"
//   │   └── Text: "Title"
//   └── Frame: "Content"
//       └── Text: "Description"

// Generated output:
<Card className="flex flex-col p-4 bg-white rounded-lg">
  <Header className="flex flex-row items-center">
    <Title className="text-lg font-bold">Welcome</Title>
  </Header>
  <Content className="mt-4">
    <Description className="text-sm text-gray-600">
      Your description here
    </Description>
  </Content>
</Card>
```

---

## DOM Extractor Tool

The DOM Extractor converts Figma designs into production-ready code.

### What It Does

- Extracts complete DOM structure with styles
- Resolves Figma variables to CSS custom properties
- Generates semantic tag names from layer names
- Supports both CSS and Tailwind output formats

### How to Use

1. **Select your component** in Figma
2. **Click "Get code"** in the plugin
3. **Choose your format** using the tabs:
   - **Tailwind**: For React/JSX projects using Tailwind CSS
   - **CSS**: For standard HTML with inline styles
   - **RAW**: For debugging or custom processing

### Output Format Options

#### Tailwind Format

Best for React/Next.js projects using Tailwind CSS:

```jsx
<Button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg">
  <Icon.Check className="w-4 h-4 mr-2" />
  <Label className="font-medium">Submit</Label>
</Button>
```

Features:
- Semantic tag names (preserves dots for React namespacing)
- Tailwind utility classes
- className attribute (React style)

#### CSS Format

Best for vanilla HTML/CSS or non-React projects:

```html
<Button style="display: flex; align-items: center; padding: 8px 16px; background-color: var(--fill-primary); border-radius: 8px;">
  <IconCheck style="width: 16px; height: 16px; margin-right: 8px;" />
  <Label style="font-weight: 500;">Submit</Label>
</Button>
```

Features:
- Semantic tag names (dots removed for HTML compatibility)
- Inline CSS styles
- CSS custom property references

#### RAW Format

The complete extracted data as JSON:

```json
{
  "id": "123:456",
  "name": "Button",
  "type": "COMPONENT",
  "styles": {
    "fills": [{ "type": "SOLID", "color": "#3b82f6", "variable": "fill/primary" }],
    "layout": { "width": 120, "height": 40, "paddingLeft": 16 }
  },
  "children": [...]
}
```

### Settings

Access settings in the "Settings" sub-tab:

| Setting | Description |
|---------|-------------|
| **Annotations** | Include Figma annotations as code comments |
| **Prettify** | Format output with consistent indentation |
| **Skip Zeros** | Hide zero-value properties (e.g., `rounded-[0px]`, `p-0`) |
| **Icon Export** | How to handle icon components (None or NPM Package) |

### Working with Variables

When your Figma file uses variables, they appear in the output:

**Tailwind**: As semantic class names
```jsx
<Card className="bg-fill-neutral-default text-foreground-primary">
```

**CSS**: As custom property references
```html
<Card style="background-color: var(--fill-neutral-default); color: var(--foreground-primary);">
```

**Used Vars tab**: Shows all variables used in your component
```css
:root {
  --fill-neutral-default: #f8fafc;
  --foreground-primary: #0f172a;
}
```

---

## CVA Mapping Tool

The CVA Mapping Tool generates type-safe [Class Variance Authority](https://cva.style/) configurations from component variants.

### What It Does

CVA (Class Variance Authority) is a popular library for creating variant-based component styles. This tool:

- Extracts variant properties from Figma component sets
- Lets you visually map classes to variants
- Generates type-safe TypeScript code

### Why Use CVA?

Instead of manually writing:

```tsx
// Manual approach - error prone, hard to maintain
function Button({ variant, size }) {
  let classes = "px-4 py-2 rounded";
  if (variant === "primary") classes += " bg-blue-500 text-white";
  if (variant === "secondary") classes += " bg-gray-200 text-gray-800";
  if (size === "sm") classes += " text-sm";
  if (size === "lg") classes += " text-lg";
  return <button className={classes}>...</button>;
}
```

Generate type-safe code:

```tsx
// CVA approach - type-safe, maintainable
const buttonVariants = cva("px-4 py-2 rounded", {
  variants: {
    variant: {
      primary: "bg-blue-500 text-white",
      secondary: "bg-gray-200 text-gray-800",
    },
    size: {
      sm: "text-sm",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonProps = VariantProps<typeof buttonVariants>;
```

### How to Use

1. **Select a Component Set** in Figma (a component with variants)

2. **Extract the component** using "Get code"

3. **Switch to CVA Mapping Tool** using the left navigation

4. **Configure your CVA**:

   **Step 1: Select Base Classes**
   - Classes that apply to ALL variants
   - Usually layout and positioning classes
   - Example: `flex`, `items-center`, `rounded-lg`

   **Step 2: Map Variant Classes**
   - For each property (e.g., "variant", "size")
   - Assign classes to each value
   - Example: `primary` → `bg-blue-500 text-white`

   **Step 3: Add Compound Variants** (optional)
   - Classes that apply when multiple conditions match
   - Example: When `variant=primary` AND `size=lg` → `shadow-lg`

   **Step 4: Set Defaults**
   - Default values for each property
   - Used when prop is not specified

5. **Copy the generated code** from the Code tab

### The Interface

#### DOM & Styles Panel (Left)

Shows the DOM hierarchy with class counts:

```
▼ Button (12 classes)
  ├─ Icon (4 classes)
  └─ Label (6 classes)
```

- Click elements to filter classes
- Use multi-select for elements with same name across variants

#### Class Selection Modal

Click "Add Classes" to open the modal:

- **Categories**: Fill, Typography, Spacing, Layout, etc.
- **Search**: Filter classes by name
- **DOM Filter**: Show only classes from selected elements
- **Selection**: Check classes to add to current slot

#### Variant Cards

Each variant property has a card:

```
┌─────────────────────────────────────────┐
│ variant                            [×]  │
├─────────────────────────────────────────┤
│ primary    [default] [hover] [+]        │
│            bg-blue-500, text-white      │
│                                         │
│ secondary  [default] [hover] [+]        │
│            bg-gray-200, text-gray-800   │
├─────────────────────────────────────────┤
│ [+ Add Value]                           │
└─────────────────────────────────────────┘
```

- **Prefix slots**: default, hover, active, focus, disabled
- Each slot can have different classes

### Generated Code

The Code tab shows the generated CVA configuration:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

export const componentVariants = cva(
  "flex items-center rounded-lg",
  {
    variants: {
      variant: {
        primary: "bg-blue-500 text-white",
        secondary: "bg-gray-200 text-gray-800",
      },
      size: {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      },
    },
    compoundVariants: [
      {
        variant: "primary",
        size: "lg",
        className: "shadow-lg",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ComponentVariants = VariantProps<typeof componentVariants>;
```

---

## Understanding Variables

### How Figma Variables Work

Figma variables are reusable values for colors, spacing, typography, etc. When you use variables in your designs, the plugin:

1. Detects the variable binding
2. Extracts the variable name
3. Resolves the current value
4. Generates appropriate output

### Variable Types Supported

| Figma Variable | CSS Output | Tailwind Output |
|----------------|------------|-----------------|
| Color (fill/stroke) | `var(--fill-primary)` | `bg-fill-primary` |
| Spacing | `var(--spacing-4)` | `p-4`, `gap-4` |
| Font Size | `var(--font-size-lg)` | `text-lg` |
| Font Weight | `var(--font-weight-bold)` | `font-bold` |
| Border Radius | `var(--radius-lg)` | `rounded-lg` |
| Border Width | `var(--border-width-2)` | `border-2` |
| Effect Styles | `var(--shadow-lg)` | `shadow-lg` |

### Effect Styles (Shadows)

Figma Effect Styles (like "shadow/lg") are automatically detected:

```jsx
// If your Figma node uses Effect Style "shadow/lg"
<Card className="shadow-lg">...</Card>
```

### Integrating Variables

The "Used Vars" tab shows all variables. Add these to your project:

**Tailwind Config:**
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'fill-primary': 'var(--fill-primary)',
        'fill-neutral-default': 'var(--fill-neutral-default)',
      },
    },
  },
};
```

**CSS Variables:**
```css
/* globals.css */
:root {
  --fill-primary: #3b82f6;
  --fill-neutral-default: #f8fafc;
  --spacing-4: 16px;
}
```

---

## Tips & Best Practices

### Organizing Figma Components

**Use descriptive layer names:**
```
✓ "SubmitButton" → <SubmitButton>
✓ "Icon.Close" → <Icon.Close>
✗ "Frame 123" → <Frame123>
```

**Use component sets for variants:**
- Create a Component Set for buttons, inputs, etc.
- Define variant properties: `variant`, `size`, `state`
- The plugin auto-detects these for CVA mapping

**Organize with auto-layout:**
- Use auto-layout for proper flex/grid output
- Set constraints for responsive behavior

### Naming Conventions

**For React projects:**
- Use PascalCase for components: `Button`, `CardHeader`
- Use dots for namespacing: `Icon.Close`, `Form.Input`

**For variables:**
- Use consistent prefixes: `fill/`, `stroke/`, `spacing/`
- Use semantic names: `fill/primary`, `foreground/neutral`

### Using Component Sets

Component sets are the key to CVA generation:

1. **Create variants** using Figma's variant properties
2. **Keep property names simple**: `variant`, `size`, `state`
3. **Use consistent values**: `primary`, `secondary` (not `Primary`, `SECONDARY`)

### Troubleshooting

**No output generated:**
- Ensure you have a component selected
- Check if the component has styles to extract

**Variables not detected:**
- Verify the property is bound to a variable in Figma
- Check the "RAW" output to see what's being extracted

**Classes not appearing in CVA:**
- Use the DOM filter to find classes
- Check if classes are being filtered by "Skip Zeros"

---

## FAQ

### What components can I extract?

The plugin works with:
- **Frames** - Any frame on the canvas
- **Components** - Master components
- **Instances** - Component instances
- **Component Sets** - Sets with variants (best for CVA)

### Can I extract multiple components?

Yes! Select multiple components and click "Get code". Each component is extracted separately.

### How are colors handled?

- **With variable**: Uses variable name (`bg-fill-primary`)
- **Without variable**: Uses hex color (`bg-[#3b82f6]`)

### What about responsive styles?

The plugin extracts the current state of your design. For responsive variants:
1. Create variants for each breakpoint
2. Use CVA to map responsive classes
3. Or manually add responsive prefixes (`sm:`, `md:`, `lg:`)

### Can I customize the output?

Yes! The extracted code is a starting point:
- Modify class names to match your design system
- Add responsive prefixes
- Combine with your existing components

### Why are some classes filtered?

With "Skip Zeros" enabled, these are hidden:
- `rounded-[0px]` → No visual effect
- `p-0` → No padding
- `gap-0` → No gap

Disable this in Settings if you need all classes.

### How do Effect Styles work?

Figma Effect Styles (e.g., "shadow/lg") are converted to:
- Tailwind: `shadow-lg`
- CSS: `box-shadow: var(--shadow-lg)`

### Can I use this with other frameworks?

The output is framework-agnostic:
- **React/Next.js**: Use Tailwind format directly
- **Vue/Svelte**: Use CSS format, adapt syntax
- **Vanilla HTML**: Use CSS format

---

## Getting Help

- Check the [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for technical details
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See archived documentation in `docs/archive/` for historical reference

