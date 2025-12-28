import { useMemo } from "react";
import { useCVA } from "../CVAContext";
import { generateCVACode } from "@common/cvaGenerator";
import "./CodeMode.scss";

/**
 * Code Mode component
 * Displays the generated CVA code preview
 */
export function CodeMode() {
  const { config } = useCVA();

  // Generate CVA code from config
  const generatedCode = useMemo(() => {
    return generateCVACode(config);
  }, [config]);

  return (
    <div className="code-mode">
      <pre className="code-preview">
        <code>{generatedCode}</code>
      </pre>
    </div>
  );
}

export default CodeMode;

