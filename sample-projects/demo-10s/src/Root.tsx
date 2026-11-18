import React from "react";
import { Composition } from "remotion";
import { VideoDemo } from "./Video";

export const Root: React.FC = () => {
  return (
    <Composition
      id="DemoAnimation10s"
      component={VideoDemo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

