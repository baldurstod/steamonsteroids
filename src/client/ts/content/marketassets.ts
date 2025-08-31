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

	static #onMessage(event: MessageEvent) {
		let messageData = event.data;
		//console.log(event);
		switch (messageData.action) {
			case 'responseListingAssets':
				let apps = messageData.listingAssets;
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
				resolvePromise(messageData.promiseId);
				break;
			case 'responseListingAsset':
				resolvePromise(messageData.promiseId, messageData.listingAssetDatas);
				break;
			case 'responseListingInfo':
				let listings = messageData.listingInfo;
				for (let listingId in listings) {
					let listingDatas = listings[listingId];
					this.#listingInfos.set(listingId, listingDatas);
				}
				resolvePromise(messageData.promiseId);
				break;
			case 'responseInventoryAssetDatas':
				resolvePromise(messageData.promiseId, messageData.inventoryAssetDatas);
				break;
			case 'responseInventorySteamId':
				resolvePromise(messageData.promiseId, messageData.steamId);
				break;
		}
	}

	static async getListingInfo(listingId: string) {
		let { promise, promiseId } = createPromise();
		requestListingInfo(promiseId);
		await promise;
		return this.#listingInfos.get(listingId);
	}

	static async getListingAssetData(listingId: string) {
		let listingInfo = await this.getListingInfo(listingId);
		let asset = listingInfo?.asset;
		let assetData = await getListingAsset(asset?.appid, asset?.contextid, asset?.id);
		return assetData;
	}
}

function requestListingAssets(promiseId: number) {
	window.postMessage({ action: 'requestListingAssets', promiseId: promiseId }, '*');
}

function requestListingAsset(appId: number, contextId: number, assetId: number, promiseId: number) {
	window.postMessage({ action: 'requestListingAsset', appId: appId, contextId: contextId, assetId: assetId, promiseId: promiseId }, '*');
}

function requestListingInfo(promiseId: number) {
	window.postMessage({ action: 'requestListingInfo', promiseId: promiseId }, '*');
}

function requestInventoryAssetDatas(appId: number, contextId: number, assetId: number, promiseId: number) {
	window.postMessage({ action: 'requestInventoryAssetDatas', appId: appId, contextId: contextId, assetId: assetId, promiseId: promiseId }, '*');
}

function requestInventorySteamId(promiseId: number) {
	window.postMessage({ action: 'requestInventorySteamId', promiseId: promiseId }, '*');
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

export async function getInventorySteamId() {
	let { promise, promiseId } = createPromise();
	requestInventorySteamId(promiseId);
	return promise;
}
