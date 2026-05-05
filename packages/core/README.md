# `@squadquarium/core` — core package

> Owner: Parker (Backend Engineer)
> Reviewer: Ripley (Tester / Reviewer)

`@squadquarium/core` is the internal engine layer of Squadquarium. It owns
the Squad SDK adapter facade (typed wrapper around `@bradygaster/squad-sdk`),
the filesystem observer (watches `.squad/` for live state changes), the event
reconciler (deduplication, watermarking, precedence ordering of the event
stream), the PTY pool (manages `node-pty` processes for Interactive mode), the
context resolver (maps `.squad/` paths to typed agent/skill/decision objects),
and the `squadquarium doctor` check implementations. This package is not
published to npm; it is compiled to `dist/` and bundled into the `squadquarium`
CLI package by Parker's `files` / `bundleDependencies` configuration.
