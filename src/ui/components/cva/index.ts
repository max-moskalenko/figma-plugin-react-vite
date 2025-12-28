// Main CVA Tool exports
export { CVATool } from "./CVATool";
export { CVAProvider, useCVA, useCVAOptional } from "./CVAContext";

// Types
export type {
  CVAMode,
  ClassCategory,
  ExtractedClass,
  CVAPropertyValue,
  CVAVariantProperty,
  DOMElementMapping,
  CVAVariantConfig,
  CompoundCondition,
  CompoundVariantRule,
  DefaultVariants,
  CVAConfig,
  CVAState,
  CVAActions,
  CVAContextValue,
} from "./types";

// Components
export { BaseClassesConfig } from "./components/BaseClassesConfig";
export { CVARightSidebar } from "./components/CVARightSidebar";
export { MappingMode } from "./components/MappingMode";
export { CodeMode } from "./components/CodeMode";
export { VariantCard } from "./components/VariantCard";
export { CompoundVariantsConfig } from "./components/CompoundVariantsConfig";
export { ClassSelectionModal } from "./components/ClassSelectionModal";
export { DefaultVariantsConfig } from "./components/DefaultVariantsConfig";

// Hooks
export { useCVAState } from "./hooks/useCVAState";

// Utils
export {
  CLASS_CATEGORIES,
  getClassCategory,
  groupClassesByCategory,
  getSelectedCount,
  getTotalCount,
  canAddToBase,
  filterClasses,
  sortClasses,
  parseClassString,
  joinClasses,
} from "./utils/classManager";

