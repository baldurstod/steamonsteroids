const KillStreakSheenTint = [
	[],//Invalid
	[13112335, 2646728],//Team shine
	[15903754],//Deadly Daffodil
	[16730885],//Manndarin
	[6618890],//Mean Green
	[2686790],//Agonizing Emerald
	[6886655],//Villainous Violet
	[16719615],//Hot Rod
]

export function getSheenTint(effectId: number, teamId = 0) {
	let sheenTint = 0;
	let row = KillStreakSheenTint[effectId];
	if (row) {
		sheenTint = row[teamId] ?? row[0];
	}
	return [((sheenTint >> 16) & 0xFF) / 255.0, ((sheenTint >> 8) & 0xFF) / 255.0, ((sheenTint >> 0) & 0xFF) / 255.0];
}
