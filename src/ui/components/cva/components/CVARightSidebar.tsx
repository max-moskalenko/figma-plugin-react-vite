import { useState } from "react";
import { useCVA } from "../CVAContext";
import { CVAMode } from "../types";
import { copyCVACode, downloadCVAFile } from "@ui/utils/cvaExport";
import "./CVARightSidebar.scss";

/**
 * CVA Right Sidebar component
 * Matches extractor sidebar style: component name, mode, summary, and action buttons
 */
export function CVARightSidebar() {
  const { 
    mode, 
    setMode, 
    config, 
    setComponentName,
    resetConfig,
  } = useCVA();

  const [copied, setCopied] = useState(false);

  // Get all unique property names from variants
  const allPropertyNames = new Set<string>();
  config.variants.forEach(variant => {
    variant.properties.forEach(prop => {
      allPropertyNames.add(prop.name);
    });
  });

  // Handle copy to clipboard
  const handleCopy = async () => {
    const success = await copyCVACode(config);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle export
  const handleExport = () => {
    try {
      downloadCVAFile(config);
    } catch (err) {
      console.error("Failed to export:", err);
    }
  };

  const hasContent = config.variants.length > 0 || config.baseClasses.length > 0;

  return (
    <div className="cva-right-sidebar">
      <div className="selection-summary">
        <div className="component-name">
          <span className="component-type-badge">CVA</span>
          <input
            type="text"
            className="component-name-input"
            value={config.componentName}
            onChange={(e) => setComponentName(e.target.value)}
            placeholder="ComponentName"
          />
        </div>

        <div className="format-toggle">
          <p className="format-toggle-label">Mode</p>
          <div className="format-options format-options-horizontal">
            <label className={`format-option ${mode === "mapping" ? "format-option-checked" : ""}`}>
              <input
                type="radio"
                name="mode"
                value="mapping"
                checked={mode === "mapping"}
                onChange={() => setMode("mapping")}
              />
              <span>Mapping</span>
            </label>
            <label className={`format-option ${mode === "code" ? "format-option-checked" : ""}`}>
              <input
                type="radio"
                name="mode"
                value="code"
                checked={mode === "code"}
                onChange={() => setMode("code")}
              />
              <span>Code</span>
            </label>
          </div>
        </div>

        <div className="variables-list">
          <p className="variables-title">
            Summary
          </p>
          <div className="variables-wrapper">
            <div className="variable-item">
              <p>Base classes</p>
              <span className="variable-value">{config.baseClasses.length}</span>
            </div>
            <div className="variable-item">
              <p>Variants</p>
              <span className="variable-value">{config.variants.length}</span>
            </div>
            <div className="variable-item">
              <p>Properties</p>
              <span className="variable-value">{allPropertyNames.size}</span>
            </div>
            <div className="variable-item">
              <p>Compound variants</p>
              <span className="variable-value">{config.compoundVariants.length}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="action-buttons">
        <button
          className="button button-primary"
          onClick={handleCopy}
          disabled={!hasContent}
        >
          <p>{copied ? "Copied" : "Copy"}</p>
        </button>
        <button
          className="button button-secondary"
          onClick={handleExport}
          disabled={!hasContent}
        >
          <p>Export</p>
        </button>
        <button
          className="button button-secondary"
          onClick={resetConfig}
          title="Reset all CVA configuration"
        >
          <p>Reset</p>
        </button>
      </div>
    </div>
  );
}

export default CVARightSidebar;

