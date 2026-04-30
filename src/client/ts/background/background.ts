import { WarpaintDefinitions } from 'harmony-tf2-utils';
import { JSONObject } from 'harmony-types';
import { API_GET_ASSET_CLASS_INFO_ENDPOINT, API_INSPECT_CS2_WEAPON_ENDPOINT, API_INSPECT_TF2_WEAPON_ENDPOINT, CS2_ITEMS_URL, TF2_ITEMS_URL } from '../constants';

class BackGround {
	static #assetClassInfos = new Map<number, Map<number, any/*TODO: improve type*/>>();//TODO: turn into Map2
	static #inspectedWeapons = new Map<string, any/*TODO: improve type*/>();
	static #tf2Schema = new Map<string, Promise<JSONObject>>;
	static #cs2Schema?: JSONObject/*TODO: improve type*/;
	static #cache?: Cache;

	static {
		this.#setupMessageListener();
	}

	static async #messageListener(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
		const convertBlobToBase64 = (blob: Blob) => new Promise<string>(resolve => {
			const reader = new FileReader();
			reader.readAsDataURL(blob);
			reader.onloadend = () => {
				const base64data = reader.result as string;
				resolve(base64data);
			};
		});
		switch (message.action) {
			case 'get-asset-class-info':
				sendResponse(await this.#getAssetClassInfo(message.appId, message.classId));
				break;
			case 'get-paintkit-definition':
				sendResponse(await WarpaintDefinitions.getDefinition(message.protodefid));
				break;
			case 'get-tf2-item':
				sendResponse(await this.#getTF2Item(Number(message.defIndex), message.styleId));
				break;
			case 'get-tf2-effect':
				sendResponse(await this.#getTF2Effect(Number(message.effectId)));
				break;
			case 'get-tf2-effect-by-name':
				sendResponse(await this.#getTF2EffectByName(message.language, message.name));
				break;
			case 'get-cs2-item':
				let item = await this.#getCS2Item(Number(message.defIndex));
				let paintkit = await this.#getCS2Paintkit(Number(message.paintkitId));
				sendResponse({ item: item, paintkit: paintkit });
				break;
			case 'get-cs2-sticker':
				sendResponse(await this.#getCS2Sticker(Number(message.stickerId)));
				break;
			case 'inspect-item':
				sendResponse(await this.#inspectItem(message.link));
				break;
			case 'fetch':
				const response = await this.#fetch(message.resource, message.options);

				const url = await convertBlobToBase64(await response.blob());
				const b64 = url.indexOf(';base64,') + 8;

				sendResponse({
					base64: url.substring(b64),
					status: response.status,
					statusText: response.statusText,
				});
				break;
		}
	}

	static #setupMessageListener() {
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			this.#messageListener(message, sender, sendResponse);
			return true;
		});
	}

	static async #getAssetClassInfo(appId: number, classId: number) {
		let app = this.#assetClassInfos.get(appId);
		if (!app) {
			app = new Map();
			this.#assetClassInfos.set(appId, app);
		}
		if (app.has(classId)) {
			return app.get(classId);
		}

		let apiUrl = `${API_GET_ASSET_CLASS_INFO_ENDPOINT}/${appId}/${classId}`;
		let apiResponse = await this.#fetch(apiUrl);
		let apiResponseJSON = await apiResponse.json();
		//console.log(apiResponseJSON);
		if (apiResponseJSON && apiResponseJSON.success === true) {
			app.set(classId, apiResponseJSON.result);
			return apiResponseJSON.result;
		}
		return null;
	}

	static async #getTF2Item(defindex: number, styleId = 0) {
		let items = (await this.#getTf2Schema('english'))?.items;
		if (items) {
			let item = (items as JSONObject)[defindex] ?? (items as JSONObject)[`${defindex}~${styleId}`];
			if (item) {
				//console.log(item);
				return item;
			} else {
				//hack for legacy paintkits
				if (defindex >= 16102 && defindex <= 18000) {
					let paintkitProtoDefIndex = defindex < 17000 ? defindex - 16000 : defindex - 17000;
					return {
						model_player: "models/items/paintkit_tool.mdl",
						paintkit_base: 1,
						paintkit_proto_def_index: paintkitProtoDefIndex,
						used_by_classes: {
							demoman: "1",
							engineer: "1",
							heavy: "1",
							medic: "1",
							pyro: "1",
							scout: "1",
							sniper: "1",
							soldier: "1",
							spy: "1"
						}
					}
				}
			}
		}
		return false;
	}

	static async #getTF2Effect(effectId: number) {
		let systems = (await this.#getTf2Schema('english'))?.systems as JSONObject;
		if (systems) {
			let system = systems[effectId];
			if (system) {
				return system;
			}
		}
		return false;
	}

	static async #getTF2EffectByName(language: string, name: string) {
		name = name.trim();
		let systems = (await this.#getTf2Schema(language))?.systems as JSONObject;
		if (systems) {
			for (const id in systems) {
				const group = systems[id] as JSONObject;
				for (const id2 in group) {
					const system = group[id2] as JSONObject;
					if (system.name == name) {
						return system;
					}
				}
			}
		}
		return false;
	}

	static async #getCS2Item(defindex: number) {
		if (!this.#cs2Schema) {
			let cs2Response = await fetch(CS2_ITEMS_URL);
			this.#cs2Schema = await cs2Response.json();
		}
		let items = this.#cs2Schema?.items as JSONObject;
		if (items) {
			let item = items[defindex];
			if (item) {
				return item;
			}
		}
		return false;
	}

	static async #getCS2Paintkit(paintkitId: number) {
		if (!this.#cs2Schema) {
			let cs2Response = await fetch(CS2_ITEMS_URL);
			this.#cs2Schema = await cs2Response.json();
		}
		let paintkits = this.#cs2Schema?.paintkits as JSONObject;
		if (paintkits) {
			let paintkit = paintkits[paintkitId];
			if (paintkit) {
				return paintkit;
			}
		}
		return false;
	}

	static async #getCS2Sticker(stickerId: number) {
		if (!this.#cs2Schema) {
			let cs2Response = await fetch(CS2_ITEMS_URL);
			this.#cs2Schema = await cs2Response.json();
		}
		let stickers = this.#cs2Schema?.stickers as JSONObject;
		if (stickers) {
			let sticker = stickers[stickerId];
			if (sticker) {
				return sticker;
			}
		}
		return false;
	}

	static async #inspectItem(inspectLink: string) {
		if (!inspectLink) {
			return null;
		}
		if (this.#inspectedWeapons.has(inspectLink)) {
			return this.#inspectedWeapons.get(inspectLink);
		}
		let url;

		if (inspectLink.includes('tf_econ_item_preview')) {
			url = API_INSPECT_TF2_WEAPON_ENDPOINT + '?url=' + inspectLink;
		} else if (inspectLink.includes('csgo_econ_action_preview')) {
			url = API_INSPECT_CS2_WEAPON_ENDPOINT + '?url=' + inspectLink;
		} else {
			return null;
		}

		//console.error(url);
		let response = await this.#fetch(url);
		let responseJson = await response.json();
		if (responseJson.success) {
			//console.error(responseJson.item);
			this.#inspectedWeapons.set(inspectLink, responseJson.item);
			return responseJson.item;
		}
		return null;
	}

	static async #fetch(url: string, init?: RequestInit): Promise<Response> {
		/*
		// TODO: add cache quota management
		navigator.storage.estimate().then((estimate) => {
			if (estimate.usage === undefined || estimate.quota === undefined) {
				return;
			}
			console.info((estimate.usage / estimate.quota) * 100);
			console.info(`${(estimate.quota / 1024 / 1024).toFixed(2)}MB`);
			console.info(`${(estimate.usage / 1024 / 1024).toFixed(2)}MB`);
		});
		*/

		// Open the cache if it doesn't exist
		this.#cache = this.#cache ?? await caches.open('v1');

		let response: Response | undefined = await this.#cache.match(url);
		if (!response) {
			// If cache miss, fetch the request
			response = await fetch(url, init);
			if (url.startsWith('https://')) {
				this.#cache.put(url, response.clone());
			}
		}

		return response;
	}

	static async #getTf2Schema(language: string): Promise<JSONObject> {
		let schema = this.#tf2Schema.get(language);
		if (schema) {
			return schema;
		}

		schema = new Promise<JSONObject>(async resolve => {
			const tf2Response = await fetch(TF2_ITEMS_URL.replace('english', language));
			schema = await tf2Response.json();

			resolve(schema!);
		});

		this.#tf2Schema.set(language, schema);

		return schema;
	}
}
