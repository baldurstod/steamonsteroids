window.addEventListener('message', event => {
	let messageData = event.data;
	let controlName: string;
	switch (messageData.action) {
		case 'requestListingAssets':
			window.postMessage({ action: 'responseListingAssets', listingAssets: window.g_rgAssets, promiseId: messageData.promiseId }, '*');
			break;
		case 'requestListingAsset':
			let asset;
			try {
				asset = window.g_rgAssets[messageData.appId][messageData.contextId][messageData.assetId];
			} catch (e) { }
			if (asset) {
				delete asset.$row;//delete the junk added by SIH
			}
			window.postMessage({ action: 'responseListingAsset', listingAssetDatas: asset, promiseId: messageData.promiseId }, '*');
			break;
		case 'requestListingInfo':
			window.postMessage({ action: 'responseListingInfo', listingInfo: window.g_rgListingInfo, promiseId: messageData.promiseId }, '*');
			break;
		case 'requestInventoryAssetDatas':
			let description;
			try {
				let appId = messageData.appId;
				let contextId = messageData.contextId;
				let assetId = messageData.assetId;
				description = window.g_rgAppContextData?.[appId]?.rgContexts?.[contextId]?.inventory?.m_rgAssets?.[assetId]?.description;
				if (!description) {
					// We are in a trade window. Search the asset in both inventories
					description = window.UserYou?.rgAppInfo?.[appId]?.rgContexts?.[contextId]?.inventory?.rgInventory?.[assetId] ?? window.UserThem?.rgAppInfo?.[appId]?.rgContexts?.[contextId]?.inventory?.rgInventory?.[assetId];
				}
			} catch (e) { }
			if (description) {
				let assetDatas = {
					market_hash_name: description.market_hash_name,
					appid: description.appid,
					classid: description.classid,
					actions: description.actions,
					id: description.id
				};
				window.postMessage({ action: 'responseInventoryAssetDatas', inventoryAssetDatas: assetDatas, promiseId: messageData.promiseId }, '*');
			}
			break;
		case 'requestInventorySteamId':
			window.postMessage({ action: 'responseInventorySteamId', steamId: window.g_ActiveUser?.strSteamId, promiseId: messageData.promiseId }, '*');
			break;
		case 'setInventoryFilter':
			if (window.g_ActiveInventory && window.g_ActiveInventory.LoadCompleteInventory) {
				window.g_ActiveInventory.LoadCompleteInventory().done(() => window.Filter.UpdateTagFiltering(messageData.filter));
			}
			break;
		case 'activeInventorySetActivePage':
			if (window.g_ActiveInventory) {
				let page = Math.max(Math.min(messageData.page, window.g_ActiveInventory.m_cPages), 1);
				window.g_ActiveInventory.SetActivePage(page - 1)
			}
			break;
		case 'AjaxPagingControlsGoToPage':
			controlName = messageData.name;
			if (controlName) {
				let control = (window as any)[controlName] as any;
				if (control) {
					let page = Math.max(Math.min(messageData.page, control.m_cMaxPages), 1);
					control.GoToPage(page - 1);
				}
			}
			break;
		case 'AjaxPagingControlsSetPageSize':
			controlName = messageData.name;
			let control = (window as any)[controlName] as any;
			if (control) {
				const oldPage = control.m_iCurrentPage;
				const oldPageSize = control.m_cPageSize;
				control.m_cPageSize = messageData.pageSize;
				const page = Math.floor((oldPage * oldPageSize) / messageData.pageSize);
				if (!isNaN(page)) {
					control.GoToPage(page, true);
				}

			}
			break;
	}
});
