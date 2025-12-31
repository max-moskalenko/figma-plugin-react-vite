import { MultiFormatExtractionResult, ComponentPropertiesResult } from "@common/networkSides";

/**
 * CVA Tool Mode - either mapping configuration or code preview
 */
export type CVAMode = "mapping" | "code";

/**
 * Class category for organizing classes by purpose
 */
export type ClassCategory = 
  | "fill" 
  | "stroke" 
  | "border-radius" 
  | "typography" 
  | "spacing" 
  | "layout" 
  | "effects" 
  | "other";

/**
 * A categorized class extracted from the extractor output
 */
export interface ExtractedClass {
  id: string;
  className: string;
  category: ClassCategory;
  domElements: string[]; // Which DOM elements this class belongs to
  isSelected: boolean; // Whether it's selected as a base class
  isUsedInVariant: boolean; // Whether it's used in any variant (auto-removed from base)
}

/**
 * Common pseudo-class prefixes for interactive states
 */
export const PSEUDO_CLASS_PREFIXES = [
  { value: '', label: 'None' },
  { value: 'hover:', label: 'hover:' },
  { value: 'active:', label: 'active:' },
  { value: 'focus:', label: 'focus:' },
  { value: 'focus-visible:', label: 'focus-visible:' },
  { value: 'focus-within:', label: 'focus-within:' },
  { value: 'disabled:', label: 'disabled:' },
  { value: 'aria-disabled:', label: 'aria-disabled:' },
  { value: 'group-hover:', label: 'group-hover:' },
  { value: 'peer-focus:', label: 'peer-focus:' },
] as const;

/**
 * A prefixed class group within a property value
 * Allows multiple prefix slots per value (e.g., base, hover:, active:, disabled:)
 */
export interface CVAPrefixedClasses {
  id: string;
  prefix: string; // Empty string for no prefix (base classes)
  classes: string[];
}

/**
 * A property value in the CVA variant matrix
 */
export interface CVAPropertyValue {
  id: string;
  name: string; // e.g., "sm", "md", "lg", "primary", "secondary"
  prefixedClasses: CVAPrefixedClasses[]; // Multiple prefix slots per value
}

/**
 * A variant property (column in the matrix)
 */
export interface CVAVariantProperty {
  id: string;
  name: string; // e.g., "size", "variant", "disabled"
  values: CVAPropertyValue[];
}

/**
 * DOM element mapping in variant matrix
 */
export interface DOMElementMapping {
  id: string;
  elementName: string; // e.g., "button-root", "icon-wrapper"
  classes: Record<string, string[]>; // propertyValueId -> classes
}

/**
 * A complete variant configuration (card in the UI)
 */
export interface CVAVariantConfig {
  id: string;
  name: string; // Variant name (editable)
  showPrefixes: boolean; // Whether to show the PREFIX column
  properties: CVAVariantProperty[];
  domMappings: DOMElementMapping[];
}

/**
 * A condition in a compound variant rule
 */
export interface CompoundCondition {
  id: string;
  propertyName: string;
  propertyValue: string;
}

/**
 * A compound variant rule
 */
export interface CompoundVariantRule {
  id: string;
  conditions: CompoundCondition[]; // AND logic between conditions
  classes: string[];
}

/**
 * Default variant values configuration
 */
export interface DefaultVariants {
  [propertyName: string]: string;
}

/**
 * Complete CVA configuration state
 */
export interface CVAConfig {
  componentName: string;
  baseClasses: string[];
  variants: CVAVariantConfig[];
  compoundVariants: CompoundVariantRule[];
  defaultVariants: DefaultVariants;
}

/**
 * Complete CVA tool state
 */
export interface CVAState {
  mode: CVAMode;
  extractorResult: MultiFormatExtractionResult | null;
  componentProperties: ComponentPropertiesResult | null;
  
  // Extracted and categorized classes
  extractedClasses: ExtractedClass[];
  
  // Current CVA configuration
  config: CVAConfig;
  
  // Class selection modal state
  isClassModalOpen: boolean;
  classModalTarget: {
    variantId: string;
    propertyId: string;
    valueId: string;
    prefixSlotId: string;
  } | null;
}

/**
 * CVA state actions
 */
export interface CVAActions {
  // Mode
  setMode: (mode: CVAMode) => void;
  
  // Extractor data
  setExtractorResult: (result: MultiFormatExtractionResult | null) => void;
  
  // Base classes
  toggleBaseClass: (classId: string) => void;
  selectAllBaseClasses: (category?: ClassCategory) => void;
  deselectAllBaseClasses: (category?: ClassCategory) => void;
  
  // Variants
  addVariant: () => void;
  removeVariant: (variantId: string) => void;
  duplicateVariant: (variantId: string) => void;
  renameVariant: (variantId: string, name: string) => void;
  toggleVariantPrefixes: (variantId: string) => void;
  
  // Variant properties
  addProperty: (variantId: string) => void;
  removeProperty: (variantId: string, propertyId: string) => void;
  renameProperty: (variantId: string, propertyId: string, name: string) => void;
  setPropertyValues: (variantId: string, propertyId: string, valueNames: string[]) => void;
  
  // Property values
  addPropertyValue: (variantId: string, propertyId: string) => void;
  removePropertyValue: (variantId: string, propertyId: string, valueId: string) => void;
  duplicatePropertyValue: (variantId: string, propertyId: string, valueId: string) => void;
  renamePropertyValue: (variantId: string, propertyId: string, valueId: string, name: string) => void;
  
  // Prefix slots within a value
  addPrefixSlot: (variantId: string, propertyId: string, valueId: string) => void;
  removePrefixSlot: (variantId: string, propertyId: string, valueId: string, prefixSlotId: string) => void;
  setPrefixSlotPrefix: (variantId: string, propertyId: string, valueId: string, prefixSlotId: string, prefix: string) => void;
  setPrefixSlotClasses: (variantId: string, propertyId: string, valueId: string, prefixSlotId: string, classes: string[]) => void;
  
  // Compound variants
  addCompoundVariant: () => void;
  removeCompoundVariant: (ruleId: string) => void;
  addCompoundCondition: (ruleId: string) => void;
  removeCompoundCondition: (ruleId: string, conditionId: string) => void;
  updateCompoundCondition: (ruleId: string, conditionId: string, propertyName: string, propertyValue: string) => void;
  setCompoundVariantClasses: (ruleId: string, classes: string[]) => void;
  
  // Default variants
  setDefaultVariant: (propertyName: string, value: string) => void;
  removeDefaultVariant: (propertyName: string) => void;
  
  // Class modal
  openClassModal: (variantId: string, propertyId: string, valueId: string, prefixSlotId: string) => void;
  closeClassModal: () => void;
  
  // Component name
  setComponentName: (name: string) => void;
  
  // Reset
  resetConfig: () => void;
}

/**
 * Combined CVA context value
 */
export interface CVAContextValue extends CVAState, CVAActions {}

