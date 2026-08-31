import { useTranslation } from "react-i18next";
import { useGlyphGroups } from "../hooks/use-glyph-groups";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import { glyphOf } from "../lib/glyphs";
import type { SheetClose } from "../lib/types";

export function GlyphPicker({
  current,
  onPick,
  close,
}: {
  current: string;
  onPick: (iconName: IconName) => void;
  close: SheetClose;
}) {
  const { t } = useTranslation();
  const groups = useGlyphGroups();
  const currentGlyph = glyphOf(current);
  return (
    <>
      <h3>{t("exercise.pickIcon", "Pick an icon")}</h3>
      {groups.map((group) => (
        <div key={group.id} className="mb-3.5">
          <div className="block px-0.5 pb-2 text-sm tracking-tight text-foreground/60">
            {group.label}
          </div>
          <div className="grid grid-cols-5 gap-2.5">
            {group.items.map((iconName) => (
              <button
                type="button"
                key={iconName}
                className={
                  iconName === currentGlyph
                    ? "flex aspect-square items-center justify-center rounded-lg bg-primary text-2xl text-primary-foreground transition active:scale-95"
                    : "flex aspect-square items-center justify-center rounded-lg bg-card text-2xl text-foreground transition active:scale-95"
                }
                onClick={() => {
                  void close();
                  onPick(iconName);
                }}
                aria-label={iconName}
              >
                <Icon name={iconName} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="h-1" />
    </>
  );
}
