import "./LeftNavigation.scss";

export type ToolType = "extractor" | "cva-mapping";

interface LeftNavigationProps {
  activeToolItem: ToolType;
  onToolChange: (tool: ToolType) => void;
}

/**
 * Left navigation sidebar with tool icons.
 * Provides navigation between Extractor and CVA Mapping tools.
 */
export function LeftNavigation({ activeToolItem, onToolChange }: LeftNavigationProps) {
  return (
    <nav className="left-navigation">
      <div className="nav-icons">
        {/* Extractor Tool Icon */}
        <button
          className={`nav-icon ${activeToolItem === "extractor" ? "active" : ""}`}
          onClick={() => onToolChange("extractor")}
          title="Code Extractor"
          aria-label="Switch to Code Extractor tool"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 18L22 12L16 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 6L2 12L8 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* CVA Mapping Tool Icon */}
        <button
          className={`nav-icon ${activeToolItem === "cva-mapping" ? "active" : ""}`}
          onClick={() => onToolChange("cva-mapping")}
          title="CVA Mapping"
          aria-label="Switch to CVA Mapping tool"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="3"
              y="3"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="14"
              y="3"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="3"
              y="14"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="14"
              y="14"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 6.5H14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M6.5 10V14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M17.5 10V14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10 17.5H14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
}

export default LeftNavigation;

