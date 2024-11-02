import { Entity, Source1ModelManager } from 'harmony-3d';

export async function addSource1Model(repository: string, fileName: string, parent?: Entity) {
	let model = await Source1ModelManager.createInstance(repository, fileName, true);
	parent?.addChild(model);
	model.frame = 0.;
	return model;
}
