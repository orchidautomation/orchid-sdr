# CRM Normalization

This page describes the CRM abstraction Orchid needs before Salesforce, HubSpot, Twenty, Attio, and Nango-backed integrations can all work cleanly.

## Principle

Orchid should own the GTM data model. CRM vendors should be adapters.

That means the framework needs normalized objects for:

- companies / accounts
- contacts / people / leads
- opportunities / deals
- notes
- list or campaign memberships
- stage updates
- provider references

Vendor-specific fields should not disappear. They should live under `attributes` or `raw`, while the stable GTM fields stay normalized.

## Current Contract

The first CRM normalization schemas live in [src/framework/crm.ts](../src/framework/crm.ts):

```ts
normalizedCrmCompanySchema
normalizedCrmContactSchema
normalizedCrmOpportunitySchema
crmProspectSyncRequestSchema
crmProspectSyncResultSchema
crmStageUpdateRequestSchema
crmStageUpdateResultSchema
```

Provider-facing contracts live in [src/framework/provider-contracts.ts](../src/framework/provider-contracts.ts):

```ts
CrmProvider
ProspectCrmProvider
```

## Why This Matters For Salesforce

Salesforce does not map one-to-one with Attio or HubSpot.

Common Salesforce shapes:

- `Account`
- `Contact`
- `Lead`
- `Opportunity`
- `Campaign`
- `CampaignMember`
- `Task`
- custom objects

Orchid should not force every CRM into Salesforce terms. Instead:

- normalized `company` can map to Salesforce `Account`
- normalized `contact` can map to Salesforce `Contact` or `Lead`
- normalized `opportunity` can map to Salesforce `Opportunity`
- normalized list/stage state can map to `CampaignMember`, a pipeline object, or a custom object
- vendor-specific fields live in `attributes`

That lets a Salesforce adapter support serious enterprise schemas without making the whole framework Salesforce-shaped.

## Where Nango Fits

Nango is a good fit as an integration runtime, not as the Orchid data model.

Nango can handle:

- OAuth and token refresh
- per-customer connections
- API proxying
- syncs and actions
- webhooks
- observability for integration calls
- large vendor coverage

Orchid should still define:

- the normalized CRM schemas
- the SDR workflow semantics
- when to sync
- what evidence to write
- what stage transitions mean
- how CRM state affects future agent decisions

In other words:

```text
Orchid normalized CRM contract
        |
        v
Native adapter or Nango-backed adapter
        |
        v
Salesforce / HubSpot / Twenty / Attio / other CRM
```

## Adapter Pattern

Each CRM adapter should implement a normalized surface:

```ts
interface ProspectCrmProvider {
  providerId: string;
  syncProspect(input: CrmProspectSyncRequest): Promise<CrmProspectSyncResult>;
  updateStage?(input: CrmStageUpdateRequest): Promise<CrmStageUpdateResult>;
}
```

Native adapters can call vendor APIs directly.

Nango-backed adapters can use Nango for auth, proxy calls, and sync/action execution while still mapping data to Orchid's normalized request/result schemas.

## Future Modules

Likely future modules:

```text
@ai-sdr/salesforce
@ai-sdr/hubspot
@ai-sdr/twenty
@ai-sdr/nango
@ai-sdr/attio
```

The `@ai-sdr/nango` package should probably be a lower-level integration runtime helper, while Salesforce/HubSpot/Twenty packages provide CRM-specific mappings.

Each CRM module should declare the normalized contracts it supports:

```text
crm.prospectSync.v1
crm.stageUpdate.v1
```

That makes compatibility explicit. A Salesforce module and an Attio module can both satisfy `crm.prospectSync.v1`, even if one writes `Account` / `Contact` / `CampaignMember` and the other writes company / person / list entry records.

## Design Rule

Normalize workflow meaning, not every vendor field.

The framework should standardize the things an AI SDR needs to reason about:

- who is the company?
- who is the person?
- what is their role?
- what was the source?
- what evidence qualified them?
- where should the CRM record live?
- what stage should it move to?
- what should the human see?

Everything else can stay vendor-specific.
