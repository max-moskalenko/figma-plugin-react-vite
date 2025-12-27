import { Networker } from "monorepo-networker";

export const UI = Networker.createSide("UI-side").listens<{
  ping(): "pong";
  hello(text: string): void;
}>();

// Annotation format options
export type AnnotationFormat = "html" | "tsx" | "none";

// Individual format output structure
interface FormatOutput {
  html?: string;
  json?: string;
  stylesheet: string;
  usedVariables: string[];
}

// Multi-format extraction result
interface MultiFormatExtractionResult {
  css: FormatOutput;
  tailwind: FormatOutput;
  raw: FormatOutput;
  componentName: string;
  variableMappings?: Array<{ name: string; value: any }>;
  usedVariables?: string[];
}

// Selection info returned by getSelectionName
export interface SelectionInfo {
  name: string;
  type: string;
}

export const PLUGIN = Networker.createSide("Plugin-side").listens<{
  ping(): "pong";
  hello(text: string): void;
  createRect(width: number, height: number): void;
  exportSelection(): Promise<string>;
  getSelectionName(): Promise<SelectionInfo>;
  extractComponent(annotationFormat?: AnnotationFormat, prettify?: boolean): Promise<MultiFormatExtractionResult>;
  resizeWindow(width: number, height: number): void;
}>();
