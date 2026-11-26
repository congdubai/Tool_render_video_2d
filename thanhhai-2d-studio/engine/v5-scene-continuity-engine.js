// engine/v5-scene-continuity-engine.js — Scene Continuity & Visual State Engine (V5 Phase 3)
// Preserves character identity, outfits, prop ownership and location continuity across consecutive shots.

export const CONTINUITY_MODES = {
  CONTINUOUS: 'CONTINUOUS',
  NEW_LOCATION: 'NEW_LOCATION',
  TIME_JUMP: 'TIME_JUMP',
  FLASHBACK: 'FLASHBACK',
  INDEPENDENT_SCENE: 'INDEPENDENT_SCENE'
};

export class SceneContinuityEngine {
  constructor() {
    this.history = [];
    this.characterStates = new Map(); // charId -> state
  }

  /**
   * Resets continuity tracking
   */
  reset() {
    this.history = [];
    this.characterStates.clear();
  }

  /**
   * Propagates and resolves continuity states across a sequence of scenes
   */
  propagateContinuity(scenes = []) {
    const resolvedScenes = [];

    for (let i = 0; i < scenes.length; i++) {
      const current = { ...scenes[i] };
      const prev = i > 0 ? resolvedScenes[i - 1] : null;

      const continuityMode = (current.continuityMode || (prev ? CONTINUITY_MODES.CONTINUOUS : CONTINUITY_MODES.INDEPENDENT_SCENE)).toUpperCase();

      if (prev && continuityMode === CONTINUITY_MODES.CONTINUOUS) {
        // 1. Inherit background if not explicitly set
        if (!current.background && prev.background) {
          current.background = { ...prev.background };
        }

        // 2. Inherit character outfits and attached props if same character appears
        if (Array.isArray(current.characters)) {
          current.characters = current.characters.map(c => {
            const charId = c.characterId || c.instanceId;
            const prevChar = (prev.characters || []).find(pc => (pc.characterId || pc.instanceId) === charId);

            if (prevChar) {
              const outfitId = c.outfitId || prevChar.outfitId;
              const props = c.props || prevChar.props || [];
              return {
                ...c,
                outfitId,
                props: [...props]
              };
            }
            return c;
          });
        }
      }

      // Record state in history
      const stateSnapshot = {
        sceneId: current.id,
        index: i,
        mode: continuityMode,
        characters: (current.characters || []).map(c => ({
          id: c.characterId || c.instanceId,
          outfitId: c.outfitId,
          props: c.props || []
        }))
      };
      this.history.push(stateSnapshot);
      resolvedScenes.push(current);
    }

    return resolvedScenes;
  }

  /**
   * Checks for abnormal continuity breaks between two consecutive scenes
   */
  detectContinuityBreaks(prevScene, currentScene) {
    const warnings = [];
    if (!prevScene || !currentScene) return warnings;

    const mode = currentScene.continuityMode || CONTINUITY_MODES.CONTINUOUS;
    if (mode !== CONTINUITY_MODES.CONTINUOUS) return warnings;

    for (const currChar of (currentScene.characters || [])) {
      const charId = currChar.characterId || currChar.instanceId;
      const prevChar = (prevScene.characters || []).find(pc => (pc.characterId || pc.instanceId) === charId);

      if (prevChar) {
        // Warning if outfit unexpectedly changed without explicit scene note
        if (currChar.outfitId && prevChar.outfitId && currChar.outfitId !== prevChar.outfitId && !currentScene.visualObjective?.toLowerCase().includes('thay đồ')) {
          warnings.push({
            type: 'UNEXPECTED_OUTFIT_CHANGE',
            sceneId: currentScene.id,
            characterId: charId,
            prevOutfit: prevChar.outfitId,
            currOutfit: currChar.outfitId,
            message: `Nhân vật "${charId}" đổi trang phục bất thường từ "${prevChar.outfitId}" sang "${currChar.outfitId}" trong cảnh liên tiếp.`
          });
        }
      }
    }

    return warnings;
  }
}
