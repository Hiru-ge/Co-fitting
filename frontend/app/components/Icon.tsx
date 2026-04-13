import type { SVGProps } from "react";
import { ICON_PATHS } from "./iconPaths";

// Material Symbols アイコン名（アンダースコアまたはハイフン区切り）を受け付ける
// 例: "explore", "arrow_back", "arrow-back" はすべて同じアイコンを指す
type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "fill"> & {
  name: string;
  fill?: boolean;
};

/** Material Symbols アイコンを SVG としてインラインレンダリングするコンポーネント。
 *  Web フォント由来の FOUT（フォント読み込み前にアイコン名テキストが表示される問題）を回避する。
 *  サイズは text-xl などの Tailwind フォントサイズクラス、または fontSize インラインスタイルで制御できる。 */
export function Icon({ name, fill = false, className, ...rest }: IconProps) {
  const key = name.replace(/_/g, "-") as keyof typeof ICON_PATHS;
  const entry = ICON_PATHS[key];

  if (!entry) return null;

  const [outlinedPath, filledPath] = entry;
  const d = fill ? filledPath : outlinedPath;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      className={className}
      {...rest}
    >
      <path fill="currentColor" d={d} />
    </svg>
  );
}
