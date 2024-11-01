
import { createElement, HTMLHarmonyToggleButtonElement } from 'harmony-ui';
import { Camera, Group, PointLight, Repositories, Repository, RotationControl, Scene, Source1ModelInstance } from 'harmony-3d';
import { DECORATED_WEAPONS, TF2_REPOSITORY } from '../../constants';
import { TextureCombiner, WeaponManagerEventTarget } from 'harmony-3d-utils';
import { Controller, controllerDispatchEvent, ControllerEvents } from '../controller';
import { sortSelect } from '../utils/sort';
import { pauseSVG, playSVG } from 'harmony-svg';
import 'harmony-ui/dist/define/harmony-toggle-button.js';

enum TeamColor {
	RED = 0,
	BLU = 1,
}

enum GenerationState {
	Started = 0,
	Sucess,
	Failure,
}

export class TF2Viewer {
	#classModels = new Map<string, Source1ModelInstance>();
	#scene = new Scene();
	#pointLight1: PointLight = new PointLight({ range: 500, parent: this.#scene, intensity: 0.5, position: [100, 100, 100] });
	#pointLight2: PointLight = new PointLight({ range: 500, parent: this.#scene, intensity: 0.5, position: [100, -100, 100] });
	#rotationControl = new RotationControl({ parent: this.#scene });
	#group = new Group({ parent: this.#rotationControl });
	#teamColor: TeamColor = TeamColor.RED;
	#htmlControls?: HTMLElement;
	#htmlWeaponSelector?: HTMLSelectElement;
	#htmlClassIcons?: HTMLElement;
	#forcedWeaponIndex: number | null = null;
	constructor() {
		Repositories.addRepository(new Repository('tf2', TF2_REPOSITORY));
		//WeaponManager.reuseTextures = true;
		TextureCombiner.setTextureSize(2048);//TODO: set an option
		this.#initEvents();
	}

	#initEvents() {
		WeaponManagerEventTarget.addEventListener('started', () => Controller.dispatchEvent(new CustomEvent('setgenerationstate', { detail: GenerationState.Started })));
		WeaponManagerEventTarget.addEventListener('success', () => Controller.dispatchEvent(new CustomEvent('setgenerationstate', { detail: GenerationState.Sucess })));
		WeaponManagerEventTarget.addEventListener('failure', () => Controller.dispatchEvent(new CustomEvent('setgenerationstate', { detail: GenerationState.Failure })));
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

	async #refreshListing() {
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
}
