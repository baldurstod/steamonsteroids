import { BoundingBox, setFetchFunction, Source1ModelInstance } from 'harmony-3d';
import { controlleraddEventListener, ControllerEvents } from './controller';
import { TF2Viewer } from './tf2/tf2viewer';
import { CS2Viewer } from './cs2/cs2viewer';
import { ACTIVE_INVENTORY_PAGE, APP_ID_CS2, APP_ID_TF2 } from '../constants';
import { getInventorySteamId, MarketAssets } from './marketassets';
import { show } from 'harmony-ui';
import { vec3 } from 'gl-matrix';

enum PageType {
	Unknown = 0,
	Market,
	Inventory,
	TradeOffer
}

class Application {
	#pageType: PageType = PageType.Unknown;
	#currentListingId: number = 0;
	#tf2Viewer = new TF2Viewer();
	#cs2Viewer = new CS2Viewer();
	#htmlState?: HTMLElement;
	#htmlCanvasItemInfo?: HTMLElement;
	#htmlRowContainer?: HTMLElement;
	#currentAppId: number = 0;
	#currentAssetId: number = 0;
	#currentContextId: number = 0;
	#inventoryItem: any/*TODO:better type*/;

	constructor() {
		this.#initPageType();
		if (!isChromium()) {
			setFetchFunction(async (resource, options) => await this.#backgroundFetch(resource, options));
		}
		this.#initEvents();
	}

	async #backgroundFetch(resource: RequestInfo | URL, options?: RequestInit) {
		const result = await chrome.runtime.sendMessage({
			action: 'fetch',
			resource: resource,
			options: options,
		});
		const encoder = new TextEncoder(/*'x-user-defined'*/);
		let blob;
		try {
			blob = new File([result.body], '', { type: 'application/octet-stream' });
			const blobAB = await blob.arrayBuffer();
		} catch (e) {
			console.log(e);
		}

		const test = new Uint8Array(result.test);

		if (result.ab instanceof ArrayBuffer) {
			return new Response(result.ab, { status: result.status, statusText: result.statusText });
		}

		return new Response(test, { status: result.status, statusText: result.statusText });
	}

	#initPageType() {
		switch (true) {
			case document.URL.startsWith('https://steamcommunity.com/market/'):
				this.#pageType = PageType.Market;
				break;
			case document.URL.startsWith('https://steamcommunity.com/tradeoffer/'):
				this.#pageType = PageType.TradeOffer;
				break;
			case document.URL.includes('/inventory'):
				this.#pageType = PageType.Inventory;
				break;
			default:
				this.#pageType = PageType.Unknown;
		}
	}

	#initEvents() {
		controlleraddEventListener(ControllerEvents.Tf2RefreshListing, () => this.#refreshTf2Listing());
		controlleraddEventListener(ControllerEvents.ClearMarketListing, () => this.#clearMarketListing());
		controlleraddEventListener(ControllerEvents.SetGenerationState, (event: Event) => this.setGenerationState((event as CustomEvent).detail));
		controlleraddEventListener(ControllerEvents.ShowRowContainer, () => show(this.#htmlRowContainer));
		controlleraddEventListener(ControllerEvents.SelectInventoryItem, (event: Event) => {
			const detail = (event as CustomEvent).detail;
			this.#setSelectedInventoryItem(detail.assetId, detail.htmlImg);
		});
		controlleraddEventListener(ControllerEvents.CenterCameraTarget, (event: Event) => this.#centerCameraTarget((event as CustomEvent).detail));
		controlleraddEventListener(ControllerEvents.SetCameraTarget, (event: Event) => {
			const detail = (event as CustomEvent).detail;
			this.#setCameraTarget(detail.target, detail.position);
		});
		controlleraddEventListener(ControllerEvents.SetItemInfo, (event: Event) => this.#setItemInfo((event as CustomEvent).detail));
	}

	async #refreshTf2Listing() {
		switch (this.#pageType) {
			case PageType.Market:
				await this.renderListing(this.#currentListingId, true);
				break;
			case PageType.Inventory:
				await this.renderInventoryListing(this.#currentAppId, this.#currentContextId, this.#currentAssetId, undefined, true);
				break;
		}
	}

	#clearMarketListing() {
		this.#setItemInfo('');
	}

	async renderListing(listingId: number, force = false) {
		if (force || (this.#currentListingId != listingId)) {
			this.#tf2Viewer.hide();
			this.#cs2Viewer.hide();
			this.#currentListingId = listingId;
			let asset = await MarketAssets.getListingAssetData(listingId);
			if (asset) {
				this.setGenerationState(GenerationState.RetrievingItemDatas);
				switch (asset.appid) {
					case APP_ID_TF2:
						chrome.runtime.sendMessage({ action: 'get-asset-class-info', appId: asset.appid, classId: asset.classid }, (classInfo) => {
							this.#tf2Viewer.renderListingTF2(listingId, asset, classInfo);
						});
						break;
					case APP_ID_CS2:
						//this.csgoViewer.renderListingCSGO(listingId, asset);
						break;
				}
			}
		}
	}

	async renderInventoryListing(appId: number, contextId: number, assetId: number, htmlImg?: HTMLImageElement, force = false) {
		//console.log(assetId);
		if (force || (this.#currentAssetId != assetId)) {
			this.#currentAppId = appId;
			this.#currentContextId = contextId;
			this.#currentAssetId = assetId;
			let activeInventoryPage = document.getElementById(ACTIVE_INVENTORY_PAGE);
			if (activeInventoryPage) {
				activeInventoryPage.parentNode.insertBefore(this.htmlRowContainer, activeInventoryPage);
			} else {
				let tradeArea = document.getElementsByClassName('trade_area')[0];
				if (tradeArea) {
					tradeArea.parentNode.insertBefore(this.htmlRowContainer, tradeArea);
				}
			}
			let asset = await MarketAssets.getInventoryAssetDatas(appId, contextId, assetId);
			if (asset) {
				this.setGenerationState(GenerationState.RetrievingItemDatas);
				let steamUserId = await getInventorySteamId();
				switch (asset.appid) {
					case APP_ID_TF2:
						chrome.runtime.sendMessage({ action: 'get-asset-class-info', appId: asset.appid, classId: asset.classid }, (classInfo) => {
							this.#tf2Viewer.renderListingTF2(steamUserId, asset, classInfo, assetId, htmlImg);
						});
						break;
					case APP_ID_CS2:
						this.#cs2Viewer.renderListingCSGO(steamUserId, asset, assetId);
						break;
				}
			}
		}
	}

	setGenerationState(state: GenerationState) {
		if (!this.#htmlState) {
			return;
		}
		this.#htmlState.className = 'texture-generation-state';
		switch (state) {
			case GenerationState.Started:
				this.#htmlState.innerHTML = 'Generating...';
				this.#htmlState.classList.add('waiting');
				break;
			case GenerationState.Sucess:
				this.#htmlState.innerHTML = 'Finished';
				this.#htmlState.classList.add('success');
				break;
			case GenerationState.Failure:
				this.#htmlState.innerHTML = 'Failure';
				this.#htmlState.classList.add('failure');
				break;
			case GenerationState.LoadingModel:
				this.#htmlState.innerHTML = 'Loading model';
				this.#htmlState.classList.add('waiting');
				break;
			case GenerationState.RetrievingItemDatas:
				this.#htmlState.innerHTML = 'Retrieving item datas';
				this.#htmlState.classList.add('waiting');
				break;
		}
	}

	#setSelectedInventoryItem(assetId: any/*TODO:better type*/, inventoryItem: any/*TODO:better type*/) {
		let className = 'as-inventory-selected-item';
		if (this.inventoryItem) {
			this.inventoryItem.classList.remove(className);
		}
		inventoryItem.classList.add(className);
		this.inventoryItem = inventoryItem;

		if (this._inventoryFavorites[assetId]) {
			this.htmlRowContainer.classList.add('favorited-market-listing');
		} else {
			this.htmlRowContainer.classList.remove('favorited-market-listing');
		}
	}

	async #centerCameraTarget(sourceModel: Source1ModelInstance) {
		if (sourceModel) {
			let min = vec3.create();
			let max = vec3.create();
			let boundingBox = new BoundingBox();
			sourceModel.getBoundingBox(boundingBox);
			this.orbitCameraControl.target.position = boundingBox.center;//vec3.lerp(vec3.create(), min, max, 0.5);
			this.perspectiveCamera._position[0] = this.orbitCameraControl.target[0];
			this.perspectiveCamera._position[1] = CAMERA_DISTANCE;//TODO: set y to have the model occupy most of the canvas (inspect_panel_dist)
			this.perspectiveCamera._position[2] = this.orbitCameraControl.target[2];
			this.orbitCameraControl.update();
		}
	}

	#setCameraTarget(target: vec3, position: vec3) {
		this.orbitCameraControl.target.position = target;
		this.perspectiveCamera.position = position;
		this.orbitCameraControl.update();
	}

	#setItemInfo(info: string) {
		if (this.#htmlCanvasItemInfo) {
			this.#htmlCanvasItemInfo.innerHTML = info;
		}
	}
}

async function injectScript(path: string, tag: string) {
	var node = document.getElementsByTagName(tag)[0];
	var script = document.createElement('script');
	script.setAttribute('type', 'text/javascript');
	script.setAttribute('src', path);
	node.appendChild(script);
}
injectScript(chrome.runtime.getURL('injected.js'), 'body');
