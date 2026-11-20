import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import storyboardData from "./storyboard.json";

export const Root: React.FC = () => {
  return (
    <Composition
      id="StickmanLongStoryboard"
      component={Video}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

