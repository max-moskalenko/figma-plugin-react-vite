import { useCVA } from "../CVAContext";
import "./CompoundVariantsConfig.scss";

/**
 * Compound Variants Configuration component
 * Table-based layout matching the variants matrix UI
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
      <div className="section-header">
        <h3>Compound Variants</h3>
        <button className="add-rule-btn" onClick={addCompoundVariant}>
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
                  ×
                </button>
              </div>

              <table className="conditions-table">
                <thead>
                  <tr>
                    <th className="col-logic"></th>
                    <th className="col-property">Property</th>
                    <th className="col-equals"></th>
                    <th className="col-value">Value</th>
                    <th className="col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {rule.conditions.map((condition, condIndex) => (
                    <tr key={condition.id}>
                      <td className="logic-cell">
                        {condIndex > 0 && <span className="and-badge">AND</span>}
                      </td>
                      <td className="property-cell">
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
                      </td>
                      <td className="equals-cell">=</td>
                      <td className="value-cell">
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
                      </td>
                      <td className="actions-cell">
                        <button
                          className="remove-condition-btn"
                          onClick={() => removeCompoundCondition(rule.id, condition.id)}
                          title="Remove condition"
                          disabled={rule.conditions.length <= 1}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="rule-footer">
                <button
                  className="add-condition-btn"
                  onClick={() => addCompoundCondition(rule.id)}
                >
                  + Add condition
                </button>
              </div>

              <div className="apply-section">
                <table className="apply-table">
                  <thead>
                    <tr>
                      <th className="col-label">Apply Classes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="classes-cell">
                        <input
                          type="text"
                          className="classes-input"
                          placeholder="Enter classes (space-separated)"
                          value={rule.classes.join(" ")}
                          onChange={(e) => handleClassesChange(rule.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompoundVariantsConfig;
