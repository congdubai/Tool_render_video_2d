import React from "react";
import { SceneTimeline, StoryboardProject } from "@animation";
import storyboardRaw from "./storyboard.json";

const project = storyboardRaw as unknown as StoryboardProject;

export const Video: React.FC = () => {
  return <SceneTimeline project={project} />;
};

