
import { Camera, Group, PointLight, Repositories, RotationControl, Scene, Source1ModelInstance, Source1ParticleControler, WebRepository } from 'harmony-3d';
import { TextureCombiner, WeaponManager } from 'harmony-3d-utils';
import { pauseSVG, playSVG } from 'harmony-svg';
import { PaintKitDefinitions, Tf2Team } from 'harmony-tf2-utils';
import { createElement, hide, HTMLHarmonyToggleButtonElement, show } from 'harmony-ui';
import { setTimeoutPromise } from 'harmony-utils';
import { APP_ID_TF2, DECORATED_WEAPONS, TF2_REPOSITORY, TF2_WARPAINT_DEFINITIONS_URL } from '../../constants';
import { GenerationState } from '../../enums';
import { Controller, controllerDispatchEvent, ControllerEvents } from '../controller';
import { getInspectLink } from '../utils/inspect';
import { sortSelect } from '../utils/sort';
import { addSource1Model } from '../utils/sourcemodels';
import { getSheenTint } from './killstreak';
import { getTF2ModelName, selectCharacterAnim, setTF2ModelAttributes } from './tf2';
import { TF2_CLASSES_REMOVABLE_PARTS, TF2_MERCENARIES, TF2_PLAYER_CAMERA_POSITION, TF2_PLAYER_CAMERA_TARGET } from './tf2constants';

PaintKitDefinitions.setWarpaintDefinitionsURL(TF2_WARPAINT_DEFINITIONS_URL);

export class TF2Viewer {
	#classModels = new Map<string, Source1ModelInstance>();
	#scene = new Scene();
	#pointLight1: PointLight = new PointLight({ range: 500, parent: this.#scene, intensity: 0.5, position: [100, 100, 100] });
	#pointLight2: PointLight = new PointLight({ range: 500, parent: this.#scene, intensity: 0.5, position: [100, -100, 100] });
	#rotationControl = new RotationControl({ parent: this.#scene });
	#group = new Group({ parent: this.#rotationControl });
	#teamColor: Tf2Team = Tf2Team.RED;
	#htmlControls?: HTMLElement;
	#htmlWeaponSelector?: HTMLSelectElement;
	#htmlClassIcons?: HTMLElement;
	#forcedWeaponIndex: number | null = null;
	#currentClassName: string = '';
	#source1Model?: Source1ModelInstance | null;
	#selectClassPromise?: Promise<boolean>;
	#createModelPromise?: Promise<boolean>;
	#modelPath: string = '';

	constructor() {
		Repositories.addRepository(new WebRepository('tf2', TF2_REPOSITORY));
		//new WeaponManager().reuseTextures = true;
		TextureCombiner.setTextureSize(2048);//TODO: set an option
		this.#initEvents();
	}

	#initEvents() {
		WeaponManager.addEventListener('started', () => Controller.dispatchEvent(new CustomEvent('setgenerationstate', { detail: GenerationState.Started })));
		WeaponManager.addEventListener('success', () => Controller.dispatchEvent(new CustomEvent('setgenerationstate', { detail: GenerationState.Sucess })));
		WeaponManager.addEventListener('failure', () => Controller.dispatchEvent(new CustomEvent('setgenerationstate', { detail: GenerationState.Failure })));
	}

	setCamera(camera: Camera) {
		camera.addChild(this.#pointLight1);
		camera.addChild(this.#pointLight2);
	}

	initHtml() {
		this.#htmlControls = document.createElement('div');
		this.#htmlControls.className = 'canvas-container-controls';

		this.#htmlWeaponSelector = createElement('select', {
			parent: this.#htmlControls,
			class: 'weapon-selector',
			events: {
				change: (event: Event) => {
					this.#forcedWeaponIndex = Number((event.target as HTMLSelectElement).value);
					chrome.storage.sync.set({ warpaintWeaponIndex: (event.target as HTMLSelectElement).value });
					this.#refreshListing();
				},
			}
		}) as HTMLSelectElement;

		for (let weaponName in DECORATED_WEAPONS) {
			let weaponDefIndex = DECORATED_WEAPONS[weaponName];
			let weaponOption = document.createElement('option');
			weaponOption.innerHTML = weaponName;
			weaponOption.value = String(weaponDefIndex);
			this.#htmlWeaponSelector.appendChild(weaponOption);
		}
		sortSelect(this.#htmlWeaponSelector);

		this.#htmlClassIcons = createElement('div', {
			parent: this.#htmlControls,
			class: 'canvas-container-controls-class-icons',
		}) as HTMLElement;

		const htmlPlayPauseButton: HTMLHarmonyToggleButtonElement = createElement('harmony-toggle-button', {
			class: 'canvas-container-controls-playpause play',
			//innerHTML: pauseSVG,
			parent: this.#htmlControls,
			childs: [
				createElement('on', { innerHTML: playSVG }),
				createElement('off', { innerHTML: pauseSVG }),
			],
			events: {
				click: () => {
					//htmlPlayPauseButton.setAttribute('buttonState', ) = !htmlPlayPauseButton.buttonState
					if (htmlPlayPauseButton.state) {
						this.#rotationControl.rotationSpeed = 1;
						//htmlPlayPauseButton.innerHTML = pauseSVG;
					} else {
						this.#rotationControl.rotationSpeed = 0;
						//htmlPlayPauseButton.innerHTML = playSVG;
					}
				}
			},
			buttonState: true,
		}) as HTMLHarmonyToggleButtonElement;


		this.#loadWarpaintWeapon();
		return this.#htmlControls;
	}

	#refreshListing() {
		//Controller.dispatchEvent(new Event(ControllerEvents.Tf2RefreshListing, )
		controllerDispatchEvent(ControllerEvents.Tf2RefreshListing);
		/*
		if (this.application.isMarketPage) {
			await this.application.renderListing(this.application.currentListingId, true);
		}
		if (this.application.isInventoryPage) {
			await this.application.renderInventoryListing(this.application.currentAppId, this.application.currentContextId, this.application.currentAssetId, undefined, true);
		}
			*/
	}

	async renderListingTF2(listingOrSteamId: string, listingDatas: any/*TODO:better type*/, classInfo: any/*TODO:better type*/, assetId?: number, htmlImg?: HTMLImageElement) {
		show(this.#htmlControls);
		if (this.#htmlClassIcons) {
			this.#htmlClassIcons.innerText = '';
		}
		if ((listingDatas.appid == APP_ID_TF2) && listingDatas.market_hash_name.includes('War Paint')/* && this.application.canInspectWarpaintWeapons()*/) {
			show(this.#htmlWeaponSelector);
		} else {
			hide(this.#htmlWeaponSelector);
		}
		controllerDispatchEvent(ControllerEvents.ClearMarketListing);
		let defIndex = classInfo?.app_data?.def_index;
		let remappedDefIndex: number | null = null;
		if (defIndex) {
			defIndex = Number(defIndex);

			// If it's a paintkit, give it the defindex of the base paintkit tool
			if (defIndex >= 16000 && defIndex < 18000) {
				remappedDefIndex = this.#forcedWeaponIndex ?? 9536;
			}

			chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: remappedDefIndex ?? defIndex }, async (tf2Item) => {
				let modelPlayer = getTF2ModelName(tf2Item, this.#currentClassName);
				if (modelPlayer) {
					let inspectLink = getInspectLink(listingDatas, listingOrSteamId, assetId);
					if (inspectLink) {
						//this.application.setGenerationState(GENERATION_STATE_LOADING_MODEL);
						controllerDispatchEvent(ControllerEvents.SetGenerationState, { detail: GenerationState.LoadingModel });
						let source1Model = await this.#createTF2Model(modelPlayer);
						if (source1Model) {
							//show(this.application.htmlRowContainer);
							controllerDispatchEvent(ControllerEvents.ShowRowContainer);
							if (remappedDefIndex) {
								chrome.runtime.sendMessage({ action: 'get-tf2-item', defIndex: defIndex }, async (remappedTf2Item) => {
									this.#refreshWarpaint(listingOrSteamId, assetId, inspectLink, source1Model, remappedDefIndex!, remappedTf2Item, htmlImg, tf2Item);
								});
							} else {
								this.#refreshWarpaint(listingOrSteamId, assetId, inspectLink, source1Model, defIndex, tf2Item, htmlImg);
							}
						}
					} else {
						controllerDispatchEvent(ControllerEvents.HideRowContainer);
					}
				} else {
					controllerDispatchEvent(ControllerEvents.HideRowContainer);
				}
			});
		}
	}

	#refreshWarpaint(listingOrSteamId: any/*TODO:better type*/, assetId: any/*TODO:better type*/, inspectLink: any/*TODO:better type*/, source1Model: Source1ModelInstance, defIndex: number, tf2Item: any/*TODO:better type*/, htmlImg?: HTMLImageElement, remappedTf2Item?: any/*TODO:better type*/) {
		let paintKitId = tf2Item.paintkit_proto_def_index;

		//this.application.setGenerationState(GENERATION_STATE_RETRIEVING_ITEM_DATAS);
		controllerDispatchEvent(ControllerEvents.SetGenerationState, { detail: GenerationState.RetrievingItemDatas });
		chrome.runtime.sendMessage({ action: 'inspect-item', link: inspectLink }, async (item) => {

			paintKitId = paintKitId ?? item?.econitem?.paint_index;
			let paintKitWear = item?.econitem?.paint_wear;
			paintKitWear = Math.min(Math.max(paintKitWear, 0.2), 1.0);//I found some FN paintkits with a wear = 0
			let paintKitSeed = BigInt(item?.econitem?.custom_paintkit_seed ?? item?.econitem?.original_id ?? item?.econitem?.id ?? 0);
			let craftIndex = item?.econitem?.unique_craft_index;

			this.#populateTF2MarketListing(paintKitId, paintKitSeed, craftIndex);
			if (paintKitId && paintKitWear && paintKitSeed) {
				//console.log(paintKitId, paintKitWear, paintKitSeed);
				paintKitWear = (paintKitWear - 0.2) * 5 >> 0; // transform the wear from decimal point to integer
				WeaponManager.refreshItem({ sourceModel: source1Model, paintKitId: Number(paintKitId), paintKitWear: paintKitWear, id: String(defIndex), paintKitSeed: paintKitSeed });
				if (htmlImg) {
					//this.application.setSelectedInventoryItem(assetId, htmlImg);
					controllerDispatchEvent(ControllerEvents.SelectInventoryItem, { detail: { assetId: assetId, htmlImg: htmlImg } });
				}
			} else {
				//this.application.setGenerationState(GENERATION_STATE_SUCCESS);
				controllerDispatchEvent(ControllerEvents.SetGenerationState, { detail: GenerationState.Sucess });
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
			this.#displayClassIcons(remappedTf2Item ?? tf2Item);
		});
	}

	#setModelSkin(model: Source1ModelInstance, tf2Item: any/*TODO:better type*/) {
		if (model && tf2Item) {
			let skin = Number(this.#teamColor == Tf2Team.RED ? tf2Item.skin_red : tf2Item.skin_blu ?? tf2Item.skin_red);
			if (skin) {
				model.skin = skin;
			}
		}
	}

	async #attachModels(source1Model: Source1ModelInstance, tf2Item: any/*TODO:better type*/, econItem: any/*TODO:better type*/) {
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

	async #attachTF2Effects(source1Model: Source1ModelInstance, tf2Item: any/*TODO:better type*/, econItem: any/*TODO:better type*/) {
		if (source1Model && tf2Item && econItem) {
			if (econItem.set_attached_particle) {
				this.#attachTF2Effect(source1Model, econItem.set_attached_particle, tf2Item.particle_suffix);
			}
			if (tf2Item.set_attached_particle_static) {
				this.#attachTF2Effect(source1Model, tf2Item.set_attached_particle_static, tf2Item.particle_suffix);
			}
		}
	}

	async #attachTF2Effect(model: Source1ModelInstance, effectId: string, particleSuffix: string) {
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

	#displayClassIcons(tf2Item: any/*TODO:better type*/) {
		let usedByClasses = tf2Item?.used_by_classes;
		let removeCurrentClassModel = true;
		if (usedByClasses) {
			for (let className in usedByClasses) {
				if (usedByClasses[className] == 1) {
					this.#addClassIcon(className, tf2Item);

					if (className == this.#currentClassName) {
						this.#selectClass(className, tf2Item);
						removeCurrentClassModel = false;
					}
				}
			}
		}
		if (removeCurrentClassModel) {
			this.#setActiveClass(null);
		}
		this.#centerCameraOnItem();
	}

	async #centerCameraOnItem() {
		await setTimeoutPromise(1000);
		if (!this.#hasActiveClass() && this.#source1Model) {
			//this.application.centerCameraTarget(this.#source1Model);
			controllerDispatchEvent(ControllerEvents.CenterCameraTarget, { detail: this.#source1Model });
		}
	}

	#addClassIcon(className: string, tf2Item: any/*TODO:better type*/) {
		let htmlClassIcon = document.createElement('div');
		htmlClassIcon.className = 'canvas-container-controls-class-icon';
		let imageUrl = chrome.runtime.getURL(`images/class_icon/${className}.svg`);
		htmlClassIcon.style.backgroundImage = `url(${imageUrl})`;

		if (this.#htmlClassIcons) {
			this.#htmlClassIcons.append(htmlClassIcon);
		}

		htmlClassIcon.addEventListener('click', async () => {
			await this.#refreshListing();
			this.#selectClass(className, tf2Item);
		});
	}

	async #selectClass(className: string, tf2Item: any/*TODO:better type*/) {
		await this.#selectClassPromise;
		this.#selectClassPromise = new Promise(async (resolve, reject) => {
			this.#currentClassName = className;
			this.#setActiveClass(null);

			let classModel = await this.#getClassModel(className);
			this.#setActiveClass(className);
			this.#checkBodyGroups(className, tf2Item);
			if (classModel) {
				selectCharacterAnim(className, classModel, tf2Item);
				classModel.addChild(this.#source1Model);

				//this.application.setCameraTarget(TF2_PLAYER_CAMERA_TARGET, TF2_PLAYER_CAMERA_POSITION);
				controllerDispatchEvent(ControllerEvents.SetCameraTarget, {
					detail: {
						target: TF2_PLAYER_CAMERA_TARGET,
						position: TF2_PLAYER_CAMERA_POSITION,
					}
				});
			}
			resolve(true);
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

	async #createTF2Model(modelPath: string) {
		if (this.#source1Model) {
			this.#source1Model.remove();
		}
		await this.#createModelPromise;
		let createModelPromiseResolve: (value: boolean) => void = () => { };
		this.#createModelPromise = new Promise<boolean>((resolve) => createModelPromiseResolve = resolve);
		this.#modelPath = modelPath;
		if (this.#source1Model) {
			this.#source1Model.remove();
		}
		this.#source1Model = await addSource1Model('tf2', modelPath, this.#group);
		createModelPromiseResolve(true);


		if (this.#source1Model) {
			let seq = this.#source1Model.sourceModel.mdl.getSequenceById(0);
			if (seq) {
				this.#source1Model.playSequence(seq.name);
			}
		}
		this.#centerCameraOnItem();
		return this.#source1Model;
	}

	#populateTF2MarketListing(paintKitId: any/*TODO:better type*/, seed: any/*TODO:better type*/, craftIndex: any/*TODO:better type*/) {
		//let div = this.application.htmlCanvasItemInfo;//this.getMarketListingNameDiv(listingId);
		//if (div) {
		//div.innerHTML = '';
		let s: string = '';
		if (paintKitId && seed) {
			s = `<div>Seed: ${seed}</div>`;
		}
		if (craftIndex) {
			s += `<div>Craft #${craftIndex}</div>`;
		}
		//}

		controllerDispatchEvent(ControllerEvents.SetItemInfo, { detail: s });
	}

	async #getClassModel(className: string) {
		let classModel: Source1ModelInstance | null | undefined = this.#classModels.get(className);
		let mercenary = TF2_MERCENARIES.get(className);
		if (!classModel) {
			if (mercenary) {
				let classModel = await addSource1Model('tf2', mercenary.modelPath, this.#group);
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
		for (let [className, classModel] of this.#classModels) {
			classModel.visible = (className == activeClassName);
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

	async #checkBodyGroups(className: string, tf2Item: any/*TODO:better type*/) {
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

	hide() {
		hide(this.#htmlControls);
	}
}
