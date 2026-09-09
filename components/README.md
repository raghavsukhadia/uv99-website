# components

Reserved for reusable header/footer/navigation/card/section markup. The
site currently has no templating or include mechanism — every page is a
self-contained static HTML file with the header, navigation and footer
markup repeated inline. Extracting that markup into real includes would
require adding a build step (a templating engine or an include processor),
which changes the site's architecture and was explicitly out of scope for
this reorganization. The `header/`, `footer/`, `navigation/`, `cards/` and
`sections/` subfolders are left in place for when that build step is added.
