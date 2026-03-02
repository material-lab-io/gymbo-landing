import React from 'react';
import { Composition } from 'remotion';
import { HeroDemo } from './compositions/HeroDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroDemo"
        component={HeroDemo}
        durationInFrames={450}
        fps={30}
        width={390}
        height={844}
        defaultProps={{}}
      />
    </>
  );
};
