export enum ControllerEvents {
	Tf2RefreshListing = 'refreshlisting',
}

export const Controller = new EventTarget();

export function controllerDispatchEvent(type: ControllerEvents, options?: CustomEventInit) {
	Controller.dispatchEvent(new CustomEvent(type, options));
}

export function controlleraddEventListener(type: ControllerEvents, callback: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): void {
	Controller.addEventListener(type, callback, options);
}
