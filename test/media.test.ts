import { describe, expect, it } from "vitest";
import { sessionRenderer } from "../src/admin.js";
import { frameMediaAddresses, mediaAddresses, withMediaAddresses } from "../src/media.js";

describe("media addresses", () => {
  it("puts a site in a folder's media under its folder, and leaves other addresses as they are", () => {
    const address = mediaAddresses("/goodfellow-demo/");
    expect(address("/media/church.svg")).toBe("/goodfellow-demo/media/church.svg");
    expect(address("/about")).toBe("/about");
    expect(address("https://example.org/media/photo.jpg")).toBe("https://example.org/media/photo.jpg");
    const elsewhere = mediaAddresses("https://parish.example/site");
    expect(elsewhere("/media/a.jpg")).toBe("https://parish.example/site/media/a.jpg");
  });

  it("leaves addresses to Goodfellow where its session says it shows the site's media itself", () => {
    const shown = frameMediaAddresses({ showsMedia: true }, "/goodfellow-demo/");
    expect(shown("/media/church.svg")).toBe("/media/church.svg");
    expect(frameMediaAddresses({}, "/goodfellow-demo/")("/media/church.svg")).toBe("/goodfellow-demo/media/church.svg");
  });

  it("leaves a site at the root of its domain's media as it is", () => {
    expect(mediaAddresses("/")("/media/church.svg")).toBe("/media/church.svg");
    const html = '<img src="/media/church.svg" alt="">';
    expect(withMediaAddresses(html, mediaAddresses("/"))).toBe(html);
  });

  it("shows drawn images, links, posters and backgrounds from the site's folder", () => {
    const html = withMediaAddresses(
      '<section style="background-image: url(\'/media/sky.jpg\')"><img src="/media/church.svg" alt="">' +
        '<a href="/media/bulletin.pdf">Bulletin</a><a href="/about">About</a>' +
        '<video poster="/media/still.jpg" src="https://videos.example/a.mp4"></video></section>',
      mediaAddresses("/goodfellow-demo/"),
    );
    expect(html).toContain('src="/goodfellow-demo/media/church.svg"');
    expect(html).toContain('href="/goodfellow-demo/media/bulletin.pdf"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('poster="/goodfellow-demo/media/still.jpg"');
    expect(html).toContain('src="https://videos.example/a.mp4"');
    expect(html).toContain("url('/goodfellow-demo/media/sky.jpg')");
  });

  it("shows smaller copies in srcset from the site's folder, keeping their widths", () => {
    const html = withMediaAddresses(
      '<picture><source srcset="/media/media-sizes/640/a.webp 640w, https://cdn.example/a.webp 1280w">' +
        '<img src="/media/a.jpg" srcset="/media/media-sizes/640/a.jpg 640w,/media/a.jpg 2x" alt=""></picture>',
      mediaAddresses("/goodfellow-demo/"),
    );
    expect(html).toContain('srcset="/goodfellow-demo/media/media-sizes/640/a.webp 640w, https://cdn.example/a.webp 1280w"');
    expect(html).toContain('srcset="/goodfellow-demo/media/media-sizes/640/a.jpg 640w,/goodfellow-demo/media/a.jpg 2x"');
  });

  it("draws the site's blocks with their media from the site's folder", async () => {
    const renderer = sessionRenderer(
      { blocks: {}, draw: async () => '<figure><img src="/media/church.svg" alt="The church"></figure>' },
      mediaAddresses("/goodfellow-demo/"),
    );
    expect(await renderer.render({ type: "Image", props: { id: "Image-1" } })).toBe(
      '<figure><img src="/goodfellow-demo/media/church.svg" alt="The church"></figure>',
    );
  });
});
