export function sortSelect(selectNode: HTMLSelectElement) {
	const optionNodes = Array.from(selectNode.children);
	optionNodes.sort((a, b) => { return a.innerHTML < b.innerHTML ? -1 : 1 });
	optionNodes.forEach((option) => selectNode.append(option));
}
