## Usage

Setup (requires node.js):
```
> npm install
```

Start tests:
```
> npm test
```

Serve up the App (and ctrl-click the URL that appears in the console)
```
> npm run dev
```

## Implementing features

`src/main.ts`
- Code file used as the entry point
- Contains main function that is called on page load

`src/style.css`
- Stylesheet

`index.html`
- Main html file
- Contains scaffold of game window and some sample shapes


```
src/
  main.ts        -- main code logic inc. core game loop
  types.ts       -- common types and type aliases
  util.ts        -- util functions
  state.ts       -- state processing and transformation
  view.ts        -- rendering
  observable.ts  -- functions to create Observable streams
```
