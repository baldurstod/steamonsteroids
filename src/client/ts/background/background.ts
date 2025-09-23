import { PaintKitDefinitions } from 'harmony-tf2-utils';
import { JSONObject } from 'harmony-types';
import { API_GET_ASSET_CLASS_INFO_ENDPOINT, API_INSPECT_CS2_WEAPON_ENDPOINT, API_INSPECT_TF2_WEAPON_ENDPOINT, CS2_ITEMS_URL, TF2_ITEMS_URL } from '../constants';

class BackGround {
	static #assetClassInfos = new Map<number, Map<number, any/*TODO: improve type*/>>();//TODO: turn into Map2
	static #inspectedWeapons = new Map<string, any/*TODO: improve type*/>();
	static #tf2Schema?: JSONObject/*TODO: improve type*/;
	static #cs2Schema?: JSONObject/*TODO: improve type*/;

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
				sendResponse(await PaintKitDefinitions.getDefinition(message.protodefid));
				break;
			case 'get-tf2-item':
				sendResponse(await this.#getTF2Item(Number(message.defIndex), message.styleId));
				break;
			case 'get-tf2-effect':
				sendResponse(await this.#getTF2Effect(Number(message.effectId)));
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
				sendResponse(await this.inspectItem(message.link));
				break;
			case 'fetch':
				const response = await fetch(message.resource, message.options);
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
		let apiResponse = await fetch(apiUrl);
		let apiResponseJSON = await apiResponse.json();
		//console.log(apiResponseJSON);
		if (apiResponseJSON && apiResponseJSON.success === true) {
			app.set(classId, apiResponseJSON.result);
			return apiResponseJSON.result;
		}
		return null;
	}

	static async #getTF2Item(defindex: number, styleId = 0) {
		if (!this.#tf2Schema) {
			let tf2Response = await fetch(TF2_ITEMS_URL);
			this.#tf2Schema = await tf2Response.json();
		}
		let items = this.#tf2Schema?.items;
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
		if (!this.#tf2Schema) {
			let tf2Response = await fetch(TF2_ITEMS_URL);
			this.#tf2Schema = await tf2Response.json();
		}
		let systems = this.#tf2Schema?.systems as JSONObject;
		if (systems) {
			let system = systems[effectId];
			if (system) {
				return system;
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

	static async inspectItem(inspectLink: string) {
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
		let response = await fetch(url);
		let responseJson = await response.json();
		if (responseJson.success) {
			//console.error(responseJson.item);
			this.#inspectedWeapons.set(inspectLink, responseJson.item);
			return responseJson.item;
		}
		return null;
	}
}
