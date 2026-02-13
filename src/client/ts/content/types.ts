export type MarketAssetDescription = {
	value: string;
	color: string;
	name: string;
}

export type MarketAssetAction = {
	link: string;
	name: string;
}

export type MarketAsset = {
	name: string;
	type: string;
	market_name: string;
	market_hash_name: string;

	currency: number;

	// Steam appid
	appid: number;
	app_icon: string;

	contextid: string;
	id: string;
	classid: string;
	instanceid: string;
	// seems to be same as id
	unowned_id: string;
	unowned_contextid: string;
	// Owner. 0 for market listings
	owner: number;

	amount: number;
	original_amount: string;

	status: number;

	name_color: string;
	background_color: string;

	icon_url: string;
	icon_url_large: string;

	descriptions: MarketAssetDescription[];
	actions: MarketAssetAction[];
	market_actions: MarketAssetAction[];

	// Indicate if this item is tradable 0 = not tradable 1 = tradable
	tradable: number;
	// Indicate if this item is marketable 0 = not marketable 1 = marketable
	marketable: number;
	// Indicate if this item is a commodity 0 = not commodity 1 = commodity
	commodity: number;
	// Indicate the delay in days before this item can be traded again
	market_tradable_restriction: number;
	// Indicate the delay in days before this item can be resold on the steam market
	market_marketable_restriction: number;

	sealed: number;
	sealed_type: number;
	// What is this array ?
	asset_properties: [];
	is_stackable: boolean;
}

export type ClassInfoTag = {
	category?: string;
	category_name?: string;
	color?: string;
	internal_name?: string;
	name?: string;
}

export type ClassInfoAppData = {
	def_index: string;
	containing_bundles?: Record<string, string>;
}

export type ClassInfo = MarketAsset & {
	app_data: ClassInfoAppData;
	tags: Record<string, ClassInfoTag>;
}
