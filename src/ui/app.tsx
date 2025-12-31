import { PLUGIN, SelectionInfo, MultiFormatExtractionResult, AnnotationFormat } from "@common/networkSides";
import { UI_CHANNEL } from "@ui/app.network";
import { NetworkError } from "monorepo-networker";
import { useState, useEffect, useRef, useCallback } from "react";
import JSZip from "jszip";

import "@ui/styles/main.scss";
import "./app.scss";
import { LeftNavigation, ToolType } from "@ui/components/shared/LeftNavigation";
import { CVATool, CVAProvider } from "@ui/components/cva";

type OutputFormat = "css" | "tailwind" | "raw";
type ExtractorTab = "dom-styles" | "component-properties";

function App() {
  // Navigation state
  const [activeToolItem, setActiveToolItem] = useState<ToolType>("extractor");

  // Extractor tool state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MultiFormatExtractionResult | null>(null);
  const [componentName, setComponentName] = useState<string>("Component name");
  const [componentType, setComponentType] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedProperties, setCopiedProperties] = useState(false);
  const [activeExtractorTab, setActiveExtractorTab] = useState<ExtractorTab>("dom-styles");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("css");
  const [annotationsEnabled, setAnnotationsEnabled] = useState(true);
  const [annotationFormat, setAnnotationFormat] = useState<AnnotationFormat>("html");
  const [prettifyEnabled, setPrettifyEnabled] = useState(true);
  const [excludeZeroValues, setExcludeZeroValues] = useState(true);
  
  // Export dropdown state
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportFormats, setExportFormats] = useState<{ css: boolean; tailwind: boolean; raw: boolean }>({
    css: true,
    tailwind: true,
    raw: false
  });
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  
  const MIN_SIDEBAR_WIDTH = 240;
  const MAX_SIDEBAR_WIDTH = 400;

  // Window resize state
  const [isWindowResizing, setIsWindowResizing] = useState(false);
  const windowResizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  // Handle resize mouse events
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      
      // Calculate new width (negative because we're dragging left to increase sidebar)
      const diff = resizeRef.current.startX - e.clientX;
      let newWidth = resizeRef.current.startWidth + diff;
      
      // Clamp to min/max
      newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Handle window resize with corner drag
  const handleWindowResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsWindowResizing(true);
    windowResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: window.innerWidth,
      startHeight: window.innerHeight
    };
  }, []);

  useEffect(() => {
    const handleWindowResizeMove = (e: MouseEvent) => {
      if (!isWindowResizing || !windowResizeRef.current) return;
      
      const diffX = e.clientX - windowResizeRef.current.startX;
      const diffY = e.clientY - windowResizeRef.current.startY;
      
      const newWidth = windowResizeRef.current.startWidth + diffX;
      const newHeight = windowResizeRef.current.startHeight + diffY;
      
      // Request plugin to resize the window
      UI_CHANNEL.request(PLUGIN, "resizeWindow", [newWidth, newHeight]);
    };
    
    const handleWindowResizeUp = () => {
      setIsWindowResizing(false);
      windowResizeRef.current = null;
    };
    
    if (isWindowResizing) {
      document.addEventListener('mousemove', handleWindowResizeMove);
      document.addEventListener('mouseup', handleWindowResizeUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleWindowResizeMove);
      document.removeEventListener('mouseup', handleWindowResizeUp);
    };
  }, [isWindowResizing]);

  // Check selection on mount and update component name and type
  useEffect(() => {
    // Get initial selection info
    const updateSelectionInfo = async () => {
      try {
        const info = await UI_CHANNEL.request(PLUGIN, "getSelectionName", []) as SelectionInfo;
        setComponentName(info.name);
        setComponentType(info.type);
      } catch (err) {
        console.error("Error getting selection info:", err);
        setComponentName("Component name");
        setComponentType("");
      }
    };
    
    updateSelectionInfo();
    
    // Set up interval to check for selection changes
    const interval = setInterval(() => {
      updateSelectionInfo();
    }, 500); // Check every 500ms
    
    return () => clearInterval(interval);
  }, []);

  // Get the current format's stylesheet based on selected output format
  const getCurrentStylesheet = (): string => {
    if (!result) return "";
    return result[outputFormat].stylesheet;
  };

  // Get the current format's used variables
  const getCurrentUsedVariables = (): string[] => {
    if (!result) return [];
    return result[outputFormat].usedVariables;
  };

  // Get all variables from all formats with usage info
  interface VariableUsage {
    name: string;
    usedInCss: boolean;
    usedInTailwind: boolean;
    usedInRaw: boolean;
  }

  const getAllVariablesWithUsage = (): VariableUsage[] => {
    if (!result) return [];
    
    const cssVars = new Set(result.css.usedVariables);
    const twVars = new Set(result.tailwind.usedVariables);
    const rawVars = new Set(result.raw.usedVariables);
    
    // Get union of all variables
    const allVars = new Set([...cssVars, ...twVars, ...rawVars]);
    
    return Array.from(allVars).sort().map(name => ({
      name,
      usedInCss: cssVars.has(name),
      usedInTailwind: twVars.has(name),
      usedInRaw: rawVars.has(name),
    }));
  };

  const getVariableTooltip = (v: VariableUsage): string => {
    const formats: string[] = [];
    if (v.usedInCss) formats.push("CSS");
    if (v.usedInTailwind) formats.push("Tailwind");
    if (v.usedInRaw) formats.push("Raw");
    return `Used in: ${formats.join(", ")}`;
  };

  const isVariableInCurrentFormat = (v: VariableUsage): boolean => {
    if (outputFormat === "css") return v.usedInCss;
    if (outputFormat === "tailwind") return v.usedInTailwind;
    if (outputFormat === "raw") return v.usedInRaw;
    return false;
  };

  // Categorize variables by purpose
  type VariableCategory = "color" | "typography" | "spacing" | "size" | "radius" | "border" | "shadow" | "other";
  
  interface CategorizedVariables {
    category: VariableCategory;
    label: string;
    variables: VariableUsage[];
  }

  const categorizeVariables = (vars: VariableUsage[]): CategorizedVariables[] => {
    const categories: Record<VariableCategory, { label: string; patterns: RegExp[] }> = {
      color: { 
        label: "Colors", 
        patterns: [/fill-/, /foreground-/, /stroke-/, /background-/, /color-/, /-accent-/, /-neutral-/, /-on-/]
      },
      typography: { 
        label: "Typography", 
        patterns: [/font-/, /leading-/, /tracking-/, /text-/]
      },
      spacing: { 
        label: "Spacing", 
        patterns: [/spacing-/, /gap-/, /padding-/, /margin-/]
      },
      size: { 
        label: "Sizes", 
        patterns: [/width-/, /height-/, /size-/]
      },
      radius: { 
        label: "Radius", 
        patterns: [/radius-/]
      },
      border: { 
        label: "Borders", 
        patterns: [/border-/]
      },
      shadow: { 
        label: "Shadows", 
        patterns: [/shadow-/]
      },
      other: { 
        label: "Other", 
        patterns: []
      }
    };

    const categorized: Record<VariableCategory, VariableUsage[]> = {
      color: [], typography: [], spacing: [], size: [], radius: [], border: [], shadow: [], other: []
    };

    vars.forEach(v => {
      let matched = false;
      for (const [cat, config] of Object.entries(categories) as [VariableCategory, { label: string; patterns: RegExp[] }][]) {
        if (cat === "other") continue;
        if (config.patterns.some(p => p.test(v.name))) {
          categorized[cat].push(v);
          matched = true;
          break;
        }
      }
      if (!matched) {
        categorized.other.push(v);
      }
    });

    // Return only non-empty categories in order
    const order: VariableCategory[] = ["color", "typography", "spacing", "size", "radius", "border", "shadow", "other"];
    return order
      .filter(cat => categorized[cat].length > 0)
      .map(cat => ({
        category: cat,
        label: categories[cat].label,
        variables: categorized[cat]
      }));
  };

  /**
   * Filter zero-value classes from stylesheet output
   * Classes like rounded-[0px], p-[0px_0px_0px_0px] are removed
   */
  const filterZeroValueClasses = (stylesheet: string): string => {
    // Patterns for zero-value classes within class/className attributes
    const zeroPatterns = [
      /\s*[\w-]+\[0(px)?(_0(px)?)*\]/g,  // arbitrary zero: rounded-[0px], p-[0px_0px_0px_0px]
      /\s*(m|p|gap|space-[xy]|inset|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h)-0(?=[\s"<>]|$)/g,  // standard zeros
      /\s*rounded-none/g,
      /\s*rounded-\[0\]/g,
    ];
    
    let result = stylesheet;
    for (const pattern of zeroPatterns) {
      result = result.replace(pattern, '');
    }
    
    // Clean up multiple spaces within class attributes only (preserve newlines and indentation)
    // Match className="..." or class="..." and clean spaces only within the quotes
    result = result.replace(/((?:class|className)="[^"]*")/g, (match) => {
      // Within the class attribute, replace multiple spaces with single space
      return match.replace(/\s{2,}/g, ' ').replace(/"\s+/g, '"').replace(/\s+"/g, '"');
    });
    
    return result;
  };

  const handleGetCode = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Determine effective annotation format (none if disabled)
      const effectiveAnnotationFormat = annotationsEnabled ? annotationFormat : "none";
      
      // Extract all formats at once with annotation and prettify settings
      let extractionResult = await UI_CHANNEL.request(
        PLUGIN,
        "extractComponent",
        [effectiveAnnotationFormat, prettifyEnabled]
      ) as MultiFormatExtractionResult;
      
      // Filter out zero-value classes if setting is enabled
      if (excludeZeroValues) {
        extractionResult = {
          ...extractionResult,
          css: {
            ...extractionResult.css,
            stylesheet: filterZeroValueClasses(extractionResult.css.stylesheet),
          },
          tailwind: {
            ...extractionResult.tailwind,
            stylesheet: filterZeroValueClasses(extractionResult.tailwind.stylesheet),
          },
        };
      }
      
      setResult(extractionResult);
      setComponentName(extractionResult.componentName);
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("Failed to extract component. Please try again.");
      }
      console.error("Extraction error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    
    const textToCopy = getCurrentStylesheet();
    
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback: Use temporary textarea element (for environments where Clipboard API isn't available)
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (!successful) {
            throw new Error('execCommand copy failed');
          }
        } finally {
          document.body.removeChild(textarea);
        }
      }
      
      // Show "Copied" feedback for 2 seconds
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError("Failed to copy to clipboard. Please select and copy manually.");
    }
  };

  // Handle export to ZIP
  const handleExport = async () => {
    if (!result) return;
    
    const zip = new JSZip();
    const safeName = componentName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'component';
    
    if (exportFormats.css) {
      zip.file(`${safeName}.css.html`, result.css.stylesheet);
    }
    if (exportFormats.tailwind) {
      zip.file(`${safeName}.tailwind.html`, result.tailwind.stylesheet);
    }
    if (exportFormats.raw) {
      zip.file(`${safeName}.raw.json`, result.raw.stylesheet);
    }
    
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}-export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportDropdownOpen(false);
    } catch (err) {
      console.error("Failed to export:", err);
      setError("Failed to create export archive.");
    }
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportDropdownOpen]);

  // Format component properties as code string
  const formatComponentProperties = (): string => {
    if (!result?.componentProperties) return '';
    
    const { definitions, variants, description, documentationLinks } = result.componentProperties;
    
    let output = '';
    
    // Add description as a comment at the top if available
    if (description) {
      output += '/**\n';
      output += ' * COMPONENT DESCRIPTION\n';
      output += ' * ' + '='.repeat(50) + '\n';
      output += ' * \n';
      // Split description into lines and add comment formatting
      const descLines = description.split('\n');
      descLines.forEach(line => {
        output += ' * ' + line + '\n';
      });
      output += ' */\n\n';
    }
    
    // Add documentation links as comments if available
    if (documentationLinks && documentationLinks.length > 0) {
      output += '/**\n';
      output += ' * DOCUMENTATION LINKS\n';
      output += ' * ' + '='.repeat(50) + '\n';
      documentationLinks.forEach(link => {
        output += ' * ' + (link.title ? `${link.title}: ` : '') + link.url + '\n';
      });
      output += ' */\n\n';
    }
    
    // Add separator before properties
    if (description || (documentationLinks && documentationLinks.length > 0)) {
      output += '// ' + '='.repeat(50) + '\n';
      output += '// PROPERTIES & VARIANTS\n';
      output += '// ' + '='.repeat(50) + '\n\n';
    }
    
    const jsonOutput: any = {
      definitions,
      variants,
    };
    
    output += JSON.stringify(jsonOutput, null, 2);
    
    return output;
  };

  // Copy component properties to clipboard
  const handleCopyProperties = async () => {
    if (!result?.componentProperties) return;
    
    const textToCopy = formatComponentProperties();
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (!successful) {
            throw new Error('execCommand copy failed');
          }
        } finally {
          document.body.removeChild(textarea);
        }
      }
      
      setCopiedProperties(true);
      setTimeout(() => {
        setCopiedProperties(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy properties:", err);
      setError("Failed to copy to clipboard. Please select and copy manually.");
    }
  };

  // Export component properties to file
  const handleExportProperties = async () => {
    if (!result?.componentProperties) return;
    
    const safeName = componentName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'component';
    const content = formatComponentProperties();
    
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}-properties.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export properties:", err);
      setError("Failed to export properties.");
    }
  };

  const currentUsedVariables = getCurrentUsedVariables();

  /**
   * Highlights arbitrary/hardcoded values and annotations in the code preview.
   * - Tailwind: w-[100px], text-[#fff], etc.
   * - CSS: width: 100px, color: #fff, etc. (but NOT var(--...) references)
   * - Annotations: HTML and TSX comments shown at 40% opacity
   * This is only for display - does not affect the copied text.
   */
  const highlightArbitraryValues = (code: string): string => {
    // Escape HTML first to prevent XSS
    let escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // 0. Highlight annotations (HTML comments and TSX comments) with reduced opacity
    // HTML comments: &lt;!-- ... --&gt;
    const htmlCommentRegex = /(&lt;!--[\s\S]*?--&gt;)/g;
    escapedCode = escapedCode.replace(htmlCommentRegex, '<span class="code-annotation">$1</span>');
    
    // TSX comments: {/* ... */}
    const tsxCommentRegex = /(\{\/\*[\s\S]*?\*\/\})/g;
    escapedCode = escapedCode.replace(tsxCommentRegex, '<span class="code-annotation">$1</span>');
    
    // Block comments: /* ... */ or /** ... */
    const blockCommentRegex = /(\/\*\*?[\s\S]*?\*\/)/g;
    escapedCode = escapedCode.replace(blockCommentRegex, '<span class="code-annotation">$1</span>');
    
    // Single-line comments: // ...
    const singleLineCommentRegex = /(\/\/[^\n]*)/g;
    escapedCode = escapedCode.replace(singleLineCommentRegex, '<span class="code-annotation">$1</span>');
    
    // 1. Highlight Tailwind arbitrary values: word-[value] or word-prefix-[value]
    // Examples: w-[100px], h-[50px], p-[12px], text-[#ffffff]
    const tailwindArbitraryRegex = /(\w+(?:-\w+)*)-\[([^\]]+)\]/g;
    escapedCode = escapedCode.replace(tailwindArbitraryRegex, (match, prefix, value) => {
      return `${prefix}-<span class="arbitrary-value">[${value}]</span>`;
    });
    
    // 2. Highlight CSS hardcoded values (but not var(--...) references)
    // Match property: value patterns where value is a hardcoded number with unit, hex color, or rgb/rgba
    // Examples: width: 100px, color: #fff, background: rgba(0,0,0,0.5)
    
    // Highlight pixel/em/rem/% values: 100px, 1.5rem, 50%, etc.
    const cssNumericValueRegex = /(:\s*)(-?[\d.]+(?:px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc|deg|rad|turn|s|ms))(?=[;\s&]|$)/g;
    escapedCode = escapedCode.replace(cssNumericValueRegex, (match, prefix, value) => {
      return `${prefix}<span class="arbitrary-value">${value}</span>`;
    });
    
    // Highlight hex colors: #fff, #ffffff, #rrggbbaa
    const cssHexColorRegex = /(:\s*)(#[0-9a-fA-F]{3,8})(?=[;\s&]|$)/g;
    escapedCode = escapedCode.replace(cssHexColorRegex, (match, prefix, value) => {
      return `${prefix}<span class="arbitrary-value">${value}</span>`;
    });
    
    // Highlight rgb/rgba/hsl/hsla values
    const cssColorFuncRegex = /(:\s*)((?:rgb|rgba|hsl|hsla)\([^)]+\))(?=[;\s&]|$)/g;
    escapedCode = escapedCode.replace(cssColorFuncRegex, (match, prefix, value) => {
      return `${prefix}<span class="arbitrary-value">${value}</span>`;
    });
    
    return escapedCode;
  };

  // Check if component properties are available
  const hasComponentProperties = result?.componentProperties && 
    result.componentProperties.definitions.length > 0;

  // Render Extractor Tool content
  const renderExtractorTool = () => (
    <>
      <div className="code-snippet">
        <div className="code-content">
          {error ? (
            <p className="code-error">
              Error: {error}
            </p>
          ) : result ? (
            <pre className="code-output">
              <code dangerouslySetInnerHTML={{ __html: 
                activeExtractorTab === "dom-styles" 
                  ? highlightArbitraryValues(getCurrentStylesheet())
                  : highlightArbitraryValues(formatComponentProperties())
              }} />
            </pre>
          ) : (
            <p className="code-placeholder">
              {loading ? "Extracting..." : "Select a component in Figma and click 'Get code' to extract its DOM structure"}
            </p>
          )}
        </div>
      </div>
      
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeMouseDown}
      >
        <div className="resize-handle-line" />
      </div>
      
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="selection-summary">
          <div className="component-name">
            {componentType && <span className="component-type-badge">{componentType}</span>}
            <p>{componentName}</p>
          </div>

          {/* Tab selector - only show if component properties available */}
          {hasComponentProperties && (
            <div className="extractor-tabs">
              <button
                className={`extractor-tab ${activeExtractorTab === "dom-styles" ? "active" : ""}`}
                onClick={() => setActiveExtractorTab("dom-styles")}
                disabled={loading}
              >
                DOM & Styles
              </button>
              <button
                className={`extractor-tab ${activeExtractorTab === "component-properties" ? "active" : ""}`}
                onClick={() => setActiveExtractorTab("component-properties")}
                disabled={loading}
              >
                Properties
              </button>
            </div>
          )}
          
          {/* Show format toggle only on DOM & Styles tab */}
          {activeExtractorTab === "dom-styles" && (
            <div className="format-toggle">
              <p className="format-toggle-label">Output Format</p>
              <div className="format-options format-options-horizontal">
                <label className={`format-option ${outputFormat === "css" ? "format-option-checked" : ""} ${loading ? "format-option-disabled" : ""}`}>
                  <input
                    type="radio"
                    name="format"
                    value="css"
                    checked={outputFormat === "css"}
                    onChange={() => setOutputFormat("css")}
                    disabled={loading}
                  />
                  <span>CSS</span>
                </label>
                <label className={`format-option ${outputFormat === "tailwind" ? "format-option-checked" : ""} ${loading ? "format-option-disabled" : ""}`}>
                  <input
                    type="radio"
                    name="format"
                    value="tailwind"
                    checked={outputFormat === "tailwind"}
                    onChange={() => setOutputFormat("tailwind")}
                    disabled={loading}
                  />
                  <span>TW</span>
                </label>
                <label className={`format-option ${outputFormat === "raw" ? "format-option-checked" : ""} ${loading ? "format-option-disabled" : ""}`}>
                  <input
                    type="radio"
                    name="format"
                    value="raw"
                    checked={outputFormat === "raw"}
                    onChange={() => setOutputFormat("raw")}
                    disabled={loading}
                  />
                  <span>Raw</span>
                </label>
              </div>
            </div>
          )}
          
          {/* Show options and variables only on DOM & Styles tab */}
          {activeExtractorTab === "dom-styles" && (
            <>
              <div className="options-row">
                <div className="option-item">
                  <label className={`toggle-switch ${loading ? "toggle-disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={annotationsEnabled}
                      onChange={(e) => setAnnotationsEnabled(e.target.checked)}
                      disabled={loading}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">Annotations</span>
                  {annotationsEnabled && (
                    <select
                      value={annotationFormat}
                      onChange={(e) => setAnnotationFormat(e.target.value as AnnotationFormat)}
                      disabled={loading}
                      className="inline-select"
                    >
                      <option value="html">HTML</option>
                      <option value="tsx">TSX</option>
                    </select>
                  )}
                </div>
                <div className="option-item">
                  <label className={`toggle-switch ${loading ? "toggle-disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={prettifyEnabled}
                      onChange={(e) => setPrettifyEnabled(e.target.checked)}
                      disabled={loading}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">Prettify</span>
                </div>
                <div className="option-item">
                  <label className={`toggle-switch ${loading ? "toggle-disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={excludeZeroValues}
                      onChange={(e) => setExcludeZeroValues(e.target.checked)}
                      disabled={loading}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label" title="Filter out classes like rounded-[0px], p-0, m-0 (affects only CSS and TW outputs)">Skip zeros (CSS/TW)</span>
                </div>
              </div>
              
              {(() => {
                const allVars = getAllVariablesWithUsage();
                const groupedVars = categorizeVariables(allVars);
                return allVars.length > 0 && (
                  <div className="variables-list">
                    <p className="variables-title">
                      Used vars <span className="variables-count">({allVars.length})</span>
                    </p>
                    <div className="variables-wrapper">
                      {groupedVars.map((group) => (
                        <div key={group.category} className="variable-group">
                          <div className="variable-group-header">{group.label}</div>
                          {group.variables.map((v, index) => {
                            const isInCurrentFormat = isVariableInCurrentFormat(v);
                            const allFormats = v.usedInCss && v.usedInTailwind && v.usedInRaw;
                            return (
                              <div 
                                key={index} 
                                className={`variable-item ${!isInCurrentFormat ? "variable-item-dimmed" : ""} ${allFormats ? "variable-item-all" : ""}`}
                              >
                                <p>var({v.name})</p>
                                <span className="variable-formats">
                                  {v.usedInCss && <span className={`format-badge ${outputFormat === "css" ? "format-badge-active" : ""}`} title="Used in CSS output">C</span>}
                                  {v.usedInTailwind && <span className={`format-badge ${outputFormat === "tailwind" ? "format-badge-active" : ""}`} title="Used in Tailwind output">T</span>}
                                  {v.usedInRaw && <span className={`format-badge ${outputFormat === "raw" ? "format-badge-active" : ""}`} title="Used in Raw JSON output">R</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Show component properties summary on Component Properties tab */}
          {activeExtractorTab === "component-properties" && result?.componentProperties && (
            <div className="properties-summary">
              <div className="properties-section">
                <p className="properties-section-title">
                  Properties <span className="properties-count">({result.componentProperties.definitions.length})</span>
                </p>
                <div className="properties-list">
                  {result.componentProperties.definitions.map((def, index) => (
                    <div key={index} className="property-item">
                      <div className="property-name">{def.name}</div>
                      <div className="property-type">{def.type}</div>
                      {def.variantOptions && def.variantOptions.length > 0 && (
                        <div className="property-values">
                          {def.variantOptions.map((opt, i) => (
                            <span key={i} className="property-value">{opt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {result.componentProperties.variants.length > 0 && (
                <div className="properties-section">
                  <p className="properties-section-title">
                    Variants <span className="properties-count">({result.componentProperties.variants.length})</span>
                  </p>
                  <div className="variants-list">
                    {result.componentProperties.variants.map((variant, index) => (
                      <div key={index} className="variant-item">
                        <div className="variant-name">{variant.variantName}</div>
                        <div className="variant-props">
                          {Object.entries(variant.properties).map(([key, value]) => (
                            <div key={key} className="variant-prop">
                              <span className="variant-prop-key">{key}:</span>
                              <span className="variant-prop-value">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="action-buttons">
          {activeExtractorTab === "dom-styles" ? (
            <>
              <button
                className="button button-secondary"
                onClick={handleCopy}
                disabled={!result || loading}
              >
                <p>{copied ? "Copied" : "Copy"}</p>
              </button>
              <div className="export-dropdown-container" ref={exportDropdownRef}>
                <button
                  className="button button-secondary"
                  onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                  disabled={!result || loading}
                >
                  <p>Export</p>
                </button>
                {exportDropdownOpen && (
                  <div className="export-dropdown">
                    <div className="export-dropdown-header">Select formats</div>
                    <label className="export-checkbox">
                      <input
                        type="checkbox"
                        checked={exportFormats.css}
                        onChange={(e) => setExportFormats(prev => ({ ...prev, css: e.target.checked }))}
                      />
                      <span>CSS</span>
                    </label>
                    <label className="export-checkbox">
                      <input
                        type="checkbox"
                        checked={exportFormats.tailwind}
                        onChange={(e) => setExportFormats(prev => ({ ...prev, tailwind: e.target.checked }))}
                      />
                      <span>Tailwind</span>
                    </label>
                    <label className="export-checkbox">
                      <input
                        type="checkbox"
                        checked={exportFormats.raw}
                        onChange={(e) => setExportFormats(prev => ({ ...prev, raw: e.target.checked }))}
                      />
                      <span>Raw JSON</span>
                    </label>
                    <button
                      className="button button-primary export-btn"
                      onClick={handleExport}
                      disabled={!exportFormats.css && !exportFormats.tailwind && !exportFormats.raw}
                    >
                      <p>Download ZIP</p>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                className="button button-secondary"
                onClick={handleCopyProperties}
                disabled={!result?.componentProperties || loading}
              >
                <p>{copiedProperties ? "Copied" : "Copy"}</p>
              </button>
              <button
                className="button button-secondary"
                onClick={handleExportProperties}
                disabled={!result?.componentProperties || loading}
              >
                <p>Export</p>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );

  // Render CVA Mapping Tool
  const renderCVAMappingTool = () => (
    <CVATool extractorResult={result} />
  );

  return (
    <CVAProvider>
      <div className="figma-plugin">
        <LeftNavigation 
          activeToolItem={activeToolItem} 
          onToolChange={setActiveToolItem}
          onGetCode={handleGetCode}
          loading={loading}
        />
        
        <div className="tool-content">
          {/* Keep both tools rendered but hide inactive one to preserve state */}
          <div className={`tool-view ${activeToolItem === "extractor" ? "active" : "hidden"}`}>
            {renderExtractorTool()}
          </div>
          <div className={`tool-view ${activeToolItem === "cva-mapping" ? "active" : "hidden"}`}>
            {renderCVAMappingTool()}
        </div>
      </div>
      
      <div 
        className={`window-resize-handle ${isWindowResizing ? 'resizing' : ''}`}
        onMouseDown={handleWindowResizeMouseDown}
        title="Drag to resize window"
      />
    </div>
    </CVAProvider>
  );
}

export default App;
