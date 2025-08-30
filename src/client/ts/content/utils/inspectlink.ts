export function getInspectLink(listingDatas: any/*TODO: change type*/, listingOrSteamId: string, assetId?: number) {
	if (listingDatas.actions) {
		for (let action of listingDatas.actions) {
			let link = action.link;
			if (link && link.startsWith('steam://rungame/')) {
				return link.replace('%listingid%', listingOrSteamId).replace('%owner_steamid%', listingOrSteamId).replace('%assetid%', assetId ?? listingDatas.id);
			}
		}
	}
}
