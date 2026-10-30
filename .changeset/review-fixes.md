---
"goodfellow-plugin-gutenberg": patch
---

Uses the site's own React rather than a copy of its own: React and React DOM are peer dependencies, as they are for WordPress's packages, so the plugin's frame never bundles two. Drawn blocks show the site's smaller copies of photos (`srcset`) from a site in a folder, as they do the photo itself. Tidying text that has private-use characters of its own, such as an icon font's, keeps the selection where it was. A block that couldn't be drawn shows its name as text. The repository checks its packages for security advisories, and Dependabot keeps them up to date.
