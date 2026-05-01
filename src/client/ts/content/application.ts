import { quat, vec3 } from 'gl-matrix';
import { AmbientLight, BoundingBox, Camera, CanvasAttributes, ColorBackground, Graphics, GraphicsEvent, GraphicsEvents, GraphicTickEvent, OrbitControl, Scene, Source1ModelInstance, WebGLStats } from 'harmony-3d';
import { getCharCodes } from 'harmony-binary-reader';
import { starSVG } from 'harmony-svg';
import { JSONObject } from 'harmony-types';
import { createElement, hide, show } from 'harmony-ui';
import translationsJSON from '../../json/translations.json';
import { ACTIVE_INVENTORY_PAGE, APP_ID_CS2, APP_ID_TF2, INVENTORY_BACKGROUND_COLOR, INVENTORY_ITEM_CLASSNAME, MARKET_LISTING_BACKGROUND_COLOR, MARKET_LISTING_EFFECT_COLOR, MARKET_LISTING_NAME_CLASSNAME, MARKET_LISTING_ROW_CLASSNAME, MARKET_TF_ITEM_TITLE_CLASS, MARKET_TF_LISTING_ID, MARKET_TF_URL, MOUSE_ENTER_DELAY } from '../constants';
import { GenerationState } from '../enums';
import { ClearMarketListingEvent, Controller, ControllerEvents, SetGenerationStateEvent, SetItemInfoEvent, Tf2RefreshListing } from './controller';
import { CS2Viewer } from './cs2/cs2viewer';
import { getInventoryAssetDatas, getInventorySteamId, MarketAssets } from './marketassets';
import { MARKET_LISTING_ROW_PREFIX, MARKET_LISTINGS_ID, SEARCH_RESULT_ROWS } from './steam/constants';
import { MarketListings } from './steam/marketlistings';
import { ItemManager } from './tf2/loadout/items/itemmanager';
import { TF2_SHOWCASE_CAMERA_POSITION, TF2_SHOWCASE_CAMERA_TARGET } from './tf2/tf2constants';
import { TF2Viewer } from './tf2/tf2viewer';
import { ClassInfo, MarketAsset } from './types';

enum PageType {
	Unknown = 0,
	Market,
	Inventory,
	TradeOffer,
	MarketPlaceTf,
}

const CAMERA_DISTANCE = 200;

const AJAX_PAGING_CONTROLS = new Map([
	['tabContentsMyActiveMarketListings_controls', 'g_oMyListings'],
	['tabContentsMyMarketHistory_controls', 'g_oMyHistory'],
	['searchResults_controls', 'g_oSearchResults'],
]);

const MARKET_FULLSCREEN_PER_PAGE = 'steamonsteroids-market-fullscreen-per-page';
const MARKET_FULLSCREEN_PER_LISTING = 'steamonsteroids-market-fullscreen-per-listing';

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

type ContextPerListing = {
	//canvas: HTMLCanvasElement;
	attributes: CanvasAttributes;
	container: HTMLElement;
	scene: Scene;
	state: HTMLElement;
	info: HTMLElement;
	row: HTMLElement;
}

enum FullScreenMode {
	None = 0,
	MarketPerPage = 1,
	MarketPerListing = 2,
}

export class Application {
	#htmlTradeAreaContainer?: HTMLElement;
	#htmlPageControls: HTMLElement | null = null;
	#htmlPageControlCur: HTMLElement | null = null;
	#htmlPageControlMax: HTMLElement | null = null;
	#htmlPageControlGoto: HTMLInputElement | null = null;
	//#htmlState?: HTMLElement;
	#htmlRowContainer: HTMLElement = createElement('div');
	//#htmlCanvasItemInfo?: HTMLElement;
	#inventoryItem?: HTMLElement;
	#ajaxPagingControls = new Set<string>();
	#buttons = new Set<HTMLElement>();
	#pageType: PageType = PageType.Unknown;
	#tf2Viewer = new TF2Viewer();
	#cs2Viewer = new CS2Viewer();
	#favorites: Record<string, any/*TODO: create type*/> = {};//TODO:turn into map
	#inventoryFavorites: Record<string, any/*TODO: create type*/> = {};//TODO:turn into map
	#canvasContainer = createElement('div', { class: 'canvas-container' });
	//#htmlCanvas = createElement('canvas', { parent: this.#canvasContainer, awidth: 1000, aheight: 1000 }) as HTMLCanvasElement;
	#camera = new Camera({ nearPlane: 10, farPlane: 5000, verticalFov: 10, autoResize: true, position: [CAMERA_DISTANCE, 0, 0] });
	#scene = new Scene({ camera: this.#camera, background: new ColorBackground({ color: MARKET_LISTING_BACKGROUND_COLOR }), childs: [this.#camera], });
	#orbitCameraControl = new OrbitControl(this.#camera);
	//#currentListingId = '';
	#currentAppId = 0;
	#currentContextId = 0;
	#currentAssetId = 0;
	#isInventoryPage = false;
	#isMarketPage = false;
	#isTradeOffer = false;
	#timeouts = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
	#marketListings = new MarketListings();
	//#bipmapContext?: ImageBitmapRenderingContext | null;
	#canvasPerListing = new Map<string, ContextPerListing>();
	#active = true;
	#isFullScreen = false;
	#fullScreenMode = FullScreenMode.None;
	#weaponShowcase = false;
	#translations = new Map<string, Map<string, string>>();

	constructor() {
		this.#initTranslations();
		this.#initPageType();
		this.#initEvents();
		this.#initHtml();
		this.#initGraphics();
		this.#initScene();
		this.#initObserver();
		this.#initInventoryPageControls();
		this.#initAjaxPagingControls();
		this.#loadFavorites();
		ItemManager.initItems();
	}

	#initGraphics() {
		//this.#bipmapContext = this.#htmlCanvas!.getContext('bitmaprenderer');
		Graphics.initCanvas({
			//canvas: this.#htmlCanvas,
			useOffscreenCanvas: true,
			autoResize: false,
			webGL: {
				alpha: true,
				preserveDrawingBuffer: true,
				premultipliedAlpha: false,
			}
		});

		//Graphics.listenCanvas(this.#htmlCanvas);

		const handleTick = (event: Event) => {
			WebGLStats.tick();
			const tempVec3 = vec3.create();
			this.#camera.getWorldPosition(tempVec3);
			this.#tf2Viewer.lightsGroup.lookAt(tempVec3);

			Graphics.renderMultiCanvas((event as CustomEvent<GraphicTickEvent>).detail.delta, /*TODO: add context*/);
		}

		/*
		const render = (event: Event) => {
			WebGLStats.tick();
			if (this.#scene.activeCamera) {
				let imageBitmap;

				if (this.#bipmapContext) {

					imageBitmap = { context: this.#bipmapContext, width: this.#htmlCanvas.parentElement!.clientWidth, height: this.#htmlCanvas.parentElement!.clientHeight };
				}

				Graphics.render(this.#scene, this.#scene.activeCamera, (event as CustomEvent<GraphicTickEvent>).detail.delta, { imageBitmap: imageBitmap });
			}
		}
		*/

		GraphicsEvents.addEventListener(GraphicsEvent.Tick, handleTick);
		//GraphicsEvents.addEventListener(GraphicsEvent.Tick, (event) => this.#orbitCameraControl.update((event as CustomEvent<GraphicTickEvent>).detail.delta / 1000));
		Graphics.play();

		this.#scene.addChild(this.#tf2Viewer.getScene());
		//this.#scene.addChild(this.cs2Viewer.getScene());

		//this.#camera.addChild(this.#tf2Viewer.getCameraGroup());

		//ContextObserver.observe(GraphicsEvents, this.#camera);
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
			case document.URL.startsWith('https://marketplace.tf/'):
				this.#pageType = PageType.MarketPlaceTf;
				break;
			default:
				this.#pageType = PageType.Unknown;
		}
	}

	#initEvents() {
		addEventListener('message', event => this.#onMessage(event));

		Controller.addEventListener(ControllerEvents.Tf2RefreshVisibleListing, () => this.#refreshTf2VisibleListings());
		Controller.addEventListener(ControllerEvents.Tf2RefreshListing, (event: Event) => this.#refreshTf2Listing((event as CustomEvent<Tf2RefreshListing>).detail.listingId));
		Controller.addEventListener(ControllerEvents.ClearMarketListing, (event: Event) => this.#clearMarketListing((event as CustomEvent<ClearMarketListingEvent>).detail.listingId));
		Controller.addEventListener(ControllerEvents.SetGenerationState, (event: Event) => this.setGenerationState((event as CustomEvent<SetGenerationStateEvent>).detail.state, (event as CustomEvent<SetGenerationStateEvent>).detail.listingId));
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
		Controller.addEventListener(ControllerEvents.SetItemInfo, (event: Event) => this.#setItemInfo((event as CustomEvent<SetItemInfoEvent>).detail.listingId, (event as CustomEvent<SetItemInfoEvent>).detail.info));

		document.addEventListener('fullscreenchange', () => this.#handleFullScreenChange());
	}

	#handleFullScreenChange() {
		this.#isFullScreen = document.fullscreenElement != null;
		if (!document.fullscreenElement) {
			this.#setFullScreenMode(FullScreenMode.None);
			this.#enableAllCanvas(true);
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

		this.#createInventoryListeners();
	}

	setGenerationState(state: GenerationState, listingId: string) {
		const canvasPerListing = this.#canvasPerListing.get(listingId);

		if (!canvasPerListing) {
			return;
		}

		canvasPerListing.state.className = 'texture-generation-state';
		switch (state) {
			case GenerationState.Started:
				canvasPerListing.state.innerText = 'Generating...';
				canvasPerListing.state.classList.add('waiting');
				break;
			case GenerationState.Sucess:
				canvasPerListing.state.innerText = 'Finished';
				canvasPerListing.state.classList.add('success');
				break;
			case GenerationState.Failure:
				canvasPerListing.state.innerText = 'Failure';
				canvasPerListing.state.classList.add('failure');
				break;
			case GenerationState.LoadingModel:
				canvasPerListing.state.innerText = 'Loading model';
				canvasPerListing.state.classList.add('waiting');
				break;
			case GenerationState.RetrievingItemDatas:
				canvasPerListing.state.innerText = 'Retrieving item datas';
				canvasPerListing.state.classList.add('waiting');
				break;
			case GenerationState.WaitingForGeneration:
				canvasPerListing.state.innerText = 'Waiting for generation';
				canvasPerListing.state.classList.add('waiting');
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

		switch (this.#pageType) {
			case PageType.Market:
			case PageType.Inventory:
			case PageType.TradeOffer:

				let htmlFilter = document.createElement('div');
				htmlFilter.className = 'filter_tag_button_ctn';
				htmlFilter.innerHTML = '<div class="btn_black btn_details btn_small"><span>Tradable warpaints only</span></div>';

				htmlFilter.addEventListener('click', () => window.postMessage({ action: 'setInventoryFilter', filter: { Exterior: ['TFUI_InvTooltip_BattleScared', 'TFUI_InvTooltip_FactoryNew', 'TFUI_InvTooltip_FieldTested', 'TFUI_InvTooltip_MinimalWear', 'TFUI_InvTooltip_WellWorn'], misc: ['tradable'] } }, '*'));

				let filterNode = document.getElementById('filter_tag_show')?.parentNode;
				if (filterNode && this.isInventory()) {
					filterNode.parentNode?.insertBefore(htmlFilter, filterNode.nextSibling);
				}

				this.#htmlRowContainer.append(this.#canvasContainer);
				hide(this.#htmlRowContainer);

				break;
			case PageType.MarketPlaceTf:
				console.info(document.URL);
				this.#htmlRowContainer.append(this.#canvasContainer);
				break;
		}
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
			let boundingBox = new BoundingBox();
			sourceModel.getBoundingBox(boundingBox);
			const pos = sourceModel.getWorldPosition();
			const rot = sourceModel.getWorldQuaternion();
			quat.invert(rot, rot);
			vec3.sub(pos, boundingBox.center, pos);
			vec3.transformQuat(pos, pos, rot);
			sourceModel.setPosition(vec3.negate(pos, pos));
			this.#orbitCameraControl.update();

			return;
			/*
			//this.#orbitCameraControl.target.position = boundingBox.center;//vec3.lerp(vec3.create(), min, max, 0.5);
			this.#camera._position[0] = this.#orbitCameraControl.target._position[0];
			this.#camera._position[1] = CAMERA_DISTANCE;//TODO: set y to have the model occupy most of the canvas (inspect_panel_dist)
			this.#camera._position[2] = this.#orbitCameraControl.target._position[2];
			this.#orbitCameraControl.update();
			*/
		}
	}

	#setCameraTarget(target: vec3, position: vec3) {
		this.#orbitCameraControl.target.setPosition(target);
		const pos = this.#camera.getPosition();//TODO: optimize
		pos[2] = position[2];
		this.#camera.setPosition(position);
		this.#orbitCameraControl.update();
	}

	#setItemInfo(listingId: string, info: string): void {
		const canvasPerListing = this.#canvasPerListing.get(listingId);

		if (!canvasPerListing) {
			return;
		}

		canvasPerListing.info.innerHTML = info;
	}

	#initInventoryPageControls() {
		this.#htmlPageControls = document.getElementById('inventory_pagecontrols');
		if (this.#htmlPageControls) {
			this.#htmlPageControlCur = document.getElementById('pagecontrol_cur');
			this.#htmlPageControlMax = document.getElementById('pagecontrol_max');
			this.#htmlPageControlGoto = createElement('input', {
				type: 'number', style: 'float: left;width:50px;text-align:center;', events: {
					change: (event: InputEvent) => window.postMessage({ action: 'activeInventorySetActivePage', page: Number((event.target as HTMLInputElement).value) }, '*')
				}
			}) as HTMLInputElement;

			this.#htmlPageControls.insertBefore(this.#htmlPageControlGoto, this.#htmlPageControls.firstChild);

			const mutationCallback: MutationCallback = (mutationsList) => {
				for (const mutation of mutationsList) {
					if (mutation.target == this.#htmlPageControlCur && this.#htmlPageControlGoto) {
						this.#htmlPageControlGoto.value = this.#htmlPageControlCur.innerText;
					}
				}
			};

			let observer = new MutationObserver(mutationCallback);
			if (this.#htmlPageControls) {
				observer.observe(this.#htmlPageControls, { childList: true, characterData: true, subtree: true });
			}
		}
	}

	async #initAjaxPagingControls() {
		const mutationCallback: MutationCallback = (mutationsList) => {
			for (const mutation of mutationsList) {
				if (mutation.type === 'childList') {
					this.#initAjaxPagingControls2();
				}
			}
		};

		let observer = new MutationObserver(mutationCallback);
		observer.observe(document, { childList: true, subtree: true });

		this.#initAjaxPagingControls2();
	}

	async #initAjaxPagingControls2() {
		for (let [controlId, variable] of AJAX_PAGING_CONTROLS) {
			if (!this.#ajaxPagingControls.has(controlId)) {
				let control = document.getElementById(controlId);
				if (control) {
					this.#initAjaxPagingControls3(control, variable);
					this.#ajaxPagingControls.add(controlId);
				}
			}
		}
	}

	async #initAjaxPagingControls3(target: HTMLElement, name: string): Promise<void> {
		const htmlAjaxPagingControlGoto = createElement('input', {
			type: 'number',
			min: 1,
			value: '1',
			style: 'float: left;width:50px;text-align:center;',
			$change: (event: InputEvent) => window.postMessage({ action: 'AjaxPagingControlsGoToPage', name: name, page: Number((event.target as HTMLInputElement).value) }, '*'),
		});

		const htmlAjaxPagingControlPageSize = createElement('select', {
			class: 'steam-select',
			$change: (event: InputEvent) => window.postMessage({ action: 'AjaxPagingControlsSetPageSize', name: name, pageSize: Number((event.target as HTMLInputElement).value) }, '*'),
		});

		const pageLen = [10, 20, 100]
		for (let i of pageLen) {
			createElement('option', {
				parent: htmlAjaxPagingControlPageSize,
				value: String(i),
				innerText: String(i),
			});
		}

		target.insertBefore(htmlAjaxPagingControlPageSize, target.firstChild);
		target.insertBefore(htmlAjaxPagingControlGoto, target.firstChild);
	}

	async #toggleFavoriteListing(listingId: string) {
		if (this.#isInventoryPage) {
			this.#toggleInventoryListing(this.#currentAppId, this.#currentContextId, this.#currentAssetId, await getInventorySteamId());
		}
		if (this.#isMarketPage) {
			this.#toggleMarketListing(listingId);
		}
	}

	#initObserver() {
		let config = { childList: true, subtree: true };
		const mutationCallback: MutationCallback = (mutationsList) => {
			for (const mutation of mutationsList) {
				let addedNodes = mutation.addedNodes;
				for (let addedNode of addedNodes) {
					if ((addedNode as HTMLElement).classList) {
						switch (true) {
							case (addedNode as HTMLElement).classList.contains(MARKET_LISTING_ROW_CLASSNAME):
								this.#createButton(addedNode as HTMLElement);
								this.#addMarketListingInfo(addedNode as HTMLElement);
								if (this.#fullScreenMode === FullScreenMode.MarketPerPage) {
									this.#renderMarketRow(addedNode as HTMLElement);
								}
								break;
							case (addedNode as HTMLElement).classList.contains(INVENTORY_ITEM_CLASSNAME):
								this.#createInventoryListener(addedNode as HTMLElement);
								break;
							case (this.#pageType == PageType.MarketPlaceTf) && (addedNode as HTMLElement).classList.contains(MARKET_TF_ITEM_TITLE_CLASS):
								this.#renderMarketPlaceTf(addedNode.parentElement as HTMLElement);
								break;
						}
					}
				}
			}
			this.#createInventoryListeners();
		};

		let observer = new MutationObserver(mutationCallback);
		let searchResultsRows = document.getElementById(SEARCH_RESULT_ROWS);
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
			this.#addMarketListingInfo(listing as HTMLElement);
		}
	}

	#initMarketPlaceTf() {
		let items = document.getElementsByClassName(MARKET_TF_ITEM_TITLE_CLASS);
		for (let item of items) {
			this.#renderMarketPlaceTf(item.parentElement as HTMLElement);
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
		(this.#scene.background as ColorBackground).setColor(INVENTORY_BACKGROUND_COLOR);
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
				this.#renderInventoryListing(itemDatas.appId, itemDatas.contextId, itemDatas.assetId, htmlImg);
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

		const mouseEnter = () => {
			this.#timeouts.set(marketListingRow, setTimeout(() => {
				this.#renderMarketRow(marketListingRow);
				marketListingRow.removeEventListener('mouseenter', mouseEnter);
			}, MOUSE_ENTER_DELAY));
		};

		marketListingRow.addEventListener('mouseenter', mouseEnter);
		marketListingRow.addEventListener('mouseleave', () => clearTimeout(this.#timeouts.get(marketListingRow)));

		let marketListingId = marketListingRow.id.replace('listing_', '');
		if (this.#favorites[marketListingId]) {
			marketListingRow.classList.add('favorited-market-listing');
		}
	}

	async #addMarketListingInfo(marketListingRow: HTMLElement): Promise<void> {
		const listingId = marketListingRow.id.replace(MARKET_LISTING_ROW_PREFIX, '')
		const asset = await MarketAssets.getListingAssetData(listingId);
		if (asset) {
			switch (asset.appid) {
				case APP_ID_TF2:
					this.#addMarketListingInfoTf2(marketListingRow, asset);
					break;
			}
		}
	}


	async #addMarketListingInfoTf2(marketListingRow: HTMLElement, asset: MarketAsset): Promise<void> {
		const translations = this.#translations.get('Attrib_AttachedParticle');
		if (!translations) {
			return;
		}

		for (const description of asset.descriptions) {
			if (description.name == 'attribute') {
				for (const [lang, translation] of translations) {
					if (description.value.includes(translation)) {
						const title = marketListingRow.getElementsByClassName(MARKET_LISTING_NAME_CLASSNAME)[0];
						if (!title) {
							continue;
						}
						title.append(
							createElement('div', {
								innerText: description.value,
								style: `color:#${description.color ?? MARKET_LISTING_EFFECT_COLOR}`,
							})
						);

						// Add a thumbnail based on name
						chrome.runtime.sendMessage({ action: 'get-tf2-effect-by-name', language: lang, name: description.value.replace(translation, '') }, async (tf2Effect) => {
							if (tf2Effect) {
								const title = marketListingRow.getElementsByClassName(MARKET_LISTING_NAME_CLASSNAME)[0];
								if (!title) {
									return;
								}
								title.parentElement!.insertBefore(
									createElement('img', {
										src: `https://loadout.tf/img/unusuals/${tf2Effect.system}.webp`,
										style: 'float:left;width: 62px;height: 62px;margin: 8px 5px;',
									}),
									title,
								);
							}
						});

						return;
					}
				}
			}
		}
	}

	#renderMarketRow(marketListingRow: HTMLElement): void {
		const listingId = marketListingRow.id.replace(MARKET_LISTING_ROW_PREFIX, '')
		const htmlMarketRow = this.#marketListings.getCanvasContainer(listingId);
		if (htmlMarketRow) {
			//htmlMarketRow.append(this.#htmlRowContainer);
			this.#renderMarketListing(listingId);
		}
		/*
		marketListingRow.append(this.#htmlRowContainer);
		this.renderListing(marketListingRow.id.replace(MASKET_LISTING_ROW_PREFIX, ''));
		*/
	}

	async #toggleMarketListing(marketListingId: string) {
		if (this.#favorites[marketListingId]) {
			this.#unfavoriteMarketListing(marketListingId);
		} else {
			this.#favoriteMarketListing(marketListingId);
		}
	}

	async #favoriteMarketListing(marketListingId: string) {
		let asset = await MarketAssets.getListingAssetData(marketListingId);
		if (asset) {
			this.#favorites[marketListingId] = { appId: asset.appid, marketHashName: asset.market_hash_name };
			chrome.storage.sync.set({ 'app.market.favoritelistings': this.#favorites });
		}
		document.getElementById('listing_' + marketListingId)?.classList.add('favorited-market-listing');
	}

	#unfavoriteMarketListing(marketListingId: string) {
		delete this.#favorites[marketListingId];
		chrome.storage.sync.set({ 'app.market.favoritelistings': this.#favorites });
		document.getElementById('listing_' + marketListingId)?.classList.remove('favorited-market-listing');
	}

	async #toggleInventoryListing(appId: number, contextId: number, assetId: number, steamUserId: string) {
		if (this.#inventoryFavorites[assetId]) {
			this.#unfavoriteInventoryListing(appId, contextId, assetId);
		} else {
			this.#favoriteInventoryListing(appId, contextId, assetId, steamUserId);
		}
	}

	async #favoriteInventoryListing(appId: number, contextId: number, assetId: number, steamUserId: string) {
		let asset = await getInventoryAssetDatas(appId, contextId, assetId);
		if (asset) {
			this.#inventoryFavorites[assetId] = { steamUserId: steamUserId, appId: appId, contextId: contextId, marketHashName: asset.market_hash_name };
			chrome.storage.sync.set({ 'app.inventory.favoritelistings': this.#inventoryFavorites });
		}
		(document.getElementById(`${appId}_${contextId}_${assetId}`)?.parentNode as HTMLElement)?.classList.add('as-favorited-inventory-listing');
		this.#htmlRowContainer.classList.add('favorited-market-listing');
	}

	#unfavoriteInventoryListing(appId: number, contextId: number, assetId: number) {
		delete this.#inventoryFavorites[assetId];
		chrome.storage.sync.set({ 'app.inventory.favoritelistings': this.#inventoryFavorites });
		(document.getElementById(`${appId}_${contextId}_${assetId}`)?.parentNode as HTMLElement)?.classList.remove('as-favorited-inventory-listing');
		this.#htmlRowContainer.classList.remove('favorited-market-listing');
	}

	async #refreshTf2VisibleListings() {
		this.#weaponShowcase = false;
		switch (this.#pageType) {
			case PageType.Market:
				//await this.#renderMarketListing(this.#currentListingId, true);
				await this.#renderVisibleMarketListing();
				break;
			case PageType.Inventory:
				await this.#renderInventoryListing(this.#currentAppId, this.#currentContextId, this.#currentAssetId, undefined, true);
				break;
			case PageType.MarketPlaceTf:
				await this.#initMarketPlaceTf();
				break;
		}
	}

	async #refreshTf2Listing(listingId: string): Promise<void> {
		await this.#renderMarketListing(listingId, true);
	}

	#clearMarketListing(listingId: string) {
		this.#setItemInfo(listingId, '');
	}

	#addMarketListing(listingId: string): boolean {
		const rowCanvasContainer = this.#marketListings.getCanvasContainer(listingId);
		if (!rowCanvasContainer) {
			return false;
		}

		const listingContext = this.#canvasPerListing.get(listingId);
		if (listingContext) {
			//c.container.appendChild(this.#tf2Viewer.initHtml());
			rowCanvasContainer.append(listingContext.container, listingContext.state,);
			return false;
		}

		const row = this.#marketListings.getRow(listingId);
		if (!row) {
			return false;
		}

		const scene = this.#tf2Viewer.getListingScene(listingId);
		scene.activeCamera = this.#camera;
		const canvasAttributes = Graphics.addCanvas({ name: listingId, scene, autoResize: true });
		if (!canvasAttributes) {
			return false;
		}
		const htmlState = createElement('div');
		const htmlInfo = createElement('div', { class: 'canvas-container-item-info' });
		const htmlContainer = createElement('div', {
			class: 'canvas-container',
			childs: [
				canvasAttributes.canvas,
				htmlInfo,
				this.#tf2Viewer.initHtml(listingId),
				createElement('div', {
					class: 'fullscreen-toolbar',
					childs: [
						...this.#createFullScreenButtons(listingId),
						this.#createWeaponsShowcaseButton(listingId),
					],
				}),
				this.#createFavoritesButton(listingId),
			]
		});
		this.#canvasPerListing.set(listingId, { container: htmlContainer, attributes: canvasAttributes, scene, state: htmlState, info: htmlInfo, row },);



		rowCanvasContainer.append(htmlContainer, htmlState,);
		//const htmlCanvas = createElement('canvas', { parent: row }) as HTMLCanvasElement;
		//const bipmapContext = htmlCanvas.getContext('bitmaprenderer');

		//Graphics.listenCanvas(htmlCanvas);

		/*
		if (!bipmapContext) {
			return false;
		}
		*/
		//this.#bipmapContext = this.#htmlCanvas!.getContext('bitmaprenderer');

		//this.#bipmapContextPerListing.set(listingId, { canvas: htmlCanvas, context: bipmapContext, scene: this.#tf2Viewer.getScene(listingId) });

		return true;
	}

	#addInventoryListing(listingId: string): boolean {
		const rowCanvasContainer = this.#htmlRowContainer;
		rowCanvasContainer.replaceChildren();

		const listingContext = this.#canvasPerListing.get(listingId);
		if (listingContext) {
			//c.container.appendChild(this.#tf2Viewer.initHtml());
			rowCanvasContainer.append(listingContext.container, listingContext.state,);
			return false;
		}

		const row = this.#htmlRowContainer;

		const scene = this.#tf2Viewer.getListingScene(listingId);
		scene.activeCamera = this.#camera;
		const canvasAttributes = Graphics.addCanvas({ name: listingId, scene, autoResize: true });
		if (!canvasAttributes) {
			return false;
		}
		const htmlState = createElement('div');
		const htmlInfo = createElement('div', { class: 'canvas-container-item-info' });
		const htmlContainer = createElement('div', {
			class: 'canvas-container',
			childs: [
				canvasAttributes.canvas,
				htmlInfo,
				this.#tf2Viewer.initHtml(listingId),
				createElement('div', {
					class: 'fullscreen-toolbar',
					childs: [
						...this.#createFullScreenButtons(listingId),
						this.#createWeaponsShowcaseButton(listingId),
					],
				}),
				this.#createFavoritesButton(listingId),
			]
		});
		this.#canvasPerListing.set(listingId, { container: htmlContainer, attributes: canvasAttributes, scene, state: htmlState, info: htmlInfo, row: row },);


		rowCanvasContainer.append(htmlContainer, htmlState,);

		return true;
	}

	#addMarketPlace(listingId: string): boolean {
		const rowCanvasContainer = this.#htmlRowContainer;
		rowCanvasContainer.replaceChildren();

		const listingContext = this.#canvasPerListing.get(listingId);
		if (listingContext) {
			//c.container.appendChild(this.#tf2Viewer.initHtml());
			rowCanvasContainer.append(listingContext.container, listingContext.state,);
			return false;
		}

		const row = this.#htmlRowContainer;

		const scene = this.#tf2Viewer.getListingScene(listingId);
		scene.activeCamera = this.#camera;
		const canvasAttributes = Graphics.addCanvas({ name: listingId, scene, autoResize: true });
		if (!canvasAttributes) {
			return false;
		}
		const htmlState = createElement('div');
		const htmlInfo = createElement('div', { class: 'canvas-container-item-info' });
		const htmlContainer = createElement('div', {
			class: 'canvas-container',
			childs: [
				canvasAttributes.canvas,
				htmlInfo,
				this.#tf2Viewer.initHtml(listingId),
				createElement('div', {
					class: 'fullscreen-toolbar',
					childs: [
						...this.#createFullScreenButtonMarketPlace(listingId),
						this.#createWeaponsShowcaseButtonMarketPlace(listingId),
					],
				}),
				this.#createFavoritesButton(listingId),
			]
		});
		this.#canvasPerListing.set(listingId, { container: htmlContainer, attributes: canvasAttributes, scene, state: htmlState, info: htmlInfo, row: row },);


		rowCanvasContainer.append(htmlContainer, htmlState,);

		return true;
	}

	#createFavoritesButton(listingId: string): HTMLElement {
		return createElement('div', {
			class: 'favorite-button',
			innerHTML: starSVG,
			$click: () => this.#toggleFavoriteListing(listingId),
		});
	}

	#createFullScreenButtons(listingId: string): [HTMLElement, HTMLElement, HTMLElement] {
		const htmlFullScreenButton = createElement('div', {
			class: 'button fullscreen-button-single',
			//innerHTML: fullscreenSVG,
			innerHTML: '<a class="item_market_action_button btn_green_white_innerfade btn_small"><span>Fullscreen this item</span></a>',
			$click: () => {
				const canvasPerListing = this.#canvasPerListing.get(listingId);
				if (canvasPerListing) {
					this.#setFullScreenMode(FullScreenMode.MarketPerListing);
					canvasPerListing.row.requestFullscreen();
					this.#enableAllCanvas(false);
					const context = this.#canvasPerListing.get(listingId);
					if (context) {
						this.#enableCanvas(listingId, true);
					}
				}
			}
		});

		const htmlExitFullScreenButton = createElement('div', {
			class: 'button exit-fullscreen-button',
			innerHTML: '<a class="item_market_action_button btn_green_white_innerfade btn_small"><span>Exit fullscreen</span></a>',
			$click: () => document.exitFullscreen(),
		});

		const htmlFullScreenButton2 = createElement('div', {
			class: 'button fullscreen-button-all',
			innerHTML: '<a class="item_market_action_button btn_green_white_innerfade btn_small"><span>Fullscreen all items</span></a>',
			$click: () => {
				this.#setFullScreenMode(FullScreenMode.MarketPerPage);
				document.getElementById(MARKET_LISTINGS_ID)!.requestFullscreen().then(() => {
					this.#enableAllCanvas(true);
					const context = this.#canvasPerListing.get(listingId);
					if (context) {
						this.#enableCanvas(listingId, true);
					}
				});
				this.#renderAllRows();
			}
		});

		return [htmlFullScreenButton, htmlExitFullScreenButton, htmlFullScreenButton2];
	}

	#createFullScreenButtonMarketPlace(listingId: string): [HTMLElement, HTMLElement] {
		const htmlFullScreenButton = createElement('button', {
			class: 'button fullscreen-button-single btn btn-info btn-sm',
			innerText: 'Fullscreen this item',
			$click: () => {
				const canvasPerListing = this.#canvasPerListing.get(listingId);
				if (canvasPerListing) {
					this.#setFullScreenMode(FullScreenMode.MarketPerListing);
					canvasPerListing.row.requestFullscreen();
					this.#enableAllCanvas(false);
					const context = this.#canvasPerListing.get(listingId);
					if (context) {
						this.#enableCanvas(listingId, true);
					}
				}
			}
		});

		const htmlExitFullScreenButton = createElement('button', {
			class: 'button exit-fullscreen-button btn btn-info btn-sm',
			innerHTML: 'Exit fullscreen',
			$click: () => document.exitFullscreen(),
		});

		return [htmlFullScreenButton, htmlExitFullScreenButton];
	}

	#createWeaponsShowcaseButton(listingId: string): HTMLElement {
		return createElement('div', {
			class: 'button',
			innerHTML: '<a class="item_market_action_button btn_green_white_innerfade btn_small"><span>Weapons showcase</span></a>',
			$click: () => {
				if (!this.#weaponShowcase) {
					this.#setCameraTarget(TF2_SHOWCASE_CAMERA_TARGET, TF2_SHOWCASE_CAMERA_POSITION);
				}
				this.#weaponShowcase = true;
				this.#renderMarketListing(listingId, undefined);
			}
		});
	}

	#createWeaponsShowcaseButtonMarketPlace(listingId: string): HTMLElement {
		return createElement('button', {
			class: 'button btn btn-info btn-sm',
			innerText: 'Weapons showcase',
			$click: () => {
				if (!this.#weaponShowcase) {
					this.#setCameraTarget(TF2_SHOWCASE_CAMERA_TARGET, TF2_SHOWCASE_CAMERA_POSITION);
				}
				this.#weaponShowcase = true;
				this.#renderMarketListing(listingId, undefined);
			}
		});
	}

	#enableAllCanvas(enable: boolean): void {
		for (const [id] of this.#canvasPerListing) {
			Graphics.enableCanvas(id, enable);
		}
	}

	#enableCanvas(id: string, enable: boolean): void {
		Graphics.enableCanvas(id, enable);
	}

	#setFullScreenMode(mode: FullScreenMode) {
		this.#fullScreenMode = mode;
		document.body.classList.remove(MARKET_FULLSCREEN_PER_LISTING);
		document.body.classList.remove(MARKET_FULLSCREEN_PER_PAGE);

		switch (mode) {
			case FullScreenMode.MarketPerPage:
				document.body.classList.add(MARKET_FULLSCREEN_PER_PAGE);
				break;
			case FullScreenMode.MarketPerListing:
				document.body.classList.add(MARKET_FULLSCREEN_PER_LISTING);
				break;
		}
	}

	async #renderVisibleMarketListing(): Promise<void> {
		for (const [listingId, listing] of this.#canvasPerListing) {
			if (listing.attributes.canvas.checkVisibility()) {
				await this.#renderMarketListing(listingId, true);
			}
		}
	}

	async #renderAllRows(): Promise<void> {
		let listings = document.getElementsByClassName(MARKET_LISTING_ROW_CLASSNAME);
		for (let listing of listings) {
			this.#renderMarketRow(listing as HTMLElement);
		}
	}

	async #renderMarketListing(listingId: string, force = false) {
		//this.#tf2Viewer.hide();
		this.#cs2Viewer.hide();
		//this.#currentListingId = listingId;
		let asset = await MarketAssets.getListingAssetData(listingId);
		if (asset) {
			this.#addMarketListing(listingId);
			//this.setGenerationState(GenerationState.RetrievingItemDatas, listingId);
			switch (asset.appid) {
				case APP_ID_TF2:
					chrome.runtime.sendMessage({ action: 'get-asset-class-info', appId: asset.appid, classId: asset.classid }, (classInfo) => {
						this.#tf2Viewer.renderListingTF2(listingId, asset, classInfo, undefined, undefined, this.#weaponShowcase);
					});
					break;
				case APP_ID_CS2:
					//this.cs2Viewer.renderListingCS2(listingId, asset);
					break;
			}
		}
	}

	async #renderMarketPlaceTf(itemPanel: HTMLElement): Promise<void> {
		const url = document.URL;
		if (!url.startsWith(MARKET_TF_URL)) {
			return;
		}

		const params = url.substring(MARKET_TF_URL.length).split(';');
		if (params.length < 1) {
			return;
		}

		const defIndex = params[0]!;
		let wear = 0;
		let paintKit = -1;
		let unusual = -1;

		for (const param of params) {
			switch (true) {
				case param.startsWith('w'):// Wear
					wear = Number(param.substring(1));
					break;
				case param.startsWith('pk'):// paint kit
					paintKit = Number(param.substring(2));
					break;
				case param.startsWith('u'):// unusual
					unusual = Number(param.substring(1));// TODO: use unusual
					break;
			}
		}

		if (paintKit === -1) {
			return;
		}

		console.info(params);
		this.#addMarketPlace(MARKET_TF_LISTING_ID);

		show(this.#htmlRowContainer);
		itemPanel.append(this.#htmlRowContainer);
		this.#tf2Viewer.renderListingTF2(MARKET_TF_LISTING_ID,
			{
				name: '',
				market_hash_name: 'War Paint',
				appid: APP_ID_TF2,
			} as MarketAsset,
			{
				app_data: {
					def_index: defIndex,

				}
			} as ClassInfo, undefined, undefined, undefined,
			{
				def_index: defIndex,
				paint_wear: wear * 0.2,
				custom_paintkit_seed: 0n,
			},
		);
	}

	async #renderInventoryListing(appId: number, contextId: number, assetId: number, htmlImg?: HTMLImageElement, force = false) {
		//console.log(assetId);
		if (force || (this.#currentAssetId != assetId)) {

			let steamUserId = await getInventorySteamId();
			this.#currentAppId = appId;
			this.#currentContextId = contextId;
			this.#currentAssetId = assetId;
			let activeInventoryPage = document.getElementById(ACTIVE_INVENTORY_PAGE);
			this.#addInventoryListing(steamUserId);
			if (activeInventoryPage && this.#htmlRowContainer) {
				activeInventoryPage.parentNode?.insertBefore(this.#htmlRowContainer, activeInventoryPage);
				show(this.#htmlRowContainer);
			} else {
				let tradeArea = document.getElementsByClassName('trade_area')[0];
				if (tradeArea && this.#htmlRowContainer) {
					tradeArea.parentNode?.insertBefore(this.#htmlRowContainer, tradeArea);
					show(this.#htmlRowContainer);
				}
			}
			let asset = await getInventoryAssetDatas(appId, contextId, assetId);
			if (asset) {
				//this.setGenerationState(GenerationState.RetrievingItemDatas, String(assetId));
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

	isInventory() {
		return this.#pageType == PageType.Inventory;
	}

	isMarket() {
		return this.#pageType == PageType.Market;
	}

	isTradeOffer() {
		return this.#pageType == PageType.TradeOffer;
	}

	setActive(active: boolean): void {
		this.#active = active;
		const method = active ? 'add' : 'remove';
		document.body.classList[method]('steamonsteroids-active');
	}

	isActive(): boolean {
		return this.#active;
	}

	#onMessage(event: MessageEvent) {
		const messageData = event.data;

		if (messageData.action == 'injected_ready') {
			this.#createButtons();
			this.#initMarketPlaceTf();
		}
	}

	#initTranslations(): void {
		for (const name in translationsJSON) {
			const s = new Map<string, string>();
			const translations = (translationsJSON as JSONObject)[name] as JSONObject;
			for (const translation in translations) {
				s.set(translation, translations[translation] as string);
			}

			this.#translations.set(name, s);
		}
	}
}

async function injectScript(path: string, tag: string) {
	var node = document.getElementsByTagName(tag)[0];
	if (!node) {
		return;
	}
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

async function backgroundFetch(input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
	const result = await chrome.runtime.sendMessage({
		action: 'fetch',
		resource: ((input as URL).href) ?? ((input as globalThis.Request).url) ?? input,
		options: init,
	});

	const ab = getCharCodes(atob(result.base64));

	return new Response(ab, { status: result.status, statusText: result.statusText });
}

window.fetch = async (...args) => {
	return backgroundFetch(...args);
};
