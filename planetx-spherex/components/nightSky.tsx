'use client';

import night from './../assets/night.png';

const FRAME_COUNT = 2;

// useFrameCycle.ts
import { useEffect, useState } from 'react';

interface FrameCycleOptions {
    frameCount: number;
    frameInterval?: number;
    isRunning?: boolean; // optional: pause when timer pauses, or always animate
}

function useFrameCycle({
    frameCount,
    frameInterval = 600,
    isRunning = true,
}: FrameCycleOptions) {
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (!isRunning) return;
        const id = setInterval(() => {
            setFrame((f) => (f + 1) % frameCount);
        }, frameInterval);
        return () => clearInterval(id);
    }, [isRunning, frameCount, frameInterval]);

    return frame;
}

const NightSky = () => {
    const frame = useFrameCycle({ frameCount: FRAME_COUNT, frameInterval: 800 });

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '70%',
                zIndex: 0,
                pointerEvents: 'none',
                backgroundImage: `url(${night.src})`,
                backgroundSize: '200% 200%',
                backgroundPosition: `${frame === 0 ? '0%' : '100%'} 0%`,
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
            }}
        />
    );
};

export default NightSky;