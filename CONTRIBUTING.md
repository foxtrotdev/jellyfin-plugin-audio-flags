# Contributing

Thanks for considering a contribution to Jellyfin Audio Flags!

## Reporting bugs

Please open an issue using the **Bug report** template. Include:

- A clear description of what you expected and what happened.
- Reproduction steps (smallest possible case).
- Jellyfin server version and web client version.
- Browser and version.
- Plugin version.
- Any relevant browser-console errors (enable **Debug logging** in the plugin config first).

## Proposing features

Open an issue using the **Feature request** template before sending a large PR — that way we can agree on scope.

## Pull requests

- Base branch is `main`. Open PRs against `main`.
- Branch naming: `feat/<short-name>` for new features, `fix/<short-name>` for bug fixes, `docs/<short-name>` for documentation only.
- Keep PRs focused — one logical change per PR.
- Request a review from a maintainer (`@foxtrotdev`) when ready.
- Reference the issue the PR closes (e.g. `Closes #12`).

## Local development

You need the **.NET 8 SDK** installed.

```bash
# from the repo root
dotnet build
# or a release build:
cd Jellyfin.Plugin.AudioFlags
dotnet publish -c Release -o ./out
```

Make sure `dotnet build` passes cleanly with no new warnings before opening a PR.

## Testing in a Jellyfin instance

1. Build the plugin (see above).
2. Copy `out/Jellyfin.Plugin.AudioFlags.dll` into your Jellyfin plugin folder under `plugins/AudioFlags/`.
3. Restart Jellyfin.
4. Hard-refresh the web client (`Ctrl/Cmd + Shift + R`).
5. Verify your change against a library that has multi-language audio and subtitles.

If your change affects the injected client script, please also test against a fresh browser profile (no cached `index.html`).

## Code style

- C#: follow the existing style in the project (`dotnet format` is fine).
- JavaScript: match the formatting of `Web/audio-flags.js` — small, dependency-free, ES2017+.
- Keep commits self-contained; squash fixups before review.

## License

By contributing you agree that your contributions will be licensed under the project's [Apache License 2.0](LICENSE).
