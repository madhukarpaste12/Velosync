export const parseVeloSyncQrCode = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const match = /^VS-(\d+)$/i.exec(trimmed);

  if (!match) return null;

  return `VS-${match[1]}`;
};

export const isValidVeloSyncQrCode = (value) => Boolean(parseVeloSyncQrCode(value));
