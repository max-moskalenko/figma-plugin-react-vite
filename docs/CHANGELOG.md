# Changelog

All notable changes to the Figma Design-to-Code Plugin.

---

## [1.2.0] - 2025-01-02

### Added

- **Semantic Tag Names**: Figma layer names now become HTML/JSX tag names instead of generic `<div>` elements
  - Example: `<Button>`, `<CardHeader>`, `<Icon.Close>`
  
- **Dot Preservation in Tailwind**: Dots in layer names are preserved in Tailwind output for React component namespacing
  - `Icon.Close` → `<Icon.Close>` in Tailwind/React
  - `Icon.Close` → `<IconClose>` in CSS/HTML
  
- **Component Set Name for Variants**: Variant root elements use parent component set name as tag
  - Before: `<typecheckboxstatedefault>` (unusable)
  - After: `<Checkbox>` (uses parent COMPONENT_SET name)
  
- **Effect Style Variables**: Shadow effects now use Figma Effect Style variables
  - Detects Effect Styles (e.g., "shadow/lg")
  - Generates: `shadow-lg` (Tailwind) or `var(--shadow-lg)` (CSS)
  
- **Min/Max Dimension Support**: Added extraction for constraint dimensions
  - `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
  - Generates: `min-w-[152px]`, `max-w-[400px]` (Tailwind)
  
- **Auto-Layout Wrap Settings**: Full support for wrapped auto-layout
  - `flex-wrap` / `flex-nowrap`
  - `gap-x-*` / `gap-y-*` for row/column gaps
  - `content-between` for wrapped content alignment
  
- **Constants Module**: Extracted magic strings into organized constants
  - `src/common/constants/figmaTypes.ts` - Figma API type constants
  - `src/common/constants/tailwindPrefixes.ts` - Tailwind class prefixes
  - `src/common/constants/variablePatterns.ts` - Variable parsing patterns

- **Shared Utilities**: Created reusable utility modules
  - `src/common/utils/elementNaming.ts` - Tag name sanitization
  - `src/common/utils/propertyFilters.ts` - Zero-value filtering

### Changed

- **Documentation Overhaul**: Complete documentation rewrite
  - New `docs/` folder structure
  - Separate guides for users and developers
  - Architecture documentation with Mermaid diagrams
  - API reference for key functions
  - Old docs archived in `docs/archive/`

- **Output Format**: Removed `data-name` and `data-type` attributes from generated HTML
  - Layer names are now tag names, making data attributes redundant

### Fixed

- **DOM Element Hierarchy**: Fixed missing root elements for standalone components and frames
  - Root wrapper element now correctly included in DOM hierarchy
  
- **Class-to-DOM Mapping**: Fixed class filtering for instances and variant sets
  - Consistent element name normalization across plugin and UI
  - Proper fallback to global classToDOMMap for instances
  
- **Multi-Select Counters**: Individual element counters no longer change when multi-select is toggled
  - Counters always show variant-specific count for each element
  
- **Zero-Value Class Filtering**: Fixed `rounded-[0px]` appearing in multi-select mode
  - Zero-value filtering now applied consistently in all modes

### Technical

- **Element Name Normalization**: Unified normalization logic across codebase
  - Same sanitization rules in plugin and UI
  - Dots preserved for React, removed for HTML

- **Effect Variable Resolution**: Properly resolves Effect Style IDs to names
  - Uses `figma.getStyleByIdAsync()` for Effect Styles
  - Falls back to individual property variables if no style found

---

## [1.1.0] - 2024

### Added

- **CVA Mapping Tool**: Visual tool for creating Class Variance Authority configurations
  - Class categorization (fill, typography, spacing, layout, effects)
  - Variant property detection from Figma component sets
  - Prefix slots (default, hover, active, focus, disabled)
  - Compound variants support
  - Type-safe TypeScript code generation

- **DOM Element Filtering**: Filter classes by DOM element in CVA tool
  - Tree view of DOM hierarchy
  - Multi-select for elements with same name
  - Class counts per element

- **Settings Panel**: User-configurable extraction options
  - Annotations toggle
  - Prettify output toggle
  - Skip zeros toggle
  - Icon export mode selection

### Changed

- **UI Split into Tools**: Separated DOM Extractor and CVA Mapping into distinct tools
  - Left navigation for tool switching
  - Persistent state across tool switches

---

## [1.0.0] - 2024

### Initial Release

- **DOM Extractor Tool**
  - Component traversal and style extraction
  - CSS output with inline styles
  - Tailwind output with utility classes
  - Raw JSON output for debugging
  
- **Variable Support**
  - Figma variable detection and resolution
  - CSS custom property generation
  - Tailwind class mapping from variables

- **Style Extraction**
  - Fills (solid colors, gradients)
  - Strokes (borders, individual sides)
  - Effects (shadows, blur)
  - Typography (font properties)
  - Layout (flexbox, sizing, spacing)

- **Component Set Support**
  - Automatic extraction of all variants
  - Variant property detection

---

## Migration Notes

### Upgrading to 1.2.0

**Breaking Changes:**
- Generated HTML no longer includes `data-name` and `data-type` attributes
- Tag names are now derived from layer names (not node types)

**Migration Steps:**
1. If you relied on `data-name` for element identification, use the tag name instead
2. Update any parsing logic that expected `<div data-name="Button">` to expect `<Button>`
3. For CSS output, dots in names become merged (e.g., `Icon.Close` → `IconClose`)

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes to output format or API
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, documentation

