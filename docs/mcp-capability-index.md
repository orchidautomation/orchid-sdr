# MCP Capability Archive

This document is migration research for hosted MCP servers and provider capabilities.

It is not the v3 public architecture. Trellis v3 exposes curated provider setup through `trellis connect <provider>`, then mounts the right tools behind the Trellis/Flue runtime. Users should not have to assemble capability/provider/module graphs.

Provider packages can still expose more than one internal capability, but that should compile into Trellis-owned manifests, smoke checks, MCP tool catalogs, and Flue tool bindings without becoming the product-facing CLI.

## Parallel

Docs:

- Search MCP: https://docs.parallel.ai/integrations/mcp/search-mcp
- Task MCP: https://docs.parallel.ai/integrations/mcp/task-mcp
- Programmatic MCP use: https://docs.parallel.ai/integrations/mcp/programmatic-use

MCP servers:

| Server | URL | Auth | Tool | Capabilities | Contracts |
| --- | --- | --- | --- | --- | --- |
| `parallel-search` | `https://search.parallel.ai/mcp` | optional bearer | `web_search` | `search`, `source` | `research.search.v1`, `signal.discovery.v1` |
| `parallel-search` | `https://search.parallel.ai/mcp` | optional bearer | `web_fetch` | `extract` | `research.extract.v1` |
| `parallel-task` | `https://task-mcp.parallel.ai/mcp` | bearer | `createDeepResearch` | `search`, `enrichment` | `research.deepResearch.v1`, `research.enrich.v1` |
| `parallel-task` | `https://task-mcp.parallel.ai/mcp` | bearer | `createTaskGroup` | `enrichment` | `research.enrich.v1` |
| `parallel-task` | `https://task-mcp.parallel.ai/mcp` | bearer | `getStatus` | `observability` | none |
| `parallel-task` | `https://task-mcp.parallel.ai/mcp` | bearer | `getResultMarkdown` | `extract`, `enrichment` | `research.extract.v1`, `research.enrich.v1` |

Parallel is not part of the default GTM stack today. If it returns, it should be a curated research provider connection, not a generic `add` command.

## Firecrawl

Docs:

- MCP server: https://docs.firecrawl.dev/mcp-server

MCP server:

| Server | URL | Auth | Tool | Capabilities | Contracts |
| --- | --- | --- | --- | --- | --- |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_scrape` | `extract` | `research.extract.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_map` | `source` | `signal.discovery.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_search` | `search`, `extract` | `research.search.v1`, `research.extract.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_crawl` | `source`, `extract` | `signal.discovery.v1`, `research.extract.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_check_crawl_status` | `observability` | none |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_extract` | `extract`, `enrichment` | `research.extract.v1`, `research.enrich.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_agent` | `search`, `extract`, `enrichment` | `research.search.v1`, `research.extract.v1`, `research.enrich.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_agent_status` | `observability` | none |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_browser_create` | `runtime` | none |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_browser_execute` | `runtime`, `extract` | `research.extract.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_browser_delete` | `runtime` | none |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_browser_list` | `observability` | none |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_interact` | `runtime`, `extract` | `research.extract.v1` |
| `firecrawl` | `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` | URL token | `firecrawl_interact_stop` | `runtime` | none |

v3 connection:

```bash
trellis connect firecrawl
```

## Config Direction

The old external config idea was too close to abstracting over abstractions. For v3, the generated app should stay Trellis-first and provider manifests should stay internal/product-shaped.

If Trellis needs a manifest, it should look like a deployment artifact, not a user-authored framework config:

```yaml
name: profound-sdr
providers:
  - id: firecrawl
    lane: research
    mcp:
      enabled: true
    tools:
      - research.search
      - research.extract
```

Trellis should compile curated provider connections into:

- provider readiness checks
- doctor checks
- smoke checks
- hidden Flue MCP/tool bindings
- Cloudflare secret names
