/**
 * @file UI text constants and labels
 * @module ui/constants/uiText
 * 
 * Centralized UI text strings for consistent labeling throughout the UI.
 * This makes it easier to update text and potentially add i18n support.
 */

// ============================================================================
// TOOL NAMES
// ============================================================================

export const ToolName = {
  DOM_EXTRACTOR: "DOM Extractor",
  CVA_MAPPING: "CVA Mapping Tool",
} as const;

// ============================================================================
// TAB LABELS
// ============================================================================

export const TabLabel = {
  // Main tabs
  DOM_STYLES: "DOM & Styles",
  PROPERTIES: "Properties",
  
  // Sub-tabs
  SETTINGS: "Settings",
  USED_VARS: "Used Vars",
  
  // CVA tabs
  MAPPING: "Mapping",
  CODE: "Code",
} as const;

// ============================================================================
// BUTTON LABELS
// ============================================================================

export const ButtonLabel = {
  GET_CODE: "Get code",
  COPY: "Copy",
  COPIED: "Copied",
  CLOSE: "Close",
  CANCEL: "Cancel",
  SAVE: "Save",
  ADD: "Add",
  REMOVE: "Remove",
  SELECT_ALL: "Select All",
  DESELECT_ALL: "Deselect All",
  EXPAND_ALL: "Expand All",
  COLLAPSE_ALL: "Collapse All",
} as const;

// ============================================================================
// SETTING LABELS
// ============================================================================

export const SettingLabel = {
  // Format options
  CSS_FORMAT: "CSS",
  TAILWIND_FORMAT: "Tailwind",
  RAW_JSON: "Raw JSON",
  
  // Toggle options
  ANNOTATIONS: "Annotations",
  PRETTIFY: "Prettify",
  SKIP_ZEROS: "Skip Zeros",
  
  // Icon export
  ICON_EXPORT: "Icon Export",
  ICON_NONE: "None",
  ICON_NPM: "NPM Package",
} as const;

// ============================================================================
// CVA LABELS
// ============================================================================

export const CVALabel = {
  BASE_CLASSES: "Base Classes",
  VARIANTS: "Variants",
  COMPOUND_VARIANTS: "Compound Variants",
  DEFAULT_VARIANTS: "Default Variants",
  
  // Variant card
  ADD_PROPERTY: "Add Property",
  ADD_VALUE: "Add Value",
  
  // Prefix slots
  DEFAULT: "default",
  HOVER: "hover",
  ACTIVE: "active",
  FOCUS: "focus",
  DISABLED: "disabled",
} as const;

// ============================================================================
// CLASS CATEGORY LABELS
// ============================================================================

export const ClassCategoryLabel = {
  fill: "Fill / Background",
  stroke: "Stroke / Border",
  "border-radius": "Border Radius",
  typography: "Typography",
  spacing: "Spacing",
  layout: "Layout",
  effects: "Effects",
  other: "Other",
} as const;

// ============================================================================
// PLACEHOLDER TEXT
// ============================================================================

export const Placeholder = {
  SEARCH_CLASSES: "Search classes...",
  SEARCH_PROPERTIES: "Search properties...",
  PROPERTY_NAME: "Property name",
  VALUE_NAME: "Value name",
  VARIANT_NAME: "Variant name",
  NO_SELECTION: "No selection",
  NO_RESULTS: "No results found",
  SELECT_COMPONENT: "Select a component in Figma to extract",
} as const;

// ============================================================================
// MODAL TITLES
// ============================================================================

export const ModalTitle = {
  CLASS_SELECTION: "Select Classes",
  PROPERTY_EDITOR: "Edit Property",
  COMPOUND_VARIANT: "Compound Variant",
} as const;

// ============================================================================
// TOOLTIPS & HELP TEXT
// ============================================================================

export const Tooltip = {
  SKIP_ZEROS: "Hide properties with zero values (e.g., rounded-[0px], p-0)",
  PRETTIFY: "Format output with consistent indentation",
  ANNOTATIONS: "Include Figma annotations as comments",
  MULTI_SELECT: "Select all elements with the same name across variants",
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ErrorMessage = {
  NO_SELECTION: "Please select a component, frame, or instance in Figma",
  EXTRACTION_FAILED: "Failed to extract component. Please try again.",
  COPY_FAILED: "Failed to copy to clipboard",
} as const;

