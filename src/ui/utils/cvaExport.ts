import { generateCVACode, generateCVAFile } from "@common/cvaGenerator";

interface CVAConfig {
  componentName: string;
  baseClasses: string[];
  variants: any[];
  compoundVariants: any[];
  defaultVariants: Record<string, string>;
}

/**
 * Copy CVA code to clipboard
 */
export async function copyCVACode(config: CVAConfig): Promise<boolean> {
  try {
    const code = generateCVACode(config);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
      return true;
    }
    
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      return successful;
    } finally {
      document.body.removeChild(textarea);
    }
  } catch (err) {
    console.error("Failed to copy CVA code:", err);
    return false;
  }
}

/**
 * Download CVA code as a TypeScript file
 */
export function downloadCVAFile(config: CVAConfig): void {
  try {
    const code = generateCVAFile(config);
    const blob = new Blob([code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    
    // Create filename from component name
    const safeName = config.componentName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase() || 'component';
    const filename = `${safeName}.variants.ts`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to download CVA file:", err);
    throw new Error("Failed to create download file");
  }
}

