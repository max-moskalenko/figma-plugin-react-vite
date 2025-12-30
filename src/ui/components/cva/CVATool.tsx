import { useEffect, useState, useCallback, useRef } from "react";
import { useCVA } from "./CVAContext";
import { MappingMode } from "./components/MappingMode";
import { CodeMode } from "./components/CodeMode";
import { CVARightSidebar } from "./components/CVARightSidebar";
import { MultiFormatExtractionResult } from "@common/networkSides";
import "./CVATool.scss";

/**
 * Props for CVAToolContent component
 */
interface CVAToolContentProps {
  extractorResult: MultiFormatExtractionResult | null;
  sidebarWidth: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
}

/**
 * CVA Tool inner content component (uses CVA context)
 * 
 * This component renders the main CVA tool interface with:
 * - Main content area that switches between Mapping and Code modes
 * - Resizable handle for adjusting sidebar width
 * - Right sidebar with controls and configuration options
 * 
 * The component syncs the extractor result with CVA state when it changes,
 * triggering automatic class extraction and property detection.
 */
function CVAToolContent({ extractorResult, sidebarWidth, isResizing, onResizeStart }: CVAToolContentProps) {
  const { mode, setExtractorResult } = useCVA();

  // Sync extractor result with CVA state whenever it changes
  // This triggers class extraction and property detection in useCVAState
  useEffect(() => {
    setExtractorResult(extractorResult);
  }, [extractorResult, setExtractorResult]);

  return (
    <>
      {/* Main content area - switches between Mapping and Code modes */}
      <div className="cva-main-content">
        {mode === "mapping" ? <MappingMode /> : <CodeMode />}
      </div>
      
      {/* Resizable handle for adjusting sidebar width */}
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={onResizeStart}
      >
        <div className="resize-handle-line" />
      </div>
      
      {/* Right sidebar with mode toggle, summary, and action buttons */}
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <CVARightSidebar />
      </div>
    </>
  );
}

/**
 * Props for CVATool component
 */
interface CVAToolProps {
  extractorResult: MultiFormatExtractionResult | null;
}

// Sidebar width constraints
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 400;

/**
 * CVA Tool main component
 * 
 * This is the root component for the CVA (Class Variance Authority) Mapping Tool.
 * It provides a visual interface for mapping CSS classes from Figma components
 * to CVA variant configurations.
 * 
 * FEATURES:
 * - Wraps content with CVAProvider for centralized state management
 * - Manages resizable sidebar width with mouse drag interaction
 * - Constrains sidebar width between MIN_SIDEBAR_WIDTH and MAX_SIDEBAR_WIDTH
 * - Handles resize mouse events (mousedown, mousemove, mouseup)
 * 
 * LAYOUT:
 * - Main content area (left): Mapping/Code mode interface
 * - Resize handle (center): Draggable divider for adjusting sidebar width
 * - Right sidebar: Configuration options and actions
 * 
 * STATE MANAGEMENT:
 * - Uses CVAProvider to share state across all child components
 * - State includes: mode, config, extracted classes, component properties
 * 
 * @param extractorResult - Result from the DOM Extractor tool containing:
 *   - Tailwind classes and HTML structure
 *   - Component properties and variants
 *   - Raw JSON data from Figma
 */
export function CVATool({ extractorResult }: CVAToolProps) {
  // Sidebar width state (user can resize by dragging)
  const [sidebarWidth, setSidebarWidth] = useState(240);
  
  // Resize interaction state
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  /**
   * Handle mouse down on resize handle
   * Stores initial position and width for calculating resize delta
   */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth
    };
  }, [sidebarWidth]);

  /**
   * Handle resize mouse events
   * Sets up mousemove and mouseup listeners when resizing starts
   * Cleans up listeners when resizing ends or component unmounts
   */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      
      // Calculate new width based on mouse movement (moving left increases width)
      const diff = resizeRef.current.startX - e.clientX;
      let newWidth = resizeRef.current.startWidth + diff;
      
      // Constrain width to min/max bounds
      newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };
    
    // Add listeners when resizing
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    // Cleanup listeners
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Note: CVAProvider is now provided from App.tsx to persist state across tool switches
  return (
    <CVAToolContent 
      extractorResult={extractorResult} 
      sidebarWidth={sidebarWidth}
      isResizing={isResizing}
      onResizeStart={handleResizeMouseDown}
    />
  );
}

export default CVATool;

