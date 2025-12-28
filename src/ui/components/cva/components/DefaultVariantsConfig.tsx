import { useCVA } from "../CVAContext";
import "./DefaultVariantsConfig.scss";

/**
 * Default Variants Configuration component
 * Table-based layout matching the variants matrix UI
 */
export function DefaultVariantsConfig() {
  const { 
    config,
    setDefaultVariant,
    removeDefaultVariant,
  } = useCVA();

  // Get all unique property names from variants
  const allPropertyNames = new Set<string>();
  config.variants.forEach(variant => {
    variant.properties.forEach(prop => {
      allPropertyNames.add(prop.name);
    });
  });

  // Get all property values for a given property name
  const getPropertyValues = (propertyName: string): string[] => {
    const values = new Set<string>();
    config.variants.forEach(variant => {
      variant.properties.forEach(prop => {
        if (prop.name === propertyName) {
          prop.values.forEach(val => values.add(val.name));
        }
      });
    });
    return Array.from(values);
  };

  if (allPropertyNames.size === 0) {
    return null;
  }

  const propertyList = Array.from(allPropertyNames);

  return (
    <div className="default-variants-config">
      <div className="section-header">
        <h3>Default Variants</h3>
      </div>

      <div className="table-container">
        <table className="defaults-table">
          <thead>
            <tr>
              <th className="col-property">Property</th>
              <th className="col-default">Default Value</th>
            </tr>
          </thead>
          <tbody>
            {propertyList.map(propName => {
              const values = getPropertyValues(propName);
              const currentDefault = config.defaultVariants[propName];

              return (
                <tr key={propName}>
                  <td className="property-cell">
                    <span className="prop-name">{propName}</span>
                  </td>
                  <td className="default-cell">
                    <select
                      className="default-select"
                      value={currentDefault || ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDefaultVariant(propName, e.target.value);
                        } else {
                          removeDefaultVariant(propName);
                        }
                      }}
                    >
                      <option value="">No default</option>
                      {values.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DefaultVariantsConfig;
