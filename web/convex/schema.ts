import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({ owner: v.string(), revision: v.number() }).index("by_owner", ["owner"]),
  records: defineTable({ owner: v.string(), key: v.string(), value: v.string() }).index(
    "by_owner_key",
    ["owner", "key"],
  ),
});
