import { createContext, useContext, ReactNode } from "react";
import { useCVAState } from "./hooks/useCVAState";
import { CVAContextValue } from "./types";

/**
 * CVA Context for sharing state across CVA tool components
 * 
 * This context provides a centralized state management solution for the CVA tool,
 * making state and actions available to all child components without prop drilling.
 * 
 * STATE INCLUDES:
 * - mode: Current view mode (mapping or code)
 * - extractorResult: Data from the DOM extractor tool
 * - componentProperties: Figma component properties and variants
 * - extractedClasses: All CSS classes extracted from the component with metadata
 * - config: CVA configuration (base classes, variants, compound variants, defaults)
 * - classModalTarget: Currently open class selection modal target
 * 
 * ACTIONS INCLUDE:
 * - Mode switching (setMode)
 * - Data loading (setExtractorResult)
 * - Base class management (toggleBaseClass, selectAllBaseClasses, etc.)
 * - Variant management (addVariant, removeVariant, renameVariant, etc.)
 * - Property and value management (addProperty, renamePropertyValue, etc.)
 * - Prefix slot management (addPrefixSlot, setPrefixSlotClasses, etc.)
 * - Compound and default variants (addCompoundVariant, setDefaultVariant, etc.)
 * - Modal management (openClassModal, closeClassModal)
 */
const CVAContext = createContext<CVAContextValue | null>(null);

/**
 * Props for CVAProvider component
 */
interface CVAProviderProps {
  children: ReactNode;
}

/**
 * CVA Provider component
 * 
 * Wraps the CVA tool and provides state management via React Context.
 * Uses the useCVAState hook to manage all CVA-related state and actions,
 * then makes them available to all child components through context.
 * 
 * USAGE:
 * ```tsx
 * <CVAProvider>
 *   <CVAToolContent />
 * </CVAProvider>
 * ```
 * 
 * Child components can access state and actions using the useCVA() hook.
 * 
 * @param children - Child components that need access to CVA state
 */
export function CVAProvider({ children }: CVAProviderProps) {
  // Initialize CVA state management hook
  const cvaState = useCVAState();

  return (
    <CVAContext.Provider value={cvaState}>
      {children}
    </CVAContext.Provider>
  );
}

/**
 * Hook to access CVA context
 * 
 * Provides access to all CVA state and actions. Must be used within a CVAProvider,
 * otherwise throws an error.
 * 
 * USAGE:
 * ```tsx
 * function MyComponent() {
 *   const { mode, config, addVariant, renameVariant } = useCVA();
 *   // ... use state and actions
 * }
 * ```
 * 
 * @throws Error if used outside of CVAProvider
 * @returns CVAContextValue with all state and actions
 */
export function useCVA(): CVAContextValue {
  const context = useContext(CVAContext);
  
  if (!context) {
    throw new Error("useCVA must be used within a CVAProvider");
  }
  
  return context;
}

/**
 * Hook to access CVA context optionally
 * 
 * Similar to useCVA(), but returns null instead of throwing an error when used
 * outside of CVAProvider. Useful for components that may or may not be within
 * the CVA tool context.
 * 
 * USAGE:
 * ```tsx
 * function OptionalComponent() {
 *   const cva = useCVAOptional();
 *   if (!cva) return null; // Not in CVA context
 *   // ... use CVA state
 * }
 * ```
 * 
 * @returns CVAContextValue if inside CVAProvider, null otherwise
 */
export function useCVAOptional(): CVAContextValue | null {
  return useContext(CVAContext);
}

export { CVAContext };

