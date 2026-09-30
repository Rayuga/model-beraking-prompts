// Kept on purpose: this one throws. The playground has to report the error
// with its line number rather than going blank or hanging.
const items = [1, 2, 3];
items.forEeach((n) => console.log(n));
