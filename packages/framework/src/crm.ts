import { z } from "zod";

export const crmProviderIdSchema = z.string().min(1);

export const crmObjectTypeSchema = z.enum([
  "company",
  "contact",
  "lead",
  "opportunity",
  "deal",
  "account",
  "list_entry",
  "note",
  "task",
  "campaign",
  "custom",
]);

export const crmExternalRefSchema = z.object({
  providerId: crmProviderIdSchema,
  objectType: crmObjectTypeSchema,
  objectId: z.string().min(1),
  url: z.string().url().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const normalizedCrmCompanySchema = z.object({
  name: z.string().nullable(),
  domain: z.string().nullable(),
  websiteUrl: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  externalRefs: z.array(crmExternalRefSchema).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const normalizedCrmContactSchema = z.object({
  fullName: z.string().min(1),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  title: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyDomain: z.string().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  twitterUrl: z.string().url().nullable().optional(),
  externalRefs: z.array(crmExternalRefSchema).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const normalizedCrmOpportunitySchema = z.object({
  name: z.string().min(1),
  amount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  company: normalizedCrmCompanySchema.optional(),
  contact: normalizedCrmContactSchema.optional(),
  externalRefs: z.array(crmExternalRefSchema).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const crmNoteSchema = z.object({
  body: z.string().min(1),
  subject: z.string().nullable().optional(),
  externalRefs: z.array(crmExternalRefSchema).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const crmProspectSyncRequestSchema = z.object({
  providerId: crmProviderIdSchema,
  prospectId: z.string().optional(),
  campaignId: z.string().optional(),
  company: normalizedCrmCompanySchema.nullable().optional(),
  contact: normalizedCrmContactSchema,
  opportunity: normalizedCrmOpportunitySchema.nullable().optional(),
  note: crmNoteSchema.nullable().optional(),
  listId: z.string().nullable().optional(),
  listStage: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const crmProspectSyncResultSchema = z.object({
  providerId: crmProviderIdSchema,
  companyRef: crmExternalRefSchema.nullable().optional(),
  contactRef: crmExternalRefSchema.nullable().optional(),
  opportunityRef: crmExternalRefSchema.nullable().optional(),
  listEntryRef: crmExternalRefSchema.nullable().optional(),
  noteRef: crmExternalRefSchema.nullable().optional(),
  warnings: z.array(z.string()),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const crmStageUpdateRequestSchema = z.object({
  providerId: crmProviderIdSchema,
  target: crmExternalRefSchema,
  stage: z.string().min(1),
  reason: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const crmStageUpdateResultSchema = z.object({
  providerId: crmProviderIdSchema,
  target: crmExternalRefSchema,
  stage: z.string().min(1),
  warnings: z.array(z.string()),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export type CrmObjectType = z.infer<typeof crmObjectTypeSchema>;
export type CrmExternalRef = z.infer<typeof crmExternalRefSchema>;
export type NormalizedCrmCompany = z.infer<typeof normalizedCrmCompanySchema>;
export type NormalizedCrmContact = z.infer<typeof normalizedCrmContactSchema>;
export type NormalizedCrmOpportunity = z.infer<typeof normalizedCrmOpportunitySchema>;
export type CrmNote = z.infer<typeof crmNoteSchema>;
export type CrmProspectSyncRequest = z.infer<typeof crmProspectSyncRequestSchema>;
export type CrmProspectSyncResult = z.infer<typeof crmProspectSyncResultSchema>;
export type CrmStageUpdateRequest = z.infer<typeof crmStageUpdateRequestSchema>;
export type CrmStageUpdateResult = z.infer<typeof crmStageUpdateResultSchema>;
