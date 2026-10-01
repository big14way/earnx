/** Passkey accounts need a ZeroDev project; without one the option is hidden. */
export const passkeysEnabled = Boolean(import.meta.env.VITE_ZERODEV_PROJECT_ID);
