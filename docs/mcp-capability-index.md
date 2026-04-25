# MCP Capability Index

This index maps hosted MCP servers to AI SDR capabilities. It is the working source of truth for what `ai-sdr add <capability> <provider>` should mount into the sandbox.

Provider packages can expose more than one capability. The CLI should install by capability/provider pair, but it should mount the provider's MCP servers from the package manifest.

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

Module commands:

```bash
ai-sdr add search parallel
ai-sdr add extract parallel
ai-sdr add enrichment parallel
```

`ai-sdr add research parallel` should remain an alias for search/extract/enrichment.

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

Module commands:

```bash
ai-sdr add search firecrawl
ai-sdr add extract firecrawl
ai-sdr add enrichment firecrawl
```

## Config Direction

The eventual external config can be YAML, while the TypeScript config remains the typed implementation target.

Example shape:

```yaml
name: profound-sdr
modules:
  - capability: search
    provider: parallel
    package: "@ai-sdr/parallel"
    mcp:
      - id: parallel-search
        url: https://search.parallel.ai/mcp
        auth: optional-bearer
      - id: parallel-task
        url: https://task-mcp.parallel.ai/mcp
        auth: bearer
  - capability: extract
    provider: firecrawl
    package: "@ai-sdr/firecrawl"
    mcp:
      - id: firecrawl
        url: https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp
        auth: url-token
```

The framework should compile this into:

- package installs
- `ai-sdr.config.ts`
- sandbox `.mcp.json`
- env requirements
- doctor checks
- smoke checks
