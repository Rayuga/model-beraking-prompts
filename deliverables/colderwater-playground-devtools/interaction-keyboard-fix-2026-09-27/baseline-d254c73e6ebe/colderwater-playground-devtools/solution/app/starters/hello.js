// The starter that loads when the playground opens with nothing saved.
const el = document.querySelector('#out');
const rows = [];
for (let i = 1; i <= 12; i += 1) {
  rows.push(`${i} squared is ${i * i}`);
}
el.textContent = rows.join('\n');
console.log('printed %d rows', rows.length);
