import { ActiveInventorySetActivePage, AjaxPagingControlsGoToPage, AjaxPagingControlsSetPageSize, Message, Messages, RequestInventoryAssetDatas, RequestInventorySteamId, RequestListingAsset, RequestListingAssets, RequestListingInfo, ResponseSSRQueryData, ResponseWallet, SetInventoryFilterMessage } from '../messages/messages';

window.addEventListener('message', (event: MessageEvent<Message>) => {
	let messageData = event.data;
	let controlName: string;
	switch (messageData.action) {
		case Messages.RequestListingAssets:
			window.postMessage({ action: Messages.ResponseListingAssets, listingAssets: window.g_rgAssets, promiseId: (messageData as RequestListingAssets).promiseId }, '*');
			break;
		case Messages.RequestListingAsset:
			let asset;
			try {
				asset = window.g_rgAssets[(messageData as RequestListingAsset).appId][(messageData as RequestListingAsset).contextId][(messageData as RequestListingAsset).assetId];
			} catch (e) { }
			if (asset) {
				delete asset.$row;//delete the junk added by SIH
			}
			window.postMessage({ action: Messages.ResponseListingAsset, listingAssetDatas: asset, promiseId: (messageData as RequestListingAsset).promiseId }, '*');
			break;
		case Messages.RequestListingInfo:
			window.postMessage({ action: Messages.ResponseListingInfo, listingInfo: window.g_rgListingInfo, promiseId: (messageData as RequestListingInfo).promiseId }, '*');
			break;
		case Messages.RequestInventoryAssetDatas:
			let description;
			try {
				let appId = (messageData as RequestInventoryAssetDatas).appId;
				let contextId = (messageData as RequestInventoryAssetDatas).contextId;
				let assetId = (messageData as RequestInventoryAssetDatas).assetId;
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
				window.postMessage({ action: Messages.ResponseInventoryAssetDatas, inventoryAssetDatas: assetDatas, promiseId: (messageData as RequestInventoryAssetDatas).promiseId }, '*');
			}
			break;
		case Messages.RequestInventorySteamId:
			window.postMessage({ action: Messages.ResponseInventorySteamId, steamId: window.g_ActiveUser?.strSteamId, promiseId: (messageData as RequestInventorySteamId).promiseId }, '*');
			break;
		case Messages.SetInventoryFilter:
			if (window.g_ActiveInventory && window.g_ActiveInventory.LoadCompleteInventory) {
				window.g_ActiveInventory.LoadCompleteInventory().done(() => window.Filter.UpdateTagFiltering((messageData as SetInventoryFilterMessage).filter));
			}
			break;
		case Messages.ActiveInventorySetActivePage:
			if (window.g_ActiveInventory) {
				let page = Math.max(Math.min((messageData as ActiveInventorySetActivePage).page, window.g_ActiveInventory.m_cPages), 1);
				window.g_ActiveInventory.SetActivePage(page - 1)
			}
			break;
		case Messages.AjaxPagingControlsGoToPage:
			controlName = (messageData as AjaxPagingControlsGoToPage).name;
			if (controlName) {
				let control = (window as any)[controlName] as any;
				if (control) {
					let page = Math.max(Math.min((messageData as AjaxPagingControlsGoToPage).page, control.m_cMaxPages), 1);
					control.GoToPage(page - 1);
				}
			}
			break;
		case Messages.AjaxPagingControlsSetPageSize:
			controlName = (messageData as AjaxPagingControlsSetPageSize).name;
			let control = (window as any)[controlName] as any;
			if (control) {
				const oldPage = control.m_iCurrentPage;
				const oldPageSize = control.m_cPageSize;
				control.m_cPageSize = (messageData as AjaxPagingControlsSetPageSize).pageSize;
				const page = Math.floor((oldPage * oldPageSize) / (messageData as AjaxPagingControlsSetPageSize).pageSize);
				if (!isNaN(page)) {
					control.GoToPage(page, true);
				}

			}
			break;
		case Messages.RequestSSRQueryData:
			window.postMessage({ action: Messages.ResponseSSRQueryData, queryData: (window as any).SSR?.renderContext?.queryData, promiseId: (messageData as RequestInventorySteamId).promiseId } as ResponseSSRQueryData, '*');
			break;
		case Messages.RequestWallet:
			window.postMessage({ action: Messages.ResponseWallet, wallet: (window as any).g_rgWalletInfo, promiseId: (messageData as RequestInventorySteamId).promiseId } as ResponseWallet, '*');
			break;
	}
});

window.postMessage({ action: 'injected_ready' }, '*');
