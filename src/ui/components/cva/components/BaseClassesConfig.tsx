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
 * Allows users to select which classes should be included in the CVA base
 */
export function BaseClassesConfig() {
  const { extractedClasses, toggleBaseClass, selectAllBaseClasses, deselectAllBaseClasses } = useCVA();
  
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ClassCategory>>(
    new Set(Object.keys(CLASS_CATEGORIES) as ClassCategory[]) // All collapsed by default
  );

  // Filter classes based on search
  const filteredClasses = useMemo(() => {
    return filterClasses(extractedClasses, searchTerm);
  }, [extractedClasses, searchTerm]);

  // Group classes by category
  const groupedClasses = useMemo(() => {
    return groupClassesByCategory(filteredClasses);
  }, [filteredClasses]);

  // Total counts
  const totalSelected = getSelectedCount(extractedClasses);
  const totalClasses = getTotalCount(extractedClasses);

  // Toggle category collapse
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

  // Expand all categories
  const expandAll = () => {
    setCollapsedCategories(new Set());
  };

  // Collapse all categories
  const collapseAll = () => {
    setCollapsedCategories(new Set(Object.keys(CLASS_CATEGORIES) as ClassCategory[]));
  };

  if (extractedClasses.length === 0) {
    return (
      <div className="base-classes-config">
        <div className="base-classes-empty">
          <p>No classes extracted yet.</p>
          <p className="hint">Use the Extractor tool to get classes from your Figma component.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="base-classes-config">
      <div className="base-classes-header" onClick={() => setIsExpanded(!isExpanded)}>
        <button className="expand-btn">
          {isExpanded ? "▼" : "▶"}
        </button>
        <h3>Base Classes</h3>
        <span className="class-count">{totalSelected} / {totalClasses}</span>
      </div>

      {isExpanded && (
        <>
          <div className="base-classes-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="control-buttons">
              <button 
                className="control-btn"
                onClick={() => selectAllBaseClasses()}
                title="Select all classes"
              >
                Select All
              </button>
              <button 
                className="control-btn"
                onClick={() => deselectAllBaseClasses()}
                title="Deselect all classes"
              >
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

          <div className="base-classes-list">
        {Array.from(groupedClasses.entries()).map(([category, classes]) => {
          if (classes.length === 0) return null;
          
          const isCollapsed = collapsedCategories.has(category);
          const categoryConfig = CLASS_CATEGORIES[category];
          const selectedInCategory = getSelectedCount(classes);
          const totalInCategory = classes.length;

          return (
            <div key={category} className="class-category">
              <button 
                className="category-header"
                onClick={() => toggleCategory(category)}
              >
                <span className="collapse-icon">{isCollapsed ? "▶" : "▼"}</span>
                <span className="category-label">{categoryConfig.label}</span>
                <span className="category-count">
                  {selectedInCategory} / {totalInCategory}
                </span>
                <div className="category-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="action-btn"
                    onClick={() => selectAllBaseClasses(category)}
                    title="Select all in category"
                  >
                    +
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => deselectAllBaseClasses(category)}
                    title="Deselect all in category"
                  >
                    −
                  </button>
                </div>
              </button>
              
              {!isCollapsed && (
                <div className="category-classes">
                  {classes.map((cls) => (
                    <ClassItem
                      key={cls.id}
                      extractedClass={cls}
                      onToggle={() => toggleBaseClass(cls.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Individual class item component
 */
interface ClassItemProps {
  extractedClass: ExtractedClass;
  onToggle: () => void;
}

function ClassItem({ extractedClass, onToggle }: ClassItemProps) {
  const { className, isSelected, isUsedInVariant } = extractedClass;

  return (
    <label 
      className={`class-item ${isUsedInVariant ? "used-in-variant" : ""} ${isSelected ? "selected" : ""}`}
      title={isUsedInVariant ? "Used in a variant (removed from base)" : className}
    >
      <input
        type="checkbox"
        checked={isSelected && !isUsedInVariant}
        onChange={onToggle}
        disabled={isUsedInVariant}
      />
      <span className="class-name">{className}</span>
      {isUsedInVariant && (
        <span className="variant-indicator" title="Used in variant">V</span>
      )}
    </label>
  );
}

export default BaseClassesConfig;

