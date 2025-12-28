import { useCVA } from "../CVAContext";
import { BaseClassesConfig } from "./BaseClassesConfig";
import { VariantCard } from "./VariantCard";
import { CompoundVariantsConfig } from "./CompoundVariantsConfig";
import { DefaultVariantsConfig } from "./DefaultVariantsConfig";
import "./MappingMode.scss";

/**
 * Mapping Mode container
 * Contains the full mapping UI: base classes, variant cards, default/compound variants
 * All sections scroll together - no fixed elements
 */
export function MappingMode() {
  const { config, addVariant } = useCVA();

  return (
    <div className="mapping-mode">
      {/* Base Classes */}
      <BaseClassesConfig />

      {/* Variants Header */}
      <div className="variants-header">
        <h3>Variants</h3>
        <button className="add-variant-btn" onClick={addVariant}>
          + Add Variant
        </button>
      </div>

      {/* Variants List */}
      {config.variants.length === 0 ? (
        <div className="no-variants">
          <p>No variants configured yet.</p>
          <p className="hint">Click "Add Variant" to create your first variant configuration.</p>
        </div>
      ) : (
        config.variants.map(variant => (
          <VariantCard
            key={variant.id}
            variant={variant}
          />
        ))
      )}

      {/* Default Variants */}
      {config.variants.length > 0 && <DefaultVariantsConfig />}

      {/* Compound Variants */}
      {config.variants.length > 0 && <CompoundVariantsConfig />}
    </div>
  );
}

export default MappingMode;
