// engine/v5-context-exporter.js — AI Context Package Exporter (V5)
// Packages all project script, audio metadata, SRT, capabilities, style profiles,
// and prompts into clean, portable ZIP / JSON / Markdown bundles for ChatGPT & Claude.

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { exportFullAiCapabilityRegistry } from './v5-capability-registry.js';
import { getStyleProfile, buildCharacterContinuityProfile } from './v5-style-profiles.js';
import { generateDirectorPrompt } from './v5-prompt-generator.js';

export function buildAiContextPackage(projectData = {}) {
  const capabilities = exportFullAiCapabilityRegistry();
  const styleProfile = getStyleProfile(projectData.styleProfileId || 'educational_cartoon');

  const characters = (projectData.selectedCharacterIds || ['doc', 'jake']).map(cid => {
    return buildCharacterContinuityProfile(cid);
  });

  const projectContext = {
    id: projectData.id || `proj_${Date.now()}`,
    title: projectData.title || projectData.name || 'Dự Án Hoạt Hình 2D',
    durationMs: projectData.durationMs || Math.round((projectData.duration || 60) * 1000),
    language: projectData.language || 'vi',
    resolution: projectData.resolution || { width: 1280, height: 720 },
    fps: projectData.fps || 24,
    styleProfileId: styleProfile.id,
    script: projectData.script || '',
    srt: projectData.srt || '',
    characterProfiles: characters
  };

  const directorPrompt = generateDirectorPrompt(projectContext, capabilities.capabilities, styleProfile);

  return {
    manifest: {
      packageVersion: '5.1',
      createdAt: new Date().toISOString(),
      projectId: projectContext.id,
      title: projectContext.title
    },
    projectContext,
    scriptText: projectContext.script,
    subtitlesSrt: projectContext.srt,
    capabilities,
    styleProfile,
    characterProfiles: characters,
    directorPromptMarkdown: directorPrompt
  };
}

/**
 * Exports AI Context Package to a portable ZIP file.
 */
export function exportAiContextZip(projectData, outZipPath) {
  const pkg = buildAiContextPackage(projectData);
  const zip = new AdmZip();

  zip.addFile('project_context.json', Buffer.from(JSON.stringify(pkg.projectContext, null, 2), 'utf-8'));
  zip.addFile('script.txt', Buffer.from(pkg.scriptText || '', 'utf-8'));
  zip.addFile('subtitles.srt', Buffer.from(pkg.subtitlesSrt || '', 'utf-8'));
  zip.addFile('capabilities.json', Buffer.from(JSON.stringify(pkg.capabilities, null, 2), 'utf-8'));
  zip.addFile('style_profile.json', Buffer.from(JSON.stringify(pkg.styleProfile, null, 2), 'utf-8'));
  zip.addFile('character_profiles.json', Buffer.from(JSON.stringify(pkg.characterProfiles, null, 2), 'utf-8'));
  zip.addFile('director_prompt.md', Buffer.from(pkg.directorPromptMarkdown || '', 'utf-8'));

  if (outZipPath) {
    const parentDir = path.dirname(outZipPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    zip.writeZip(outZipPath);
    return outZipPath;
  }

  return zip.toBuffer();
}

/**
 * Exports a single Markdown text ready to copy-paste directly into ChatGPT or Claude.
 */
export function exportAiContextMarkdown(projectData) {
  const pkg = buildAiContextPackage(projectData);
  return pkg.directorPromptMarkdown;
}

