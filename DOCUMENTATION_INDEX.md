# Documentation Index

Complete guide to navigating the Figma Design-to-Code Plugin documentation.

## Quick Start

**New to the plugin?** Start here:
1. **[README.md](./README.md)** - Overview, features, installation, and usage
2. **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** - System architecture and how everything fits together

**Want to use the plugin?** See:
- **[README.md - Usage Instructions](./README.md#usage-instructions)** - How to install and use the plugin
- **[README.md - What It Extracts](./README.md#what-it-extracts)** - What data the plugin extracts

**Want to understand the tools?** See:
- **[EXTRACTOR_DOCUMENTATION.md](./EXTRACTOR_DOCUMENTATION.md)** - DOM Extractor Tool
- **[CVA_MAPPING.md](./CVA_MAPPING.md)** - CVA Mapping Tool

---

## Documentation by Topic

### System Architecture & Design

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** | Complete system architecture, data flow, transformations | Understanding overall system, design decisions, component relationships |
| **[README.md - Technical Details](./README.md#technical-details)** | Supported node types, variable mappings, limitations | Quick reference for supported features |

### Tool Usage & Features

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[README.md](./README.md)** | Plugin overview, features, installation, basic usage | First time using the plugin |
| **[README.md - DOM Extractor](./README.md#dom-extractor)** | Extractor features and capabilities | Using the extraction tool |
| **[README.md - CVA Mapping Tool](./README.md#cva-mapping-tool)** | CVA tool features and workflow | Generating CVA code from components |

### Technical Implementation

#### DOM Extractor Tool

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[EXTRACTOR_DOCUMENTATION.md](./EXTRACTOR_DOCUMENTATION.md)** | Complete extractor technical docs | Extending the extractor, debugging extraction issues |
| **[EXTRACTOR_DOCUMENTATION.md - Extraction Pipeline](./EXTRACTOR_DOCUMENTATION.md#extraction-pipeline)** | Step-by-step extraction process | Understanding how extraction works |
| **[EXTRACTOR_DOCUMENTATION.md - Style Extraction](./EXTRACTOR_DOCUMENTATION.md#style-extraction)** | Style extraction and variable resolution | Debugging style or variable issues |
| **[EXTRACTOR_DOCUMENTATION.md - Output Formats](./EXTRACTOR_DOCUMENTATION.md#output-formats)** | CSS, Tailwind, and Raw JSON outputs | Understanding output formats |

#### CVA Mapping Tool

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[CVA_MAPPING.md](./CVA_MAPPING.md)** | Complete CVA tool technical docs | Extending the CVA tool, debugging mapping issues |
| **[CVA_MAPPING.md - Property Extraction](./CVA_MAPPING.md#property-extraction)** | How properties are detected | Understanding auto-detection of variants |
| **[CVA_MAPPING.md - Class Categorization](./CVA_MAPPING.md#class-categorization-rules)** | How classes are categorized | Adding new categories, debugging categorization |
| **[CVA_MAPPING.md - Variant Name Filtering](./CVA_MAPPING.md#variant-name-filtering)** | Figma variant name detection | Understanding why certain classes are filtered |

### Mapping & Transformation Systems

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md)** | Complete CSS-to-Tailwind remapping rules | Understanding Tailwind class generation, debugging class output |
| **[CSS_TO_TAILWIND_MAPPING.md - Spacing](./CSS_TO_TAILWIND_MAPPING.md#1-spacing-properties-padding-gap-width-height)** | Spacing property remapping | Padding, gap, width, height conversion |
| **[CSS_TO_TAILWIND_MAPPING.md - Typography](./CSS_TO_TAILWIND_MAPPING.md#2-typography-properties)** | Typography property remapping | Font size, weight, family conversion |
| **[CSS_TO_TAILWIND_MAPPING.md - Colors](./CSS_TO_TAILWIND_MAPPING.md#3-color-properties-fills--strokes)** | Color property remapping | Background, text, border color conversion |
| **[DOM_TO_CLASSES_MAPPING.md](./DOM_TO_CLASSES_MAPPING.md)** | DOM-to-Classes association system | Understanding class filtering, debugging modal issues |
| **[DOM_TO_CLASSES_MAPPING.md - Two-Pass Extraction](./DOM_TO_CLASSES_MAPPING.md#two-pass-extraction-strategy)** | Extraction strategy | Understanding how DOM and classes are combined |
| **[DOM_TO_CLASSES_MAPPING.md - Recent Fixes](./DOM_TO_CLASSES_MAPPING.md#recent-fixes)** | Recent bug fixes | Understanding recent improvements |

### Development & Maintenance

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** | Project refactoring history | Understanding code evolution |
| **[README.md - Development](./README.md#development)** | Project structure, build commands | Setting up development environment |
| **[README.md - Key Files](./README.md#key-files)** | Important files and their purposes | Finding specific code files |

---

## Documentation by Use Case

### "I want to understand how the plugin works"

1. Start with **[README.md](./README.md)** for overview
2. Read **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** for system architecture
3. Dive into specific tool docs as needed:
   - **[EXTRACTOR_DOCUMENTATION.md](./EXTRACTOR_DOCUMENTATION.md)** for extraction
   - **[CVA_MAPPING.md](./CVA_MAPPING.md)** for CVA mapping

### "I want to extract code from my Figma component"

1. **[README.md - Installation](./README.md#installation)** - Install the plugin
2. **[README.md - Using the Plugin](./README.md#using-the-plugin)** - Extract your component
3. **[README.md - Output Format](./README.md#output-format)** - Understand the output
4. **[CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md)** - If using Tailwind format

### "I want to generate CVA code"

1. **[README.md - CVA Mapping Tool](./README.md#cva-mapping-tool)** - Feature overview
2. **[CVA_MAPPING.md](./CVA_MAPPING.md)** - Complete CVA documentation
3. **[CVA_MAPPING.md - How It Works](./CVA_MAPPING.md#how-it-works)** - Understand the workflow
4. **[DOM_TO_CLASSES_MAPPING.md](./DOM_TO_CLASSES_MAPPING.md)** - If filtering classes by element

### "I want to extend the plugin"

#### Add New Style Property to Extractor
1. **[EXTRACTOR_DOCUMENTATION.md - Extending the Extractor](./EXTRACTOR_DOCUMENTATION.md#extending-the-extractor)**
2. **[EXTRACTOR_DOCUMENTATION.md - Adding New Style Properties](./EXTRACTOR_DOCUMENTATION.md#adding-new-style-properties)**
3. **[CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md)** - Add Tailwind conversion

#### Add New Class Category to CVA Tool
1. **[CVA_MAPPING.md - Extending the Tool](./CVA_MAPPING.md#extending-the-tool)**
2. **[CVA_MAPPING.md - Adding New Class Categories](./CVA_MAPPING.md#adding-new-class-categories)**

#### Add New Output Format
1. **[EXTRACTOR_DOCUMENTATION.md - Adding New Output Formats](./EXTRACTOR_DOCUMENTATION.md#adding-new-output-formats)**
2. **[ARCHITECTURE_ANALYSIS.md - Data Flow](./ARCHITECTURE_ANALYSIS.md#data-flow--transformations)**

### "I'm debugging an issue"

#### Classes Not Extracting Correctly
1. **[EXTRACTOR_DOCUMENTATION.md - Debugging Tips](./EXTRACTOR_DOCUMENTATION.md#debugging-tips)**
2. **[CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md)** - Check remapping rules
3. **[ARCHITECTURE_ANALYSIS.md - Tailwind Generation](./ARCHITECTURE_ANALYSIS.md#5-tailwind-generation-extractedstyles--tailwind-classes)**

#### Variables Not Resolving
1. **[EXTRACTOR_DOCUMENTATION.md - Variables Not Resolving](./EXTRACTOR_DOCUMENTATION.md#variables-not-resolving)**
2. **[EXTRACTOR_DOCUMENTATION.md - Variable Resolution](./EXTRACTOR_DOCUMENTATION.md#variable-resolution)**
3. **[ARCHITECTURE_ANALYSIS.md - Variable Resolution Process](./ARCHITECTURE_ANALYSIS.md#3-variable-resolution-process)**

#### CVA Properties Not Detecting
1. **[CVA_MAPPING.md - Debugging Tips](./CVA_MAPPING.md#debugging-tips)**
2. **[CVA_MAPPING.md - Property Extraction](./CVA_MAPPING.md#property-extraction)**
3. **[ARCHITECTURE_ANALYSIS.md - Property Detection](./ARCHITECTURE_ANALYSIS.md#3-property-detection)**

#### DOM Elements Not Appearing or Wrong Hierarchy
1. **[DOM_TO_CLASSES_MAPPING.md - Troubleshooting](./DOM_TO_CLASSES_MAPPING.md#troubleshooting)**
2. **[DOM_TO_CLASSES_MAPPING.md - Recent Fixes](./DOM_TO_CLASSES_MAPPING.md#recent-fixes)**
3. **[ARCHITECTURE_ANALYSIS.md - Recent Improvements](./ARCHITECTURE_ANALYSIS.md#recent-improvements)**

#### Classes Not Filtering by Element
1. **[DOM_TO_CLASSES_MAPPING.md - Troubleshooting](./DOM_TO_CLASSES_MAPPING.md#troubleshooting)**
2. **[DOM_TO_CLASSES_MAPPING.md - Filter Classes by Selection](./DOM_TO_CLASSES_MAPPING.md#5-filter-classes-by-selection)**

---

## Documentation Structure

```
Root Documentation
├── README.md (Start here!)
│   ├── Overview
│   ├── Features
│   ├── Installation
│   ├── Usage
│   └── Technical Details
│
├── ARCHITECTURE_ANALYSIS.md (System-wide)
│   ├── System Overview
│   ├── DOM Extractor Tool
│   ├── CVA Mapping Tool
│   ├── Data Flow & Transformations
│   ├── Key Architectural Decisions
│   └── Recent Improvements
│
├── Tool Documentation
│   ├── EXTRACTOR_DOCUMENTATION.md
│   │   ├── Architecture
│   │   ├── Extraction Pipeline
│   │   ├── Style Extraction
│   │   ├── Variable Resolution
│   │   ├── Output Formats
│   │   └── Extending the Extractor
│   │
│   └── CVA_MAPPING.md
│       ├── How It Works
│       ├── Class Categorization
│       ├── Property Extraction
│       ├── Variant Name Filtering
│       ├── DOM Element Extraction
│       └── CVA Code Generation
│
├── Mapping & Transformation Documentation
│   ├── CSS_TO_TAILWIND_MAPPING.md
│   │   ├── Core Conversion Functions
│   │   ├── Spacing Properties
│   │   ├── Typography Properties
│   │   ├── Color Properties
│   │   ├── Layout Properties
│   │   └── Effects
│   │
│   └── DOM_TO_CLASSES_MAPPING.md
│       ├── The Challenge
│       ├── Solution Architecture
│       ├── Implementation Details
│       ├── Algorithms
│       ├── Recent Fixes
│       └── Troubleshooting
│
└── Development History
    ├── DOCUMENTATION_UPDATE_SUMMARY.md  # Latest documentation update
    └── REFACTORING_SUMMARY.md           # Historical milestones
```

---

## Documentation Conventions

### File Types

- **README.md**: User-facing overview and quick start
- **ARCHITECTURE_ANALYSIS.md**: System-wide architecture and design decisions
- **[TOOL]_DOCUMENTATION.md**: Complete technical docs for specific tools
- **[TOPIC]_MAPPING.md**: Detailed mapping/transformation system docs
- **[TOPIC]_SUMMARY.md**: Historical summaries and changelog

### Code Examples

- TypeScript interfaces show data structures
- Code snippets show implementation patterns
- Example outputs show expected results

### Cross-References

- Documents link to related documentation
- Sections reference specific subsections
- "See [Document](./file.md)" for external references

---

## Keeping Documentation Up to Date

### When Making Code Changes

1. **Update relevant technical documentation**
   - EXTRACTOR_DOCUMENTATION.md for extractor changes
   - CVA_MAPPING.md for CVA tool changes
   - CSS_TO_TAILWIND_MAPPING.md for remapping changes
   - DOM_TO_CLASSES_MAPPING.md for DOM mapping changes

2. **Update ARCHITECTURE_ANALYSIS.md if:**
   - Adding new data transformation pipeline
   - Changing data flow between components
   - Making architectural decisions

3. **Update README.md if:**
   - Adding new features
   - Changing usage instructions
   - Adding/removing limitations

4. **Add to REFACTORING_SUMMARY.md if:**
   - Making significant refactoring
   - Improving code structure
   - Enhancing documentation

### Documentation Quality Checklist

- [ ] Code examples are tested and working
- [ ] Cross-references are accurate
- [ ] Table of contents is up to date
- [ ] Data structures match current implementation
- [ ] Diagrams reflect current architecture
- [ ] Troubleshooting section includes recent issues
- [ ] Related documents are linked

---

## Contributing to Documentation

### Writing Guidelines

1. **Be Specific**: Use concrete examples and actual code
2. **Be Complete**: Cover edge cases and special scenarios
3. **Be Accurate**: Test examples and verify technical details
4. **Be Clear**: Use diagrams, tables, and structured formatting
5. **Be Helpful**: Include troubleshooting and debugging sections

### Documentation Standards

- Use Markdown formatting consistently
- Include code syntax highlighting (```typescript, ```json, etc.)
- Add tables for comparison data
- Use diagrams for complex flows
- Provide before/after examples for fixes

---

## Additional Resources

### External Documentation

- [Figma Plugin API](https://www.figma.com/plugin-docs/)
- [Figma Variables Guide](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Class Variance Authority (CVA)](https://cva.style/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### Getting Help

1. **Check documentation** using this index
2. **Review troubleshooting sections** in relevant docs
3. **Check recent fixes** in ARCHITECTURE_ANALYSIS.md or DOM_TO_CLASSES_MAPPING.md
4. **Review code comments** in implementation files

---

## Document Relationships

```
DOCUMENTATION_INDEX.md (you are here)
        │
        ├─► README.md
        │   ├─► ARCHITECTURE_ANALYSIS.md
        │   ├─► EXTRACTOR_DOCUMENTATION.md
        │   ├─► CVA_MAPPING.md
        │   ├─► CSS_TO_TAILWIND_MAPPING.md
        │   └─► REFACTORING_SUMMARY.md
        │
        ├─► ARCHITECTURE_ANALYSIS.md
        │   ├─► EXTRACTOR_DOCUMENTATION.md
        │   ├─► CVA_MAPPING.md
        │   ├─► CSS_TO_TAILWIND_MAPPING.md
        │   └─► DOM_TO_CLASSES_MAPPING.md
        │
        ├─► EXTRACTOR_DOCUMENTATION.md
        │   ├─► CSS_TO_TAILWIND_MAPPING.md
        │   └─► ARCHITECTURE_ANALYSIS.md
        │
        ├─► CVA_MAPPING.md
        │   └─► DOM_TO_CLASSES_MAPPING.md
        │
        ├─► CSS_TO_TAILWIND_MAPPING.md
        │
        ├─► DOM_TO_CLASSES_MAPPING.md
        │   └─► ARCHITECTURE_ANALYSIS.md
        │
        └─► REFACTORING_SUMMARY.md
```

---

## Quick Reference Cards

### Extractor Tool

| Feature | Documentation |
|---------|---------------|
| Node traversal | [EXTRACTOR_DOCUMENTATION.md - Component Traversal](./EXTRACTOR_DOCUMENTATION.md#component-traversal) |
| Style extraction | [EXTRACTOR_DOCUMENTATION.md - Style Extraction](./EXTRACTOR_DOCUMENTATION.md#style-extraction) |
| Variable resolution | [EXTRACTOR_DOCUMENTATION.md - Variable Resolution](./EXTRACTOR_DOCUMENTATION.md#variable-resolution) |
| CSS output | [EXTRACTOR_DOCUMENTATION.md - CSS Format](./EXTRACTOR_DOCUMENTATION.md#css-format-domgeneratorts) |
| Tailwind output | [EXTRACTOR_DOCUMENTATION.md - Tailwind Format](./EXTRACTOR_DOCUMENTATION.md#tailwind-format-tailwinddommeneratorts--tailwindgeneratorts) |
| CSS→Tailwind remapping | [CSS_TO_TAILWIND_MAPPING.md](./CSS_TO_TAILWIND_MAPPING.md) |

### CVA Tool

| Feature | Documentation |
|---------|---------------|
| Class extraction | [CVA_MAPPING.md - How It Works](./CVA_MAPPING.md#how-it-works) |
| Class categorization | [CVA_MAPPING.md - Class Categorization](./CVA_MAPPING.md#class-categorization-rules) |
| Property detection | [CVA_MAPPING.md - Property Extraction](./CVA_MAPPING.md#property-extraction) |
| Variant filtering | [CVA_MAPPING.md - Variant Name Filtering](./CVA_MAPPING.md#variant-name-filtering) |
| DOM mapping | [DOM_TO_CLASSES_MAPPING.md](./DOM_TO_CLASSES_MAPPING.md) |
| Code generation | [CVA_MAPPING.md - CVA Code Generation](./CVA_MAPPING.md#cva-code-generation) |

---

**Last Updated**: 2024  
**Maintained By**: Plugin Development Team

