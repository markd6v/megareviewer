import { type ComponentType, useEffect, useState } from "react";

/** `web/src/<folder>/playground.tsx` modules by path, each with a component as default export. */
export type PlaygroundModules = Readonly<
  Record<string, () => Promise<{ readonly default: ComponentType }>>
>;

/** A playground is named after its folder: `../diff/playground.tsx` is "diff". */
export const findPlayground = (modules: PlaygroundModules, name: string) =>
  Object.entries(modules).find(
    ([path]) => /([^/]+)\/playground\.tsx$/.exec(path)?.[1] === name,
  )?.[1] ?? null;

export const PlaygroundPage = ({
  modules,
  name,
}: {
  readonly modules: PlaygroundModules;
  readonly name: string;
}) => {
  const load = findPlayground(modules, name);
  const [loaded, setLoaded] = useState<{
    readonly name: string;
    readonly Component: ComponentType;
  }>();
  useEffect(() => {
    let current = true;
    void load?.().then((module) => {
      if (current) setLoaded({ name, Component: module.default });
    });
    return () => {
      current = false;
    };
  }, [load, name]);

  if (load === null) return <p>No playground named “{name}”.</p>;
  if (loaded?.name !== name) return <p className="muted">Loading playground…</p>;
  return <loaded.Component />;
};
