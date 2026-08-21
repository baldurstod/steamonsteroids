export enum Messages {
	RequestListingAssets = 'requestlistingassets',
	RequestListingAsset = 'requestlistingasset',
	RequestListingInfo = 'requestlistinginfo',
	RequestInventoryAssetDatas = 'requestinventoryassetdatas',
	RequestInventorySteamId = 'requestinventorysteamid',
	RequestSSRQueryData = 'requestssrquerydata',
	SetInventoryFilter = 'setinventoryfilter',
	ActiveInventorySetActivePage = 'activeinventorysetactivepage',
	AjaxPagingControlsGoToPage = 'ajaxpagingcontrolsgotopage',
	AjaxPagingControlsSetPageSize = 'ajaxpagingcontrolssetpagesize',
	RequestWallet = 'requestwallet',

	ResponseListingAssets = 'responselistingassets',
	ResponseListingAsset = 'responselistingasset',
	ResponseListingInfo = 'responselistinginfo',
	ResponseInventoryAssetDatas = 'responseinventoryassetdatas',
	ResponseInventorySteamId = 'responseinventorysteamid',
	ResponseSSRQueryData = 'responsessrquerydata',
	ResponseWallet = 'responsewallet',
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

export type RequestSSR = RequestListingAssets;

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

export type ResponseSSRQueryData = Message & {
	queryData: string;
	promiseId: number;
};

export type Wallet = {
	rwgrsn: number,
	success: number,
	wallet_balance: string,
	wallet_country: string,
	wallet_currency: number
	wallet_currency_increment: string,
	wallet_delayed_balance: string,
	wallet_fee: string,
	wallet_fee_base: string,
	wallet_fee_minimum: string,
	wallet_fee_percent: string,
	wallet_market_minimum: string,
	wallet_max_balance: string,
	wallet_publisher_fee_percent_default: string,
	wallet_state: string,
	wallet_trade_max_balance: string,
}

export type ResponseWallet = Message & {
	wallet: Wallet;
	promiseId: number;
};
