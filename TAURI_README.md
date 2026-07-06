# WubFlipz Tauri Desktop

## Prerequisites

- Node.js and npm
- Rust and Cargo
- Tauri system dependencies for your OS
- Python 3 for the `dev:tauri` static file server

Install JavaScript dependencies once:

```sh
npm install
```

## Development

```sh
npm run dev:tauri
```

This starts a static server for the existing `index.html` app and opens it in a Tauri desktop window.

## Build

```sh
npm run build:tauri
```

Tauri copies the existing `index.html`, `css/`, and `js/` files into `tauri-dist/`, then packages that static app.

## Installers

Built desktop bundles/installers appear under:

```text
src-tauri/target/release/bundle/
```
