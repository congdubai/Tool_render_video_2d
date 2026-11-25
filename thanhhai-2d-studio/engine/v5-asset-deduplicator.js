// engine/v5-asset-deduplicator.js — Asset Deduplication & Variant Grouping (V5 Phase 2)
// Identifies identical asset requirements across multiple scenes to avoid redundant image generations,
// while strictly preserving distinct variants (day vs night, front vs side, intact vs damaged, etc.).

export function deduplicateAssetRequirements(requirements = []) {
  const canonicalMap = new Map();
  const aliasToCanonical = new Map();

  for (const req of requirements) {
    const key = generateDeduplicationKey(req);

    if (canonicalMap.has(key)) {
      const canonical = canonicalMap.get(key);
      // Merge scene references
      const existingScenes = new Set(canonical.requiredByScenes || []);
      for (const s of (req.requiredByScenes || [])) {
        existingScenes.add(s);
      }
      canonical.requiredByScenes = Array.from(existingScenes);

      // Register alias ID
      if (req.id !== canonical.id) {
        canonical.aliasIds = canonical.aliasIds || [];
        if (!canonical.aliasIds.includes(req.id)) {
          canonical.aliasIds.push(req.id);
        }
        aliasToCanonical.set(req.id, canonical.id);
      }
    } else {
      const canonical = {
        ...req,
        canonicalId: req.id,
        aliasIds: [req.id],
        requiredByScenes: Array.from(new Set(req.requiredByScenes || [])),
        isCanonical: true,
        variantGroup: req.variantGroup || null
      };
      canonicalMap.set(key, canonical);
      aliasToCanonical.set(req.id, req.id);
    }
  }

  const deduplicatedList = Array.from(canonicalMap.values());

  return {
    canonicalRequirements: deduplicatedList,
    aliasToCanonicalMap: Object.fromEntries(aliasToCanonical.entries()),
    originalCount: requirements.length,
    canonicalCount: deduplicatedList.length,
    savedGenerations: Math.max(0, requirements.length - deduplicatedList.length)
  };
}

function generateDeduplicationKey(req) {
  const type = (req.type || req.category || 'unknown').toLowerCase();
  const nameNorm = (req.name || req.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const style = (req.styleProfileId || 'default').toLowerCase();
  
  // Distinguishing variant fields that MUST NOT be merged
  const viewDirection = (req.viewDirection || 'default').toLowerCase();
  const state = (req.state || 'normal').toLowerCase(); // e.g. normal vs broken, day vs night
  const variant = (req.variant || 'default').toLowerCase();

  return `${type}:::${nameNorm}:::${style}:::${viewDirection}:::${state}:::${variant}`;
}

export function isDistinctVariant(reqA, reqB) {
  // If different view direction, different state, or different type -> distinct
  if (reqA.type !== reqB.type) return true;
  if ((reqA.viewDirection || 'front') !== (reqB.viewDirection || 'front')) return true;
  if ((reqA.state || 'normal') !== (reqB.state || 'normal')) return true;
  if ((reqA.timeOfDay || 'day') !== (reqB.timeOfDay || 'day')) return true;
  return false;
}
