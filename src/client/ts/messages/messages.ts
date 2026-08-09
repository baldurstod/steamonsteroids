export enum Messages {
	RequestListingAssets = 'requestlistingassets',
	RequestListingAsset = 'requestlistingasset',
	RequestListingInfo = 'requestlistinginfo',
	RequestInventoryAssetDatas = 'requestinventoryassetdatas',
	RequestInventorySteamId = 'requestinventorysteamid',
	SetInventoryFilter = 'setinventoryfilter',
	ActiveInventorySetActivePage = 'activeinventorysetactivepage',
	AjaxPagingControlsGoToPage = 'ajaxpagingcontrolsgotopage',
	AjaxPagingControlsSetPageSize = 'ajaxpagingcontrolssetpagesize',

	ResponseListingAssets = 'responselistingassets',
	ResponseListingAsset = 'responselistingasset',
	ResponseListingInfo = 'responselistinginfo',
	ResponseInventoryAssetDatas = 'responseinventoryassetdatas',
	ResponseInventorySteamId = 'responseinventorysteamid',
}

export type Message = {
	action: Messages;
};

export type RequestListingAssets = Message & {
	promiseId: number;
};

export type RequestListingAsset = Message & {
	appId: number;
	contextId: number;
	assetId: number;
	promiseId: number;
};

export type RequestListingInfo = RequestListingAssets;

export type RequestInventoryAssetDatas = RequestListingAsset;

export type RequestInventorySteamId = RequestListingAssets;

export type SetInventoryFilterMessage = Message & {
	filter: {
		Exterior: string[];
		misc: string[];
	}
};

export type ActiveInventorySetActivePage = Message & {
	page: number;
};

export type AjaxPagingControlsGoToPage = Message & {
	name: string;
	page: number;
};

export type AjaxPagingControlsSetPageSize = Message & {
	name: string;
	pageSize: number;
};

export type ResponseListingAssets = Message & {
	listingAssets: any;
	promiseId: number;
};

export type ResponseListingAsset = Message & {
	listingAssetDatas: any;
	promiseId: number;
};

export type ResponseListingInfo = Message & {
	listingInfo: any;
	promiseId: number;
};

export type ResponseInventoryAssetDatas = Message & {
	inventoryAssetDatas: {
		market_hash_name: string,
		appid: number,
		classid: string,
		actions: { link: string, name: string, }[],
		id: any,// TODO: remove ?
	};
	promiseId: number;
};

export type ResponseInventorySteamId = Message & {
	steamId: string;
	promiseId: number;
};
