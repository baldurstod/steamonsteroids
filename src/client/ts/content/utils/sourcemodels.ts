import { Entity, Source1ModelInstance, Source1ModelManager } from 'harmony-3d';

export async function addSource1Model(repository: string, path: string, parent?: Entity): Promise<Source1ModelInstance | null> {
	let model = await Source1ModelManager.createInstance(repository, path, true);
	if (model) {
		parent?.addChild(model);
		model.frame = 0.;
	}
	return model;
}
