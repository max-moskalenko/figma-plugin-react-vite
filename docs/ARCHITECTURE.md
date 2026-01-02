# Architecture

System architecture and design decisions for the Figma Design-to-Code Plugin.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Key Subsystems](#key-subsystems)
4. [Design Decisions](#design-decisions)
5. [Performance Considerations](#performance-considerations)

---

## System Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph FigmaApp [Figma Application]
        API[Figma Plugin API]
        Canvas[Design Canvas]
    end
    
    subgraph PluginSandbox [Plugin Sandbox]
        Plugin[Plugin Code]
        Traverser[Component Traverser]
        Extractor[Style Extractor]
        Generators[Generators]
    end
    
    subgraph UIFrame [UI iframe]
        React[React App]
        CVA[CVA Tool]
        Output[Output Display]
    end
    
    Canvas --> API
    API --> Plugin
    Plugin --> Traverser
    Traverser --> Extractor
    Extractor --> Generators
    Generators --> |postMessage| React
    React --> CVA
    React --> Output
```

### Plugin-UI Split

The plugin runs in two separate JavaScript contexts:

| Context | Environment | Access | Purpose |
|---------|-------------|--------|---------|
| Plugin | Figma Sandbox | `figma` API, No DOM | Extract design data |
| UI | Browser iframe | DOM, React | User interface |

Communication happens via `postMessage`:

```mermaid
sequenceDiagram
    participant User
    participant UI as UI (React)
    participant Plugin as Plugin (Sandbox)
    participant Figma as Figma API
    
    User->>UI: Click "Get code"
    UI->>Plugin: sendMessage("extractComponent")
    Plugin->>Figma: Access selection
    Figma-->>Plugin: SceneNode[]
    Plugin->>Plugin: Traverse & Extract
    Plugin->>Plugin: Generate outputs
    Plugin-->>UI: MultiFormatExtractionResult
    UI->>User: Display output
```

### Communication Layer

Uses `monorepo-networker` for type-safe messaging:

```typescript
// Define channels
const PLUGIN = NetworkSide.create<PluginMessages, UIMessages>("plugin");
const UI = NetworkSide.create<UIMessages, PluginMessages>("ui");

// Type-safe message handlers
PLUGIN_CHANNEL.registerMessageHandler("extractComponent", async (params) => {
  // TypeScript knows params type and return type
  return result;
});
```

---

## Data Flow

### End-to-End Extraction Flow

```mermaid
flowchart LR
    subgraph Input
        Selection[Figma Selection]
    end
    
    subgraph Traversal
        Traverse[traverseComponent]
        Tree[ExtractedNode Tree]
    end
    
    subgraph Extraction
        Styles[extractStyles]
        Variables[resolveVariables]
    end
    
    subgraph Generation
        CSS[cssGenerator]
        TW[tailwindGenerator]
        DOM[domGenerator]
        TWDOM[tailwindDomGenerator]
        RAW[rawJsonGenerator]
        ClassMap[buildClassToDOMMap]
    end
    
    subgraph Output
        Result[MultiFormatExtractionResult]
    end
    
    Selection --> Traverse
    Traverse --> Tree
    Tree --> Styles
    Styles --> Variables
    Variables --> CSS
    Variables --> TW
    CSS --> DOM
    TW --> TWDOM
    TW --> ClassMap
    Variables --> RAW
    DOM --> Result
    TWDOM --> Result
    RAW --> Result
    ClassMap --> Result
```

### Variable Resolution Flow

```mermaid
flowchart TD
    Node[Figma Node] --> BV{Has boundVariables?}
    BV -->|Yes| Resolve[Resolve Variable ID]
    BV -->|No| RawValue[Use Raw Value]
    
    Resolve --> Collection[Get Variable Collection]
    Collection --> Value[Get Variable Value]
    Value --> Name[Extract Variable Name]
    
    Name --> Output{Output Format}
    RawValue --> Output
    
    Output -->|CSS| CSSVar["var(--variable-name)"]
    Output -->|Tailwind| TWClass[semantic-class-name]
    Output -->|RAW| JSONVar[variable field in JSON]
```

### CVA Mapping Flow

```mermaid
flowchart TD
    subgraph Extraction
        TW[Tailwind HTML]
        RAW[RAW JSON]
        Map[classToDOMMap]
    end
    
    subgraph Parsing
        Parse[Parse HTML]
        BuildHierarchy[Build DOM Hierarchy]
        ExtractClasses[Extract Classes]
    end
    
    subgraph UI
        Modal[Class Selection Modal]
        Variants[Variant Cards]
        Config[CVA Config]
    end
    
    subgraph Output
        Code[Generated CVA Code]
    end
    
    TW --> Parse
    RAW --> BuildHierarchy
    Map --> ExtractClasses
    
    Parse --> Modal
    BuildHierarchy --> Modal
    ExtractClasses --> Modal
    
    Modal --> Variants
    Variants --> Config
    Config --> Code
```

---

## Key Subsystems

### Component Traversal

`src/plugin/extractors/componentTraverser.ts`

```mermaid
graph TD
    Root[Root Node] --> Check{Has Children?}
    Check -->|Yes| Iterate[For each child]
    Check -->|No| Return[Return ExtractedNode]
    
    Iterate --> Recurse[traverseComponent]
    Recurse --> Check
    
    subgraph ExtractedNode
        ID[id]
        Name[name]
        Type[type]
        SetName[componentSetName]
        Children[children array]
    end
```

**Responsibilities:**
- Build tree structure from Figma nodes
- Detect icon components
- Extract annotations
- Capture component set names for variants

### Style Extraction

`src/plugin/extractors/styleExtractor.ts`

```mermaid
graph TD
    Node[SceneNode] --> Props{Property Type}
    
    Props -->|Fills| ExtractFills[extractFills]
    Props -->|Strokes| ExtractStrokes[extractStrokes]
    Props -->|Effects| ExtractEffects[extractEffects]
    Props -->|Typography| ExtractTypo[extractTypography]
    Props -->|Layout| ExtractLayout[extractLayout]
    
    ExtractFills --> Resolve1[Resolve Variables]
    ExtractStrokes --> Resolve2[Resolve Variables]
    ExtractEffects --> Resolve3[Resolve Effect Styles]
    ExtractTypo --> Resolve4[Resolve Variables]
    ExtractLayout --> Resolve5[Resolve Variables]
    
    Resolve1 --> Styles[ExtractedStyles]
    Resolve2 --> Styles
    Resolve3 --> Styles
    Resolve4 --> Styles
    Resolve5 --> Styles
```

**Variable Resolution Strategy:**
1. Check `node.boundVariables[property]`
2. Handle array bindings (typography)
3. Handle per-side bindings (corners, strokes)
4. Resolve via `figma.variables.getVariableByIdAsync()`

### CSS/Tailwind Generation

```mermaid
graph LR
    subgraph Input
        ES[ExtractedStyles]
    end
    
    subgraph CSSGen [CSS Generator]
        FillsCSS[fillsToCSS]
        StrokesCSS[strokesToCSS]
        TypoCSS[typographyToCSS]
        LayoutCSS[layoutToCSS]
        EffectsCSS[effectsToCSS]
    end
    
    subgraph TWGen [Tailwind Generator]
        FillsTW[fillsToTailwind]
        StrokesTW[strokesToTailwind]
        TypoTW[typographyToTailwind]
        LayoutTW[layoutToTailwind]
        EffectsTW[effectsToTailwind]
    end
    
    ES --> FillsCSS
    ES --> StrokesCSS
    ES --> TypoCSS
    ES --> LayoutCSS
    ES --> EffectsCSS
    
    ES --> FillsTW
    ES --> StrokesTW
    ES --> TypoTW
    ES --> LayoutTW
    ES --> EffectsTW
    
    FillsCSS --> CSSProps["background-color: var(...)]"]
    FillsTW --> TWClasses["bg-fill-primary"]
```

### DOM Generation

```mermaid
graph TD
    Node[ExtractedNode] --> Tag[Determine Tag Name]
    Tag --> Attrs[Generate Attributes]
    Attrs --> Content[Add Content/Children]
    Content --> HTML[HTML String]
    
    subgraph TagName [Tag Name Logic]
        Name[node.name]
        SetName[componentSetName]
        Sanitize[sanitizeTagName]
    end
    
    Tag --> SetName
    SetName -->|exists| UseSet[Use Component Set Name]
    SetName -->|null| UseName[Use Node Name]
    UseSet --> Sanitize
    UseName --> Sanitize
```

---

## Design Decisions

### RAW JSON as Single Source of Truth

**Decision:** Use RAW JSON data for DOM-to-class mapping in CVA tool.

**Rationale:**
- HTML output may be transformed (e.g., icon components)
- RAW preserves original Figma structure
- Consistent across all output formats
- Easier to maintain single mapping source

**Implementation:**
```typescript
// Plugin builds map from RAW data
const classToDOMMap = buildClassToDOMMap(extractedNodes, variables);

// UI uses map for filtering
const elementClasses = classToDOMMap[className] || [];
```

### Separate CSS and Tailwind Generators

**Decision:** Maintain separate generation pipelines for CSS and Tailwind.

**Rationale:**
- Different output requirements (properties vs classes)
- Different variable handling strategies
- Easier to extend independently
- Clearer code organization

**Trade-off:** Some duplication, but better maintainability.

### Component Set Name for Variant Tags

**Decision:** Use parent component set name as tag for variant components.

**Problem:**
```jsx
// Without: variant properties become unusable tags
<typecheckboxstatedefault className="...">

// With: parent name is used
<Checkbox className="...">
```

**Implementation:**
```typescript
// In traverser
if (node.type === "COMPONENT" && node.parent?.type === "COMPONENT_SET") {
  extracted.componentSetName = node.parent.name;
}

// In DOM generator
const tag = sanitizeTagName(node.name, node.componentSetName);
```

### Dot Preservation in Tailwind Output

**Decision:** Preserve dots in tag names for Tailwind/React, remove for CSS/HTML.

**Rationale:**
- React supports namespaced components (`<Icon.Close>`)
- HTML doesn't support dots in tag names
- Different target environments need different handling

**Implementation:**
```typescript
// Tailwind (React)
sanitizeForReact("Icon.Close") // → "Icon.Close"

// CSS (HTML)  
sanitizeForHTML("Icon.Close")  // → "IconClose"
```

### Zero-Value Filtering

**Decision:** Filter zero-value properties by default with opt-out.

**Rationale:**
- `rounded-[0px]`, `p-0` have no visual effect
- Reduces output clutter
- User can disable via "Skip Zeros" setting

**Filtered Patterns:**
- `rounded-[0px]`, `rounded-0`
- `p-0`, `m-0`, `gap-0`
- `border-0`

---

## Performance Considerations

### Memoization Strategy

**React UI:**
```typescript
// Expensive computations memoized
const categorizedClasses = useMemo(() => {
  return categorizeClasses(extractedClasses);
}, [extractedClasses]);

// Callbacks memoized to prevent re-renders
const handleToggle = useCallback((classId) => {
  toggleClass(classId);
}, [toggleClass]);
```

### Efficient Tree Traversal

**Plugin Side:**
```typescript
// Single pass traversal
async function traverseComponent(node: SceneNode): Promise<ExtractedNode> {
  // Extract node data
  const extracted = { id: node.id, name: node.name, ... };
  
  // Recursively process children
  if ("children" in node) {
    extracted.children = await Promise.all(
      node.children.map(child => traverseComponent(child))
    );
  }
  
  return extracted;
}
```

### Variable Collection Caching

```typescript
// Variables fetched once per extraction
const variables = await getAllVariables();

// Passed to all extraction functions
extractStyles(node, variables);
```

### Class-to-DOM Map Pre-computation

```typescript
// Built once in plugin
const classToDOMMap = buildClassToDOMMap(nodes, variables);

// Sent to UI with extraction result
return { ...result, classToDOMMap };

// UI uses map directly (no re-computation)
const elements = classToDOMMap[className];
```

---

## Related Documentation

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development setup and extending
- [API_REFERENCE.md](./API_REFERENCE.md) - Function and interface reference
- [USER_GUIDE.md](./USER_GUIDE.md) - End user documentation

