
import { createElement } from 'harmony-ui';
import { Camera, Group, PointLight, Repositories, Repository, RotationControl, Scene, Source1ModelInstance } from 'harmony-3d';
import { DECORATED_WEAPONS, TF2_REPOSITORY } from '../../constants';
import { TextureCombiner, WeaponManagerEventTarget } from 'harmony-3d-utils';
import { Controller } from '../controller';
import { sortSelect } from '../utils/sort';

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
	#htmlClassIcons?: HTMLSelectElement;
	#forcedWeaponIndex: string = '';
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

		this.#htmlWeaponSelector = document.createElement('select');
		this.#htmlWeaponSelector.className = 'weapon-selector';
		this.#htmlWeaponSelector.addEventListener('change', event => {
			this.#forcedWeaponIndex = (event.target as HTMLSelectElement).value;
			chrome.storage.sync.set({ warpaintWeaponIndex: (event.target as HTMLSelectElement).value });
			this.#refreshListing();
		});

		for (let weaponName in DECORATED_WEAPONS) {
			let weaponDefIndex = DECORATED_WEAPONS[weaponName];
			let weaponOption = document.createElement('option');
			weaponOption.innerHTML = weaponName;
			weaponOption.value = weaponDefIndex;
			this.#htmlWeaponSelector.appendChild(weaponOption);
		}
		sortSelect(this.#htmlWeaponSelector);

		this.#htmlClassIcons = document.createElement('div');
		this.#htmlClassIcons.className = 'canvas-container-controls-class-icons';

		let htmlPlayPauseButton = createElement('button', {
			class: 'canvas-container-controls-playpause play',
			innerHTML: pauseSVG,
			parent: this.htmlControls,
			events: {
				click: () => {
					htmlPlayPauseButton.buttonState = !htmlPlayPauseButton.buttonState
					if (htmlPlayPauseButton.buttonState) {
						this.#rotationControl.rotationSpeed = 1;
						htmlPlayPauseButton.innerHTML = pauseSVG;
					} else {
						this.#rotationControl.rotationSpeed = 0;
						htmlPlayPauseButton.innerHTML = playSVG;
					}
				}
			},
			buttonState: true,
		});


		this.loadWarpaintWeapon();
		this.htmlControls.append(this.htmlWeaponSelector, this.htmlClassIcons);
		return this.htmlControls;
	}

	async #refreshListing() {
		if (this.application.isMarketPage) {
			await this.application.renderListing(this.application.currentListingId, true);
		}
		if (this.application.isInventoryPage) {
			await this.application.renderInventoryListing(this.application.currentAppId, this.application.currentContextId, this.application.currentAssetId, undefined, true);
		}
	}
}
