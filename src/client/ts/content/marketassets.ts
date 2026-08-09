import { Message, Messages, ResponseInventoryAssetDatas, ResponseInventorySteamId, ResponseListingAsset, ResponseListingAssets, ResponseListingInfo } from '../messages/messages';
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
