/** A consent is locked only after Freeze is clicked (uploading the signed copy does not lock it); Unlock needs a password. */
export const isConsentLocked = (c: { signedFile?: unknown; frozen?: unknown }) => !!c.signedFile && !!c.frozen;
