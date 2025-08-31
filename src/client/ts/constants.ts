import { vec4 } from 'gl-matrix';

export const APP_ID_TF2 = 440;
export const APP_ID_DOTA2 = 570;
export const APP_ID_CS2 = 730;

export const MOUSE_ENTER_DELAY = 200

export const TF2_REPOSITORY = 'https://tf2content.loadout.tf/';
export const CS2_REPOSITORY = 'https://cs2content.csloadout.com/';

export const INVENTORY_ITEM_CLASSNAME = 'item';
export const ACTIVE_INVENTORY_PAGE = 'active_inventory_page';

export const TF2_WARPAINT_DEFINITIONS_URL = TF2_REPOSITORY + 'generated/warpaint_definitions.json';

export const API_GET_ASSET_CLASS_INFO_ENDPOINT = 'https://assetclassinfo.accurateskins.com/';
export const TF2_ITEMS_URL = 'https://loadout.tf/generated/items/items_english.json';
export const CS2_ITEMS_URL = 'https://csloadout.com/generated/items/items_english.json';

export const API_GET_UCG_IMAGE_ENDPOINT = 'https://loadout.tf/php/steam/getugcimage.php';

export const API_INSPECT_TF2_WEAPON_ENDPOINT = 'https://inspecttf2.accurateskins.com/';
export const API_INSPECT_CS2_WEAPON_ENDPOINT = 'https://inspectcsgo.accurateskins.com/';

export const MARKET_LISTING_BACKGROUND_COLOR = vec4.fromValues(0.086, 0.125, 0.176, 1.0);
export const INVENTORY_BACKGROUND_COLOR = vec4.fromValues(0.11, 0.122, 0.129, 1.0);

export const MARKET_LISTING_ROW_CLASSNAME = 'market_recent_listing_row';
export const MARKET_LISTING_NAME_CLASSNAME = 'market_listing_item_name_block';
export const MARKET_LISTING_IMG_CLASSNAME = 'market_listing_item_img_container';
export const MARKET_BUTTON_CLASSNAME = 'market_listing_buy_button';
export const MARKET_ACTION_BUTTONS_CLASSNAME = 'market_listing_action_buttons';

export const DECORATED_WEAPONS: Record<string, number> = {
	'Paint kit Tool': 9536,
	'Ubersaw': 37,
	'Scotsman\'s Skullcutter': 172,
	'Knife': 194,
	'Wrench': 197,
	'Shotgun': 199,
	'Scattergun': 200,
	'Sniper rifle': 201,
	'Minigun': 202,
	'SMG': 203,
	'Rocket launcher': 205,
	'Grenade Launcher': 206,
	'Sticky launcher': 207,
	'Flamethrower': 208,
	'Pistol': 209,
	'Revolver': 210,
	'Medigun': 211,
	'Powerjack': 214,
	'Degreaser': 215,
	'Shortstop': 220,
	'Holy Mackerel': 221,
	'Black Box': 228,
	'Amputator': 304,
	'Crusader\'s Crossbow': 305,
	'Loch-n-Load': 308,
	'Brass Beast': 312,
	'Back Scratcher': 326,
	'Claidheamohmor': 327,
	'Jag': 329,
	'Detonator': 351,
	'Shahanshah': 401,
	'Bazaar Bargain': 402,
	'Persian Persuader': 404,
	'Reserve Shooter': 415,
	'Tomislav': 424,
	'Family Business': 425,
	'Disciplinary Action': 447,
	'Soda Popper': 448,
	'Winger': 449,
	'Scorch Shot': 740,
	'Loose Cannon': 996,
	'Rescue Ranger': 997,
	'Air Strike': 1104,
	'Iron Bomber': 1151,
	'Panic Attack': 1153,
	'Dragon\'s Fury': 1178,
}
