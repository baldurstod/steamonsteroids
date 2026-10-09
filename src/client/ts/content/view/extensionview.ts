import { hide, show } from 'harmony-ui';

export class ExtensionView {
	protected shadowRoot?: ShadowRoot;

	protected initHTML(): void {
		throw new Error('override me');
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	protected refreshHTML(): void { }

	getHTML(): HTMLElement {
		if (!this.shadowRoot) {
			this.initHTML();
		}
		this.refreshHTML();
		return this.shadowRoot?.host as HTMLElement;
	}

	hide(): void {
		hide(this.getHTML());
	}

	show(): void {
		show(this.getHTML());
	}
}
