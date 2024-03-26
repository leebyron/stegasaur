import * as St from "./index.mjs";

console.log(St.retrieve(St.annotate('test', {a:'éx†®å'})))

let t1 =
  "ok" +
  St.annotate(
    St.annotate(
      "then" + St.annotate("wow", { hello: "world" }) + "cool",
      "wild"
    ),
    null
  ) +
  "more";

console.log(t1);

for (let f1 of St.retrieveAll(t1)) {
  console.log(f1);
}

console.log("all", t1, St.retrieveAll(t1));

console.log("removed", St.remove(t1), St.remove(t1), [
  ...St.retrieveAll(St.remove(t1)),
]);
console.log("removed all", St.removeAll(t1), [
  ...St.retrieveAll(St.removeAll(t1)),
]);

console.log(
  "replace all",
  St.replaceAll(t1, ({ string, data }) => `(${string}|${JSON.stringify(data)})`)
);

console.log('FINAL TEST')
console.log(...St.retrieveAll('ok((then(wow|‌﻿‍​‍​‍‌‍‍‍‌‍‌‌‌‍‌‍‌‍​‍​‍﻿‍‍‍​‍​‍‌‌‌‍‌​‍‌‍‌‍‌​‍​‍‌‌)cool|​‍​‍‌‌‌‍‍‍‌‌‍‌‍‌​‍​‍)|‌‍﻿‍‌‌‌‌‍‌‍)more'))


console.log(
  `0x200b (${String.fromCodePoint(0x200b)}) ` +
  `0x200c (${String.fromCodePoint(0x200c)}) ` +
  `0x200d (${String.fromCodePoint(0x200d)}) ` +
  `0x2060 (${String.fromCodePoint(0x2060)}) ` +
  `0x2061 (${String.fromCodePoint(0x2061)}) ` +
  `0x2062 (${String.fromCodePoint(0x2062)}) ` +
  `0x2063 (${String.fromCodePoint(0x2063)}) ` +
  `0x2064 (${String.fromCodePoint(0x2064)}) ` +
  `0xfeff (${String.fromCodePoint(0xfeff)}) ` +

  `0xfff9 (${String.fromCodePoint(0xfff9)}) ` +
  `0xfffa (${String.fromCodePoint(0xfffa)}) ` +
  `0xfffb (${String.fromCodePoint(0xfffb)}) ` +

  `0x1d173 (${String.fromCodePoint(0x1d173)}) ` +
  `0x1d174 (${String.fromCodePoint(0x1d174)}) ` +
  `0x1d175 (${String.fromCodePoint(0x1d175)}) ` +
  `0x1d176 (${String.fromCodePoint(0x1d176)}) ` +
  `0x1d177 (${String.fromCodePoint(0x1d177)}) ` +
  `0x1d178 (${String.fromCodePoint(0x1d178)}) ` +
  `0x1d179 (${String.fromCodePoint(0x1d179)}) ` +
  `0x1d17a (${String.fromCodePoint(0x1d17a)}) `
);
