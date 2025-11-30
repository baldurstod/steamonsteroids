import { Scene } from 'harmony-3d';
import { BackgroundType } from './enums';
import { Ragdoll } from './loadout/characters/character';
import { EffectTemplate } from './loadout/effects/effecttemplate';
import { ItemTemplate } from './loadout/items/itemtemplate';
import { KillstreakColor } from './paints/killstreaks';

export enum ControllerEvent {
	UseBots = 'usebots',
	ShowCompetitiveStage = 'showcompetitivestage',
	ChangeMap = 'changemap',
	InitMapList = 'initmaplist',
	ToggleVideo = 'togglevideo',
	SetBackgroundType = 'setbackgroundtype',
	ShowBadge = 'showbadge',
	ImportFiles = 'importfiles',
	//HideAllPanels = 'hideallpanels',
	TogglePanel = 'togglepanel',
	ShareLoadout = 'shareloadout',
	SavePicture = 'savepicture',
	ExportSfm = 'exportsfm',
	ExportFbx = 'exportfbx',
	Export3d = 'export3d',
	ShowBugNotification = 'showbugnotification',
	ShowAboutNotification = 'showaboutotification',
	ToggleOptionsManager = 'toggleoptionsmanager',
	SetAnimSpeed = 'setanimspeed',
	SetAnim = 'setanim',
	PatreonClick = 'patreonclick',
	SelectCharacter = 'selectcharacter',
	CharacterChanged = 'characterchanged',
	SelectCamera = 'selectcamera',
	ResetCamera = 'resetcamera',
	SetItemFilter = 'setitemfilter',
	SetItemSortAscending = 'setitemsortascending',
	SetItemSortType = 'setitemsorttype',
	ItemsLoaded = 'itemsloaded',
	SystemsLoaded = 'systemsloaded',
	ItemPinned = 'itempinned',
	ItemClicked = 'itemclicked',
	EffectClicked = 'effectclicked',
	KillstreakClicked = 'killstreakclicked',
	TauntEffectClicked = 'taunteffectclicked',
	SetDecapitationLevel = 'setdecapitationlevel',
	FiltersUpdated = 'filtersupdated',
	ItemAdded = 'itemadded',
	ItemRemoved = 'itemremoved',
	EffectAdded = 'effectadded',
	EffectRemoved = 'effectremoved',
	RemoveEffect = 'removeeffect',
	PaintClick = 'paintclick',
	SheenClick = 'sheenclick',
	WeaponEffectClick = 'weaponeffectclick',
	WarpaintClick = 'warpaintclick',
	InitWarpaints = 'initwarpaints',
	WarpaintsLoaded = 'warpaintsloaded',
	SetInvulnerable = 'setinvulnerable',
	SetRagdoll = 'setragdoll',
	SetApplyToAll = 'setapplytoall',
	PresetsUpdated = 'presetsupdated',
	ImportPresets = 'importpresets',
	UseLayout = 'uselayout',
	SelectWarpaints = 'selectwarpaints',
	RepositoryAdded = 'repositoryAdded',
	ChangeAnimFrame = 'changeanimframe',
	SetProductFilter = 'setproductfilter',
	ActivateMeetTheTeamMap = 'activatemeettheteammap',
}

export type SetBackgroundType = {
	type: BackgroundType;
	param?: string | FileList | null;
}

export type ShowBadge = {
	tier: number;
	level: number;
}

export enum ItemFilterAttribute {
	Name,
	Selected,
	Workshop,
	HideConflict,
	TournamentMedals,
	ShowMultiClass,
	ShowOneClass,
	ShowAllClass,
	DoNotFilterPerClass,
	Paintable,
	Warpaintable,
	Halloween,
	DisplayMedals,
	DisplayWeapons,
	DisplayCosmetics,
	DisplayTaunts,
	Collection,
}

export type SetItemFilter = {
	attribute: ItemFilterAttribute;
	/*'name' | 'selected' | 'workshop' | 'hideConflict' | 'tournamentMedals' | 'showMultiClass' | 'showOneClass' | 'showAllClass' | 'doNotFilterPerClass'
	| 'pinned' | 'paintable' | 'warpaintable' | 'halloween' | 'displayMedals' | 'displayWeapons' | 'displayCosmetics' | 'displayTaunts' | 'collection';*/
	value: string | boolean | undefined;
}

export type ItemPinned = {
	item: ItemTemplate;
	pinned: boolean;
}
/*
export type SetInvulnerable = {
	invulnerable: boolean;
	applyToAll: boolean;
}

export type SetRagdoll = {
	ragdoll: Ragdoll;
	applyToAll: boolean;
}
*/

export type KillstreakClicked = {
	effect: EffectTemplate | null;
	color: KillstreakColor;
}

export type SetInvulnerable = {
	invulnerable: boolean;
	scene?: Scene;
}

export type SetRagdoll = {
	ragdoll: Ragdoll;
	scene?: Scene;
}

export enum ProductFilterAttribute {
	Name,
}

export class Controller {
	static readonly #eventTarget = new EventTarget();

	static addEventListener(type: ControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
		this.#eventTarget.addEventListener(type, callback, options);
	}

	static dispatchEvent<T>(type: ControllerEvent, options?: CustomEventInit<T>): boolean {
		return this.#eventTarget.dispatchEvent(new CustomEvent<T>(type, options));
	}

	static removeEventListener(type: ControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
		this.#eventTarget.removeEventListener(type, callback, options);
	}
}
