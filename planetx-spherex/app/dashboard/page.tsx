'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import LoadingScreen from './LoadingScreen';
import TitleInput from '../../components/titleInput';

type MapItem = {
	[key: string]: unknown;
	access_url?: string | null;
};

type Observation = {
	accessUrl: string;
	imageUrl: string;
	metadata: MapItem;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const DETECTOR_BANDS: Record<string, { wavelength: string; resolvingPower: number }> = {
	'1': { wavelength: '0.75 - 1.09 µm', resolvingPower: 39 },
	'2': { wavelength: '1.10 - 1.62 µm', resolvingPower: 41 },
	'3': { wavelength: '1.63 - 2.41 µm', resolvingPower: 41 },
	'4': { wavelength: '2.42 - 3.82 µm', resolvingPower: 35 },
	'5': { wavelength: '3.83 - 4.41 µm', resolvingPower: 112 },
	'6': { wavelength: '4.42 - 5.00 µm', resolvingPower: 128 },
};

function getMetadataValue(
	metadata: MapItem,
	fieldNames: string[],
	fallback = 'Unavailable',
) {
	const normalizedNames = fieldNames.map((fieldName) =>
		fieldName.toLowerCase().replace(/[_\s-]/g, ''),
	);
	const key = Object.keys(metadata).find((metadataKey) =>
		normalizedNames.includes(metadataKey.toLowerCase().replace(/[_\s-]/g, '')),
	);
	const value = key ? metadata[key] : undefined;

	if (value === null || value === undefined || value === '') {
		return fallback;
	}

	return Array.isArray(value) ? value.join(', ') : String(value);
}

function getDetectorBand(detectorValue: string | null) {
	if (!detectorValue) {
		return undefined;
	}

	const detectorNumber = detectorValue.match(/[1-6]/)?.[0];
	return detectorNumber ? DETECTOR_BANDS[detectorNumber] : undefined;
}

export default function Home() {
	const [observations, setObservations] = useState<Observation[]>([]);
	const [currentImage, setCurrentImage] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [ra, setRa] = useState('');
	const [dec, setDec] = useState('');
	const [fov, setFov] = useState('1');
	const [observationStart, setObservationStart] = useState('');
	const [observationEnd, setObservationEnd] = useState('');
	const [detector, setDetector] = useState<string | null>(null);
	const [detectorLoading, setDetectorLoading] = useState(false);
	const [detectorError, setDetectorError] = useState<string | null>(null);

	const [loading, setLoading] = useState(false);

	const loadMapItems = useCallback(async (
		rightAscension: string,
		declination: string,
		startDate: string,
		endDate: string,
		fieldOfView: string,
	) => {
		setLoading(true);
		setError(null);
		const params = new URLSearchParams({
			ra_deg: rightAscension,
			dec_deg: declination,
			max_rows: '400',
		});
		if (startDate && endDate) {
			params.set('observation_start', startDate);
			params.set('observation_end', endDate);
		}

		try {
			const response = await fetch(`${API_URL}/dashboard/map?${params}`);
			if (!response.ok) {
				const detail = await response.text();
				throw new Error(detail || `Request failed with status ${response.status}`);
			}

			const data: { rows: MapItem[]; count: number; total: number } =
				await response.json();
			const nextObservations = data.rows.flatMap((row) => {
					if (!row.access_url || typeof row.access_url !== 'string') {
						return [];
					}

					const imageParams = new URLSearchParams({
						access_url: row.access_url,
						ra_deg: rightAscension,
						dec_deg: declination,
						size_pix: '500',
						fov_val: fieldOfView,
					});
					return [{
						accessUrl: row.access_url,
						imageUrl: `${API_URL}/dashboard/image?${imageParams}`,
						metadata: row,
					}];
				});
			setObservations(nextObservations);
			setCurrentImage(0);
			if (nextObservations.length === 0) {
				setError('No observations found for this location and date range.');
			}
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: 'Unable to load SPHEREx data.',
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (observations.length < 2 || detectorLoading) {
			return;
		}

		const timer = window.setInterval(() => {
			setCurrentImage((index) => (index + 1) % observations.length);
		}, 2000);

		return () => window.clearInterval(timer);
	}, [detectorLoading, observations.length]);

	const handleSearch = () => {
		if (!ra.trim() || !dec.trim()) {
			setError('Right ascension and declination are required.');
			return;
		}
		if (Boolean(observationStart) !== Boolean(observationEnd)) {
			setError('Both observation start and end dates are required.');
			return;
		}
		if (observationStart && observationEnd && observationEnd < observationStart) {
			setError('Observation end date must be on or after the start date.');
			return;
		}

		void loadMapItems(ra, dec, observationStart, observationEnd, fov);
	};

	const currentObservation = observations[currentImage];
	const detectorBand = getDetectorBand(detector);

	useEffect(() => {
		if (!currentObservation) {
			return;
		}

		let cancelled = false;
		setDetector(null);
		setDetectorError(null);
		setDetectorLoading(true);

		const params = new URLSearchParams({
			access_url: currentObservation.accessUrl,
		});

		void fetch(`${API_URL}/dashboard/detector?${params}`)
			.then(async (response) => {
				if (!response.ok) {
					const detail = await response.text();
					throw new Error(detail || `Detector request failed with status ${response.status}`);
				}
				return response.json() as Promise<{ detector: unknown }>;
			})
			.then((data) => {
				if (!cancelled) {
					setDetector(data.detector == null ? 'Unavailable' : String(data.detector));
				}
			})
			.catch((requestError: unknown) => {
				if (!cancelled) {
					setDetectorError(
						requestError instanceof Error
							? requestError.message
							: 'Unable to load detector metadata.',
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setDetectorLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [currentObservation]);

	return (
		<section className={styles.dashboardBackground}>
			<section className={styles.dashboardPanel}>
				<h1 className={styles.title}>SphereX</h1>
				<section className={styles.inputsFlex}>
					<section className={styles.dashboardCoordsFlex}>
						<TitleInput
							id="right-ascension"
							title="Right Ascension"
							value={ra}
							onChange={(event) => setRa(event.target.value)}
							aria-label="Right ascension in degrees"
						/>
						<TitleInput
							id="declination"
							title="Declination"
							value={dec}
							onChange={(event) => setDec(event.target.value)}
							aria-label="Declination in degrees"
						/>
						<TitleInput
							id="observation-start"
							title="Observation Start"
							type="date"
							value={observationStart}
							onChange={(event) => setObservationStart(event.target.value)}
							aria-label="Observation start date"
						/>
						<TitleInput
							id="observation-end"
							title="Observation End"
							type="date"
							value={observationEnd}
							onChange={(event) => setObservationEnd(event.target.value)}
							aria-label="Observation end date"
						/>
					</section>
					<label className={styles.fovControl} htmlFor="field-of-view">
						<span className={styles.fovLabel}>
							Field of View: {fov}°
						</span>
						<input
							id="field-of-view"
							className={styles.fovSlider}
							type="range"
							min="0.1"
							max="10"
							step="0.1"
							value={fov}
							onChange={(event) => setFov(event.target.value)}
							aria-label="Field of view in degrees"
						/>
					</label>
					<button onClick={handleSearch} disabled={loading}>
						{loading ? 'Loading...' : 'Search'}
					</button>
				</section>
			</section>
			<section className={styles.dashboardMap}>
				{loading && (
					<LoadingScreen />
				)}
				{!loading && error && <p role="alert">{error}</p>}
				{!loading && !error && currentObservation && (
					<section className={styles.imageCarousel}>
						<img
							className={styles.dashboardImage}
							src={currentObservation.imageUrl}
							alt={`SPHEREx observation ${currentImage + 1} of ${observations.length}`}
						/>
						<p>
							Image {currentImage + 1} of {observations.length}
						</p>
					</section>
				)}
			</section>
			{!loading && !error && currentObservation && (
				<section className={styles.dashboardMetadata}>
					<h2>Observation Metadata</h2>
					<p>RA: {getMetadataValue(currentObservation.metadata, ['ra', 'ra_deg', 'raj2000'], ra)}</p>
					<p>DEC: {getMetadataValue(currentObservation.metadata, ['dec', 'dec_deg', 'dej2000'], dec)}</p>
					<p>
						Detector:{' '}
						{detectorLoading
							? '...'
							: detectorError
								? detectorError
								: detector ?? 'Unavailable'}
					</p>
					<p>
						Wavelength:{' '}
						{detectorBand
							? `${detectorBand.wavelength} (R=${detectorBand.resolvingPower})`
							: 'Unavailable'}
					</p>
				</section>
			)}
		</section>
	);
}
