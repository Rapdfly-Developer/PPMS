/** A signed consent is locked once its signed copy is on file, until unlocked with a password. */
export const isConsentLocked = (c: { signedFile?: unknown; unfrozen?: unknown }) => !!c.signedFile && !c.unfrozen;
