import { useCVA } from "../CVAContext";
import "./CompoundVariantsConfig.scss";

/**
 * Compound Variants Configuration component
 * Advanced expression builder for compound variants with AND/OR logic
 */
export function CompoundVariantsConfig() {
  const {
    config,
    addCompoundVariant,
    removeCompoundVariant,
    addCompoundCondition,
    removeCompoundCondition,
    updateCompoundCondition,
    setCompoundVariantClasses,
  } = useCVA();

  // Get all unique property names and their values from variants
  const propertyOptions = new Map<string, Set<string>>();
  config.variants.forEach(variant => {
    variant.properties.forEach(prop => {
      if (!propertyOptions.has(prop.name)) {
        propertyOptions.set(prop.name, new Set());
      }
      prop.values.forEach(val => {
        propertyOptions.get(prop.name)?.add(val.name);
      });
    });
  });

  const handleClassesChange = (ruleId: string, value: string) => {
    const classes = value.trim().split(/\s+/).filter(c => c);
    setCompoundVariantClasses(ruleId, classes);
  };

  return (
    <div className="compound-variants-config">
      <div className="compound-header">
        <h4>Compound Variants</h4>
        <button className="add-btn" onClick={addCompoundVariant}>
          + Add Rule
        </button>
      </div>

      {config.compoundVariants.length === 0 ? (
        <div className="no-compound">
          <p>No compound variants configured.</p>
          <p className="hint">Add rules that apply classes when specific conditions are met.</p>
        </div>
      ) : (
        <div className="compound-rules">
          {config.compoundVariants.map((rule, ruleIndex) => (
            <div key={rule.id} className="compound-rule">
              <div className="rule-header">
                <span className="rule-label">Rule {ruleIndex + 1}</span>
                <button
                  className="remove-rule-btn"
                  onClick={() => removeCompoundVariant(rule.id)}
                  title="Remove rule"
                >
                  ✕
                </button>
              </div>

              <div className="conditions">
                <span className="conditions-label">When:</span>
                {rule.conditions.map((condition, condIndex) => (
                  <div key={condition.id} className="condition-row">
                    {condIndex > 0 && <span className="and-label">AND</span>}
                    <select
                      className="condition-select"
                      value={condition.propertyName}
                      onChange={(e) =>
                        updateCompoundCondition(
                          rule.id,
                          condition.id,
                          e.target.value,
                          condition.propertyValue
                        )
                      }
                    >
                      <option value="">Select property</option>
                      {Array.from(propertyOptions.keys()).map(propName => (
                        <option key={propName} value={propName}>
                          {propName}
                        </option>
                      ))}
                    </select>
                    <span className="equals">=</span>
                    <select
                      className="condition-select"
                      value={condition.propertyValue}
                      onChange={(e) =>
                        updateCompoundCondition(
                          rule.id,
                          condition.id,
                          condition.propertyName,
                          e.target.value
                        )
                      }
                      disabled={!condition.propertyName}
                    >
                      <option value="">Select value</option>
                      {condition.propertyName &&
                        Array.from(propertyOptions.get(condition.propertyName) || []).map(val => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                    </select>
                    <button
                      className="remove-condition-btn"
                      onClick={() => removeCompoundCondition(rule.id, condition.id)}
                      title="Remove condition"
                      disabled={rule.conditions.length <= 1}
                    >
                      −
                    </button>
                  </div>
                ))}
                <button
                  className="add-condition-btn"
                  onClick={() => addCompoundCondition(rule.id)}
                >
                  + Add condition
                </button>
              </div>

              <div className="classes-row">
                <span className="classes-label">Apply:</span>
                <input
                  type="text"
                  className="classes-input"
                  placeholder="Enter classes (space-separated)"
                  value={rule.classes.join(" ")}
                  onChange={(e) => handleClassesChange(rule.id, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompoundVariantsConfig;

