import { JSONObject } from '../../../types';
import { TF2_WARPAINT_DEFINITIONS_URL } from '../../../constants';

const TYPE_STRING_TO_INT: JSONObject = {
	'DEF_TYPE_PAINTKIT_VARIABLES': 6,
	'DEF_TYPE_PAINTKIT_OPERATION': 7,
	'DEF_TYPE_PAINTKIT_ITEM_DEFINITION': 8,
	'DEF_TYPE_PAINTKIT_DEFINITION': 9,
	'DEF_TYPE_HEADER_ONLY': 10,
}

export interface ProtoDefID {
	type: number;
	defindex: number;
}

export class PaintKitDefinitions {
	static warpaintDefinitionsPromise: Promise<JSONObject>;
	static warpaintDefinitions: JSONObject;

	static getWarpaintDefinitions(): Promise<JSONObject> {
		if (!this.warpaintDefinitionsPromise) {
			this.warpaintDefinitionsPromise = new Promise(async (resolve, reject) => {
				let reponse = await fetch(TF2_WARPAINT_DEFINITIONS_URL);
				this.warpaintDefinitions = await reponse.json();
				resolve(this.warpaintDefinitions);
			});
		}
		return this.warpaintDefinitionsPromise;
	}

	static setWarpaintDefinitions(warpaintDefinitions: JSONObject) {
		this.warpaintDefinitionsPromise = new Promise(async resolve => {
			resolve(warpaintDefinitions);
		});
	}

	static async getDefinition(cMsgProtoDefID: ProtoDefID) {
		let warpaintDefinitions = await this.getWarpaintDefinitions();
		if (warpaintDefinitions) {
			let type = warpaintDefinitions[String(TYPE_STRING_TO_INT[String(cMsgProtoDefID.type)]) ?? cMsgProtoDefID.type];
			if (type) {
				return (type as JSONObject)[String(cMsgProtoDefID.defindex)];
			}
		}
		return null;
	}
}
