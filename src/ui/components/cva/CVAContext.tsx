import { createContext, useContext, ReactNode } from "react";
import { useCVAState } from "./hooks/useCVAState";
import { CVAContextValue } from "./types";

/**
 * CVA Context for sharing state across CVA tool components
 */
const CVAContext = createContext<CVAContextValue | null>(null);

/**
 * CVA Provider component
 */
interface CVAProviderProps {
  children: ReactNode;
}

export function CVAProvider({ children }: CVAProviderProps) {
  const cvaState = useCVAState();

  return (
    <CVAContext.Provider value={cvaState}>
      {children}
    </CVAContext.Provider>
  );
}

/**
 * Hook to access CVA context
 * Throws an error if used outside of CVAProvider
 */
export function useCVA(): CVAContextValue {
  const context = useContext(CVAContext);
  
  if (!context) {
    throw new Error("useCVA must be used within a CVAProvider");
  }
  
  return context;
}

/**
 * Hook to access CVA context optionally (returns null if not in provider)
 */
export function useCVAOptional(): CVAContextValue | null {
  return useContext(CVAContext);
}

export { CVAContext };

