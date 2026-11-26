const input = document.querySelector('#filter');
const status = document.querySelector('#matches');
const sections = [...document.querySelectorAll('.group')].map(element => ({
  element,
  items: [...element.querySelectorAll('li')].map(node => ({node, text: node.textContent.toLocaleLowerCase()}))
}));
const total = sections.reduce((sum, section) => sum + section.items.length, 0);
function update() {
  const query = input.value.trim().toLocaleLowerCase();
  let count = 0;
  for (const {element, items} of sections) {
    let visible = 0;
    for (const {node, text} of items) {
      node.hidden = !text.includes(query);
      if (!node.hidden) visible++;
    }
    element.hidden = !visible;
    element.open = Boolean(query && visible);
    count += visible;
  }
  status.textContent = query ? count.toLocaleString() + (count === 1 ? ' matching page' : ' matching pages') : total.toLocaleString() + ' pages';
}
input.addEventListener('input', update);
update();
