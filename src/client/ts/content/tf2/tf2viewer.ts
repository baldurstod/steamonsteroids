import { vec3 } from 'gl-matrix';
import { AmbientLight, ColorBackground, Group, PointLight, Repositories, RotationControl, Scene, SceneNode, Source1ModelInstance, Source1ParticleControler, Texture, WebRepository } from 'harmony-3d';
import { TextureCombiner, WeaponManager, WeaponManagerItem } from 'harmony-3d-utils';
import { blockSVG, pauseSVG, playSVG } from 'harmony-svg';
import { WarpaintDefinitions } from 'harmony-tf2-utils';
import { createElement, hide, show } from 'harmony-ui';
import { Map2, setTimeoutPromise } from 'harmony-utils';
import { APP_ID_TF2, DECORATED_WEAPONS, MARKET_LISTING_BACKGROUND_COLOR, TF2_REPOSITORY, TF2_WARPAINT_DEFINITIONS_URL } from '../../constants';
import { GenerationState } from '../../enums';
import { Controller, ControllerEvents } from '../controller';
import { getInspectLink } from '../utils/inspectlink';
import { sortSelect } from '../utils/sort';
import { addSource1Model } from '../utils/sourcemodels';
import { PAINT_KIT_TOOL_INDEX } from './constants';
import { getSheenTint } from './killstreak';
import { CharacterManager } from './loadout/characters/charactermanager';
import { Tf2Class } from './loadout/characters/characters';
import { Team } from './loadout/enums';
import { Item } from './loadout/items/item';
import { ItemManager } from './loadout/items/itemmanager';
import { ItemTemplate } from './loadout/items/itemtemplate';
import { getTF2ModelName, selectCharacterAnim, setTF2ModelAttributes } from './tf2';
import { TF2_CLASSES_REMOVABLE_PARTS, TF2_ITEM_CAMERA_POSITION, TF2_MERCENARIES, TF2_PLAYER_CAMERA_POSITION, TF2_PLAYER_CAMERA_TARGET } from './tf2constants';

WarpaintDefinitions.setWarpaintDefinitionsURL(TF2_WARPAINT_DEFINITIONS_URL);

type WarPaint = {
	model: Source1ModelInstance;
	texture?: Texture;
	dirty: boolean;
}

export class TF2Viewer {
	#htmlControls?: HTMLElement;
	#htmlWeaponSelector?: HTMLSelectElement;
	#htmlClassIcons?: HTMLElement;
	#scene = new Scene();
	#lightsGroup = new Group({
		childs: [
			new AmbientLight(),
			new PointLight({ range: 500, intensity: 0.5, position: [100, 100, 100] }),
			new PointLight({ range: 500, intensity: 0.5, position: [100, -100, 100] }),
		]
	});
	//#group = new Group({ parent: this.#scene });
	#rotationControl = new RotationControl({ parent: this.#scene, speed: 0 });
	#classModels = new Map<string, Source1ModelInstance>();
	#teamColor: Team = Team.Red;
	#currentClassName = '';
	//#source1Model?: Source1ModelInstance | null;
	#selectClassPromise?: Promise<boolean>;
	#forcedWeaponIndex: number | null = null;
	#createModelPromise?: Promise<boolean>;
	#modelPath = '';
	#scenePerId = new Map<string, Scene>();
	//#rotationControlPerId = new Map<string, RotationControl>();
	#itemModelPerId = new Map2<string, string, WarPaint>();
	#activeListing = '';
	#renderedListing = new Map<string, ItemTemplate>();

	constructor() {
		Repositories.addRepository(new WebRepository('tf2', TF2_REPOSITORY));

		//WeaponManager.reuseTextures = true;
		TextureCombiner.setTextureSize(2048);//TODO: set an option
		this.#initEvents();
		//this.#initOptions();
	}

	#initEvents() {
		WeaponManager.addEventListener('started', (event: Event) => Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Started, listingId: (event as CustomEvent<WeaponManagerItem>).detail.userData } }));
		WeaponManager.addEventListener('success', (event: Event) => Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Sucess, listingId: (event as CustomEvent<WeaponManagerItem>).detail.userData } }));
		WeaponManager.addEventListener('failure', (event: Event) => Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Failure, listingId: (event as CustomEvent<WeaponManagerItem>).detail.userData } }));
	}

	/*
	async #initOptions() {
		const result = await chrome.storage.sync.get('tf2.rotation');
		const rotation = result['tf2.rotation'];
		this.#rotationControl.setSpeed(rotation ?? 1);
	}
	*/

	initHtml() {
		this.#htmlControls = createElement('div', { class: 'canvas-container-controls' });

		this.#htmlWeaponSelector = createElement('select', {
			parent: this.#htmlControls,
			class: 'weapon-selector steam-select',
			$change: (event: Event) => {
				this.#forcedWeaponIndex = Number((event.target as HTMLSelectElement).value);
				chrome.storage.sync.set({ warpaintWeaponIndex: (event.target as HTMLSelectElement).value });
				this.#refreshVisibleListings();
			},
		}) as HTMLSelectElement;

		for (let weaponName in DECORATED_WEAPONS) {
			let weaponDefIndex = DECORATED_WEAPONS[weaponName];
			createElement('option', {
				parent: this.#htmlWeaponSelector,
				innerText: weaponName,
				value: String(weaponDefIndex),
			});
		}
		sortSelect(this.#htmlWeaponSelector);

		this.#htmlClassIcons = createElement('div', {
			parent: this.#htmlControls,
			class: 'canvas-container-controls-class-icons',
		});

		let buttonState = false;
		const htmlPlayPauseButton = createElement('button', {
			class: 'canvas-container-controls-playpause play',
			innerHTML: playSVG,
			parent: this.#htmlControls,
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

			if (rotation) {
				buttonState = true;
				htmlPlayPauseButton.innerHTML = pauseSVG;
			} else {
				buttonState = false;
				htmlPlayPauseButton.innerHTML = playSVG;
			}
		})();


		this.#loadWarpaintWeapon();
		return this.#htmlControls;
	}

	setActiveListing(listingId: string): void {
		this.#activeListing = listingId;
	}

	#synchronize() {

	}

	#refreshVisibleListings() {
		Controller.dispatchEvent(ControllerEvents.Tf2RefreshVisibleListing);
	}

	async renderListingTF2(listingOrSteamId: string, listingDatas: any/*TODO: improve type*/, classInfo: any/*TODO: improve type*/, assetId?: number, htmlImg?: HTMLImageElement) {
		show(this.#htmlControls);
		this.#htmlClassIcons?.replaceChildren();
		if ((listingDatas.appid == APP_ID_TF2) && listingDatas.market_hash_name.includes('War Paint')/* && this.application.canInspectWarpaintWeapons()*/) {
			show(this.#htmlWeaponSelector);
		} else {
			hide(this.#htmlWeaponSelector);
		}
		Controller.dispatchEvent(ControllerEvents.ClearMarketListing, { detail: { listingId: listingOrSteamId } });
		let defIndex = classInfo?.app_data?.def_index;
		let remappedDefIndex: number | undefined;
		if (defIndex) {
			defIndex = Number(defIndex);

			let warpaintTemplate: ItemTemplate | null = null;
			// If it's a paintkit, give it the defindex of the base paintkit tool
			if (defIndex >= 16000 && defIndex < 18000) {
				remappedDefIndex = this.#forcedWeaponIndex ?? PAINT_KIT_TOOL_INDEX;
				warpaintTemplate = ItemManager.getItemTemplate(defIndex);
			}


			await ItemManager.initItems();
			const scene = this.getListingScene(listingOrSteamId);
			const character = await CharacterManager.selectCharacter(Tf2Class.Empty, 0, scene);

			const itemTemplate = ItemManager.getItemTemplate(remappedDefIndex ?? defIndex);
			if (itemTemplate) {
				if (this.#renderedListing.get(listingOrSteamId) == itemTemplate) {
					return;
				}

				this.#renderedListing.set(listingOrSteamId, itemTemplate);

				console.info(itemTemplate);
				character.removeAll();
				const item = await character.addItem(itemTemplate);

				item.getModel().then(model => {
					if (model) {
						setTimeout(() => {
							Controller.dispatchEvent<Source1ModelInstance>(ControllerEvents.CenterCameraTarget, { detail: model });
						}, 100)
					}
				});

				let inspectLink = getInspectLink(listingDatas, listingOrSteamId, assetId);
				if (inspectLink) {
					// TODO: add warpaints to item list and remove this call
					chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: defIndex ?? remappedDefIndex }, async (tf2Item) => {
						this.#refreshWarpaintNew(listingOrSteamId, assetId, item, tf2Item.paintkit_proto_def_index, inspectLink, htmlImg);
					});
				}
			}
			return;


			chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: remappedDefIndex ?? defIndex }, async (tf2Item) => {
				const modelPlayer = getTF2ModelName(tf2Item, this.#currentClassName);
				if (modelPlayer) {
					const warPaint = await this.#getWarPaint(listingOrSteamId, modelPlayer.model);

					if (!warPaint) {
						return;
					}
					/*
					if (!warPaint?.dirty) {
						return;
					}
					*/
					warPaint.dirty = false;

					let inspectLink = getInspectLink(listingDatas, listingOrSteamId, assetId);
					if (inspectLink) {
						Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.LoadingModel, listingId: listingOrSteamId } });

						const scene = this.getListingScene(listingOrSteamId);
						scene.removeChildren();
						scene.addChild(new AmbientLight());

						new PointLight({ range: 500, parent: scene, intensity: 0.5, position: [100, 100, 100] });
						new PointLight({ range: 500, parent: scene, intensity: 0.5, position: [100, -100, 100] });

						const warPaint = await this.#getWarPaint(listingOrSteamId, modelPlayer.model);
						const source1Model = warPaint?.model;
						if (warPaint && source1Model) {
							const group = new Group({ childs: [warPaint.model] });
							scene.addChild(group);

							//const rotationControl = await this.#getRotationControl(listingOrSteamId);
							//group.addChild(rotationControl);

							Controller.dispatchEvent(ControllerEvents.ShowRowContainer);
							if (remappedDefIndex) {
								chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: defIndex }, async (remappedTf2Item) => {
									this.#refreshWarpaint(listingOrSteamId, modelPlayer.model, assetId, inspectLink, source1Model, remappedDefIndex!, remappedTf2Item, htmlImg, tf2Item);
								});
							} else {
								this.#refreshWarpaint(listingOrSteamId, modelPlayer.model, assetId, inspectLink, source1Model, defIndex, tf2Item, htmlImg);
							}

							if (modelPlayer.attachedModels) {
								for (const attachedModelPath of modelPlayer.attachedModels) {
									await addSource1Model('tf2', attachedModelPath, source1Model);
								}
							}
						}
					} else {
						Controller.dispatchEvent(ControllerEvents.HideRowContainer);
					}
				} else {
					Controller.dispatchEvent(ControllerEvents.HideRowContainer);
				}
			});
		}
	}

	#refreshWarpaint(listingOrSteamId: string, path: string, assetId: number | undefined, inspectLink: string, source1Model: Source1ModelInstance, defIndex: number, tf2Item: any/*TODO:improve type*/, htmlImg?: HTMLImageElement, remappedTf2Item?: any/*TODO:improve type*/) {
		let paintKitId = tf2Item.paintkit_proto_def_index;

		Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.RetrievingItemDatas, listingId: listingOrSteamId } });
		chrome.runtime.sendMessage({ action: 'inspect-item', link: inspectLink }, async (item) => {

			paintKitId = paintKitId ?? item?.econitem?.paint_index;
			let paintKitWear = item?.econitem?.paint_wear;
			paintKitWear = Math.min(Math.max(paintKitWear, 0.2), 1.0);//I found some FN paintkits with a wear = 0
			let paintKitSeed = BigInt(item?.econitem?.custom_paintkit_seed ?? item?.econitem?.original_id ?? item?.econitem?.id ?? 0);
			let craftIndex = item?.econitem?.unique_craft_index;

			this.#populateTF2MarketListing(listingOrSteamId, paintKitId, paintKitSeed, craftIndex);
			if (paintKitId && paintKitWear && paintKitSeed) {
				Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.WaitingForGeneration, listingId: listingOrSteamId } });
				paintKitWear = (paintKitWear - 0.2) * 5 >> 0; // transform the wear from decimal point to integer
				WeaponManager.refreshWarpaint({ model: source1Model, warpaintId: Number(paintKitId), warpaintWear: paintKitWear, id: String(defIndex), warpaintSeed: paintKitSeed, userData: listingOrSteamId, team: 0 }, false);
				if (htmlImg && assetId) {
					Controller.dispatchEvent(ControllerEvents.SelectInventoryItem, { detail: { assetId: assetId, htmlImg: htmlImg } });
				}
			} else {
				Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Sucess, listingId: listingOrSteamId } });
			}

			let itemStyleOverride = item?.econitem?.item_style_override;
			if (itemStyleOverride) {
				chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: defIndex, styleId: itemStyleOverride }, async (tf2ItemStyle) => {
					this.#setModelSkin(source1Model, tf2ItemStyle);
				});
			} else {
				this.#setModelSkin(source1Model, tf2Item);
			}

			this.#attachModels(source1Model, remappedTf2Item ?? tf2Item, item?.econitem);
			this.#attachTF2Effects(source1Model, remappedTf2Item ?? tf2Item, item?.econitem);
			setTF2ModelAttributes(source1Model, item?.econitem);
			this.#displayClassIcons(listingOrSteamId, path, remappedTf2Item ?? tf2Item);
		});
	}

	#refreshWarpaintNew(listingOrSteamId: string, assetId: number | undefined, item: Item, warpaintId: number, inspectLink: string, htmlImg?: HTMLImageElement): void {
		let paintKitId = warpaintId;

		Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.RetrievingItemDatas, listingId: listingOrSteamId } });
		chrome.runtime.sendMessage({ action: 'inspect-item', link: inspectLink }, async (itemDatas) => {

			paintKitId = paintKitId ?? itemDatas?.econitem?.paint_index ?? itemDatas?.econitem?.def_index;
			if (!paintKitId) {
				return null;
			}
			let paintKitWear = itemDatas?.econitem?.paint_wear;
			paintKitWear = Math.min(Math.max(paintKitWear, 0.2), 1.0);//I found some FN paintkits with a wear = 0
			let paintKitSeed = BigInt(itemDatas?.econitem?.custom_paintkit_seed ?? itemDatas?.econitem?.original_id ?? itemDatas?.econitem?.id ?? 0);
			let craftIndex = itemDatas?.econitem?.unique_craft_index;

			this.#populateTF2MarketListing(listingOrSteamId, Number(paintKitId), paintKitSeed, craftIndex);
			if (paintKitId && paintKitWear && paintKitSeed) {
				Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.WaitingForGeneration, listingId: listingOrSteamId } });
				paintKitWear = (paintKitWear - 0.2) * 5 >> 0; // transform the wear from decimal point to integer
				WeaponManager.refreshWarpaint({ model: await item.getModel(), warpaintId: Number(paintKitId), warpaintWear: paintKitWear, id: item.id, warpaintSeed: paintKitSeed, userData: listingOrSteamId, team: 0 }, false);
				if (htmlImg && assetId) {
					Controller.dispatchEvent(ControllerEvents.SelectInventoryItem, { detail: { assetId: assetId, htmlImg: htmlImg } });
				}
			} else {
				Controller.dispatchEvent(ControllerEvents.SetGenerationState, { detail: { state: GenerationState.Sucess, listingId: listingOrSteamId } });
			}

			let itemStyleOverride = itemDatas?.econitem?.item_style_override;
			if (itemStyleOverride) {
				chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: item.id, styleId: itemStyleOverride }, async (tf2ItemStyle) => {
					//item.sty
					//this.#setModelSkin(source1Model, tf2ItemStyle);
				});
			} else {
				item.setTeam(this.#teamColor);
				//this.#setModelSkin(source1Model, tf2Item);
			}
			/*
			this.#attachModels(source1Model, remappedTf2Item ?? tf2Item, itemDatas?.econitem);
			this.#attachTF2Effects(source1Model, remappedTf2Item ?? tf2Item, itemDatas?.econitem);
			setTF2ModelAttributes(source1Model, itemDatas?.econitem);
			this.#displayClassIcons(listingOrSteamId, path, remappedTf2Item ?? tf2Item);
			*/
		});
	}

	#setModelSkin(model: Source1ModelInstance, tf2Item: any/*TODO:improve type*/) {
		if (model && tf2Item) {
			let skin = Number(this.#teamColor == Team.Red ? tf2Item.skin_red : tf2Item.skin_blu ?? tf2Item.skin_red);
			if (skin) {
				model.skin = String(skin);
			}
		}
	}

	async #attachModels(source1Model: Source1ModelInstance, tf2Item: any/*TODO:improve type*/, econItem: any/*TODO:improve type*/) {
		if (source1Model && tf2Item && econItem) {
			if (econItem.is_strange && tf2Item.weapon_uses_stattrak_module) {
				let stattrakModule = await addSource1Model('tf2', tf2Item.weapon_uses_stattrak_module, source1Model);
				if (stattrakModule) {
					let stattrakBone = source1Model.getBoneByName('c_weapon_stattrack');
					if (stattrakBone) {
						let scale = Number(tf2Item.weapon_stattrak_module_scale ?? 1);
						stattrakBone.scale = [scale, scale, scale];
					}
					stattrakModule.materialsParams['StatTrakNumber'] = econItem.kill_eater ?? 0;
				}
			}
			if (econItem.is_festivized && tf2Item.attached_models_festive) {
				let festivizerModel = await addSource1Model('tf2', tf2Item.attached_models_festive, source1Model);
			}

			let killStreakIdleEffect = econItem.killstreak_idleeffect;
			if (killStreakIdleEffect) {
				source1Model.sheen = getSheenTint(killStreakIdleEffect);
			}
		}
	}

	async #attachTF2Effects(source1Model: Source1ModelInstance, tf2Item: any/*TODO:improve type*/, econItem: any/*TODO:improve type*/) {
		if (source1Model && tf2Item && econItem) {
			if (econItem.set_attached_particle) {
				this.#attachTF2Effect(source1Model, econItem.set_attached_particle, tf2Item.particle_suffix);
			}
			if (tf2Item.set_attached_particle_static) {
				this.#attachTF2Effect(source1Model, tf2Item.set_attached_particle_static, tf2Item.particle_suffix);
			}
		}
	}

	async #attachTF2Effect(model: Source1ModelInstance, effectId: number, particleSuffix: string) {
		chrome.runtime.sendMessage({ action: 'get-tf2-effect', effectId: effectId }, async (tf2Effect) => {
			console.log(tf2Effect);
			if (tf2Effect && tf2Effect.system) {
				let completeSystemName = ((tf2Effect.use_suffix_name == 1) && particleSuffix) ? `${tf2Effect.system}_${particleSuffix}` : tf2Effect.system;
				let sys = await Source1ParticleControler.createSystem('tf2', completeSystemName);

				let attachementPoint = (tf2Effect.attachment != 'unusual' && tf2Effect.attachment != 'muzzle') ? tf2Effect.attachment ?? 'bip_head' : 'bip_head';
				model.attachSystem(sys, attachementPoint);
				let controlPointId = 0;
				let attachementName;
				while (attachementName = tf2Effect['control_point_' + controlPointId]) {
					model.attachSystem(sys, attachementName, controlPointId);
					++controlPointId;
				}
				sys.start();
			}
		});
	}

	#displayClassIcons(listingId: string, path: string, tf2Item: any/*TODO:improve type*/) {
		let usedByClasses = tf2Item?.used_by_classes;
		let removeCurrentClassModel = true;
		if (usedByClasses && this.#forcedWeaponIndex != PAINT_KIT_TOOL_INDEX) {
			for (let className in usedByClasses) {
				if (usedByClasses[className] != "0") {
					this.#addClassIcon(listingId, path, className, tf2Item);

					if (className == this.#currentClassName) {
						this.#selectClass(listingId, path, className, tf2Item);
						removeCurrentClassModel = false;
					}
				}
			}
			this.#addClassIcon(listingId, path, '', tf2Item);
		}
		if (removeCurrentClassModel) {
			this.#setActiveClass(null);
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

	#addClassIcon(listingId: string, path: string, className: string, tf2Item: any/*TODO:improve type*/) {
		let htmlClassIcon = document.createElement('div');
		htmlClassIcon.className = 'canvas-container-controls-class-icon';
		let imageUrl = chrome.runtime.getURL(`images/class_icon/${className}.svg`);
		if (className == '') {
			htmlClassIcon.innerHTML = blockSVG;
		} else {
			htmlClassIcon.style.backgroundImage = `url(${imageUrl})`;
		}

		this.#htmlClassIcons?.append(htmlClassIcon);

		htmlClassIcon.addEventListener('click', async () => {
			await this.#refreshVisibleListings();
			this.#selectClass(listingId, path, className, tf2Item);
		});
	}

	async #selectClass(listingId: string, path: string, className: string, tf2Item: any/*TODO:improve type*/) {
		await this.#selectClassPromise;
		this.#selectClassPromise = new Promise(async (resolve, reject) => {
			this.#currentClassName = className;
			this.#setActiveClass(null);

			let classModel = await this.#getClassModel(className);
			this.#setActiveClass(className);
			this.#checkBodyGroups(className, tf2Item);
			if (classModel) {
				selectCharacterAnim(className, classModel, tf2Item);
				classModel.addChild((await this.#getWarPaint(listingId, path))?.model);
				this.#setCharacterCamera();
			} else {
				this.#setItemCamera();
			}
			resolve(true);
		});
	}

	#setCharacterCamera() {
		Controller.dispatchEvent(ControllerEvents.SetCameraTarget, {
			detail: {
				target: TF2_PLAYER_CAMERA_TARGET,
				position: TF2_PLAYER_CAMERA_POSITION,
			}
		});
	}

	#setItemCamera() {
		Controller.dispatchEvent(ControllerEvents.SetCameraTarget, {
			detail: {
				target: vec3.create(),
				position: TF2_ITEM_CAMERA_POSITION,
			}
		});
	}

	async #loadWarpaintWeapon() {
		let storage = await chrome.storage.sync.get('warpaintWeaponIndex');
		if (storage && storage.warpaintWeaponIndex) {
			let warpaintWeaponIndex = Number(storage.warpaintWeaponIndex);
			if (this.#htmlWeaponSelector) {
				this.#htmlWeaponSelector.value = String(warpaintWeaponIndex);
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

	async #getClassModel(className: string) {
		let classModel: Source1ModelInstance | null | undefined = this.#classModels.get(className);
		let mercenary = TF2_MERCENARIES.get(className);
		if (!classModel) {
			if (mercenary) {
				let classModel = await addSource1Model('tf2', mercenary.modelPath/*, this.#group*/);
				if (classModel) {
					this.#classModels.set(className, classModel);
				}
			}
		}
		if (classModel && mercenary) {
			classModel.playSequence(mercenary.defaultAnimation);
		}
		return classModel;
	}

	#setActiveClass(activeClassName: string | null) {
		if (activeClassName == null) {
			this.#setItemCamera();
		}
		for (let [className, classModel] of this.#classModels) {
			classModel.setVisible(className == activeClassName);
		}
	}

	#hasActiveClass() {
		for (let [className, classModel] of this.#classModels) {
			if (classModel.visible) {
				return true;
			}
		}
		return false;
	}

	async #checkBodyGroups(className: string, tf2Item: any/*TODO:improve type*/) {
		let classModel = await this.#getClassModel(className);
		if (classModel) {
			let bodyGroupList;
			classModel.renderBodyParts(true);

			classModel.resetBodyPartModels();
			for (let bodyPart of TF2_CLASSES_REMOVABLE_PARTS) {
				classModel.renderBodyPart(bodyPart, false);
			}

			// Check bodygroups
			bodyGroupList = tf2Item.player_bodygroups;
			if (bodyGroupList) {
				for (let bodyGroupIndex in bodyGroupList) {
					let bodyGroup = bodyGroupList[bodyGroupIndex];
					classModel.setBodyPartModel(bodyGroupIndex, bodyGroup);
				}
			}

			// Override bodygroups
			bodyGroupList = tf2Item.wm_bodygroup_override;
			if (bodyGroupList) {
				for (let bodyGroupIndex in bodyGroupList) {
					let bodyGroup = bodyGroupList[bodyGroupIndex];
					classModel.setBodyPartIdModel(Number(bodyGroupIndex), bodyGroup);
				}
			}
		}
	}

	/*
	hide() {
		hide(this.#htmlControls);
	}
	*/

	getScene(): Scene {
		return this.#scene;
	}

	getListingScene(listingId: string): Scene {
		let scene = this.#scenePerId.get(listingId);
		if (!scene) {
			scene = new Scene({
				parent: this.#scene,
				background: new ColorBackground({ color: MARKET_LISTING_BACKGROUND_COLOR }),
				childs: [
					new SceneNode({ entity: this.#lightsGroup }),
				],
			});
			this.#scenePerId.set(listingId, scene);
		}
		return scene;
	}

	/*
	async #getRotationControl(listingId: string): Promise<RotationControl> {
		let rotationControl = this.#rotationControlPerId.get(listingId);
		if (!rotationControl) {
			rotationControl = new RotationControl();
			this.#rotationControlPerId.set(listingId, rotationControl);

			const result = await chrome.storage.sync.get('tf2.rotation');
			const rotation = result['tf2.rotation'];
			rotationControl.setSpeed(rotation ?? 1);
		}

		return rotationControl;
	}
	*/

	getCameraGroup(): Group {
		return this.#lightsGroup;
	}
}
