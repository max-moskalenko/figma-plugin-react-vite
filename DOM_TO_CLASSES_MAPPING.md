# DOM-to-Classes Mapping Documentation

This document provides comprehensive documentation on how the CVA Mapping Tool associates CSS classes with DOM elements, enabling precise class filtering in the Class Selection Modal.

## Table of Contents

1. [Overview](#overview)
2. [The Challenge](#the-challenge)
3. [Solution Architecture](#solution-architecture)
4. [Implementation Details](#implementation-details)
5. [Data Structures](#data-structures)
6. [Algorithms](#algorithms)
7. [Recent Fixes](#recent-fixes)
8. [Usage Examples](#usage-examples)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What is DOM-to-Classes Mapping?

DOM-to-Classes mapping is the system that tracks **which CSS classes belong to which DOM elements** in an extracted Figma component. This enables users to:

1. **Filter classes by DOM element**: "Show only classes used on the button root"
2. **Filter classes by variant**: "Show only classes used in the hover state"
3. **Understand class usage**: "Where is this class applied?"
4. **Prevent conflicts**: "This class is already used on another element"

### Why It's Important

Without DOM mapping, users see a flat list of 100+ classes with no context about where each class is used. DOM mapping provides **structure and context**, making class selection faster and less error-prone.

### Visual Example

```
Component: Button
├─ button-root (depth 0)
│  ├─ Classes: flex, flex-row, p-4, bg-fill-primary, rounded-lg
├─ left-list-item-slot (depth 1)
│  ├─ Classes: w-4, h-4, flex, justify-center
│  ├─ acorn (depth 2)
│     ├─ Classes: flex-1, flex-col, items-start
│     ├─ vector (depth 3)
│        ├─ Classes: w-[13px], h-[15px], text-foreground-neutral
├─ label (depth 1)
   ├─ Classes: flex-1, font-sans, text-sm, text-left
```

When user selects "acorn", only its 3 classes are shown. When user selects "All Elements", all classes are shown.

---

## The Challenge

### Problem 1: Two Data Sources with Different Formats

**RAW JSON Output** (from `extractorResult.raw.stylesheet`):
```json
[{
  "id": "1918:218",
  "name": "sentiment=neutral, interaction=default, height=h-28",
  "type": "COMPONENT",
  "children": [
    {
      "id": "2280:620",
      "name": "Left List Item Slot",
      "type": "INSTANCE",
      "children": [...]
    },
    {
      "id": "1918:197",
      "name": "Label",
      "type": "TEXT"
    }
  ]
}]
```

**Tailwind HTML Output** (from `extractorResult.tailwind.stylesheet`):
```html
<div class="sentiment-neutral-interaction-default-height-h-28 w-full flex flex-row p-1 gap-1-5">
  <div class="left-list-item-slot w-4 h-4 flex justify-center">
    <div class="acorn flex-1 flex-col items-start">
      <svg class="vector w-[13px] h-[15px] text-foreground-neutral" />
    </div>
  </div>
  <p class="label flex-1 font-sans text-sm">Select</p>
</div>
```

**The Problem**:
- RAW JSON has reliable structure but no CSS classes
- Tailwind HTML has CSS classes but structure is harder to parse reliably
- Need to combine both: Structure from RAW, Classes from Tailwind

### Problem 2: Name Normalization Differences

**Figma Node Names** (RAW JSON):
```
"Left List Item Slot"
"Acorn"
"Label"
"PhosphorIcons/Check"
"Slider.root"
```

**Tailwind Class Names** (first class in className):
```
"left-list-item-slot"
"acorn"
"label"
"phosphoricons-check"
"slider-root"
```

**The Problem**:
- Figma uses spaces, capitals, dots, slashes
- Tailwind normalizes to lowercase kebab-case
- Must apply **same normalization** to match RAW names with Tailwind classes

### Problem 3: Variant Hierarchies

For component sets with multiple variants:

```
Variant 1: sentiment=neutral, interaction=default, height=h-28
├─ left-list-item-slot
│  ├─ acorn
│     ├─ vector
├─ label

Variant 2: sentiment=neutral, interaction=hover, height=h-28
├─ left-list-item-slot
│  ├─ acorn
│     ├─ vector
├─ label

Variant 3: sentiment=neutral, interaction=pressed, height=h-28
├─ left-list-item-slot
│  ├─ acorn
│     ├─ vector
├─ label
```

**The Problem**:
- Same child structure across variants
- Different classes per variant
- Need to maintain **separate hierarchies** per variant
- Need to combine for "All Variants" view

---

## Solution Architecture

### Two-Pass Extraction Strategy

**Pass 1: Build DOM Hierarchy from RAW JSON**

Purpose: Get reliable structure with correct names and depth

```typescript
interface DOMElement {
  name: string;    // Normalized kebab-case name
  depth: number;   // Nesting level (0 = root, 1 = child, 2 = grandchild, etc.)
}

// Result: Array of DOMElement objects in hierarchical order
[
  { name: "sentiment-neutral-interaction-default-height-h-28", depth: 0 },
  { name: "left-list-item-slot", depth: 1 },
  { name: "acorn", depth: 2 },
  { name: "vector", depth: 3 },
  { name: "label", depth: 1 }
]
```

**Pass 2: Extract Classes from Tailwind HTML**

Purpose: Get CSS classes and associate with elements

```typescript
// Parse: className="element-name utility-class-1 utility-class-2"
// Convention: First class is element identifier, rest are styling classes

// Result: Map of class → Set of element names
classToDOMMap: {
  "flex": Set(["sentiment-neutral-interaction-default-height-h-28", "left-list-item-slot", "acorn"]),
  "flex-row": Set(["sentiment-neutral-interaction-default-height-h-28"]),
  "w-4": Set(["left-list-item-slot"]),
  "text-foreground-neutral": Set(["vector"])
}
```

### Architecture Diagram

```
┌──────────────────┐         ┌──────────────────┐
│   RAW JSON       │         │  Tailwind HTML   │
│   (Structure)    │         │  (Classes)       │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │ collectElementNames()      │ Parse className attributes
         │                            │
         ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│  DOM Hierarchy   │         │  Class Mapping   │
│  DOMElement[]    │         │  Map<string,     │
│  with depth      │         │     Set<string>> │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         └────────────┬───────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Combined Result:      │
         │  - Hierarchical DOM    │
         │  - Class associations  │
         │  - Filter capability   │
         └────────────────────────┘
```

---

## Implementation Details

### Data Structures

#### VariantDOMStructure

Stores complete DOM information for one variant:

```typescript
interface VariantDOMStructure {
  variantName: string;              // Original variant name from Figma
  elementName?: string;              // Kebab-case element name for matching
  variantClasses: string[];          // Classes on the variant wrapper itself
  childElements: Map<string, string[]>; // elementName → classes array
  childElementsHierarchy: DOMElement[];  // Complete DOM tree with depth
}
```

**Why These Fields?**:
- `variantName`: Display in UI dropdown (e.g., "sentiment=neutral, interaction=default")
- `elementName`: Match with Tailwind classes (e.g., "sentiment-neutral-interaction-default-height-h-28")
- `variantClasses`: Root-level classes for filtering
- `childElements`: Quick lookup for class counts
- `childElementsHierarchy`: **Single source of truth** for DOM structure and order

#### DOMElement

Represents one element in the hierarchy:

```typescript
interface DOMElement {
  name: string;    // Normalized name (e.g., "left-list-item-slot")
  depth: number;   // Nesting level (0 = root, 1 = direct child, etc.)
}
```

**Why Depth?**:
- Visual indentation in UI (12px per depth level)
- Tree structure indicators (`└` for children)
- Semantic understanding of hierarchy

#### classToDOMMap

Maps classes to the elements that use them:

```typescript
type ClassToDOMMap = Map<string, Set<string>>;

// Example:
{
  "flex": Set(["button-root", "icon-container", "label"]),
  "p-4": Set(["button-root"]),
  "w-4": Set(["icon-container"]),
  "text-sm": Set(["label"])
}
```

**Why Set?**:
- Prevents duplicates
- Fast lookup for filtering
- Efficient `has()` checks

### Algorithms

#### 1. collectElementNames: Build DOM Hierarchy

**Purpose**: Recursively traverse RAW JSON to build `DOMElement[]` with depth

```typescript
function collectElementNames(
  node: any,
  isTopLevel: boolean = false,
  depth: number = 0
): DOMElement[] {
  const elements: DOMElement[] = [];
  
  // Should include this node?
  const shouldInclude = 
    node.name && 
    node.type !== "COMPONENT_SET" && 
    !(node.type === "COMPONENT" && depth === 0);
  
  if (shouldInclude) {
    // Normalize: "Left List Item" → "left-list-item"
    const normalizedName = node.name
      .toLowerCase()
      .replace(/[./\s]+/g, '-');
    
    elements.push({
      name: normalizedName,
      depth: depth
    });
  }
  
  // Recurse into children
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => {
      elements.push(...collectElementNames(child, false, depth + 1));
    });
  }
  
  return elements;
}
```

**Key Details**:
- **Skips COMPONENT_SET**: It's a container, not a DOM element
- **Skips top-level COMPONENT** (depth 0): The variant root is added manually
- **Normalization regex** `/[./\s]+/g`: Handles dots, slashes, spaces
- **Recursive depth tracking**: Increments for each child level
- **Preserves order**: Children appear after parent in array

#### 2. Build Variant Hierarchies

**Purpose**: For each variant, create complete hierarchy with root

```typescript
// For COMPONENT_SET (multiple variants)
rawNodes.forEach((node) => {
  if (node.type === "COMPONENT_SET" && node.children) {
    node.children.forEach((variantNode) => {
      if (variantNode.type === "COMPONENT") {
        const variant = variantStructures.find(
          v => v.variantName === variantNode.name
        );
        
        if (variant && variant.elementName) {
          // 1. Add variant root explicitly at depth 0
          const variantRoot: DOMElement = {
            name: variant.elementName,
            depth: 0
          };
          
          // 2. Collect children (start at depth 1)
          const domElements: DOMElement[] = [];
          if (variantNode.children) {
            variantNode.children.forEach((child) => {
              domElements.push(...collectElementNames(child, false, 1));
            });
          }
          
          // 3. Combine: root + children
          variant.childElementsHierarchy = [variantRoot, ...domElements];
        }
      }
    });
  }
});
```

**Why Iterate Children Directly?**:
- Calling `collectElementNames(variantNode)` would include the node itself
- This creates a duplicate (once at depth 1 from the call, once at depth 0 manually)
- By iterating children directly, we avoid the duplicate

**Why Start at Depth 1?**:
- Variant root is explicitly at depth 0
- Its immediate children should be depth 1
- This creates correct hierarchy: 0 → 1 → 2 → 3...

#### 3. Parse Tailwind HTML for Classes

**Purpose**: Extract class-to-element mappings from HTML

```typescript
const elementRegex = /<(\w+)([^>]*)>/g;
let currentVariantContext: VariantDOMStructure | null = null;

while ((match = elementRegex.exec(tailwindSheet)) !== null) {
  const tagName = match[1];
  const attributes = match[2];
  
  // Extract className="..." or class="..."
  const classMatch = attributes.match(/(?:className|class)="([^"]+)"/);
  if (!classMatch) continue;
  
  const allClasses = classMatch[1].split(/\s+/).filter(c => c.trim());
  if (allClasses.length === 0) continue;
  
  // Convention: First class = element name, rest = styling classes
  const elementName = allClasses[0];
  const classes = allClasses.slice(1);
  
  // Is this a variant root?
  const matchedVariant = variantNameMap.get(elementName);
  const variant = matchedVariant 
    ? variantStructures.find(v => v.variantName === matchedVariant) 
    : null;
  
  if (variant) {
    // This is a variant root - set context
    currentVariantContext = variant;
    variant.variantClasses = classes;
    
    // Map classes to variant root
    classes.forEach(cls => {
      if (!map.has(cls)) map.set(cls, new Set());
      map.get(cls)!.add(elementName);
    });
  } else {
    // This is a child element
    classes.forEach(cls => {
      if (!map.has(cls)) map.set(cls, new Set());
      map.get(cls)!.add(elementName);
    });
    
    // Add to current variant's child map
    if (currentVariantContext) {
      if (!currentVariantContext.childElements.has(elementName)) {
        currentVariantContext.childElements.set(elementName, []);
      }
      const existing = currentVariantContext.childElements.get(elementName)!;
      classes.forEach(cls => {
        if (!existing.includes(cls)) existing.push(cls);
      });
    }
  }
}
```

**Key Concepts**:

1. **Variant Context Tracking**:
   - When we encounter a variant root, we set `currentVariantContext`
   - All subsequent child elements belong to this variant
   - Reset when we encounter next variant root

2. **First Class Convention**:
   - Tailwind generator uses: `<div className="element-name utility-1 utility-2">`
   - First class identifies the element
   - Remaining classes are styling utilities

3. **Global vs Variant Mapping**:
   - `map` (global): Used for "All Elements" and "All Variants" filtering
   - `variant.childElements` (per-variant): Used when specific variant selected

#### 4. Build "All Variants" View

**Purpose**: Combine all variant hierarchies for complete view

```typescript
// After processing all variants
const childElementsWithHierarchy: DOMElement[] = [];

variantStructures.forEach(variant => {
  childElementsWithHierarchy.push(...variant.childElementsHierarchy);
});

return {
  variants: variantStructures,
  classToDOMMap: map,
  allChildElements: childElementsWithHierarchy,
  componentSetName: compSetName
};
```

**Why Concatenate?**:
- "All Variants" shows all roots + all their children
- Each variant root is at depth 0
- Creates visual separation between variants in UI
- User can see complete component set structure

#### 5. Filter Classes by Selection

**Purpose**: Show only classes for selected variant/element

```typescript
const filteredClasses = useMemo(() => {
  let classes = extractedClasses;
  
  // Step 1: Filter by variant
  if (selectedVariant) {
    const variant = variants.find(v => v.variantName === selectedVariant);
    if (variant) {
      // Get all classes for this variant
      const variantClassSet = new Set<string>(variant.variantClasses);
      variant.childElements.forEach(elementClasses => {
        elementClasses.forEach(cls => variantClassSet.add(cls));
      });
      
      classes = classes.filter(c => variantClassSet.has(c.className));
    }
  }
  
  // Step 2: Filter by DOM element within variant
  if (selectedDOMElement) {
    if (selectedVariant) {
      const variant = variants.find(v => v.variantName === selectedVariant);
      if (variant) {
        if (selectedDOMElement === variant.elementName) {
          // Selected the variant root itself
          const wrapperClasses = new Set(variant.variantClasses);
          classes = classes.filter(c => wrapperClasses.has(c.className));
        } else {
          // Selected a child element
          const elementClasses = variant.childElements.get(selectedDOMElement);
          if (elementClasses) {
            const classSet = new Set(elementClasses);
            classes = classes.filter(c => classSet.has(c.className));
          }
        }
      }
    } else {
      // No variant selected - filter across all variants
      classes = classes.filter(c => {
        const mappedElements = classToDOMMap.get(c.className);
        return mappedElements && mappedElements.has(selectedDOMElement);
      });
    }
  }
  
  // Step 3: Apply search term
  return filterClasses(classes, searchTerm);
}, [extractedClasses, searchTerm, selectedVariant, selectedDOMElement, variants, classToDOMMap]);
```

**Filtering Logic**:

1. **Variant-only filter**: Shows all classes used anywhere in that variant
2. **Element-only filter**: Shows classes used on that element across all variants
3. **Variant + Element filter**: Shows classes on that element in that variant only
4. **No filters**: Shows all classes

---

## Recent Fixes

### Fix 1: Duplicate Variant Root Elements

**Problem**: Variant root appeared twice in DOM list

```
Before:
├─ sentiment-neutral-interaction-default (depth 0) ← Manually added
├─ sentiment-neutral-interaction-default (depth 1) ← From collectElementNames
├─ left-list-item-slot (depth 2)
```

**Cause**: 
```typescript
// Called collectElementNames on the variant node itself
const domElements = collectElementNames(variantNode, true, 1);
// Then manually added root
variant.childElementsHierarchy = [variantRoot, ...domElements];
```

**Fix**:
```typescript
// Iterate over children directly, skip the variant node
const domElements: DOMElement[] = [];
if (variantNode.children) {
  variantNode.children.forEach((child) => {
    domElements.push(...collectElementNames(child, false, 1));
  });
}
// Now only one root (manually added)
variant.childElementsHierarchy = [variantRoot, ...domElements];
```

**Result**:
```
After:
├─ sentiment-neutral-interaction-default (depth 0) ← Clean!
├─ left-list-item-slot (depth 1)
```

### Fix 2: Incorrect Depth Calculation

**Problem**: All elements at same depth level

```
Before (with depth adjustment):
├─ sentiment-neutral-interaction-default (depth 0)
├─ left-list-item-slot (depth 0) ← Wrong!
├─ acorn (depth 1) ← Should be 2
├─ vector (depth 2) ← Should be 3
```

**Cause**:
```typescript
// Over-compensating depth calculation
const elementDepth = depth > 0 ? depth - 1 : 0;
```

**Fix**:
```typescript
// Use depth directly
const elementDepth = depth;
```

**Result**:
```
After:
├─ sentiment-neutral-interaction-default (depth 0)
  ├─ left-list-item-slot (depth 1) ← Correct!
    ├─ acorn (depth 2) ← Correct!
      ├─ vector (depth 3) ← Correct!
```

### Fix 3: Name Normalization Mismatch

**Problem**: Some DOM elements not matching classes

```
Before:
RAW: "PhosphorIcons/Check" → normalized to "phosphoricons/check"
Tailwind: "phosphoricons-check"
Result: No match, element shows 0 classes
```

**Cause**:
```typescript
// Old regex only replaced slashes
.replace(/\//g, '-')
```

**Fix**:
```typescript
// New regex replaces dots, slashes, AND spaces
.replace(/[./\s]+/g, '-')
```

**Result**:
```
After:
RAW: "PhosphorIcons/Check" → "phosphoricons-check"
Tailwind: "phosphoricons-check"
Result: Match! Element shows correct classes
```

### Fix 4: Scrollbar and UI Issues

**Problem**: Horizontal scrollbar, overlapping counters, jumping height

**Fixes**:
1. **Horizontal scrollbar**: `overflow-x: hidden` on sidebar
2. **Overlapping counters**: `padding-right` on list, `margin-left` on counters
3. **Jumping height**: Restored `height: 600px` with `max-height: 90vh`

**Result**: Stable, clean UI with proper text truncation

---

## Usage Examples

### Example 1: Simple Component

```typescript
// Input: Button with two variants
{
  variants: [
    {
      variantName: "sentiment=brand",
      elementName: "sentiment-brand",
      variantClasses: ["bg-fill-accent", "text-foreground-on-accent"],
      childElements: {
        "label": ["font-sans", "text-sm", "text-left"]
      },
      childElementsHierarchy: [
        { name: "sentiment-brand", depth: 0 },
        { name: "label", depth: 1 }
      ]
    },
    {
      variantName: "sentiment=neutral",
      elementName: "sentiment-neutral",
      variantClasses: ["bg-fill-neutral", "text-foreground-default"],
      childElements: {
        "label": ["font-sans", "text-sm", "text-left"]
      },
      childElementsHierarchy: [
        { name: "sentiment-neutral", depth: 0 },
        { name: "label", depth: 1 }
      ]
    }
  ],
  classToDOMMap: {
    "bg-fill-accent": Set(["sentiment-brand"]),
    "text-foreground-on-accent": Set(["sentiment-brand"]),
    "bg-fill-neutral": Set(["sentiment-neutral"]),
    "text-foreground-default": Set(["sentiment-neutral"]),
    "font-sans": Set(["label"]),
    "text-sm": Set(["label"]),
    "text-left": Set(["label"])
  },
  allChildElements: [
    { name: "sentiment-brand", depth: 0 },
    { name: "label", depth: 1 },
    { name: "sentiment-neutral", depth: 0 },
    { name: "label", depth: 1 }
  ]
}
```

**User Actions**:
1. Select "All Variants" → Shows both roots and label
2. Select "sentiment=brand" → Shows only brand root and its label
3. Select "label" → Shows only label's 3 classes

### Example 2: Complex Nested Component

```typescript
// Input: List item with deep nesting
{
  variants: [{
    variantName: "sentiment=neutral, interaction=default",
    elementName: "sentiment-neutral-interaction-default-height-h-28",
    variantClasses: ["w-full", "flex", "flex-row", "p-1", "gap-1-5"],
    childElements: {
      "left-list-item-slot": ["w-4", "h-4", "flex", "justify-center"],
      "acorn": ["flex-1", "flex-col", "items-start"],
      "vector": ["w-[13px]", "h-[15px]", "text-foreground-neutral"],
      "label": ["flex-1", "font-sans", "text-sm", "text-left"]
    },
    childElementsHierarchy: [
      { name: "sentiment-neutral-interaction-default-height-h-28", depth: 0 },
      { name: "left-list-item-slot", depth: 1 },
      { name: "acorn", depth: 2 },
      { name: "vector", depth: 3 },
      { name: "label", depth: 1 }
    ]
  }],
  classToDOMMap: {
    "w-full": Set(["sentiment-neutral-interaction-default-height-h-28"]),
    "flex": Set(["sentiment-neutral-interaction-default-height-h-28", "left-list-item-slot"]),
    "w-4": Set(["left-list-item-slot"]),
    "flex-1": Set(["acorn", "label"]),
    "w-[13px]": Set(["vector"]),
    // ... etc
  }
}
```

**UI Display**:
```
DOM Elements:
└─ All Elements (42)
└─ sentiment-neutral-interaction-default-height-h-28 (5)  [root]
   └ left-list-item-slot (4)                              [indented 12px]
      └ acorn (3)                                          [indented 24px]
         └ vector (3)                                      [indented 36px]
   └ label (4)                                             [indented 12px]
```

**User Actions**:
1. Click "acorn" → Shows 3 classes: `flex-1`, `flex-col`, `items-start`
2. Click "vector" → Shows 3 classes: `w-[13px]`, `h-[15px]`, `text-foreground-neutral`
3. Click root → Shows 5 classes: `w-full`, `flex`, `flex-row`, `p-1`, `gap-1-5`

---

## Troubleshooting

### Issue: DOM Elements Show 0 Classes

**Symptoms**: Element appears in sidebar but class count is 0

**Possible Causes**:
1. **Name normalization mismatch**: RAW and Tailwind names don't match
2. **Missing element in Tailwind**: Element exists in RAW but not rendered in HTML
3. **Parsing error**: Regex didn't capture className attribute

**Debug Steps**:
```typescript
// 1. Check normalization
console.log('RAW name:', node.name);
console.log('Normalized:', node.name.toLowerCase().replace(/[./\s]+/g, '-'));

// 2. Check Tailwind output
console.log('Tailwind HTML:', extractorResult.tailwind.stylesheet);

// 3. Check classToDOMMap
console.log('Mapped elements:', Array.from(classToDOMMap.keys()));
```

**Solutions**:
- Update normalization regex to handle special characters
- Check if element is actually rendered in Tailwind output
- Verify className attribute format in HTML

### Issue: Duplicate Elements in List

**Symptoms**: Same element appears multiple times

**Possible Causes**:
1. **Not iterating children directly**: Calling collectElementNames on parent node
2. **Multiple variants with same element**: Normal for "All Variants" view

**Debug Steps**:
```typescript
// Check if duplicates are from different variants
console.log('All elements:', allChildElements.map(e => ({
  name: e.name,
  depth: e.depth
})));
```

**Solutions**:
- If same depth: Fix by iterating children directly (see Fix #1)
- If different depths within same variant: Bug in depth calculation
- If from different variants: Expected behavior for "All Variants"

### Issue: Incorrect Hierarchy/Depth

**Symptoms**: All elements at same depth, or wrong nesting

**Possible Causes**:
1. **Depth calculation error**: Math in collectElementNames wrong
2. **Starting depth incorrect**: Should start at 1 for children

**Debug Steps**:
```typescript
// Add logging to collectElementNames
console.log(`Collecting ${node.name} at depth ${depth}`);
```

**Solutions**:
- Use `depth` directly without adjustment
- Start children at depth 1 when root is depth 0
- Ensure recursive calls increment depth correctly

### Issue: Classes Not Filtering by Element

**Symptoms**: Selecting element doesn't filter classes

**Possible Causes**:
1. **classToDOMMap not populated**: Parsing failed
2. **selectedDOMElement value wrong**: Not matching map keys
3. **Filtering logic bug**: Conditions incorrect

**Debug Steps**:
```typescript
// Check map contents
console.log('classToDOMMap:', classToDOMMap);
console.log('selectedDOMElement:', selectedDOMElement);
console.log('Map has element:', classToDOMMap.get('flex')?.has(selectedDOMElement));
```

**Solutions**:
- Verify map is populated during parsing
- Check selectedDOMElement matches normalized names
- Review filtering logic in filteredClasses useMemo

---

## Conclusion

The DOM-to-Classes mapping system is a critical component that:

1. **Combines two data sources** (RAW structure + Tailwind classes)
2. **Maintains hierarchy** with depth tracking
3. **Enables precise filtering** by variant and element
4. **Scales to complex components** with deep nesting
5. **Provides visual context** with indentation and tree indicators

By using RAW JSON as the single source of truth for structure and Tailwind HTML for classes, the system achieves both **reliability** and **completeness**.

