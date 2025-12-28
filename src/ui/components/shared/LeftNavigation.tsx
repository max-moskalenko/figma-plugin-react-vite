import "./LeftNavigation.scss";

export type ToolType = "extractor" | "cva-mapping";

interface LeftNavigationProps {
  activeToolItem: ToolType;
  onToolChange: (tool: ToolType) => void;
  onGetCode: () => void;
  loading?: boolean;
}

/**
 * Left navigation sidebar with tool icons.
 * Provides navigation between Extractor and CVA Mapping tools.
 */
export function LeftNavigation({ activeToolItem, onToolChange, onGetCode, loading }: LeftNavigationProps) {
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

      {/* Bottom action - Get Code */}
      <div className="nav-bottom">
        <button
          className={`nav-icon action-icon ${loading ? 'loading' : ''}`}
          onClick={onGetCode}
          disabled={loading}
          title="Extract code from Figma"
          aria-label="Extract code from selected Figma component"
        >
          {loading ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="spin"
            >
              <path
                d="M12 2V6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 18V22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.3"
              />
              <path
                d="M4.93 4.93L7.76 7.76"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path
                d="M16.24 16.24L19.07 19.07"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.4"
              />
              <path
                d="M2 12H6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d="M18 12H22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.5"
              />
              <path
                d="M4.93 19.07L7.76 16.24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <path
                d="M16.24 7.76L19.07 4.93"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.6"
              />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 10L12 15L17 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 15V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}

export default LeftNavigation;
