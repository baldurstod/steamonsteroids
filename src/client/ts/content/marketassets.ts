import { JSONArray, JSONObject } from 'harmony-types';
import { Message, Messages, ResponseInventoryAssetDatas, ResponseInventorySteamId, ResponseListingAsset, ResponseListingAssets, ResponseListingInfo, ResponseSSRQueryData, ResponseWallet, Wallet } from '../messages/messages';
import { getCurrency } from './market/currencies';
import { MarketAsset } from './types';

const promises = new Map<number, (value: unknown) => void>();
let nextPromiseId = 1;

function createPromise(): { promise: Promise<any>, promiseId: number } {
	let promiseId = nextPromiseId++;
	let promise = new Promise<any>((resolve, reject) => {
		//this.requestListingAssets(resolve);
		promises.set(promiseId, resolve);
	});
	return { promise: promise, promiseId: promiseId };
}

function resolvePromise(promiseId: number, resolveValue?: any) {
	let promiseResolve = promises.get(promiseId);
	if (promiseResolve) {
		promiseResolve(resolveValue);
	}
}

export type OrderBook = {
	// Steam currency. See currencies.ts
	currency: string;
	// Store buy / sell orders in a map with the price a key an count as value. Price is stored as cents
	orders: Map<number, number>;
}

/**
 * Order book, as stored by steam
 */
export type OrderBookJSON = {
	eCurrency: number;
	rgCompactBuyOrders: number[];
	rgCompactSellOrders: number[];
}

export class MarketAssets {
	static #assets = new Map<string, any/*TODO: improve type*/>();
	static #listingInfos = new Map<string, any/*TODO: improve type*/>();

	static {
		this.initMessageListener();
	}

	static initMessageListener() {
		window.addEventListener('message', event => this.#onMessage(event));
	}

	static #onMessage(event: MessageEvent<Message>) {
		let messageData = event.data;
		//console.log(event);
		switch (messageData.action) {
			case Messages.ResponseListingAssets:
				let apps = (messageData as ResponseListingAssets).listingAssets;
				for (let appId in apps) {
					let appDatas = apps[appId];
					//console.log(appDatas);
					for (let contextId in appDatas) {
						let contextDatas = appDatas[contextId];
						for (let assetId in contextDatas) {
							this.#assets.set(assetId, contextDatas[assetId]);
						}
					}
				}
				//console.log(this.assets);
				resolvePromise((messageData as ResponseListingAssets).promiseId);
				break;
			case Messages.ResponseListingAsset:
				resolvePromise((messageData as ResponseListingAsset).promiseId, (messageData as ResponseListingAsset).listingAssetDatas);
				break;
			case Messages.ResponseListingInfo:
				let listings = (messageData as ResponseListingInfo).listingInfo;
				for (let listingId in listings) {
					let listingDatas = listings[listingId];
					this.#listingInfos.set(listingId, listingDatas);
				}
				resolvePromise((messageData as ResponseListingInfo).promiseId);
				break;
			case Messages.ResponseInventoryAssetDatas:
				resolvePromise((messageData as ResponseInventoryAssetDatas).promiseId, (messageData as ResponseInventoryAssetDatas).inventoryAssetDatas);
				break;
			case Messages.ResponseInventorySteamId:
				resolvePromise((messageData as ResponseInventorySteamId).promiseId, (messageData as ResponseInventorySteamId).steamId);
			case Messages.ResponseSSRQueryData:
				resolvePromise((messageData as ResponseSSRQueryData).promiseId, (messageData as ResponseSSRQueryData).queryData);
			case Messages.ResponseWallet:
				resolvePromise((messageData as ResponseWallet).promiseId, (messageData as ResponseWallet).wallet);
				break;
		}
	}

	static async getListingInfo(listingId: string) {
		let { promise, promiseId } = createPromise();
		requestListingInfo(promiseId);
		await promise;
		return this.#listingInfos.get(listingId);
	}

	static async getListingAssetData(listingId: string): Promise<MarketAsset> {
		let listingInfo = await this.getListingInfo(listingId);
		let asset = listingInfo?.asset;
		let assetData = await getListingAsset(asset?.appid, asset?.contextid, asset?.id);
		return assetData;
	}

	/**
	 * Get buy orders. Only works for the new market version.
	 * @returns
	 */
	static async getBuyOrders(): Promise<OrderBook | null> {
		return this.#getOrders('rgCompactBuyOrders');
	}

	/**
	 * Get sell orders. Only works for the new market version.
	 * @returns
	 */
	static async getSellOrders(): Promise<OrderBook | null> {
		return this.#getOrders('rgCompactSellOrders');
	}

	/**
	 * Get buy or sell orders. Only works for the new market version.
	 * @returns
	 */
	static async #getOrders(key: 'rgCompactBuyOrders' | 'rgCompactSellOrders'): Promise<OrderBook | null> {
		const orderBook = await this.#getOrderBook();
		if (!orderBook) {
			return null;
		}

		const rgCompactBuyOrSellOrders = orderBook[key] as number[];
		if (!rgCompactBuyOrSellOrders) {
			return null;
		}

		const orders = new Map<number, number>();
		for (let i = 0; i < rgCompactBuyOrSellOrders.length; i += 2) {
			const price = rgCompactBuyOrSellOrders[i];
			const count = rgCompactBuyOrSellOrders[i + 1];

			if (price === undefined || count === undefined) {
				continue;
			}

			orders.set(price, count);
		}

		return { currency: getCurrency(orderBook.eCurrency) ?? '', orders };
	}

	static async #getOrderBook(): Promise<OrderBookJSON | null> {
		// Get SSR
		let { promise, promiseId } = createPromise();
		requestSsrQueryData(promiseId);
		const queryData = await promise;

		let queryDataJ: JSONObject;
		try {
			queryDataJ = JSON.parse(queryData);
		} catch (e) {
			return null;
		}
		const queries = queryDataJ.queries as JSONArray;
		if (!queries) {
			return null;
		}

		// Look for a query having 'market' and'orderbook' keys
		for (const query of queries) {
			const queryKey = (query as JSONObject).queryKey as JSONArray;
			if (!queryKey || queryKey[0] !== 'market' || queryKey[1] !== 'orderbook') {
				continue;
			}

			const data = ((query as JSONObject)?.state as JSONObject)?.data;
			return data as OrderBookJSON;
		}

		return null;
	}


	static async getWallet(): Promise<Wallet | null> {
		let { promise, promiseId } = createPromise();
		requestWallet(promiseId);
		const wallet = await promise;
		return wallet;
	}
}

function requestListingAssets(promiseId: number) {
	window.postMessage({ action: Messages.RequestListingAssets, promiseId: promiseId }, '*');
}

function requestListingAsset(appId: number, contextId: number, assetId: number, promiseId: number) {
	window.postMessage({ action: Messages.RequestListingAsset, appId: appId, contextId: contextId, assetId: assetId, promiseId: promiseId }, '*');
}

function requestListingInfo(promiseId: number) {
	window.postMessage({ action: Messages.RequestListingInfo, promiseId: promiseId }, '*');
}

function requestInventoryAssetDatas(appId: number, contextId: number, assetId: number, promiseId: number) {
	window.postMessage({ action: Messages.RequestInventoryAssetDatas, appId: appId, contextId: contextId, assetId: assetId, promiseId: promiseId }, '*');
}

function requestInventorySteamId(promiseId: number) {
	window.postMessage({ action: Messages.RequestInventorySteamId, promiseId: promiseId }, '*');
}

function requestSsrQueryData(promiseId: number) {
	window.postMessage({ action: Messages.RequestSSRQueryData, promiseId: promiseId }, '*');
}

function requestWallet(promiseId: number) {
	window.postMessage({ action: Messages.RequestWallet, promiseId: promiseId }, '*');
}

async function getListingAsset(appId: number, contextId: number, assetId: number) {
	let { promise, promiseId } = createPromise();
	requestListingAsset(appId, contextId, assetId, promiseId);
	return promise;
}

export async function getInventoryAssetDatas(appId: number, contextId: number, assetId: number) {
	let { promise, promiseId } = createPromise();
	requestInventoryAssetDatas(appId, contextId, assetId, promiseId);
	return promise;
}

export async function getInventorySteamId(): Promise<string> {
	let { promise, promiseId } = createPromise();
	requestInventorySteamId(promiseId);
	return promise;
}
