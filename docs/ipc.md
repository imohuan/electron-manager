Ipc Router

## `main.js`

```typescript
import { Manager, ManagerData } from "./core/manager";
import { app } from "electron";
import { resolve } from "path";

type Global = { hello: number };
const m = new Manager<ManagerData<Global>>();

m.ipc.handle("hello", (event, name) => {
  return name + Math.random();
});

app.on("ready", async () => {
  m.window!.create("hello", {
    devtool: "bottom",
    file: "G:\\level-2\\Project\\electron-manager\\src\\index.html",
    webPreferences: { preload: resolve(__dirname, "remote1.js"), nodeIntegration: true }
  });

  m.window!.create("hello2", {
    devtool: "bottom",
    file: "G:\\level-2\\Project\\electron-manager\\src\\index.html",
    webPreferences: { preload: resolve(__dirname, "remote2.js"), nodeIntegration: true }
  });

  setTimeout(() => {
    m.ipc.invoke("hello", "你好啊").then((res) => console.log("[Main -> Main]", res));
    m.ipc.invoke("renderHello", "cccc").then((res) => console.log("[Main -> Renderer]", res));
  }, 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

## `remote1.js`

```typescript
import { Manager } from "./core/manager";
const m = new Manager();
console.log("isMain", m.isMain);

m.ipc.handle("renderHello", (event, name) => {
  return { name, age: 1 };
});

setTimeout(() => {
  m.ipc.invoke("hello", "你好啊").then((res) => console.log("[Renderer -> Main]", res));
  m.ipc.invoke("renderHello", "dddd").then((res) => console.log("[Renderer -> Renderer]", res));
}, 1000);
```

## `remote2.js`

```typescript
import { Manager } from "./core/manager";
const m = new Manager();

m.ipc.handle("renderHello", (event, name) => {
  console.log("name", name);
  return { name, h: 12, d: 123123 };
});

setTimeout(() => {
  m.ipc.invoke("renderHello", "remote2").then((res) => console.log("[Renderer -> Renderer]", res));
}, 1000);
```

# Print

## `main.js`

```
[Main -> Main] [ '你好啊0.892015815664918' ]
[Main -> Renderer] [ { name: 'cccc', h: 12, d: 123123 }, { name: 'cccc', age: 1 } ]
```

## `remote1.js`

```
isMain false
[Renderer -> Main] ['你好啊0.5440442934254537']
[Renderer -> Renderer] [{name: 'dddd', h: 12, d: 123123}, {name: 'dddd', age: 1}]
```

## `remote2.js`

```
name cccc
name remote2
name dddd
[Renderer -> Renderer] [ {name: 'remote2', h: 12, d: 123123}, {name: 'remote2', age: 1}]
```
