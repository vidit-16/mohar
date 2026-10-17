import Ajv2020 from "ajv/dist/2020.js"
import { describe, expect, it } from "vitest"
import schema from "../../arkiv/schemas/payloads.schema.json"
import { PROJECT, publicClient } from "../../src/lib/mohar"
import { and, eq } from "@arkiv-network/sdk/query"
import { str } from "@arkiv-network/sdk/attr"

// the published data contract has to describe what is actually on chain, not what we meant to write
describe("every mohar-v1 payload on Tiramisu matches the published JSON schema", () => {
  const ajv = new Ajv2020({ strict: false })
  ajv.addSchema(schema, "mohar")

  it.each(["paper_commit", "reveal", "open_exam", "witness"])("%s", async (type) => {
    const validate = ajv.getSchema(`mohar#/$defs/${type}`)!
    let page = await publicClient().select({ key: true, payload: true }).where(and([eq("project", str(PROJECT)), eq("type", str(type))])).limit(200).fetch()
    let checked = 0
    for (;;) {
      for (const e of page.entities) {
        const ok = validate(e.toJson())
        expect(ok, `${e.key}: ${JSON.stringify(validate.errors)}`).toBe(true)
        checked++
      }
      if (!page.hasNextPage()) break
      page = await page.next()
    }
    expect(checked).toBeGreaterThan(0)
  })
})
