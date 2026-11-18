export interface HubbleDataPoint {
  z: number;
  hz: number; // H(z) in km/s/Mpc
  err: number;
  survey: string;
}

export interface SneResidualPoint {
  z: number;
  deltaMu: number; // relative to fiducial flat LCDM (H0=67.4, Om=0.315)
  err: number;
  survey: string;
}

export interface RsdGrowthPoint {
  z: number;
  fs8: number;
  err: number;
  survey: string;
}

// Combined Cosmic Chronometers + DESI DR1 BAO effective H(z) measurements
export const HUBBLE_OBSERVATIONS: HubbleDataPoint[] = [
  { z: 0.18, hz: 75.4, err: 4.5, survey: 'CC' },
  { z: 0.30, hz: 79.8, err: 2.3, survey: 'DESI DR1 BGS' },
  { z: 0.40, hz: 83.2, err: 3.1, survey: 'CC' },
  { z: 0.51, hz: 90.4, err: 1.9, survey: 'DESI DR1 LRG1' },
  { z: 0.71, hz: 101.6, err: 2.4, survey: 'DESI DR1 LRG2' },
  { z: 0.93, hz: 116.5, err: 2.8, survey: 'DESI DR1 LRG3' },
  { z: 1.32, hz: 147.8, err: 4.1, survey: 'DESI DR1 ELG2' },
  { z: 1.49, hz: 162.0, err: 5.8, survey: 'DESI DR1 QSO' },
  { z: 1.75, hz: 184.5, err: 11.0, survey: 'CC' },
  { z: 2.33, hz: 233.6, err: 5.2, survey: 'DESI DR1 Lya' },
];

// Binned Pantheon+ Type Ia Supernova residuals relative to fiducial Planck LCDM
export const PANTHEON_PLUS_RESIDUALS: SneResidualPoint[] = [
  { z: 0.03, deltaMu: -0.145, err: 0.035, survey: 'Pantheon+' },
  { z: 0.08, deltaMu: -0.125, err: 0.028, survey: 'Pantheon+' },
  { z: 0.16, deltaMu: -0.105, err: 0.025, survey: 'Pantheon+' },
  { z: 0.28, deltaMu: -0.072, err: 0.024, survey: 'Pantheon+' },
  { z: 0.45, deltaMu: -0.048, err: 0.026, survey: 'Pantheon+' },
  { z: 0.68, deltaMu: -0.022, err: 0.030, survey: 'Pantheon+' },
  { z: 0.95, deltaMu: 0.015, err: 0.038, survey: 'Pantheon+' },
  { z: 1.35, deltaMu: 0.048, err: 0.055, survey: 'Pantheon+' },
  { z: 1.85, deltaMu: 0.075, err: 0.082, survey: 'Pantheon+' },
];

// BOSS / eBOSS / SDSS Redshift-Space Distortions growth rate f*sigma8(z)
export const RSD_GROWTH_DATA: RsdGrowthPoint[] = [
  { z: 0.15, fs8: 0.490, err: 0.045, survey: 'SDSS MGS' },
  { z: 0.38, fs8: 0.497, err: 0.045, survey: 'BOSS DR12' },
  { z: 0.51, fs8: 0.458, err: 0.038, survey: 'BOSS DR12' },
  { z: 0.61, fs8: 0.436, err: 0.034, survey: 'BOSS DR12' },
  { z: 0.70, fs8: 0.448, err: 0.043, survey: 'eBOSS LRG' },
  { z: 0.85, fs8: 0.315, err: 0.095, survey: 'eBOSS ELG' },
  { z: 1.48, fs8: 0.462, err: 0.045, survey: 'eBOSS QSO' },
];

export const FIDUCIAL_PLANCK_LCDM = {
  H0: 67.4,
  OmegaM0: 0.315,
  sigma80: 0.811,
  S8: 0.832,
  S8Err: 0.013,
};

export const SHOES_PRIOR = {
  H0: 73.04,
  err: 1.04,
};

export const KIDS1000_PRIOR = {
  S8: 0.766,
  err: 0.020,
};
