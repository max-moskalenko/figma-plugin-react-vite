import { useEffect, useState, useCallback, useRef } from "react";
import { CVAProvider, useCVA } from "./CVAContext";
import { MappingMode } from "./components/MappingMode";
import { CodeMode } from "./components/CodeMode";
import { CVARightSidebar } from "./components/CVARightSidebar";
import { MultiFormatExtractionResult } from "@common/networkSides";
import "./CVATool.scss";

interface CVAToolContentProps {
  extractorResult: MultiFormatExtractionResult | null;
  sidebarWidth: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
}

/**
 * CVA Tool inner content (uses CVA context)
 */
function CVAToolContent({ extractorResult, sidebarWidth, isResizing, onResizeStart }: CVAToolContentProps) {
  const { mode, setExtractorResult } = useCVA();

  // Sync extractor result with CVA state
  useEffect(() => {
    setExtractorResult(extractorResult);
  }, [extractorResult, setExtractorResult]);

  return (
    <>
      <div className="cva-main-content">
        {mode === "mapping" ? <MappingMode /> : <CodeMode />}
      </div>
      
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={onResizeStart}
      >
        <div className="resize-handle-line" />
      </div>
      
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <CVARightSidebar />
      </div>
    </>
  );
}

interface CVAToolProps {
  extractorResult: MultiFormatExtractionResult | null;
}

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 400;

/**
 * CVA Tool main component
 * Wraps content with CVA Provider for state management
 */
export function CVATool({ extractorResult }: CVAToolProps) {
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      
      const diff = resizeRef.current.startX - e.clientX;
      let newWidth = resizeRef.current.startWidth + diff;
      
      newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <CVAProvider>
      <CVAToolContent 
        extractorResult={extractorResult} 
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        onResizeStart={handleResizeMouseDown}
      />
    </CVAProvider>
  );
}

export default CVATool;

