import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex h-7.75 w-12.75 shrink-0 items-center rounded-full border border-transparent bg-input p-0.5 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="knob pointer-events-none block size-6.75 rounded-full bg-white shadow-md ring-0 transition duration-200 ease-out group-data-checked/switch:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
