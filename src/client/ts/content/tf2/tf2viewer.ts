import { quat, vec3, vec4 } from 'gl-matrix';
import { AmbientLight, ColorBackground, GraphicsEvent, GraphicsEvents, Group, PointLight, Repositories, RotationControl, Scene, SceneNode, Source1ModelInstance, Texture, WebRepository } from 'harmony-3d';
import { TextureCombiner, WeaponManager, WeaponManagerItem } from 'harmony-3d-utils';
import { blockSVG, pauseSVG, playSVG } from 'harmony-svg';
import { Tf2Team, WarpaintDefinitions } from 'harmony-tf2-utils';
import { createElement, hide, show } from 'harmony-ui';
import { Map2, setTimeoutPromise } from 'harmony-utils';
import logoBlueWhite from '../../../img/logo_blue_white.png';
import logoRedWhite from '../../../img/logo_red_white.png';
import weaponsJSON from '../../../json/weapons.json';
import { APP_ID_TF2, DECORATED_WEAPONS, MARKET_LISTING_BACKGROUND_COLOR, textureSizeOption, TF2_REPOSITORY, TF2_WARPAINT_DEFINITIONS_URL } from '../../constants';
import { GenerationState } from '../../enums';
import { Controller, ControllerEvents, Tf2RefreshListing } from '../controller';
import { ClassInfo, MarketAsset } from '../types';
import { getInspectLink } from '../utils/inspectlink';
import { sortSelect } from '../utils/sort';
import { addSource1Model } from '../utils/sourcemodels';
import { PAINT_KIT_TOOL_INDEX } from './constants';
import { Character } from './loadout/characters/character';
import { CharacterManager } from './loadout/characters/charactermanager';
import { npcToClass, Tf2Class } from './loadout/characters/characters';
import { EffectType } from './loadout/effects/effecttemplate';
import { Item } from './loadout/items/item';
import { ItemManager } from './loadout/items/itemmanager';
import { ItemTemplate } from './loadout/items/itemtemplate';
import { getPaintByTint } from './paints/paints';
import { TF2_ITEM_CAMERA_POSITION, TF2_PLAYER_CAMERA_POSITION, TF2_PLAYER_CAMERA_TARGET, TF2_TAUNT_CAMERA_POSITION } from './tf2constants';

WarpaintDefinitions.setWarpaintDefinitionsURL(TF2_WARPAINT_DEFINITIONS_URL);

const PAINTKIT_TOOL_ID = '9536';

type WarPaint = {
	model: Source1ModelInstance;
	texture?: Texture;
	dirty: boolean;
}

enum CameraTarget {
	Unknown,
	Item,
	Character,
	Taunt,
}

type EconItem = {
	def_index: string;
	paint_wear: number;
	custom_paintkit_seed: BigInt;
	set_attached_particle: number;
	taunt_attached_particle: number;
}

export class TF2Viewer {
	#htmlControlsPerListing = new Map<string, HTMLElement>();
	#htmlWeaponSelectorPerListing = new Map<string, HTMLSelectElement>();
	#htmlClassIconsPerListing = new Map<string, HTMLElement>();
	#htmlCharacterControlsPerListing = new Map<string, HTMLElement>();
	#scene = new Scene();
	readonly lightsGroup = new Group({
		childs: [
			new AmbientLight(),
			/*new Manipulator({ position: [10, 0, 10] }),
			new Manipulator({ position: [-10, 0, 10] }),*/
			//new Sphere({ position: [150, 100, -200] }),
			//new Sphere({ position: [-150, 100, -200] }),
			new PointLight({ range: 1000, intensity: 0.25, position: [150, 500, -200] }),
			new PointLight({ range: 1000, intensity: 0.25, position: [-150, 500, -200] }),
		]
	});
	//#group = new Group({ parent: this.#scene });
	#rotationControl = new RotationControl({ parent: this.#scene, speed: 0 });
	#classModels = new Map<string, Source1ModelInstance>();
	#teamColor: Tf2Team = Tf2Team.Red;
	#currentClassName = '';
	//#source1Model?: Source1ModelInstance | null;
	//#selectClassPromise?: Promise<boolean>;
	#forcedWeaponIndex: number | null = null;
	#createModelPromise?: Promise<boolean>;
	#modelPath = '';
	#scenePerId = new Map<string, Scene>();
	//#rotationControlPerId = new Map<string, RotationControl>();
	#itemModelPerId = new Map2<string, string, WarPaint>();
	#activeListing = '';
	#renderedListing = new Map<string, ItemTemplate>();
	#warpaints = new Map<Scene, Source1ModelInstance>();
	#isWeaponsShowcase = false;
	#characterPerListing = new Map<string, Character>();
	#characters = new Set<Character>();
	#cameraTarget = CameraTarget.Unknown;
	#tauntCharacter: Tf2Class | null = null;

	constructor() {
		Repositories.addRepository(new WebRepository('tf2', TF2_REPOSITORY));

		//WeaponManager.reuseTextures = true;
		this.#initEvents();
		//this.#initOptions();

		TextureCombiner.setTextureSize(1024);
		chrome.storage.sync.get(textureSizeOption).then((result) => TextureCombiner.setTextureSize(result[textureSizeOption] ?? 1024));
	}

	#initEvents() {
		WeaponManager.addEventListener('started', (event: Event) => Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Started, listingId: (event as CustomEvent<WeaponManagerItem>).detail.userData } }));
		WeaponManager.addEventListener('success', (event: Event) => Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Success, listingId: (event as CustomEvent<WeaponManagerItem>).detail.userData } }));
		WeaponManager.addEventListener('failure', (event: Event) => Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Failure, listingId: (event as CustomEvent<WeaponManagerItem>).detail.userData } }));

		GraphicsEvents.addEventListener(GraphicsEvent.Tick, event => this.#flipWarpaints());
	}

	/*
	async #initOptions() {
		const result = await chrome.storage.sync.get('tf2.rotation');
		const rotation = result['tf2.rotation'];
		this.#rotationControl.setSpeed(rotation ?? 1);
	}
	*/

	async initHtml(listingId: string): Promise<HTMLElement> {
		let htmlControls = this.#htmlControlsPerListing.get(listingId);
		if (!htmlControls) {
			htmlControls = createElement('div', { class: 'canvas-container-controls' });
			this.#htmlControlsPerListing.set(listingId, htmlControls);
		}

		let htmlWeaponSelector = this.#htmlWeaponSelectorPerListing.get(listingId);
		if (!htmlWeaponSelector) {
			htmlWeaponSelector = createElement('select', {
				parent: htmlControls,
				class: 'weapon-selector steam-select',
				$change: (event: Event) => {
					this.#forcedWeaponIndex = Number((event.target as HTMLSelectElement).value);
					chrome.storage.sync.set({ warpaintWeaponIndex: (event.target as HTMLSelectElement).value });
					this.#refreshVisibleListings();
				},
			}) as HTMLSelectElement;
			this.#htmlWeaponSelectorPerListing.set(listingId, htmlWeaponSelector);
		}

		for (let weaponName in DECORATED_WEAPONS) {
			let weaponDefIndex = DECORATED_WEAPONS[weaponName];
			createElement('option', {
				parent: htmlWeaponSelector,
				innerText: weaponName,
				value: String(weaponDefIndex),
			});
		}
		sortSelect(htmlWeaponSelector);

		let htmlClassIcons = this.#htmlClassIconsPerListing.get(listingId);
		if (!htmlClassIcons) {
			htmlClassIcons = createElement('div', {
				parent: htmlControls,
				class: 'canvas-container-controls-class-icons',
			});
			this.#htmlClassIconsPerListing.set(listingId, htmlClassIcons);
		}

		let htmlCharacterControls = this.#htmlCharacterControlsPerListing.get(listingId);
		if (!htmlCharacterControls) {
			htmlCharacterControls = createElement('div', {
				parent: htmlControls,
				class: 'canvas-container-characters-controls',
			});
			this.#htmlCharacterControlsPerListing.set(listingId, htmlClassIcons);
		}

		let buttonState = false;
		const htmlPlayPauseButton = createElement('button', {
			class: 'canvas-container-controls-playpause play',
			innerHTML: playSVG,
			parent: htmlCharacterControls,
			events: {
				click: () => {
					buttonState = !buttonState;
					if (buttonState) {
						htmlPlayPauseButton.innerHTML = pauseSVG;
					} else {
						htmlPlayPauseButton.innerHTML = playSVG;
					}
					const speed = buttonState ? 1 : 0;
					chrome.storage.sync.set({ 'tf2.rotation': speed });
					this.#rotationControl.setSpeed(speed);

					/*
					for (const [_, rotationControl] of this.#rotationControlPerId) {
						rotationControl.setSpeed(speed);
						if (speed) {
							//rotationControl.reset();
						}
					}
					*/

					//(async () => (await this.#getRotationControl()).setSpeed(speed))();
				}
			},
		});

		(async () => {
			const result = await chrome.storage.sync.get('tf2.rotation');
			const rotation = result['tf2.rotation'] ?? 1;
			this.#rotationControl.setSpeed(rotation);

			if (rotation) {
				buttonState = true;
				htmlPlayPauseButton.innerHTML = pauseSVG;
			} else {
				buttonState = false;
				htmlPlayPauseButton.innerHTML = playSVG;
			}
		})();

		createElement('img', {
			class: 'team',
			parent: htmlCharacterControls,
			src: logoRedWhite,
			$click: () => this.#setTeam(Tf2Team.Red),
		});
		createElement('img', {
			class: 'team',
			parent: htmlCharacterControls,
			src: logoBlueWhite,
			$click: () => this.#setTeam(Tf2Team.Blu),
		});

		await this.#loadWarpaintWeapon(listingId);
		return htmlControls;
	}

	#setTeam(team: Tf2Team): void {
		chrome.storage.sync.set({ 'tf2.team': team });
		for (const character of this.#characters) {
			character.setTeam(team);
		}
		this.#teamColor = team;
	}

	setActiveListing(listingId: string): void {
		this.#activeListing = listingId;
	}

	#synchronize() {

	}

	#refreshVisibleListings() {
		Controller.dispatchEvent(ControllerEvents.Tf2RefreshVisibleListing);
	}

	#refreshListing(listingId: string) {
		Controller.dispatchEvent<Tf2RefreshListing>(ControllerEvents.Tf2RefreshListing, { detail: { listingId } });
	}

	async renderListingTF2(listingOrSteamId: string, listingDatas: MarketAsset, classInfo: ClassInfo, assetId?: number, htmlImg?: HTMLImageElement, weaponShowcase = false, econItem?: EconItem | string) {
		this.#isWeaponsShowcase = weaponShowcase;

		if (weaponShowcase) {
			this.#rotationControl.setSpeed(0);
			this.#rotationControl._parent?.setQuaternion(quat.create());
		}

		show(this.#htmlControlsPerListing.get(listingOrSteamId));
		this.#htmlClassIconsPerListing.get(listingOrSteamId)?.replaceChildren();
		if ((listingDatas.appid == APP_ID_TF2) && listingDatas.market_hash_name.includes('War Paint')/* && this.application.canInspectWarpaintWeapons()*/) {
			show(this.#htmlWeaponSelectorPerListing.get(listingOrSteamId));
		} else {
			hide(this.#htmlWeaponSelectorPerListing.get(listingOrSteamId));
		}
		Controller.dispatchEvent(ControllerEvents.ClearMarketListing, { detail: { listingId: listingOrSteamId } });
		let defIndex: string | number = classInfo?.app_data?.def_index;
		let remappedDefIndex: number | undefined;
		if (defIndex) {
			defIndex = Number(defIndex);

			//let warpaintTemplate: ItemTemplate | null = null;
			// If it's a paintkit, give it the defindex of the base paintkit tool
			if (defIndex >= 16000 && defIndex < 18000) {
				remappedDefIndex = this.#forcedWeaponIndex ?? PAINT_KIT_TOOL_INDEX;
				//warpaintTemplate = ItemManager.getItemTemplate(defIndex);
			}

			await ItemManager.initItems();
			const scene = this.getListingScene(listingOrSteamId);

			// Default character for non weapon showcase
			let defaultCharacter: Tf2Class = Tf2Class.Empty;

			// Select a default character for taunts
			const itemTemplate = ItemManager.getItemTemplate(defIndex);
			if (itemTemplate?.isTaunt()) {
				if (this.#tauntCharacter !== null) {
					// TODO: check if this character is taunt compatible
					defaultCharacter = this.#tauntCharacter;
				} else {
					for (const npc of itemTemplate.getUsedByClasses()) {
						const c = npcToClass(npc);
						if (c !== null) {
							defaultCharacter = c;
							this.#setTauntCamera();
							break;
						}
					}
				}
			}

			const character = weaponShowcase ? await CharacterManager.selectCharacter(Tf2Class.Empty, 0, scene) : this.#characterPerListing.get(listingOrSteamId) ?? await CharacterManager.selectCharacter(defaultCharacter, 0, scene);
			this.#characters.add(character);
			character.setTeam(this.#teamColor);
			const addItems: (keyof typeof weaponsJSON)[] = [];
			await character.removeAll();
			if (weaponShowcase) {
				for (const defIndex in weaponsJSON) {
					//console.info(defIndex);
					addItems.push(defIndex as (keyof typeof weaponsJSON));
				}
				//character.removeAll();
			} else {
				// single weapon
				addItems.push(String(remappedDefIndex ?? defIndex) as (keyof typeof weaponsJSON));
			}

			for (const addItem of addItems) {
				const itemTemplate = ItemManager.getItemTemplate(addItem);
				if (itemTemplate) {
					/*
					if (this.#renderedListing.get(listingOrSteamId) == itemTemplate && !weaponShowcase) {
						return;
					}

					this.#renderedListing.set(listingOrSteamId, itemTemplate);
					*/

					//console.info(itemTemplate);
					/*
					if (!weaponShowcase) {
						await character.removeAll();
					}
					*/
					const item = await character.addItem(itemTemplate);
					item.userData = listingOrSteamId;

					item.getModel().then(model => {
						if (model) {
							if (weaponShowcase) {
								if (addItem == PAINTKIT_TOOL_ID) {
									this.#warpaints.set(scene, model);
								}
								const weapon = weaponsJSON[addItem] as ({ position?: vec3, orientation?: quat } | undefined);
								if (weapon) {
									const position = weapon.position;
									if (position) {
										model.setPosition(position);
									}
									const orientation = weapon.orientation;
									if (orientation) {
										model.setOrientation(orientation);
									}
								}
							} else {
								setTimeout(() => {
									Controller.dispatchEvent<Source1ModelInstance>(ControllerEvents.CenterCameraTarget, { detail: model });
								}, 100);
							}
						}
					});


					let inspectLink: string | undefined | EconItem;
					if (!econItem) {
						inspectLink = getInspectLink(listingDatas, listingOrSteamId, assetId);
					} else {
						inspectLink = econItem;
					}
					if (inspectLink) {
						// TODO: add warpaints to item list and remove this call
						chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: defIndex ?? remappedDefIndex }, async (tf2Item) => {
							this.#refreshWarpaintNew(character, listingOrSteamId, assetId, item, tf2Item.paintkit_proto_def_index, inspectLink, weaponShowcase, htmlImg);
						});
					}
				}
			}
		}
	}

	#refreshWarpaintNew(character: Character, listingOrSteamId: string, assetId: number | undefined, item: Item, warpaintId: number, inspectLink: string | EconItem, weaponShowcase: boolean, htmlImg?: HTMLImageElement): void {
		let paintKitId = warpaintId;

		Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.RetrievingItemDatas, listingId: listingOrSteamId } });

		const refreshWarpaint = async (econitem: any) => {
			//const econitem = itemDatas.econitem;
			if (!econitem) {
				return null;
			}

			paintKitId = paintKitId ?? econitem?.paint_index ?? econitem?.def_index;
			if (!paintKitId) {
				return null;
			}
			let paintKitWear = econitem?.paint_wear;
			paintKitWear = Math.min(Math.max(paintKitWear, 0.2), 1.0);//I found some FN paintkits with a wear = 0
			let paintKitSeed = BigInt(econitem?.custom_paintkit_seed ?? econitem?.original_id ?? econitem?.id ?? 0);
			let craftIndex = econitem?.unique_craft_index;

			this.#populateTF2MarketListing(listingOrSteamId, Number(paintKitId), paintKitSeed, craftIndex);
			if (paintKitId && paintKitWear) {
				Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.WaitingForGeneration, listingId: listingOrSteamId } });
				paintKitWear = (paintKitWear - 0.2) * 5 >> 0; // transform the wear from decimal point to integer
				//WeaponManager.refreshWarpaint({ model: await item.getModel(), warpaintId: Number(paintKitId), warpaintWear: paintKitWear, id: item.id, warpaintSeed: paintKitSeed, userData: listingOrSteamId, team: 0, updatePreview: false }, false);
				item.setWarpaint(Number(paintKitId), paintKitWear, paintKitSeed);
				if (htmlImg && assetId) {
					Controller.dispatchEvent(ControllerEvents.SelectInventoryItem, { detail: { assetId: assetId, htmlImg: htmlImg } });
				}
			} else {
				Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Success, listingId: listingOrSteamId } });
			}

			let itemStyleOverride = econitem?.item_style_override;
			if (itemStyleOverride) {
				chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: item.id, styleId: itemStyleOverride }, async (tf2ItemStyle) => {
					//item.sty
					//this.#setModelSkin(source1Model, tf2ItemStyle);
				});
			} else {
				//item.setTeam(this.#teamColor);
				//this.#setModelSkin(source1Model, tf2Item);
			}

			// Add unusual effects
			if (econitem) {
				const attachedParticle = ItemManager.getEffectTemplate(EffectType.Cosmetic, econitem.set_attached_particle);
				if (attachedParticle) {
					character.addEffect(attachedParticle);
				}

				item.setWeaponEffectId(econitem.set_attached_particle);

				const tauntEffect = ItemManager.getEffectTemplate(EffectType.Taunt, econitem.taunt_attached_particle);
				if (tauntEffect) {
					character.addEffect(tauntEffect);
				}

				const itemTintRGB = econitem.set_item_tint_rgb;
				if (itemTintRGB !== undefined) {
					const paint = getPaintByTint(itemTintRGB);
					item.setPaint(paint);
				}
			}

			if (!weaponShowcase) {
				this.#displayClassIcons(listingOrSteamId, item);
			}

			/*
			this.#attachModels(source1Model, remappedTf2Item ?? tf2Item, itemDatas?.econitem);
			this.#attachTF2Effects(source1Model, remappedTf2Item ?? tf2Item, itemDatas?.econitem);
			setTF2ModelAttributes(source1Model, itemDatas?.econitem);
			this.#displayClassIcons(listingOrSteamId, path, remappedTf2Item ?? tf2Item);
			*/
		};

		if (typeof inspectLink === 'string') {
			chrome.runtime.sendMessage({ action: 'inspect-item', link: inspectLink }, async (itemDatas) => {
				refreshWarpaint(itemDatas.econitem);
			});
		} else {
			refreshWarpaint(inspectLink);
		}
	}

	async #displayClassIcons(listingId: string, item: Item) {
		let usedByClasses = item.getTemplate().getUsedByClasses();
		let removeCurrentClassModel = true;
		if (this.#forcedWeaponIndex != PAINT_KIT_TOOL_INDEX) {
			for (const className of usedByClasses) {
				await this.#addClassIcon(listingId, className);

				if (className == this.#currentClassName) {
					this.#selectClass(listingId, className);
					removeCurrentClassModel = false;
				}

			}
			await this.#addClassIcon(listingId, '');
		}
		//this.#centerCameraOnItem();
	}

	async #centerCameraOnItem(listingId: string, path: string) {
		await setTimeoutPromise(1000);
		if (!this.#hasActiveClass()) {
			const warPaint = await this.#getWarPaint(listingId, path);
			if (warPaint) {
				Controller.dispatchEvent(ControllerEvents.CenterCameraTarget, { detail: warPaint.model });
			}
		}
	}

	async #addClassIcon(listingId: string, className: string) {
		let htmlClassIcon = document.createElement('div');
		htmlClassIcon.className = 'canvas-container-controls-class-icon';
		let imageUrl = chrome.runtime.getURL(`images/class_icon/${className}.svg`);
		if (className == '') {
			htmlClassIcon.innerHTML = blockSVG;
		} else {
			//htmlClassIcon.style.backgroundImage = `url(${imageUrl})`;
			htmlClassIcon.innerHTML = await (await fetch(imageUrl)).text();
		}

		this.#htmlClassIconsPerListing.get(listingId)?.append(htmlClassIcon);

		htmlClassIcon.addEventListener('click', async () => {
			await this.#selectClass(listingId, className);
		});
	}

	async #selectClass(listingId: string, className: string) {
		let tf2Class = npcToClass(className);

		const scene = this.getListingScene(listingId);
		const character = await CharacterManager.selectCharacter(tf2Class ?? Tf2Class.Empty, 0, scene);
		this.#characters.add(character);

		this.#characterPerListing.set(listingId, character);

		this.#refreshListing(listingId);

		if (tf2Class === null || tf2Class == Tf2Class.Empty) {
			this.#setItemCamera();
		} else {
			this.#setCharacterCamera();
		}
	}

	#setCharacterCamera() {
		if (this.#cameraTarget == CameraTarget.Character) {
			return;
		}

		this.#cameraTarget = CameraTarget.Character;
		Controller.dispatchEvent(ControllerEvents.SetCameraTarget, {
			detail: {
				target: TF2_PLAYER_CAMERA_TARGET,
				position: TF2_PLAYER_CAMERA_POSITION,
			}
		});
	}

	#setTauntCamera() {
		if (this.#cameraTarget == CameraTarget.Taunt) {
			return;
		}

		this.#cameraTarget = CameraTarget.Taunt;
		Controller.dispatchEvent(ControllerEvents.SetCameraTarget, {
			detail: {
				target: TF2_PLAYER_CAMERA_TARGET,
				position: TF2_TAUNT_CAMERA_POSITION,
			}
		});
	}

	#setItemCamera() {
		if (this.#cameraTarget == CameraTarget.Item) {
			return;
		}

		this.#cameraTarget = CameraTarget.Item;
		Controller.dispatchEvent(ControllerEvents.SetCameraTarget, {
			detail: {
				target: vec3.create(),
				position: TF2_ITEM_CAMERA_POSITION,
			}
		});
	}

	async #loadWarpaintWeapon(listingId: string) {
		let storage = await chrome.storage.sync.get('warpaintWeaponIndex');
		if (storage && storage.warpaintWeaponIndex) {
			let warpaintWeaponIndex = Number(storage.warpaintWeaponIndex);
			const htmlWeaponSelector = this.#htmlWeaponSelectorPerListing.get(listingId);
			if (htmlWeaponSelector) {
				htmlWeaponSelector.value = String(warpaintWeaponIndex);
			}
			this.#forcedWeaponIndex = warpaintWeaponIndex;
		}
	}

	async #getWarPaint(listingId: string, modelPath: string): Promise<WarPaint | null> {
		let warPaint: WarPaint | null | undefined = this.#itemModelPerId.get(listingId, modelPath);
		if (warPaint) {
			return warPaint;
		}

		const model = await this.#createTF2Model(listingId, modelPath);

		if (model) {
			warPaint = { model: model, dirty: true };
			this.#itemModelPerId.set(listingId, modelPath, warPaint);
			return warPaint;
		}

		return null;
	}

	async #createTF2Model(listingId: string, modelPath: string): Promise<Source1ModelInstance | null> {
		await this.#createModelPromise;
		let createModelPromiseResolve: (value: boolean) => void = () => { };
		this.#createModelPromise = new Promise<boolean>((resolve) => createModelPromiseResolve = resolve);
		this.#modelPath = modelPath;

		const source1Model = await addSource1Model('tf2', modelPath, /*this.#group*/);
		createModelPromiseResolve(true);

		if (source1Model) {
			let seq = source1Model.sourceModel.mdl.getSequenceById(0);
			if (seq) {
				source1Model.playSequence(seq.name);
			}
		}
		this.#centerCameraOnItem(listingId, modelPath);
		return source1Model;
	}

	#populateTF2MarketListing(listingOrSteamId: string, paintKitId: number, seed: bigint, craftIndex: number) {
		let s: string = '';
		if (paintKitId && seed) {
			s = `<div>Seed: ${seed}</div>`;
		}
		if (craftIndex) {
			s += `<div>Craft #${craftIndex}</div>`;
		}

		Controller.dispatchEvent(ControllerEvents.SetItemInfo, { detail: { listingId: listingOrSteamId, info: s } });
	}

	#hasActiveClass() {
		for (let [className, classModel] of this.#classModels) {
			if (classModel.visible) {
				return true;
			}
		}
		return false;
	}

	getScene(): Scene {
		return this.#scene;
	}

	getListingScene(listingId: string, color: vec4 = MARKET_LISTING_BACKGROUND_COLOR): Scene {
		let scene = this.#scenePerId.get(listingId);
		if (!scene) {
			scene = new Scene({
				parent: this.#scene,
				background: new ColorBackground({ color }),
				childs: [
					//new Manipulator(),
					new SceneNode({ entity: this.lightsGroup }),
				],
			});
			this.#scenePerId.set(listingId, scene);
		}
		return scene;
	}

	#flipWarpaints(): void {
		const position = vec3.create();
		for (const [scene, warpaint] of this.#warpaints) {
			if (scene.activeCamera?.getWorldPosition(position)) {
				if (position[0] < 0) {
					warpaint.setOrientation([0, 0, 1, 0]);
				} else {
					warpaint.setOrientation([0, 0, 0, 1]);
				}
			}
		}
	}
}
