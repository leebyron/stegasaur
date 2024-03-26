import * as St from "./index.mjs";

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
