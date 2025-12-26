import { Networker } from "monorepo-networker";

export const UI = Networker.createSide("UI-side").listens<{
  ping(): "pong";
  hello(text: string): void;
}>();

export const PLUGIN = Networker.createSide("Plugin-side").listens<{
  ping(): "pong";
  hello(text: string): void;
  createRect(width: number, height: number): void;
  exportSelection(): Promise<string>;
  getSelectionName(): Promise<string>;
  extractComponent(format?: "css" | "tailwind"): Promise<{
    html: string;
    css: string;
    stylesheet: string;
    componentName: string;
    variableMappings?: Array<{ name: string; value: any }>;
    usedVariables?: string[];
  }>;
}>();
