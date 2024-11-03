window.addEventListener('message', event => {
	let messageData = event.data;
	switch (messageData.action) {
		case 'requestListingAssets':
			window.postMessage({action: 'responseListingAssets', listingAssets: (window as any).g_rgAssets, promiseId:messageData.promiseId}, '*');
			break;
		case 'requestListingAsset':
			let asset;
			try {
				asset = (window as any).g_rgAssets[messageData.appId][messageData.contextId][messageData.assetId];
			} catch (e) {}
			if (asset) {
				delete asset.$row;//delete the junk added by SIH
			}
			window.postMessage({action: 'responseListingAsset', listingAssetDatas: asset, promiseId:messageData.promiseId}, '*');
			break;
		case 'requestListingInfo':
			window.postMessage({action: 'responseListingInfo', listingInfo: (window as any).g_rgListingInfo, promiseId:messageData.promiseId}, '*');
			break;
		case 'requestInventoryAssetDatas':
			let description;
			try {
				let appId = messageData.appId;
				let contextId = messageData.contextId;
				let assetId = messageData.assetId;
				description = (window as any).g_rgAppContextData?.[appId]?.rgContexts?.[contextId]?.inventory?.m_rgAssets?.[assetId]?.description;
				if (!description) {
					// We are in a trade window. Search the asset in both inventories
					description = (window as any).UserYou?.rgAppInfo?.[appId]?.rgContexts?.[contextId]?.inventory?.rgInventory?.[assetId] ?? (window as any).UserThem?.rgAppInfo?.[appId]?.rgContexts?.[contextId]?.inventory?.rgInventory?.[assetId];
				}
			} catch (e) {}
			if (description) {
				let assetDatas = {
					market_hash_name: description.market_hash_name,
					appid: description.appid,
					classid: description.classid,
					actions: description.actions,
					id: description.id
				};
				window.postMessage({action: 'responseInventoryAssetDatas', inventoryAssetDatas: assetDatas, promiseId:messageData.promiseId}, '*');
			}
			break;
		case 'requestInventorySteamId':
			window.postMessage({action: 'responseInventorySteamId', steamId: (window as any).g_ActiveUser?.strSteamId, promiseId:messageData.promiseId}, '*');
			break;
		case 'setInventoryFilter':
			if ((window as any).g_ActiveInventory && (window as any).g_ActiveInventory.LoadCompleteInventory) {
				(window as any).g_ActiveInventory.LoadCompleteInventory().done(() => (window as any).Filter.UpdateTagFiltering(messageData.filter));
			}
			break;
		case 'activeInventorySetActivePage':
			if ((window as any).g_ActiveInventory) {
				let page = Math.max(Math.min(messageData.page, (window as any).g_ActiveInventory.pageTotal), 1);
				(window as any).g_ActiveInventory.SetActivePage(page - 1)
			}
			break;
		case 'AjaxPagingControlsGoToPage':
			let controlName = messageData.name;
			if (controlName) {
				let control = window[controlName];
				if (control) {
					let page = Math.max(Math.min(messageData.page, (control as any).m_cMaxPages), 1);
					(control as any).GoToPage(page - 1);
				}
			}
			break;
	}
});
