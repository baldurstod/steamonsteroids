const legacyPaintKits = new Map<number, string>();

export function setLegacyPaintKit(oldId: number, newId: string) {
	legacyPaintKits.set(oldId, newId.replace(/\~\d+/, ''));
}

export function getLegacyPaintKit(id: number): string | number {
	return legacyPaintKits.get(id) ?? id;
}
