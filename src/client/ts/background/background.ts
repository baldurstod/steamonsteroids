import { PaintKitDefinitions } from 'harmony-tf2-utils';
import { TF2_ITEMS_URL, CSGO_ITEMS_URL, TF2_WARPAINT_DEFINITIONS_URL } from '../constants';
import { API_GET_ASSET_CLASS_INFO_ENDPOINT, API_INSPECT_TF2_WEAPON_ENDPOINT, API_INSPECT_CSGO_WEAPON_ENDPOINT } from '../constants';

class BackGround {
	static #assetClassInfos = new Map<number, Map<number, any/*TODO: improve type*/>>();
	static #inspectedWeapons = new Map<string, any/*TODO: improve type*/>();
	static #tf2Schema?: any;
	static #cs2Schema?: any;
	static {
		this.#setupMessageListener();
	}

	static async #messageListener(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
		switch (message.action) {
			case 'get-asset-class-info':
				sendResponse(await this.getAssetClassInfo(message.appId, message.classId));
				break;
			case 'get-paintkit-definition':
				sendResponse(await PaintKitDefinitions.getDefinition(message.protodefid));
				break;
			case 'get-tf2-item':
				sendResponse(await this.getTF2Item(Number(message.defIndex), message.styleId));
				break;
			case 'get-tf2-effect':
				sendResponse(await this.getTF2Effect(Number(message.effectId)));
				break;
			case 'get-csgo-item':
				let item = await this.getCSGOItem(Number(message.defIndex));
				let paintkit = await this.getCSGOPaintkit(Number(message.paintkitId));
				sendResponse({ item: item, paintkit: paintkit });
				break;
			case 'get-csgo-sticker':
				sendResponse(await this.getCSGOSticker(Number(message.stickerId)));
				break;
			case 'inspect-item':
				sendResponse(await this.inspectItem(message.link));
				break;
			case 'fetch':

				function readBinaryStringFromArrayBuffer(arrayBuffer: ArrayBuffer, onSuccess: (arg0: any/*TODO:better type*/) => void, onFail?: (arg0: any/*TODO:better type*/) => void) {
					const reader = new FileReader();
					reader.addEventListener('load', () => onSuccess(reader.result));
					if (onFail) {
						reader.addEventListener('error', () => onFail(reader.result));
					}
					reader.readAsBinaryString(new Blob([arrayBuffer],
						{ type: 'application/octet-stream' }));
				}
				const response = await fetch(message.resource, message.options);
				//console.log(response);
				const ab = await response.arrayBuffer();
				const foobar = new Uint8Array(ab);
				//console.log(String.fromCharCode.apply(null, foobar));

				//const blob = new Blob([ab], { type: 'application/octet-stream' });

				readBinaryStringFromArrayBuffer(ab, str => {
					//console.log(ab);
					//console.log(str);

					sendResponse({
						ab: ab,
						//test: Array.apply(null, new Uint8Array(ab)),
						body: str,//await blob.text(), //String.fromCharCode.apply(null, foobar),//decoder.decode(ab),//await response.text(),//await convertBlobToBase64(await response.blob()),
						status: response.status,
						statusText: response.statusText,
					});
				})
				break;
		}
	}

	static #setupMessageListener() {
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			this.#messageListener(message, sender, sendResponse);
			return true;
		});
	}

	static async getAssetClassInfo(appId: number, classId: number) {
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

	static async getTF2Item(defindex: any/*TODO:better type*/, styleId = 0) {
		if (!this.#tf2Schema) {
			let tf2Response = await fetch(TF2_ITEMS_URL);
			this.#tf2Schema = await tf2Response.json();
		}
		let items = this.#tf2Schema?.items;
		if (items) {
			let item = items[defindex] ?? items[`${defindex}~${styleId}`];
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

	static async getTF2Effect(effectId: number) {
		if (!this.#tf2Schema) {
			let tf2Response = await fetch(TF2_ITEMS_URL);
			this.#tf2Schema = await tf2Response.json();
		}
		let systems = this.#tf2Schema?.systems;
		if (systems) {
			let system = systems[effectId];
			if (system) {
				return system;
			}
		}
		return false;
	}

	static async getCSGOItem(defindex: any/*TODO:better type*/) {
		if (!this.#cs2Schema) {
			let csgoResponse = await fetch(CSGO_ITEMS_URL);
			this.#cs2Schema = await csgoResponse.json();
		}
		let items = this.#cs2Schema?.items;
		if (items) {
			let item = items[defindex];
			if (item) {
				return item;
			}
		}
		return false;
	}

	static async getCSGOPaintkit(paintkitId: number) {
		if (!this.#cs2Schema) {
			let csgoResponse = await fetch(CSGO_ITEMS_URL);
			this.#cs2Schema = await csgoResponse.json();
		}
		let paintkits = this.#cs2Schema?.paintkits;
		if (paintkits) {
			let paintkit = paintkits[paintkitId];
			if (paintkit) {
				return paintkit;
			}
		}
		return false;
	}

	static async getCSGOSticker(stickerId: number) {
		if (!this.#cs2Schema) {
			let csgoResponse = await fetch(CSGO_ITEMS_URL);
			this.#cs2Schema = await csgoResponse.json();
		}
		let stickers = this.#cs2Schema?.stickers;
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
			url = API_INSPECT_CSGO_WEAPON_ENDPOINT + '?url=' + inspectLink;
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

	static async initPaintKits() {
		//await new WeaponManager().initPaintKitDefinitions(TF2_WARPAINT_DEFINITIONS_URL);
	}

	static async getPaintKit() {
		await this.initPaintKits();

	}
}
