# Figma Design-to-Code Plugin

A powerful Figma plugin that transforms your designs into production-ready code with intelligent variable detection and semantic output.

## What is this?

This plugin extracts complete component structures from Figma and generates:
- **Tailwind CSS** - JSX with utility classes for React/Next.js projects
- **CSS** - HTML with inline styles and CSS custom properties
- **CVA Configurations** - Type-safe [Class Variance Authority](https://cva.style/) code from component variants

The output uses **semantic tag names** from your Figma layers, making the code immediately usable in your project.

## Feature Highlights

- **Semantic Output** - Layer names become tag names (`<Button>`, `<CardHeader>`, `<Icon.Close>`)
- **Variable Detection** - Automatically uses Figma variables in output
- **Component Set Support** - Extract all variants from a component set
- **CVA Generation** - Visual tool for mapping variants to Tailwind classes
- **Effect Styles** - Shadow effects use variable references (`shadow-lg`)
- **Zero-Value Filtering** - Automatically hides useless properties

## Quick Start

### Installation

```bash
# Clone and build
git clone <repository-url>
cd figma-api
npm install
npm run build
```

### Import into Figma

1. Open any Figma design file
2. Right-click → `Plugins > Development > Import plugin from manifest...`
3. Select `dist/manifest.json`

### First Extraction

1. **Select** a component, frame, or instance in Figma
2. **Run** the plugin from the Plugins menu
3. **Click** "Get code"
4. **Copy** the generated code

### Example Output

**Figma layers:**
```
Frame: "Button"
  ├── Instance: "Icon.Check"
  └── Text: "Label"
```

**Generated (Tailwind):**
```jsx
<Button className="flex items-center px-4 py-2 bg-fill-primary rounded-lg">
  <Icon.Check className="w-4 h-4 mr-2" />
  <Label className="font-medium text-white">Submit</Label>
</Button>
```

## Documentation

| Document | Description |
|----------|-------------|
| **[User Guide](./docs/USER_GUIDE.md)** | Complete usage guide for designers and developers |
| **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** | Development setup and extending the plugin |
| **[Architecture](./docs/ARCHITECTURE.md)** | System design and technical decisions |
| **[API Reference](./docs/API_REFERENCE.md)** | Function and interface documentation |
| **[Changelog](./docs/CHANGELOG.md)** | Version history and migration notes |

## For Users

Start with the **[User Guide](./docs/USER_GUIDE.md)** which covers:
- Using the DOM Extractor tool
- Using the CVA Mapping tool
- Understanding variables
- Tips and best practices
- Frequently asked questions

## For Contributors

See the **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** for:
- Development environment setup
- Project structure
- How to extend the plugin
- Adding new features

### Quick Development Setup

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build

# Type checking
npm run types
```

### Project Structure

```
src/
├── common/           # Shared code (generators, utilities)
├── plugin/           # Figma plugin code (extraction)
└── ui/               # React UI (display, CVA tool)

docs/
├── USER_GUIDE.md     # For designers/developers using the plugin
├── DEVELOPER_GUIDE.md # For contributors
├── ARCHITECTURE.md   # System design
├── API_REFERENCE.md  # Function reference
├── CHANGELOG.md      # Version history
└── archive/          # Historical documentation
```

## Recent Features (v1.2.0)

- **Semantic Tag Names** - Layer names become tag names
- **Dot Preservation** - `<Icon.Close>` in React output
- **Effect Style Variables** - `shadow-lg` from Figma Effect Styles
- **Min/Max Dimensions** - `min-w-*`, `max-w-*` support
- **Auto-Layout Wrap** - `flex-wrap`, `gap-x/y` support

See **[Changelog](./docs/CHANGELOG.md)** for full details.

## License

Based on [figma-plugin-react-vite](https://github.com/iGoodie/figma-plugin-react-vite) boilerplate.

© 2025 - Licensed under [Attribution-ShareAlike 4.0 International](http://creativecommons.org/licenses/by-sa/4.0/)
