import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TooltipPayload, TooltipValueType } from "recharts";

import { ChartContainer, ChartTooltipContent } from "@/shared/ui/chart";

const tooltipPayload: TooltipPayload = [
  {
    graphicalItemId: "series-a",
    dataKey: "value",
    name: "Value",
    value: 7,
    color: "#000",
    payload: { fill: "#000" },
  },
  {
    graphicalItemId: "series-b",
    dataKey: "value",
    name: "Value",
    value: 9,
    color: "#111",
    payload: { fill: "#111" },
  },
];

describe("ChartTooltipContent", () => {
  it("passes Recharts' full tooltip payload to the formatter", () => {
    type TooltipFormatter = (
      value: TooltipValueType | undefined,
      name: string | number | undefined,
      item: TooltipPayload[number],
      index: number,
      payload: TooltipPayload,
    ) => ReactNode;
    const formatter = vi.fn<TooltipFormatter>(() => null);

    renderToStaticMarkup(
      <ChartContainer config={{ value: { label: "Value", color: "#000" } }}>
        <ChartTooltipContent active payload={tooltipPayload} formatter={formatter} />
      </ChartContainer>,
    );

    expect(formatter).toHaveBeenCalledTimes(2);
    expect(formatter.mock.calls[0]?.[4]).toBe(tooltipPayload);
    expect(formatter.mock.calls[1]?.[4]).toBe(tooltipPayload);
  });
});
