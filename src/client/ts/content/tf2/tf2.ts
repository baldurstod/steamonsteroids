import { vec3 } from 'gl-matrix';
import { Source1ModelInstance, Source1TextureManager, TextureManager } from 'harmony-3d';
//import { Tf2Team } from 'harmony-tf2-utils';
import { API_GET_UCG_IMAGE_ENDPOINT } from '../../constants';
import { Team } from './loadout/enums';

export function getTF2ModelName(item: any/*TODO: improve type*/, className: string): { model: string, attachedModels: string[] | null } | null {
	if (item) {
		let attachedModels: string[] | null = null;
		if (item.attached_models) {
			attachedModels = [item.attached_models];
		}

		if (item.model_player_per_class) {
			if (item.model_player_per_class[className]) {
				return { model: item.model_player_per_class[className], attachedModels: attachedModels };
			}

			let basename = item.model_player_per_class['basename'];

			let originalClassName = className;
			if (className == 'demoman') {
				className = 'demo';
			}

			if (basename) {
				if (item.used_by_classes) {
					if (item.used_by_classes[originalClassName] == 1) {
						return { model: basename.replace(/%s/g, className), attachedModels: attachedModels };
					} else {
						let arr = Object.keys(item.used_by_classes);
						if (arr.length > 0) {
							let replacementClassName = arr[0];

							if (replacementClassName == 'demoman') {
								replacementClassName = 'demo';
							}
							return { model: basename.replace(/%s/g, replacementClassName), attachedModels: attachedModels };
						}
					}
				}

			}
		}

		if (item.model_player) {
			return { model: item.model_player, attachedModels: attachedModels };
		}

		if (item.model_player_per_class) {
			let arr = Object.keys(item.model_player_per_class);
			if (arr.length > 0) {
				return { model: item.model_player_per_class[arr[0]], attachedModels: attachedModels };
			}
		}
	}
	return null;
}

export function setTF2ModelAttributes(model: Source1ModelInstance, item: any/*TODO: improve type*/, teamColor: Team = Team.Red) {
	if (model && item) {
		let itemTintRGB = (teamColor == Team.Red) ? item.set_item_tint_rgb : (item.set_item_tint_rgb_2 ?? item.set_item_tint_rgb);
		if (itemTintRGB) {
			model.tint = colorToTint(itemTintRGB);
		}

		if (item.custom_texture) {
			setCustomTexture(model, `${API_GET_UCG_IMAGE_ENDPOINT}?&appid=440&ugcid=${item.custom_texture}`);
		}
	}
	return '';
}

async function setCustomTexture(model: Source1ModelInstance, imageUrl: string) {
	let image = new Image();
	image.onload = function () {
		const { name: textureName, texture } = Source1TextureManager.addInternalTexture(model.sourceModel.repository);
		model.materialsParams.customtexture = textureName;
		TextureManager.fillTextureWithImage(texture, image);
	}
	image.crossOrigin = 'anonymous';
	image.src = imageUrl;
}

function colorToTint(color: number): vec3 | null {
	if (isNaN(color)) {
		return null;
	}
	var tint = vec3.create();
	tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
	tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
	tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
	return tint;
}


export function selectCharacterAnim(className: string, classModel: Source1ModelInstance, tf2Item: any/*TODO: improve type*/) {
	if (tf2Item.anim_slot && tf2Item.anim_slot.toLowerCase() != 'building') {
		if (tf2Item.anim_slot.toLowerCase() == 'primary2') {
			classModel.playSequence('stand_primary');
		} else if (tf2Item.anim_slot.toLowerCase() != 'force_not_used') {
			classModel.playSequence('stand_' + tf2Item.anim_slot);
		}
	} else {
		let slot = null;
		switch (tf2Item.item_slot) {
			case 'primary':
			case 'secondary':
			case 'melee':
			case 'pda':
				slot = tf2Item.item_slot;
				break;
			case 'building':
				slot = 'sapper';
				break;
			case 'force_building':
				slot = 'building';
				break;
		}

		if (tf2Item.used_by_classes) {
			for (let c in tf2Item.used_by_classes) {
				if (c == className
					&& isNaN(tf2Item.used_by_classes[c])) {
					slot = tf2Item.used_by_classes[c];
					break;
				}
			}
		}
		if (slot) {
			classModel.playSequence('stand_' + slot);
		}
	}
}
