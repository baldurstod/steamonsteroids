import { quat, vec3 } from 'gl-matrix';
import { AmbientLight, BoundingBox, Camera, ColorBackground, ContextObserver, Graphics, GraphicsEvent, GraphicsEvents, GraphicTickEvent, OrbitControl, Scene, Source1ModelInstance, WebGLStats } from 'harmony-3d';
import { getCharCodes } from 'harmony-binary-reader';
import { createElement, hide, show } from 'harmony-ui';
import { ACTIVE_INVENTORY_PAGE, APP_ID_CS2, APP_ID_TF2, INVENTORY_BACKGROUND_COLOR, INVENTORY_ITEM_CLASSNAME, MARKET_LISTING_BACKGROUND_COLOR, MARKET_LISTING_ROW_CLASSNAME, MOUSE_ENTER_DELAY } from '../constants';
import { GenerationState } from '../enums';
import { Controller, ControllerEvents } from './controller';
import { CS2Viewer } from './cs2/cs2viewer';
import { getInventoryAssetDatas, getInventorySteamId, MarketAssets } from './marketassets';
import { TF2Viewer } from './tf2/tf2viewer';

enum PageType {
	Unknown = 0,
	Market,
	Inventory,
	TradeOffer
}

const CAMERA_DISTANCE = 200;

function isChromium() {
	const brands = (navigator as any/*as of now, userAgentData does not exist in typescript*/)?.userAgentData?.brands;
	if (brands) {
		for (const brand of brands) {
			if (brand.brand.toLowerCase() == 'chromium') {
				return true;
			}
		}
	}
	return false;
}

export class Application {
	#htmlTradeAreaContainer?: HTMLElement;
	#htmlState?: HTMLElement;
	#htmlRowContainer: HTMLElement = createElement('div');
	#htmlCanvasItemInfo?: HTMLElement;
	#inventoryItem?: HTMLElement;
	#buttons = new Set<HTMLElement>();
	#pageType: PageType = PageType.Unknown;
	#tf2Viewer = new TF2Viewer();
	#cs2Viewer = new CS2Viewer();
	#favorites: Record<string, any/*TODO: create type*/> = {};//TODO:turn into map
	#inventoryFavorites: Record<string, any/*TODO: create type*/> = {};//TODO:turn into map
	#canvasContainer = createElement('div', { class: 'canvas-container' });
	#htmlCanvas = createElement('canvas', { parent: this.#canvasContainer }) as HTMLCanvasElement;
	#camera = new Camera({ nearPlane: 1, farPlane: 1000, verticalFov: 10 });
	#scene = new Scene({ camera: this.#camera, background: new ColorBackground({ color: MARKET_LISTING_BACKGROUND_COLOR }), childs: [this.#camera], });
	#orbitCameraControl = new OrbitControl(this.#camera);
	#currentListingId = '';
	#currentAppId = 0;
	#currentContextId = 0;
	#currentAssetId = 0;
	#isInventoryPage = false;
	#isMarketPage = false;
	#isTradeOffer = false;
	#timeouts = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

	constructor() {
		this.#initHtml();
		this.#initGraphics();
		this.#initScene();
		this.#initPageType();
		this.#initEvents();
		this.#initObserver();
		this.#loadFavorites();
	}

	#initGraphics() {
		new Graphics().initCanvas({
			canvas: this.#htmlCanvas,
			autoResize: true,
			webGL: {
				alpha: true,
				preserveDrawingBuffer: true,
				premultipliedAlpha: false,
			}
		});

		const render = (event: Event) => {
			WebGLStats.tick();
			if (this.#scene.activeCamera) {
				new Graphics().render(this.#scene, this.#scene.activeCamera, (event as CustomEvent<GraphicTickEvent>).detail.delta, {});
			}
		}

		GraphicsEvents.addEventListener(GraphicsEvent.Tick, render);
		GraphicsEvents.addEventListener(GraphicsEvent.Tick, (event) => this.#orbitCameraControl.update((event as CustomEvent<GraphicTickEvent>).detail.delta / 1000));
		new Graphics().play();

		this.#scene.addChild(this.#tf2Viewer.getScene());
		//this.#scene.addChild(this.cs2Viewer.getScene());

		ContextObserver.observe(GraphicsEvents, this.#camera);
	}

	#initScene() {
		this.#scene.addChild(new AmbientLight());
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
		Controller.addEventListener(ControllerEvents.Tf2RefreshListing, () => this.#refreshTf2Listing());
		Controller.addEventListener(ControllerEvents.ClearMarketListing, () => this.#clearMarketListing());
		Controller.addEventListener(ControllerEvents.SetGenerationState, (event: Event) => this.setGenerationState((event as CustomEvent).detail));
		Controller.addEventListener(ControllerEvents.ShowRowContainer, () => show(this.#htmlRowContainer));
		Controller.addEventListener(ControllerEvents.SelectInventoryItem, (event: Event) => {
			const detail = (event as CustomEvent).detail;
			this.#setSelectedInventoryItem(detail.assetId, detail.htmlImg);
		});
		Controller.addEventListener(ControllerEvents.CenterCameraTarget, (event: Event) => this.#centerCameraTarget((event as CustomEvent).detail));
		Controller.addEventListener(ControllerEvents.SetCameraTarget, (event: Event) => {
			const detail = (event as CustomEvent).detail;
			this.#setCameraTarget(detail.target, detail.position);
		});
		Controller.addEventListener(ControllerEvents.SetItemInfo, (event: Event) => this.#setItemInfo((event as CustomEvent).detail));
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

	async renderListing(listingId: string, force = false) {
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
						//this.cs2Viewer.renderListingCS2(listingId, asset);
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
			if (activeInventoryPage && this.#htmlRowContainer) {
				activeInventoryPage.parentNode?.insertBefore(this.#htmlRowContainer, activeInventoryPage);
			} else {
				let tradeArea = document.getElementsByClassName('trade_area')[0];
				if (tradeArea && this.#htmlRowContainer) {
					tradeArea.parentNode?.insertBefore(this.#htmlRowContainer, tradeArea);
				}
			}
			let asset = await getInventoryAssetDatas(appId, contextId, assetId);
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
						this.#cs2Viewer.renderListingCS2(steamUserId, asset, assetId);
						break;
				}
			}
		}
	}

	async #loadFavorites() {
		let marketStorage = await chrome.storage.sync.get('app.market.favoritelistings');
		let marketFavoriteListings = marketStorage['app.market.favoritelistings'];
		if (marketFavoriteListings) {
			this.#favorites = marketFavoriteListings;
		}

		let inventoryStorage = await chrome.storage.sync.get('app.inventory.favoritelistings');
		let inventoryFavoriteListings = inventoryStorage['app.inventory.favoritelistings'];
		if (inventoryFavoriteListings) {
			this.#inventoryFavorites = inventoryFavoriteListings;
		}

		this.#createButtons();
		this.#createInventoryListeners();
	}

	setGenerationState(state: GenerationState) {
		if (!this.#htmlState) {
			return;
		}
		this.#htmlState.className = 'texture-generation-state';
		switch (state) {
			case GenerationState.Started:
				this.#htmlState.innerText = 'Generating...';
				this.#htmlState.classList.add('waiting');
				break;
			case GenerationState.Sucess:
				this.#htmlState.innerText = 'Finished';
				this.#htmlState.classList.add('success');
				break;
			case GenerationState.Failure:
				this.#htmlState.innerText = 'Failure';
				this.#htmlState.classList.add('failure');
				break;
			case GenerationState.LoadingModel:
				this.#htmlState.innerText = 'Loading model';
				this.#htmlState.classList.add('waiting');
				break;
			case GenerationState.RetrievingItemDatas:
				this.#htmlState.innerText = 'Retrieving item datas';
				this.#htmlState.classList.add('waiting');
				break;
		}
	}

	#initHtml() {
		let tradeArea = document.getElementsByClassName('trade_area')[0];
		if (tradeArea) {
			this.#htmlTradeAreaContainer = createElement('div', { class: 'accurate-skins' });
			tradeArea.prepend(this.#htmlTradeAreaContainer);

			if (this.#pageType == PageType.TradeOffer) {
				let htmlTradeOfferEnabledLine = createElement('label', {
					class: 'option-line',
					parent: this.#htmlTradeAreaContainer,
					childs: [
						createElement('span', { i18n: 'Inspect warpaints', htmlFor: 'accurate-skins-enable-trade-offer' }),
					]
				});

				let htmlTradeOfferEnabled = createElement('input', {
					id: 'accurate-skins-enable-trade-offer',
					type: 'checkbox',
					parent: htmlTradeOfferEnabledLine,
					events: {
						input: (event: InputEvent) => this.#tradeActivate((event.target as HTMLInputElement).checked)
					}
				}) as HTMLInputElement;

				(async () => {
					htmlTradeOfferEnabled.checked = (await chrome.storage.sync.get('app.tradeoffer.enabled'))['app.tradeoffer.enabled'] ?? true;
				})();
			}
		}

		this.#htmlRowContainer = document.createElement('div');
		let htmlFilter = document.createElement('div');
		htmlFilter.className = 'filter_tag_button_ctn';
		htmlFilter.innerHTML = '<div class="btn_black btn_details btn_small"><span>Tradable warpaints only</span></div>';

		htmlFilter.addEventListener('click', () => window.postMessage({ action: 'setInventoryFilter', filter: { Exterior: ['TFUI_InvTooltip_BattleScared', 'TFUI_InvTooltip_FactoryNew', 'TFUI_InvTooltip_FieldTested', 'TFUI_InvTooltip_MinimalWear', 'TFUI_InvTooltip_WellWorn'], misc: ['tradable'] } }, '*'));

		let filterNode = document.getElementById('filter_tag_show')?.parentNode;
		if (filterNode && this.isInventory()) {
			filterNode.parentNode?.insertBefore(htmlFilter, filterNode.nextSibling);
		}


		this.#htmlState = document.createElement('div');

		this.#htmlRowContainer.append(this.#canvasContainer, this.#htmlState);
		hide(this.#htmlRowContainer);

		let htmlFavoriteButton = document.createElement('div');
		htmlFavoriteButton.className = 'favorite-button';
		htmlFavoriteButton.innerHTML = '<a class="item_market_action_button btn_green_white_innerfade btn_small"><span>Favorite</span></a>';
		htmlFavoriteButton.addEventListener('click', () => this.favoriteListing());

		let htmlUnFavoriteButton = document.createElement('div');
		htmlUnFavoriteButton.className = 'unfavorite-button';
		htmlUnFavoriteButton.innerHTML = '<a class="item_market_action_button btn_green_white_innerfade btn_small"><span>Unfavorite</span></a>';
		htmlUnFavoriteButton.addEventListener('click', () => this.unfavoriteListing());
		this.#htmlCanvasItemInfo = createElement('div', { class: 'canvas-container-item-info' });

		this.#canvasContainer.append(htmlFavoriteButton, htmlUnFavoriteButton, this.#htmlCanvasItemInfo, this.#tf2Viewer.initHtml()/*, this.cs2Viewer.initHtml()*/);
	}

	#tradeActivate(activate: boolean) {
		chrome.storage.sync.set({ 'app.tradeoffer.enabled': activate });
	}

	#setSelectedInventoryItem(assetId: any/*TODO:better type*/, inventoryItem: any/*TODO:better type*/) {
		let className = 'as-inventory-selected-item';
		if (this.#inventoryItem) {
			this.#inventoryItem.classList.remove(className);
		}
		inventoryItem.classList.add(className);
		this.#inventoryItem = inventoryItem;

		if (this.#htmlRowContainer) {
			if (this.#inventoryFavorites[assetId]) {
				this.#htmlRowContainer.classList.add('favorited-market-listing');
			} else {
				this.#htmlRowContainer.classList.remove('favorited-market-listing');
			}
		}
	}

	async #centerCameraTarget(sourceModel: Source1ModelInstance) {
		if (sourceModel) {
			let min = vec3.create();
			let max = vec3.create();
			let boundingBox = new BoundingBox();
			sourceModel.getBoundingBox(boundingBox);
			const pos = sourceModel.getWorldPosition();
			const rot = sourceModel.getWorldQuaternion();
			quat.invert(rot, rot);
			sourceModel.getBoundingBox(boundingBox);
			vec3.sub(pos, boundingBox.center, pos);
			vec3.transformQuat(pos, pos, rot);
			sourceModel.setPosition(vec3.negate(pos, pos));

			//this.#orbitCameraControl.target.position = boundingBox.center;//vec3.lerp(vec3.create(), min, max, 0.5);
			this.#camera._position[0] = this.#orbitCameraControl.target._position[0];
			this.#camera._position[1] = CAMERA_DISTANCE;//TODO: set y to have the model occupy most of the canvas (inspect_panel_dist)
			this.#camera._position[2] = this.#orbitCameraControl.target._position[2];
			this.#orbitCameraControl.update();
		}
	}

	#setCameraTarget(target: vec3, position: vec3) {
		this.#orbitCameraControl.target.position = target;
		this.#camera.position = position;
		this.#orbitCameraControl.update();
	}

	#setItemInfo(info: string) {
		if (this.#htmlCanvasItemInfo) {
			this.#htmlCanvasItemInfo.innerHTML = info;
		}
	}

	async favoriteListing() {
		if (this.#isInventoryPage) {
			this.favoriteInventoryListing(this.#currentAppId, this.#currentContextId, this.#currentAssetId, await getInventorySteamId());
		}
		if (this.#isMarketPage) {
			this.#favoriteMarketListing(this.#currentListingId);
		}
	}

	unfavoriteListing() {
		if (this.#isInventoryPage) {
			this.unfavoriteInventoryListing(this.#currentAppId, this.#currentContextId, this.#currentAssetId);
		}
		if (this.#isMarketPage) {
			this.unfavoriteMarketListing(this.#currentListingId);
		}
	}

	#initObserver() {
		let config = { childList: true, subtree: true };
		const mutationCallback: MutationCallback = (mutationsList, observer) => {
			for (const mutation of mutationsList) {
				let addedNodes = mutation.addedNodes;
				for (let addedNode of addedNodes) {
					if ((addedNode as HTMLElement).classList) {
						switch (true) {
							case (addedNode as HTMLElement).classList.contains(MARKET_LISTING_ROW_CLASSNAME):
								this.#createButton(addedNode as HTMLElement);
								break;
							case (addedNode as HTMLElement).classList.contains(INVENTORY_ITEM_CLASSNAME):
								this.#createInventoryListener(addedNode as HTMLElement);
								break;
						}
					}
				}
			}
			this.#createInventoryListeners();
		};

		let observer = new MutationObserver(mutationCallback);
		let searchResultsRows = document.getElementById('searchResultsRows');
		if (searchResultsRows) {
			observer.observe(searchResultsRows, config);
		}

		let inventories = document.getElementById('inventories');
		if (inventories) {
			observer.observe(inventories, config);
		}
	}

	#createButtons() {
		let listings = document.getElementsByClassName(MARKET_LISTING_ROW_CLASSNAME);
		for (let listing of listings) {
			this.#createButton(listing as HTMLElement);
		}
	}

	#createInventoryListeners() {
		let items = document.getElementsByClassName(INVENTORY_ITEM_CLASSNAME);
		for (let item of items) {
			this.#createInventoryListener(item as HTMLElement);
		}
	}

	#createInventoryListener(inventoryItem: HTMLElement) {
		this.#isInventoryPage = true;
		new Graphics().clearColor(INVENTORY_BACKGROUND_COLOR);
		this.#htmlRowContainer.className = 'as-inventory';
		if (this.#buttons.has(inventoryItem)) {
			return;
		}
		this.#buttons.add(inventoryItem);

		inventoryItem.addEventListener('click', async () => {
			if (this.#isTradeOffer) {
				let enable = (await chrome.storage.sync.get('app.tradeoffer.enabled'))['app.tradeoffer.enabled'] ?? true;
				if (!enable) {
					return;
				}
			}
			let itemDatas = getItemDatas(inventoryItem);
			if (itemDatas) {
				let htmlImg = inventoryItem.getElementsByTagName('img')[0];
				this.renderInventoryListing(itemDatas.appId, itemDatas.contextId, itemDatas.assetId, htmlImg);
			}
		});
	}

	#createButton(marketListingRow: HTMLElement) {
		this.#isMarketPage = true;
		this.#htmlRowContainer.className = 'as-market';
		if (this.#buttons.has(marketListingRow)) {
			return;
		}
		this.#buttons.add(marketListingRow);

		marketListingRow.addEventListener('mouseenter', () => this.#timeouts.set(marketListingRow, setTimeout(() => this.#renderMarketRow(marketListingRow), MOUSE_ENTER_DELAY)));
		marketListingRow.addEventListener('mouseleave', () => clearTimeout(this.#timeouts.get(marketListingRow)));

		let marketListingId = marketListingRow.id.replace('listing_', '');
		if (this.#favorites[marketListingId]) {
			marketListingRow.classList.add('favorited-market-listing');
		}
	}

	#renderMarketRow(marketListingRow: HTMLElement) {
		marketListingRow.append(this.#htmlRowContainer);
		this.renderListing(marketListingRow.id.replace('listing_', ''));
	}

	async #favoriteMarketListing(marketListingId: string) {
		let asset = await MarketAssets.getListingAssetData(marketListingId);
		if (asset) {
			this.#favorites[marketListingId] = { appId: asset.appid, marketHashName: asset.market_hash_name };
			chrome.storage.sync.set({ 'app.market.favoritelistings': this.#favorites });
		}
		document.getElementById('listing_' + marketListingId)?.classList.add('favorited-market-listing');
	}

	unfavoriteMarketListing(marketListingId: string) {
		delete this.#favorites[marketListingId];
		chrome.storage.sync.set({ 'app.market.favoritelistings': this.#favorites });
		document.getElementById('listing_' + marketListingId)?.classList.remove('favorited-market-listing');
	}

	async favoriteInventoryListing(appId: number, contextId: number, assetId: number, steamUserId: string) {
		let asset = await getInventoryAssetDatas(appId, contextId, assetId);
		if (asset) {
			this.#inventoryFavorites[assetId] = { steamUserId: steamUserId, appId: appId, contextId: contextId, marketHashName: asset.market_hash_name };
			chrome.storage.sync.set({ 'app.inventory.favoritelistings': this.#inventoryFavorites });
		}
		(document.getElementById(`${appId}_${contextId}_${assetId}`)?.parentNode as HTMLElement)?.classList.add('as-favorited-inventory-listing');
		this.#htmlRowContainer.classList.add('favorited-market-listing');
	}

	unfavoriteInventoryListing(appId: number, contextId: number, assetId: number) {
		delete this.#inventoryFavorites[assetId];
		chrome.storage.sync.set({ 'app.inventory.favoritelistings': this.#inventoryFavorites });
		(document.getElementById(`${appId}_${contextId}_${assetId}`)?.parentNode as HTMLElement)?.classList.remove('as-favorited-inventory-listing');
		this.#htmlRowContainer.classList.remove('favorited-market-listing');
	}


	isInventory() {
		return this.#pageType == PageType.Inventory;
	}

	isMarket() {
		return this.#pageType == PageType.Market;
	}

	isTradeOffer() {
		return this.#pageType == PageType.TradeOffer;
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

function getItemDatas(htmlItem: HTMLElement) {
	let regexResult = htmlItem.id.match(/(\d*)\_(\d*)\_(\d*)/);
	if (regexResult) {
		return { appId: Number(regexResult[1]), contextId: Number(regexResult[2]), assetId: Number(regexResult[3]) };
	}
	return null;
}

async function backgroundFetch(input: RequestInfo | URL, init?: RequestInit) {
	const result = await chrome.runtime.sendMessage({
		action: 'fetch',
		resource: String(input),
		options: init,
	});

	const ab = getCharCodes(atob(result.base64));

	return new Response(ab, { status: result.status, statusText: result.statusText });
}

window.fetch = async (...args) => {
	return backgroundFetch(...args);
};
