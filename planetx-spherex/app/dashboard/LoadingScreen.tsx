'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './dashboard.module.css';
import dipyImage from '../../assets/dipy.png';
import dougyImage from '../../assets/dougy.png';
import NightSky from '../../components/nightSky';

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const FRAME_COUNT = 3;

type SpriteWalkerOptions = {
	frameCount: number;
	frameInterval: number;
	walkSpeed: number;
	trackWidth: number;
	isRunning: boolean;
	initialX: number;
};

function useSpriteWalker({
	frameCount,
	frameInterval,
	walkSpeed,
	trackWidth,
	isRunning,
	initialX,
}: SpriteWalkerOptions) {
	const [frame, setFrame] = useState(0);
	const [x, setX] = useState(initialX);
	const direction = useRef(1);

	useEffect(() => {
		if (!isRunning) {
			return;
		}

		const timer = window.setInterval(() => {
			setFrame((currentFrame) => (currentFrame + 1) % frameCount);
			setX((currentX) => {
				const nextX = currentX + direction.current * walkSpeed;
				if (nextX >= trackWidth || nextX <= 0) {
					direction.current *= -1;
					return Math.max(0, Math.min(trackWidth, nextX));
				}
				return nextX;
			});
		}, frameInterval);

		return () => window.clearInterval(timer);
	}, [frameCount, frameInterval, isRunning, trackWidth, walkSpeed]);

	return { frame, x, facingLeft: direction.current < 0 };
}

function Sprite({
	sprite,
	scale,
	isRunning,
	initialX,
	ariaLabel,
}: {
	sprite: string;
	scale: number;
	isRunning: boolean;
	initialX: number;
	ariaLabel: string;
}) {
	const { frame, x, facingLeft } = useSpriteWalker({
		frameCount: FRAME_COUNT,
		frameInterval: 150,
		walkSpeed: 1.5,
		trackWidth: 88,
		isRunning,
		initialX,
	});
	const displayWidth = FRAME_WIDTH * scale;
	const displayHeight = FRAME_HEIGHT * scale;
	const sheetWidth = FRAME_WIDTH * FRAME_COUNT * scale;

	return (
		<div
			className={styles.spriteWalker}
			role="img"
			aria-label={ariaLabel}
			style={{
				left: `${x}%`,
				width: displayWidth,
				height: displayHeight,
				backgroundImage: `url(${sprite})`,
				backgroundSize: `${sheetWidth}px ${displayHeight}px`,
				backgroundPosition: `-${frame * displayWidth}px 0`,
				transform: facingLeft ? 'scaleX(-1)' : 'none',
			}}
		/>
	);
}

export default function LoadingScreen() {
	return (
		<section className={styles.loadingScene} role="status" aria-live="polite">
			<NightSky />
			<Sprite
				sprite={dipyImage.src}
				scale={2}
				isRunning
				initialX={5}
				ariaLabel="Dipy walking"
			/>
			<Sprite
				sprite={dougyImage.src}
				scale={2}
				isRunning
				initialX={48}
				ariaLabel="Dougy walking"
			/>
			<p>Searching the stars...</p>
		</section>
	);
}
