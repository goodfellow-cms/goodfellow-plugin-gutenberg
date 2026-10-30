/**
 * Where the frame shows the site's media from. Content names files as
 * `/media/photo.jpg`, their address on a site at the root of its domain, but a
 * site can be in a folder of one (GitHub Pages' `example.github.io/site/`),
 * where they're under the folder, as the admin panel's `siteUrl` says. Puck's
 * frame in the admin panel shows them from there; this does the same here.
 */

const MEDIA_PREFIX = "/media/";
const URL_ATTRIBUTES = ["src", "href", "poster"];
const MEDIA_IN_STYLE = /url\((['"]?)(\/media\/[^'")]+)\1\)/g;

/** The address to show a media file from, given the site's address: other addresses are returned as they are. */
export function mediaAddresses(siteUrl: string): (url: string) => string {
  const base = siteUrl.replace(/\/+$/, "");
  return (url) => (base && url.startsWith(MEDIA_PREFIX) ? `${base}${url}` : url);
}

/**
 * How the frame shows media: Goodfellow releases whose session says `showsMedia`
 * show the site's media in the frame themselves, from wherever each file is now
 * (uploads not yet published and a storage plugin's files too), so addresses are
 * left as content has them; older releases need the site's address added here.
 */
export function frameMediaAddresses(session: object, siteUrl: string): (url: string) => string {
  return (session as { showsMedia?: boolean }).showsMedia ? (url) => url : mediaAddresses(siteUrl);
}

/** A `srcset`'s candidates, each address given to `address`, with their widths or densities kept. */
function withSrcsetAddresses(srcset: string, address: (url: string) => string): string {
  return srcset
    .split(",")
    .map((candidate) => {
      const [, space = "", url = "", rest = ""] = /^(\s*)(\S+)([\s\S]*)$/.exec(candidate) ?? [];
      return url.startsWith(MEDIA_PREFIX) ? `${space}${address(url)}${rest}` : candidate;
    })
    .join(",");
}

/**
 * HTML the site's code drew, with the media its images, links and inline styles
 * show where the frame can show them, smaller copies in `srcset` included. Only for what's shown: values written
 * back into content keep their `/media/` addresses.
 */
export function withMediaAddresses(html: string, address: (url: string) => string, doc: Document = document): string {
  if (!html.includes(MEDIA_PREFIX) || address(MEDIA_PREFIX) === MEDIA_PREFIX) return html;
  const template = doc.createElement("template");
  template.innerHTML = html;
  for (const element of template.content.querySelectorAll("[src], [href], [poster], [srcset], [style]")) {
    for (const attribute of URL_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value?.startsWith(MEDIA_PREFIX)) element.setAttribute(attribute, address(value));
    }
    const srcset = element.getAttribute("srcset");
    if (srcset?.includes(MEDIA_PREFIX)) element.setAttribute("srcset", withSrcsetAddresses(srcset, address));
    const style = element.getAttribute("style");
    if (style?.includes(MEDIA_PREFIX)) {
      element.setAttribute(
        "style",
        style.replace(MEDIA_IN_STYLE, (_match, quote: string, url: string) => `url(${quote}${address(url)}${quote})`),
      );
    }
  }
  return template.innerHTML;
}
