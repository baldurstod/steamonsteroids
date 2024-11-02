import { vec3 } from 'gl-matrix';

export const TF2_MERCENARIES = new Map<string, { modelPath: string, defaultAnimation: string }>(
	[
		['scout', {
			modelPath: 'models/player/scout',
			defaultAnimation: 'SelectionMenu_Idle'
		}]
		, ['sniper', {
			modelPath: 'models/player/sniper',
			defaultAnimation: 'stand_secondary'
		}]
		, ['soldier', {
			modelPath: 'models/player/soldier',
			defaultAnimation: 'stand_secondary'
		}]
		, ['demoman', {
			modelPath: 'models/player/demo',
			defaultAnimation: 'stand_secondary'
		}]
		, ['medic', {
			modelPath: 'models/player/medic',
			defaultAnimation: 'stand_secondary'
		}]
		, ['heavy', {
			modelPath: 'models/player/heavy',
			defaultAnimation: 'stand_secondary'
		}]
		, ['pyro', {
			modelPath: 'models/player/pyro',
			defaultAnimation: 'stand_secondary'
		}]
		, ['spy', {
			modelPath: 'models/player/spy',
			defaultAnimation: 'stand_secondary'
		}]
		, ['engineer', {
			modelPath: 'models/player/engineer',
			defaultAnimation: 'stand_secondary'
		}]
	]
);

export const TF2_PLAYER_CAMERA_TARGET = vec3.fromValues(0, 0, 45);
export const TF2_PLAYER_CAMERA_POSITION = vec3.fromValues(300, -300, 45);
export const TF2_CLASSES_REMOVABLE_PARTS: Array<string> = ['heavy_hand_dex_bodygroup', 'robotarm_bodygroup', 'darts_bodygroup', 'spyMask', 'rocket', 'medal_bodygroup', 'demo_smiley'];
