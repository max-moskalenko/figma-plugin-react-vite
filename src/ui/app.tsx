import { PLUGIN } from "@common/networkSides";
import { UI_CHANNEL } from "@ui/app.network";
import { NetworkError } from "monorepo-networker";
import { useState, useEffect } from "react";

import "@ui/styles/main.scss";
import "./app.scss";

interface ExtractionResult {
  html: string;
  css: string;
  stylesheet: string;
  componentName: string;
  variableMappings?: Array<{ name: string; value: any }>;
  usedVariables?: string[];
}

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [componentName, setComponentName] = useState<string>("Component name");
  const [copied, setCopied] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"css" | "tailwind">("css");

  // Check selection on mount and update component name
  useEffect(() => {
    // Get initial selection name
    const updateSelectionName = async () => {
      try {
        const name = await UI_CHANNEL.request(PLUGIN, "getSelectionName", []) as string;
        setComponentName(name);
      } catch (err) {
        console.error("Error getting selection name:", err);
        setComponentName("Component name");
      }
    };
    
    updateSelectionName();
    
    // Set up interval to check for selection changes
    const interval = setInterval(() => {
      updateSelectionName();
    }, 500); // Check every 500ms
    
    return () => clearInterval(interval);
  }, []);

  const handleGetCode = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const extractionResult = await UI_CHANNEL.request(
        PLUGIN,
        "extractComponent",
        [outputFormat]
      ) as ExtractionResult;
      
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
    
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(result.stylesheet);
      } else {
        // Fallback: Use temporary textarea element (for environments where Clipboard API isn't available)
        const textarea = document.createElement('textarea');
        textarea.value = result.stylesheet;
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

  return (
    <div className="figma-plugin">
      <div className="code-snippet">
        <div className="code-content">
          {error ? (
            <p className="code-error">
              Error: {error}
            </p>
          ) : result ? (
            <pre className="code-output">
              <code>{result.stylesheet}</code>
            </pre>
          ) : (
            <p className="code-placeholder">
              {loading ? "Extracting..." : "Select a component in Figma and click 'Get code' to extract its DOM structure"}
            </p>
          )}
        </div>
      </div>
      
      <div className="sidebar">
        <div className="selection-summary">
          <div className="component-name">
            <p>{componentName}</p>
          </div>
          
          <div className="format-toggle">
            <p className="format-toggle-label">Output Format</p>
            <div className="format-options">
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
                <span>Tailwind</span>
              </label>
            </div>
          </div>
          
          {result?.usedVariables && result.usedVariables.length > 0 && (
            <div className="variables-list">
              <p className="variables-title">
                Used vars <span className="variables-count">({result.usedVariables.length})</span>
              </p>
              <div className="variables-wrapper">
                {result.usedVariables.map((variableName, index) => (
                  <div key={index} className="variable-item">
                    <p>var({variableName})</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="action-buttons">
          <button
            className="button button-primary"
            onClick={handleGetCode}
            disabled={loading}
          >
            <p>Get code</p>
          </button>
          <button
            className="button button-secondary"
            onClick={handleCopy}
            disabled={!result || loading}
          >
            <p>{copied ? "Copied" : "Copy"}</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
