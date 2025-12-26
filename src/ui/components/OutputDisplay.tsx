import { useState } from "react";
import "./OutputDisplay.scss";

interface OutputDisplayProps {
  html: string;
  css: string;
  stylesheet: string;
  variableMappings?: Array<{ name: string; value: any }>;
}

export function OutputDisplay({
  html,
  css,
  stylesheet,
  variableMappings,
}: OutputDisplayProps) {
  const [activeTab, setActiveTab] = useState<"html" | "css" | "full">("full");
  const [showVariables, setShowVariables] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getActiveContent = () => {
    switch (activeTab) {
      case "html":
        return html;
      case "css":
        return css;
      case "full":
        return stylesheet;
      default:
        return stylesheet;
    }
  };

  const getCopyText = () => {
    switch (activeTab) {
      case "html":
        return html;
      case "css":
        return css;
      case "full":
        return stylesheet;
      default:
        return stylesheet;
    }
  };

  return (
    <div className="output-display">
      <div className="output-header">
        <div className="tabs">
          <button
            className={activeTab === "full" ? "active" : ""}
            onClick={() => setActiveTab("full")}
          >
            Full HTML
          </button>
          <button
            className={activeTab === "html" ? "active" : ""}
            onClick={() => setActiveTab("html")}
          >
            HTML Only
          </button>
          <button
            className={activeTab === "css" ? "active" : ""}
            onClick={() => setActiveTab("css")}
          >
            CSS Only
          </button>
        </div>
        <button
          className="copy-button"
          onClick={() => copyToClipboard(getCopyText())}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      <div className="code-container">
        <pre className="code-output">
          <code>{getActiveContent()}</code>
        </pre>
      </div>

      {variableMappings && variableMappings.length > 0 && (
        <div className="variables-section">
          <button
            className="variables-toggle"
            onClick={() => setShowVariables(!showVariables)}
          >
            {showVariables ? "▼" : "▶"} Variables ({variableMappings.length})
          </button>
          {showVariables && (
            <div className="variables-list">
              {variableMappings.map((variable, index) => (
                <div key={index} className="variable-item">
                  <span className="variable-name">{variable.name}</span>
                  <span className="variable-value">
                    {typeof variable.value === "object"
                      ? JSON.stringify(variable.value)
                      : String(variable.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

