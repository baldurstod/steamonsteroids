import { JSONObject } from 'harmony-types';

const historyDbVersion = 1
const historyDbName = 'market-history';
const historyAssetStore = 'market-assets';
const historyTransactionStore = 'market-transactions';
const userRowIndex = 'user-row';

export type MarketAsset = {
	appId: string;
	contextId: string;
	assetId: string;
	asset: JSONObject;
}

export type MarketTransactionType = 'gain' | 'loss' | 'unknown';

export type MarketTransaction = {
	userId: string;
	transactionId: string;
	appId: string;
	contextId: string;
	assetId: string;
	// 1 based index from the end of the history. The last transaction has the index 1 and so on
	row: number;
	listed: string;
	acted: string;
	price: string;
	type: MarketTransactionType;
}

export class MarketHistory {
	static #dbPromiseResolve: (value: IDBDatabase | null) => void;
	static #dbPromise = new Promise<IDBDatabase | null>((resolve) => this.#dbPromiseResolve = resolve);
	static #dbOpenRequest?: IDBOpenDBRequest;

	static async #getDb(): Promise<IDBDatabase | null> {
		if (!this.#dbOpenRequest) {
			this.#dbOpenRequest = window.indexedDB.open(historyDbName, historyDbVersion);
			this.#dbOpenRequest.addEventListener('error', () => {
				this.#dbPromiseResolve(null);
			});

			this.#dbOpenRequest.addEventListener('success', () => {
				this.#dbPromiseResolve(this.#dbOpenRequest!.result);
			});

			this.#dbOpenRequest.addEventListener('upgradeneeded', () => {
				const db = this.#dbOpenRequest!.result;

				// Create the stores
				db.createObjectStore(historyAssetStore, {
					keyPath: ['appId', 'contextId', 'assetId'],
				});

				const transactionStore = db.createObjectStore(historyTransactionStore, {
					keyPath: ['userId', 'transactionId', 'row'],
				});

				transactionStore.createIndex(userRowIndex, ['userId', 'row'], { unique: true });
			});
		}

		return this.#dbPromise;
	}

	static async insertTransaction(transaction: MarketTransaction): Promise<boolean> {
		return this.#insert(historyTransactionStore, transaction);
	}

	static async insertAsset(asset: MarketAsset): Promise<boolean> {
		return this.#insert(historyAssetStore, asset);
	}

	static async #insert(store: string, data: MarketTransaction | MarketAsset): Promise<boolean> {
		const db = await this.#getDb();
		if (!db) {
			return false;
		}

		return new Promise<boolean>((resolve) => {
			const objectStore = db.transaction(store, 'readwrite').objectStore(store);

			const request = objectStore.put(data);

			request.addEventListener('success', () => resolve(true));
			request.addEventListener('error', () => resolve(false));
		});
	}

	static async getAsset(appId: string, contextId: string, assetId: string): Promise<MarketAsset | null> {
		return this.#get(historyAssetStore, [appId, contextId, assetId]);
	}

	static async #get(store: string, key: string[]): Promise<MarketAsset | null> {
		const db = await this.#getDb();
		if (!db) {
			return null;
		}

		return new Promise<MarketAsset | null>((resolve) => {
			const objectStore = db.transaction(store, 'readonly').objectStore(store);

			const request = objectStore.get(key);

			request.addEventListener('success', () => resolve(request.result));
			request.addEventListener('error', () => resolve(null));
		});
	}

	/**
	 * Return the last stored transaction
	 * @returns The last (most recent) row or -1 in case of error
	 */
	static async getLastRow(): Promise<number> {
		const db = await this.#getDb();
		if (!db) {
			return -1;
		}

		return new Promise<number>((resolve) => {
			const objectStore = db.transaction(historyTransactionStore, 'readonly').objectStore(historyTransactionStore);

			// Open the cursor on the row index decreasing
			let index = objectStore.index(userRowIndex);
			let cursorRequest = index.openCursor(undefined, 'prev');

			cursorRequest.addEventListener('error', () => resolve(-1));
			cursorRequest.addEventListener('success', () => {
				const cursor = cursorRequest.result;
				if (cursor) {
					// Access the first record
					const value = cursor.value;
					if (value) {
						// Return the first row
						resolve((cursor.value as MarketTransaction).row);
						return;
					}
				}
				resolve(-1);
			});
		});
	}

	static async getAllTransactions(): Promise<MarketTransaction[]> {
		const db = await this.#getDb();
		if (!db) {
			return [];
		}

		return new Promise<MarketTransaction[]>((resolve) => {
			const objectStore = db.transaction(historyTransactionStore, 'readonly').objectStore(historyTransactionStore);

			let request = objectStore.getAll();

			request.addEventListener('error', () => resolve([]));
			request.addEventListener('success', () => resolve(request.result));
		});
	}

	static async * fetchTransactions(): AsyncGenerator<MarketTransaction, null, unknown> {//Promise<MarketTransaction | null> {
		const db = await this.#getDb();
		if (!db) {
			return null;
		}

		let nextPromiseResolve: (value: void) => void;
		let nextPromise = new Promise<void>(resolve => nextPromiseResolve = resolve);

		const mc = new MessageChannel();

		// Iterate is a function that turns the event listener into a generator
		const datas: (MarketTransaction | null)[] = [];
		async function* iterate(): AsyncGenerator<MarketTransaction, null, unknown> {
			mc.port1.onmessage = (event: MessageEvent) => {
				datas.push(event.data)
				//console.count('mc.port1.onmessage');
				nextPromiseResolve();
			};

			while (true) {
				await nextPromise;
				const datas2 = Array.from(datas);
				console.info(datas2.length);
				while (datas.pop()) { }
				nextPromise = new Promise<void>(resolve => nextPromiseResolve = resolve);

				for (const data of datas2) {
					if (data) {
						yield data;
					} else {
						return null;
					}
				}
			}
		}

		// Get the store and open the cursor
		const objectStore = db.transaction(historyTransactionStore, 'readonly').objectStore(historyTransactionStore);

		let cursorRequest = objectStore.openCursor();
		cursorRequest.addEventListener('error', () => mc.port2.postMessage(null)/*nextPromiseResolve(null)*/);
		cursorRequest.addEventListener('success', () => {
			const cursor = cursorRequest.result;
			if (cursor) {
				mc.port2.postMessage(cursor.value);
				cursor.continue();
			} else {
				mc.port2.postMessage(null);
			}
		});

		// Generate the values
		for await (const value of iterate()) {
			yield value;
		}

		return null;
	}
}
