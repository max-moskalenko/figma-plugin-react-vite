import { useCVA } from "../CVAContext";
import "./DefaultVariantsConfig.scss";

/**
 * Default Variants Configuration component
 * Allows setting default values for each variant property
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

  return (
    <div className="default-variants-config">
      <div className="section-header">
        <h3>Default Variants</h3>
      </div>

      <div className="default-variants-grid">
        {Array.from(allPropertyNames).map(propName => {
          const values = getPropertyValues(propName);
          const currentDefault = config.defaultVariants[propName];

          return (
            <div key={propName} className="default-variant-item">
              <span className="prop-name">{propName}</span>
              <select
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DefaultVariantsConfig;

