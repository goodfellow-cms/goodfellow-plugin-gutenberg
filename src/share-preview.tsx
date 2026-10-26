/**
 * How a link to the page looks when it's shared, under the page's settings,
 * as Puck's editor shows it: the admin panel works it out from the settings
 * as they are, or else Site Settings'.
 */
import type { PluginEditorData, PluginSharePreview } from "@goodfellow-cms/core";
import { useEffect, useState } from "react";

export function SharePreview({
  root,
  preview,
}: {
  root: PluginEditorData["root"];
  preview(root: PluginEditorData["root"]): Promise<PluginSharePreview>;
}) {
  const [shown, setShown] = useState<PluginSharePreview>();
  const key = JSON.stringify(root.props ?? {});
  useEffect(() => {
    let current = true;
    // A moment after the last change, rather than with every letter typed.
    const timer = setTimeout(() => {
      preview({ ...root, props: JSON.parse(key) }).then(
        (answer) => current && setShown(answer),
        () => {},
      );
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // `root` is read through `key`, so its other parts don't start it again.
    // biome-ignore lint/correctness/useExhaustiveDependencies: as above
  }, [key, preview]);
  if (!shown) return null;
  return (
    <figure className="gf-share-preview" aria-label="How a link to this page looks when it's shared">
      {shown.image && <img src={shown.image} alt="" />}
      <figcaption>
        {shown.host && <span className="gf-share-host">{shown.host}</span>}
        <strong>{shown.title}</strong>
        {shown.description && <span>{shown.description}</span>}
        {shown.noIndex && <em>Hidden from search engines</em>}
      </figcaption>
    </figure>
  );
}
