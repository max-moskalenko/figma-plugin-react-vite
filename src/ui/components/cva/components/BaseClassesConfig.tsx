import { useState, useMemo } from "react";
import { useCVA } from "../CVAContext";
import { ClassCategory, ExtractedClass } from "../types";
import { 
  CLASS_CATEGORIES, 
  groupClassesByCategory, 
  getSelectedCount, 
  getTotalCount,
  filterClasses 
} from "../utils/classManager";
import "./BaseClassesConfig.scss";

/**
 * Base Classes Configuration component
 * Table-based layout matching the variants matrix UI
 */
export function BaseClassesConfig() {
  const { extractedClasses, toggleBaseClass, selectAllBaseClasses, deselectAllBaseClasses } = useCVA();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ClassCategory>>(
    new Set(Object.keys(CLASS_CATEGORIES) as ClassCategory[])
  );

  const filteredClasses = useMemo(() => {
    return filterClasses(extractedClasses, searchTerm);
  }, [extractedClasses, searchTerm]);

  const groupedClasses = useMemo(() => {
    return groupClassesByCategory(filteredClasses);
  }, [filteredClasses]);

  const totalSelected = getSelectedCount(extractedClasses);
  const totalClasses = getTotalCount(extractedClasses);

  const toggleCategory = (category: ClassCategory) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedCategories(new Set());
  const collapseAll = () => setCollapsedCategories(new Set(Object.keys(CLASS_CATEGORIES) as ClassCategory[]));

  if (extractedClasses.length === 0) {
    return (
      <div className="base-classes-config">
        <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
          <button className="expand-btn">{isExpanded ? "▼" : "▶"}</button>
          <h3>Base Classes</h3>
          <span className="class-count">0 / 0</span>
        </div>
        {isExpanded && (
          <div className="empty-state">
            <p>No classes extracted yet.</p>
            <p className="hint">Use the Extractor tool to get classes from your Figma component.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="base-classes-config">
      <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <button className="expand-btn">{isExpanded ? "▼" : "▶"}</button>
        <h3>Base Classes</h3>
        <span className="class-count">{totalSelected} / {totalClasses}</span>
      </div>

      {isExpanded && (
        <div className="card-content">
          <div className="controls-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="control-buttons">
              <button className="control-btn" onClick={() => selectAllBaseClasses()}>
                Select All
              </button>
              <button className="control-btn" onClick={() => deselectAllBaseClasses()}>
                Deselect All
              </button>
              <button 
                className="control-btn icon-btn"
                onClick={collapsedCategories.size > 0 ? expandAll : collapseAll}
                title={collapsedCategories.size > 0 ? "Expand all" : "Collapse all"}
              >
                {collapsedCategories.size > 0 ? "▼" : "▲"}
              </button>
            </div>
          </div>

          <div className="categories-container">
            {Array.from(groupedClasses.entries()).map(([category, classes]) => {
              if (classes.length === 0) return null;
              
              const isCollapsed = collapsedCategories.has(category);
              const categoryConfig = CLASS_CATEGORIES[category];
              const selectedInCategory = getSelectedCount(classes);

              return (
                <div key={category} className="category-section">
                  <div className="category-header" onClick={() => toggleCategory(category)}>
                    <span className="collapse-icon">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="category-name">{categoryConfig.label}</span>
                    <span className="category-count">{selectedInCategory} / {classes.length}</span>
                    <div className="category-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="action-btn"
                        onClick={() => selectAllBaseClasses(category)}
                        title="Select all"
                      >
                        +
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => deselectAllBaseClasses(category)}
                        title="Deselect all"
                      >
                        −
                      </button>
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <table className="classes-table">
                      <thead>
                        <tr>
                          <th className="col-checkbox"></th>
                          <th className="col-class">Class</th>
                          <th className="col-dom">DOM Elements</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((cls) => (
                          <ClassRow 
                            key={cls.id} 
                            extractedClass={cls}
                            onToggle={() => toggleBaseClass(cls.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ClassRowProps {
  extractedClass: ExtractedClass;
  onToggle: () => void;
}

function ClassRow({ extractedClass, onToggle }: ClassRowProps) {
  const { className, isSelected, isUsedInVariant, domElements } = extractedClass;
  const [showTooltip, setShowTooltip] = useState(false);

  const displayElements = domElements.slice(0, 2);
  const remainingCount = domElements.length - 2;

  return (
    <tr className={`class-row ${isUsedInVariant ? "used-in-variant" : ""} ${isSelected ? "selected" : ""}`}>
      <td className="checkbox-cell">
        <input
          type="checkbox"
          checked={isSelected && !isUsedInVariant}
          onChange={onToggle}
          disabled={isUsedInVariant}
        />
      </td>
      <td className="class-cell">
        <span className={`class-name ${isUsedInVariant ? "strikethrough" : ""}`}>
          {className}
        </span>
      </td>
      <td className="dom-cell">
        {domElements.length > 0 ? (
          <div 
            className="dom-badges"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {displayElements.map((el, i) => (
              <span key={i} className={`dom-badge ${isUsedInVariant ? 'muted' : ''}`} title={el}>{el}</span>
            ))}
            {remainingCount > 0 && (
              <span 
                className={`dom-badge more ${isUsedInVariant ? 'muted' : ''}`}
                title={`${remainingCount} more: ${domElements.slice(2).join(', ')}`}
              >
                +{remainingCount}
              </span>
            )}
            {showTooltip && domElements.length > 2 && (
              <div className="dom-tooltip">
                <div className="tooltip-title">Applied to:</div>
                <ul className="tooltip-list">
                  {domElements.map((el, i) => (
                    <li key={i}>{el}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export default BaseClassesConfig;
