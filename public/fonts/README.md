# The self-hosted web fonts

Two families, both under the SIL Open Font License 1.1, downloaded from Google Fonts and
committed here so the site does not call a third party at runtime and works offline.

| Family | Role | Licence | Upstream |
|---|---|---|---|
| Noto Sans Bengali | Bangla | OFL 1.1 | https://fonts.google.com/specimen/Noto+Sans+Bengali |

The Latin body face is Inter, already self-hosted in `src/app/fonts/inter-latin.woff2` and
loaded through `next/font/local`.

Each `*.woff2` file was fetched from Google Fonts and committed here. The `unicode-range` on
each `@font-face` means the browser only downloads the subset a page actually needs: Latin
pages never fetch the 107 KB Bangla file, and Bangla text never falls back to whatever the
operating system happens to have installed.

| File | Family | Weights | Unicode range | Source |
| --- | --- | --- | --- | --- |
| `noto-sans-bengali-bangla.woff2` | Noto Sans Bengali | 400–700 | U+0951-09FE | `fonts.gstatic.com/s/notosansbengali/v33/Cn-fJsCGWQxOjaGwMQ6fIiMywrNJIky6nvd8BjzVMvJx2mc4I3mYvNY.woff2` |
| `noto-sans-bengali-latin.woff2` | Noto Sans Bengali | 400–700 | U+0000-00FF … U+FEFF, U+FFFD | `fonts.gstatic.com/s/notosansbengali/v33/Cn-fJsCGWQxOjaGwMQ6fIiMywrNJIky6nvd8BjzVMvJx2mc4MXmY.woff2` |
| `noto-sans-bengali-latin-ext.woff2` | Noto Sans Bengali | 400–700 | U+0100-02BA … U+2C7F, U+A720-AFFF | `fonts.gstatic.com/s/notosansbengali/v33/Cn-fJsCGWQxOjaGwMQ6fIiMywrNJIky6nvd8BjzVMvJx2mc4P3mYvNY.woff2` |

The exact `unicode-range` of each file is written out in the `@font-face` rules in
`src/app/globals.css`.

## The `@font-face` rules

They live in `src/app/globals.css`, next to the rest of the design tokens. The whole site —
the landing page and the dashboard alike — uses one type stack (`body { font-sans }` → Inter),
with Noto Sans Bengali carrying the Bangla text.
